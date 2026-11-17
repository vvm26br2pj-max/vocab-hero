import { Boss, type Step } from './Boss';
import { bossStyle } from '../styles';
import { GROUND, W } from '../arenas';

/** Neon theater: decoys (only the real Moth casts a floor shadow), a fan of light, and a marked teleport strike. */
export class PrismMoth extends Boss {
  name = 'Prism Moth';
  style = bossStyle('prism-moth');
  prefDist = 250;
  constructor(...a: ConstructorParameters<typeof Boss>) { super(...a); this.flying = true; this.hoverY = 16; }

  decoys(n: number): Step[] {
    const t = this.T(0.7);
    return [{
      state: 'telegraph', dur: t, anim: 'excited', label: `${n} decoys! The real Moth has a shadow`,
      enter: () => { this.vx = 0; this.ctx.sound('power'); },
      exit: () => {
        const slots = [140, 330, 630, 820].sort(() => this.ctx.rng() - 0.5).slice(0, n + 1);
        this.ctx.mothDecoys.splice(0);
        slots.slice(1).forEach((x) => this.ctx.mothDecoys.push({ x, y: GROUND - this.hoverY, t: 0, life: 9, alive: true }));
        this.x = slots[0];
      },
    }];
  }

  fan(): Step[] {
    const t = this.T(0.85);
    return [
      {
        state: 'telegraph', dur: t, anim: 'surprised', label: 'Fan of light — stand in a gap',
        enter: () => {
          this.faceTarget(); this.vx = 0;
          const tg = this.ctx.target();
          const ox = this.x, oy = this.y - 50;
          const base = Math.atan2(tg.y - 35 - oy, tg.x - ox);
          const n = this.ctx.tier.id === 'legendary' ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.24;
            const sp = 300 * Math.min(1.35, this.sp);
            this.ctx.addHazard({ shape: 'circle', style: 'orb', x: ox, y: oy, r: 9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, warn: t, active: 4, dmg: this.dmg(0.7), color: 0xff7ce0, destroyOnHit: true });
          }
        },
      },
      { state: 'attack', dur: 0.3, anim: 'excited', enter: () => this.ctx.sound('laser') },
    ];
  }

  teleport(rec = 1.3): Step[] {
    const t = this.T(0.9);
    let dx = 0;
    return [
      { state: 'telegraph', dur: 0.35, anim: 'sneaky', label: 'Teleporting…', enter: () => { this.vx = 0; this.invuln = true; }, update: (_d, el) => { this.alpha = 1 - el / 0.35; } },
      {
        state: 'telegraph', dur: t, anim: 'sneaky', label: 'Teleport strike — leave the glowing ring!',
        enter: () => {
          dx = Math.max(60, Math.min(W - 60, this.ctx.target().x));
          this.alpha = 0;
          this.ctx.addHazard({ shape: 'circle', style: 'shadow', x: dx, y: GROUND - 8, r: 62, warn: t, active: 0.22, dmg: this.dmg(1.1), color: 0xff7ce0 });
        },
      },
      { state: 'attack', dur: 0.3, anim: 'punch', enter: () => { this.x = dx; this.alpha = 1; this.invuln = false; this.ctx.shake(5); this.ctx.consumePlayerDecoy(); } },
      this.recover(rec),
    ];
  }

  /** Light pillars sweep across the stage; dodge through them or stay ahead. */
  sweep(): Step[] {
    const t = this.T(1.0);
    return [
      {
        state: 'telegraph', dur: t, anim: 'lifting', label: 'Light sweep — dodge through the pillar!',
        enter: () => {
          this.vx = 0;
          const n = this.phase >= 2 && this.ctx.tier.id !== 'rookie' ? 2 : 1;
          const fromLeft = this.ctx.target().x > W / 2;
          for (let i = 0; i < n; i++) {
            const x = fromLeft ? 20 + i * 330 : W - 50 - i * 330;
            this.ctx.addHazard({ shape: 'rect', style: 'pillar', x, y: 0, w: 28, h: GROUND, vx: (fromLeft ? 1 : -1) * 170 * Math.min(1.3, this.sp), warn: t, active: 4.2, dmg: this.dmg(0.8), color: 0xff7ce0 });
          }
          this.ctx.sound('laser');
        },
      },
      { state: 'attack', dur: 1.6, anim: 'lifting' },
    ];
  }
  protected antiAir() { return () => this.teleport(1.2); }

  protected pattern() {
    if (this.phase === 1) return [
      () => [...this.fan(), this.recover(0.9)],
      () => this.teleport(),
      () => [...this.decoys(2), ...this.fan(), this.recover(1.0)],
      () => [...this.sweep(), this.recover(1.0)],
    ];
    if (this.phase === 2) return [
      () => [...this.decoys(3), this.idle(0.4), ...this.teleport(1.4)],
      () => [...this.sweep(), ...this.fan(), this.recover(0.9)],
      () => [...this.decoys(3), ...this.fan(), this.recover(1.0)],
    ];
    return [
      () => [...this.decoys(3), ...this.fan(), this.idle(0.3), ...this.teleport(1.5)],
      () => [...this.sweep(), ...this.teleport(1.3)],
      () => [...this.teleport(0.6), ...this.teleport(1.4)],
    ];
  }
}
