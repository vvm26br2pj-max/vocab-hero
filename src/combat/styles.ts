import { registerRivalStyle, type BodyStyle } from '../art/hero';
import { BOSS_BY_ID } from '../config/bosses';

const KIND: Record<string, BodyStyle['kind']> = {
  'circuit-lynx': 'lynx', 'granite-glove': 'granite', 'frost-finch': 'finch', 'prism-moth': 'moth', 'captain-gravity': 'gravity', 'copper-comet': 'comet',
};
export function bossStyle(id: string): BodyStyle {
  const b = BOSS_BY_ID[id];
  if (!b) return { kind: 'bot', main: '#8792a8', accent: '#ffd23f', eye: '#59e3ff' };
  return { kind: KIND[id], main: b.colors.main, accent: b.colors.accent, eye: b.colors.eye };
}

// heroes can shapeshift into any rival
for (const id of Object.keys(KIND)) registerRivalStyle(id, bossStyle(id));
