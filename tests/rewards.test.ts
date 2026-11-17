import { award, spend } from '../src/core/rewards';
import { buy, checkBuy, equip, upgradePower, checkUpgrade, powerLevel } from '../src/core/shop';
import { profile } from './helpers';

describe('rewards and purchases', () => {
  it('awards are idempotent', () => {
    const p = profile();
    expect(award(p, 'x', 5, 'r')).toBe(5);
    expect(award(p, 'x', 5, 'r')).toBe(0);
    expect(p.points).toBe(30);
  });
  it('spends are idempotent and never go negative', () => {
    const p = profile();
    expect(spend(p, 'c1', 10, 'r')).toBe(true);
    expect(spend(p, 'c1', 10, 'r')).toBe(true);
    expect(p.points).toBe(15);
    expect(spend(p, 'c2', 100, 'r')).toBe(false);
    expect(p.points).toBe(15);
  });
  it('starts with 25 points and can buy a 25-point cosmetic', () => {
    const p = profile();
    expect(p.points).toBe(25);
    expect(buy(p, 'emblem:bolt').ok).toBe(true);
    expect(p.points).toBe(0);
    expect(buy(p, 'emblem:bolt').ok).toBe(false); // already owned, no double charge
    expect(p.points).toBe(0);
  });
  it('blueprint powers require the blueprint; Hover (triple-jump ID) requires double jump', () => {
    const p = profile(); p.points = 1000;
    expect(checkBuy(p, 'power:laser-eyes').missing).toContain('blueprint');
    p.blueprints.push('bp:triple-jump');
    expect(checkBuy(p, 'power:triple-jump').missing).toContain('owns:power:double-jump');
    expect(buy(p, 'power:double-jump').ok).toBe(true);
    expect(buy(p, 'power:triple-jump').ok).toBe(true);
  });
  it('variants need willpower capacity before purchase', () => {
    const p = profile(); p.points = 2000; p.blueprints.push('bp:laser-eyes', 'bp:chain-lightning', 'bp:mega-laser', 'bp:nova-storm');
    buy(p, 'power:laser-eyes'); buy(p, 'power:chain-lightning');
    expect(buy(p, 'power:mega-laser').ok).toBe(true); // Flame Blast: no Willpower needed
    expect(checkBuy(p, 'power:nova-storm').missing).toContain('willpower:21');
    p.attributes.willpower = 21;
    expect(buy(p, 'power:nova-storm').ok).toBe(true);
  });
  it('equip enforces slots and ownership', () => {
    const p = profile(); p.points = 1000; p.blueprints.push('bp:laser-eyes');
    expect(equip(p, 'active0', 'power:laser-eyes')).toBe(false);
    buy(p, 'power:laser-eyes'); buy(p, 'power:double-jump');
    expect(equip(p, 'movement', 'power:laser-eyes')).toBe(false);
    expect(equip(p, 'active0', 'power:laser-eyes')).toBe(true);
    expect(equip(p, 'active1', 'power:laser-eyes')).toBe(true);
    expect(p.loadout.active.filter((x) => x === 'power:laser-eyes').length).toBe(1);
    expect(equip(p, 'movement', 'power:double-jump')).toBe(true);
  });

  it('ability tree: each ability needs the one above it (Motion: Double Jump → Hover → Ice Dash → Super Speed)', () => {
    const p = profile(); p.points = 5000; p.blueprints.push('bp:super-punch', 'bp:ground-shockwave', 'bp:gravity-burst', 'bp:ice-dash', 'bp:triple-jump');
    expect(checkBuy(p, 'power:ground-shockwave').missing).toContain('owns:power:super-punch');
    expect(checkBuy(p, 'power:gravity-burst').missing).toContain('owns:power:ice-dash');
    buy(p, 'power:double-jump');
    expect(checkBuy(p, 'power:ice-dash').missing).toContain('owns:power:triple-jump');
    buy(p, 'power:triple-jump'); buy(p, 'power:ice-dash');
    expect(buy(p, 'power:gravity-burst').ok).toBe(true);
  });
  it('ability upgrades: two levels, priced, idempotent, capped', () => {
    const p = profile(); p.points = 1000; p.blueprints.push('bp:laser-eyes');
    expect(checkUpgrade(p, 'power:laser-eyes').ok).toBe(false);
    buy(p, 'power:laser-eyes');
    const before = p.points;
    expect(upgradePower(p, 'power:laser-eyes')).toBe(true);
    expect(powerLevel(p, 'power:laser-eyes')).toBe(2);
    expect(before - p.points).toBe(75);
    expect(upgradePower(p, 'power:laser-eyes')).toBe(true);
    expect(powerLevel(p, 'power:laser-eyes')).toBe(3);
    const after = p.points;
    expect(upgradePower(p, 'power:laser-eyes')).toBe(false);
    expect(p.points).toBe(after);
  });
});
