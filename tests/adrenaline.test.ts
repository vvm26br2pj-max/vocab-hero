import { AdrenalineMeter } from '../src/core/adrenaline';
import { maxAdrenaline } from '../src/core/attributes';
import { POWERS } from '../src/config/combat';

describe('adrenaline', () => {
  it('starts at half capacity rounded down', () => {
    expect(new AdrenalineMeter(41).value).toBe(20);
    expect(new AdrenalineMeter(maxAdrenaline(1)).value).toBe(20);
  });
  it('willpower changes capacity, never move cost', () => {
    const lo = maxAdrenaline(1), hi = maxAdrenaline(99);
    expect(hi).toBeGreaterThan(lo);
    expect(POWERS['power:super-punch'].cost).toBe(10);
    expect(POWERS['power:laser-eyes'].channel?.drainPerSec).toBe(13);
    expect(POWERS['power:chain-lightning'].channel?.drainPerSec).toBe(17);
    // every non-ultimate fits the starting meter; ultimates need Willpower 21 (80) and take ~90% of it
    for (const p of Object.values(POWERS)) if (p.minWillpower <= 1) expect(p.cost).toBeLessThanOrEqual(p.id === 'power:ice-dash' ? lo * 0.65 : lo / 2); // Ice Dash (3 s freeze) is the pricey one
    expect(new AdrenalineMeter(lo, lo).canSpend(POWERS['power:nova-storm'].cost)).toBe(false);
    expect(new AdrenalineMeter(maxAdrenaline(21), maxAdrenaline(21)).canSpend(POWERS['power:nova-storm'].cost)).toBe(true);
    expect(POWERS['power:titan-fist'].cost / maxAdrenaline(21)).toBeGreaterThan(0.85);
  });
  it('passive gain only while active, clamped', () => {
    const m = new AdrenalineMeter(40, 39);
    m.tick(0.2, false); expect(m.value).toBe(39);
    for (let i = 0; i < 20; i++) m.tick(0.25, true);
    expect(m.value).toBe(40);
  });
  it('hit rewards: once per attack, 0.4s spacing, none vs invulnerable', () => {
    const m = new AdrenalineMeter(100, 0);
    expect(m.onBasicHit('a1', 1, true)).toBe(4);
    expect(m.onBasicHit('a1', 2, true)).toBe(0);
    expect(m.onBasicHit('a2', 1.2, true)).toBe(0);
    expect(m.onBasicHit('a3', 1.5, false)).toBe(0);
    expect(m.onBasicHit('a4', 1.5, true)).toBe(4);
    expect(m.onBasicHit('a5', 3, true, false)).toBe(0); // paused / after victory
  });
  it('dodge reward once per avoided attack; spending never below zero', () => {
    const m = new AdrenalineMeter(100, 0);
    expect(m.onPerfectDodge('b1')).toBe(8);
    expect(m.onPerfectDodge('b1')).toBe(0);
    expect(m.spend(25)).toBe(false);
    expect(m.value).toBe(8);
    m.restore(30); expect(m.spend(25)).toBe(true); expect(m.value).toBe(5);
    m.restore(999); expect(m.value).toBe(100);
  });
});
