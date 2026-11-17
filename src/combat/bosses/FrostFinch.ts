import { Boss, type Step } from './Boss';
import { bossStyle } from '../styles';
import { GROUND, W } from '../arenas';
import type { BattleCtx, Hazard } from '../types';

const LAYOUTS = [
  [{ x: 40, w: 170 }, { x: 410, w: 140 }, { x: 760, w: 160 }],
  [{ x: 220, w: 170 }, { x: 590, w: 160 }],
  [{ x: 110, w: 150 }, { x: 470, w: 170 }, { x: 820, w: 110 }],
];

/** Cold lab: marked slippery patches, aimed icicles (the aim line locks before firing), and a sliding charge. */
export class FrostFinch extends Boss {
  name = 'Frost Finch';
  style = bossStyle('frost-finch');
  prefDist = 260;
  private layout = 0;
  constructor(ctx: BattleCtx, hp: number) {
    super(ctx, hp);
    this.flying = true; this.hoverY = 26;
    ctx.slippery.splice(0, ctx.slippery.length, ...LAYOUTS[0]);
  }

  icicle(tel = 0.95): Step[] {
    const t = this.T(tel);
    let h: Hazard | null = null;
    return [
      {
        state: 'telegraph', dur: t, anim: 'pointing', label: 'Icicle aim — step aside when the line locks!',
        enter: () => {
          this.faceTarget(); this.vx = 0;
          const ox = this.x + this.facing * 18, oy = this.y - 52;
          const tg = this.ctx.target();
          h = this.ctx.addHazard({ shape: 'circle', style: 'icicle', x: ox, y: oy, r: 9, warn: t, active: 3, dmg: this.dmg(0.85), color: 0x4aa8ff, destroyOnHit: true, aim: { x1: ox, y1: oy, x2: tg.x, y2: tg.y - 35 } });
        },
        update: (_dt, el) => {
          if (!h || !h.aim) return;
          if (el < t * 0.65) { const tg = this.ctx.target(); h.aim.x2 = tg.x; h.aim.y2 = tg.y - 35; h.label = 'aim'; }
          else if (h.label !== 'locked') {
            h.label = 'locked'; this.ctx.sound('warn');
            const dx = h.aim.x2 - h.aim.x1, dy = h.aim.y2 - h.aim.y1, d = Math.hypot(dx, dy) || 1;
            const sp = 640 * Math.min(1.3, this.sp);
            h.vx = (dx / d) * sp; h.vy = (dy / d) * sp;
          }
        },
      },
      { state: 'attack', dur: 0.25, anim: 'pointing', enter: () => this.ctx.sound('laser') },
    ];
  }

  slide(rec = 1.4): Step[] {
    const t = this.T(0.9);
    let dir = 1; let h: Hazard | null = null;
    return [
      {
        state: 'telegraph', dur: t, anim: 'charge', label: 'Sliding charge — clear the lane!',
        enter: () => {
          this.faceTarget(); dir = this.facing; this.vx = 0; this.hoverY = 4;
          const end = dir > 0 ? W - 40 : 40;
          this.ctx.addHazard({ shape: 'rect', style: 'lane', x: Math.min(this.x, end), y: GROUND - 70, w: Math.abs(end - this.x), h: 70, warn: t, active: 0, dmg: 0, color: 0x4aa8ff, dir });
        },
      },
      {
        state: 'attack', dur: 1.0, anim: 'flying',
        enter: () => { this.vx = dir * 760 * this.sp; h = this.ctx.addHazard({ shape: 'rect', style: 'body', x: this.x - 28, y: GROUND - 66, w: 56, h: 66, warn: 0, active: 1.0, dmg: this.dmg(1.15), color: 0x4aa8ff }); },
        update: () => { if (h) h.x = this.x - 28; if ((dir > 0 && this.x >= W - 40) || (dir < 0 && this.x <= 40)) { this.vx = 0; if (h) { this.ctx.removeHazard(h.id); h = null; } } },
        exit: () => { this.vx = 0; if (h) this.ctx.removeHazard(h.id); },
      },
      { ...this.recover(rec), exit: () => { this.hoverY = 26; } },
    ];
  }

  patches(): Step[] {
    const t = this.T(1.1);
    const next = (this.layout + 1) % LAYOUTS.length;
    return [{
      state: 'telegraph', dur: t, anim: 'waving', label: 'The slippery patches are moving!',
      enter: () => {
        this.vx = 0;
        for (const z of LAYOUTS[next]) this.ctx.addHazard({ shape: 'rect', style: 'zone', x: z.x, y: GROUND - 8, w: z.w, h: 8, warn: t, active: 0, dmg: 0, color: 0xbfe9ff });
      },
      exit: () => { this.layout = next; this.ctx.slippery.splice(0, this.ctx.slippery.length, ...LAYOUTS[next]); },
    }];
  }

  protected phaseTransition(): Step[] { return [...super.phaseTransition(), ...this.patches()]; }

  /** Icicles fall in marked columns, always leaving safe gaps. */
  hail(): Step[] {
    const t = this.T(1.1);
    return [{
      state: 'telegraph', dur: t + 0.3, anim: 'flying', label: 'Hail! Stand between the shadows',
      enter: () => {
        this.vx = 0;
        const n = this.ctx.tier.id === 'rookie' ? 3 : this.phase >= 2 ? 5 : 4;
        const start = 70 + this.ctx.rng() * 120;
        const gap = (W - 140) / n;
        for (let i = 0; i < n; i++) this.ctx.addHazard({ shape: 'circle', style: 'debris', x: start + i * gap, y: GROUND - 18, r: 30, warn: t + i * 0.08, active: 0.3, dmg: this.dmg(0.8), color: 0xbfe9ff });
        this.ctx.sound('warn');
      },
    }];
  }

  /** A short cone of frost: a hit chills you (slower running for a moment). */
  breath(): Step[] {
    const t = this.T(0.8);
    return [
      {
        state: 'telegraph', dur: 0.6, anim: 'flying',
        update: () => { const tg = this.ctx.target(); const dx = tg.x - this.x; this.facing = dx >= 0 ? 1 : -1; this.vx = Math.abs(dx) > 150 ? Math.sign(dx) * 170 * this.sp : 0; },
        exit: () => { this.vx = 0; },
      },
      {
        state: 'telegraph', dur: t, anim: 'surprised', label: 'Frost breath — back away!',
        enter: () => { const x = this.facing > 0 ? this.x + 20 : this.x - 20 - 170; this.ctx.addHazard({ shape: 'rect', style: 'breath', x, y: GROUND - 70, w: 170, h: 70, warn: t, active: 0.5, dmg: this.dmg(0.5), color: 0xbfe9ff, slow: 1.6 }); },
      },
      { state: 'attack', dur: 0.5, anim: 'surprised', enter: () => this.ctx.sound('dodge') },
    ];
  }
  protected antiAir() { return () => [...this.icicle(0.8), this.recover(0.8)]; }

  protected pattern() {
    if (this.phase === 1) return [
      () => [...this.icicle(), this.recover(0.9)],
      () => this.slide(),
      () => [...this.breath(), this.recover(1.0)],
      () => [...this.hail(), this.recover(0.9)],
    ];
    if (this.phase === 2) return [
      // adds an icicle before the charge, and keeps changing which patches are slippery
      () => [...this.icicle(0.9), this.idle(0.25), ...this.slide(1.6)],
      () => [...this.patches(), ...this.hail(), this.recover(1.0)],
      () => [...this.breath(), ...this.icicle(0.9), this.recover(1.0)],
    ];
    return [
      () => [...this.icicle(0.85), this.idle(0.25), ...this.icicle(0.85), this.idle(0.25), ...this.slide(1.7)],
      () => [...this.patches(), ...this.hail(), ...this.slide(1.5)],
      () => [...this.breath(), ...this.hail(), this.recover(1.2)],
    ];
  }
}
