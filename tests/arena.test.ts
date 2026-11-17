import { powerRating, bandIndex, chooseOpponent, startPaidTrial, startRetry, finishTrial, startPractice, possibleRewards, refreshBand, enemyFor, revealedBosses } from '../src/core/arena';
import { TIERS } from '../src/config/combat';
import { profile, seeded } from './helpers';
import type { Attributes } from '../src/core/types';

const L0 = { active: [null, null] as [string | null, string | null], movement: null, passive: null };
const A = (s: number, st: number, h: number, w: number): Attributes => ({ speed: s, strength: st, health: h, willpower: w });

describe('power rating and matchmaking', () => {
  it('beginners are Rookie; growth reaches higher bands', () => {
    expect(TIERS[bandIndex(powerRating(A(1, 1, 1, 1), L0))]).toBe('rookie');
    expect(TIERS[bandIndex(powerRating(A(15, 15, 15, 15), L0))]).toBe('challenger');
    expect(TIERS[bandIndex(powerRating(A(35, 35, 35, 35), L0))]).toBe('elite');
    expect(TIERS[bandIndex(powerRating(A(60, 60, 60, 60), L0))]).toBe('champion');
    expect(TIERS[bandIndex(powerRating(A(95, 95, 95, 95), L0))]).toBe('legendary');
  });
  it('one level-99 attribute is not treated as a beginner', () => {
    for (const a of [A(99, 1, 1, 1), A(1, 99, 1, 1), A(1, 1, 99, 1), A(1, 1, 1, 99)]) expect(bandIndex(powerRating(a, L0))).toBeGreaterThanOrEqual(2);
  });
  it('high health or willpower alone does not rate above equal strength', () => {
    expect(powerRating(A(1, 60, 1, 1), L0)).toBeGreaterThan(powerRating(A(1, 1, 60, 1), L0));
    expect(powerRating(A(1, 60, 1, 1), L0)).toBeGreaterThan(powerRating(A(1, 1, 1, 60), L0));
  });
  it('equipped powers give only a modest adjustment', () => {
    const base = powerRating(A(5, 5, 5, 5), L0);
    const withPowers = powerRating(A(5, 5, 5, 5), { active: ['a', 'b'], movement: 'm', passive: 'p' });
    expect(withPowers - base).toBeLessThanOrEqual(25);
  });
  it('vocabulary grade, rank, cosmetics and unspent points do not change matching', () => {
    const p1 = profile(2), p2 = profile(9);
    p2.points = 99999; p2.owned.push('cape:classic'); p2.completedMissions = 500; p2.settings.readAloud = true;
    expect(chooseOpponent(p1, seeded(4))).toEqual(chooseOpponent(p2, seeded(4)));
  });
  it('draws from the unlocked band, revealed bosses grow with experience', () => {
    const p = profile();
    expect(revealedBosses(p).length).toBe(2);
    p.attributes = A(40, 40, 40, 40); refreshBand(p);
    const tiers = new Set(Array.from({ length: 50 }, (_, i) => chooseOpponent(p, seeded(i + 1)).tier));
    expect([...tiers]).toEqual(['elite']); // no cleared adjacent band yet
    expect(revealedBosses(p).length).toBe(5);
  });
  it('bands never go backwards when powers are unequipped', () => {
    const p = profile(); p.attributes = A(20, 20, 20, 20); p.loadout = { active: ['x', 'y'], movement: 'z', passive: null };
    const b = refreshBand(p);
    p.loadout = L0;
    expect(refreshBand(p)).toBe(b);
  });
});

describe('arena trials', () => {
  it('charges 10 once, offers one free retry, and preserves enemy lock', () => {
    const p = profile(); p.points = 30;
    const r = startPaidTrial(p, { bossId: 'circuit-lynx', tier: 'rookie' });
    expect(r.ok).toBe(true); expect(p.points).toBe(20);
    const lock = { ...r.trial!.enemy };
    expect(startPaidTrial(p, { bossId: 'granite-glove', tier: 'rookie' }).ok).toBe(false);
    expect(p.points).toBe(20);
    const o = finishTrial(p, r.trial!, false, 60);
    expect(o.retryOffered).toBe(true);
    expect(p.points).toBe(20);
    const t2 = startRetry(p)!;
    expect(t2.enemy).toEqual(lock);
    expect(startRetry(p)).toBeNull();
    const o2 = finishTrial(p, t2, false, 60);
    expect(o2.retryOffered).toBe(false);
    expect(p.arena.trial).toBeNull();
    expect(p.points).toBe(20);
  });
  it('first win unlocks the blueprint but does not buy the power; repeats give no duplicates', () => {
    const p = profile(); p.points = 100;
    const t = startPaidTrial(p, { bossId: 'circuit-lynx', tier: 'rookie' }).trial!;
    const o = finishTrial(p, t, true, 120);
    expect(o.unlocked).toContain('bp:laser-eyes');
    expect(p.owned).not.toContain('power:laser-eyes');
    expect(p.points).toBe(90);
    expect(possibleRewards(p, 'circuit-lynx', 'rookie', 'standard')[0]).toMatch(/personal best/);
    const t2 = startPaidTrial(p, { bossId: 'circuit-lynx', tier: 'rookie' }).trial!;
    expect(finishTrial(p, t2, true, 100).unlocked).toEqual([]);
    expect(p.points).toBe(80); // combat never pays spendable points
  });
  it('higher-tier milestones unlock once', () => {
    const p = profile(); p.points = 100;
    const t = startPaidTrial(p, { bossId: 'circuit-lynx', tier: 'challenger' }).trial!;
    expect(finishTrial(p, t, true, 150).unlocked).toEqual(['bp:laser-eyes', 'bp:mega-laser']);
  });
  it('practice is free, only for encountered versions, and never grants blueprints', () => {
    const p = profile(); p.points = 10;
    expect(startPractice(p, 'circuit-lynx', 'rookie')).toBeNull();
    const t = startPaidTrial(p, { bossId: 'circuit-lynx', tier: 'rookie' }).trial!;
    finishTrial(p, t, false, 10); startRetry(p); finishTrial(p, p.arena.trial!, false, 10);
    const pr = startPractice(p, 'circuit-lynx', 'rookie')!;
    expect(p.points).toBe(0);
    expect(pr.enemy.hp).toBe(enemyFor('circuit-lynx', 'rookie', 'standard').hp);
    finishTrial(p, pr, true, 50);
    expect(p.blueprints).not.toContain('bp:laser-eyes');
  });
  it('no points: cannot pay entry, but nothing else is lost', () => {
    const p = profile(); p.points = 5;
    expect(startPaidTrial(p, { bossId: 'circuit-lynx', tier: 'rookie' }).ok).toBe(false);
    expect(p.points).toBe(5);
  });
  it('respects learning-only mode and the daily limit', () => {
    const p = profile(); p.points = 100; p.settings.dailyArenaLimit = 1;
    const t = startPaidTrial(p, { bossId: 'circuit-lynx', tier: 'rookie' }).trial!;
    finishTrial(p, t, true, 100);
    expect(startPaidTrial(p, { bossId: 'granite-glove', tier: 'rookie' }).ok).toBe(false);
    p.settings.dailyArenaLimit = null; p.settings.learningOnly = true;
    expect(startPaidTrial(p, { bossId: 'granite-glove', tier: 'rookie' }).ok).toBe(false);
  });
  it('relaxed difficulty changes the encounter, not tier HP or rewards', () => {
    const r = enemyFor('circuit-lynx', 'rookie', 'relaxed'), s = enemyFor('circuit-lynx', 'rookie', 'standard');
    expect(r.hp).toBe(s.hp); expect(r.damage).toBeLessThan(s.damage);
    const p = profile();
    expect(possibleRewards(p, 'circuit-lynx', 'rookie', 'relaxed')).toEqual(possibleRewards(p, 'circuit-lynx', 'rookie', 'standard'));
  });
});
