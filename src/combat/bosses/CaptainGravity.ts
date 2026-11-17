import { Boss, type Step } from './Boss';
import { bossStyle } from '../styles';
import { GROUND, W } from '../arenas';
import type { Hazard } from '../types';

/** Observatory: marked pull field, slow falling orbs with floor shadows, and (phase 2) alternating gravity zones with marked safe periods. */
export class CaptainGravity extends Boss {
  name = 'Captain Gravity';
  style = bossStyle('captain-gravity');
  prefDist = 240;
  private side = 0;
  constructor(...a: ConstructorParameters<typeof Boss>) { super(...a); this.flying = true; this.hoverY = 34; }

  pull(): Step[] {
    const t = this.T(1.0);
    return [
      {
        state: 'telegraph', dur: t, anim: 'lifting', label: 'Pull field — walk against the arrows!',
        enter: () => {
          this.vx = 0;
          const cx = Math.max(180, Math.min(W - 180, this.ctx.target().x + (this.ctx.rng() < 0.5 ? -40 : 40)));
          // strength stays below the slowest run speed so it can always be escaped
          this.ctx.addHazard({ shape: 'circle', style: 'zone', x: cx, y: GROUND - 34, r: 40, warn: t, active: 2.2, dmg: this.dmg(0.55), color: 0xffcf4a, repeat: 0.7, pull: { cx, cy: GROUND - 34, strength: Math.min(130, 105 * this.sp) } });
          this.ctx.sound('warn');
        },
      },
      { state: 'attack', dur: 2.2, anim: 'lifting' },
    ];
  }

  orbs(zone?: { x: number; w: number }): Step[] {
    const t = this.T(0.6);
    return [{
      state: 'telegraph', dur: t, anim: 'pointing', label: 'Energy orbs — watch the floor shadows',
      enter: () => {
        this.vx = 0;
        const xs: number[] = [];
        const lo = zone ? zone.x + 30 : 50, hi = zone ? zone.x + zone.w - 30 : W - 50;
        xs.push(Math.max(lo, Math.min(hi, this.ctx.target().x)));
        let guard = 0;
        while (xs.length < (zone ? 3 : 4) && guard++ < 50) { const x = lo + this.ctx.rng() * (hi - lo); if (xs.every((o) => Math.abs(o - x) > 120)) xs.push(x); }
        xs.forEach((x, i) => this.ctx.addHazard({ shape: 'circle', style: 'orb', x, y: 30 - i * 60, r: 16, vy: 175 * Math.min(1.3, this.sp), warn: t, active: 6, dmg: this.dmg(0.9), color: 0xffcf4a, destroyOnHit: true, gravity: 1 }));
      },
    }];
  }

  gravityShift(): Step[] {
    const t = this.T(1.3);
    this.side = 1 - this.side;
    const zone = { x: this.side ? W / 2 : 0, w: W / 2 };
    const z = { ...zone, warn: 0, on: false };
    return [
      {
        state: 'telegraph', dur: t, anim: 'lifting', label: `Heavy gravity coming on the ${this.side ? 'RIGHT' : 'LEFT'} — move to the SAFE side`,
        enter: () => { this.vx = 0; this.ctx.heavy.splice(0, this.ctx.heavy.length, z); z.warn = t; this.ctx.sound('warn'); },
        update: (_d, el) => { z.warn = Math.max(0, t - el); },
      },
      { state: 'attack', dur: 0.1, enter: () => { z.on = true; } },
      ...this.orbs(zone),
      { state: 'attack', dur: 3.2, anim: 'lifting' },
      { state: 'idle', dur: 0.1, enter: () => { this.ctx.heavy.splice(0); } },
    ];
  }

  /** Two satellites orbit the Captain while he drifts toward you: keep your distance or jump between them. */
  satellites(): Step[] {
    const t = this.T(0.7);
    const hs: Hazard[] = [];
    const R = 92, dur = 4.0;
    return [
      {
        state: 'telegraph', dur: t, anim: 'lifting', label: 'Orbiting satellites — keep your distance',
        enter: () => {
          this.vx = 0;
          for (let i = 0; i < 2; i++) hs.push(this.ctx.addHazard({ shape: 'circle', style: 'satellite', x: this.x, y: this.y - 45, r: 14, warn: t, active: dur, dmg: this.dmg(0.7), color: 0xffcf4a, repeat: 0.8 }));
        },
        update: (_d, el) => { hs.forEach((h, i) => { const a = el * 2.4 + i * Math.PI; h.x = this.x + Math.cos(a) * R * (el / t); h.y = this.y - 45 + Math.sin(a) * R * 0.75 * (el / t); }); },
      },
      {
        state: 'attack', dur, anim: 'confident',
        update: (_d, el) => {
          const tg = this.ctx.target(); const dx = tg.x - this.x;
          this.vx = Math.abs(dx) > 40 ? Math.sign(dx) * 55 * this.sp : 0; this.facing = dx >= 0 ? 1 : -1;
          hs.forEach((h, i) => { const a = (t + el) * 2.4 + i * Math.PI; h.x = this.x + Math.cos(a) * R; h.y = this.y - 45 + Math.sin(a) * R * 0.75; });
        },
        exit: () => { this.vx = 0; hs.forEach((h) => this.ctx.removeHazard(h.id)); },
      },
    ];
  }

  /** Rises up, then slams down on a marked spot, sending gold shockwaves both ways. */
  meteor(): Step[] {
    const t = this.T(1.0);
    let lx = this.x;
    return [
      {
        state: 'telegraph', dur: t, anim: 'flying', label: 'Meteor slam — leave the ring, then jump the waves',
        enter: () => { this.vx = 0; this.hoverY = 230; lx = Math.max(70, Math.min(W - 70, this.ctx.target().x)); this.ctx.addHazard({ shape: 'circle', style: 'shadow', x: lx, y: GROUND - 10, r: 70, warn: t + 0.25, active: 0.15, dmg: this.dmg(1.1), color: 0xffcf4a }); },
        update: (_d, el) => { this.x += (lx - this.x) * Math.min(1, el / t) * 0.1; },
      },
      {
        state: 'attack', dur: 0.25, anim: 'punch',
        enter: () => { this.x = lx; this.hoverY = 0; },
        exit: () => {
          this.ctx.shake(8); this.ctx.sound('hit');
          for (const dir of [-1, 1]) this.ctx.addHazard({ shape: 'rect', style: 'wave', x: this.x - 20, y: GROUND - 28, w: 40, h: 28, vx: dir * 260 * Math.min(1.3, this.sp), warn: 0.25, active: 4, dmg: this.dmg(0.8), color: 0xffcf4a, dir });
        },
      },
      { ...this.recover(1.5), exit: () => { this.hoverY = 34; } },
    ];
  }
  protected antiAir() { return () => [...this.orbs(), this.idle(1.2), this.recover(0.9)]; }

  protected pattern() {
    if (this.phase === 1) return [
      () => [...this.pull(), this.recover(1.3)],
      () => [...this.orbs(), this.idle(1.6), this.recover(1.0)],
      () => this.meteor(),
      () => [...this.satellites(), this.recover(1.1)],
    ];
    if (this.phase === 2) return [
      () => [...this.gravityShift(), this.recover(1.4)],
      () => [...this.satellites(), ...this.meteor()],
      () => [...this.pull(), this.recover(1.2)],
      () => [...this.gravityShift(), this.recover(1.4)],
    ];
    return [
      () => [...this.gravityShift(), ...this.pull(), this.recover(1.6)],
      () => [...this.satellites(), ...this.meteor()],
      () => [...this.orbs(), this.idle(0.8), ...this.meteor()],
    ];
  }
}
