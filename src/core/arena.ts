import { ARENA_ENTRY_FEE } from '../config/economy';
import { ADJACENT_BAND_CHANCE, DIFFICULTY, POWER_BANDS, POWER_RATING, TIERS, TIER_MILESTONES, TIER_STATS, type CombatDifficulty, type TierId } from '../config/combat';
import { BOSSES, BOSS_BY_ID } from '../config/bosses';
import { BLUEPRINT_NAMES, SHOP_BY_ID } from '../config/shop';
import { localDate } from './dates';
import { newId } from './profile';
import { spend } from './rewards';
import type { Attributes, BossRecord, EnemyLock, LoadoutState, Profile, TrialState } from './types';

/**
 * Power Rating: weighted attribute levels + a bonus for specialized builds + a modest adjustment for
 * equipped combat powers. Academy Rank, vocabulary grade, reading support, unspent points and cosmetics are not inputs.
 */
export function powerRating(a: Attributes, loadout: LoadoutState): number {
  const w = POWER_RATING.weights;
  const base = a.speed * w.speed + a.strength * w.strength + a.health * w.health + a.willpower * w.willpower;
  const spec = POWER_RATING.specialization * (Math.max(a.speed, a.strength, a.health, a.willpower) - 1);
  const powers = loadout.active.filter(Boolean).length * POWER_RATING.activePower
    + (loadout.movement ? POWER_RATING.movementPower : 0) + (loadout.passive ? POWER_RATING.passivePower : 0);
  return Math.round(base + spec + powers);
}
export function bandIndex(rating: number): number {
  let i = 0;
  POWER_BANDS.forEach((b, k) => { if (rating >= b.min) i = k; });
  return i;
}
export function nextBand(rating: number) {
  const i = bandIndex(rating);
  const n = POWER_BANDS[i + 1];
  return n ? { tier: n.tier, at: n.min, need: n.min - rating } : null;
}

export function bossRecord(p: Profile, id: string): BossRecord {
  return (p.bosses[id] ??= { encountered: [], wins: {}, bestTime: {}, challengeTrophies: [] });
}
export function totalWins(p: Profile, id: string): number {
  return Object.values(p.bosses[id]?.wins ?? {}).reduce((a, b) => a + (b ?? 0), 0);
}
export function bossesBeaten(p: Profile): number { return BOSSES.filter((b) => totalWins(p, b.id) > 0).length; }

/** Update and return the hero's arena band. Bands never go backwards. */
export function refreshBand(p: Profile): number {
  const b = bandIndex(powerRating(p.attributes, p.loadout));
  if (b > p.arena.highestBand) p.arena.highestBand = b;
  return p.arena.highestBand;
}

export function revealedBosses(p: Profile) {
  const exp = Math.max(bossesBeaten(p), p.arena.highestBand);
  return BOSSES.filter((b) => b.reveal <= exp);
}

export function enemyFor(bossId: string, tier: TierId, difficulty: CombatDifficulty, seed = Math.floor(Math.random() * 1e9)): EnemyLock {
  const t = TIER_STATS[tier];
  return { bossId, tier, difficulty, hp: t.hp, damage: Math.round(t.damage * DIFFICULTY[difficulty].incoming), seed };
}

export interface Offer { bossId: string; tier: TierId; }
/** Random eligible opponent: weighted toward not-recently-met and still-carrying-an-unearned-blueprint. */
export function chooseOpponent(p: Profile, rng: () => number = Math.random): Offer {
  const band = refreshBand(p);
  let tierIdx = band;
  if (band > 0) {
    const prev = TIERS[band - 1];
    const cleared = BOSSES.some((b) => (p.bosses[b.id]?.wins[prev] ?? 0) > 0);
    if (cleared && rng() < ADJACENT_BAND_CHANCE) tierIdx = band - 1;
  }
  const tier = TIERS[tierIdx];
  const pool = revealedBosses(p);
  const weights = pool.map((b) => {
    let w = 1;
    const recentIdx = p.arena.recent.indexOf(b.id);
    if (recentIdx === 0) w *= 0.15; else if (recentIdx > 0) w *= 0.5;
    if (!p.blueprints.includes(b.blueprint)) w *= 3;
    if ((p.bosses[b.id]?.wins[tier] ?? 0) === 0) w *= 1.5;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return { bossId: pool[i].id, tier }; }
  return { bossId: pool[pool.length - 1].id, tier };
}

/** What a paid win would grant. Never presents duplicate rewards as new. */
export function possibleRewards(p: Profile, bossId: string, tier: TierId, difficulty: CombatDifficulty): string[] {
  const b = BOSS_BY_ID[bossId];
  const out: string[] = [];
  if (!p.blueprints.includes(b.blueprint)) out.push(`${b.blueprintName} blueprint + ${b.name} trophy (first victory)`);
  for (const m of TIER_MILESTONES) {
    if (m.tier !== tier || (m.boss !== '*' && m.boss !== bossId)) continue;
    if (m.blueprint && p.blueprints.includes(m.blueprint)) continue;
    out.push(`${m.text} (first ${TIER_STATS[tier].name} victory)`);
  }
  if (difficulty === 'challenge' && !(p.bosses[bossId]?.challengeTrophies ?? []).includes(tier)) out.push(`Challenge trophy (cosmetic)`);
  if (!out.length) out.push('A new personal best time (no new item — you already earned this one)');
  return out;
}

export function arenaAllowed(p: Profile, now = Date.now()): { ok: boolean; reason?: string } {
  if (p.settings.learningOnly) return { ok: false, reason: 'Learning-only mode is on (parent setting).' };
  const today = localDate(now);
  if (p.arena.daily.date !== today) p.arena.daily = { date: today, count: 0 };
  const lim = p.settings.dailyArenaLimit;
  if (lim !== null && p.arena.daily.count >= lim) return { ok: false, reason: `Today's arena limit (${lim}) is reached. Learning is always open!` };
  return { ok: true };
}

/** Start a paid trial: charges the entry fee exactly once. */
export function startPaidTrial(p: Profile, offer: Offer, now = Date.now(), shieldBonus = false): { ok: boolean; reason?: string; trial?: TrialState } {
  const allowed = arenaAllowed(p, now);
  if (!allowed.ok) return allowed;
  if (p.arena.trial && (p.arena.trial.status === 'active' || (p.arena.trial.status === 'lost' && p.arena.trial.retryAvailable)))
    return { ok: false, reason: 'Finish or end your current battle first.' };
  const id = newId('t');
  if (p.points < ARENA_ENTRY_FEE) return { ok: false, reason: `Arena entry costs ${ARENA_ENTRY_FEE} coins. Learn a few words to earn more!` };
  if (!spend(p, `entry:${id}`, ARENA_ENTRY_FEE, `Arena entry: ${BOSS_BY_ID[offer.bossId].name}`, now)) return { ok: false, reason: 'Not enough coins' };
  const trial: TrialState = {
    id, mode: 'paid', enemy: enemyFor(offer.bossId, offer.tier, p.settings.combatDifficulty), paid: true,
    retryAvailable: true, retryUsed: false, attempt: 1, status: 'active', snapshot: null, shieldBonus, createdAt: now,
  };
  p.arena.trial = trial;
  p.arena.daily.count++;
  const rec = bossRecord(p, offer.bossId);
  if (!rec.encountered.includes(offer.tier)) rec.encountered.push(offer.tier);
  p.arena.recent = [offer.bossId, ...p.arena.recent.filter((x) => x !== offer.bossId)].slice(0, 3);
  return { ok: true, trial };
}

/** The promised free retry: same opponent, same tier/stats/difficulty, fresh starting values. */
export function startRetry(p: Profile): TrialState | null {
  const t = p.arena.trial;
  if (!t || t.mode !== 'paid' || t.status !== 'lost' || !t.retryAvailable || t.retryUsed) return null;
  t.retryUsed = true;
  t.retryAvailable = false;
  t.attempt = 2;
  t.status = 'active';
  t.snapshot = null;
  return t;
}

export function startPractice(p: Profile, bossId: string, tier: TierId): TrialState | null {
  const rec = p.bosses[bossId];
  if (!rec || !rec.encountered.includes(tier)) return null;
  return {
    id: newId('pr'), mode: 'practice', enemy: enemyFor(bossId, tier, p.settings.combatDifficulty), paid: false,
    retryAvailable: false, retryUsed: false, attempt: 1, status: 'active', snapshot: null, shieldBonus: false, createdAt: Date.now(),
  };
}

export interface TrialOutcome { unlocked: string[]; trophies: string[]; titles: string[]; retryOffered: boolean; personalBest: boolean; }

/** Record the result of a fight. Rewards are idempotent through reward IDs that include boss + tier. */
export function finishTrial(p: Profile, t: TrialState, won: boolean, seconds: number): TrialOutcome {
  const out: TrialOutcome = { unlocked: [], trophies: [], titles: [], retryOffered: false, personalBest: false };
  if (t.mode === 'tutorial') { p.arena.tutorialDone = true; t.status = won ? 'won' : 'lost'; return out; }
  const { bossId, tier, difficulty } = t.enemy;
  const rec = bossRecord(p, bossId);
  if (!won) {
    t.snapshot = null;
    if (t.mode === 'paid' && !t.retryUsed) { t.status = 'lost'; out.retryOffered = true; }
    else { t.status = 'lost'; if (p.arena.trial?.id === t.id) p.arena.trial = null; }
    return out;
  }
  t.status = 'won';
  t.snapshot = null;
  if (p.arena.trial?.id === t.id) p.arena.trial = null;
  if (t.mode !== 'paid') return out; // practice wins never grant the paid trial's blueprint
  const prevBest = rec.bestTime[tier];
  if (prevBest === undefined || seconds < prevBest) { rec.bestTime[tier] = Math.round(seconds); out.personalBest = prevBest !== undefined; }
  rec.wins[tier] = (rec.wins[tier] ?? 0) + 1;
  const b = BOSS_BY_ID[bossId];
  const grant = (rewardId: string, fn: () => void) => { if (p.awarded[rewardId] === undefined) { p.awarded[rewardId] = Date.now(); fn(); } };
  grant(`win:${bossId}:first`, () => {
    if (!p.blueprints.includes(b.blueprint)) { p.blueprints.push(b.blueprint); out.unlocked.push(b.blueprint); }
    const tr = `trophy:${bossId}`; if (!p.trophies.includes(tr)) { p.trophies.push(tr); out.trophies.push(`${b.name} trophy`); }
  });
  for (const m of TIER_MILESTONES) {
    if (m.tier !== tier || (m.boss !== '*' && m.boss !== bossId)) continue;
    grant(`milestone:${m.boss}:${tier}`, () => {
      if (m.blueprint && !p.blueprints.includes(m.blueprint)) { p.blueprints.push(m.blueprint); out.unlocked.push(m.blueprint); }
      if (m.title && !p.titles.includes(m.title)) { p.titles.push(m.title); out.titles.push(m.title); }
    });
  }
  if (difficulty === 'challenge') grant(`challenge:${bossId}:${tier}`, () => {
    rec.challengeTrophies.push(tier); const tr = `trophy:${bossId}:${tier}:challenge`; p.trophies.push(tr); out.trophies.push(`${b.name} ${TIER_STATS[tier].name} Challenge trophy`);
  });
  return out;
}

export function blueprintText(bp: string): string {
  const itemId = Object.values(SHOP_BY_ID).find((i) => i.requires?.blueprint === bp)?.id;
  const item = itemId ? SHOP_BY_ID[itemId] : undefined;
  return `${BLUEPRINT_NAMES[bp] ?? bp} blueprint unlocked${item ? ` — buy it in the Workshop for ${item.price} coins` : ''}`;
}
