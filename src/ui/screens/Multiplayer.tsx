import React, { useState } from 'react';
import type { Nav } from '../App';
import { useSave } from '../store';
import { Btn } from '../components/common';
import { HeroSprite, FigureSprite } from '../components/Sprite';
import { BOSSES } from '../../config/bosses';
import { TIERS, TIER_STATS, type TierId } from '../../config/combat';
import { ARENAS } from '../../combat/arenas';
import { DUO_HELP } from '../../combat/input';
import { bossStyle } from '../../combat/styles';
import { powerRating } from '../../core/arena';
import { OnlineLobby } from './OnlineLobby';

const ARENA_KEYS = ['rooftop', 'quarry', 'lab', 'theater', 'observatory', 'foundry'];

/** Local multiplayer: two of your created heroes on one device, in versus or co-op. Friendly play: no coins or unlocks. */
export function Multiplayer({ nav }: { nav: Nav }) {
  const [where, setWhere] = useState<'local' | 'online'>(nav.tab === 'online' ? 'online' : 'local');
  const tabs = (
    <div className="tabs">
      <button className={`tab ${where === 'local' ? 'on' : ''}`} onClick={() => setWhere('local')}>🎮 Same device</button>
      <button className={`tab ${where === 'online' ? 'on' : ''}`} onClick={() => setWhere('online')}>🌐 Online with a code</button>
    </div>
  );
  if (where === 'online') return (
    <div className="app">
      <div className="topbar"><Btn kind="ghost" size="small" onClick={() => nav.go('hq')}>← HQ</Btn><span className="brand">Multiplayer</span></div>
      {tabs}
      <OnlineLobby nav={nav} />
    </div>
  );
  return <LocalMultiplayer nav={nav} tabs={tabs} />;
}

function LocalMultiplayer({ nav, tabs }: { nav: Nav; tabs: React.ReactNode }) {
  const save = useSave();
  const heroes = Object.values(save.profiles).filter((p) => p.onboarded);
  const [p1, setP1] = useState(save.activeProfileId ?? heroes[0]?.id);
  const [p2, setP2] = useState(heroes.find((h) => h.id !== (save.activeProfileId ?? heroes[0]?.id))?.id);
  const [mode, setMode] = useState<'versus' | 'coop'>('versus');
  const [arena, setArena] = useState('rooftop');
  const [boss, setBoss] = useState('circuit-lynx');
  const [tier, setTier] = useState<TierId>('rookie');
  const [fair, setFair] = useState(true);
  const H1 = heroes.find((h) => h.id === p1), H2 = heroes.find((h) => h.id === p2);
  // co-op tiers: anything either hero has reached in the arena
  const maxBand = Math.max(H1?.arena.highestBand ?? 0, H2?.arena.highestBand ?? 0);
  const tiers = TIERS.slice(0, maxBand + 1);

  if (heroes.length < 2) {
    return (
      <div className="app">
        <div className="topbar"><Btn kind="ghost" size="small" onClick={() => nav.go('hq')}>← HQ</Btn><span className="brand">Multiplayer</span></div>
        {tabs}
        <div className="card col" style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2>You need two heroes</h2>
          <p>Multiplayer uses two of the heroes created on this device, each with their own look, abilities and stats. Make a second hero for a friend or family member, then come back!</p>
          <div className="row"><Btn kind="go" onClick={() => nav.go('profiles')}>+ Create another hero</Btn><Btn onClick={() => nav.go('hq')}>Back</Btn></div>
        </div>
      </div>
    );
  }

  const pickRow = (sel: string | undefined, set: (id: string) => void, other: string | undefined, tag: 'p1' | 'p2') => (
    <div className="mp-pick">
      {heroes.map((h) => (
        <button key={h.id} className={`mp-hero ${tag} ${sel === h.id ? 'on' : ''}`} disabled={h.id === other} onClick={() => set(h.id)} aria-pressed={sel === h.id}>
          <HeroSprite appearance={h.appearance} size={64} animate={false} />
          <b>{h.nickname}</b>
          <small>Power {powerRating(h.attributes, h.loadout)}</small>
        </button>
      ))}
    </div>
  );
  const start = () => nav.go('battle', { battle: { mode, p1Id: p1, p2Id: p2, arenaKey: mode === 'versus' ? arena : BOSSES.find((b) => b.id === boss)?.arenaKey, bossId: boss, tier, fair } });

  return (
    <div className="app">
      <div className="topbar"><Btn kind="ghost" size="small" onClick={() => nav.go('hq')}>← HQ</Btn><span className="brand">Multiplayer</span></div>
      {tabs}
      <div className="mp-vs">
        <div className="mp-side p1">{H1 && <HeroSprite appearance={H1.appearance} anim="determined" size={110} />}<span>P1 · {H1?.nickname}</span></div>
        <div className="mp-badge">{mode === 'versus' ? 'VS' : '🤝'}</div>
        <div className="mp-side p2">{H2 && <HeroSprite appearance={H2.appearance} anim="determined" size={110} flip />}<span>P2 · {H2?.nickname}</span></div>
      </div>
      <div className="grid two" style={{ marginTop: 14 }}>
        <div className="card col">
          <h3>Player 1</h3>{pickRow(p1, setP1, p2, 'p1')}
          <h3>Player 2</h3>{pickRow(p2, setP2, p1, 'p2')}
        </div>
        <div className="card col">
          <h3>Mode</h3>
          <div className="row">
            <button className={`mp-mode ${mode === 'versus' ? 'on' : ''}`} onClick={() => setMode('versus')}><b>⚔️ Versus</b><small>Hero vs hero · best of 3 rounds</small></button>
            <button className={`mp-mode ${mode === 'coop' ? 'on' : ''}`} onClick={() => setMode('coop')}><b>🤝 Co-op</b><small>Team up against a rival</small></button>
          </div>
          {mode === 'versus' ? (
            <>
              <h3>Arena</h3>
              <div className="mp-arenas">{ARENA_KEYS.map((k) => <button key={k} className={`mp-arena a-${k} ${arena === k ? 'on' : ''}`} onClick={() => setArena(k)}><b>{ARENAS[k].name}</b><small>{ARENAS[k].hint}</small></button>)}</div>
              <label className="switch"><input type="checkbox" checked={fair} onChange={(e) => setFair(e.target.checked)} /> Fair fight: both heroes use the same attributes (abilities still count)</label>
            </>
          ) : (
            <>
              <h3>Rival</h3>
              <div className="mp-pick">{BOSSES.map((b) => <button key={b.id} className={`mp-hero ${boss === b.id ? 'on' : ''}`} onClick={() => setBoss(b.id)}><FigureSprite style={bossStyle(b.id)} size={46} animate={false} /><b>{b.name}</b><small>{b.arena}</small></button>)}</div>
              <label className="field">Tier
                <select value={tier} onChange={(e) => setTier(e.target.value as TierId)}>{tiers.map((t) => <option key={t} value={t}>{TIER_STATS[t].name}</option>)}</select>
              </label>
              <p className="small muted">The rival is tougher with two heroes. If a hero is knocked out, they get back up after a few seconds while their partner keeps fighting.</p>
            </>
          )}
          <Btn kind="hero" size="big" disabled={!p1 || !p2 || p1 === p2} onClick={start}>START {mode === 'versus' ? 'VERSUS' : 'CO-OP'}</Btn>
          <p className="small muted">Friendly play: no coins are spent or earned, and nothing is unlocked.</p>
        </div>
      </div>
      <div className="card col" style={{ marginTop: 14 }}>
        <h3>Controls</h3>
        <div className="mp-keys"><div className="p1">{DUO_HELP[0]}</div><div className="p2">{DUO_HELP[1]}</div></div>
        <p className="small muted">Two game controllers also work (controller 1 = Player 1). On a tablet, each player gets their own touch buttons in their corner.</p>
      </div>
    </div>
  );
}
