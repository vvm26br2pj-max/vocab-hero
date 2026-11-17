import { Boss, type Step } from './Boss';
import { bossStyle } from '../styles';
import { GROUND, W } from '../arenas';
import type { Hazard } from '../types';

/** Rooftop: horizontal laser (low = jump, high = stay grounded), a marked dash, and a slow orb burst. */
export class CircuitLynx extends Boss {
  name = 'Circuit Lynx';
  style = bossStyle('circuit-lynx');
  prefDist = 270;
  private lastHigh = false;

  laser(high: boolean, tel = 1.0): Step[] {
    const y = high ? GROUND - 104 : GROUND - 28;
    const t = this.T(tel);
    return [
      {
        state: 'telegraph', dur: t, anim: 'power', label: high ? 'HIGH beam — stay on the ground!' : 'LOW beam — jump over it!',
        enter: () => {
          this.faceTarget(); this.vx = 0; this.ctx.sound('warn');
          const dir = this.facing;
          const x0 = dir > 0 ? this.x + 12 : 0;
          const w = dir > 0 ? W - x0 : this.x - 12;
          this.ctx.addHazard({ shape: 'rect', style: 'beam', x: x0, y: y - 10, w, h: 20, warn: t, active: 0.3, dmg: this.dmg(1.0), color: 0x38e1ff, dir, label: high ? 'HIGH' : 'LOW' });
        },
      },
      { state: 'attack', dur: 0.4, anim: 'power', enter: () => this.ctx.sound('laser') },
    ];
  }

  dash(rec = 1.4): Step[] {
    const t = this.T(0.85);
    let dir = 1; let h: Hazard | null = null;
    return [
      {
        state: 'telegraph', dur: t, anim: 'charge', label: 'Dash! Get out of the arrow lane',
        enter: () => {
          this.faceTarget(); dir = this.facing; this.vx = 0;
          const end = dir > 0 ? W - 40 : 40;
          this.ctx.addHazard({ shape: 'rect', style: 'lane', x: Math.min(this.x, end), y: GROUND - 84, w: Math.abs(end - this.x), h: 84, warn: t, active: 0, dmg: 0, color: 0x38e1ff, dir });
        },
      },
      {
        state: 'attack', dur: 1.0, anim: 'dodge',
        enter: () => { h = this.ctx.addHazard({ shape: 'rect', style: 'body', x: this.x - 26, y: GROUND - 82, w: 52, h: 82, warn: 0, active: 1.0, dmg: this.dmg(1.2), color: 0x38e1ff }); this.vx = dir * 840 * this.sp; },
        update: () => { if (h) h.x = this.x - 26; if ((dir > 0 && this.x >= W - 40) || (dir < 0 && this.x <= 40)) { this.vx = 0; if (h) { this.ctx.removeHazard(h.id); h = null; } } },
        exit: () => { this.vx = 0; if (h) this.ctx.removeHazard(h.id); },
      },
      this.recover(rec),
    ];
  }

  burst(): Step[] {
    const t = this.T(0.75);
    return [
      {
        state: 'telegraph', dur: t, anim: 'pointing', label: 'Orb burst — find a gap',
        enter: () => {
          this.faceTarget(); this.vx = 0;
          const tg = this.ctx.target();
          const ox = this.x + this.facing * 20, oy = this.y - 50;
          const base = Math.atan2((tg.y - 40) - oy, tg.x - ox);
          const n = this.ctx.tier.id === 'legendary' ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.34;
            const sp = 250 * Math.min(1.4, this.sp);
            this.ctx.addHazard({ shape: 'circle', style: 'orb', x: ox, y: oy, r: 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, warn: t, active: 5, dmg: this.dmg(0.7), color: 0x38e1ff, destroyOnHit: true });
          }
        },
      },
      { state: 'attack', dur: 0.3, anim: 'pointing', enter: () => this.ctx.sound('laser') },
    ];
  }

  /** Two drones fly over marked spots and fire vertical beams; the second targets where you move to. */
  drones(n = 2): Step[] {
    const t = this.T(1.0);
    return [
      {
        state: 'telegraph', dur: 0.4, anim: 'waving', label: 'Drones deployed — watch the floor markers',
        enter: () => { this.vx = 0; this.ctx.sound('power'); },
      },
      ...Array.from({ length: n }, (_, i): Step => ({
        state: 'attack', dur: i === n - 1 ? t + 0.3 : 0.55, anim: 'pointing',
        enter: () => {
          const x = Math.max(40, Math.min(W - 70, this.ctx.target().x - 15 + (i % 2 ? 50 : 0)));
          this.ctx.addHazard({ shape: 'rect', style: 'pillar', x, y: 0, w: 30, h: GROUND, warn: t, active: 0.35, dmg: this.dmg(0.9), color: 0x38e1ff });
        },
      })),
    ];
  }

  /** Leaps to wherever you are standing, even on a platform, with a landing marker. */
  pounce(): Step[] {
    const t = this.T(0.75);
    let lx = this.x, ly = GROUND;
    const air = 0.8;
    return [
      {
        state: 'telegraph', dur: t, anim: 'charge', label: 'Pounce! Move off the marked spot',
        enter: () => {
          this.vx = 0;
          const tg = this.ctx.target();
          lx = Math.max(60, Math.min(W - 60, tg.x)); ly = tg.y;
          this.facing = lx >= this.x ? 1 : -1;
          this.ctx.addHazard({ shape: 'rect', style: 'punch', x: lx - 40, y: ly - 80, w: 80, h: 80, warn: t + air, active: 0.2, dmg: this.dmg(1.0), color: 0x38e1ff });
        },
      },
      {
        state: 'attack', dur: air, anim: 'flying',
        enter: () => { this.flying = true; this.hoverY = 0; },
        update: (_d, el) => { const f = Math.min(1, el / air); this.x += (lx - this.x) * Math.min(1, f * 0.25 + 0.05); this.y = (1 - f) * GROUND + f * ly - Math.sin(f * Math.PI) * 120; this.vx = 0; },
        exit: () => { this.x = lx; this.y = ly; this.ctx.shake(4); },
      },
      { ...this.recover(1.3), exit: () => { this.flying = false; this.vy = 0; } },
    ];
  }
  protected antiAir() { return () => this.pounce(); }

  protected physics(dt: number) {
    if (this.flying && this.state === 'attack') { this.x = Math.max(36, Math.min(W - 36, this.x)); return; }
    if (this.flying) { this.x = Math.max(36, Math.min(W - 36, this.x)); return; }
    super.physics(dt);
  }

  protected pattern() {
    const flip = () => (this.lastHigh = !this.lastHigh);
    if (this.phase === 1) return [
      () => [...this.laser(flip()), this.idle(0.3), ...this.dash()],
      () => [...this.burst(), this.recover(0.9)],
      () => [...this.laser(flip()), ...this.dash()],
      () => [...this.drones(this.ctx.tier.id === 'rookie' ? 1 : 2), this.recover(1.0)],
    ];
    if (this.phase === 2) return [
      // alternates low and high beams with safe jump windows, then dashes with a longer recovery
      () => [...this.laser(false, 0.9), this.idle(0.55), ...this.laser(true, 0.8), this.idle(0.3), ...this.dash(1.9)],
      () => [...this.drones(2), ...this.burst(), this.recover(1.0)],
      () => [...this.burst(), this.idle(0.3), ...this.laser(flip(), 0.9), this.recover(1.0)],
    ];
    return [
      () => [...this.laser(false, 0.85), this.idle(0.45), ...this.laser(true, 0.8), this.idle(0.45), ...this.laser(false, 0.8), ...this.dash(2.0)],
      () => [...this.drones(3), ...this.dash(1.6)],
      () => [...this.burst(), this.idle(0.4), ...this.burst(), this.recover(1.1)],
    ];
  }
}
