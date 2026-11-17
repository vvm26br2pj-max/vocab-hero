import { useState } from 'react';
import { mutate, toast, useProfile } from '../store';
import { HeroSprite } from '../components/Sprite';
import { Btn, Modal, Coin } from '../components/common';
import { ATTRIBUTE_INFO, ATTRIBUTE_KEYS, derivedStats, describeLevel, levelCost, maxAffordableLevel, speedMultiplier, strengthMultiplier, willpowerMultiplier, maxHealth, maxAdrenaline, dodgeRecovery } from '../../core/attributes';
import { buyAttribute, previewAttribute } from '../../core/shop';
import { bandIndex, nextBand, powerRating, totalWins } from '../../core/arena';
import { rankInfo } from '../../core/rank';
import { ATTRIBUTE_COST_BANDS, ATTRIBUTE_MAX } from '../../config/economy';
import { PLAYER, TIERS, TIER_STATS } from '../../config/combat';
import { BOSSES } from '../../config/bosses';
import type { AttributeKey } from '../../core/types';
import { sfx } from '../sound';

/** Level tiers line up with the price bands, so the badge also tells you what the next level costs. */
const LEVEL_TIERS = [
  { name: 'Rookie', min: 1, color: '#9ca3af', glow: '#e5e7eb' },
  { name: 'Bronze', min: 11, color: '#d97706', glow: '#fcd34d' },
  { name: 'Silver', min: 26, color: '#94a3b8', glow: '#f1f5f9' },
  { name: 'Gold', min: 51, color: '#eab308', glow: '#fef08a' },
  { name: 'Platinum', min: 76, color: '#22d3ee', glow: '#cffafe' },
  { name: 'MAX', min: 99, color: '#d946ef', glow: '#f5d0fe' },
];
export function levelTier(L: number) { let t = LEVEL_TIERS[0]; for (const x of LEVEL_TIERS) if (L >= x.min) t = x; return t; }

const ATTR_COLOR: Record<AttributeKey, [string, string]> = { speed: ['#38bdf8', '#2563eb'], strength: ['#fb7185', '#e11d48'], health: ['#4ade80', '#16a34a'], willpower: ['#fbbf24', '#ea580c'] };
const CONFIRM_AT = 150;

/** Willpower thresholds where bigger moves become usable. */
const WILLPOWER_MARKS = [{ at: 21, label: 'Enhanced (80)' }, { at: 41, label: 'Super (120)' }, { at: 71, label: 'Ultimate (180)' }];

function stat(key: AttributeKey, L: number): { label: string; value: string; raw: number } {
  switch (key) {
    case 'speed': return { label: 'Run speed', value: `${speedMultiplier(L).toFixed(2)}×`, raw: speedMultiplier(L) };
    case 'strength': return { label: 'Damage', value: `×${strengthMultiplier(L).toFixed(2)}`, raw: strengthMultiplier(L) };
    case 'health': return { label: 'Max HP', value: String(maxHealth(L)), raw: maxHealth(L) };
    case 'willpower': return { label: 'Adrenaline', value: String(maxAdrenaline(L)), raw: maxAdrenaline(L) };
  }
}

function LevelBadge({ L, color, size = 92 }: { L: number; color: [string, string]; size?: number }) {
  const tier = levelTier(L);
  const r = 40, c = 2 * Math.PI * r, frac = (L - 1) / (ATTRIBUTE_MAX - 1);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label={`Level ${L}, ${tier.name}`} style={{ flex: 'none' }}>
      <defs>
        <linearGradient id={`lb-${color[0]}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={color[0]} /><stop offset="1" stopColor={color[1]} /></linearGradient>
        <radialGradient id={`lbg-${tier.name}`}><stop offset="0" stopColor={tier.glow} /><stop offset="1" stopColor={tier.color} /></radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="#1b1446" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#3b2f6e" strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={`url(#lb-${color[0]})`} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * Math.max(0.02, frac)} ${c}`} transform="rotate(-90 50 50)" />
      <circle cx="50" cy="50" r="31" fill={`url(#lbg-${tier.name})`} stroke="#1b1446" strokeWidth="2.5" />
      <text x="50" y="44" textAnchor="middle" fontFamily="Nunito" fontWeight="900" fontSize="9" fill="#1b1446">LEVEL</text>
      <text x="50" y="66" textAnchor="middle" fontFamily="Bangers, Impact" fontSize="26" fill="#1b1446">{L}</text>
    </svg>
  );
}

function MilestoneBar({ L, color, marks }: { L: number; color: [string, string]; marks?: { at: number; label: string }[] }) {
  const tierEdges = ATTRIBUTE_COST_BANDS.map((b) => b.from - 1).filter((x) => x > 1).concat([ATTRIBUTE_MAX]);
  const pct = (v: number) => ((v - 1) / (ATTRIBUTE_MAX - 1)) * 100;
  return (
    <div className="mbar" aria-hidden>
      <div className="mbar-track">
        <div className="mbar-fill" style={{ width: `${pct(L)}%`, background: `linear-gradient(90deg, ${color[0]}, ${color[1]})` }} />
        {tierEdges.map((e) => <span key={e} className={`mbar-tick ${L >= e ? 'on' : ''}`} style={{ left: `${pct(e)}%` }}><i>{e}</i></span>)}
        {marks?.map((m) => <span key={m.at} className={`mbar-mark ${L >= m.at ? 'on' : ''}`} style={{ left: `${pct(m.at)}%` }} title={m.label}>★</span>)}
      </div>
    </div>
  );
}

function AttributeCard({ k, setConfirm }: { k: AttributeKey; setConfirm: (c: { title: string; text: string; run: () => void } | null) => void }) {
  const p = useProfile()!;
  const L = p.attributes[k];
  const [step, setStep] = useState(1);
  const [flash, setFlash] = useState(false);
  const info = ATTRIBUTE_INFO[k];
  const color = ATTR_COLOR[k];
  const maxed = L >= ATTRIBUTE_MAX;
  const affordable = maxAffordableLevel(L, p.points);
  const target = maxed ? L : step === 0 ? Math.max(L + 1, affordable) : Math.min(ATTRIBUTE_MAX, L + step);
  const pv = previewAttribute(p, k, target);
  const now = stat(k, L), next = stat(k, target);
  const tier = levelTier(L), nextTier = levelTier(Math.min(99, L + 1));
  const run = () => {
    let ok = false;
    mutate((pp) => { ok = buyAttribute(pp, k, target).ok; });
    if (ok) { sfx.win(); setFlash(true); setTimeout(() => setFlash(false), 900); toast(`${info.icon} ${info.name} reached level ${target}!`); setStep(1); }
  };
  return (
    <div className={`attr2 ${flash ? 'levelup' : ''}`} style={{ ['--a1' as any]: color[0], ['--a2' as any]: color[1] }}>
      <div className="attr2-head">
        <LevelBadge L={L} color={color} />
        <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}><span className="attr2-icon">{info.icon}</span><h3 className="attr2-name">{info.name}</h3><span className="tier-chip" style={{ background: tier.color }}>{tier.name}</span></div>
          <span className="small muted">{info.improves}</span>
          <div className="attr2-stat"><span>{now.label}</span><b>{now.value}</b>{!maxed && <><span className="arrow">➜</span><b className="up">{next.value}</b><span className="delta">▲ {k === 'health' || k === 'willpower' ? `+${Math.round(next.raw - now.raw)}` : `+${(next.raw - now.raw).toFixed(2)}`}</span></>}</div>
          {k === 'willpower' && <div className="attr2-stat"><span>Energy damage</span><b>×{willpowerMultiplier(L).toFixed(2)}</b>{!maxed && <><span className="arrow">➜</span><b className="up">×{willpowerMultiplier(target).toFixed(2)}</b><span className="delta">▲ +{(willpowerMultiplier(target) - willpowerMultiplier(L)).toFixed(2)}</span></>}</div>}
        </div>
      </div>
      <MilestoneBar L={L} color={color} marks={k === 'willpower' ? WILLPOWER_MARKS : undefined} />
      {maxed ? <div className="maxed">🏆 MAX LEVEL — fully powered!</div> : (
        <>
          <div className="row attr2-steps">
            {[1, 5, 10].map((n) => <button key={n} className={`stepbtn ${step === n ? 'on' : ''}`} onClick={() => setStep(n)} disabled={L + 1 > ATTRIBUTE_MAX}>+{n}</button>)}
            <button className={`stepbtn ${step === 0 ? 'on' : ''}`} onClick={() => setStep(0)}>MAX</button>
            <span className="small muted" style={{ marginLeft: 'auto' }}>{nextTier.name} levels: <Coin size={16} />{levelCost(L + 1)} each</span>
          </div>
          <button className="lvlbtn" disabled={!pv.ok} onClick={() => pv.cost >= CONFIRM_AT ? setConfirm({ title: `Level up ${info.name}?`, text: `Level ${L} → ${target} costs ${pv.cost} coins (each level priced on its own). You have ${p.points}.`, run }) : run()}>
            <span>LEVEL UP to {target}</span><span className="cost"><Coin size={18} /> {pv.cost}</span>
          </button>
          {!pv.ok && pv.reason && <span className="small" style={{ color: '#be123c', fontWeight: 800 }}>{pv.reason} — learning earns points!</span>}
          <span className="small muted">{describeLevel(k, target)}</span>
        </>
      )}
    </div>
  );
}

export function HeroProfile() {
  const p = useProfile()!;
  const [confirm, setConfirm] = useState<{ title: string; text: string; run: () => void } | null>(null);
  const sum = ATTRIBUTE_KEYS.reduce((a, k) => a + p.attributes[k], 0);
  const heroLevel = Math.floor((sum - 4) / 4) + 1;
  const pr = powerRating(p.attributes, p.loadout);
  const band = Math.max(bandIndex(pr), p.arena.highestBand);
  const nb = nextBand(pr);
  const d = derivedStats(p.attributes, p.loadout.passive === 'power:quick-recovery');
  const rank = rankInfo(p);
  const wins = BOSSES.reduce((a, b) => a + totalWins(p, b.id), 0);
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="profile-hero">
        <div className="profile-stage"><HeroSprite appearance={p.appearance} anim="proud" size={150} /></div>
        <div className="col" style={{ gap: 6, flex: 1, minWidth: 220 }}>
          <div className="profile-name">{p.nickname}</div>
          <div className="row" style={{ gap: 6 }}>{p.equippedTitle && p.equippedTitle !== rank.name && <span className="tier-chip" style={{ background: '#7c3aed' }}>{p.equippedTitle}</span>}<span className="tier-chip" style={{ background: '#0ea5e9' }}>🎓 {rank.name}</span><span className="tier-chip" style={{ background: '#e11d48' }}>🏟️ {TIER_STATS[TIERS[band]].name} tier</span></div>
          <div className="hero-level"><span>HERO LEVEL</span><b>{heroLevel}</b></div>
          <div className="small"><b>Power Rating {pr}</b>{nb ? ` · ${nb.need} more to reach ${TIER_STATS[nb.tier].name} opponents` : ' · top tier reached'}</div>
          <div className="pr-bar"><div style={{ width: `${nb ? Math.min(100, (pr / nb.at) * 100) : 100}%` }} /></div>
        </div>
        <div className="stat-grid">
          <div><span>❤️ Max HP</span><b>{d.maxHp}</b></div>
          <div><span>⚡ Run</span><b>{Math.round(d.runSpeed)}<small>px/s</small></b></div>
          <div><span>💪 Punch</span><b>{Math.round(d.punchDamage)}</b></div>
          <div><span>🔥 Adrenaline</span><b>{d.maxAdrenaline}</b></div>
          <div><span>✨ Energy dmg</span><b>×{d.willpowerMult.toFixed(2)}</b></div>
          <div><span>💨 Dodge reset</span><b>{d.dodgeRecovery.toFixed(2)}<small>s</small></b></div>
          <div><span>🏆 Battle wins</span><b>{wins}</b></div>
        </div>
      </div>
      <div className="row" id="attributes" style={{ justifyContent: 'space-between', scrollMarginTop: 12 }}>
        <h2 className="headline">Attributes</h2>
        <span className="points" style={{ fontSize: '1.2rem' }}><Coin size={18} /> {p.points} to spend</span>
      </div>
      <p className="white small" style={{ marginTop: -8 }}>Permanent upgrades from 1 to 99. They power up your next fight and are never lost. Higher tiers cost more per level: Rookie 20 · Bronze 40 · Silver 70 · Gold 110 · Platinum 160.</p>
      <div className="attr-grid">{ATTRIBUTE_KEYS.map((k) => <AttributeCard key={k} k={k} setConfirm={setConfirm} />)}</div>
      <div className="card">
        <h3>Trophies & titles</h3>
        <div className="row">{p.trophies.length ? p.trophies.map((t) => <span key={t} className="tag secure">🏆 {t.replace('trophy:', '').replace(/-/g, ' ').replace(/:/g, ' · ')}</span>) : <span className="muted small">Win arena battles to collect trophies.</span>}</div>
        <div className="row" style={{ marginTop: 8 }}>{p.titles.map((t) => <span key={t} className="tag">🎖️ {t}</span>)}</div>
        <p className="small muted" style={{ marginTop: 8 }}>Base punch {PLAYER.punchDamage} × Strength multiplier. Might attacks also use Strength; Energy attacks (Laser Eyes, Chain Lightning, Flame Blast, Supernova) use Willpower, so Strength and Willpower support different builds.</p>
      </div>
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p>{confirm.text}</p>
          <div className="row"><Btn kind="go" onClick={() => { confirm.run(); setConfirm(null); }}>Yes, level up</Btn><Btn onClick={() => setConfirm(null)}>Not now</Btn></div>
        </Modal>
      )}
    </div>
  );
}

export { dodgeRecovery };
