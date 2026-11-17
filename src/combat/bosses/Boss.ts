import type { Anim, BodyStyle } from '../../art/hero';
import { MIN_TELEGRAPH, TIER_AI } from '../../config/combat';
import { GROUND, W } from '../arenas';
import type { BattleCtx } from '../types';

export type BossState = 'idle' | 'approach' | 'telegraph' | 'attack' | 'recover' | 'phase' | 'feint' | 'defeated';

export interface Step {
  state: BossState;
  dur: number;
  anim?: Anim;
  label?: string;
  enter?(): void;
  update?(dt: number, t: number): void;
  exit?(): void;
}

/**
 * Base CPU hero: a visible state machine (approach → telegraph → attack → recover, plus phase transitions).
 * Subclasses author their own moves. The enemy's stats are fixed for the whole fight.
 */
export abstract class Boss {
  x: number; y = GROUND; vx = 0; vy = 0;
  w = 40; h = 76; scale = 1.3;
  facing = -1;
  hp: number; maxHp: number;
  phase = 1; phases: number;
  state: BossState = 'idle';
  anim: Anim = 'idle';
  animT = 0;
  alpha = 1;
  flying = false;
  hoverY = 0;
  shielded = false;
  invuln = false;
  slowT = 0;
  /** frozen in ice (Ice Dash): no moves progress */
  frozenT = 0;
  hurtFlash = 0;
  protected queue: Step[] = [];
  protected cur: Step | null = null;
  protected curT = 0;
  private pendingPhase = false;
  protected moveIdx = 0;
  abstract name: string;
  abstract style: BodyStyle;
  /** Reactive AI: off for the tutorial bot and dummy. */
  smart = true;
  /** ground bosses can jump onto platforms */
  canHop = true;
  protected aiCd = 1.5;
  private threatT = 0;
  private dropT = 0;
  private lastPick = -1;
  /** Preferred horizontal distance from the target while approaching */
  prefDist = 220;

  constructor(protected ctx: BattleCtx, hp: number, x = 760) {
    this.hp = hp; this.maxHp = hp; this.x = x;
    this.phases = ctx.tier.phases;
  }

  get vulnerable() { return !this.invuln && !this.shielded && this.state !== 'defeated' && this.alpha > 0.4; }
  get stateLabel() { return this.cur?.label ?? ''; }
  protected get sp() { return this.ctx.tier.speed * (this.slowT > 0 ? 0.55 : 1); }
  /** Scaled telegraph time — never below the readable minimum. */
  protected T(s: number) { return Math.max(MIN_TELEGRAPH, s * this.ctx.tier.telegraph * this.ctx.telegraphMul); }
  /** Scaled recovery window. */
  protected R(s: number) { return s * this.ctx.tier.recovery; }
  protected dmg(mult: number) { return Math.round(this.ctx.damage * mult); }
  protected faceTarget() { const t = this.ctx.target(); this.facing = t.x >= this.x ? 1 : -1; }

  update(dt: number) {
    this.animT += dt;
    this.slowT = Math.max(0, this.slowT - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.state === 'defeated') { this.vx *= 0.9; this.physics(dt); return; }
    if (this.frozenT > 0) { this.frozenT -= dt; this.vx = 0; this.physics(dt); return; }
    const th = this.phases >= 3 ? [0.66, 0.33] : this.phases === 2 ? [0.5] : [];
    if (this.phase - 1 < th.length && this.hp / this.maxHp <= th[this.phase - 1] && !this.pendingPhase) {
      this.pendingPhase = true;
      // finish the current attack step, then transition (never strengthen mid-move)
      this.queue = [];
    }
    if (this.smart && this.state !== 'phase') this.react(dt);
    if (!this.cur || this.curT >= this.cur.dur) this.next();
    const slowDt = this.slowT > 0 ? dt * 0.7 : dt;
    this.cur!.update?.(slowDt, this.curT);
    this.curT += slowDt;
    this.physics(dt);
  }

  protected physics(dt: number) {
    if (this.flying) {
      this.x += this.vx * dt;
      const targetY = GROUND - this.hoverY + Math.sin(this.animT * 2.2) * 6;
      this.y += (targetY - this.y) * Math.min(1, dt * 6);
    } else {
      const prevY = this.y;
      this.vy += 1500 * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.dropT = Math.max(0, this.dropT - dt);
      if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; }
      else if (this.vy >= 0 && this.dropT <= 0 && this.state !== 'attack' && this.state !== 'telegraph') {
        for (const pl of this.ctx.arena.platforms) {
          if ((pl.brokenT ?? 0) > 0) continue;
          if (this.x >= pl.x - 4 && this.x <= pl.x + pl.w + 4 && prevY <= pl.y + 4 && this.y >= pl.y) { this.y = pl.y; this.vy = 0; break; }
        }
      }
      // walked off a ledge: fall
      if (this.y < GROUND && this.vy === 0 && this.state !== 'attack' && this.state !== 'telegraph' && !this.ctx.arena.platforms.some((pl) => (pl.brokenT ?? 0) <= 0 && Math.abs(this.y - pl.y) < 2 && this.x >= pl.x - 4 && this.x <= pl.x + pl.w + 4)) this.vy = 1;
    }
    this.x = Math.max(36, Math.min(W - 36, this.x));
  }

  private next() {
    this.cur?.exit?.();
    if (this.pendingPhase) {
      this.pendingPhase = false;
      this.phase++;
      this.queue = this.phaseTransition();
    }
    if (!this.queue.length) this.queue = this.plan();
    this.cur = this.queue.shift()!;
    this.curT = 0;
    this.state = this.cur.state;
    this.anim = this.cur.anim ?? (this.state === 'recover' ? 'tired' : this.state === 'telegraph' ? 'charge' : this.state === 'approach' ? 'run' : 'idle');
    this.cur.enter?.();
  }

  protected phaseTransition(): Step[] {
    return [{
      state: 'phase', dur: 1.4, anim: 'power', label: 'Phase change',
      enter: () => { this.invuln = true; this.vx = 0; this.ctx.banner(`${this.name}: Phase ${this.phase}!`); this.ctx.sound('power'); this.ctx.shake(6); },
      exit: () => { this.invuln = false; },
    }, this.idle(0.5)];
  }

  /** Approach, then one move (sometimes chained into a second at higher tiers), with an occasional readable feint. */
  protected plan(): Step[] {
    const ai = TIER_AI[this.ctx.tier.id];
    const desperate = this.hp / this.maxHp < 0.25 ? 0.25 : 0;
    const steps: Step[] = [this.approach((0.35 + this.ctx.rng() * 0.75) * (1 - ai.aggression - desperate))];
    const feintChance = this.ctx.tier.feints ? 0.25 : this.ctx.tier.id === 'challenger' || this.ctx.tier.id === 'elite' ? 0.1 : 0;
    if (this.ctx.rng() < feintChance) steps.push(this.feint());
    const first = this.nextMove();
    if (this.ctx.rng() < this.ctx.tier.comboChance + desperate && first.length > 1 && first[first.length - 1].state === 'recover') {
      const rec = first.pop()!;
      const second = this.nextMove();
      const last = second[second.length - 1];
      if (last?.state === 'recover') last.dur = Math.max(last.dur, rec.dur) * 1.15; // a combo always ends in a longer opening
      steps.push(...first, ...second);
    } else steps.push(...first);
    return steps;
  }

  /** Bosses pick moves from their phase pattern, in a readable rotation with slight variety. */
  protected abstract pattern(): (() => Step[])[];
  protected nextMove(): Step[] {
    // purposeful positioning: answer a player who camps on a platform
    const aa = this.antiAir();
    const tg = this.ctx.target();
    if (aa && tg.y < GROUND - 50 && this.ctx.rng() < (this.ctx.tier.id === 'rookie' ? 0.35 : 0.65)) return aa();
    const list = this.pattern();
    // close range: sometimes answer with a quick melee string instead of a long-range move
    const dist = Math.abs(tg.x - this.x);
    if (this.smart && dist < 120 && this.ctx.rng() < 0.35 + TIER_AI[this.ctx.tier.id].jab * 0.3) return this.closeCombo();
    let pick = Math.floor(this.ctx.rng() * list.length);
    if (pick === this.lastPick && list.length > 1) pick = (pick + 1 + Math.floor(this.ctx.rng() * (list.length - 1))) % list.length;
    this.lastPick = pick;
    return list[pick]();
  }

  protected idle(dur: number): Step { return { state: 'idle', dur, anim: 'idle', enter: () => { this.vx = 0; } }; }
  protected recover(dur: number, label = 'Recovering — attack now!'): Step {
    return { state: 'recover', dur: this.R(dur), anim: 'tired', label, enter: () => { this.vx = 0; } };
  }
  protected distJitter = 1;
  protected approach(dur: number): Step {
    return {
      state: 'approach', dur, anim: 'run',
      enter: () => { this.distJitter = 0.65 + this.ctx.rng() * 0.6; },
      update: () => {
        const t = this.ctx.target();
        const dx = t.x - this.x;
        const want = Math.abs(dx) - this.prefDist * this.distJitter;
        this.vx = Math.abs(want) < 20 ? 0 : Math.sign(dx) * Math.sign(want) * 165 * this.sp;
        const grounded = !this.flying && this.vy === 0;
        if (this.smart && this.canHop && grounded) {
          const ai = TIER_AI[this.ctx.tier.id];
          // chase onto a platform the player is standing on
          if (t.y < this.y - 40 && Math.abs(dx) < 260 && this.aiCd <= 0 && this.ctx.rng() < ai.hop) { this.vy = -760; this.vx = Math.sign(dx) * 230; this.aiCd = ai.cooldown; this.anim = 'jump'; return; }
          // drop down when the player is below
          if (this.y < GROUND - 5 && t.y > this.y + 40) { this.dropT = 0.3; this.vy = 60; }
        }
        // face the direction of travel (no moonwalking); face the target when standing still
        this.facing = this.vx !== 0 ? Math.sign(this.vx) : dx >= 0 ? 1 : -1;
        if (this.vx === 0) this.anim = 'idle'; else this.anim = 'run';
      },
      exit: () => { this.vx = 0; },
    };
  }
  protected feint(): Step {
    return {
      state: 'feint', dur: 0.7, anim: 'charge', label: 'Feint (hollow marker = fake)',
      enter: () => {
        this.vx = 0;
        this.ctx.addHazard({ shape: 'rect', style: 'feint', x: this.x - 50, y: GROUND - 90, w: 100, h: 90, warn: 0.7, active: 0, dmg: 0, color: 0xffffff });
      },
    };
  }

  // ---------- reactive AI ----------
  /** Reacts to what the player visibly does, after the tier's reaction delay. Never fires mid-attack. */
  private react(dt: number) {
    this.aiCd = Math.max(0, this.aiCd - dt);
    const th = this.ctx.playerThreat();
    this.threatT = th.attacking ? this.threatT + dt : 0;
    const interruptible = this.state === 'approach' || this.state === 'idle';
    if (!interruptible || this.aiCd > 0 || this.alpha < 0.5) return;
    const ai = TIER_AI[this.ctx.tier.id];
    const r = this.ctx.rng();
    // 1) a visible attack is coming: evade or guard
    if (this.threatT >= this.ctx.tier.reaction && th.dist < 170) {
      this.threatT = -99; // one decision per attack string
      if (r < ai.guard) return this.interrupt([this.guard()], ai.cooldown);
      if (r < ai.guard + ai.evade) return this.interrupt([this.evade(th.x)], ai.cooldown);
    }
    // 2) the player is standing in melee range: punish
    if (th.dist < 80 && Math.abs(th.y - this.y) < 60 && this.ctx.rng() < ai.jab * dt * 2.2) return this.interrupt(this.closeCombo(), ai.cooldown + 0.6);
    // 3) cornered against a wall with the player close: escape to the other side
    if ((this.x < 90 || this.x > W - 90) && th.dist < 140 && this.ctx.rng() < ai.evade * dt * 1.5) return this.interrupt([this.escape()], ai.cooldown);
  }
  private interrupt(steps: Step[], cd: number) {
    this.aiCd = cd;
    this.queue = [...steps, ...this.queue];
    if (this.cur) this.curT = this.cur.dur; // end the approach/idle step now
  }
  /** Hop or slide away from an incoming attack (no damage, clearly visible). */
  protected evade(fromX: number): Step {
    const dir = this.x >= fromX ? 1 : -1;
    return {
      state: 'approach', dur: 0.42, anim: this.flying ? 'flying' : 'dodge', label: 'Dodged!',
      enter: () => { this.facing = -dir as 1 | -1; this.vx = dir * 420 * Math.min(1.3, this.sp); if (!this.flying) this.vy = -360; },
      update: (_d, el) => { this.vx *= 0.92; if (el > 0.3) this.vx *= 0.7; },
      exit: () => { this.vx = 0; },
    };
  }
  /** A brief, clearly drawn guard that blocks hits (and gives no adrenaline). */
  protected guard(): Step {
    return { state: 'idle', dur: 0.75, anim: 'determined', label: 'Guarding!', enter: () => { this.vx = 0; this.shielded = true; this.faceTarget(); }, exit: () => { this.shielded = false; } };
  }
  /** Dash to the open side of the arena when cornered. */
  protected escape(): Step {
    const dir = this.x < W / 2 ? 1 : -1;
    return {
      state: 'approach', dur: 0.55, anim: this.flying ? 'flying' : 'jump', label: '',
      enter: () => { this.facing = dir as 1 | -1; this.vx = dir * 620 * Math.min(1.3, this.sp); if (!this.flying) this.vy = -620; },
      exit: () => { this.vx = 0; },
    };
  }
  /** Quick melee string used when the player stays too close: short (but readable) jab, optional follow-up. */
  protected closeCombo(): Step[] {
    const jab = (mult: number): Step => {
      const t = this.T(0.42);
      return {
        state: 'telegraph', dur: t + 0.18, anim: 'charge', label: 'Counter jab — back off!',
        enter: () => {
          this.faceTarget(); this.vx = 0;
          const x = this.facing > 0 ? this.x + 6 : this.x - 6 - 80;
          this.ctx.addHazard({ shape: 'rect', style: 'punch', x, y: this.y - 80, w: 80, h: 76, warn: t, active: 0.16, dmg: this.dmg(mult), color: 0xff6b6b, dir: this.facing });
        },
        update: (_d, el) => { if (el >= t) { this.anim = 'punch'; this.vx = this.facing * 120; } },
        exit: () => { this.vx = 0; },
      };
    };
    const ai = TIER_AI[this.ctx.tier.id];
    const steps = [jab(0.6)];
    if (this.ctx.rng() < ai.jab * 0.6) steps.push(jab(0.75));
    steps.push(this.recover(0.75));
    return steps;
  }

  /** Called when a player attack hits an active shield. */
  onBlocked() { /* overridden by shield users */ }
  /** A move that reaches a player standing on a platform; null if none. */
  protected antiAir(): (() => Step[]) | null { return null; }

  /** Returns true if damage was applied. */
  takeHit(dmg: number, knockback = 0): boolean {
    if (!this.vulnerable) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.hurtFlash = 0.12;
    if (knockback) this.x = Math.max(36, Math.min(W - 36, this.x + knockback));
    if (this.hp <= 0) this.defeat();
    return true;
  }
  defeat() {
    this.state = 'defeated'; this.anim = 'hurt'; this.invuln = true; this.shielded = false; this.queue = []; this.cur = { state: 'defeated', dur: 9999 };
    this.ctx.mothDecoys.forEach((d) => (d.alive = false));
  }
  /** Rect for player attacks to hit. */
  bounds() { return { x: this.x - (this.w * this.scale) / 2, y: this.y - this.h * this.scale, w: this.w * this.scale, h: this.h * this.scale }; }
}
