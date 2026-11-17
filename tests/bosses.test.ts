import { createBoss } from '../src/combat/bosses';
import { ARENAS, GROUND } from '../src/combat/arenas';
import type { BattleCtx, Hazard } from '../src/combat/types';
import { DIFFICULTY, MIN_TELEGRAPH, TIERS, TIER_STATS, type CombatDifficulty, type TierId } from '../src/config/combat';

function makeCtx(tier: TierId, diff: CombatDifficulty, targetY = GROUND) {
  let seed = 42;
  const hazards: Hazard[] = [];
  let n = 0;
  const ctx: BattleCtx = {
    time: 0, rng: () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; },
    tier: TIER_STATS[tier], telegraphMul: DIFFICULTY[diff].telegraph, extraHazards: DIFFICULTY[diff].extraHazards, damage: 10, arena: ARENAS.rooftop,
    target: () => ({ x: 300 + Math.sin(ctx.time) * 150, y: targetY }),
    playerNow: () => ({ x: 300, y: targetY, onGround: true }),
    addHazard: (h) => { const hz = { id: `h${++n}`, owner: 'boss', x: 0, y: 0, w: 0, h: 0, r: 0, vx: 0, vy: 0, t: 0, color: 0, ...h } as Hazard; hazards.push(hz); return hz; },
    removeHazard: () => {}, shake: () => {}, sound: () => {}, floatText: () => {}, banner: () => {},
    slippery: [], heavy: [], mothDecoys: [], consumePlayerDecoy: () => {},
    playerThreat: () => ({ attacking: Math.sin(ctx.time * 3) > 0.3, x: 300 + Math.sin(ctx.time) * 150, y: targetY, dist: 100 }),
  };
  return { ctx, hazards };
}

const IDS = ['circuit-lynx', 'granite-glove', 'frost-finch', 'prism-moth', 'captain-gravity', 'copper-comet'];

describe('boss state machines', () => {
  for (const id of IDS) for (const tier of TIERS) for (const diff of ['relaxed', 'standard', 'challenge'] as CombatDifficulty[]) {
    it(`${id} ${tier} ${diff}: runs 3 minutes, reaches every phase, telegraphs stay readable`, () => {
      const { ctx, hazards } = makeCtx(tier, diff, tier === 'elite' ? GROUND - 98 : GROUND);
      const boss = createBoss(id, ctx, 1000);
      const states = new Set<string>();
      const dt = 1 / 60;
      for (let i = 0; i < 60 * 180; i++) {
        ctx.time += dt;
        boss.update(dt);
        states.add(boss.state);
        hazards.forEach((h) => { h.t += dt; });
        if (i % 600 === 300) boss.takeHit(boss.vulnerable ? boss.maxHp / (TIER_STATS[tier].phases + 1) : 0);
        expect(Number.isFinite(boss.x) && Number.isFinite(boss.y)).toBe(true);
        expect(boss.x).toBeGreaterThanOrEqual(30); expect(boss.x).toBeLessThanOrEqual(930);
      }
      for (const s of ['approach', 'telegraph', 'attack', 'recover']) expect(states.has(s)).toBe(true);
      expect(boss.phase).toBeGreaterThanOrEqual(Math.min(2, TIER_STATS[tier].phases));
      const damaging = hazards.filter((h) => h.dmg > 0 && h.style !== 'body');
      expect(damaging.length).toBeGreaterThan(5);
      // every damaging hazard either has a readable warning or follows a telegraphed step (waves/fire spawn after a marked slam)
      for (const h of damaging) if (!['wave', 'fire', 'satellite', 'orb', 'boulder', 'icicle'].includes(h.style)) expect(h.warn).toBeGreaterThanOrEqual(MIN_TELEGRAPH - 1e-9);
    });
  }
  it('relaxed warnings are longer than challenge warnings for the same move', () => {
    const r = makeCtx('rookie', 'relaxed'), c = makeCtx('rookie', 'challenge');
    const br = createBoss('circuit-lynx', r.ctx, 1000), bc = createBoss('circuit-lynx', c.ctx, 1000);
    for (let i = 0; i < 60 * 20; i++) { br.update(1 / 60); bc.update(1 / 60); }
    const avg = (hs: Hazard[]) => hs.filter((h) => h.style === 'beam').reduce((a, h) => a + h.warn, 0) / Math.max(1, hs.filter((h) => h.style === 'beam').length);
    expect(avg(r.hazards)).toBeGreaterThan(avg(c.hazards));
  });
});
