import { Boss, type Step } from './Boss';
import { bossStyle } from '../styles';
import { GROUND, W } from '../arenas';
import type { Hazard } from '../types';

/** Foundry: straight charges, delayed ground bursts, and a shielded stance that blocks hits until it drops. */
export class CopperComet extends Boss {
  name = 'Copper Comet';
  style = bossStyle('copper-comet');
  prefDist = 260;

  charge(rec = 1.2, burstAfter = false): Step[] {
    const t = this.T(0.9);
    let dir = 1; let h: Hazard | null = null;
    return [
      {
        state: 'telegraph', dur: t, anim: 'charge', label: 'Charge — get out of the lane!',
        enter: () => {
          this.faceTarget(); dir = this.facing; this.vx = 0;
          const end = dir > 0 ? W - 40 : 40;
          this.ctx.addHazard({ shape: 'rect', style: 'lane', x: Math.min(this.x, end), y: GROUND - 86, w: Math.abs(end - this.x), h: 86, warn: t, active: 0, dmg: 0, color: 0xff9b2f, dir });
        },
      },
      {
        state: 'attack', dur: 1.0, anim: 'dodge',
        enter: () => { this.vx = dir * 860 * this.sp; h = this.ctx.addHazard({ shape: 'rect', style: 'body', x: this.x - 28, y: GROUND - 84, w: 56, h: 84, warn: 0, active: 1, dmg: this.dmg(1.3), color: 0xff9b2f }); },
        update: () => { if (h) h.x = this.x - 28; if ((dir > 0 && this.x >= W - 40) || (dir < 0 && this.x <= 40)) { this.vx = 0; if (h) { this.ctx.removeHazard(h.id); h = null; this.ctx.shake(4); } } },
        exit: () => {
          this.vx = 0; if (h) this.ctx.removeHazard(h.id);
          if (burstAfter) this.burstAt(Math.max(60, Math.min(W - 60, this.ctx.target().x)), this.T(1.0));
        },
      },
      this.recover(rec),
    ];
  }

  burstAt(x: number, warn: number) {
    this.ctx.addHazard({ shape: 'rect', style: 'burst', x: x - 34, y: GROUND - 170, w: 68, h: 170, warn, active: 0.45, dmg: this.dmg(1.0), color: 0xff9b2f });
  }

  bursts(): Step[] {
    const t = this.T(1.3);
    return [
      {
        state: 'telegraph', dur: 0.5, anim: 'lifting', label: 'Ground bursts — leave the filling circles',
        enter: () => {
          this.vx = 0;
          const xs = [Math.max(60, Math.min(W - 60, this.ctx.target().x))];
          let guard = 0;
          while (xs.length < 3 && guard++ < 50) { const x = 60 + this.ctx.rng() * (W - 120); if (xs.every((o) => Math.abs(o - x) > 150)) xs.push(x); }
          xs.forEach((x) => this.burstAt(x, t));
          this.ctx.sound('warn');
        },
      },
      { state: 'attack', dur: t - 0.5 + 0.45, anim: 'lifting' },
    ];
  }

  private blocked = 0;
  onBlocked() { this.blocked++; }

  /** Leaps high and dives at a marked spot, leaving burning patches on the floor for a moment. */
  dive(): Step[] {
    const t = this.T(1.0);
    let lx = this.x, sx = this.x;
    return [
      {
        state: 'telegraph', dur: 0.5, anim: 'jump', label: 'Comet dive — watch the target ring!',
        enter: () => { this.vx = 0; this.vy = -980; },
      },
      {
        state: 'telegraph', dur: t, anim: 'flying',
        enter: () => {
          lx = Math.max(70, Math.min(W - 70, this.ctx.target().x)); sx = this.x;
          this.ctx.addHazard({ shape: 'circle', style: 'shadow', x: lx, y: GROUND - 10, r: 60, warn: t + 0.25, active: 0.15, dmg: this.dmg(1.2), color: 0xff9b2f });
        },
        update: () => { this.vy = 0; this.y = Math.min(this.y, 160); },
      },
      {
        state: 'attack', dur: 0.25, anim: 'rush',
        update: (_d, el) => { const f = Math.min(1, el / 0.25); this.x = sx + (lx - sx) * f; this.y = 160 + (GROUND - 160) * f; this.vy = 0; },
        exit: () => {
          this.x = lx; this.y = GROUND; this.ctx.shake(8); this.ctx.sound('hit');
          for (const dx of [-90, 0, 90]) this.ctx.addHazard({ shape: 'rect', style: 'fire', x: lx + dx - 32, y: GROUND - 34, w: 64, h: 34, warn: 0.35, active: 2.2, dmg: this.dmg(0.45), color: 0xff9b2f, repeat: 0.7 });
        },
      },
      this.recover(1.4),
    ];
  }

  /** Shield stance; punching the shield twice provokes a quick, telegraphed counter-burst. */
  shield(): Step[] {
    this.blocked = 0;
    return [
      {
        state: 'idle', dur: 2.2, anim: 'confident', label: 'Shielded — wait for it to drop!',
        enter: () => { this.vx = 0; this.shielded = true; this.blocked = 0; },
        update: () => {
          if (this.blocked >= 2) {
            this.blocked = 0;
            this.curT = 99;
            this.queue = [this.counter(), this.recover(1.3, 'Counter used — attack now!')];
          }
        },
        exit: () => { this.shielded = false; },
      },
      this.recover(1.3, 'Shield down — attack now!'),
    ];
  }
  private counter(): Step {
    const t = this.T(0.55);
    return {
      state: 'telegraph', dur: t + 0.3, anim: 'lifting', label: 'Counter! Jump or dodge away',
      enter: () => { this.shielded = false; this.ctx.addHazard({ shape: 'rect', style: 'punch', x: this.x - 110, y: GROUND - 80, w: 220, h: 80, warn: t, active: 0.25, dmg: this.dmg(0.9), color: 0xff9b2f }); this.ctx.sound('warn'); },
    };
  }
  protected antiAir() { return () => this.dive(); }

  protected pattern() {
    if (this.phase === 1) return [
      () => this.charge(),
      () => [...this.bursts(), this.recover(0.9)],
      () => this.shield(),
      () => this.dive(),
    ];
    if (this.phase === 2) return [
      // a charge combined with one delayed burst, then a clear recovery window
      () => this.charge(2.0, true),
      () => this.dive(),
      () => this.shield(),
      () => [...this.bursts(), this.recover(1.0)],
    ];
    return [
      () => [...this.charge(0.2, true), ...this.charge(2.1, true)],
      () => [...this.dive(), ...this.bursts(), this.recover(1.2)],
      () => [...this.bursts(), ...this.shield()],
    ];
  }
}
