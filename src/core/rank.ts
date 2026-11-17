import { ACADEMY_RANKS, RANK_POINTS } from '../config/economy';
import { RANK_UNLOCKS, SHOP_BY_ID } from '../config/shop';
import { wordState } from './mastery';
import { grantFree } from './shop';
import type { Profile } from './types';

export function rankPoints(p: Profile): number {
  let introduced = 0, secure = 0;
  for (const w of Object.values(p.words)) {
    if (w.introducedAt !== null) introduced++;
    if (wordState(w) === 'secure') secure++;
  }
  return introduced * RANK_POINTS.introduced + secure * RANK_POINTS.secure + p.completedMissions * RANK_POINTS.mission;
}
export function rankIndex(p: Profile): number {
  const pts = rankPoints(p);
  let i = 0;
  ACADEMY_RANKS.forEach((r, k) => { if (pts >= r.at) i = k; });
  return i;
}
export function rankInfo(p: Profile) {
  const i = rankIndex(p), pts = rankPoints(p);
  const next = ACADEMY_RANKS[i + 1];
  return { index: i, name: ACADEMY_RANKS[i].name, points: pts, next: next ? { name: next.name, at: next.at, need: next.at - pts } : null };
}

/** Grant learning-achievement unlocks for every rank reached. Idempotent. Returns texts of new unlocks. */
export function claimRankRewards(p: Profile): string[] {
  const idx = rankIndex(p);
  const out: string[] = [];
  for (const u of RANK_UNLOCKS) {
    if (u.rank > idx || p.rankRewardsClaimed.includes(u.rank)) continue;
    p.rankRewardsClaimed.push(u.rank);
    if (u.reward.blueprint && !p.blueprints.includes(u.reward.blueprint)) p.blueprints.push(u.reward.blueprint);
    if (u.reward.title && !p.titles.includes(u.reward.title)) p.titles.push(u.reward.title);
    if (u.reward.free && SHOP_BY_ID[u.reward.free]) grantFree(p, u.reward.free);
    out.push(`${ACADEMY_RANKS[u.rank].name} rank: ${u.text}`);
  }
  return out;
}
