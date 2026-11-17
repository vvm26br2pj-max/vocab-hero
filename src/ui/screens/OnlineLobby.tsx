import { useEffect, useState } from 'react';
import type { Nav } from '../App';
import { useProfile, useSave } from '../store';
import { Btn } from '../components/common';
import { HeroSprite, FigureSprite } from '../components/Sprite';
import { BOSSES } from '../../config/bosses';
import { TIERS, TIER_STATS, type TierId } from '../../config/combat';
import { ARENAS } from '../../combat/arenas';
import { bossStyle } from '../../combat/styles';
import type { PlayerCfg } from '../../combat/fighter';
import type { Profile } from '../../core/types';
import { RELAY, createRoom, currentRoom, isValidCode, joinRoom, normalizeCode, NET_VERSION, testConnection, type NetCheck, type OnlineSetup, type Room } from '../../net/online';

const ARENA_KEYS = ['rooftop', 'quarry', 'lab', 'theater', 'observatory', 'foundry'];
const heroCfg = (p: Profile): PlayerCfg => ({ name: p.nickname, appearance: p.appearance, attributes: { ...p.attributes }, loadout: JSON.parse(JSON.stringify(p.loadout)), powerLevels: { ...(p.powerLevels ?? {}) } });

/** Online play with a room code: one player creates a room, the other types the code. */
export function OnlineLobby({ nav }: { nav: Nav }) {
  const me = useProfile()!;
  const save = useSave();
  const heroes = Object.values(save.profiles).filter((p) => p.onboarded);
  const [heroId, setHeroId] = useState(me.id);
  const hero = heroes.find((h) => h.id === heroId) ?? me;
  const [room, setRoom] = useState<Room | null>(currentRoom());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const [friend, setFriend] = useState<PlayerCfg | null>(null);
  const [hostHero, setHostHero] = useState<PlayerCfg | null>(null);
  const [checks, setChecks] = useState<NetCheck[] | null>(null);
  const [testing, setTesting] = useState(false);
  const runTest = async () => { setTesting(true); setChecks([]); setErr(''); try { await testConnection((c) => setChecks(c)); } finally { setTesting(false); } };
  const [setup, setSetup] = useState<OnlineSetup>({ mode: 'versus', arenaKey: 'rooftop', bossId: 'circuit-lynx', tier: 'rookie', fair: true });
  const tiers = TIERS.slice(0, (me.arena.highestBand ?? 0) + 1);

  // listen to the room (both roles)
  useEffect(() => {
    if (!room) return;
    const off = room.on((m) => {
      if (room.role === 'host') {
        if (m.t === 'hello') {
          if (m.v !== NET_VERSION) { setErr('Your friend has a different version of Vocab Hero. Both players should reload the page.'); return; }
          setFriend(m.hero);
        }
      } else {
        if (m.t === 'lobby') { setHostHero(m.host); setSetup(m.setup); }
        if (m.t === 'back') room.send({ t: 'hello', v: NET_VERSION, hero: heroCfg(hero) });
        if (m.t === 'full') { setErr('That room already has two players.'); room.close(); setRoom(null); }
        if (m.t === 'start') nav.go('battle', { battle: { mode: m.setup.mode, online: { role: 'guest' }, players: m.players, arenaKey: m.setup.mode === 'versus' ? m.setup.arenaKey : BOSSES.find((b) => b.id === m.setup.bossId)?.arenaKey, bossId: m.setup.bossId, tier: m.setup.tier, fair: m.setup.fair, seed: m.seed } });
      }
      if (m.t === 'bye') { setErr('Your friend left the room.'); setFriend(null); setHostHero(null); if (room.role === 'guest') { room.close(); setRoom(null); } }
    });
    const offS = room.onStatus((s) => { if (s === 'closed') { setFriend(null); if (room.role === 'guest') { setErr('Disconnected from the room.'); setRoom(null); } } });
    // guest re-announces itself (also after coming back from a match)
    if (room.role === 'guest') room.send({ t: 'hello', v: NET_VERSION, hero: heroCfg(hero) });
    else room.send({ t: 'back' }); // ask a returning guest to say hello again
    return () => { off(); offS(); };
  }, [room]);
  // host keeps the guest's lobby view in sync
  useEffect(() => { if (room?.role === 'host' && friend) room.send({ t: 'lobby', host: heroCfg(hero), guest: friend, setup }); }, [room, friend, setup, heroId]);

  if (!me.settings.onlinePlay) {
    return (
      <div className="card col">
        <h3>Online play is off</h3>
        <p>Playing with a friend on another device uses a code. A grown-up can switch it on in the <b>Parent area → Settings → Online play</b>.</p>
        <p className="small muted">Each copy of the game keeps its own saves and settings. The copy on Google Sites is separate from this computer's copy, so switch Online play on there too (both players need it on).</p>
        <Btn onClick={() => nav.go('parent')}>👪 Parent area</Btn>
      </div>
    );
  }

  const host = async () => {
    setBusy(true); setErr('');
    try { const r = await createRoom(); setRoom(r); setFriend(null); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const join = async () => {
    const c = normalizeCode(code);
    if (!isValidCode(c)) { setErr('Codes have 5 letters and numbers.'); return; }
    setBusy(true); setErr('');
    try { const r = await joinRoom(c); setRoom(r); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const leave = () => { room?.close(); setRoom(null); setFriend(null); setHostHero(null); };
  const start = () => {
    if (!room || !friend) return;
    const players = [heroCfg(hero), friend];
    const seed = Math.floor(Math.random() * 1e9);
    room.send({ t: 'start', players, setup, seed });
    nav.go('battle', { battle: { mode: setup.mode, online: { role: 'host' }, players, arenaKey: setup.mode === 'versus' ? setup.arenaKey : BOSSES.find((b) => b.id === setup.bossId)?.arenaKey, bossId: setup.bossId, tier: setup.tier, fair: setup.fair, seed } });
  };

  const heroPick = (
    <div className="mp-pick">
      {heroes.map((h) => (
        <button key={h.id} className={`mp-hero ${heroId === h.id ? 'on' : ''}`} onClick={() => setHeroId(h.id)} disabled={!!room}>
          <HeroSprite appearance={h.appearance} size={56} animate={false} /><b>{h.nickname}</b>
        </button>
      ))}
    </div>
  );

  return (
    <div className="col" style={{ gap: 14 }}>
      {err && <div className="feedback try">{err}</div>}
      {!room && (
        <div className="grid two">
          <div className="card col">
            <h3>Your hero</h3>{heroPick}
            <h3>Create a room</h3>
            <p className="small">You get a code to tell your friend. You choose the mode and arena.</p>
            <Btn kind="hero" size="big" disabled={busy} onClick={host}>{busy ? 'Connecting…' : 'CREATE ROOM'}</Btn>
          </div>
          <div className="card col">
            <h3>Join a room</h3>
            <p className="small">Type the code your friend sees.</p>
            <input className="textin room-input" value={code} maxLength={7} placeholder="ABCDE" onChange={(e) => setCode(normalizeCode(e.target.value))} onKeyDown={(e) => { if (e.key === 'Enter') join(); }} aria-label="Code" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
            <Btn kind="go" size="big" disabled={busy || code.length < 5} onClick={join}>{busy ? 'Connecting…' : 'JOIN ROOM'}</Btn>
          </div>
        </div>
      )}
      {room?.role === 'host' && (
        <div className="grid two">
          <div className="card col center" style={{ alignItems: 'center' }}>
            <span className="small muted">Code</span>
            <div className="room-code" aria-label={`Code ${room.code.split('').join(' ')}`}>{room.code}</div>
            <div className="mp-vs" style={{ width: '100%' }}>
              <div className="mp-side p1"><HeroSprite appearance={hero.appearance} size={80} /><span>{hero.nickname}</span></div>
              <div className="mp-badge">{setup.mode === 'versus' ? 'VS' : '🤝'}</div>
              <div className="mp-side p2">{friend ? <><HeroSprite appearance={friend.appearance} size={80} flip /><span>{friend.name}</span></> : <span className="waiting">Waiting for your friend…</span>}</div>
            </div>
            <div className="row center">
              <Btn kind="hero" size="big" disabled={!friend} onClick={start}>START {setup.mode === 'versus' ? 'VERSUS' : 'CO-OP'}</Btn>
              <Btn onClick={leave}>Close room</Btn>
            </div>
          </div>
          <div className="card col">
            <h3>Mode</h3>
            <div className="row">
              <button className={`mp-mode ${setup.mode === 'versus' ? 'on' : ''}`} onClick={() => setSetup({ ...setup, mode: 'versus' })}><b>⚔️ Versus</b><small>Best of 3 rounds</small></button>
              <button className={`mp-mode ${setup.mode === 'coop' ? 'on' : ''}`} onClick={() => setSetup({ ...setup, mode: 'coop' })}><b>🤝 Co-op</b><small>Team up vs a rival</small></button>
            </div>
            {setup.mode === 'versus' ? (
              <>
                <div className="mp-arenas">{ARENA_KEYS.map((k) => <button key={k} className={`mp-arena a-${k} ${setup.arenaKey === k ? 'on' : ''}`} onClick={() => setSetup({ ...setup, arenaKey: k })}><b>{ARENAS[k].name}</b></button>)}</div>
                <label className="switch"><input type="checkbox" checked={setup.fair} onChange={(e) => setSetup({ ...setup, fair: e.target.checked })} /> Fair fight (same attributes)</label>
              </>
            ) : (
              <>
                <div className="mp-pick">{BOSSES.map((b) => <button key={b.id} className={`mp-hero ${setup.bossId === b.id ? 'on' : ''}`} onClick={() => setSetup({ ...setup, bossId: b.id })}><FigureSprite style={bossStyle(b.id)} size={40} animate={false} /><b>{b.name}</b></button>)}</div>
                <label className="field">Tier<select value={setup.tier} onChange={(e) => setSetup({ ...setup, tier: e.target.value as TierId })}>{tiers.map((t) => <option key={t} value={t}>{TIER_STATS[t].name}</option>)}</select></label>
              </>
            )}
          </div>
        </div>
      )}
      {room?.role === 'guest' && (
        <div className="card col center" style={{ alignItems: 'center' }}>
          <span className="small muted">Connected to room</span>
          <div className="room-code">{room.code}</div>
          <div className="mp-vs" style={{ width: '100%', maxWidth: 640 }}>
            <div className="mp-side p1">{hostHero ? <><HeroSprite appearance={hostHero.appearance} size={80} /><span>{hostHero.name}</span></> : <span className="waiting">Connecting…</span>}</div>
            <div className="mp-badge">{setup.mode === 'versus' ? 'VS' : '🤝'}</div>
            <div className="mp-side p2"><HeroSprite appearance={hero.appearance} size={80} flip /><span>{hero.nickname}</span></div>
          </div>
          <p>{setup.mode === 'versus' ? `Versus in the ${ARENAS[setup.arenaKey]?.name}` : `Co-op vs ${BOSSES.find((b) => b.id === setup.bossId)?.name} (${TIER_STATS[setup.tier].name})`}. Waiting for the host to start…</p>
          <Btn onClick={leave}>Leave room</Btn>
        </div>
      )}
      {!room && (
        <div className="card col net-test">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Trouble connecting?</h3>
            <Btn disabled={testing} onClick={runTest}>{testing ? 'Testing…' : '🔧 Test connection'}</Btn>
          </div>
          {checks && (
            <ul className="net-checks">
              {checks.map((c) => <li key={c.name} className={c.ok === true ? 'ok' : c.ok === false ? 'bad' : 'info'}><b>{c.ok === true ? '✅' : c.ok === false ? '❌' : 'ℹ️'} {c.name}</b><span>{c.detail}</span></li>)}
              {testing && <li className="info"><b>⏳ Checking…</b><span>This takes up to half a minute.</span></li>}
            </ul>
          )}
        </div>
      )}
      <p className="small muted">{RELAY ? 'Online play sends moves through a free public relay server (EMQX, HiveMQ or Mosquitto), so it works even where devices cannot connect directly. Anyone with the room code could see the match data.' : 'Online play uses the free PeerJS matchmaking service to find the room, then the two devices connect directly.'} Only hero nickname, look, attributes and abilities are shared. There is no chat. Friendly play: no coins or unlocks. Some school networks block online games.</p>
    </div>
  );
}
