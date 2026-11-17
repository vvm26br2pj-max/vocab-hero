import { useState } from 'react';
import type { Nav } from '../App';
import { mutate, useProfile } from '../store';
import { Btn, Modal, Points, Coin } from '../components/common';
import { FigureSprite } from '../components/Sprite';
import { BOSSES, BOSS_BY_ID } from '../../config/bosses';
import { DIFFICULTY, TIERS, TIER_STATS, type TierId } from '../../config/combat';
import { ARENA_ENTRY_FEE } from '../../config/economy';
import { arenaAllowed, chooseOpponent, possibleRewards, powerRating, startPaidTrial, startRetry, nextBand, type Offer } from '../../core/arena';
import { bossStyle } from '../../combat/styles';
import { content } from '../../core/content';
import { checkAnswer, shuffle } from '../../core/mission';
import type { PracticeItem, WordEntry } from '../../content/schema';

export function Arena({ nav }: { nav: Nav }) {
  const p = useProfile()!;
  const [offer, setOffer] = useState<Offer | null>(null);
  const [warmup, setWarmup] = useState(false);
  const [shield, setShield] = useState(false);
  const [err, setErr] = useState('');
  const allowed = arenaAllowed(p);
  const trial = p.arena.trial;
  const pr = powerRating(p.attributes, p.loadout);
  const nb = nextBand(pr);
  // rivals stay hidden until you have actually fought them
  const met = BOSSES.filter((b) => (p.bosses[b.id]?.encountered.length ?? 0) > 0);
  const diff = DIFFICULTY[p.settings.combatDifficulty];

  const enter = () => {
    let res: ReturnType<typeof startPaidTrial> | null = null;
    mutate((pp) => { res = startPaidTrial(pp, offer!, Date.now(), shield); });
    const r = res as ReturnType<typeof startPaidTrial> | null;
    if (r?.ok) nav.go('battle', { battle: { mode: 'trial' } }); else setErr(r?.reason ?? 'Could not start');
  };

  return (
    <div className="app">
      <div className="topbar">
        <Btn kind="ghost" size="small" onClick={() => nav.go('hq')}>← HQ</Btn>
        <span className="brand">Arena</span><span className="spacer" /><Points value={p.points} />
      </div>
      {trial && trial.status === 'active' && (
        <div className="card paper col" style={{ marginBottom: 12 }}>
          <h3>Trial in progress vs {BOSS_BY_ID[trial.enemy.bossId].name}</h3>
          <p>Your battle was interrupted. It resumes with the same opponent and saved health and adrenaline — no extra charge.</p>
          <div className="row"><Btn kind="hero" onClick={() => nav.go('battle', { battle: { mode: 'trial' } })}>Resume battle</Btn></div>
        </div>
      )}
      {trial && trial.status === 'lost' && trial.retryAvailable && (
        <div className="card paper col" style={{ marginBottom: 12 }}>
          <h3>Free retry ready vs {BOSS_BY_ID[trial.enemy.bossId].name}</h3>
          <p>Same opponent, same tier and difficulty. No entry fee.</p>
          <div className="row">
            <Btn kind="hero" onClick={() => { mutate((pp) => { startRetry(pp); }); nav.go('battle', { battle: { mode: 'trial' } }); }}>Use free retry</Btn>
            <Btn onClick={() => mutate((pp) => { if (pp.arena.trial) pp.arena.trial = null; })}>Skip retry</Btn>
          </div>
        </div>
      )}
      <div className="arena-banner">
        <div className="arena-title">
          <span className="arena-kicker">🏟️ THE ARENA</span>
          <div className="row" style={{ gap: 8 }}>
            <span className="tier-chip" style={{ background: '#e11d48' }}>{TIER_STATS[TIERS[p.arena.highestBand]].name} tier</span>
            <span className="tier-chip" style={{ background: '#7c3aed' }}>⚡ Power {pr}</span>
          </div>
          {nb && <div className="arena-next"><div className="pr-bar"><div style={{ width: `${Math.min(100, (pr / nb.at) * 100)}%` }} /></div><span className="small">{nb.need} more Power to reach {TIER_STATS[nb.tier].name} rivals</span></div>}
        </div>
        <div className="arena-fight">
          {!allowed.ok ? <p className="feedback try">{allowed.reason}</p> : (
            <button className="arena-find" disabled={!!trial && (trial.status === 'active' || trial.retryAvailable)} onClick={() => { setErr(''); setShield(false); setOffer(chooseOpponent(p)); }}>
              <span className="arena-find-label">🎲 Find an opponent</span>
              <span className="arena-coin"><Coin size={22} />{ARENA_ENTRY_FEE}</span>
            </button>
          )}
          <div className="arena-side">
            {!p.arena.tutorialDone && <Btn kind="primary" onClick={() => nav.go('battle', { battle: { mode: 'tutorial' } })}>⭐ Tutorial match</Btn>}
            <Btn kind="sky" onClick={() => nav.go('battle', { battle: { mode: 'training' } })}>🎯 Training Room</Btn>
            <Btn onClick={() => nav.go('multiplayer')}>🎮 2-Player</Btn>
            {p.arena.tutorialDone && <Btn size="small" kind="ghost" onClick={() => nav.go('battle', { battle: { mode: 'tutorial' } })}>Replay tutorial</Btn>}
          </div>
        </div>
      </div>
      <div className="row" style={{ alignItems: 'baseline', margin: '22px 0 10px' }}>
        <h2 className="headline">Rival heroes</h2>
        <span className="small white">{met.length} / {BOSSES.length} met</span>
      </div>
      <div className="rival-grid">
        {BOSSES.map((b) => {
          const rec = p.bosses[b.id];
          const fought = met.includes(b);
          if (!fought) return (
            <div key={b.id} className="rival-card unknown">
              <div className="rival-stage"><div className="rival-mystery">?</div></div>
              <strong>???</strong>
              <span className="small">Fight them to find out who they are</span>
            </div>
          );
          const wins = Object.entries(rec.wins).filter(([, n]) => n > 0);
          return (
            <div key={b.id} className="rival-card" style={{ ['--r1' as any]: b.colors.accent, ['--r2' as any]: b.colors.main }}>
              <div className="rival-stage"><FigureSprite style={bossStyle(b.id)} size={74} animate={false} title={b.name} /></div>
              <strong>{b.name}</strong>
              <span className="small rival-arena">{b.arena}</span>
              <span className={`rival-bp ${p.blueprints.includes(b.blueprint) ? 'won' : ''}`}>{p.blueprints.includes(b.blueprint) ? '🏆' : '🧩'} {b.blueprintName}</span>
              <div className="row center" style={{ gap: 4 }}>{wins.length ? wins.map(([t, n]) => <span key={t} className="rival-win">{TIER_STATS[t as TierId].name} ×{n}</span>) : <span className="small muted">No wins yet</span>}</div>
            </div>
          );
        })}
      </div>
      {offer && (
        <Modal title="Opponent found!" onClose={() => setOffer(null)}>
          {(() => {
            const b = BOSS_BY_ID[offer.bossId], t = TIER_STATS[offer.tier];
            return (
              <div className="col">
                <div className="row" style={{ justifyContent: 'center' }}><FigureSprite style={bossStyle(b.id)} size={90} /></div>
                <div className="center"><h3>{b.name} — {t.name} tier</h3><span className="small muted">{b.arena}</span></div>
                <p className="small"><b>Challenge:</b> {t.desc} Opponent health {t.hp}.</p>
                <p className="small"><b>Moves:</b> {b.pattern}</p>
                <p className="small"><b>Win to earn:</b> {possibleRewards(p, b.id, offer.tier, p.settings.combatDifficulty).join(' · ')}</p>
                
                {shield ? <p className="feedback good small">🛡️ Warm-up shield earned for this match!</p>
                  : <Btn size="small" onClick={() => setWarmup(true)}>🧠 Optional warm-up question for a small shield</Btn>}
                {err && <p className="feedback try small">{err}</p>}
                <div className="row">
                  <Btn kind="hero" disabled={p.points < ARENA_ENTRY_FEE} onClick={enter}>Enter · <Coin size={16} />{ARENA_ENTRY_FEE}</Btn>
                  <Btn onClick={() => { setShield(false); setOffer(chooseOpponent(p)); }}>Another opponent (free)</Btn>
                  <Btn onClick={() => setOffer(null)}>Cancel</Btn>
                </div>
                {p.points < ARENA_ENTRY_FEE && <p className="small muted">Learn a few words to earn the entry fee — one mission is plenty.</p>}
              </div>
            );
          })()}
        </Modal>
      )}
      {warmup && <Warmup onClose={(ok) => { setWarmup(false); if (ok) setShield(true); }} />}
    </div>
  );
}

function Warmup({ onClose }: { onClose: (ok: boolean) => void }) {
  const p = useProfile()!;
  const idx = content(p.customWords);
  const [q] = useState(() => {
    const introduced = Object.values(p.words).filter((w) => w.introducedAt !== null).map((w) => idx.byId.get(w.id)).filter((w): w is WordEntry => !!w);
    const pool = introduced.length ? introduced : (idx.byGrade.get(p.settings.grade) ?? []).slice(0, 5);
    const w = shuffle(pool)[0];
    const item = w?.items.find((i) => i.options && i.format !== 'example_nonexample' && i.stage !== 'transfer') as PracticeItem | undefined;
    return item ? { w, item, order: shuffle(item.options!.map((o) => o.id)) } : null;
  });
  const [tries, setTries] = useState<string[]>([]);
  const [done, setDone] = useState<null | boolean>(null);
  if (!q) return <Modal title="Warm-up" onClose={() => onClose(false)}><p>No words yet — learn a few first!</p><Btn onClick={() => onClose(false)}>OK</Btn></Modal>;
  const pick = (id: string) => {
    const ok = checkAnswer(q.item, id);
    const t = [...tries, id]; setTries(t);
    if (ok) setDone(true); else if (t.length >= 2) setDone(false);
  };
  return (
    <Modal title="Warm-up question (untimed)" onClose={() => onClose(false)}>
      {q.item.passage && <div className="passage">{q.item.passage}</div>}
      <p><b>{q.item.prompt}</b></p>
      <div className="opts">{q.order.map((id) => <button key={id} className={`opt ${tries.includes(id) ? (id === q.item.answer ? 'chosen-right' : 'chosen-wrong') : ''}`} disabled={done !== null || tries.includes(id)} onClick={() => pick(id)}>{q.item.options!.find((o) => o.id === id)!.text}</button>)}</div>
      {tries.length > 0 && done === null && <p className="feedback try small">Not quite. {q.w.word} means {q.w.definition}. Try once more — your entry is safe either way.</p>}
      {done !== null && <p className={`feedback ${done ? 'good' : 'reveal'} small`}>{done ? '🛡️ Shield earned! ' : 'No shield this time, and nothing is lost. '}{q.item.explanation}</p>}
      {done !== null && <Btn kind="go" onClick={() => onClose(!!done)}>Back to the match</Btn>}
    </Modal>
  );
}
