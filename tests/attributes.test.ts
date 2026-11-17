import { batchCost, levelCost, maxAdrenaline, maxHealth, speedMultiplier, strengthMultiplier, willpowerMultiplier, maxAffordableLevel } from '../src/core/attributes';
import { buyAttribute, previewAttribute } from '../src/core/shop';
import { profile } from './helpers';

describe('attribute formulas and costs', () => {
  it('derived formulas match the spec at 1 and 99', () => {
    expect(speedMultiplier(1)).toBe(1); expect(speedMultiplier(99)).toBeCloseTo(2.4);
    expect(strengthMultiplier(1)).toBe(1); expect(strengthMultiplier(99)).toBeCloseTo(3.45);
    expect(maxHealth(1)).toBe(100); expect(maxHealth(99)).toBe(688);
    expect(maxAdrenaline(1)).toBe(40); expect(maxAdrenaline(99)).toBe(236);
    expect(willpowerMultiplier(1)).toBe(1); expect(willpowerMultiplier(99)).toBeCloseTo(3.45);
  });
  it('Energy attacks scale with Willpower, Might attacks with Strength', async () => {
    const { POWERS } = await import('../src/config/combat');
    for (const id of ['laser-eyes', 'chain-lightning', 'mega-laser', 'nova-storm']) { expect(POWERS[`power:${id}`].willpowerScaled).toBe(true); expect(POWERS[`power:${id}`].strengthScaled).toBe(false); }
    for (const id of ['super-punch', 'ground-shockwave', 'meteor-punch', 'titan-fist']) { expect(POWERS[`power:${id}`].strengthScaled).toBe(true); expect(POWERS[`power:${id}`].willpowerScaled).toBeFalsy(); }
  });
  it('per-level prices follow the bands', () => {
    expect(levelCost(2)).toBe(20); expect(levelCost(10)).toBe(20); expect(levelCost(11)).toBe(40);
    expect(levelCost(25)).toBe(40); expect(levelCost(26)).toBe(70); expect(levelCost(51)).toBe(110); expect(levelCost(76)).toBe(160); expect(levelCost(99)).toBe(160);
    expect(levelCost(100)).toBe(0); expect(levelCost(1)).toBe(0);
  });
  it('1 to 99 costs 9,120 and batch preview sums each level', () => {
    expect(batchCost(1, 99)).toBe(9120);
    expect(batchCost(9, 12)).toBe(20 + 40 + 40);
  });
  it('purchases charge exactly, stop at 99, and refuse without funds', () => {
    const p = profile(); p.points = 100;
    const r = buyAttribute(p, 'speed', 5);
    expect(r.ok).toBe(true); expect(p.attributes.speed).toBe(5); expect(p.points).toBe(20);
    expect(previewAttribute(p, 'speed', 99).ok).toBe(false); // insufficient funds
    expect(p.points).toBe(20);
    p.points = 100000; buyAttribute(p, 'speed', 150);
    expect(p.attributes.speed).toBe(99);
    const before = p.points;
    expect(buyAttribute(p, 'speed', 100).ok).toBe(false);
    expect(p.points).toBe(before);
  });
  it('maxAffordableLevel respects actual band prices', () => {
    expect(maxAffordableLevel(1, 95)).toBe(5);
    expect(maxAffordableLevel(10, 39)).toBe(10);
    expect(maxAffordableLevel(10, 40)).toBe(11);
  });
});
