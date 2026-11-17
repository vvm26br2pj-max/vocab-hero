import { useEffect, useState } from 'react';
import { mutate, toast, useProfile } from '../store';
import { SHOP, SHOP_BY_ID, BLUEPRINT_NAMES, type ShopItem } from '../../config/shop';
import { HOVER_TIME, POWERS, POWER_LEVELS, SUPER_SPEED } from '../../config/combat';
import { BOSSES } from '../../config/bosses';
import { RANK_UNLOCKS } from '../../config/shop';
import { ACADEMY_RANKS } from '../../config/economy';
import { buy, checkBuy, checkUpgrade, describeMissing, equip, MAX_POWER_LEVEL, powerLevel, upgradePower, type LoadoutSlot } from '../../core/shop';
import { maxAdrenaline } from '../../core/attributes';
import { AbilityIcon, type AbilityIconId } from '../components/AbilityIcons';
import { Coin } from '../components/common';
import { sfx } from '../sound';

type Branch = 'might' | 'energy' | 'motion' | 'guard';
const BRANCHES: { id: Branch; name: string; color: string; glow: string }[] = [
  { id: 'might', name: 'MIGHT', color: '#f59e0b', glow: '#fbbf24' },
  { id: 'energy', name: 'ENERGY', color: '#06b6d4', glow: '#67e8f9' },
  { id: 'motion', name: 'MOTION', color: '#8b5cf6', glow: '#c4b5fd' },
  { id: 'guard', name: 'GUARD', color: '#22c55e', glow: '#86efac' },
];
const iconId = (id: string): AbilityIconId => ({ 'power:meteor-punch': 'meteor-slam', 'power:mega-laser': 'flame-blast', 'power:nova-storm': 'supernova', 'power:phase-shift': 'meditate', 'power:gravity-burst': 'super-speed', 'power:triple-jump': 'hover' } as Record<string, AbilityIconId>)[id] ?? (id.replace('power:', '') as AbilityIconId);

/** Where each blueprint comes from, in kid-friendly words. */
function blueprintSource(bp: string): string {
  const boss = BOSSES.find((b) => b.blueprint === bp);
  if (boss) return `Win an arena battle against ${boss.name}`;
  const rank = RANK_UNLOCKS.find((r) => r.reward.blueprint === bp);
  if (rank) return `Reach the ${ACADEMY_RANKS[rank.rank].name} Academy Rank by learning words`;
  const m: Record<string, string> = {
    'bp:mega-laser': 'Beat Circuit Lynx at Challenger tier', 'bp:meteor-punch': 'Beat Granite Glove at Elite tier',
    'bp:titan-fist': 'Win any Champion-tier battle', 'bp:nova-storm': 'Win any Legendary-tier battle',
  };
  return m[bp] ?? 'Keep learning and battling';
}

export function AbilityMap({ onClose }: { onClose: () => void }) {
  const p = useProfile()!;
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') (sel ? setSel(null) : onClose()); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [sel, onClose]);
  const items = SHOP.filter((i) => i.kind === 'power' && i.branch);
  const node = (it: ShopItem) => {
    const owned = p.owned.includes(it.id);
    const c = checkBuy(p, it.id);
    const locked = !owned && c.missing.some((m) => m !== 'points');
    const lv = owned ? powerLevel(p, it.id) : 0;
    const br = BRANCHES.find((b) => b.id === it.branch)!;
    const equipped = p.loadout.active.includes(it.id) || p.loadout.movement === it.id || p.loadout.passive === it.id;
    return (
      <button key={it.id} className={`anode ${owned ? 'owned' : locked ? 'locked' : 'open'} ${sel === it.id ? 'sel' : ''} ${it.tier === 4 ? 'ultimate' : ''}`} style={{ ['--bc' as any]: br.color, ['--bg2' as any]: br.glow }} onClick={() => { sfx.click(); setSel(it.id); }} aria-label={`${it.name}${owned ? `, owned, level ${lv}` : locked ? ', locked' : `, ${it.price} coins`}`}>
        <span className="anode-icon"><AbilityIcon id={iconId(it.id)} size={it.tier === 4 ? 104 : 88} locked={locked} /></span>
        <span className="anode-name">{it.name}</span>
        {owned ? <span className="anode-pips">{Array.from({ length: MAX_POWER_LEVEL }, (_, i) => <i key={i} className={i < lv ? 'on' : ''} />)}{equipped && <b>EQUIPPED</b>}</span>
          : !locked ? <span className="anode-price"><Coin size={14} /> {it.price}</span> : null}
      </button>
    );
  };
  const col = (b: Branch) => {
    const list = items.filter((i) => i.branch === b).sort((x, y) => (x.tier ?? 0) - (y.tier ?? 0));
    const lit = (id: string) => p.owned.includes(id);
    return list.map((it, i) => (
      <div key={it.id} className="col center" style={{ gap: 0, alignItems: 'center' }}>
        {i > 0 && <span className={`aconn ${lit(list[i - 1].id) ? 'on' : ''}`} />}
        {node(it)}
      </div>
    ));
  };
  const it = sel ? SHOP_BY_ID[sel] : null;
  return (
    <div className="amap-back" role="dialog" aria-modal="true" aria-label="Ability Map">
      <div className="amap">
        <div className="amap-head">
          <div className="amap-title"><span>VOCAB HERO</span><small>ABILITY MAP</small></div>
          <span className="points"><Coin size={20} /> {p.points}</span>
          <button className="amap-x" onClick={onClose} aria-label="Close ability map">✕</button>
        </div>
        <div className="amap-crest" aria-hidden>
          <svg viewBox="0 0 64 70" width="64" height="70"><path d="M32 2 L60 12 C60 40 50 58 32 68 C14 58 4 40 4 12 Z" fill="#ffd23f" stroke="#1b1446" strokeWidth="3" /><path d="M32 9 L53 16 C52 38 45 52 32 60 C19 52 12 38 11 16 Z" fill="#7c3aed" /><path d="M32 18 L36 30 L48 30 L38 37 L42 49 L32 42 L22 49 L26 37 L16 30 L28 30 Z" fill="#ffd23f" stroke="#1b1446" strokeWidth="1.5" /></svg>
        </div>
        <div className="amap-tree">
          {BRANCHES.map((b) => (
            <div key={b.id} className="abranch" style={{ ['--bc' as any]: b.color, ['--bg2' as any]: b.glow }}>
              <div className="abranch-label">{b.name}</div>
              <span className="aconn on" />
              {col(b.id)}
            </div>
          ))}
        </div>
        <Loadout />
        {it && <Detail it={it} onClose={() => setSel(null)} />}
      </div>
    </div>
  );
}

function Loadout() {
  const p = useProfile()!;
  const name = (id: string | null) => (id ? SHOP_BY_ID[id]?.name ?? '—' : 'Empty');
  const slots: [string, string | null][] = [['Power 1', p.loadout.active[0]], ['Power 2', p.loadout.active[1]], ['Movement', p.loadout.movement], ['Passive', p.loadout.passive]];
  return (
    <div className="aload">
      <span className="aload-t">LOADOUT</span>
      <span className="aload-slot fixed">👊 Basic punch · always</span>
      {slots.map(([l, id]) => <span key={l} className={`aload-slot ${id ? 'full' : ''}`}><small>{l}</small>{id && <AbilityIcon id={iconId(id)} size={26} />}{name(id)}</span>)}
    </div>
  );
}

function Detail({ it, onClose }: { it: ShopItem; onClose: () => void }) {
  const p = useProfile()!;
  const owned = p.owned.includes(it.id);
  const c = checkBuy(p, it.id);
  const reqs = describeMissing(p, it, c.missing.filter((m) => m !== 'points'));
  const pw = POWERS[it.id];
  const lv = owned ? powerLevel(p, it.id) : 1;
  const up = checkUpgrade(p, it.id);
  const L = POWER_LEVELS[lv - 1], N = POWER_LEVELS[Math.min(POWER_LEVELS.length - 1, lv)];
  const lvlIdx = Math.max(0, lv - 1);
  const br = BRANCHES.find((b) => b.id === it.branch)!;
  const slotsFor: LoadoutSlot[] = it.slot === 'active' ? ['active0', 'active1'] : it.slot === 'movement' ? ['movement'] : ['passive'];
  const equippedIn = (s: LoadoutSlot) => (s === 'active0' ? p.loadout.active[0] : s === 'active1' ? p.loadout.active[1] : s === 'movement' ? p.loadout.movement : p.loadout.passive) === it.id;
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [it.id]);
  const doBuy = () => {
    if (it.price >= 150 && !confirming) { setConfirming(true); return; }
    setConfirming(false);
    let ok = false; mutate((pp) => { ok = buy(pp, it.id).ok; });
    if (ok) {
      sfx.win(); toast(`${it.name} unlocked!`);
      // put it straight into a free slot so it's ready to use
      mutate((pp) => { for (const s of slotsFor) { const cur = s === 'active0' ? pp.loadout.active[0] : s === 'active1' ? pp.loadout.active[1] : s === 'movement' ? pp.loadout.movement : pp.loadout.passive; if (!cur) { equip(pp, s, it.id); break; } } });
    }
  };
  const doUpgrade = () => { let ok = false; mutate((pp) => { ok = upgradePower(pp, it.id); }); if (ok) { sfx.win(); toast(`${it.name} upgraded to level ${up.to}!`); } };
  const bp = it.requires?.blueprint;
  return (
    <div className="adetail" style={{ ['--bc' as any]: br.color, ['--bg2' as any]: br.glow }}>
      <button className="amap-x small" onClick={onClose} aria-label="Close details">✕</button>
      <div className="row" style={{ gap: 14, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <AbilityIcon id={iconId(it.id)} size={96} locked={!owned && reqs.length > 0} />
        <div className="col" style={{ gap: 4, minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}><h2 className="adetail-name">{it.name}</h2><span className="tier-chip" style={{ background: br.color }}>{br.name} · {it.tier === 4 ? 'ULTIMATE' : `TIER ${it.tier}`}</span></div>
          <p style={{ margin: 0 }}>{it.desc}</p>
          <div className="row small" style={{ gap: 6, marginTop: 4 }}>
            <span className="tag">{it.slot === 'active' ? 'Power slot' : it.slot === 'movement' ? 'Movement slot' : 'Passive (always on)'}</span>
            {pw && pw.channel?.regenPerSec ? <span className="tag">🧘 refills {pw.channel.regenPerSec[Math.min(pw.channel.regenPerSec.length - 1, lvlIdx)]} adrenaline/sec while held</span> : pw && pw.channel ? <span className="tag">🔥 drains {pw.channel.drainPerSec} adrenaline/sec while held</span> : pw && pw.cost > 0 && <span className="tag">🔥 {pw.cost} adrenaline</span>}
            {it.id === 'power:gravity-burst' && <span className="tag">🏃 {SUPER_SPEED[lvlIdx]}× run speed</span>}
            {it.id === 'power:triple-jump' && <span className="tag">🛸 {HOVER_TIME[lvlIdx]}s hover</span>}
            {pw && pw.cooldown > 0 && <span className="tag">⏱ {(pw.cooldown * L.cooldown).toFixed(1)}s cooldown{pw.channel ? ' after release' : ''}</span>}
            {pw && pw.damage > 0 && <span className="tag">💥 {Math.round(pw.damage * L.power)} {pw.strengthScaled ? '× Strength' : pw.willpowerScaled ? '× Willpower' : 'power'} damage{pw.channel ? ' per second' : ''}</span>}
            {owned && <span className="tag secure">Level {lv} / {MAX_POWER_LEVEL}</span>}
          </div>
        </div>
      </div>
      {!owned && (
        <div className="adetail-req">
          <b>To unlock:</b>
          <ul>
            {bp && <li className={p.blueprints.includes(bp) ? 'ok' : ''}>{p.blueprints.includes(bp) ? '✓' : '○'} {BLUEPRINT_NAMES[bp]} blueprint — {blueprintSource(bp)}</li>}
            {it.requires?.owns && <li className={p.owned.includes(it.requires.owns) ? 'ok' : ''}>{p.owned.includes(it.requires.owns) ? '✓' : '○'} Own {SHOP_BY_ID[it.requires.owns].name}</li>}
            {it.requires?.ownsAny && <li className={it.requires.ownsAny.some((x) => p.owned.includes(x)) ? 'ok' : ''}>{it.requires.ownsAny.some((x) => p.owned.includes(x)) ? '✓' : '○'} Own {it.requires.ownsAny.map((x) => SHOP_BY_ID[x].name).join(' or ')}</li>}
            {it.requires?.willpower && <li className={p.attributes.willpower >= it.requires.willpower ? 'ok' : ''}>{p.attributes.willpower >= it.requires.willpower ? '✓' : '○'} Willpower {it.requires.willpower} (adrenaline capacity {maxAdrenaline(it.requires.willpower)}) — you have {p.attributes.willpower}</li>}
            <li className={p.points >= it.price ? 'ok' : ''}>{p.points >= it.price ? '✓' : '○'} {it.price} coins — you have {p.points}</li>
          </ul>
          <button className="lvlbtn" style={{ ['--a1' as any]: br.glow, ['--a2' as any]: br.color }} disabled={!c.ok} onClick={doBuy}><span>{confirming ? 'TAP AGAIN TO CONFIRM' : `BUY ${it.name.toUpperCase()}`}</span><span className="cost"><Coin size={18} /> {it.price}</span></button>
        </div>
      )}
      {owned && (
        <div className="col" style={{ gap: 8 }}>
          {pw && (lv < MAX_POWER_LEVEL ? (
            <>
              <div className="small"><b>Next level:</b> {pw.damage > 0 ? `damage${pw.channel ? ' per second' : ''} ${Math.round(pw.damage * L.power)} → ${Math.round(pw.damage * N.power)}, ` : it.id === 'power:guardian-aura' ? `aura lasts ${(6 * L.power).toFixed(1)}s → ${(6 * N.power).toFixed(1)}s, ` : pw.channel?.regenPerSec ? `refill ${pw.channel.regenPerSec[lvlIdx]} → ${pw.channel.regenPerSec[Math.min(pw.channel.regenPerSec.length - 1, lvlIdx + 1)]}/sec, ` : it.id === 'power:gravity-burst' ? `run speed ${SUPER_SPEED[lvlIdx]}× → ${SUPER_SPEED[Math.min(SUPER_SPEED.length - 1, lvlIdx + 1)]}×` : it.id === 'power:triple-jump' ? `hover ${HOVER_TIME[lvlIdx]}s → ${HOVER_TIME[Math.min(HOVER_TIME.length - 1, lvlIdx + 1)]}s` : ''}{pw.cooldown > 0 && <>cooldown {(pw.cooldown * L.cooldown).toFixed(1)}s → {(pw.cooldown * N.cooldown).toFixed(1)}s</>}</div>
              <button className="lvlbtn" style={{ ['--a1' as any]: br.glow, ['--a2' as any]: br.color }} disabled={!up.ok} onClick={doUpgrade}><span>UPGRADE TO LEVEL {up.to}</span><span className="cost"><Coin size={18} /> {up.cost}</span></button>
              {!up.ok && up.reason && <span className="small" style={{ color: '#be123c', fontWeight: 800 }}>{up.reason}</span>}
            </>
          ) : <div className="maxed">⭐ Fully upgraded!</div>)}
          <div className="row">
            {slotsFor.map((s, i) => (
              <button key={s} className={`stepbtn ${equippedIn(s) ? 'on' : ''}`} style={{ ['--a1' as any]: br.glow, ['--a2' as any]: br.color, padding: '0 14px' }} onClick={() => mutate((pp) => { equip(pp, s, equippedIn(s) ? null : it.id); })}>
                {equippedIn(s) ? '✓ Equipped' : 'Equip'}{slotsFor.length > 1 ? ` in slot ${i + 1}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
