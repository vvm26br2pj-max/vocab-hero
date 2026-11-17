import { useEffect, useMemo, useRef, useState } from 'react';
import Phaser from 'phaser';
import type { Nav } from '../App';
import { activeProfile, getSave, mutate, useProfile } from '../store';
import { BattleScene, type BattleConfig, type HudState } from '../../combat/BattleScene';
import { W, H } from '../../combat/arenas';
import { attachKeyboard, DUO_HELP, KEY_HELP, onInputChange, resetInput, setInput, type InputState } from '../../combat/input';
import { currentRoom, RELAY } from '../../net/online';
import { setActiveBattle } from '../../combat/registry';
import type { PlayerCfg } from '../../combat/fighter';
import { enemyFor } from '../../core/arena';
import { finishTrial, blueprintText, type TrialOutcome } from '../../core/arena';
import { BOSS_BY_ID } from '../../config/bosses';
import { DIFFICULTY, TIER_STATS, type TierId } from '../../config/combat';
import { SHOP_BY_ID } from '../../config/shop';
import { content } from '../../core/content';
import { CHALLENGE_BY_ID, CHALLENGES, RARITY, rarityOf, finishChallenge, type ChallengeId, type ChallengeOutcome } from '../../core/challenges';
import { HeroSprite } from '../components/Sprite';
import type { TrialState } from '../../core/types';
import { Btn } from '../components/common';
import { FullscreenButton } from '../fullscreen';
import { Joystick } from '../components/Joystick';
import { sfx, playTrack, fadeOutTrack, duckTrack } from '../sound';
import battleTheme from '@battle-theme';

export interface BattleRequest {
  mode: 'trial' | 'practice' | 'tutorial' | 'training' | 'versus' | 'coop' | 'challenge';
  challenge?: ChallengeId;
  trial?: TrialState; demoPower?: string;
  /** local multiplayer */
  p1Id?: string; p2Id?: string; arenaKey?: string; bossId?: string; tier?: TierId; fair?: boolean;
  /** online room play */
  online?: { role: 'host' | 'guest' }; players?: PlayerCfg[]; seed?: number;
}
/** "Fair fight" stats for versus so a newer hero can play an older one. */
const FAIR_ATTRS = { speed: 15, strength: 15, health: 15, willpower: 15 };

export function Battle({ req, nav }: { req: BattleRequest; nav: Nav }) {
  const p = useProfile()!;
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BattleScene | null>(null);
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState<HudState | null>(null);
  const [result, setResult] = useState<{ won: boolean; seconds: number; outcome: TrialOutcome | null; winner?: number; score?: [number, number] } | null>(null);
  const multi = req.mode === 'versus' || req.mode === 'coop';
  const [names, setNames] = useState<[string, string]>(['P1', 'P2']);
  const online = req.online ? currentRoom() : null;
  const [lost, setLost] = useState(false);
  const [challengeResult, setChallengeResult] = useState<ChallengeOutcome | null>(null);
  const [portrait, setPortrait] = useState(false);
  const touch = useMemo(() => typeof window !== 'undefined' && (('ontouchstart' in window) || matchMedia('(pointer: coarse)').matches), []);
  const [showTouch, setShowTouch] = useState(touch);
  const trial: TrialState | null = req.mode === 'trial' ? p.arena.trial : req.mode === 'practice' ? req.trial ?? null : null;
  const trialRef = useRef(trial);

  useEffect(() => {
    const prof = activeProfile()!;
    const t = trialRef.current;
    if ((req.mode === 'trial' || req.mode === 'practice') && (!t || t.status !== 'active')) { nav.go('arena'); return; }
    const diff = prof.settings.combatDifficulty;
    let players: PlayerCfg[] | undefined;
    if (multi && req.players) {
      players = req.players.map((pp) => ({ ...pp, attributes: req.mode === 'versus' && req.fair ? { ...FAIR_ATTRS } : { ...pp.attributes } }));
      setNames([players[0].name, players[1].name]);
    } else if (multi) {
      const save = getSave();
      const pick = (id?: string) => save.profiles[id ?? ''] ?? prof;
      players = [pick(req.p1Id), pick(req.p2Id)].map((pp) => ({
        name: pp.nickname, appearance: pp.appearance,
        attributes: req.mode === 'versus' && req.fair ? { ...FAIR_ATTRS } : { ...pp.attributes },
        loadout: JSON.parse(JSON.stringify(pp.loadout)), powerLevels: { ...(pp.powerLevels ?? {}) },
      }));
      setNames([players[0].name, players[1].name]);
    }
    const coopEnemy = req.mode === 'coop' ? enemyFor(req.bossId ?? 'circuit-lynx', req.tier ?? 'rookie', diff) : null;
    const cfg: BattleConfig = {
      mode: multi ? 'practice' : (req.mode as 'trial' | 'practice' | 'tutorial' | 'training' | 'challenge'),
      challenge: req.challenge,
      multi: multi ? (req.mode as 'versus' | 'coop') : undefined, players, arenaKey: req.arenaKey,
      online: req.online && online ? { role: req.online.role, localIndex: req.online.role === 'host' ? 0 : 1 } : undefined,
      onNet: req.online?.role === 'host' && online ? (st) => online.send({ t: 'snap', s: st }) : undefined,
      netHz: RELAY ? 15 : 30,
      appearance: prof.appearance,
      attributes: { ...prof.attributes },
      loadout: JSON.parse(JSON.stringify(prof.loadout)),
      difficulty: t?.enemy.difficulty ?? diff,
      bossId: coopEnemy?.bossId ?? t?.enemy.bossId ?? (req.mode === 'training' || req.mode === 'versus' ? 'dummy' : 'tutorial'),
      tier: coopEnemy?.tier ?? t?.enemy.tier ?? 'rookie',
      enemyHp: coopEnemy?.hp ?? t?.enemy.hp ?? (req.mode === 'training' ? 400 : 150),
      enemyDamage: coopEnemy?.damage ?? t?.enemy.damage ?? Math.round(6 * DIFFICULTY[diff].incoming),
      seed: req.seed ?? coopEnemy?.seed ?? t?.enemy.seed ?? (req.mode === 'challenge' ? Math.floor(Math.random() * 1e9) : 12345),
      snapshot: req.mode === 'trial' ? t?.snapshot ?? null : null,
      shieldBonus: !!t?.shieldBonus && t.attempt === 1,
      demoPower: req.demoPower,
      powerLevels: { ...(prof.powerLevels ?? {}) },
      reducedMotion: prof.settings.reducedMotion,
      sound: (n) => (sfx as any)[n]?.(),
      onHud: (h) => setHud(h),
      onEnd: (r) => {
        fadeOutTrack(2000);
        let outcome: TrialOutcome | null = null;
        if (multi) { if (req.online?.role === 'host') online?.send({ t: 'end', r }); setResult({ ...r, outcome: null }); return; }
        if (req.mode === 'challenge' && req.challenge) {
          let co: ChallengeOutcome | null = null;
          mutate((pp) => { co = finishChallenge(pp, req.challenge!, r.won, r.score?.[0] ?? 0); });
          setChallengeResult(co); setResult({ ...r, outcome: null }); return;
        }
        if (req.mode === 'tutorial') mutate((pp) => { pp.arena.tutorialDone = true; });
        else if (trialRef.current) {
          mutate((pp) => {
            const tr = req.mode === 'trial' ? pp.arena.trial! : trialRef.current!;
            outcome = finishTrial(pp, tr, r.won, r.seconds);
          });
        }
        setResult({ ...r, outcome });
      },
    };
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: host.current!, width: W, height: H, backgroundColor: '#000000',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      input: { keyboard: false }, audio: { noAudio: true }, banner: false,
    });
    game.scene.add('battle', BattleScene, true, cfg);
    const poll = setInterval(() => { const s = game.scene.getScene('battle') as BattleScene | null; if (s && s.cfg) { sceneRef.current = s; clearInterval(poll); setActiveBattle(s); if (import.meta.env.DEV) (window as any).__battle = s; } }, 50);
    const detach = attachKeyboard(multi && !req.online);
    // online wiring
    const offs: (() => void)[] = [];
    if (online && req.online) {
      if (req.online.role === 'host') {
        offs.push(online.on((m) => { if (m.t === 'in') setInput(m.k as keyof InputState, m.v, 1); if (m.t === 'back' || m.t === 'bye') nav.go('multiplayer', { tab: 'online' }); }));
      } else {
        const queue: unknown[] = [];
        offs.push(online.on((m) => {
          if (m.t === 'snap') { const sc = sceneRef.current; if (sc) { queue.splice(0).forEach((q) => sc.applyNetState(q as any)); sc.applyNetState(m.s as any); } else queue.push(m.s); }
          if (m.t === 'end') { fadeOutTrack(2000); setResult({ ...m.r, outcome: null }); }
          if (m.t === 'back' || m.t === 'bye') nav.go('multiplayer', { tab: 'online' });
        }));
        offs.push(onInputChange((k, v, player) => { if (player === 0) online.send({ t: 'in', k, v }); }));
      }
      offs.push(online.onStatus((st) => { if (st === 'closed' || st === 'error') setLost(true); }));
    }
    playTrack(battleTheme, 2000);
    const pause = () => { if (req.online) return; sceneRef.current?.setPaused(true); setPaused(true); resetInput(); };
    const onVis = () => { if (document.hidden) pause(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'p') { const s = sceneRef.current; if (!s) return; const v = !s.paused; s.setPaused(v); setPaused(v); } };
    const onOrient = () => { setPortrait(window.innerHeight > window.innerWidth); pause(); };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('keydown', onKey);
    window.addEventListener('orientationchange', onOrient);
    const mq = matchMedia('(orientation: portrait)');
    const mqh = () => onOrient();
    mq.addEventListener?.('change', mqh);
    setPortrait(window.innerHeight > window.innerWidth);
    // persist an interrupted paid trial: health, adrenaline and boss state (never refilled by reloading)
    const snap = setInterval(() => {
      const s = sceneRef.current;
      if (req.mode !== 'trial' || !s || s.ended || s.intro > 0) return;
      const shot = s.getSnapshot();
      mutate((pp) => { if (pp.arena.trial && pp.arena.trial.status === 'active') pp.arena.trial.snapshot = shot; });
    }, 1000);
    return () => {
      clearInterval(poll); clearInterval(snap); detach(); fadeOutTrack(600); offs.forEach((o) => o()); setActiveBattle(null);
      window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('keydown', onKey); window.removeEventListener('orientationchange', onOrient);
      mq.removeEventListener?.('change', mqh);
      const s = sceneRef.current;
      if (req.mode === 'trial' && s && !s.ended) { const shot = s.getSnapshot(); mutate((pp) => { if (pp.arena.trial?.status === 'active') pp.arena.trial.snapshot = shot; }); }
      game.destroy(true);
    };
  }, []);

  const resume = () => { sceneRef.current?.setPaused(false); setPaused(false); };
  useEffect(() => { duckTrack(paused && !result); }, [paused, result]);
  const leave = () => { if (online) { online.send({ t: 'back' }); nav.go('multiplayer', { tab: 'online' }); return; } nav.go(multi ? 'multiplayer' : req.mode === 'challenge' ? 'challenges' : req.mode === 'training' ? 'workshop' : 'arena'); };
  const t = trial;
  const boss = t ? BOSS_BY_ID[t.enemy.bossId] : null;

  const tb = (k: keyof InputState, label: React.ReactNode, cls = '', disabled = false, player = 0, aria?: string, cd = 0) => (
    <button className={`tbtn ${cls} ${disabled ? 'disabled' : ''}`} aria-label={aria ?? (typeof label === 'string' ? label : k)} style={cd > 0 ? ({ ['--cd' as any]: cd } as React.CSSProperties) : undefined}
      onPointerDown={(e) => { e.preventDefault(); try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* */ } setInput(k, true, player); try { navigator.vibrate?.(8); } catch { /* */ } }}
      onPointerUp={() => setInput(k, false, player)} onPointerCancel={() => setInput(k, false, player)} onLostPointerCapture={() => setInput(k, false, player)}
      onContextMenu={(e) => e.preventDefault()}>{label}{cd > 0 && <span className="cd-ring" />}</button>
  );
  const pwLabel = (i: 0 | 1) => { const ph = hud?.powers[i]; if (!ph) return null; return { label: ph.name.split(' ').map((w) => w[0]).join('').slice(0, 3), name: ph.name, cd: ph.ready ? 0 : Math.min(1, ph.cdFrac), dis: !ph.ready || !ph.affordable }; };
  const p1 = pwLabel(0), p2 = pwLabel(1);

  return (
    <div className="battle-wrap">
      <div ref={host} style={{ width: '100%', height: '100%' }} />
      <div className="touch">
        <div className="battle-top">
          <button className="btn small" onClick={() => { if (!req.online) sceneRef.current?.setPaused(true); setPaused(true); }} aria-label={req.online ? 'Menu' : 'Pause'}>{req.online ? '☰ Menu' : '⏸ Pause'}</button>
          <FullscreenButton />
        </div>
        {showTouch && !result && !paused && multi && !req.online && (
          <>
            {[0, 1].map((pl) => (
              <div key={pl} className={`pad duo ${pl === 0 ? 'left' : 'right'}`}>
                <span className={`duo-tag p${pl + 1}`}>P{pl + 1}</span>
                {tb('left', '◀', '', false, pl)}{tb('right', '▶', '', false, pl)}{tb('jump', '⤒', '', false, pl)}{tb('punch', '👊', '', false, pl)}{tb('dodge', '💨', '', false, pl)}{tb('power1', '✦', '', false, pl)}
              </div>
            ))}
          </>
        )}
        {showTouch && !result && !paused && (!multi || req.online) && (
          <>
            <Joystick />
            <div className="action-pad">
              {tb('punch', '👊', 'big a-punch', false, 0, 'Punch')}
              {tb('jump', '⤒', 'big a-jump', false, 0, 'Jump')}
              {tb('dodge', '💨', 'a-dodge', false, 0, 'Dodge')}
              {p1 && tb('power1', p1.label, 'a-p1 power', p1.dis, 0, p1.name, p1.cd)}
              {p2 && tb('power2', p2.label, 'a-p2 power', p2.dis, 0, p2.name, p2.cd)}
              {hud?.move && tb('move', 'MOVE', 'a-move power', !hud.move.ready, 0, 'Movement power')}
            </div>
          </>
        )}
        {portrait && showTouch && !paused && <div className="rotate-hint"><span className="rotate-ic">📱</span>Turn your phone sideways to play</div>}
      </div>
      {paused && !result && (
        <div className="overlay">
          <div className="card col">
            <h2>{req.online ? 'Menu (the match keeps going)' : 'Paused'}</h2>
            {multi ? DUO_HELP.map((h) => <p key={h} className="small">{h}</p>) : <p className="small">{KEY_HELP}</p>}
            <p className="small muted">Touch: ◀ ▶ move · ⤒ jump · 👊 punch · 💨 dodge · power buttons light up when ready and you have enough adrenaline.</p>
            <label className="switch"><input type="checkbox" checked={showTouch} onChange={(e) => setShowTouch(e.target.checked)} /> Show touch controls</label>
            {hud?.powers.map((ph, i) => ph && <p key={i} className="small">Power {i + 1}: <b>{ph.name}</b> — {ph.cost} adrenaline{!ph.capacityOk ? ' (needs more Willpower capacity)' : ''}</p>)}
            <div className="row">
              <Btn kind="go" onClick={resume} autoFocus>▶ Resume</Btn>
              <Btn onClick={leave}>{req.mode === 'trial' ? 'Leave — resume later' : 'Leave'}</Btn>
            </div>
            {req.mode === 'trial' && <p className="small muted">Leaving keeps this battle saved with your current health and adrenaline. No extra charge to resume.</p>}
          </div>
        </div>
      )}
      {lost && !result && (
        <div className="overlay"><div className="card col center" style={{ alignItems: 'center' }}>
          <h2>Connection lost</h2><p>Your friend left the room or the internet connection dropped.</p>
          <Btn kind="go" onClick={() => { currentRoom()?.close(); nav.go('multiplayer', { tab: 'online' }); }}>Back to multiplayer</Btn>
        </div></div>
      )}
      {result && multi && <MultiResult result={result} req={req} names={names} nav={nav} />}
      {result && req.mode === 'challenge' && <ChallengeResult result={result} outcome={challengeResult} req={req} nav={nav} />}
      {result && !multi && req.mode !== 'challenge' && <ResultCard result={result} req={req} trial={t} bossName={boss?.name} nav={nav} />}
    </div>
  );
}

function ResultCard({ result, req, trial, bossName, nav }: { result: { won: boolean; seconds: number; outcome: TrialOutcome | null }; req: BattleRequest; trial: TrialState | null; bossName?: string; nav: Nav }) {
  const p = useProfile()!;
  const o = result.outcome;
  const idx = content(p.customWords);
  const recapWord = useMemo(() => {
    const ids = Object.values(p.words).filter((w) => w.introducedAt !== null).sort((a, b) => (b.introducedAt ?? 0) - (a.introducedAt ?? 0)).map((w) => w.id);
    return ids.length ? idx.byId.get(ids[Math.floor(Math.random() * Math.min(5, ids.length))]) : undefined;
  }, []);
  const [showRecap, setShowRecap] = useState(false);
  const retry = p.arena.trial && p.arena.trial.status === 'lost' && p.arena.trial.retryAvailable;
  return (
    <div className="overlay">
      <div className="card col">
        <h2>{result.won ? (req.mode === 'tutorial' ? 'Tutorial complete!' : 'Victory!') : 'Good effort!'}</h2>
        {req.mode !== 'training' && <p className="small muted">Time: {Math.round(result.seconds)}s{trial ? ` · ${bossName} (${TIER_STATS[trial.enemy.tier].name}, ${DIFFICULTY[trial.enemy.difficulty].label})` : ''}</p>}
        {o?.unlocked.map((bp) => {
          const it = Object.values(SHOP_BY_ID).find((i) => i.requires?.blueprint === bp);
          return <div key={bp} className="feedback good"><b>🧩 {blueprintText(bp)}</b>{it && <div className="small">Your balance: {p.points} coins{p.points >= it.price ? ' — you can afford it now!' : ` — ${it.price - p.points} more to go. Learning earns points!`}</div>}</div>;
        })}
        {o?.trophies.map((t) => <p key={t}>🏆 {t}</p>)}
        {o?.titles.map((t) => <p key={t}>🎖️ New title: {t}</p>)}
        {result.won && o && !o.unlocked.length && !o.trophies.length && req.mode === 'trial' && <p>{o.personalBest ? '⏱️ New personal best time!' : 'You already earned this opponent’s rewards — great practice!'}</p>}
        {req.mode === 'practice' && <p className="small">Practice match — no blueprint, no cost.</p>}
        {!result.won && req.mode === 'trial' && (retry ? <p>Your free retry is ready: same opponent, same difficulty, no entry fee. Your words, items and coins are all safe.</p> : <p>That was your free retry. Your words, items and coins are all safe — come back any time.</p>)}
        {req.mode === 'tutorial' && <p>You learned to move, jump, punch, and dodge. Battles in the Arena unlock power blueprints!</p>}
        {recapWord && req.mode !== 'training' && (showRecap
          ? <div className="passage small"><b>{recapWord.word}</b>: {recapWord.definition}<br />{recapWord.everyday}</div>
          : <Btn size="small" onClick={() => setShowRecap(true)}>📖 Optional word recap</Btn>)}
        <div className="row">
          {retry && <Btn kind="hero" onClick={() => nav.go('arena')}>Use free retry</Btn>}
          {o?.unlocked.length ? <Btn kind="primary" onClick={() => nav.go('workshop', { tab: 'Powers' })}>Go to Workshop</Btn> : null}
          <Btn kind="go" onClick={() => nav.go('mission')}>Learn words</Btn>
          <Btn onClick={() => nav.go(req.mode === 'training' ? 'workshop' : 'arena')}>Back</Btn>
        </div>
      </div>
    </div>
  );
}

function MultiResult({ result, req, names, nav }: { result: { won: boolean; seconds: number; winner?: number; score?: [number, number] }; req: BattleRequest; names: [string, string]; nav: Nav }) {
  const versus = req.mode === 'versus';
  return (
    <div className="overlay">
      <div className="card col center" style={{ alignItems: 'center' }}>
        <h2>{versus ? `${names[result.winner ?? 0]} wins!` : result.won ? 'Team victory!' : 'So close!'}</h2>
        {versus && result.score && <p className="mp-score"><span className="p1">{names[0]} {result.score[0]}</span> – <span className="p2">{result.score[1]} {names[1]}</span></p>}
        {!versus && <p>{result.won ? `${names[0]} and ${names[1]} beat the rival together in ${Math.round(result.seconds)}s.` : 'Both heroes were knocked out. Stick together and revive each other!'}</p>}
        <p className="small muted">Friendly match: no coins are won or lost, and no blueprints are unlocked.</p>
        {req.online ? (
          <div className="row center">
            <Btn kind="hero" onClick={() => nav.go('multiplayer', { tab: 'online' })}>Back to the room</Btn>
            <span className="small muted">{req.online.role === 'host' ? 'You can start a rematch from the room.' : 'The host can start a rematch.'}</span>
          </div>
        ) : <div className="row center">
          <Btn kind="hero" onClick={() => { nav.go('hq'); setTimeout(() => nav.go('battle', { battle: { ...req } }), 0); }}>Rematch</Btn>
          <Btn kind="go" onClick={() => nav.go('multiplayer')}>Change setup</Btn>
          <Btn onClick={() => nav.go('hq')}>Back to HQ</Btn>
        </div>}
      </div>
    </div>
  );
}

function ChallengeResult({ result, outcome, req, nav }: { result: { won: boolean; seconds: number; score?: [number, number] }; outcome: ChallengeOutcome | null; req: BattleRequest; nav: Nav }) {
  const p = useProfile()!;
  const def = CHALLENGE_BY_ID[req.challenge!];
  const it = outcome?.reward;
  const rar = it ? RARITY[rarityOf(it)] : null;
  const look = it?.look ? { ...p.appearance, ...it.look } : null;
  const again = () => { nav.go('hq'); setTimeout(() => nav.go('battle', { battle: { mode: 'challenge', challenge: def.id } }), 0); };
  const next = outcome?.nextUnlocked ?? null;
  const scoreLine = def.target ? `${result.score?.[0] ?? 0} / ${def.target}` : result.won ? 'You made it!' : `You lasted ${Math.floor(result.seconds)}s of ${def.seconds}s`;
  return (
    <div className="overlay">
      <div className="card col center ch-result" style={{ alignItems: 'center' }}>
        <span className="ch-result-icon">{def.icon}</span>
        <h2>{result.won ? 'Challenge complete!' : 'Not this time!'}</h2>
        <p className="ch-score">{scoreLine}</p>
        {outcome?.best && def.target > 0 && <p className="small">⭐ New best score!</p>}
        {it && rar && (
          <div className="ch-reward" style={{ ['--rar' as any]: rar.color }}>
            <span className="ch-rarity">{rar.label} reward</span>
            {look && <HeroSprite appearance={look} anim="victory" size={110} />}
            <b>{it.name}</b>
            <span className="small">Added to your Workshop → Appearance.</span>
          </div>
        )}
        {outcome?.coins ? <p className="feedback good">You already own every look, so here are {outcome.coins} coins!</p> : null}
        {next && <p className="feedback good">🔓 Challenge {next.num} unlocked: {next.name}!</p>}
        {!result.won && <p className="small">{def.goal}. Try again as many times as you like!</p>}
        <div className="row center">
          <Btn kind="hero" onClick={again}>↻ Play again</Btn>
          {next && <Btn kind="go" onClick={() => { nav.go('hq'); setTimeout(() => nav.go('battle', { battle: { mode: 'challenge', challenge: next.id } }), 0); }}>Next challenge ▶</Btn>}
          {it && <Btn onClick={() => nav.go('workshop', { tab: 'Appearance' })}>Try it on</Btn>}
          <Btn onClick={() => nav.go('challenges')}>All challenges</Btn>
        </div>
      </div>
    </div>
  );
}
void CHALLENGES;
