import type { Nav } from '../App';
import { useProfile } from '../store';
import { Btn, Points } from '../components/common';
import { CHALLENGES, RARITY, readChallengeProgress, challengeUnlocked } from '../../core/challenges';

export function Challenges({ nav }: { nav: Nav }) {
  const p = useProfile()!;
  const cp = readChallengeProgress(p);
  const done = cp.cleared.length;
  return (
    <div className="app">
      <div className="topbar">
        <Btn kind="ghost" size="small" onClick={() => nav.go('hq')}>← HQ</Btn>
        <span className="brand">Challenges</span><span className="spacer" /><Points value={p.points} />
      </div>
      <div className="ch-banner">
        <div className="col" style={{ gap: 6 }}>
          <span className="ch-kicker">⚡ CHALLENGES</span>
          <span className="small">Beat each challenge to unlock the next. Every win gives you a random look for your hero, and the pricier the look, the rarer it is!</span>
          <div className="row" style={{ gap: 6 }}>
            {(['common', 'rare', 'epic', 'legendary'] as const).map((r) => <span key={r} className="ch-chip" style={{ background: RARITY[r].color }}>{RARITY[r].label} {Math.round(RARITY[r].chance * 100)}%</span>)}
          </div>
        </div>
        <div className="ch-count"><b>{done}</b><span>/ {CHALLENGES.length} done</span></div>
      </div>
      <div className="ch-list">
        {CHALLENGES.map((c) => {
          const open = challengeUnlocked(p, c.id);
          const cleared = cp.cleared.includes(c.id);
          const best = cp.best[c.id];
          return (
            <div key={c.id} className={`ch-card ${open ? '' : 'locked'} ${cleared ? 'cleared' : ''} ch-${c.id}`}>
              <div className="ch-num">{open ? c.num : '🔒'}</div>
              <div className="ch-art">{c.icon}</div>
              <div className="col" style={{ gap: 4, flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}><h3>{c.name}</h3>{cleared && <span className="ch-done">✓ Complete</span>}</div>
                <b className="ch-goal">{c.goal}</b>
                {open ? <span className="small">{c.howTo}</span> : <span className="small">Complete Challenge {c.num - 1} to unlock.</span>}
                {open && best !== undefined && c.target > 0 && <span className="small muted">Best: {best}</span>}
              </div>
              {open && <Btn kind={cleared ? 'go' : 'hero'} onClick={() => nav.go('battle', { battle: { mode: 'challenge', challenge: c.id } })}>{cleared ? '↻ Replay' : '▶ Play'}</Btn>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
