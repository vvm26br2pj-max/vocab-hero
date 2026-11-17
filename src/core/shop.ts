import { ATTRIBUTE_MAX } from '../config/economy';
import { SHOP_BY_ID, FREE_PALETTES, FREE_EMBLEMS, type ShopItem } from '../config/shop';
import { POWERS, POWER_LEVELS, POWER_UPGRADE_COST } from '../config/combat';
import { batchCost, levelCost, maxAdrenaline } from './attributes';
import { spend } from './rewards';
import type { AttributeKey, Profile } from './types';

export interface BuyCheck { ok: boolean; reason?: string; missing: string[] }

export function owns(p: Profile, id: string): boolean { return p.owned.includes(id); }

export function checkBuy(p: Profile, itemId: string): BuyCheck {
  const it = SHOP_BY_ID[itemId];
  const missing: string[] = [];
  if (!it) return { ok: false, reason: 'Unknown item', missing };
  if (owns(p, itemId)) return { ok: false, reason: 'Already owned', missing };
  const req = it.requires;
  if (req?.blueprint && !p.blueprints.includes(req.blueprint)) missing.push('blueprint');
  if (req?.owns && !owns(p, req.owns)) missing.push(`owns:${req.owns}`);
  if (req?.ownsAny && !req.ownsAny.some((id) => owns(p, id))) missing.push(`any:${req.ownsAny.join('|')}`);
  if (req?.willpower && p.attributes.willpower < req.willpower) missing.push(`willpower:${req.willpower}`);
  if (p.points < it.price) missing.push('points');
  return { ok: missing.length === 0, reason: missing[0], missing };
}

export function describeMissing(p: Profile, it: ShopItem, missing: string[]): string[] {
  return missing.map((m) => {
    if (m === 'blueprint') return 'Win its blueprint first';
    if (m.startsWith('owns:')) return `Own ${SHOP_BY_ID[m.slice(5)]?.name ?? m.slice(5)} first`;
    if (m.startsWith('any:')) return `Own ${m.slice(4).split('|').map((id) => SHOP_BY_ID[id]?.name ?? id).join(' or ')} first`;
    if (m.startsWith('willpower:')) {
      const need = Number(m.split(':')[1]);
      const cost = POWERS[it.id]?.cost;
      return `Needs Willpower ${need} (capacity ${maxAdrenaline(need)}${cost ? ` for a ${cost}-adrenaline move` : ''}); you have Willpower ${p.attributes.willpower}`;
    }
    if (m === 'points') return `Needs ${it.price - p.points} more coins`;
    return m;
  });
}

/** Buy an item. Idempotent per item. Does not auto-equip powers, only cosmetics if nothing is worn. */
export function buy(p: Profile, itemId: string, now = Date.now()): BuyCheck {
  const c = checkBuy(p, itemId);
  if (!c.ok) return c;
  const it = SHOP_BY_ID[itemId];
  if (!spend(p, `buy:${itemId}`, it.price, `Bought ${it.name}`, now)) return { ok: false, reason: 'points', missing: ['points'] };
  if (!p.owned.includes(itemId)) p.owned.push(itemId);
  return { ok: true, missing: [] };
}

/** Grant an item for free (learning achievements). */
export function grantFree(p: Profile, itemId: string) {
  if (!p.owned.includes(itemId)) p.owned.push(itemId);
}

export function cosmeticAvailable(p: Profile, kind: 'palette' | 'emblem' | 'mask' | 'cape' | 'gloves' | 'boots' | 'armor' | 'shape', value: string): boolean {
  if (kind === 'palette' && FREE_PALETTES.includes(value)) return true;
  if (kind === 'emblem' && FREE_EMBLEMS.includes(value)) return true;
  if (value === 'none' || value === 'basic' || value === 'hero') return true;
  return p.owned.some((id) => SHOP_BY_ID[id]?.look?.[kind] === value);
}

export interface AttrPurchase { ok: boolean; from: number; to: number; cost: number; reason?: string }

export function previewAttribute(p: Profile, key: AttributeKey, target: number): AttrPurchase {
  const from = p.attributes[key];
  const to = Math.min(ATTRIBUTE_MAX, Math.max(from, Math.floor(target)));
  const cost = batchCost(from, to);
  if (from >= ATTRIBUTE_MAX) return { ok: false, from, to: from, cost: 0, reason: 'Already at the maximum level (99)' };
  if (to === from) return { ok: false, from, to, cost: 0, reason: 'Choose a higher level' };
  if (cost > p.points) return { ok: false, from, to, cost, reason: `Needs ${cost - p.points} more coins` };
  return { ok: true, from, to, cost };
}

/** Buy attribute levels one at a time; each level has its own idempotent charge ID. */
export function buyAttribute(p: Profile, key: AttributeKey, target: number, now = Date.now()): AttrPurchase {
  const pv = previewAttribute(p, key, target);
  if (!pv.ok) return pv;
  for (let L = pv.from + 1; L <= pv.to; L++) {
    if (!spend(p, `attr:${key}:${L}`, levelCost(L), `${key} level ${L}`, now)) return { ...pv, ok: false, reason: 'Not enough coins', to: p.attributes[key] };
    p.attributes[key] = L;
  }
  return pv;
}

export type LoadoutSlot = 'active0' | 'active1' | 'movement' | 'passive';
export function equip(p: Profile, slot: LoadoutSlot, itemId: string | null): boolean {
  if (itemId) {
    const it = SHOP_BY_ID[itemId];
    if (!it || !owns(p, itemId) || it.kind !== 'power') return false;
    const want = slot.startsWith('active') ? 'active' : slot;
    if (it.slot !== want) return false;
    if (it.requires?.willpower && p.attributes.willpower < it.requires.willpower) return false;
  }
  const L = p.loadout;
  if (slot === 'active0' || slot === 'active1') {
    const i = slot === 'active0' ? 0 : 1;
    if (itemId && L.active[1 - i] === itemId) L.active[1 - i] = L.active[i];
    L.active[i] = itemId;
  } else if (slot === 'movement') L.movement = itemId;
  else L.passive = itemId;
  return true;
}

// ---------- ability upgrades ----------
export const MAX_POWER_LEVEL = POWER_LEVELS.length;
export function powerLevel(p: Profile, id: string): number { return Math.max(1, Math.min(MAX_POWER_LEVEL, p.powerLevels?.[id] ?? 1)); }
export function upgradeCost(id: string, toLevel: number): number {
  const it = SHOP_BY_ID[id];
  if (!it || toLevel < 2 || toLevel > MAX_POWER_LEVEL) return 0;
  return Math.round((it.price * POWER_UPGRADE_COST[toLevel - 1]) / 5) * 5;
}
export function checkUpgrade(p: Profile, id: string): { ok: boolean; reason?: string; cost: number; to: number } {
  const to = powerLevel(p, id) + 1;
  if (!owns(p, id)) return { ok: false, reason: 'Buy it first', cost: 0, to };
  if (to > MAX_POWER_LEVEL || !POWERS[id]) return { ok: false, reason: 'Fully upgraded', cost: 0, to: MAX_POWER_LEVEL };
  const cost = upgradeCost(id, to);
  if (p.points < cost) return { ok: false, reason: `Needs ${cost - p.points} more coins`, cost, to };
  return { ok: true, cost, to };
}
/** Idempotent per level: each upgrade level has its own charge ID. */
export function upgradePower(p: Profile, id: string, now = Date.now()): boolean {
  const c = checkUpgrade(p, id);
  if (!c.ok) return false;
  if (!spend(p, `upgrade:${id}:${c.to}`, c.cost, `Upgraded ${SHOP_BY_ID[id].name} to level ${c.to}`, now)) return false;
  p.powerLevels = { ...(p.powerLevels ?? {}), [id]: c.to };
  return true;
}
