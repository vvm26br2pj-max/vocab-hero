// Relay transport for online play (used by the Google Sites copy). Both devices connect out to a free public
// MQTT broker over a normal secure WebSocket (port 443-style wss), which works in embedded pages and on networks
// that block direct peer-to-peer links. Messages for a room travel on topics named after the room code.
// Only hero nickname, look, attributes, abilities and button presses are sent. No chat.

/** Free public brokers, tried in order. */
export const BROKERS = [
  { name: 'EMQX', url: 'wss://broker.emqx.io:8084/mqtt' },
  { name: 'HiveMQ', url: 'wss://broker.hivemq.com:8884/mqtt' },
  { name: 'Mosquitto', url: 'wss://test.mosquitto.org:8081/mqtt' },
];

const enc = new TextEncoder(), dec = new TextDecoder();
function varint(n: number): number[] { const out: number[] = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; out.push(b); } while (n > 0); return out; }
function str(s: string): number[] { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; }
function packet(type: number, body: number[] | Uint8Array): Uint8Array {
  const head = [type, ...varint(body.length)];
  const out = new Uint8Array(head.length + body.length); out.set(head, 0); out.set(body as ArrayLike<number>, head.length); return out;
}

/** A tiny MQTT 3.1.1 client (QoS 0 only): connect, subscribe, publish, keep-alive. */
export class Mqtt {
  private ws: WebSocket | null = null;
  private buf = new Uint8Array(0);
  private ping: ReturnType<typeof setInterval> | null = null;
  private pid = 1;
  onMessage: (topic: string, text: string) => void = () => {};
  onClose: () => void = () => {};
  closed = false;
  broker = '';

  connect(url: string, timeoutMs = 6000): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (why: string) => { if (settled) return; settled = true; try { ws.close(); } catch { /* */ } reject(new Error(why)); };
      let ws: WebSocket;
      try { ws = new WebSocket(url, ['mqtt']); } catch (e) { reject(new Error((e as Error).message || 'blocked')); return; }
      this.ws = ws; ws.binaryType = 'arraybuffer';
      const t = setTimeout(() => fail('timeout'), timeoutMs);
      ws.onopen = () => {
        const id = 'vh' + Math.random().toString(36).slice(2, 12);
        ws.send(packet(0x10, [...str('MQTT'), 4, 0x02, 0, 30, ...str(id)])); // clean session, 30 s keep-alive
      };
      ws.onerror = () => { clearTimeout(t); fail('could not connect'); };
      ws.onclose = () => { clearTimeout(t); if (!settled) fail('closed'); else this.shutdown(); };
      ws.onmessage = (ev) => {
        const chunk = new Uint8Array(ev.data as ArrayBuffer);
        const merged = new Uint8Array(this.buf.length + chunk.length); merged.set(this.buf); merged.set(chunk, this.buf.length); this.buf = merged;
        this.drain((type, body) => {
          if (type === 2) { // CONNACK
            clearTimeout(t);
            if (body[1] !== 0) return fail('refused');
            settled = true; this.broker = url;
            this.ping = setInterval(() => this.raw(new Uint8Array([0xc0, 0])), 20000);
            resolve();
          } else if (type === 3) { // PUBLISH
            const tl = (body[0] << 8) | body[1];
            const topic = dec.decode(body.subarray(2, 2 + tl));
            const qos = (this.lastFlags >> 1) & 3;
            const start = 2 + tl + (qos ? 2 : 0);
            this.onMessage(topic, dec.decode(body.subarray(start)));
          }
        });
      };
    });
  }
  private lastFlags = 0;
  private drain(fn: (type: number, body: Uint8Array) => void) {
    for (;;) {
      if (this.buf.length < 2) return;
      let len = 0, mul = 1, i = 1;
      for (;;) { if (i >= this.buf.length) return; const b = this.buf[i++]; len += (b & 127) * mul; mul *= 128; if (!(b & 128)) break; if (i > 4) { this.buf = new Uint8Array(0); return; } }
      if (this.buf.length < i + len) return;
      const head = this.buf[0], body = this.buf.subarray(i, i + len);
      this.buf = this.buf.slice(i + len);
      this.lastFlags = head & 15;
      fn(head >> 4, body);
    }
  }
  private raw(p: Uint8Array) { if (this.ws && this.ws.readyState === WebSocket.OPEN) { try { this.ws.send(p); } catch { /* closing */ } } }
  subscribe(topic: string) { const id = this.pid++ & 0xffff || 1; this.raw(packet(0x82, [id >> 8, id & 255, ...str(topic), 0])); }
  publish(topic: string, text: string) { const t = str(topic), b = enc.encode(text); const body = new Uint8Array(t.length + b.length); body.set(t); body.set(b, t.length); this.raw(packet(0x30, body)); }
  private shutdown() { if (this.closed) return; this.closed = true; if (this.ping) clearInterval(this.ping); this.onClose(); }
  close() { this.raw(new Uint8Array([0xe0, 0])); try { this.ws?.close(); } catch { /* */ } this.shutdown(); }
}

/** Connect to the first broker that answers. */
export async function connectAny(onTry?: (name: string) => void): Promise<Mqtt> {
  let last = '';
  for (const b of BROKERS) {
    onTry?.(b.name);
    const m = new Mqtt();
    try { await m.connect(b.url); return m; } catch (e) { last = `${b.name}: ${(e as Error).message}`; }
  }
  throw new Error(`Could not reach any relay server (${last}). The network or the page may be blocking online games.`);
}
