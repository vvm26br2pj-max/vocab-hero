import { SHOP, SHOP_BY_ID } from '../config/shop';
import { BOSSES } from '../config/bosses';
import { checkBuy } from '../core/shop';
import { levelCost } from '../core/attributes';
import { REWARDS } from '../config/economy';
import type { Profile } from '../core/types';

export interface Goal { title: string; detail: string; need: number; icon: string; target: 'workshop' | 'arena' | 'mission'; tab?: string }

/** The next desirable unlock and its exact requirements. */
export function nextGoal(p: Profile): Goal {
  // 1. a won blueprint not yet bought
  for (const bp of p.blueprints) {
    const it = SHOP.find((i) => i.requires?.blueprint === bp);
    if (!it || p.owned.includes(it.id)) continue;
    const c = checkBuy(p, it.id);
    const other = c.missing.filter((m) => m !== 'points');
    if (other.length) continue;
    return { icon: '🧩', tab: 'Powers', title: it.name, need: Math.max(0, it.price - p.points), target: c.ok ? 'workshop' : 'mission',
      detail: c.ok ? `Blueprint unlocked! You can buy it now for ${it.price} coins.` : `Blueprint unlocked. Costs ${it.price} — you have ${p.points}, so ${it.price - p.points} more to go (about ${Math.ceil((it.price - p.points) / 70)} mission${it.price - p.points > 70 ? 's' : ''}).` };
  }
  // 2. an unbeaten boss with a blueprint
  const boss = BOSSES.find((b) => !p.blueprints.includes(b.blueprint));
  if (boss && !p.settings.learningOnly && p.owned.includes('power:double-jump')) {
    return { icon: '🏟️', title: `${boss.blueprintName} blueprint`, need: Math.max(0, 10 - p.points), target: 'arena', detail: `Win a battle against ${boss.name} (entry 10 coins) to unlock the ${boss.blueprintName} blueprint.` };
  }
  // 3. double jump
  if (!p.owned.includes('power:double-jump')) {
    const it = SHOP_BY_ID['power:double-jump'];
    return { icon: '🦘', tab: 'Powers', title: 'Double jump', need: Math.max(0, it.price - p.points), target: p.points >= it.price ? 'workshop' : 'mission',
      detail: p.points >= it.price ? `You can afford it! ${it.price} coins.` : `${it.price} coins — you have ${p.points}. Each correct answer earns ${REWARDS.correct}.` };
  }
  // 4. a boss blueprint fight
  if (boss && !p.settings.learningOnly) return { icon: '🏟️', title: `${boss.blueprintName} blueprint`, need: Math.max(0, 10 - p.points), target: 'arena', detail: `Win a battle against ${boss.name} (entry 10 coins).` };
  // 5. cheapest attribute level
  const keys = ['speed', 'strength', 'health', 'willpower'] as const;
  const k = keys.reduce((a, b) => (p.attributes[a] <= p.attributes[b] ? a : b));
  const cost = levelCost(p.attributes[k] + 1);
  return { icon: '📈', tab: 'Hero Profile', title: `${k[0].toUpperCase() + k.slice(1)} level ${p.attributes[k] + 1}`, need: Math.max(0, cost - p.points), target: p.points >= cost ? 'workshop' : 'mission', detail: `${cost} coins for the next level.` };
}
