import type { Profile } from './types';

/**
 * Idempotent point award. Each reward has a stable ID; awarding the same ID twice is a no-op.
 * Returns the amount actually awarded (0 if already paid).
 */
export function award(p: Profile, rewardId: string, amount: number, reason: string, now = Date.now()): number {
  if (amount <= 0 || p.awarded[rewardId] !== undefined) return 0;
  p.awarded[rewardId] = now;
  p.points += amount;
  p.ledger.unshift({ ts: now, delta: amount, reason, id: rewardId });
  if (p.ledger.length > 300) p.ledger.length = 300;
  return amount;
}

/**
 * Idempotent spend. `chargeId` makes repeated taps/reloads safe. Never takes the balance below zero.
 * Returns true if the charge happened now or had already happened.
 */
export function spend(p: Profile, chargeId: string, amount: number, reason: string, now = Date.now()): boolean {
  if (p.awarded[chargeId] !== undefined) return true;
  if (amount < 0 || p.points < amount) return false;
  p.awarded[chargeId] = now;
  p.points -= amount;
  p.ledger.unshift({ ts: now, delta: -amount, reason, id: chargeId });
  if (p.ledger.length > 300) p.ledger.length = 300;
  return true;
}

export function hasReward(p: Profile, id: string): boolean {
  return p.awarded[id] !== undefined;
}
