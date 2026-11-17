import { ATTRIBUTE_COST_BANDS, ATTRIBUTE_MAX, ATTRIBUTE_MIN, DERIVED } from '../config/economy';
import { PLAYER } from '../config/combat';
import type { AttributeKey, Attributes } from './types';

export const ATTRIBUTE_KEYS: AttributeKey[] = ['speed', 'strength', 'health', 'willpower'];
export const ATTRIBUTE_INFO: Record<AttributeKey, { name: string; icon: string; improves: string }> = {
  speed: { name: 'Speed', icon: '⚡', improves: 'Running speed and acceleration; modestly shorter dodge recovery' },
  strength: { name: 'Strength', icon: '💪', improves: 'Basic punch, Super Punch, and other Strength-scaled moves' },
  health: { name: 'Health', icon: '❤️', improves: 'Maximum health and the number of hits you can survive' },
  willpower: { name: 'Willpower', icon: '🔥', improves: 'Maximum adrenaline, and damage of Energy attacks (Laser Eyes, Chain Lightning, Flame Blast, Supernova)' },
};

/** Price of buying `targetLevel` (coming from targetLevel-1). */
export function levelCost(targetLevel: number): number {
  if (targetLevel <= ATTRIBUTE_MIN || targetLevel > ATTRIBUTE_MAX) return 0;
  const band = ATTRIBUTE_COST_BANDS.find((b) => targetLevel >= b.from && targetLevel <= b.to);
  return band ? band.cost : 0;
}

/** Sum of every intervening level's actual price from `from` to `to` (inclusive of `to`). */
export function batchCost(from: number, to: number): number {
  let sum = 0;
  const end = Math.min(to, ATTRIBUTE_MAX);
  for (let l = from + 1; l <= end; l++) sum += levelCost(l);
  return sum;
}

/** The highest level reachable from `from` with `points`, capped at 99. */
export function maxAffordableLevel(from: number, points: number): number {
  let l = from, spent = 0;
  while (l < ATTRIBUTE_MAX && spent + levelCost(l + 1) <= points) { spent += levelCost(l + 1); l++; }
  return l;
}

const clampLevel = (l: number) => Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, Math.floor(l)));

export function speedMultiplier(L: number): number {
  return DERIVED.speed.base + DERIVED.speed.gainAt99 * (clampLevel(L) - 1) / 98;
}
export function strengthMultiplier(L: number): number {
  return 1 + DERIVED.strength.perLevel * (clampLevel(L) - 1);
}
export function willpowerMultiplier(L: number): number {
  return 1 + DERIVED.willpowerDamage.perLevel * (clampLevel(L) - 1);
}
export function maxHealth(L: number): number {
  return DERIVED.health.base + DERIVED.health.perLevel * (clampLevel(L) - 1);
}
export function maxAdrenaline(L: number): number {
  return DERIVED.willpower.base + DERIVED.willpower.perLevel * (clampLevel(L) - 1);
}
export function runSpeed(L: number): number {
  return Math.min(PLAYER.maxRunSpeed, PLAYER.baseRunSpeed * speedMultiplier(L));
}
export function dodgeRecovery(L: number, quickRecovery = false): number {
  const base = PLAYER.dodgeRecovery * (1 - DERIVED.dodgeRecoveryCut * (clampLevel(L) - 1) / 98);
  return quickRecovery ? base * 0.75 : base;
}

export interface DerivedStats {
  speedMult: number; runSpeed: number; strengthMult: number; willpowerMult: number; maxHp: number; maxAdrenaline: number; dodgeRecovery: number; punchDamage: number;
}
export function derivedStats(a: Attributes, quickRecovery = false): DerivedStats {
  return {
    speedMult: speedMultiplier(a.speed),
    runSpeed: runSpeed(a.speed),
    strengthMult: strengthMultiplier(a.strength),
    willpowerMult: willpowerMultiplier(a.willpower),
    maxHp: maxHealth(a.health),
    maxAdrenaline: maxAdrenaline(a.willpower),
    dodgeRecovery: dodgeRecovery(a.speed, quickRecovery),
    punchDamage: PLAYER.punchDamage * strengthMultiplier(a.strength),
  };
}

/** Human-readable effect of an attribute at a level. */
export function describeLevel(key: AttributeKey, L: number): string {
  switch (key) {
    case 'speed': return `Run ${speedMultiplier(L).toFixed(2)}× beginner speed · dodge recovers in ${dodgeRecovery(L).toFixed(2)}s`;
    case 'strength': return `Damage ×${strengthMultiplier(L).toFixed(3)} · punch ${Math.round(PLAYER.punchDamage * strengthMultiplier(L))}`;
    case 'health': return `${maxHealth(L)} max HP`;
    case 'willpower': return `${maxAdrenaline(L)} max adrenaline · Energy damage ×${willpowerMultiplier(L).toFixed(3)}`;
  }
}
