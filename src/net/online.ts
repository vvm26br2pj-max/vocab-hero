// Online play with room codes. Matchmaking uses the free public PeerJS broker; after that the two
// devices talk directly (peer-to-peer). Only hero nickname, look, attributes and abilities are shared. No chat.
import Peer, { type DataConnection } from 'peerjs';
import { BROKERS, Mqtt, connectAny } from './relay';

/** The Google Sites copy (built with VITE_NET=relay, see .env.single) plays through a relay server, since peer-to-peer links are usually blocked there; the website uses PeerJS. Add ?relay to the website address to try relay play there. */
export const RELAY = import.meta.env.VITE_NET === 'relay' || (typeof location !== 'undefined' && /[?&]relay\b/.test(location.search));
import type { PlayerCfg } from '../combat/fighter';
import type { TierId } from '../config/combat';

export const NET_VERSION = 1;
const PREFIX = 'vocabhero-v1-';
/** No look-alike characters (0/O, 1/I/L) so codes are easy to read aloud. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeRoomCode(rng: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 5; i++) s += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return s;
}
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().split('').filter((c) => ALPHABET.includes(c)).join('').slice(0, 5);
}
export function isValidCode(code: string): boolean { return code.length === 5 && [...code].every((c) => ALPHABET.includes(c)); }

export interface OnlineSetup { mode: 'versus' | 'coop'; arenaKey: string; bossId: string; tier: TierId; fair: boolean }
export type NetMsg =
  | { t: 'hello'; v: number; hero: PlayerCfg }
  | { t: 'lobby'; host: PlayerCfg; guest: PlayerCfg | null; setup: OnlineSetup }
  | { t: 'start'; players: PlayerCfg[]; setup: OnlineSetup; seed: number }
  | { t: 'in'; k: string; v: boolean }
  | { t: 'snap'; s: unknown }
  | { t: 'end'; r: { won: boolean; seconds: number; winner?: number; score?: [number, number] } }
  | { t: 'back' }
  | { t: 'full' }
  | { t: 'bye' };

type Handler = (m: NetMsg) => void;

/** One open room, as host or guest. */
export class Room {
  role: 'host' | 'guest';
  code: string;
  private peer: Peer | null;
  /** relay transport (instead of a PeerJS data connection) */
  transport: { send(m: NetMsg): void; close(): void } | null = null;
  private conn: DataConnection | null = null;
  private handlers = new Set<Handler>();
  private statusHandlers = new Set<(s: string) => void>();
  connected = false;
  closed = false;
  constructor(role: 'host' | 'guest', code: string, peer: Peer | null) { this.role = role; this.code = code; this.peer = peer; }

  attach(conn: DataConnection) {
    this.conn = conn;
    conn.on('open', () => { this.connected = true; this.status('connected'); });
    conn.on('data', (d) => { const m = d as NetMsg; if (m && typeof m === 'object' && 't' in m) this.handlers.forEach((h) => h(m)); });
    conn.on('close', () => { this.connected = false; this.status('closed'); });
    conn.on('error', () => this.status('error'));
    if (conn.open) { this.connected = true; this.status('connected'); }
  }
  on(h: Handler) { this.handlers.add(h); return () => { this.handlers.delete(h); }; }
  onStatus(h: (s: string) => void) { this.statusHandlers.add(h); return () => { this.statusHandlers.delete(h); }; }
  status(s: string) { this.statusHandlers.forEach((h) => h(s)); }
  /** deliver a message from the relay */
  deliver(m: NetMsg) { this.handlers.forEach((h) => h(m)); }
  send(m: NetMsg) { if (this.transport) { this.transport.send(m); return; } if (this.conn && this.conn.open) { try { this.conn.send(m); } catch { /* channel closing */ } } }
  close() {
    if (this.closed) return;
    this.closed = true;
    try { this.send({ t: 'bye' }); } catch { /* */ }
    try { this.conn?.close(); } catch { /* */ }
    try { this.transport?.close(); } catch { /* */ }
    try { this.peer?.destroy(); } catch { /* */ }
    if (current === this) current = null;
  }
}

let current: Room | null = null;
export function currentRoom(): Room | null { return current; }

function friendlyError(e: unknown): string {
  const type = (e as { type?: string })?.type ?? '';
  const tag = type ? ` (${type})` : '';
  if (type === 'peer-unavailable') return 'No room with that code. Check the code and make sure your friend’s room is still open.';
  if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') return `Could not reach the matchmaking service${tag}. Check the internet connection — some school networks block online games. Try “Test connection” below.`;
  if (type === 'browser-incompatible') return 'This browser (or the page it is embedded in) does not allow online play. Try “Test connection” below.';
  if (type === 'webrtc' || type === 'negotiation-failed') return `The two devices found each other but could not connect directly${tag}. The network is probably blocking it (common on school Wi-Fi).`;
  return `Something went wrong connecting${tag}. Please try again, or use “Test connection” below.`;
}
const ICE_FAIL = 'Found the room, but the two devices could not connect directly. The network is probably blocking peer-to-peer connections (common on school Wi-Fi). Try another network, or both devices on the same home Wi-Fi.';
/** Watch a data connection's WebRTC link and report if it fails. */
function watchIce(conn: DataConnection, onFail: () => void) {
  const pc = (conn as unknown as { peerConnection?: RTCPeerConnection }).peerConnection;
  if (!pc) return;
  pc.addEventListener('iceconnectionstatechange', () => { if (pc.iceConnectionState === 'failed') onFail(); });
}

/** Create a room and wait for one friend. Resolves once the room code is live. */
export function createRoom(): Promise<Room> {
  current?.close();
  if (RELAY) return createRelayRoom();
  return new Promise((resolve, reject) => {
    let tries = 0;
    const attempt = () => {
      const code = makeRoomCode();
      const peer = new Peer(PREFIX + code, { debug: 0 });
      const room = new Room('host', code, peer);
      const timer = setTimeout(() => { peer.destroy(); reject(new Error('Could not reach the matchmaking service. Check the internet connection.')); }, 12000);
      peer.on('open', () => { clearTimeout(timer); current = room; resolve(room); });
      peer.on('connection', (conn) => {
        // one friend per room; anyone else is turned away
        if (room.connected || room.closed) { conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); }); return; }
        room.attach(conn);
      });
      peer.on('error', (e) => {
        clearTimeout(timer);
        if ((e as { type?: string }).type === 'unavailable-id' && tries++ < 4) { peer.destroy(); attempt(); return; }
        if (current === room) room.status('error');
        else reject(new Error(friendlyError(e)));
      });
      peer.on('disconnected', () => { if (!room.closed) { try { peer.reconnect(); } catch { /* */ } } });
    };
    attempt();
  });
}

/** Join a friend's room by code. */
export function joinRoom(code: string): Promise<Room> {
  current?.close();
  if (RELAY) return joinRelayRoom(code);
  return new Promise((resolve, reject) => {
    const peer = new Peer({ debug: 0 });
    const room = new Room('guest', code, peer);
    const fail = (msg: string) => { clearTimeout(timer); try { peer.destroy(); } catch { /* */ } reject(new Error(msg)); };
    const timer = setTimeout(() => fail('No answer from that room. Check the code and make sure the room is still open. If it keeps happening, use “Test connection” below — the network may be blocking direct connections.'), 15000);
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code, { serialization: 'json', reliable: true });
      if (!conn) { fail('Could not start a connection in this browser. Try “Test connection” below.'); return; }
      room.attach(conn);
      conn.on('open', () => { clearTimeout(timer); current = room; resolve(room); });
      // the room exists once the offer is answered; if the direct link then fails, say why
      setTimeout(() => watchIce(conn, () => { if (!room.connected) fail(ICE_FAIL); }), 0);
    });
    peer.on('error', (e) => fail(friendlyError(e)));
  });
}

// ---------- connection self-test ----------
export interface NetCheck { name: string; ok: boolean | null; detail: string }

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => { const t = setTimeout(() => resolve(fallback), ms); p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(fallback); }); });
}
/** Gather ICE candidates with the given servers; returns the candidate types seen. */
async function gather(servers: RTCIceServer[], relayOnly: boolean, ms: number): Promise<Set<string>> {
  const seen = new Set<string>();
  let pc: RTCPeerConnection;
  try { pc = new RTCPeerConnection({ iceServers: servers, iceTransportPolicy: relayOnly ? 'relay' : 'all' }); } catch { seen.add('blocked'); return seen; }
  pc.createDataChannel('probe');
  await new Promise<void>((resolve) => {
    const done = () => { resolve(); };
    const t = setTimeout(done, ms);
    pc.onicecandidate = (e) => { if (!e.candidate) { clearTimeout(t); done(); return; } const m = / typ (\w+)/.exec(e.candidate.candidate); if (m) seen.add(m[1]); };
    pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => { seen.add('blocked'); clearTimeout(t); done(); });
  });
  try { pc.close(); } catch { /* */ }
  return seen;
}

/**
 * Step-by-step check of everything online play needs, so a blocked step can be named
 * (embedded page restrictions, the matchmaking service, STUN, TURN, and a full loop-back room).
 */
export async function testConnection(onStep?: (checks: NetCheck[]) => void): Promise<NetCheck[]> {
  if (RELAY) return testRelay(onStep);
  const checks: NetCheck[] = [];
  const push = (c: NetCheck) => { checks.push(c); onStep?.([...checks]); };
  let framed = false; try { framed = window.top !== window.self; } catch { framed = true; }
  push({ name: 'Page', ok: null, detail: `${framed ? 'Running inside an embedded frame (for example Google Sites)' : 'Running as its own page'} · ${location.protocol}//${location.host || '(no host)'}` });
  const hasRtc = typeof RTCPeerConnection !== 'undefined', hasWs = typeof WebSocket !== 'undefined';
  push({ name: 'Browser support', ok: hasRtc && hasWs, detail: hasRtc && hasWs ? 'WebRTC and WebSockets are available.' : `Missing: ${[!hasRtc && 'WebRTC', !hasWs && 'WebSockets'].filter(Boolean).join(', ')}. The page or browser is blocking them.` });
  if (!hasRtc || !hasWs) return checks;

  // 1. matchmaking service
  const broker = await withTimeout(new Promise<string>((resolve) => {
    let peer: Peer;
    try { peer = new Peer({ debug: 0 }); } catch (e) { resolve('error:' + ((e as Error).message || 'could not start')); return; }
    peer.on('open', () => { resolve('ok'); peer.destroy(); });
    peer.on('error', (e) => { resolve('error:' + ((e as { type?: string }).type ?? 'unknown')); try { peer.destroy(); } catch { /* */ } });
  }), 9000, 'timeout');
  push({ name: 'Matchmaking service (0.peerjs.com)', ok: broker === 'ok', detail: broker === 'ok' ? 'Reached the free PeerJS service.' : broker === 'timeout' ? 'No answer after 9 seconds. The network or the page is blocking it, or the free service is down.' : `Failed: ${broker.slice(6)}. The network or the page is blocking it.` });

  // 2. direct connections (STUN) and relay (TURN)
  const stun = await gather([{ urls: 'stun:stun.l.google.com:19302' }], false, 4000);
  const direct = stun.has('srflx');
  push({ name: 'Direct connection (STUN)', ok: stun.has('blocked') ? false : direct ? true : null, detail: stun.has('blocked') ? 'WebRTC is blocked here.' : direct ? 'This device can make direct connections.' : `Only local addresses found (${[...stun].join(', ') || 'none'}). Devices on different networks may not connect.` });
  const turn = await gather([{ urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }], true, 5000);
  push({ name: 'Relay fallback (TURN)', ok: turn.has('relay') ? true : null, detail: turn.has('relay') ? 'The relay server is reachable.' : 'The relay server could not be reached (port 3478 is often blocked on school networks).' });

  // 3. a real room, joined from this same page
  if (broker === 'ok') {
    const loop = await withTimeout((async () => {
      const host = await createRoom();
      const back = new Promise<boolean>((resolve) => { host.on((m) => { if (m.t === 'hello') resolve(true); }); });
      const peer = new Peer({ debug: 0 });
      await new Promise<void>((r, j) => { peer.on('open', () => r()); peer.on('error', j); });
      const conn = peer.connect(PREFIX + host.code, { serialization: 'json', reliable: true });
      await new Promise<void>((r, j) => { conn.on('open', () => r()); conn.on('error', j); });
      conn.send({ t: 'hello', v: NET_VERSION, hero: null });
      const ok = await withTimeout(back, 4000, false);
      try { conn.close(); peer.destroy(); } catch { /* */ }
      host.close();
      return ok ? 'ok' : 'no-data';
    })().catch((e) => 'error:' + ((e as { type?: string })?.type ?? (e as Error)?.message ?? 'unknown')), 15000, 'timeout');
    push({ name: 'Test room (create + join on this device)', ok: loop === 'ok', detail: loop === 'ok' ? 'A room was created and joined. Online play works from here.' : loop === 'timeout' ? 'The test room never connected (timed out).' : `The test room failed: ${loop}.` });
  }
  return checks;
}

// ---------- relay rooms (Google Sites copy) ----------
const TOPIC = 'vocabhero/v1/';
interface Wire { f: string; to?: string; m: NetMsg | { t: '__join' } | { t: '__welcome' } | { t: '__ping' } }
const newId = () => Math.random().toString(36).slice(2, 10);

/** Wire a relay connection to a Room: control messages, heartbeat, and lost-connection detection. */
function relayRoom(role: 'host' | 'guest', code: string, mq: Mqtt) {
  const me = newId(), base = TOPIC + code;
  const inbox = `${base}/${role === 'host' ? 'h' : 'g'}`, outbox = `${base}/${role === 'host' ? 'g' : 'h'}`;
  const room = new Room(role, code, null);
  let peerId: string | null = null, lastSeen = 0;
  const post = (w: Wire) => mq.publish(outbox, JSON.stringify(w));
  room.transport = { send: (m) => { if (peerId || role === 'guest') post({ f: me, to: peerId ?? undefined, m }); }, close: () => { clearInterval(beat); mq.close(); } };
  const beat = setInterval(() => {
    if (room.closed) return;
    if (peerId) post({ f: me, to: peerId, m: { t: '__ping' } });
    if (room.connected && Date.now() - lastSeen > 9000) { room.connected = false; if (role === 'host') peerId = null; room.status('closed'); }
  }, 2000);
  mq.onClose = () => { if (!room.closed) { room.connected = false; room.status('error'); } };
  mq.subscribe(inbox);
  return { room, me, post, inbox, mq, setPeer: (id: string | null) => { peerId = id; }, peer: () => peerId, seen: () => { lastSeen = Date.now(); } };
}

async function createRelayRoom(): Promise<Room> {
  const mq = await connectAny();
  const code = makeRoomCode();
  const r = relayRoom('host', code, mq);
  mq.onMessage = (_t, text) => {
    let w: Wire; try { w = JSON.parse(text); } catch { return; }
    if (!w || w.f === r.me || (w.to && w.to !== r.me)) return;
    if (w.m.t === '__join') {
      // one friend per room; anyone else is turned away
      if (r.peer() && r.peer() !== w.f && r.room.connected) { r.post({ f: r.me, to: w.f, m: { t: 'full' } }); return; }
      r.setPeer(w.f); r.seen();
      r.post({ f: r.me, to: w.f, m: { t: '__welcome' } });
      if (!r.room.connected) { r.room.connected = true; r.room.status('connected'); }
      return;
    }
    if (w.f !== r.peer()) return;
    r.seen();
    if (w.m.t === '__ping' || w.m.t === '__welcome') return;
    r.room.deliver(w.m as NetMsg);
  };
  current = r.room;
  return r.room;
}

async function joinRelayRoom(code: string): Promise<Room> {
  const mq = await connectAny();
  const r = relayRoom('guest', code, mq);
  return new Promise<Room>((resolve, reject) => {
    let done = false;
    const knock = setInterval(() => { if (!done) r.post({ f: r.me, m: { t: '__join' } }); }, 1000);
    const timer = setTimeout(() => { if (done) return; done = true; clearInterval(knock); r.room.close(); reject(new Error('No answer from that room. Check the code and make sure your friend’s room is still open.')); }, 12000);
    mq.onMessage = (_t, text) => {
      let w: Wire; try { w = JSON.parse(text); } catch { return; }
      if (!w || w.to !== r.me) return;
      if (w.m.t === 'full' && !done) { done = true; clearInterval(knock); clearTimeout(timer); r.room.close(); reject(new Error('That room already has two players.')); return; }
      if (w.m.t === '__welcome') {
        r.setPeer(w.f); r.seen();
        if (!done) { done = true; clearInterval(knock); clearTimeout(timer); r.room.connected = true; current = r.room; resolve(r.room); r.room.status('connected'); }
        return;
      }
      if (w.f !== r.peer()) return;
      r.seen();
      if (w.m.t === '__ping') return;
      r.room.deliver(w.m as NetMsg);
    };
    r.post({ f: r.me, m: { t: '__join' } });
  });
}

/** Connection check for the relay copy: each relay server, then a real room created and joined on this device. */
async function testRelay(onStep?: (checks: NetCheck[]) => void): Promise<NetCheck[]> {
  const checks: NetCheck[] = [];
  const push = (c: NetCheck) => { checks.push(c); onStep?.([...checks]); };
  let framed = false; try { framed = window.top !== window.self; } catch { framed = true; }
  push({ name: 'Page', ok: null, detail: `${framed ? 'Running inside an embedded frame (for example Google Sites)' : 'Running as its own page'} · relay play (no direct device-to-device link needed)` });
  if (typeof WebSocket === 'undefined') { push({ name: 'Browser support', ok: false, detail: 'WebSockets are blocked here, so online play cannot work.' }); return checks; }
  let anyOk = false;
  for (const b of BROKERS) {
    const m = new Mqtt();
    const res = await m.connect(b.url, 6000).then(() => 'ok', (e) => (e as Error).message);
    if (res === 'ok') { anyOk = true; m.close(); }
    push({ name: `Relay server: ${b.name}`, ok: res === 'ok', detail: res === 'ok' ? 'Reachable.' : `Not reachable (${res}).` });
  }
  if (!anyOk) { push({ name: 'Result', ok: false, detail: 'No relay server could be reached. The network or the page is blocking online games.' }); return checks; }
  const loop = await withTimeout((async () => {
    const host = await createRelayRoom();
    const got = new Promise<boolean>((resolve) => host.on((msg) => { if (msg.t === 'hello') resolve(true); }));
    const guest = await joinRelayRoom(host.code);
    guest.send({ t: 'hello', v: NET_VERSION, hero: null as unknown as PlayerCfg });
    const ok = await withTimeout(got, 5000, false);
    guest.close(); host.close();
    return ok ? 'ok' : 'no-data';
  })().catch((e) => 'error:' + ((e as Error)?.message ?? 'unknown')), 25000, 'timeout');
  push({ name: 'Test room (create + join on this device)', ok: loop === 'ok', detail: loop === 'ok' ? 'A room was created and joined through the relay. Online play works from here.' : loop === 'timeout' ? 'The test room never connected (timed out).' : `The test room failed: ${loop}.` });
  return checks;
}
