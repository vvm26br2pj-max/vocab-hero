import { useMemo } from 'react';
import type { Nav } from '../App';
import { useProfile } from '../store';
import { HeroSprite } from '../components/Sprite';
import { Btn, Points, Bar, Speak } from '../components/common';
import { Logo } from '../components/Logo';
import { FigureSprite } from '../components/Sprite';
import { bossStyle } from '../../combat/styles';
import { Coin } from '../components/common';
import { rankInfo } from '../../core/rank';
import { nextGoal } from '../goals';
import { localDate, daysBetween } from '../../core/dates';
import { content } from '../../core/content';
import { dueWords, newWordPool } from '../../core/mission';
import { arenaAllowed, powerRating, bandIndex, revealedBosses } from '../../core/arena';
import { CHALLENGES, readChallengeProgress } from '../../core/challenges';
import { TIERS, TIER_STATS } from '../../config/combat';
import { ARENA_ENTRY_FEE } from '../../config/economy';

export function Headquarters({ nav }: { nav: Nav }) {
  const p = useProfile()!;
  const rank = rankInfo(p);
  const goal = nextGoal(p);
  const idx = content(p.customWords);
  const today = localDate();
  const due = dueWords(p, idx, today).length;
  const fresh = newWordPool(p, idx).length;
  const lastTs = p.responses[p.responses.length - 1]?.ts;
  const awayDays = lastTs ? daysBetween(localDate(lastTs), today) : 0;
  const todayMissions = useMemo(() => Object.keys(p.awarded).filter((k) => k.startsWith('missiondone:') && localDate(p.awarded[k]) === today).length, [p, today]);
  const arena = arenaAllowed(p);
  const pr = powerRating(p.attributes, p.loadout);
  const tier = TIER_STATS[TIERS[Math.max(bandIndex(pr), p.arena.highestBand)]];
  const intro = `Welcome to headquarters, ${p.nickname}. You have ${p.points} coins.`;
  return (
    <div className="app">
      <div className="topbar">
        <span className="brand row" style={{ gap: 10 }}><Logo size={44} />Vocab Hero</span>
        <span className="spacer" />
        <Points value={p.points} />
        <span className="rank">🎓 {rank.name}</span>
      </div>
      {awayDays >= 3 && <div className="card paper" style={{ marginBottom: 12 }}><strong>🎉 Welcome back!</strong> Great to see you again. Your hero and every word you learned are right where you left them.</div>}
      <div className="hq-hero">
        <div className="col">
          <div className="hero-stage" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => nav.go('workshop', { tab: 'Hero Profile' })} title="Open Hero Profile">
            <HeroSprite appearance={p.appearance} size={170} anim={p.settings.reducedMotion ? 'neutral' : 'idle'} animate={!p.settings.reducedMotion} />
            <div className="nameplate">{p.nickname}{p.equippedTitle ? ` · ${p.equippedTitle}` : ''}</div>
          </div>
          <div className="card small">
            <div className="row"><strong>Academy Rank:</strong> {rank.name} <span className="muted">({rank.points} pts)</span></div>
            {rank.next && <><Bar value={rank.points} max={rank.next.at} /><div className="muted">{rank.next.need} more to {rank.next.name}. Learn words and complete missions.</div></>}
            <div className="row" style={{ marginTop: 6 }}><strong>Power Rating:</strong> {pr} <span className="muted">· arena tier {tier.name}</span></div>
          </div>
        </div>
        <div className="col">
          <div className="card col">
            <div className="row"><h2>Mission control</h2><Speak enabled={p.settings.readAloud} text={intro} /></div>
            <p>{p.mission && !p.mission.completed ? 'You have a mission in progress. Pick up right where you stopped.' : fresh > 0 ? `${fresh} new words waiting in your grade ${p.settings.grade} pack${due ? `, plus ${due} word${due > 1 ? 's' : ''} ready for review` : ''}.` : due ? `${due} words ready for review.` : 'Your current pack is complete! Keep practicing with mixed review, or ask a parent to choose another pack.'}</p>
            <Btn kind="hero" size="big" onClick={() => nav.go('mission')}>📚 {p.mission && !p.mission.completed ? 'Resume Mission' : p.completedMissions === 0 && !Object.keys(p.words).length ? 'Begin Learning' : 'Continue Learning'}</Btn>
            {!p.settings.learningOnly && (() => {
              const rival = revealedBosses(p).find((b) => !p.blueprints.includes(b.blueprint)) ?? revealedBosses(p)[0];
              return (
                <button className="arena-btn" onClick={() => nav.go('arena')} aria-label="Go to the Arena">
                  <span className="arena-hero"><HeroSprite appearance={p.appearance} anim="determined" size={58} animate={false} /></span>
                  <span className="arena-vs">VS</span>
                  <span className="arena-rival"><FigureSprite style={bossStyle(rival.id)} anim="confident" size={46} animate={false} flip /></span>
                  <span className="arena-text">
                    <b>ARENA</b>
                    <small>{p.blueprints.includes(rival.blueprint) ? 'Battle rival heroes and set new records' : `Beat ${rival.name} to win the ${rival.blueprintName} blueprint`}</small>
                    <span className="arena-fee"><Coin size={16} /> {ARENA_ENTRY_FEE} entry</span>
                  </span>
                </button>
              );
            })()}
            {!p.settings.learningOnly && (() => {
              const cp = readChallengeProgress(p);
              const next = CHALLENGES.find((c) => !cp.cleared.includes(c.id));
              return (
                <button className="challenge-btn" onClick={() => nav.go('challenges')} aria-label="Go to Challenges">
                  <span className="challenge-icons">🎈🟢🦸</span>
                  <span className="challenge-text">
                    <b>CHALLENGES</b>
                    <small>{next ? `Next: ${next.name} — win a random look for your hero` : 'All complete! Replay to win more looks'}</small>
                  </span>
                  <span className="challenge-count">{cp.cleared.length}/{CHALLENGES.length}</span>
                </button>
              );
            })()}
            <div className="row small muted">Session goal: complete 1 mission today {todayMissions >= 1 ? '✅ done — anything more is a bonus!' : ''}</div>
            <div className="row">
              <Btn kind="primary" onClick={() => nav.go('workshop', { tab: 'Hero Profile' })}>🦸 Hero Profile</Btn>
              <Btn kind="power" onClick={() => nav.go('workshop', { tab: 'Powers' })}>⚡ Powers</Btn>
              <Btn kind="attr" onClick={() => nav.go('workshop', { tab: 'Attributes' })}>💪 Attributes</Btn>
              <Btn onClick={() => nav.go('workshop', { tab: 'Appearance' })}>🛠️ Workshop</Btn>
              <Btn onClick={() => nav.go('words')}>📖 Word Book</Btn>
              {!p.settings.learningOnly && <Btn kind="sky" onClick={() => nav.go('multiplayer')}>🎮 2-Player</Btn>}
            </div>
          </div>
          <div className="nextgoal">
            <div className="row"><span style={{ fontSize: '1.8rem' }}>{goal.icon}</span><div><strong>Next unlock: {goal.title}</strong><div className="small">{goal.detail}</div></div></div>
            {goal.need > 0 && <div style={{ marginTop: 6 }}><Bar value={p.points} max={p.points + goal.need} /></div>}
            <div className="row" style={{ marginTop: 8 }}><Btn size="small" onClick={() => nav.go(goal.target, goal.tab ? { tab: goal.tab } : undefined)}>{goal.target === 'mission' ? 'Earn points' : goal.target === 'arena' ? 'Go to Arena' : 'Open Workshop'}</Btn></div>
          </div>
          <div className="row">
            <Btn kind="ghost" size="small" onClick={() => nav.go('parent')}>👪 Parent area</Btn>
            <Btn kind="ghost" size="small" onClick={() => nav.go('profiles')}>👥 Switch hero</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
