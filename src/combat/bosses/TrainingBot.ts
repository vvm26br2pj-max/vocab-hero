import { Boss, type Step } from './Boss';
import { bossStyle } from '../styles';
import { GROUND } from '../arenas';
import type { BattleCtx } from '../types';

/** Tutorial sparring bot (one slow, clearly marked swipe) and the training dummy (never attacks). */
export class TrainingBot extends Boss {
  name: string;
  style = bossStyle('bot');
  prefDist = 130;
  constructor(ctx: BattleCtx, hp: number, private dummy: boolean, x = 640) {
    super(ctx, hp, x);
    this.phases = 1;
    this.smart = false;
    this.name = dummy ? 'Training Dummy' : 'Sparring Bot';
  }
  swipe(): Step[] {
    const t = this.T(1.5);
    return [
      {
        state: 'telegraph', dur: t, anim: 'charge', label: 'Red marker: jump or dodge!',
        enter: () => { this.faceTarget(); this.vx = 0; const x = this.facing > 0 ? this.x + 10 : this.x - 130; this.ctx.addHazard({ shape: 'rect', style: 'punch', x, y: GROUND - 60, w: 120, h: 60, warn: t, active: 0.25, dmg: 6, color: 0xff4d4d, dir: this.facing }); },
      },
      { state: 'attack', dur: 0.3, anim: 'punch' },
      this.recover(2.2, 'Recovering — punch now!'),
    ];
  }
  protected plan(): Step[] { return this.dummy ? [this.idle(1)] : [this.approach(1.2), ...this.swipe()]; }
  protected pattern() { return [() => this.swipe()]; }
  takeHit(dmg: number, kb = 0): boolean {
    const ok = super.takeHit(dmg, this.dummy ? 0 : kb);
    if (this.dummy && this.hp <= 0) { this.hp = this.maxHp; this.state = 'idle'; this.invuln = false; this.queue = []; this.cur = null; }
    return ok;
  }
}
