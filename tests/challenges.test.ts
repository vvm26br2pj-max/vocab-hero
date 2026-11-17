import { CHALLENGES, challengeUnlocked, finishChallenge, rarityOf, rewardPool, rollReward, readChallengeProgress } from '../src/core/challenges';
import { SHOP_BY_ID } from '../src/config/shop';
import { profile } from './helpers';

const seq = (...vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };

describe('challenges', () => {
  it('unlock in order: each needs the one before it completed', () => {
    const p = profile();
    expect(challengeUnlocked(p, 'balloons')).toBe(true);
    expect(challengeUnlocked(p, 'evade')).toBe(false);
    finishChallenge(p, 'balloons', false, 80);
    expect(challengeUnlocked(p, 'evade')).toBe(false);
    const o = finishChallenge(p, 'balloons', true, 120);
    expect(o.firstClear).toBe(true);
    expect(o.nextUnlocked?.id).toBe('evade');
    expect(challengeUnlocked(p, 'evade')).toBe(true);
    expect(challengeUnlocked(p, 'horde')).toBe(false);
    expect(readChallengeProgress(p).best.balloons).toBe(120);
  });
  it('can be replayed, and every success gives a new cosmetic', () => {
    const p = profile();
    const a = finishChallenge(p, 'balloons', true, 101);
    const b = finishChallenge(p, 'balloons', true, 105);
    expect(a.reward && b.reward).toBeTruthy();
    expect(a.reward!.id).not.toBe(b.reward!.id);
    expect(p.owned).toContain(a.reward!.id);
    expect(b.firstClear).toBe(false);
    expect(b.nextUnlocked).toBeNull();
  });
  it('a failed attempt gives nothing', () => {
    const p = profile(); const owned = p.owned.length, coins = p.points;
    const o = finishChallenge(p, 'evade', false, 0);
    expect(o.reward).toBeNull(); expect(p.owned.length).toBe(owned); expect(p.points).toBe(coins);
  });
  it('pricier items are rarer', () => {
    expect(rarityOf(SHOP_BY_ID['palette:ocean'])).toBe('common');
    expect(rarityOf(SHOP_BY_ID['cape:classic'])).toBe('rare');
    expect(rarityOf(SHOP_BY_ID['shape:blob'])).toBe('epic');
    expect(rarityOf(SHOP_BY_ID['shape:frost-finch'])).toBe('legendary');
    const p = profile();
    expect(rarityOf(rollReward(p, seq(0.1, 0.5))!)).toBe('common');
    expect(rarityOf(rollReward(p, seq(0.7, 0.5))!)).toBe('rare');
    expect(rarityOf(rollReward(p, seq(0.93, 0.5))!)).toBe('epic');
    expect(rarityOf(rollReward(p, seq(0.99, 0.5))!)).toBe('legendary');
    // over many rolls, legendary looks are the rarest
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) { const r = rarityOf(rollReward(p)!); counts[r] = (counts[r] ?? 0) + 1; }
    expect(counts.common).toBeGreaterThan(counts.rare);
    expect(counts.rare).toBeGreaterThan(counts.epic);
    expect(counts.epic).toBeGreaterThan(counts.legendary);
  });
  it('never gives free or owned items, and pays coins once everything is owned', () => {
    const p = profile();
    expect(rewardPool(p).some((i) => i.id === 'palette:hero-red')).toBe(false);
    for (const it of rewardPool(p)) p.owned.push(it.id);
    const before = p.points;
    const o = finishChallenge(p, 'balloons', true, 100);
    expect(o.reward).toBeNull(); expect(o.coins).toBe(100); expect(p.points).toBe(before + 100);
  });
  it('has three challenges with the requested goals', () => {
    expect(CHALLENGES.map((c) => [c.id, c.seconds, c.target])).toEqual([['balloons', 60, 100], ['evade', 60, 0], ['horde', 120, 100]]);
  });
});
