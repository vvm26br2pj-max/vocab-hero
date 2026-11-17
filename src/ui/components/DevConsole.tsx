import { useEffect, useState } from 'react';
import type { Nav } from '../App';
import { mutate, toast, useProfile } from '../store';
import { SHOP, BLUEPRINT_NAMES } from '../../config/shop';
import { BOSSES } from '../../config/bosses';
import { DIFFICULTY, TIERS, TIER_STATS, type CombatDifficulty, type TierId } from '../../config/combat';
import { ARENAS } from '../../combat/arenas';
import { ATTRIBUTE_KEYS, ATTRIBUTE_INFO } from '../../core/attributes';
import { MAX_POWER_LEVEL } from '../../core/shop';
import { enemyFor, bossRecord, refreshBand } from '../../core/arena';
import { newId } from '../../core/profile';
import { activeBattle } from '../../combat/registry';
import { CHALLENGES, challengeProgress } from '../../core/challenges';
import { GRADES } from '../../core/content';
import type { TrialState } from '../../core/types';

const SECRET = 'oxymoron';

/** Opens the developer console when the secret word is typed anywhere outside a text field. */
export function useSecretWord(onOpen: () => void) {
  useEffect(() => {
    let buf = '';
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
      buf = (buf + e.key.toLowerCase()).slice(-SECRET.length);
      if (buf === SECRET) { buf = ''; onOpen(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onOpen]);
}

const TABS = ['Hero', 'Abilities', 'Battle', 'Progress'] as const;

/** Developer console for testing abilities, attributes, bosses and progression on the active hero. */
export function DevConsole({ nav, onClose }: { nav: Nav; onClose: () => void }) {
  const p = useProfile();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Hero');
  const [boss, setBoss] = useState('circuit-lynx');
  const [tier, setTier] = useState<TierId>('rookie');
  const [diff, setDiff] = useState<CombatDifficulty>('standard');
  const [, bump] = useState(0);
  const scene = activeBattle();
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  useEffect(() => { const t = setInterval(() => bump((n) => n + 1), 500); return () => clearInterval(t); }, []);
  // pause a local battle while the console is open
  useEffect(() => {
    const sc = activeBattle();
    if (!sc || sc.cfg.online) return;
    const was = sc.paused; sc.setPaused(true);
    return () => { sc.setPaused(was); };
  }, []);
  if (!p) return null;
  const done = (msg: string) => toast(`🛠️ ${msg}`);
  const powers = SHOP.filter((i) => i.kind === 'power');

  const launch = (mode: 'practice' | 'training') => {
    onClose();
    if (mode === 'training') { nav.go('battle', { battle: { mode: 'training' } }); return; }
    const trial: TrialState = { id: newId('dev'), mode: 'practice', enemy: enemyFor(boss, tier, diff), paid: false, retryAvailable: false, retryUsed: false, attempt: 1, status: 'active', snapshot: null, shieldBonus: false, createdAt: Date.now() };
    nav.go('hq');
    setTimeout(() => nav.go('battle', { battle: { mode: 'practice', trial } }), 0);
  };

  return (
    <div className="devc-back" role="dialog" aria-label="Developer console">
      <div className="devc">
        <div className="devc-head">
          <b>🛠️ DEVELOPER CONSOLE</b>
          <span className="small">Editing <b>{p.nickname}</b> · {p.points} coins · Esc to close</span>
          <button className="devc-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="devc-tabs">{TABS.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>

        {tab === 'Hero' && (
          <div className="devc-body">
            <h4>Coins</h4>
            <div className="devc-row">
              {[100, 1000, 10000].map((n) => <button key={n} onClick={() => { mutate((pp) => { pp.points += n; }); done(`+${n} coins`); }}>+{n.toLocaleString()}</button>)}
              <button onClick={() => { mutate((pp) => { pp.points = 0; }); done('Coins set to 0'); }}>Set 0</button>
            </div>
            <h4>Attributes</h4>
            <div className="devc-row">
              {[1, 10, 25, 50, 75, 99].map((n) => <button key={n} onClick={() => { mutate((pp) => { for (const k of ATTRIBUTE_KEYS) pp.attributes[k] = n; }); done(`All attributes → ${n}`); }}>All {n}</button>)}
            </div>
            {ATTRIBUTE_KEYS.map((k) => (
              <label key={k} className="devc-slider">{ATTRIBUTE_INFO[k].icon} {ATTRIBUTE_INFO[k].name} <b>{p.attributes[k]}</b>
                <input type="range" min={1} max={99} value={p.attributes[k]} onChange={(e) => mutate((pp) => { pp.attributes[k] = Number(e.target.value); })} />
              </label>
            ))}
            <h4>Looks</h4>
            <div className="devc-row">
              <button onClick={() => { mutate((pp) => { for (const it of SHOP) if (it.kind !== 'power' && !pp.owned.includes(it.id)) pp.owned.push(it.id); }); done('All cosmetics unlocked'); }}>Unlock all cosmetics</button>
            </div>
          </div>
        )}

        {tab === 'Abilities' && (
          <div className="devc-body">
            <div className="devc-row">
              <button onClick={() => { mutate((pp) => { for (const bp of Object.keys(BLUEPRINT_NAMES)) if (!pp.blueprints.includes(bp)) pp.blueprints.push(bp); }); done('All blueprints unlocked'); }}>All blueprints</button>
              <button onClick={() => { mutate((pp) => { for (const bp of Object.keys(BLUEPRINT_NAMES)) if (!pp.blueprints.includes(bp)) pp.blueprints.push(bp); for (const it of powers) if (!pp.owned.includes(it.id)) pp.owned.push(it.id); if (pp.attributes.willpower < 71) pp.attributes.willpower = 71; }); done('Own every ability (Willpower raised to 71 for ultimates)'); }}>Own every ability</button>
              <button onClick={() => { mutate((pp) => { for (const it of powers) pp.powerLevels[it.id] = MAX_POWER_LEVEL; }); done('All ability levels maxed'); }}>Max all levels</button>
              <button onClick={() => { mutate((pp) => { pp.owned = pp.owned.filter((id) => !id.startsWith('power:')); pp.powerLevels = {}; pp.loadout = { active: [null, null], movement: null, passive: null }; }); done('Abilities removed'); }}>Remove all abilities</button>
            </div>
            <p className="small">Loadout (equip anything, even if not owned). Changes apply from your next battle.</p>
            {([['Power 1', 'active0', 'active'], ['Power 2', 'active1', 'active'], ['Movement', 'movement', 'movement'], ['Passive', 'passive', 'passive']] as const).map(([label, slot, kind]) => {
              const cur = slot === 'active0' ? p.loadout.active[0] : slot === 'active1' ? p.loadout.active[1] : slot === 'movement' ? p.loadout.movement : p.loadout.passive;
              return (
                <label key={slot} className="devc-slider">{label}
                  <select value={cur ?? ''} onChange={(e) => mutate((pp) => {
                    const v = e.target.value || null;
                    if (v && !pp.owned.includes(v)) pp.owned.push(v);
                    if (slot === 'active0') pp.loadout.active[0] = v; else if (slot === 'active1') pp.loadout.active[1] = v; else if (slot === 'movement') pp.loadout.movement = v; else pp.loadout.passive = v;
                  })}>
                    <option value="">— empty —</option>
                    {powers.filter((i) => i.slot === kind).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </label>
              );
            })}
            <p className="small">Ability levels:</p>
            <div className="devc-grid">
              {powers.map((it) => (
                <label key={it.id} className="devc-mini">{it.name}
                  <select value={p.powerLevels[it.id] ?? 1} onChange={(e) => mutate((pp) => { pp.powerLevels[it.id] = Number(e.target.value); })}>{[1, 2, 3].map((n) => <option key={n} value={n}>Lv {n}</option>)}</select>
                </label>
              ))}
            </div>
          </div>
        )}

        {tab === 'Battle' && (
          <div className="devc-body">
            {scene ? (
              <>
                <h4>This battle</h4>
                <div className="devc-row">
                  <button className={scene.dev.god ? 'on' : ''} onClick={() => { scene.dev.god = !scene.dev.god; bump((n) => n + 1); }}>God mode {scene.dev.god ? 'ON' : 'off'}</button>
                  <button className={scene.dev.infinite ? 'on' : ''} onClick={() => { scene.dev.infinite = !scene.dev.infinite; bump((n) => n + 1); }}>Infinite adrenaline + no cooldowns {scene.dev.infinite ? 'ON' : 'off'}</button>
                  <button className={scene.dev.hitboxes ? 'on' : ''} onClick={() => { scene.dev.hitboxes = !scene.dev.hitboxes; bump((n) => n + 1); }}>Show hitboxes {scene.dev.hitboxes ? 'ON' : 'off'}</button>
                </div>
                <div className="devc-row">
                  <button onClick={() => { for (const f of scene.fighters) { f.hp = f.maxHp; f.meter.restore(f.meter.max); f.cooldowns = {}; } done('Heroes refilled'); }}>Refill heroes</button>
                  <button onClick={() => scene.devBossTo(0.51)}>Boss → just above half</button>
                  <button onClick={() => scene.devBossTo(0.1)}>Boss → 10%</button>
                  <button onClick={() => { scene.devBossTo(0); onClose(); }}>Win now</button>
                  <button onClick={() => { for (const f of scene.fighters) f.hp = 0; onClose(); }}>Lose now</button>
                </div>
                {scene.challenge && <div className="devc-row">
                  <button onClick={() => { scene.challenge!.devSkip(true); onClose(); }}>Challenge: finish as a win</button>
                  <button onClick={() => { scene.challenge!.devSkip(false); onClose(); }}>Challenge: skip to the end</button>
                </div>}
              </>
            ) : <p className="small">Start a battle to get god mode, infinite adrenaline, hitboxes and instant win/lose.</p>}
            <h4>Start a test battle (free, nothing saved)</h4>
            <div className="devc-row">
              <select value={boss} onChange={(e) => setBoss(e.target.value)}>{BOSSES.map((b) => <option key={b.id} value={b.id}>{b.name} — {ARENAS[b.arenaKey].name}</option>)}</select>
              <select value={tier} onChange={(e) => setTier(e.target.value as TierId)}>{TIERS.map((t) => <option key={t} value={t}>{TIER_STATS[t].name}</option>)}</select>
              <select value={diff} onChange={(e) => setDiff(e.target.value as CombatDifficulty)}>{(Object.keys(DIFFICULTY) as CombatDifficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY[d].label}</option>)}</select>
              <button className="go" onClick={() => launch('practice')}>▶ Fight</button>
              <button onClick={() => launch('training')}>🎯 Training room</button>
            </div>
          </div>
        )}

        {tab === 'Progress' && (
          <div className="devc-body">
            <h4>Challenges</h4>
            <div className="devc-row">
              <button onClick={() => { mutate((pp) => { const cp = challengeProgress(pp); for (const c of CHALLENGES) if (!cp.cleared.includes(c.id)) cp.cleared.push(c.id); }); done('Every challenge unlocked'); }}>Unlock every challenge</button>
              <button onClick={() => { mutate((pp) => { pp.challenges = { cleared: [], best: {}, plays: 0 }; }); done('Challenges reset'); }}>Reset challenges</button>
            </div>
            <h4>Arena</h4>
            <div className="devc-row">
              <button onClick={() => { mutate((pp) => { for (const b of BOSSES) { const r = bossRecord(pp, b.id); for (const t of TIERS) if (!r.encountered.includes(t)) r.encountered.push(t); } }); done('Met every boss & tier'); }}>Meet every boss & tier</button>
              <button onClick={() => { mutate((pp) => { for (const b of BOSSES) if (!pp.blueprints.includes(b.blueprint)) pp.blueprints.push(b.blueprint); }); done('All boss blueprints won'); }}>Win all boss blueprints</button>
              <button onClick={() => { mutate((pp) => { pp.arena.trial = null; pp.arena.daily = { date: '', count: 0 }; pp.arena.tutorialDone = true; }); done('Battle state cleared, tutorial marked done'); }}>Clear battle state</button>
            </div>
            <label className="devc-slider">Arena tier unlocked
              <select value={p.arena.highestBand} onChange={(e) => mutate((pp) => { pp.arena.highestBand = Number(e.target.value); })}>{TIERS.map((t, i) => <option key={t} value={i}>{TIER_STATS[t].name}</option>)}</select>
            </label>
            <h4>Learning</h4>
            <div className="devc-row">
              <button onClick={() => { mutate((pp) => { pp.completedMissions += 10; }); done('+10 missions (raises Academy Rank)'); }}>+10 missions</button>
              <button onClick={() => { mutate((pp) => { pp.mission = null; }); done('Current mission cleared'); }}>Clear current mission</button>
              <button onClick={() => { mutate((pp) => { pp.settings.onlinePlay = !pp.settings.onlinePlay; }); done(`Online play ${!p.settings.onlinePlay ? 'on' : 'off'}`); }}>Online play: {p.settings.onlinePlay ? 'on' : 'off'}</button>
            </div>
            <label className="devc-slider">Vocabulary grade
              <select value={p.settings.grade} onChange={(e) => mutate((pp) => { pp.settings.grade = Number(e.target.value); })}>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</select>
            </label>
            <p className="small muted">Changes apply to the active hero's real save. Download a backup in the Parent area first if you want to undo them.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export { refreshBand };
