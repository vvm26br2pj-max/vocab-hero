// Challenges: three action trials played in order. Each success awards a random cosmetic, rarer the pricier it is.
import { FREE_EMBLEMS, FREE_PALETTES, SHOP, type ShopItem } from '../config/shop';
import type { Profile } from './types';
import { award } from './rewards';

export type ChallengeId = 'balloons' | 'evade' | 'horde';
export interface ChallengeDef {
  id: ChallengeId; num: number; name: string; icon: string;
  /** seconds the challenge lasts */
  seconds: number;
  /** score needed (0 = survive the whole time) */
  target: number;
  goal: string; howTo: string;
  arenaKey: string;
}

export const CHALLENGES: ChallengeDef[] = [
  { id: 'balloons', num: 1, name: 'Balloon Pop', icon: '🎈', seconds: 60, target: 100, arenaKey: 'carnival',
    goal: 'Pop 100 balloons in 1 minute', howTo: 'Balloons float up from the ground. Punch them, blast them with powers, or jump into them.' },
  { id: 'evade', num: 2, name: 'Evade the Goo Blob', icon: '🟢', seconds: 60, target: 0, arenaKey: 'lab',
    goal: 'Don’t get touched for 1 minute', howTo: 'The Goo Blob cannot be hurt and gets faster over time. One touch and you lose. Use platforms, jumps and dodges.' },
  { id: 'horde', num: 3, name: 'Hero Horde', icon: '🦸', seconds: 120, target: 100, arenaKey: 'rooftop',
    goal: 'Defeat 100 heroes in 2 minutes', howTo: 'Six heroes attack at once, and most have a power: lasers, fireballs, shockwaves or ice. Each goes down in one hit, and a new one jumps in. Watch for the warnings.' },
];
export const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c])) as Record<ChallengeId, ChallengeDef>;

export interface ChallengeProgress { cleared: ChallengeId[]; best: Partial<Record<ChallengeId, number>>; plays: number }

export function challengeProgress(p: Profile): ChallengeProgress {
  const c = (p as any).challenges;
  if (!c || typeof c !== 'object') (p as any).challenges = { cleared: [], best: {}, plays: 0 };
  const cp = (p as any).challenges as ChallengeProgress;
  if (!Array.isArray(cp.cleared)) cp.cleared = [];
  if (!cp.best || typeof cp.best !== 'object') cp.best = {};
  if (typeof cp.plays !== 'number') cp.plays = 0;
  return cp;
}

/** Read-only view (never changes the profile; safe to call while rendering). */
export function readChallengeProgress(p: Profile): ChallengeProgress {
  const c = (p as any).challenges;
  // only challenges that still exist (the retired Obstacle Course may be in older saves)
  return { cleared: Array.isArray(c?.cleared) ? c.cleared.filter((id: string) => id in CHALLENGE_BY_ID) : [], best: c?.best && typeof c.best === 'object' ? c.best : {}, plays: typeof c?.plays === 'number' ? c.plays : 0 };
}
/** A challenge is open once every earlier one has been completed. */
export function challengeUnlocked(p: Profile, id: ChallengeId): boolean {
  const cp = readChallengeProgress(p);
  const i = CHALLENGES.findIndex((c) => c.id === id);
  return CHALLENGES.slice(0, i).every((c) => cp.cleared.includes(c.id));
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITY: Record<Rarity, { label: string; color: string; chance: number }> = {
  common: { label: 'Common', color: '#94a3b8', chance: 0.6 },
  rare: { label: 'Rare', color: '#38bdf8', chance: 0.28 },
  epic: { label: 'Epic', color: '#a855f7', chance: 0.09 },
  legendary: { label: 'Legendary', color: '#f59e0b', chance: 0.03 },
};
/** Price decides rarity: the more an item costs in the Workshop, the rarer it is as a challenge reward. */
export function rarityOf(it: ShopItem): Rarity {
  if (it.price >= 2500) return 'legendary';
  if (it.price >= 1500) return 'epic';
  if (it.price >= 50) return 'rare';
  return 'common';
}
const COSMETIC_KINDS = new Set(['palette', 'emblem', 'mask', 'cape', 'gloves', 'boots', 'shape']);
export function rewardPool(p: Profile): ShopItem[] {
  return SHOP.filter((it) => COSMETIC_KINDS.has(it.kind) && !p.owned.includes(it.id)
    && !(it.kind === 'palette' && FREE_PALETTES.includes(it.id.slice(8)))
    && !(it.kind === 'emblem' && FREE_EMBLEMS.includes(it.id.slice(7))));
}
export const FALLBACK_COINS = 100;

/** Roll a rarity (common 60% · rare 28% · epic 9% · legendary 3%), then a random unowned item of it. If that rarity is all owned, step down (then up). */
export function rollReward(p: Profile, rand: () => number = Math.random): ShopItem | null {
  const pool = rewardPool(p);
  if (!pool.length) return null;
  const order: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
  let roll = rand(), pick: Rarity = 'common';
  for (const r of order) { if (roll < RARITY[r].chance) { pick = r; break; } roll -= RARITY[r].chance; }
  const start = order.indexOf(pick);
  const tryOrder = [...order.slice(0, start + 1).reverse(), ...order.slice(start + 1)];
  for (const r of tryOrder) {
    const items = pool.filter((it) => rarityOf(it) === r);
    if (items.length) return items[Math.floor(rand() * items.length) % items.length];
  }
  return null;
}

export interface ChallengeOutcome { success: boolean; firstClear: boolean; best: boolean; reward: ShopItem | null; coins: number; nextUnlocked: ChallengeDef | null }

/** Record a finished attempt. Every success gives a cosmetic (or coins once you own them all). */
export function finishChallenge(p: Profile, id: ChallengeId, success: boolean, score: number, rand: () => number = Math.random): ChallengeOutcome {
  const cp = challengeProgress(p);
  cp.plays++;
  const def = CHALLENGE_BY_ID[id];
  const prev = cp.best[id] ?? 0;
  const best = score > prev;
  if (best) cp.best[id] = score;
  if (!success) return { success, firstClear: false, best, reward: null, coins: 0, nextUnlocked: null };
  const firstClear = !cp.cleared.includes(id);
  if (firstClear) cp.cleared.push(id);
  const reward = rollReward(p, rand);
  let coins = 0;
  if (reward) p.owned.push(reward.id);
  else coins = award(p, `challenge:${id}:${cp.plays}:${Date.now()}`, FALLBACK_COINS, `Challenge reward: ${def.name}`);
  const next = CHALLENGES[CHALLENGES.findIndex((c) => c.id === id) + 1] ?? null;
  return { success, firstClear, best, reward, coins, nextUnlocked: firstClear ? next : null };
}
