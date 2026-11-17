import { Boss, type Step } from './Boss';
import { bossStyle } from '../styles';
import { GROUND, W } from '../arenas';
import type { Hazard } from '../types';

/** Quarry: slow Super Punches, a marked leap slam, and a floor shockwave you jump over. */
export class GraniteGlove extends Boss {
  name = 'Granite Glove';
  style = bossStyle('granite-glove');
  prefDist = 110;
  w = 50; h = 80; scale = 1.45;

  /** Rush Punch: a short, readable wind-up, then a fast lunge across a marked lane. */
  superPunch(): Step[] {
    const t = this.T(0.75);
    let dir = 1, end = this.x;
    let h: Hazard | null = null;
    return [
      {
        state: 'telegraph', dur: t, anim: 'charge', label: 'Rush Punch — leave the lane or jump!',
        enter: () => {
          this.faceTarget(); dir = this.facing; this.vx = 0; this.ctx.sound('warn');
          end = Math.max(50, Math.min(W - 50, this.x + dir * 300));
          this.ctx.addHazard({ shape: 'rect', style: 'lane', x: Math.min(this.x, end) - 20, y: GROUND - 90, w: Math.abs(end - this.x) + 40, h: 90, warn: t, active: 0, dmg: 0, color: 0xd9a441, dir });
        },
      },
      {
        state: 'attack', dur: 0.32, anim: 'rush',
        enter: () => { this.vx = dir * (Math.abs(end - this.x) / 0.3); h = this.ctx.addHazard({ shape: 'rect', style: 'body', x: this.x - 34, y: GROUND - 92, w: 68, h: 92, warn: 0, active: 0.32, dmg: this.dmg(1.35), color: 0xd9a441 }); this.ctx.sound('punch'); },
        update: () => { if (h) h.x = this.x - 34 + dir * 12; if ((dir > 0 && this.x >= end) || (dir < 0 && this.x <= end)) this.vx = 0; },
        exit: () => { this.vx = 0; if (h) this.ctx.removeHazard(h.id); this.ctx.shake(5); },
      },
      this.recover(1.2),
    ];
  }

  /** Throws a boulder in an arc (landing shadow shown), which then rolls along the floor: jump it. */
  boulder(): Step[] {
    const t = this.T(0.85);
    return [
      {
        state: 'telegraph', dur: t, anim: 'lifting', label: 'Boulder! Watch where it lands, then jump it',
        enter: () => {
          this.faceTarget(); this.vx = 0;
          const tg = this.ctx.target();
          const flight = 0.9;
          const lx = Math.max(60, Math.min(W - 60, tg.x));
          const vx = (lx - this.x) / flight;
          const vy = -(0.5 * 1100 * flight) + ((GROUND - 22) - (this.y - 110)) / flight;
          this.ctx.addHazard({ shape: 'circle', style: 'shadow', x: lx, y: GROUND - 8, r: 34, warn: t + flight, active: 0, dmg: 0, color: 0xd9a441 });
          this.ctx.addHazard({ shape: 'circle', style: 'boulder', x: this.x, y: this.y - 110, r: 22, vx: Math.sign(vx) * Math.max(160, Math.abs(vx)), vy, warn: t, active: 6, dmg: this.dmg(1.0), color: 0x7d6a58, ballistic: true });
        },
      },
      { state: 'attack', dur: 0.35, anim: 'pointing', enter: () => this.ctx.sound('punch') },
    ];
  }
  protected antiAir() { return () => [...this.boulder(), this.recover(1.0)]; }

  leapSlam(wave: boolean): Step[] {
    const t = this.T(0.65);
    let lx = this.x;
    const air = 0.93;
    return [
      {
        state: 'telegraph', dur: t, anim: 'charge', label: 'Leap slam — watch the shadow',
        enter: () => {
          this.vx = 0;
          lx = Math.max(70, Math.min(W - 70, this.ctx.target().x));
          this.facing = lx >= this.x ? 1 : -1;
          this.ctx.addHazard({ shape: 'circle', style: 'shadow', x: lx, y: GROUND - 10, r: 74, warn: t + air, active: 0.15, dmg: this.dmg(1.2), color: 0xd9a441 });
        },
      },
      {
        state: 'attack', dur: air, anim: 'jump',
        enter: () => { this.vy = -700; this.vx = (lx - this.x) / air; this.ctx.sound('jump'); },
        exit: () => {
          this.vx = 0; this.ctx.shake(8); this.ctx.sound('hit');
          if (wave) this.waves(0.3);
        },
      },
    ];
  }

  waves(warn: number) {
    const sp = 290 * Math.min(1.35, this.sp);
    for (const dir of [-1, 1]) {
      this.ctx.addHazard({ shape: 'rect', style: 'wave', x: this.x - 20, y: GROUND - 30, w: 40, h: 30, vx: dir * sp, warn, active: 4, dmg: this.dmg(0.9), color: 0xd9a441, dir });
    }
  }

  stomp(): Step[] {
    const t = this.T(0.9);
    return [
      {
        state: 'telegraph', dur: t, anim: 'lifting', label: 'Stomp! A shockwave is coming — jump it',
        enter: () => { this.vx = 0; this.ctx.addHazard({ shape: 'rect', style: 'lane', x: 0, y: GROUND - 30, w: W, h: 30, warn: t, active: 0, dmg: 0, color: 0xd9a441, dir: 0 }); },
      },
      { state: 'attack', dur: 0.3, anim: 'angry', enter: () => { this.ctx.shake(7); this.waves(0.12); } },
    ];
  }

  protected pattern() {
    if (this.phase === 1) return [
      () => this.superPunch(),
      () => [...this.leapSlam(true), this.recover(1.4)],
      () => [...this.boulder(), this.recover(1.0)],
      () => [...this.stomp(), this.recover(1.2)],
    ];
    if (this.phase === 2) return [
      // chains two slams before a longer recovery
      () => [...this.leapSlam(true), this.idle(0.35), ...this.leapSlam(true), this.recover(2.2)],
      () => [...this.boulder(), this.idle(0.3), ...this.superPunch()],
      () => this.superPunch(),
    ];
    return [
      () => [...this.leapSlam(true), this.idle(0.3), ...this.leapSlam(true), this.idle(0.3), ...this.leapSlam(false), this.recover(2.3)],
      () => [...this.boulder(), this.idle(0.2), ...this.boulder(), ...this.superPunch()],
      () => [...this.stomp(), ...this.superPunch()],
    ];
  }
}
