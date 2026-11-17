import type { BattleCtx } from '../types';
import type { Boss } from './Boss';
import { CircuitLynx } from './CircuitLynx';
import { GraniteGlove } from './GraniteGlove';
import { FrostFinch } from './FrostFinch';
import { PrismMoth } from './PrismMoth';
import { CaptainGravity } from './CaptainGravity';
import { CopperComet } from './CopperComet';
import { TrainingBot } from './TrainingBot';

export function createBoss(id: string, ctx: BattleCtx, hp: number): Boss {
  switch (id) {
    case 'circuit-lynx': return new CircuitLynx(ctx, hp);
    case 'granite-glove': return new GraniteGlove(ctx, hp);
    case 'frost-finch': return new FrostFinch(ctx, hp);
    case 'prism-moth': return new PrismMoth(ctx, hp);
    case 'captain-gravity': return new CaptainGravity(ctx, hp);
    case 'copper-comet': return new CopperComet(ctx, hp);
    case 'dummy': return new TrainingBot(ctx, hp, true, 220);
    default: return new TrainingBot(ctx, hp, false);
  }
}
export type { Boss };
