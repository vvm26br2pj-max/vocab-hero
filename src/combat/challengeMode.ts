// Challenge mode logic (Balloon Pop, Evade the Goo Blob, Hero Horde), plugged into BattleScene.
import type Phaser from 'phaser';
import type { BattleScene } from './BattleScene';
import { GROUND, W } from './arenas';
import { CharSprite } from './canvasArt';
import { heroShapes, type Anim } from '../art/hero';
import { PALETTES } from '../config/shop';
import { HAIR_COLORS, HAIR_STYLES, SKIN_TONES, DEFAULT_APPEARANCE } from '../core/profile';
import { CHALLENGE_BY_ID, type ChallengeId } from '../core/challenges';
import type { Appearance } from '../core/types';

interface Rect { x: number; y: number; w: number; h: number }
interface AttackLike extends Rect { t: number; armT?: number; owner: number }
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

interface Balloon { x: number; y: number; vy: number; r: number; color: number; wob: number; popped: boolean }
/** A walking character (the Goo Blob and the horde heroes). */
interface Walker {
  x: number; y: number; vy: number; onGround: boolean; face: number; anim: Anim; animT: number;
  look: Appearance; speed: number; jumpCd: number; crouchT: number; highT: number;
  powers: FoePower[]; powerCd: number; castT: number; hz: string[]; punchCd: number; alive: boolean; spawnT: number; sprite: CharSprite | null;
}
/** Horde hero powers. Aimed ones fly from the hero; sky ones land where you are standing. All are telegraphed. */
type FoePower = 'laser' | 'fireball' | 'triple' | 'ice' | 'shockwave' | 'lightning' | 'meteor' | 'titan' | 'flame' | 'boomerang';
const AIMED: FoePower[] = ['laser', 'fireball', 'triple', 'ice', 'shockwave', 'boomerang'];
const SKY: FoePower[] = ['lightning', 'meteor', 'titan', 'flame'];
const POWER_NAME: Record<FoePower, string> = { laser: 'Laser Eyes!', fireball: 'Fireball!', triple: 'Triple Fire!', ice: 'Ice Shard!', shockwave: 'Shockwave!', lightning: 'Lightning!', meteor: 'Meteor!', titan: 'Titan Stomp!', flame: 'Flame Pool!', boomerang: 'Star Boomerang!' };
/** Damage as a share of your max health, so hits matter however upgraded your hero is. */
const DMG: Record<FoePower | 'punch', number> = { punch: 0.04, laser: 0.06, fireball: 0.05, triple: 0.04, ice: 0.04, shockwave: 0.05, lightning: 0.07, meteor: 0.08, titan: 0.09, flame: 0.025, boomerang: 0.05 };
const BALLOON_COLORS = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x38bdf8, 0xa855f7, 0xec4899];

export class ChallengeRunner {
  readonly def;
  score = 0;
  won = false;
  done = false;
  private balloons: Balloon[] = [];
  private spawnAcc = 0;
  private blob: Walker | null = null;
  private walkers: Walker[] = [];
  private sprites: CharSprite[] = [];
  private noEffectT = 0;
  private boomerangs: { id: string; dir: number }[] = [];
  private rng: () => number;

  constructor(private s: BattleScene, readonly id: ChallengeId, seed: number) {
    this.def = CHALLENGE_BY_ID[id];
    let st = seed || 1;
    this.rng = () => { st = (st * 16807) % 2147483647; return (st - 1) / 2147483646; };
  }

  get target() { return this.def.target; }
  get timeLeft() { return Math.max(0, this.def.seconds - this.s.elapsed); }

  create() {
    for (let i = 0; i < 9; i++) this.sprites.push(new CharSprite(this.s, 3.8));
    if (this.id === 'evade') {
      this.blob = this.walker(820, { ...DEFAULT_APPEARANCE, shape: 'blob', palette: 'leaf-green' }, 0);
      this.blob.sprite = this.sprites[0];
    }
  }

  // ---------------- per frame ----------------
  update(dt: number) {
    if (this.done) return;
    this.noEffectT = Math.max(0, this.noEffectT - dt);
    const t = this.s.elapsed;
    switch (this.id) {
      case 'balloons': this.updateBalloons(dt, t); break;
      case 'evade': this.updateEvade(dt, t); break;
      case 'horde': this.updateHorde(dt, t); break;
    }
    if (this.done) return;
    if (this.s.hp <= 0) { const made = this.def.target > 0 && this.score >= this.def.target; return this.finish(made, made ? 'CHALLENGE COMPLETE!' : 'Knocked out!'); }
    if (t >= this.def.seconds) {
      const ok = this.def.target ? this.score >= this.def.target : true;
      this.finish(ok, ok ? 'CHALLENGE COMPLETE!' : 'Time up!');
    }
  }

  private finish(won: boolean, banner: string) {
    this.done = true; this.won = won;
    const s = this.s;
    s.ended = true; s.endTimer = 1.8; s.hazards = [];
    s.cfg.sound(won ? 'win' : 'lose');
    s.showBanner(banner);
  }

  /** Player attacks landing on challenge targets. */
  onAttack(a: AttackLike) {
    if (this.done || (a.armT && a.t < a.armT)) return;
    if (this.id === 'balloons') for (const b of this.balloons) if (!b.popped && overlap(a, { x: b.x - b.r, y: b.y - b.r * 1.15, w: b.r * 2, h: b.r * 2.3 })) this.pop(b);
    if (this.id === 'evade' && this.blob && overlap(a, this.walkerRect(this.blob)) && this.noEffectT <= 0) { this.noEffectT = 0.8; this.s.float(this.blob.x, this.blob.y - 80, 'No effect!', '#bbf7d0'); }
    if (this.id === 'horde') for (const w of this.walkers) if (w.alive && w.spawnT <= 0 && overlap(a, this.walkerRect(w))) this.defeat(w);
  }

  // ---------------- Balloon Pop ----------------
  private updateBalloons(dt: number, t: number) {
    const rate = 3.6 + 2.4 * Math.min(1, t / this.def.seconds); // ~290 balloons over the minute
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1 && t < this.def.seconds - 0.5) {
      this.spawnAcc -= 1;
      this.balloons.push({ x: 40 + this.rng() * (W - 80), y: GROUND + 40, vy: -(50 + this.rng() * 45), r: 18 + this.rng() * 7, color: BALLOON_COLORS[Math.floor(this.rng() * BALLOON_COLORS.length)], wob: this.rng() * 6, popped: false });
    }
    const pr = this.s.rectOf(this.s.F);
    for (const b of this.balloons) {
      b.y += b.vy * dt; b.x += Math.sin(t * 2 + b.wob) * 14 * dt;
      if (!b.popped && overlap(pr, { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 })) this.pop(b);
    }
    this.balloons = this.balloons.filter((b) => !b.popped && b.y > -60);
  }
  private pop(b: Balloon) {
    b.popped = true; this.score++;
    this.s.spawn('spark', b.x, b.y, 10, b.color, 0.9);
    this.s.spawn('ring', b.x, b.y, 1, 0xffffff);
    this.s.cfg.sound('pop');
    if (this.score === this.def.target) { this.s.float(this.s.px, this.s.py - 120, '100! Keep going!', '#ffe066'); this.s.cfg.sound('coin'); }
  }

  // ---------------- shared walkers ----------------
  private walker(x: number, look: Appearance, speed: number): Walker {
    return { x, y: GROUND, vy: 0, onGround: true, face: -1, anim: 'idle', animT: 0, look, speed, jumpCd: 0.8, crouchT: 0, highT: 0, powers: [], powerCd: 1.5 + this.rng() * 2, castT: 0, hz: [], punchCd: 1 + this.rng(), alive: true, spawnT: 0, sprite: null };
  }
  private walkerRect(w: Walker): Rect { return w.look.shape === 'blob' ? { x: w.x - 30, y: w.y - 62, w: 60, h: 62 } : { x: w.x - 19, y: w.y - 112, w: 38, h: 112 }; }
  /** Chain Lightning's homing target: the nearest horde hero, balloon or the Goo Blob in range. */
  nearestTarget(px: number, py: number, range: number): Rect | null {
    let best: Rect | null = null, bd = range;
    const consider = (r: Rect) => { const d = Math.hypot(r.x + r.w / 2 - px, (r.y + r.h / 2 - (py - 60)) * 0.6); if (d < bd) { bd = d; best = r; } };
    if (this.id === 'horde') for (const w of this.walkers) if (w.alive && w.spawnT <= 0) consider(this.walkerRect(w));
    if (this.id === 'balloons') for (const b of this.balloons) if (!b.popped) consider({ x: b.x - b.r, y: b.y - b.r * 1.15, w: b.r * 2, h: b.r * 2.3 });
    if (this.id === 'evade' && this.blob) consider(this.walkerRect(this.blob));
    return best;
  }
  /** Walk toward x, hop up to a hero standing higher, fall under gravity and land on the floor or platforms. */
  private stepWalker(w: Walker, dt: number, tx: number, ty: number, stopAt = 0) {
    w.animT += dt; w.jumpCd -= dt;
    const dx = tx - w.x;
    if (Math.abs(dx) > stopAt) { w.x += Math.sign(dx) * Math.min(Math.abs(dx) - stopAt, w.speed * dt); w.face = Math.sign(dx) || w.face; }
    // jump only to reach a hero who has been standing up high for a moment (never to catch a jump), after a visible crouch
    const heroHigh = this.s.onGround && ty < w.y - 60 && Math.abs(dx) < 240;
    w.highT = heroHigh ? w.highT + dt : 0;
    if (w.crouchT > 0) {
      w.crouchT -= dt; w.anim = 'crouch';
      if (w.crouchT <= 0) { w.vy = -700 - this.rng() * 120; w.onGround = false; w.jumpCd = 1.7 + this.rng() * 0.7; }
      else { w.vy = Math.min(w.vy + 1500 * dt, 900); return; }
    } else if (w.onGround && w.jumpCd <= 0 && w.highT > 0.7) { w.crouchT = 0.4; w.highT = 0; return; }
    const prevY = w.y;
    w.vy = Math.min(w.vy + 1500 * dt, 900); w.y += w.vy * dt;
    w.onGround = false;
    if (w.y >= GROUND) { w.y = GROUND; w.vy = 0; w.onGround = true; }
    else if (w.vy >= 0) for (const pl of this.s.arena.platforms) if (w.x > pl.x - 4 && w.x < pl.x + pl.w + 4 && prevY <= pl.y + 4 && w.y >= pl.y) {
      // drop through a platform when the hero is below
      if (ty > pl.y + 30) continue;
      w.y = pl.y; w.vy = 0; w.onGround = true; break;
    }
    w.x = Math.max(-40, Math.min(W + 40, w.x));
    if (w.crouchT <= 0) w.anim = !w.onGround ? (w.vy < 0 ? 'jump' : 'fall') : Math.abs(dx) > stopAt + 2 ? 'run' : 'idle';
  }
  private dmg(k: FoePower | 'punch') { return Math.max(4, Math.round(this.s.maxHp * DMG[k])); }

  // ---------------- Evade the Goo Blob ----------------
  private updateEvade(dt: number, t: number) {
    const b = this.blob!, s = this.s;
    // always a bit slower than the hero, speeding up over the minute
    b.speed = s.stats.runSpeed * (0.5 + 0.25 * Math.min(1, t / this.def.seconds));
    // wobbles awake for a few seconds, then the chase is on
    const WAKE = 3;
    if (t < WAKE) { b.animT += dt; b.anim = 'idle'; b.face = s.px < b.x ? -1 : 1; if (t >= WAKE - 1 && t - dt < WAKE - 1) s.float(b.x, b.y - 90, 'Here it comes!', '#bbf7d0'); return; }
    this.stepWalker(b, dt, s.px, s.py);
    const pr = s.rectOf(s.F); const br = this.walkerRect(b);
    const touch = overlap({ x: pr.x + 6, y: pr.y + 8, w: pr.w - 12, h: pr.h - 8 }, { x: br.x + 10, y: br.y + 12, w: br.w - 20, h: br.h - 12 }); // forgiving: only a real touch counts
    if (touch && s.dodgeInvulnT <= 0) {
      s.spawn('spark', s.px, s.py - 40, 18, 0x84cc16, 1.2);
      s.hp = Math.max(1, s.hp); // the blob doesn't hurt, it catches
      this.finish(false, 'Gooed!');
    }
  }

  // ---------------- Hero Horde ----------------
  private randomLook(): Appearance {
    const pals = Object.keys(PALETTES), pick = <T,>(a: T[]) => a[Math.floor(this.rng() * a.length)];
    return { ...DEFAULT_APPEARANCE, palette: pick(pals), skin: pick(SKIN_TONES), hair: pick(HAIR_STYLES), hairColor: pick(HAIR_COLORS),
      cape: pick(['none', 'classic', 'storm', 'short']), mask: pick(['none', 'none', 'domino', 'visor', 'cowl']), gloves: pick(['basic', 'basic', 'power']), boots: pick(['basic', 'basic', 'rocket']) };
  }
  private spawnFoe(): Walker {
    const fromTop = this.rng() < 0.35;
    const x = fromTop ? 80 + this.rng() * (W - 160) : this.rng() < 0.5 ? -30 : W + 30;
    const w = this.walker(x, this.randomLook(), 95 + this.rng() * 55);
    // every hero has an aimed power and a sky power
    w.powers = [AIMED[Math.floor(this.rng() * AIMED.length)], SKY[Math.floor(this.rng() * SKY.length)]];
    if (fromTop) { w.y = -40; w.onGround = false; }
    w.spawnT = 0.25;
    return w;
  }
  private updateHorde(dt: number, t: number) {
    const s = this.s;
    while (this.walkers.filter((w) => w.alive).length < 6 && t < this.def.seconds - 1) this.walkers.push(this.spawnFoe());
    for (const w of this.walkers) {
      if (!w.alive) continue;
      w.spawnT = Math.max(0, w.spawnT - dt);
      // spread out: each foe aims at a slightly different spot beside the hero
      const slot = (this.walkers.indexOf(w) % 3) * 14;
      const side = w.x < s.px ? -1 : 1;
      this.stepWalker(w, dt, s.px + side * (34 + slot), s.py, 4);
      w.face = s.px >= w.x ? 1 : -1;
      w.punchCd -= dt;
      const close = Math.abs(w.x - s.px) < 64 && Math.abs(w.y - s.py) < 40;
      if (close && w.punchCd <= 0 && w.onGround) {
        w.punchCd = 1.6 + this.rng() * 1.2;
        const x = w.face > 0 ? w.x + 6 : w.x - 66;
        s.addHazard({ shape: 'rect', style: 'punch', x, y: w.y - 70, w: 60, h: 48, warn: 0.5, active: 0.14, dmg: this.dmg('punch'), color: 0xff4d4d, dir: w.face });
        w.anim = 'charge'; w.animT = 0;
      }
      if (w.punchCd > 1.45 && w.punchCd < 1.6) w.anim = 'punch';
      // powers: aimed ones from mid range, sky ones from anywhere (but only a couple of sky attacks at once)
      w.powerCd -= dt; w.castT = Math.max(0, w.castT - dt);
      const dist = Math.abs(s.px - w.x);
      if (w.powerCd <= 0 && w.onGround && w.spawnT <= 0 && w.x > 10 && w.x < W - 10) {
        const canAim = dist > 100 && dist < 480 && Math.abs(s.py - w.y) < 150;
        const skyBusy = s.hazards.filter((h) => h.t < h.warn && (h.style === 'pillar' || h.style === 'debris' || h.style === 'burst' || h.style === 'fire')).length >= 2;
        const options = w.powers.filter((pw) => (AIMED.includes(pw) ? canAim : !skyBusy));
        if (options.length) { this.castPower(w, options[Math.floor(this.rng() * options.length)]); w.powerCd = 2.2 + this.rng() * 1.6; w.castT = 0.55; }
      }
      if (w.castT > 0) w.anim = 'power';
      w.hz = w.hz.filter((id) => s.hazards.some((h) => h.id === id));
    }
    // star boomerangs slow down, turn around and come back
    for (const b of this.boomerangs) { const h = s.hazards.find((x) => x.id === b.id); if (h && h.t >= h.warn) h.vx -= b.dir * 700 * dt; }
    this.boomerangs = this.boomerangs.filter((b) => s.hazards.some((h) => h.id === b.id));
    this.walkers = this.walkers.filter((w) => w.alive);
  }
  /** A horde hero's power, telegraphed like the arena rivals' attacks. */
  private castPower(w: Walker, pw: FoePower) {
    const s = this.s, dir = s.px >= w.x ? 1 : -1, hx = w.x + dir * 26, hy = w.y - 58;
    w.face = dir;
    const ids: string[] = [];
    const add = (h: Parameters<BattleScene['addHazard']>[0]) => ids.push(s.addHazard(h).id);
    const px = Math.max(40, Math.min(W - 40, s.px));
    switch (pw) {
      case 'laser': { const len = 440; add({ shape: 'rect', style: 'beam', x: dir > 0 ? w.x + 12 : w.x - 12 - len, y: w.y - 83, w: len, h: 18, warn: 0.7, active: 0.3, dmg: this.dmg(pw), color: 0x38e1ff, dir, label: 'LOW' }); break; }
      case 'fireball': add({ shape: 'circle', style: 'orb', x: hx, y: hy, r: 13, vx: dir * 360, warn: 0.45, active: 3, dmg: this.dmg(pw), color: 0xff7a1a, destroyOnHit: true }); break;
      case 'triple': for (const vy of [-150, 0, 150]) add({ shape: 'circle', style: 'orb', x: hx, y: hy, r: 10, vx: dir * 320, vy, warn: 0.55, active: 2.5, dmg: this.dmg(pw), color: 0xf43f5e, destroyOnHit: true }); break;
      case 'ice': add({ shape: 'circle', style: 'orb', x: hx, y: hy, r: 11, vx: dir * 320, vy: (s.py - 50 - hy) * 0.6, warn: 0.45, active: 3, dmg: this.dmg(pw), color: 0x9be7ff, destroyOnHit: true, slow: 1.5 }); break;
      case 'shockwave': add({ shape: 'rect', style: 'wave', x: w.x - 20, y: GROUND - 28, w: 40, h: 28, vx: dir * 320, warn: 0.4, active: 3, dmg: this.dmg(pw), color: 0xffcf4a, dir }); break;
      case 'boomerang': {
        // a spinning star that flies out and curves back
        const h = s.addHazard({ shape: 'circle', style: 'satellite', x: hx, y: hy, r: 12, vx: dir * 520, warn: 0.4, active: 2.2, dmg: this.dmg(pw), color: 0xfacc15 });
        ids.push(h.id); this.boomerangs.push({ id: h.id, dir }); break;
      }
      case 'lightning': add({ shape: 'rect', style: 'pillar', x: px - 30, y: 0, w: 60, h: GROUND, warn: 0.85, active: 0.35, dmg: this.dmg(pw), color: 0xc4b5fd }); break;
      case 'meteor': add({ shape: 'circle', style: 'debris', x: px, y: GROUND - 18, r: 36, warn: 1.0, active: 0.3, dmg: this.dmg(pw), color: 0xff7a1a }); break;
      case 'titan': add({ shape: 'rect', style: 'burst', x: px - 60, y: GROUND - 190, w: 120, h: 190, warn: 1.0, active: 0.4, dmg: this.dmg(pw), color: 0xf59e0b }); break;
      case 'flame': add({ shape: 'rect', style: 'fire', x: px - 55, y: GROUND - 44, w: 110, h: 44, warn: 0.8, active: 2.2, dmg: this.dmg(pw), color: 0xff6a1a, repeat: 0.6 }); break;
    }
    w.hz.push(...ids);
    s.float(w.x, w.y - 112, POWER_NAME[pw], pw === 'laser' || pw === 'ice' ? '#9be7ff' : pw === 'lightning' ? '#ddd6fe' : '#ffd36e');
    s.spawn('spark', hx, hy, 6, pw === 'laser' || pw === 'ice' ? 0x38e1ff : pw === 'lightning' ? 0xc4b5fd : 0xffb347, 0.6);
    s.cfg.sound('power');
  }
  private defeat(w: Walker) {
    w.alive = false; this.score++;
    const s = this.s;
    s.spawn('spark', w.x, w.y - 44, 14, 0xffd23f, 1.2); s.spawn('dust', w.x, w.y - 30, 6, 0xffffff); s.spawn('ring', w.x, w.y - 44, 1, 0xffffff);
    s.cfg.sound('hit');
    s.float(w.x, w.y - 100, `${this.score}`, '#ffe066');
    // cancel any punch or power it was still winding up
    s.hazards = s.hazards.filter((h) => !(h.t < h.warn && (w.hz.includes(h.id) || (h.style === 'punch' && Math.abs(h.x + h.w / 2 - w.x) < 70))));
  }

  // ---------------- drawing ----------------
  render(g: Phaser.GameObjects.Graphics) {
    const s = this.s, ph = s.elapsed;
    let used = 0;
    const drawW = (w: Walker, alpha = 1) => {
      const sp = w.sprite ?? this.sprites[used++];
      if (!sp) return;
      sp.draw(heroShapes(w.look, w.anim, w.anim === 'run' ? w.animT * 1.3 : w.animT), w.x, w.y, w.face, 1.3, { alpha: w.spawnT > 0 ? 0.5 : alpha });
    };
    if (this.id === 'balloons') {
      for (const b of this.balloons) {
        g.lineStyle(1.5, 0xffffff, 0.7); g.lineBetween(b.x, b.y + b.r, b.x + Math.sin(ph * 3 + b.wob) * 5, b.y + b.r + 30);
        g.fillStyle(b.color, 1); g.fillEllipse(b.x, b.y, b.r * 2, b.r * 2.3);
        g.lineStyle(2, 0x1b1446, 0.9); g.strokeEllipse(b.x, b.y, b.r * 2, b.r * 2.3);
        g.fillStyle(0xffffff, 0.55); g.fillEllipse(b.x - b.r * 0.35, b.y - b.r * 0.5, b.r * 0.5, b.r * 0.8);
        g.fillStyle(b.color, 1); g.fillTriangle(b.x - 4, b.y + b.r * 1.15 + 4, b.x + 4, b.y + b.r * 1.15 + 4, b.x, b.y + b.r * 1.1);
      }
    }
    if (this.id === 'evade' && this.blob) {
      const b = this.blob;
      g.fillStyle(0x65a30d, 0.25); g.fillEllipse(b.x, b.y + 2, 70, 12);
      if (Math.random() < 0.25 && !s.paused) { s.ambientSpawn = true; s.spawn('dust', b.x + (Math.random() - 0.5) * 40, b.y - 4, 1, 0x84cc16); s.ambientSpawn = false; }
      b.sprite!.draw(heroShapes(b.look, b.anim, b.animT), b.x, b.y, b.face, 1.45, {});
      used = 1;
    }
    if (this.id === 'horde') for (const w of this.walkers) if (w.alive) drawW(w);
    for (let i = used; i < this.sprites.length; i++) this.sprites[i].hide();
  }

  /** Developer: jump to the last seconds, optionally with the target already reached. */
  devSkip(win: boolean) { if (win && this.def.target) this.score = Math.max(this.score, this.def.target); this.s.elapsed = Math.max(this.s.elapsed, this.def.seconds - 2); }

  /** Top-centre HUD line. */
  hudText(): string {
    const left = Math.ceil(this.timeLeft), clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (this.id === 'balloons') return `🎈 ${this.score} / ${this.target}   ·   ${clock}`;
    if (this.id === 'horde') return `🦸 ${this.score} / ${this.target} defeated   ·   ${clock}`;
    return `Survive ${clock}`;
  }
}
