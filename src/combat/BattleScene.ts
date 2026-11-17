import Phaser from 'phaser';
import { heroShapes, figureShapes, heroPortrait, portraitShapes, type Anim } from '../art/hero';
import { ADRENALINE, DIFFICULTY, HOVER_TIME, PLAYER, POWERS, POWER_LEVELS, SHIELD, SUPER_SPEED, TIER_STATS, type CombatDifficulty, type TierId } from '../config/combat';
import { SHOP_BY_ID } from '../config/shop';
import { BOSS_BY_ID } from '../config/bosses';
import { AdrenalineMeter } from '../core/adrenaline';
import { derivedStats } from '../core/attributes';
import type { Appearance, Attributes, CombatSnapshot, LoadoutState } from '../core/types';
import { ARENAS, GROUND, H, W, type ArenaDef, type Platform } from './arenas';
import { createBoss, type Boss } from './bosses';
import { chevrons, drawShapes, stripes, safeZone } from './draw';
import { CharSprite } from './canvasArt';
import { paintArena } from './backgrounds';
import fxPow from '../assets/fx/pow.webp';
import fxBop from '../assets/fx/bop.webp';
import fxBam from '../assets/fx/bam.webp';
import fxZap from '../assets/fx/zap.webp';
import fxWham from '../assets/fx/wham.webp';
import fxBonk from '../assets/fx/bonk.webp';

const COMIC: Record<string, string> = { pow: fxPow, bop: fxBop, bam: fxBam, zap: fxZap, wham: fxWham, bonk: fxBonk };
const PUNCH_WORDS = ['pow', 'bop', 'bam', 'wham', 'bonk'];
/** Comic hit bubbles are slightly see-through so the action stays visible. */
const COMIC_ALPHA = 0.7;
import { pollGamepads } from './input';
import { Fighter, FIGHTER_KEYS, type Clone, type PlayerCfg } from './fighter';
import type { BattleCtx, Decoy, Hazard } from './types';
import { ChallengeRunner } from './challengeMode';
import { CHALLENGE_BY_ID, type ChallengeId } from '../core/challenges';

export type BattleMode = 'trial' | 'practice' | 'tutorial' | 'training' | 'challenge';
export interface BattleConfig {
  mode: BattleMode;
  appearance: Appearance;
  attributes: Attributes;
  loadout: LoadoutState;
  difficulty: CombatDifficulty;
  bossId: string;          // 'tutorial' | 'dummy' | boss id
  tier: TierId;
  enemyHp: number;
  enemyDamage: number;
  seed: number;
  snapshot: CombatSnapshot | null;
  shieldBonus: boolean;
  demoPower?: string;
  powerLevels: Record<string, number>;
  /** local multiplayer: two heroes in versus or co-op */
  multi?: 'versus' | 'coop';
  /** Challenges mode: which challenge to run */
  challenge?: ChallengeId;
  players?: PlayerCfg[];
  arenaKey?: string;
  /** online room play: the host simulates, the guest mirrors */
  online?: { role: 'host' | 'guest'; localIndex: number };
  onNet?: (state: NetState) => void;
  /** snapshots per second sent to the guest (lower through a relay) */
  netHz?: number;
  reducedMotion: boolean;
  sound: (name: string) => void;
  onEnd: (r: { won: boolean; seconds: number; winner?: number; score?: [number, number] }) => void;
  onHud: (h: HudState) => void;
}
export interface NetState { [k: string]: unknown }
export interface PowerHud { id: string; name: string; cost: number; ready: boolean; cdFrac: number; affordable: boolean; capacityOk: boolean }
export interface HudState { powers: (PowerHud | null)[]; move: PowerHud | null; coach: string; demoLeft: number }

function mulberry(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function circleRect(cx: number, cy: number, r: number, b: { x: number; y: number; w: number; h: number }) {
  const nx = Math.max(b.x, Math.min(cx, b.x + b.w)), ny = Math.max(b.y, Math.min(cy, b.y + b.h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}
/** Player sprite scale in battle (hitbox in playerRect matches). */
const PS = 1.3;
const TXT = { fontFamily: 'Nunito, sans-serif', fontStyle: '900', color: '#ffffff', stroke: '#1b1446', strokeThickness: 5 } as const;

interface Particle { kind: 'spark' | 'dust' | 'streak' | 'ring' | 'ember' | 'snow' | 'twinkle' | 'flame' | 'frost'; x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number }
interface PlayerAttack {
  owner: number; hitSet?: number[]; id: string; x: number; y: number; w: number; h: number; t: number; life: number; dmg: number; basic: boolean; kb: number; hit: boolean; vx?: number;
  style: 'punch' | 'beam' | 'wave' | 'blast' | 'dash' | 'rush' | 'titan' | 'bolt' | 'duck' | 'slam' | 'power' | 'fire' | 'boom' | 'burn' | 'nova' | 'phase' | 'meteor' | 'crater' | 'spike' | 'glove';
  /** lingering attacks can hit again after this many seconds */
  rehit?: number; lastHit?: number;
  /** harmless until this time (Titan Fist falling from the sky) */
  armT?: number;
  /** Titan Fist target x; Flame Blast explosion damage */
  tx?: number; boom?: number; done?: boolean; vy?: number;
  /** attacks in one group hit each target only once (a line of shockwave spikes) */
  group?: string;
  /** Super Punch glove: how far the spring reaches */
  reach?: number;
  /** Ice Dash: freezes what it hits */
  freeze?: number;
}
interface Decal { kind: 'crater' | 'ice' | 'scorch' | 'crack'; x: number; y: number; w: number; life: number; max: number }
const ALL_KEYS = ['jump', 'dodge', 'punch', 'power1', 'power2', 'move'] as const;

function add2(sc: BattleScene, o: Omit<PlayerAttack, 'owner' | 'id' | 't' | 'hit'>) { sc.attacks.push({ owner: sc.cur.index, id: `pw${++sc.attackSeq}`, t: 0, hit: false, ...o }); }

export class BattleScene extends Phaser.Scene {
  cfg!: BattleConfig;
  arena!: ArenaDef;
  g!: Phaser.GameObjects.Graphics;
  bg!: Phaser.GameObjects.Graphics;
  hud!: Phaser.GameObjects.Graphics;
  ptexts: { hp: Phaser.GameObjects.Text; adr: Phaser.GameObjects.Text }[] = [];
  tags: Phaser.GameObjects.Text[] = [];
  texts: { boss: Phaser.GameObjects.Text; bossState: Phaser.GameObjects.Text; banner: Phaser.GameObjects.Text; timer: Phaser.GameObjects.Text; info: Phaser.GameObjects.Text } = null!;
  floats: { t: Phaser.GameObjects.Text; life: number; vy: number }[] = [];
  paused = false;
  ended = false;
  endTimer = 0;
  intro = 1.2;
  elapsed = 0;
  shakeAmt = 0;
  bannerT = 0;
  // player state lives on Fighter objects; these read/write the active fighter (see FIGHTER_KEYS)
  declare px: number; declare py: number; declare pvx: number; declare pvy: number; declare facing: number; declare onGround: boolean; declare jumpsUsed: number; declare maxJumps: number;
  declare standing: Platform | null; declare dropT: number; declare hp: number; declare maxHp: number; declare meter: AdrenalineMeter; declare stats: ReturnType<typeof derivedStats>;
  declare dodgeT: number; declare dodgeCd: number; declare invulnT: number; declare dodgeInvulnT: number; declare hurtT: number; declare punchCd: number; declare actionT: number; declare actionAnim: Anim | null; declare hoverT: number;
  declare cooldowns: Record<string, number>; declare shield: number; declare shieldMax: number; declare shieldIdle: number; declare bonusShield: number;
  declare playerDecoy: Clone | null; declare history: { t: number; x: number; y: number }[];
  declare hpTrail: number; declare slowT: number; declare auraT: number; declare phaseT: number; declare wasGround: boolean; declare chargeT: number; declare slamming: boolean; declare laserKey: 'power1' | 'power2' | null; declare laserT: number; declare laserTick: number;
  declare sprPlayer: CharSprite; declare sprGhost: CharSprite; declare sprHolo: CharSprite;
  attacks: PlayerAttack[] = [];
  attackSeq = 0;
  pending: { at: number; fn: () => void; owner: number }[] = [];
  fighters: Fighter[] = [];
  cur!: Fighter;
  get F() { return this.cur; }
  multi: 'none' | 'versus' | 'coop' = 'none';
  puppet = false;
  /** developer console switches */
  dev = { god: false, infinite: false, hitboxes: false };
  netRec = false;
  netEvents: [string, unknown[]][] = [];
  netT = 0;
  ambientSpawn = false;
  round = 1;
  roundT = 0;
  // world
  boss!: Boss;
  hazards: Hazard[] = [];
  hazardSeq = 0;
  ctx!: BattleCtx;
  envT = 6;
  bandT = 12;
  coach = '';
  coachStep = 0;
  tut = { moved: 0, jumped: false, punched: false, dodged: false };
  sprint: { start: number | null; best: number | null } = { start: null, best: null };
  demoLeft = 0;
  hudTick = 0;
  padFlash = 0;
  ventT = 4;
  rockT = 5;
  bolts: { pts: { x: number; y: number }[]; life: number; big?: boolean }[] = [];
  decals: Decal[] = [];
  hitGroups = new Set<string>();
  bossTrail = 1;
  fx!: Phaser.GameObjects.Graphics;
  gTop!: Phaser.GameObjects.Graphics;
  sprBoss!: CharSprite; sprDecoys: CharSprite[] = [];
  particles: Particle[] = [];
  ambientT = 0;
  flashT = 0;
  snapshotTime = 0;

  /** Challenges mode logic, when running one */
  challenge: ChallengeRunner | null = null;
  constructor() { super('battle'); }

  init(cfg: BattleConfig) {
    this.cfg = cfg;
    this.multi = cfg.multi ?? 'none';
    this.round = 1; this.attacks = []; this.pending = []; this.hazards = []; this.decals = []; this.hitGroups = new Set();
    const pcs: PlayerCfg[] = cfg.players ?? [{ name: 'You', appearance: cfg.appearance, attributes: cfg.attributes, loadout: cfg.loadout, powerLevels: cfg.powerLevels }];
    const guest = cfg.online?.role === 'guest';
    this.fighters = pcs.map((pc, i) => new Fighter(i, pc, guest ? { left: false, right: false, down: false, jump: false, punch: false, dodge: false, power1: false, power2: false, move: false } : undefined));
    this.puppet = guest; this.netRec = cfg.online?.role === 'host';
    for (const f of this.fighters) {
      this.cur = f;
      this.setupFighter(f);
    }
    this.cur = this.fighters[0];
    if (cfg.demoPower) { const f = this.fighters[0]; f.loadout = { ...f.loadout, active: [cfg.demoPower, f.loadout.active[1]] }; const cap = Math.max(f.meter.max, (POWERS[cfg.demoPower]?.cost ?? 0) + 10); f.meter = new AdrenalineMeter(cap); f.meter.restore(cap); this.demoLeft = 25; }
    if (cfg.shieldBonus) this.fighters[0].bonusShield = 20;
    const key = cfg.challenge ? CHALLENGE_BY_ID[cfg.challenge].arenaKey : cfg.arenaKey ?? (cfg.mode === 'training' || cfg.mode === 'tutorial' ? 'training' : BOSS_BY_ID[cfg.bossId]?.arenaKey ?? 'rooftop');
    this.arena = JSON.parse(JSON.stringify(ARENAS[key]));
    this.arena.platforms.forEach((p) => { p.baseX = p.x; p.baseY = p.y; p.crumbleT = 0; p.brokenT = 0; });
  }

  /** Fresh starting state for a fighter (match start, versus round start). */
  setupFighter(f: Fighter) {
    f.stats = derivedStats(f.attributes, f.loadout.passive === 'power:quick-recovery');
    f.maxHp = f.stats.maxHp; f.hp = f.maxHp; f.hpTrail = 1;
    f.maxJumps = 1 + (f.loadout.movement === 'power:double-jump' || f.loadout.movement === 'power:triple-jump' ? 1 : 0); // Hover (old Triple Jump ID) keeps the double jump
    f.meter = new AdrenalineMeter(f.stats.maxAdrenaline);
    f.shieldMax = f.loadout.passive === 'power:energy-shield' ? SHIELD.absorb : 0; f.shield = f.shieldMax;
    f.px = this.multi === 'versus' ? (f.index === 0 ? 220 : 740) : f.index === 0 ? 160 : 250;
    f.py = GROUND; f.pvx = 0; f.pvy = 0; f.facing = this.multi === 'versus' && f.index === 1 ? -1 : 1;
    f.onGround = true; f.standing = null; f.cooldowns = {}; f.ko = false; f.koT = 0;
    f.dodgeT = 0; f.invulnT = 0; f.dodgeInvulnT = 0; f.hurtT = 0; f.actionT = 0; f.actionAnim = null; f.chargeT = 0; f.slamming = false; f.laserKey = null; f.chanId = null; f.frozenT = 0; f.novaT = 0; f.meteor = null; f.trail = []; f.auraT = 0; f.phaseT = 0; f.slowT = 0; f.playerDecoy = null;
    f.history = [{ t: this.elapsed ?? 0, x: f.px, y: f.py }];
  }
  /** Run fn with each (optionally only standing) fighter as the active one. */
  each(fn: (f: Fighter) => void, aliveOnly = true) {
    const keep = this.cur;
    for (const f of this.fighters) { if (aliveOnly && f.ko) continue; this.cur = f; fn(f); }
    this.cur = keep;
  }
  /** x of whatever this hero is fighting: the CPU, or the other hero in versus. */
  foeX(): number { if (this.multi === 'versus') { const o = this.fighters.find((f) => f !== this.cur); return o ? o.px : this.px; } return this.boss.x; }
  rectOf(f: Fighter) { const h = this.heroHeight(f); return { x: f.px - 17, y: f.py - h, w: 34, h }; }
  /** The hero the CPU focuses on: the closest one still standing. */
  targetFighter(): Fighter {
    const alive = this.fighters.filter((f) => !f.ko);
    if (!alive.length) return this.fighters[0];
    const bx = this.boss?.x ?? W / 2;
    return alive.reduce((a, f) => (Math.abs(f.px - bx) < Math.abs(a.px - bx) ? f : a));
  }

  create() {
    const cfg = this.cfg;
    if (this.netRec) { const play = cfg.sound; cfg.sound = (n) => { play(n); this.netEvents.push(['sound', [n]]); }; }
    const tier = TIER_STATS[cfg.tier];
    const diff = DIFFICULTY[cfg.difficulty];
    const rng = mulberry(cfg.seed);
    const slippery: { x: number; w: number }[] = [];
    const heavy: BattleCtx['heavy'] = [];
    const mothDecoys: Decoy[] = [];
    this.ctx = {
      time: 0, rng, tier, telegraphMul: diff.telegraph, extraHazards: diff.extraHazards, damage: cfg.enemyDamage, arena: this.arena,
      target: () => {
        const dec = this.fighters.find((f) => f.playerDecoy && !f.ko);
        if (dec?.playerDecoy) return { x: dec.playerDecoy.x, y: dec.playerDecoy.y };
        const f = this.targetFighter();
        const tt = this.elapsed - tier.reaction;
        for (let i = f.history.length - 1; i >= 0; i--) if (f.history[i].t <= tt) return f.history[i];
        return f.history[0] ?? { x: f.px, y: f.py };
      },
      playerNow: () => { const f = this.targetFighter(); return { x: f.px, y: f.py, onGround: f.onGround }; },
      addHazard: (h) => this.addHazard(h),
      removeHazard: (id) => { this.hazards = this.hazards.filter((x) => x.id !== id); },
      shake: (a) => { if (!cfg.reducedMotion) this.shakeAmt = Math.max(this.shakeAmt, a); },
      sound: (n) => cfg.sound(n),
      floatText: (x, y, t, c) => this.float(x, y, t, c),
      banner: (t) => this.showBanner(t),
      slippery, heavy, mothDecoys,
      playerThreat: () => {
        const f = this.targetFighter();
        const attacking = this.attacks.some((a) => !a.hit) || this.fighters.some((x) => !x.ko && x.actionT > 0) || this.pending.length > 0;
        const tx = f.playerDecoy ? f.playerDecoy.x : f.px;
        return { attacking, x: f.px, y: f.py, dist: Math.abs(this.boss ? this.boss.x - tx : 999) };
      },
      consumePlayerDecoy: () => { /* the clone now lasts until it has been hit 3 times */ },
    };
    const bossKey = cfg.mode === 'training' ? 'dummy' : cfg.mode === 'tutorial' ? 'tutorial' : cfg.bossId;
    this.boss = createBoss(this.multi === 'versus' ? 'dummy' : bossKey, this.ctx, this.multi === 'coop' ? Math.round(cfg.enemyHp * 1.6) : cfg.enemyHp);
    if (this.multi === 'versus' || cfg.challenge) { this.boss.x = -9999; this.boss.invuln = true; this.boss.alpha = 0; }
    // restore an interrupted trial (never a refill)
    const s = cfg.snapshot;
    if (s) {
      this.hp = Math.max(1, Math.min(this.maxHp, s.playerHp));
      this.meter.restore(s.adrenaline);
      this.boss.hp = Math.max(1, Math.min(this.boss.maxHp, s.bossHp));
      this.boss.phase = s.phase;
      this.elapsed = s.elapsed;
      this.px = s.playerX; this.boss.x = s.bossX;
      this.cooldowns = { ...s.cooldowns };
      this.intro = 1.6;
    }
    this.bg = this.add.graphics();
    this.drawBackground();
    this.g = this.add.graphics().setDepth(2);
    for (const f of this.fighters) { f.sprHolo = new CharSprite(this, 3); f.sprGhost = new CharSprite(this, 3); f.sprAfter = [0, 1, 2, 3].map(() => new CharSprite(this, 2.9)); }
    this.sprDecoys = [new CharSprite(this, 3), new CharSprite(this, 3), new CharSprite(this, 3)];
    this.sprBoss = new CharSprite(this, 4);
    for (const f of this.fighters) f.sprPlayer = new CharSprite(this, 5 - f.index * 0.1);
    this.gTop = this.add.graphics().setDepth(5.5);
    this.fx = this.add.graphics().setDepth(6);
    this.hud = this.add.graphics().setDepth(10);
    this.texts = {
      boss: this.add.text(W - 74, 12, '', { ...TXT, fontSize: '16px' }).setOrigin(1, 0).setDepth(11),
      bossState: this.add.text(W / 2, 98, '', { ...TXT, fontSize: '18px', color: '#ffe066' }).setOrigin(0.5, 0).setDepth(11),
      banner: this.add.text(W / 2, 170, '', { ...TXT, fontSize: '44px', fontFamily: 'Bangers, Impact, sans-serif', fontStyle: 'normal', strokeThickness: 8 }).setOrigin(0.5).setDepth(12),
      timer: this.add.text(W / 2, 66, '', { ...TXT, fontSize: '16px' }).setOrigin(0.5, 0).setDepth(11),
      info: this.add.text(W / 2, 130, '', { ...TXT, fontSize: '17px', align: 'center', wordWrap: { width: 760 } }).setOrigin(0.5, 0).setDepth(11),
    };
    this.tags = this.multi === 'none' ? [] : this.fighters.map((f) => this.add.text(0, 0, `P${f.index + 1}`, { ...TXT, fontSize: '13px', strokeThickness: 3 }).setOrigin(0.5).setDepth(5.6).setVisible(false));
    this.ptexts = this.fighters.map(() => ({ hp: this.add.text(0, 0, '', { ...TXT, fontSize: '15px' }).setDepth(11), adr: this.add.text(0, 0, '', { ...TXT, fontSize: '13px' }).setDepth(11) }));
    if (cfg.challenge) { this.challenge = new ChallengeRunner(this, cfg.challenge, cfg.seed); this.challenge.create(); }
    this.showBanner(s ? 'Resume!' : cfg.challenge ? CHALLENGE_BY_ID[cfg.challenge].name : cfg.mode === 'training' ? 'Training Room' : this.multi === 'versus' ? 'Round 1' : 'Ready…');
    if (this.multi === 'none' && cfg.mode !== 'training' && cfg.mode !== 'tutorial') this.coach = '';
    if (cfg.mode === 'tutorial') this.coach = 'Move with ← → (or the arrow buttons).';
    if (cfg.mode === 'training') this.coach = 'Free training: try your moves. Dummy shows damage. Sprint between the flags to feel your Speed. Adrenaline refills fast here.';
  }

  // ---------- helpers ----------
  addHazard(h: Partial<Hazard> & Pick<Hazard, 'shape' | 'style' | 'warn' | 'active' | 'dmg'>): Hazard {
    const hz: Hazard = { id: `h${++this.hazardSeq}`, owner: 'boss', x: 0, y: 0, w: 0, h: 0, r: 0, vx: 0, vy: 0, t: 0, color: 0xff4d4d, ...h };
    this.hazards.push(hz);
    return hz;
  }
  preload() {
    for (const [k, url] of Object.entries(COMIC)) if (!this.textures.exists(`fx-${k}`)) this.load.image(`fx-${k}`, url);
  }
  private lastWord = '';
  private lastZap = -1;
  private comicLive: Phaser.GameObjects.Image[] = [];
  /** Comic-book hit effect (POW!, ZAP!...) instead of damage numbers. */
  comic(x: number, y: number, kind: 'punch' | 'energy' | 'big' | 'hurt') {
    // a held beam hits many times a second: one ZAP! roughly every half second is plenty
    if (kind === 'energy') { if (this.elapsed - this.lastZap < 0.45) return; this.lastZap = this.elapsed; }
    if (this.netRec) this.netEvents.push(['comic', [x, y, kind]]);
    let word = kind === 'energy' ? 'zap' : kind === 'big' ? (Math.random() < 0.5 ? 'wham' : 'bam') : kind === 'hurt' ? (Math.random() < 0.5 ? 'bonk' : 'bop') : PUNCH_WORDS[Math.floor(Math.random() * PUNCH_WORDS.length)];
    if (word === this.lastWord && kind === 'punch') word = PUNCH_WORDS[(PUNCH_WORDS.indexOf(word) + 1 + Math.floor(Math.random() * 4)) % PUNCH_WORDS.length];
    this.lastWord = word;
    if (!this.textures.exists(`fx-${word}`)) return;
    // keep the screen readable: at most three bursts at once
    while (this.comicLive.length >= 3) this.comicLive.shift()?.destroy();
    const size = kind === 'big' ? 0.62 : kind === 'energy' ? 0.46 : kind === 'hurt' ? 0.34 : 0.42;
    const img = this.add.image(x + (Math.random() - 0.5) * 24, y - 10 + (Math.random() - 0.5) * 16, `fx-${word}`).setDepth(9).setAngle((Math.random() - 0.5) * 24).setAlpha(COMIC_ALPHA);
    this.comicLive.push(img);
    const done = () => { img.destroy(); this.comicLive = this.comicLive.filter((i) => i !== img); };
    if (this.cfg.reducedMotion) { img.setScale(size); this.tweens.add({ targets: img, alpha: 0, delay: 350, duration: 200, onComplete: done }); return; }
    img.setScale(size * 0.25);
    this.tweens.add({ targets: img, scale: size, duration: 130, ease: 'Back.Out' });
    this.tweens.add({ targets: img, alpha: 0, scale: size * 1.12, y: img.y - 18, delay: 380, duration: 220, ease: 'Quad.In', onComplete: done });
  }
  float(x: number, y: number, text: string, color = '#ffffff') {
    if (this.netRec) this.netEvents.push(['float', [x, y, text, color]]);
    const t = this.add.text(x, y, text, { ...TXT, fontSize: '22px', color }).setOrigin(0.5).setDepth(9).setScale(0.4);
    this.tweens.add({ targets: t, scale: 1.15, duration: 140, ease: 'Back.Out' });
    this.floats.push({ t, life: 0.9, vy: -60 });
  }
  showBanner(t: string) {
    if (this.netRec) this.netEvents.push(['banner', [t]]); this.texts.banner.setText(t); this.bannerT = 1.4; this.texts.banner.setScale(1.6); this.tweens.add({ targets: this.texts.banner, scale: 1, duration: 260, ease: 'Back.Out' }); if (/Phase|VICTORY/.test(t) && !this.cfg.reducedMotion) this.flashT = 0.6; }
  setPaused(v: boolean) { this.paused = v; }
  /** Ducking or crouching makes the hero shorter. */
  heroHeight(f: Fighter) { return f.actionAnim === 'duck' || f.actionAnim === 'meditate' || (f.inp.down && f.onGround) ? 58 : 84; }
  playerRect() { const h = this.heroHeight(this.cur); return { x: this.px - 17, y: this.py - h, w: 34, h }; }
  get active() { return !this.paused && !this.ended && this.intro <= 0; }

  getSnapshot(): CombatSnapshot {
    return { playerHp: this.hp, adrenaline: this.meter.value, bossHp: this.boss.hp, phase: this.boss.phase, elapsed: this.elapsed, playerX: this.px, bossX: this.boss.x, cooldowns: { ...this.cooldowns } };
  }

  powerHud(id: string | null): PowerHud | null {
    if (!id) return null;
    const p = POWERS[id];
    const item = SHOP_BY_ID[id];
    if (!p || !item) return null;
    const cd = this.cooldowns[id] ?? 0;
    return { id, name: item.name, cost: p.cost, ready: cd <= 0, cdFrac: cd / p.cooldown, affordable: this.meter.value >= p.cost, capacityOk: this.meter.max >= p.cost };
  }

  // ---------- main loop ----------
  update(_t: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.hudTick -= dt;
    if (this.hudTick <= 0) {
      this.hudTick = 0.1;
      const keepHud = this.cur; this.cur = this.fighters[this.cfg.online?.localIndex ?? 0] ?? this.fighters[0];
      this.cfg.onHud({ powers: [this.powerHud(this.F.loadout.active[0]), this.powerHud(this.F.loadout.active[1])], move: null, coach: this.coach, demoLeft: Math.ceil(this.demoLeft) });
      this.cur = keepHud;
    }
    if (this.puppet) { this.puppetUpdate(dt); return; }
    if (this.paused && !this.cfg.online) { this.render(); return; }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.texts.banner.setText(''); }
    if (this.intro > 0) {
      this.intro -= dt;
      if (this.intro <= 0 && this.cfg.mode !== 'training') this.showBanner('GO!');
      this.render(); return;
    }
    if (!this.ended) this.elapsed += dt;
    this.ctx.time = this.elapsed;
    // passive adrenaline (training refills quickly; none while paused, loading, or after victory)
    pollGamepads(this.multi !== 'none' && !this.cfg.online);
    this.each((f) => f.meter.tick(this.cfg.mode === 'training' ? dt * 15 : dt, this.active && !this.roundOver && !f.laserKey)); // no refill while a held power drains
    if (this.demoLeft > 0) { this.demoLeft -= dt; if (this.demoLeft <= 0) { this.F.loadout = { ...this.F.loadout, active: [null, this.F.loadout.active[1]] }; this.coach = 'Demo finished. Buy the power in the Workshop to keep it!'; } }
    this.each((f) => { for (const k of Object.keys(f.cooldowns)) f.cooldowns[k] = Math.max(0, f.cooldowns[k] - dt); }, false);
    if (this.dev.infinite) for (const f of this.fighters) { f.meter.restore(f.meter.max); for (const k of Object.keys(f.cooldowns)) f.cooldowns[k] = 0; }
    for (const pl of this.arena.platforms) {
      if (pl.vx && pl.range) { pl.x += pl.vx * dt; if (Math.abs(pl.x - pl.baseX!) > pl.range) { pl.vx = -pl.vx; pl.x = pl.baseX! + Math.sign(pl.x - pl.baseX!) * pl.range; } for (const f of this.fighters) if (f.standing === pl && f.onGround) f.px += pl.vx * dt; }
      if (pl.vy && pl.rangeY) { pl.y += pl.vy * dt; if (Math.abs(pl.y - pl.baseY!) > pl.rangeY) { pl.vy = -pl.vy; pl.y = pl.baseY! + Math.sign(pl.y - pl.baseY!) * pl.rangeY; } for (const f of this.fighters) if (f.standing === pl && f.onGround) f.py = pl.y; }
      if (pl.crumble) {
        if (pl.brokenT! > 0) { pl.brokenT! -= dt; if (pl.brokenT! <= 0) pl.crumbleT = 0; }
        else if (this.fighters.some((f) => f.standing === pl && f.onGround)) { pl.crumbleT! += dt; if (pl.crumbleT! > 0.75) { pl.brokenT = 4; for (const f of this.fighters) if (f.standing === pl) { f.standing = null; f.onGround = false; } this.spawn('dust', pl.x + pl.w / 2, pl.y, 14, 0xb08158); this.cfg.sound('hit'); } }
      }
    }
    // floor gadgets: bounce pads and conveyors
    this.each(() => {
    if (this.onGround && !this.standing && !this.ended) {
      for (const pad of this.arena.pads ?? []) if (this.px > pad.x && this.px < pad.x + pad.w && !this.F.inp.down) { this.pvy = -880; this.onGround = false; this.jumpsUsed = 1; this.padFlash = 0.3; this.cfg.sound('jump'); this.spawn('ring', pad.x + pad.w / 2, GROUND - 6, 1, 0xfde047); }
      for (const c of this.arena.conveyors ?? []) if (this.px > c.x && this.px < c.x + c.w) this.px += c.v * dt;
    }
    });

    if (!this.ended && !this.roundOver) this.each(() => this.updatePlayer(dt));
    this.each((f) => { f.history.push({ t: this.elapsed, x: f.px, y: f.py }); while (f.history.length > 2 && f.history[1].t < this.elapsed - 1.5) f.history.shift(); }, false);
    if (this.multi !== 'versus' && !this.challenge) this.boss.update(dt);
    if (this.challenge && !this.ended) this.challenge.update(dt);
    if ((this.boss.state !== 'defeated' || this.multi === 'versus') && !this.ended && !this.roundOver) {
      this.updateHazards(dt);
      this.updateEnv(dt);
    } else this.hazards = [];
    this.updateAttacks(dt);
    this.updatePending();
    this.updateMothDecoys(dt);
    this.each(() => {
      this.updateClone(dt);
      if (this.auraT > 0) { this.auraT -= dt; this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.02 * dt); }
      this.phaseT = Math.max(0, this.phaseT - dt);
      if (this.shieldMax) { this.shieldIdle += dt; if (this.shieldIdle >= SHIELD.rechargeDelay && this.shield < this.shieldMax) { this.shield = this.shieldMax; this.float(this.px, this.py - 90, 'Shield recharged', '#59e3ff'); } }
    });
    for (const d of this.decals) d.life -= dt;
    if (this.decals.some((d) => d.life <= 0)) this.decals = this.decals.filter((d) => d.life > 0);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter((b) => b.life > 0);
    this.updateCoach();
    // end conditions
    if (this.multi === 'versus') this.updateVersus(dt);
    else {
      if (this.challenge) { /* the challenge decides when it ends */ }
      else if (!this.ended && this.boss.hp <= 0 && this.cfg.mode !== 'training') { this.ended = true; this.endTimer = 1.8; this.cfg.sound('win'); this.showBanner(this.multi === 'coop' ? 'TEAM VICTORY!' : 'VICTORY!'); }
      if (this.multi === 'coop') this.updateCoopKo(dt);
      else if (!this.ended && this.hp <= 0 && !this.challenge) { this.ended = true; this.endTimer = 1.6; this.cfg.sound('lose'); this.showBanner('Good effort!'); }
    }
    if (this.ended) { this.endTimer -= dt; if (this.endTimer <= 0 && this.endTimer > -1) { this.endTimer = -5; const winner = this.multi === 'versus' ? this.fighters.reduce((a, f) => (f.wins > a.wins ? f : a)).index : undefined; this.cfg.onEnd({ won: this.challenge ? this.challenge.won : this.multi === 'versus' ? true : this.multi === 'coop' ? this.boss.hp <= 0 : this.hp > 0, seconds: this.elapsed, winner, score: this.challenge ? [this.challenge.score, this.challenge.target] : this.multi === 'versus' ? [this.fighters[0].wins, this.fighters[1].wins] : undefined }); } }
    for (const f of this.floats) { f.life -= dt; f.t.y += f.vy * dt; f.t.setAlpha(Math.max(0, f.life / 0.9)); }
    this.floats = this.floats.filter((f) => { if (f.life <= 0) { f.t.destroy(); return false; } return true; });
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 30);
    this.flashT = Math.max(0, this.flashT - dt * 2.5);
    this.padFlash = Math.max(0, this.padFlash - dt);
    this.updateParticles(dt);
    this.render();
    if (this.netRec && this.cfg.onNet) { this.netT -= dt; if (this.netT <= 0) { this.netT = 1 / (this.cfg.netHz ?? 30); this.cfg.onNet(this.getNetState()); } }
  }

  // ---------- online: host snapshot / guest mirror ----------
  getNetState(): NetState {
    const b = this.boss;
    const ev = this.netEvents; this.netEvents = [];
    return {
      e: this.elapsed, r: this.round, ro: this.roundOver, en: this.ended, it: this.intro, fl: this.flashT, pf: this.padFlash,
      f: this.fighters.map((f) => ({ x: f.px, y: f.py, fa: f.facing, hp: f.hp, mh: f.maxHp, m: f.meter.value, mm: f.meter.max, aa: f.actionAnim, at: f.actionT, og: f.onGround, vx: f.pvx, vy: f.pvy, dt: f.dodgeT, ht: f.hurtT, iv: f.invulnT, ph: f.phaseT, au: f.auraT, sh: f.shield, bs: f.bonusShield, ch: f.chargeT, sl: f.slamming, ko: f.ko, kt: f.koT, w: f.wins, sy: f.standing ? f.standing.y : null, dn: f.inp.down, pd: f.playerDecoy, cd: f.cooldowns, fz: f.frozenT, nv: f.novaT, nd: [f.novaDx, f.novaDy], mt: f.meteor, ci: f.chanId, lk: f.laserKey, hv: f.hovering, hf: f.hoverFuel })),
      b: { x: b.x, y: b.y, fa: b.facing, an: b.anim, aT: b.animT, al: b.alpha, hp: b.hp, mh: b.maxHp, p: b.phase, st: b.state, sh: b.shielded, sw: b.slowT, hf: b.hurtFlash, fz: b.frozenT },
      hz: this.hazards, at: this.attacks, sl: this.ctx.slippery, hv: this.ctx.heavy, md: this.ctx.mothDecoys,
      pl: this.arena.platforms.map((p) => [p.x, p.y, p.brokenT ?? 0, p.crumbleT ?? 0]), bo: this.bolts, dc: this.decals, ev,
    };
  }
  private netTarget: Record<number, { x: number; y: number }> = {};
  private bossTarget = { x: 0, y: 0 };
  /** Guest: take the host's latest picture of the battle. */
  applyNetState(st: NetState) {
    const s = st as any;
    this.elapsed = s.e; this.round = s.r; this.roundOver = s.ro; this.ended = s.en; this.intro = s.it; this.flashT = Math.max(this.flashT, s.fl); this.padFlash = s.pf;
    (s.f as any[]).forEach((d, i) => {
      const f = this.fighters[i]; if (!f) return;
      this.netTarget[i] = { x: d.x, y: d.y };
      if (Math.abs(f.px - d.x) > 140 || Math.abs(f.py - d.y) > 140) { f.px = d.x; f.py = d.y; }
      f.facing = d.fa; f.hp = d.hp; f.maxHp = d.mh; f.meter.value = d.m; (f.meter as any).max = d.mm; f.actionAnim = d.aa; f.actionT = d.at; f.onGround = d.og; f.pvx = d.vx; f.pvy = d.vy;
      f.dodgeT = d.dt; f.hurtT = d.ht; f.invulnT = d.iv; f.phaseT = d.ph; f.auraT = d.au; f.shield = d.sh; f.bonusShield = d.bs; f.chargeT = d.ch; f.slamming = d.sl; f.ko = d.ko; f.koT = d.kt; f.wins = d.w;
      f.standing = d.sy === null ? null : ({ x: 0, y: d.sy, w: 0 } as Platform); f.inp.down = d.dn; f.playerDecoy = d.pd; f.cooldowns = d.cd ?? {};
      f.frozenT = d.fz ?? 0; f.novaT = d.nv ?? 0; if (d.nd) { f.novaDx = d.nd[0]; f.novaDy = d.nd[1]; } f.meteor = d.mt ?? null; f.chanId = d.ci ?? null; f.laserKey = d.lk ?? null; f.hovering = !!d.hv; f.hoverFuel = d.hf ?? 0;
    });
    const b = this.boss, bd = s.b;
    this.bossTarget = { x: bd.x, y: bd.y };
    if (Math.abs(b.x - bd.x) > 160) { b.x = bd.x; b.y = bd.y; }
    b.facing = bd.fa; b.anim = bd.an; b.animT = bd.aT; b.alpha = bd.al; b.hp = bd.hp; b.maxHp = bd.mh; b.phase = bd.p; b.state = bd.st; b.shielded = bd.sh; b.slowT = bd.sw; b.hurtFlash = bd.hf; b.frozenT = bd.fz ?? 0;
    this.hazards = s.hz; this.attacks = s.at; this.bolts = s.bo; this.decals = s.dc ?? [];
    this.ctx.slippery.splice(0, this.ctx.slippery.length, ...s.sl);
    this.ctx.heavy.splice(0, this.ctx.heavy.length, ...s.hv);
    this.ctx.mothDecoys.splice(0, this.ctx.mothDecoys.length, ...s.md);
    (s.pl as number[][]).forEach((p, i) => { const pl = this.arena.platforms[i]; if (pl) { pl.x = p[0]; pl.y = p[1]; pl.brokenT = p[2]; pl.crumbleT = p[3]; } });
    // replay effects and sounds (without re-recording)
    for (const [name, args] of s.ev as [string, any[]][]) {
      if (name === 'sound') this.cfg.sound(args[0]);
      else if (name === 'comic') this.comic(args[0], args[1], args[2]);
      else if (name === 'float') this.float(args[0], args[1], args[2], args[3]);
      else if (name === 'banner') this.showBanner(args[0]);
      else if (name === 'spawn') this.spawn(args[0], args[1], args[2], args[3], args[4], args[5]);
    }
  }
  /** Guest frame: smooth toward the latest snapshot and draw. No game logic runs here. */
  puppetUpdate(dt: number) {
    for (const [i, t] of Object.entries(this.netTarget)) { const f = this.fighters[+i]; if (!f) continue; const k = Math.min(1, dt * 18); f.px += (t.x - f.px) * k; f.py += (t.y - f.py) * k; }
    const k = Math.min(1, dt * 18); this.boss.x += (this.bossTarget.x - this.boss.x) * k; this.boss.y += (this.bossTarget.y - this.boss.y) * k;
    this.boss.animT += dt;
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.texts.banner.setText(''); }
    for (const f of this.floats) { f.life -= dt; f.t.y += f.vy * dt; f.t.setAlpha(Math.max(0, f.life / 0.9)); }
    this.floats = this.floats.filter((f) => { if (f.life <= 0) { f.t.destroy(); return false; } return true; });
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 30); this.flashT = Math.max(0, this.flashT - dt * 2.5);
    this.updateParticles(dt);
    this.render();
  }

  // ---------- local multiplayer ----------
  roundOver = false;
  lastHitDmg = 0;
  updateVersus(dt: number) {
    if (this.ended) return;
    if (this.roundOver) {
      this.roundT -= dt;
      if (this.roundT <= 0) {
        if (this.fighters.some((f) => f.wins >= 2)) { this.ended = true; this.endTimer = 1.4; const w = this.fighters.reduce((a, f) => (f.wins > a.wins ? f : a)); this.showBanner(`${w.name} WINS!`); this.cfg.sound('win'); return; }
        this.round++; this.roundOver = false; this.attacks = []; this.pending = []; this.hazards = []; this.decals = [];
        for (const f of this.fighters) { this.cur = f; this.setupFighter(f); }
        this.cur = this.fighters[0];
        this.showBanner(`Round ${this.round}`);
      }
      return;
    }
    const down = this.fighters.filter((f) => f.hp <= 0);
    if (down.length) {
      const winner = this.fighters.find((f) => f.hp > 0);
      if (winner) winner.wins++;
      this.roundOver = true; this.roundT = 2.2;
      this.showBanner(winner ? `${winner.name} takes round ${this.round}!` : 'Double K.O.!');
      this.cfg.sound(winner ? 'win' : 'lose');
    }
  }
  updateCoopKo(dt: number) {
    if (this.ended) return;
    for (const f of this.fighters) {
      if (!f.ko && f.hp <= 0) { f.ko = true; f.koT = 8; this.float(f.px, f.py - 110, `${f.name} is down!`, '#ffb3b3'); this.cfg.sound('hurt'); }
      else if (f.ko && this.fighters.some((o) => o !== f && !o.ko)) { f.koT -= dt; if (f.koT <= 0) { f.ko = false; f.hp = Math.round(f.maxHp * 0.4); f.invulnT = 2; this.float(f.px, f.py - 110, `${f.name} is back!`, '#86efac'); this.spawn('ring', f.px, f.py - 40, 1, 0x86efac); } }
    }
    if (this.fighters.every((f) => f.ko)) { this.ended = true; this.endTimer = 1.6; this.cfg.sound('lose'); this.showBanner('Good teamwork — try again!'); }
  }

  /** Super Speed (Movement slot): run-speed multiplier for the active hero. */
  /** Hover seconds per jump (0 without Hover equipped). */
  hoverMax() { if (this.F.loadout.movement !== 'power:triple-jump') return 0; const l = this.F.powerLevels?.['power:triple-jump'] ?? 1; return HOVER_TIME[Math.max(0, Math.min(HOVER_TIME.length - 1, l - 1))]; }
  speedBoost() { if (this.F.loadout.movement !== 'power:gravity-burst') return 1; const l = this.F.powerLevels?.['power:gravity-burst'] ?? 1; return SUPER_SPEED[Math.max(0, Math.min(SUPER_SPEED.length - 1, l - 1))]; }
  inHeavy() { return this.ctx.heavy.some((z) => z.on && this.px >= z.x && this.px <= z.x + z.w); }
  onIce() { return this.onGround && this.standing === null && this.ctx.slippery.some((z) => this.px >= z.x && this.px <= z.x + z.w); }

  updatePlayer(dt: number) {
    if (this.F.novaT > 0 || this.F.meteor) { this.updateSpecial(dt); return; }
    const st = this.stats;
    const heavy = this.inHeavy();
    // frozen solid (Ice Dash in versus): no control until it thaws
    const frozen = this.F.frozenT > 0;
    if (frozen) { this.F.frozenT = Math.max(0, this.F.frozenT - dt); for (const k of ALL_KEYS) this.F.consume(k); this.chargeT = 0; this.pvx = 0; } // held in place
    // horizontal: immediate response; slowness comes from top speed, never input lag
    const dir = frozen ? 0 : (this.F.inp.right ? 1 : 0) - (this.F.inp.left ? 1 : 0);
    const busy = this.actionT > 0 && (this.actionAnim === 'charge' || this.actionAnim === 'power' || this.actionAnim === 'meditate');
    this.slowT = Math.max(0, this.slowT - dt);
    const crouching = this.F.inp.down && this.onGround && this.dodgeT <= 0;
    let target = busy || crouching ? 0 : dir * st.runSpeed * this.speedBoost() * (heavy ? 0.8 : 1) * (this.slowT > 0 ? 0.6 : 1);
    if (this.dodgeT > 0) target = this.pvx;
    const accel = (this.onIce() ? 0.12 : 1) * (st.runSpeed * this.speedBoost() / PLAYER.accelTime);
    if (this.dodgeT <= 0 && !frozen) {
      if (Math.abs(target - this.pvx) <= accel * dt) this.pvx = target; else this.pvx += Math.sign(target - this.pvx) * accel * dt;
    }
    if (dir !== 0 && this.dodgeT <= 0 && !busy) this.facing = dir;
    if (this.cfg.mode === 'tutorial' && dir) this.tut.moved += Math.abs(this.pvx * dt);
    // pull fields
    for (const h of this.hazards) if (h.pull && h.t >= h.warn && h.t < h.warn + h.active) {
      const d = h.pull.cx - this.px;
      if (Math.abs(d) < 190 && Math.abs(d) > 4) this.px += Math.sign(d) * h.pull.strength * dt;
    }
    // jumping
    if (this.F.consume('jump')) {
      if (this.F.inp.down && this.onGround && this.standing) { this.dropT = 0.25; this.onGround = false; this.standing = null; }
      else if (this.onGround) { this.pvy = -PLAYER.jumpVelocity * (heavy ? 0.72 : 1); this.onGround = false; this.standing = null; this.jumpsUsed = 1; this.cfg.sound('jump'); this.tut.jumped = true; this.spawn('dust', this.px, this.py, 5, 0xd8d0f0); }
      else if (this.jumpsUsed < this.maxJumps) { this.pvy = -PLAYER.extraJumpVelocity * (heavy ? 0.72 : 1); this.jumpsUsed++; this.cfg.sound('jump'); this.float(this.px, this.py - 20, '✦', '#ffe066'); }
      else if (this.jumpsUsed === 0) { this.pvy = -PLAYER.extraJumpVelocity * 0.8; this.jumpsUsed = this.maxJumps; } // walked off a ledge: allow one jump
    }
    if (!this.F.inp.jump && this.pvy < -250 && this.jumpsUsed > 0 && this.dodgeT <= 0) this.pvy += 900 * dt; // short hop when released early
    // dodge
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    if (this.F.consume('dodge') && this.dodgeCd <= 0 && this.dodgeT <= 0) {
      this.dodgeT = PLAYER.dodgeTime; this.dodgeInvulnT = PLAYER.dodgeInvuln;
      this.dodgeCd = PLAYER.dodgeTime + st.dodgeRecovery;
      const d = dir || this.facing;
      this.facing = d;
      this.pvx = d * (PLAYER.dodgeDistance / PLAYER.dodgeTime);
      this.cfg.sound('dodge'); this.tut.dodged = true;
      for (let i = 0; i < 5; i++) this.spawn('streak', this.px - d * 20, this.py - 15 - i * 12, 1);
    }
    if (this.dodgeT > 0) { this.dodgeT -= dt; if (this.dodgeT <= 0) this.pvx = dir * st.runSpeed * 0.6; }
    // punch (always free)
    this.punchCd = Math.max(0, this.punchCd - dt);
    const dmg = st.punchDamage;
    if (this.F.consume('punch') && this.punchCd <= 0 && this.dodgeT <= 0 && !this.slamming) {
      const slam = !this.onGround && this.F.inp.down;
      const duck = this.onGround && this.F.inp.down;
      if (slam) {
        // in the air, down + punch: dive straight down; hits whatever you land on, then a shockwave
        this.slamming = true; this.chargeT = 0;
        this.pvy = 1250; this.pvx *= 0.25; this.actionAnim = 'slam'; this.actionT = 2;
        this.attacks.push({ owner: this.F.index, id: `p${++this.attackSeq}`, x: this.px - 26, y: this.py - 40, w: 52, h: 44, t: 0, life: 1.2, dmg: dmg * 1.3, basic: true, kb: 0, hit: false, style: 'slam' });
        this.cfg.sound('dodge');
      } else if (duck) {
        // down + punch: duck low and strike with both fists, one to each side
        this.punchCd = 0.5; this.actionT = 0.3; this.actionAnim = 'duck';
        for (const side of [-1, 1]) this.attacks.push({ owner: this.F.index, id: `p${++this.attackSeq}`, x: side > 0 ? this.px + 4 : this.px - 4 - 66, y: this.py - 60, w: 66, h: 48, t: 0, life: 0.14, dmg: dmg * 1.1, basic: true, kb: 0, hit: false, style: 'duck' });
        this.cfg.sound('punch');
      } else {
        this.punchCd = PLAYER.punchCooldown; this.actionT = 0.18; this.actionAnim = 'punch';
        if (DIFFICULTY[this.cfg.difficulty].assist && Math.abs(this.foeX() - this.px) < 110) { this.facing = this.foeX() > this.px ? 1 : -1; this.px += this.facing * 10; }
        const x = this.facing > 0 ? this.px + 4 : this.px - 4 - PLAYER.punchRange;
        this.attacks.push({ owner: this.F.index, id: `p${++this.attackSeq}`, x, y: this.py - 70, w: PLAYER.punchRange, h: 52, t: 0, life: 0.12, dmg, basic: true, kb: 0, hit: false, style: 'punch' });
        this.cfg.sound('punch');
        this.chargeT = 0.001; // keep holding to wind up a power punch
      }
    }
    // hold punch: wind up, then release for a power punch
    if (this.chargeT > 0) {
      const holding = this.F.inp.punch && this.dodgeT <= 0 && !this.slamming && this.hurtT <= 0;
      if (holding && this.chargeT < 1.6) {
        this.chargeT += dt;
        if (this.chargeT > 0.25) { this.actionAnim = 'charge'; this.actionT = 0.12; }
      } else {
        if (this.chargeT >= 0.6) {
          this.actionAnim = 'punch'; this.actionT = 0.24; this.punchCd = 0.45;
          if (DIFFICULTY[this.cfg.difficulty].assist && Math.abs(this.foeX() - this.px) < 160) this.facing = this.foeX() > this.px ? 1 : -1;
          this.px += this.facing * 30;
          const x = this.facing > 0 ? this.px : this.px - 80;
          this.attacks.push({ owner: this.F.index, id: `p${++this.attackSeq}`, x, y: this.py - 76, w: 80, h: 62, t: 0, life: 0.16, dmg: dmg * 2.2, basic: true, kb: this.facing * 90, hit: false, style: 'power' });
          this.spawn('ring', this.px + this.facing * 40, this.py - 50, 1, 0xffd23f);
          this.cfg.sound('hit');
        } else if (this.actionAnim === 'charge') { this.actionAnim = null; this.actionT = 0; }
        this.chargeT = 0;
      }
    }
    // powers
    if (this.F.consume('power1')) this.usePower(this.F.loadout.active[0], 'power1');
    if (this.F.consume('power2')) this.usePower(this.F.loadout.active[1], 'power2');
    this.updateLaser(dt);
    this.F.consume('move');
    this.actionT = Math.max(0, this.actionT - dt);
    if (this.actionT <= 0) this.actionAnim = null;
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.dodgeInvulnT = Math.max(0, this.dodgeInvulnT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    // vertical
    // Hover: hold jump while falling to float for a short time, then drift down. Refills on landing.
    const F = this.F;
    if (this.onGround) F.hoverFuel = this.hoverMax();
    F.hovering = !this.onGround && F.inp.jump && F.hoverFuel > 0 && this.pvy >= -60 && this.dodgeT <= 0 && !this.slamming && F.frozenT <= 0 && this.hurtT <= 0 && F.novaT <= 0 && !F.meteor;
    if (F.hovering) {
      F.hoverFuel = Math.max(0, F.hoverFuel - dt);
      const bob = Math.sin(this.elapsed * 7) * 18;
      this.pvy += (bob - this.pvy) * Math.min(1, dt * 10); // hold height with a gentle bob
    }
    const grav = F.hovering ? 0 : PLAYER.gravity * (heavy ? 1.8 : 1) * (this.hoverT > 0 ? 0.2 : 1);
    this.hoverT = Math.max(0, this.hoverT - dt);
    this.dropT = Math.max(0, this.dropT - dt);
    const prevY = this.py;
    this.pvy = Math.min(this.pvy + grav * dt, this.slamming ? 1500 : 900);
    this.px += this.pvx * dt;
    this.py += this.pvy * dt;
    this.px = Math.max(16, Math.min(W - 16, this.px));
    this.onGround = false;
    if (this.py >= GROUND) { this.py = GROUND; this.pvy = 0; this.onGround = true; this.standing = null; }
    else if (this.pvy >= 0 && this.dropT <= 0 && this.py < GROUND) {
      for (const pl of this.arena.platforms) {
        if (pl.brokenT! > 0) continue;
        if (this.px >= pl.x - 6 && this.px <= pl.x + pl.w + 6 && prevY <= pl.y + 4 && this.py >= pl.y) { this.py = pl.y; this.pvy = 0; this.onGround = true; this.standing = pl; break; }
      }
    }
    if (this.onGround) this.jumpsUsed = 0;
    if (this.slamming && (this.onGround || this.hurtT > 0)) {
      this.slamming = false; this.actionAnim = 'duck'; this.actionT = 0.2; this.punchCd = 0.35;
      if (this.onGround) {
        this.attacks = this.attacks.filter((a) => !(a.style === 'slam' && a.owner === this.F.index));
        this.attacks.push({ owner: this.F.index, id: `p${++this.attackSeq}`, x: this.px - 80, y: this.py - 46, w: 160, h: 48, t: 0, life: 0.14, dmg: st.punchDamage * 1.5, basic: true, kb: 0, hit: false, style: 'blast' });
        this.spawn('dust', this.px, this.py, 14, 0xd8d0f0); this.spawn('ring', this.px, this.py - 6, 1, 0xffffff);
        if (!this.cfg.reducedMotion) this.shakeAmt = Math.max(this.shakeAmt, 6);
        this.cfg.sound('hit');
      }
    }
    if (this.onGround && !this.wasGround) this.spawn('dust', this.px, this.py, 6, 0xd8d0f0);
    this.wasGround = this.onGround;
    if (this.standing && (this.px < this.standing.x - 6 || this.px > this.standing.x + this.standing.w + 6)) { this.standing = null; this.onGround = false; }
    // sprint timer in training
    if (this.cfg.mode === 'training') {
      if (this.px < 70) this.sprint.start = this.elapsed;
      if (this.px > 890 && this.sprint.start !== null) { const t = this.elapsed - this.sprint.start; this.sprint.start = null; this.sprint.best = this.sprint.best === null ? t : Math.min(this.sprint.best, t); this.float(this.px, this.py - 90, `Sprint ${t.toFixed(2)}s`, '#ffe066'); }
    }
  }

  /** Eye position for beams (lower when ducking). */
  eyeY() { return this.py - (this.heroHeight(this.cur) < 70 ? 78 : 104); }

  /** Held Laser Eyes: a steady beam from the eyes that drains adrenaline until released. */
  updateLaser(dt: number) {
    if (!this.laserKey) return;
    const id = this.F.chanId ?? 'power:laser-eyes', p = POWERS[id];
    const lvl = POWER_LEVELS[Math.max(0, Math.min(POWER_LEVELS.length - 1, (this.F.powerLevels?.[id] ?? 1) - 1))];
    const meditating = !!p.channel?.regenPerSec;
    const stop = !this.F.inp[this.laserKey] || (!meditating && this.meter.value <= 0) || this.hurtT > 0 || this.dodgeT > 0 || this.slamming || this.ended || this.roundOver || this.F.frozenT > 0;
    if (stop) { this.laserKey = null; this.F.chanId = null; this.cooldowns[id] = p.cooldown * lvl.cooldown; if (this.actionAnim === 'power' || this.actionAnim === 'meditate') { this.actionAnim = null; this.actionT = 0; } return; }
    this.laserT += dt;
    if (meditating) {
      // sit still, float, and refill fast (more per level)
      this.actionAnim = 'meditate'; this.actionT = 0.12; this.pvx = 0;
      const rates = p.channel!.regenPerSec!;
      const rate = rates[Math.max(0, Math.min(rates.length - 1, (this.F.powerLevels?.[id] ?? 1) - 1))];
      if (this.laserT > 0.25) this.meter.value = Math.min(this.meter.max, this.meter.value + rate * dt);
      return;
    }
    this.actionAnim = 'power'; this.actionT = 0.12;
    const lightning = id === 'power:chain-lightning';
    if (this.laserT < (lightning ? 0.1 : 0.18)) return; // eyes / hands light up first
    this.meter.value = Math.max(0, this.meter.value - (p.channel?.drainPerSec ?? 20) * dt);
    this.laserTick -= dt;
    if (lightning) { if (this.laserTick <= 0) { this.laserTick = 0.1; this.lightningTick(p.damage * this.stats.willpowerMult * lvl.power * 0.1); } return; }
    if (this.laserTick <= 0) {
      const tick = 0.12;
      this.laserTick = tick;
      const len = 380, thick = 12, y = this.eyeY() - thick / 2;
      const x = this.facing > 0 ? this.px + 10 : this.px - 10 - len;
      this.attacks.push({ owner: this.F.index, id: `pw${++this.attackSeq}`, x, y, w: len, h: thick, t: 0, life: tick + 0.02, dmg: p.damage * this.stats.willpowerMult * lvl.power * tick, basic: false, kb: 0, hit: false, style: 'beam' });
      if (Math.floor(this.laserT / 0.5) !== Math.floor((this.laserT - tick) / 0.5)) this.cfg.sound('laser');
    }
  }

  usePower(id: string | null, slotKey: 'power1' | 'power2' | null = null) {
    if (!id || this.ended) return;
    const p = POWERS[id];
    if (!p || (this.cooldowns[id] ?? 0) > 0) return;
    if (p.cost > 0 && !this.meter.canSpend(p.cost)) { this.float(this.px, this.py - 95, p.cost > this.meter.max ? 'Needs more Willpower capacity' : 'Not enough adrenaline', '#ffb3b3'); return; }
    this.meter.spend(p.cost);
    const lvl = POWER_LEVELS[Math.max(0, Math.min(POWER_LEVELS.length - 1, (this.F.powerLevels?.[id] ?? 1) - 1))];
    this.cooldowns[id] = p.cooldown * lvl.cooldown;
    const st = this.stats;
    const scaled = (d: number) => (p.strengthScaled ? d * st.strengthMult : p.willpowerScaled ? d * st.willpowerMult : d) * lvl.power;
    const assist = DIFFICULTY[this.cfg.difficulty].assist;
    const faceBoss = () => { if (assist) this.facing = this.foeX() > this.px ? 1 : -1; };
    const at = (delay: number, fn: () => void) => this.pending.push({ at: this.elapsed + delay, fn, owner: this.F.index });
    const beam = (dmg: number, len: number, thick: number) => {
      const y = this.eyeY() - thick / 2;
      const x = this.facing > 0 ? this.px + 8 : this.px - 8 - len;
      this.attacks.push({ owner: this.F.index, id: `pw${++this.attackSeq}`, x, y, w: len, h: thick, t: 0, life: 0.22, dmg, basic: false, kb: 0, hit: false, style: 'beam' });
      this.cfg.sound('laser');
    };
    if (id !== 'power:phase-shift') this.cfg.sound('power');
    const add = (o: Omit<PlayerAttack, 'owner' | 'id' | 't' | 'hit'>) => { const atk: PlayerAttack = { owner: this.F.index, id: `pw${++this.attackSeq}`, t: 0, hit: false, ...o }; this.attacks.push(atk); return atk; };
    const moveDir = () => (this.F.inp.right ? 1 : this.F.inp.left ? -1 : assist || this.multi === 'versus' ? (this.foeX() >= this.px ? 1 : -1) : this.facing);
    switch (id) {
      case 'power:laser-eyes': case 'power:chain-lightning':
        // held channel: keeps going while the button is held and adrenaline lasts
        faceBoss(); this.cooldowns[id] = 0; this.laserKey = slotKey ?? 'power1'; this.F.chanId = id; this.laserT = 0; this.laserTick = 0; this.actionAnim = 'power'; this.actionT = 0.12;
        if (id === 'power:chain-lightning') this.spawn('spark', this.px + this.facing * 22, this.py - 62, 8, 0x7dd3fc, 0.6);
        break;
      case 'power:mega-laser': {
        // Flame Blast: a roaring fireball that explodes and leaves the floor burning
        faceBoss(); this.actionT = 0.32; this.actionAnim = 'power';
        this.spawn('spark', this.px + this.facing * 26, this.py - 64, 10, 0xff7a1a, 0.7);
        at(0.16, () => {
          // angles toward the opponent's height so it still connects from a jump or a platform
          const sx = this.px + this.facing * 30, sy = this.py - 62, t = this.foeCenter();
          const tt = Math.max(0.15, Math.abs(t.x - sx) / 660);
          const vy = (t.x - sx) * this.facing > 0 ? Math.max(-520, Math.min(520, (t.y - sy) / tt)) : 0;
          add({ style: 'fire', x: sx - 24, y: sy - 24, w: 48, h: 48, life: 1.5, dmg: scaled(p.damage), boom: scaled(p.damage) * 0.45, basic: false, kb: this.facing * 70, vx: this.facing * 660, vy });
          this.cfg.sound('laser');
        });
        break;
      }
      case 'power:super-punch': {
        // Super Punch: a giant boxing glove springs out of your fist, smacks whatever is in front, then snaps back
        faceBoss();
        if (assist && Math.abs(this.foeX() - this.px) < 320) this.facing = this.foeX() > this.px ? 1 : -1;
        const bonus = this.boss.state === 'recover' || this.boss.state === 'telegraph' ? 1.5 : 1;
        this.actionT = 0.42; this.actionAnim = 'punch'; this.pvx = 0;
        add({ style: 'glove', x: this.px, y: this.py - 92, w: 64, h: 58, life: 0.42, reach: 230, dmg: scaled(p.damage) * bonus, basic: false, kb: this.facing * Math.min(PLAYER.maxKnockbackPx, 130) });
        this.spawn('ring', this.px + this.facing * 30, this.py - 64, 1, 0xff4d4d);
        this.cfg.sound('punch');
        break;
      }
      case 'power:meteor-punch':
        // rocket off the top of the screen, then dive onto the opponent as a flaming meteor
        faceBoss(); this.laserKey = null; this.chargeT = 0; this.slamming = false;
        this.F.meteor = { phase: 'up', t: 0, tx: this.foeX(), ty: GROUND };
        this.pvy = 0; this.onGround = false; this.standing = null;
        this.spawn('dust', this.px, this.py, 12, 0xd8d0f0); this.spawn('ring', this.px, this.py - 6, 1, 0xff9b2f);
        this.F.meteorDmg = scaled(p.damage);
        break;
      case 'power:nova-storm':
        // Supernova: become a fireball and zip across the arena in diagonals
        this.laserKey = null; this.chargeT = 0; this.slamming = false;
        this.F.novaT = 3.2; this.F.novaHitT = 0; this.novaAim(true);
        add({ style: 'nova', x: this.px - 48, y: this.py - 100, w: 96, h: 104, life: 3.25, dmg: scaled(p.damage), basic: false, kb: 0, rehit: 0.32 });
        this.spawn('ring', this.px, this.py - 45, 1, 0xffd23f); this.spawn('spark', this.px, this.py - 45, 26, 0xff7a1a, 1.6);
        if (!this.cfg.reducedMotion) { this.shakeAmt = Math.max(this.shakeAmt, 8); this.flashT = 0.3; }
        this.float(this.px, this.py - 120, 'SUPERNOVA!', '#ffb347');
        break;
      case 'power:ice-dash': {
        // skate forward on a trail of ice; whatever you pass through freezes solid
        const d = moveDir(), dist = 320, T = 0.22;
        this.facing = d; this.dodgeT = T; this.dodgeInvulnT = T + 0.08; this.pvx = d * (dist / T);
        add({ style: 'dash', x: this.px - 24, y: this.py - 80, w: 48, h: 80, life: T + 0.04, dmg: scaled(p.damage), basic: false, kb: 0, freeze: 3 });
        const x0 = Math.max(0, Math.min(this.px, this.px + d * dist)), x1 = Math.min(W, Math.max(this.px, this.px + d * dist));
        if (this.onGround) this.decals.push({ kind: 'ice', x: x0, y: this.standing ? this.standing.y : GROUND, w: x1 - x0, life: 2.5, max: 2.5 });
        this.spawn('frost', this.px, this.py - 40, 16, 0x9be7ff, 0.9);
        this.spawn('spark', this.px, this.py - 40, 12, 0xbfe9ff, 0.8);
        this.spawn('ring', this.px, this.py - 40, 1, 0xbfe9ff);
        this.cfg.sound('dodge');
        break;
      }
      case 'power:hologram-decoy':
        // a glowing clone that runs in and fights; the opponent goes after it until it takes 3 hits
        if (this.playerDecoy) this.popClone(this.F, false);
        const clone: Clone = { x: Math.max(30, Math.min(W - 30, this.px + this.facing * 40)), y: this.onGround ? this.py : GROUND, vy: 0, t: 14, hits: 0, cd: 0.5, face: this.facing, anim: 'idle', animT: 0, hurtT: 0, dmg: scaled(p.damage) };
        this.playerDecoy = clone;
        this.spawn('ring', clone.x, clone.y - 44, 1, 0x7df9ff); this.spawn('spark', clone.x, clone.y - 44, 16, 0x7df9ff, 0.9);
        this.float(clone.x, clone.y - 110, 'Clone!', '#7df9ff');
        break;
      case 'power:ground-shockwave':
        if (this.onGround) { this.pvy = -320; this.onGround = false; at(0.18, () => { this.pvy = 900; }); }
        else this.pvy = 900;
        this.actionAnim = 'punch'; this.actionT = 0.3;
        this.pending.push({ at: -1, fn: () => this.shockwave(scaled(p.damage), lvl.level), owner: this.F.index }); // fires on landing
        break;
      case 'power:titan-fist': {
        // a shadow marks the opponent, then a giant fist comes down from the sky
        faceBoss(); this.actionT = 0.55; this.actionAnim = 'power';
        const tx = Math.max(80, Math.min(W - 80, this.foeX()));
        const fist = add({ style: 'titan', x: tx - 80, y: GROUND - 340, w: 160, h: 340, tx, armT: 0.8, life: 1.15, dmg: scaled(p.damage), basic: false, kb: 0 });
        this.float(tx, GROUND - 200, '⬇', '#ffd23f');
        at(0.8, () => {
          const cx = fist.tx ?? tx;
          for (const d of [-1, 1]) add({ style: 'wave', x: cx - 18 + d * 60, y: GROUND - 30, w: 36, h: 30, life: 1.1, dmg: scaled(p.damage) * 0.2, basic: false, kb: 0, vx: d * 480 });
          this.decals.push({ kind: 'crater', x: cx - 95, y: GROUND, w: 190, life: 4, max: 4 });
          this.spawn('dust', cx, GROUND, 26, 0xd8d0f0); this.spawn('spark', cx, GROUND - 30, 26, 0xffd23f, 1.8);
          this.spawn('ring', cx, GROUND - 20, 1, 0xffffff); this.spawn('ring', cx, GROUND - 60, 1, 0xffd23f);
          if (!this.cfg.reducedMotion) { this.shakeAmt = Math.max(this.shakeAmt, 16); this.flashT = 0.35; }
          this.cfg.sound('hit');
        });
        break;
      }
      case 'power:phase-shift':
        // Meditate: a held calm that refills adrenaline (the ID is the old Phase Shift's so saves carry over)
        this.cooldowns[id] = 0; this.laserKey = slotKey ?? 'power1'; this.F.chanId = id; this.laserT = 0; this.chargeT = 0;
        this.actionAnim = 'meditate'; this.actionT = 0.12; this.pvx = 0;
        this.spawn('ring', this.px, this.py - 40, 1, 0xffd23f);
        break;
      case 'power:guardian-aura':
        this.auraT = 6 * lvl.power; this.float(this.px, this.py - 110, 'Guardian Aura!', '#86efac');
        this.spawn('ring', this.px, this.py - 40, 1, 0x4ade80);
        break;
    }
  }

  /** Opponent's body centre (CPU or the other hero). */
  foeCenter(): { x: number; y: number; feet: number; onGround: boolean } {
    if (this.multi === 'versus') { const o = this.fighters.find((f) => f !== this.cur); if (o) return { x: o.px, y: o.py - 42, feet: o.py, onGround: o.onGround }; }
    const b = this.boss.bounds();
    return { x: this.boss.x, y: b.y + b.h / 2, feet: this.boss.y, onGround: this.boss.y >= GROUND - 2 };
  }

  /** Supernova: pick the next diagonal, heading for the opponent but always away from the wall just hit. */
  novaAim(first = false) {
    const F = this.F, t = this.foeCenter();
    let dx = t.x - this.px, dy = t.y - (this.py - 42);
    if (Math.abs(dx) < 60) dx = (Math.random() < 0.5 ? -1 : 1) * 60;
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    // keep it diagonal
    const ang = Math.atan2(dy, dx) + (first ? 0 : (Math.random() - 0.5) * 0.5);
    dx = Math.cos(ang); dy = Math.sin(ang);
    // the first streak goes straight at the opponent; later ones stay diagonal
    const slope = Math.abs(dy) / Math.max(0.01, Math.abs(dx));
    if (!first && slope < 0.35) dy = Math.sign(dy || (this.py > GROUND - 100 ? -1 : 1)) * Math.abs(dx) * 0.35;
    if (slope > 1.8) dx = Math.sign(dx) * Math.abs(dy) / 1.8;
    if (this.px <= 32 && dx < 0) dx = -dx;
    if (this.px >= W - 32 && dx > 0) dx = -dx;
    if (this.py <= 152 && dy < 0) dy = -dy;
    if (this.py >= GROUND - 1 && dy > 0) dy = -dy;
    const n = Math.hypot(dx, dy) || 1;
    F.novaDx = dx / n; F.novaDy = dy / n;
  }

  /** Supernova zips and the Meteor Slam leap/dive take over movement completely. */
  updateSpecial(dt: number) {
    const F = this.F;
    this.invulnT = Math.max(this.invulnT - dt, 0.15);
    this.hurtT = 0; this.dodgeT = 0; this.chargeT = 0; this.laserKey = null; this.slamming = false;
    for (const k of ALL_KEYS) F.consume(k);
        if (F.novaT > 0) {
      F.novaT -= dt;
      // steer: hold up (jump) or down to bend the streak; it keeps flying on its own
      const steer = (F.inp.down ? 1 : 0) - (F.inp.jump ? 1 : 0);
      if (steer) {
        const dy = Math.max(-0.92, Math.min(0.92, F.novaDy + steer * 3 * dt));
        F.novaDx = (Math.sign(F.novaDx) || 1) * Math.sqrt(1 - dy * dy); F.novaDy = dy;
      }
      const sp = 1050;
      this.px += F.novaDx * sp * dt; this.py += F.novaDy * sp * dt;
      let bounced = false;
      if (this.px < 30) { this.px = 30; bounced = true; } else if (this.px > W - 30) { this.px = W - 30; bounced = true; }
      if (this.py < 150) { this.py = 150; bounced = true; } else if (this.py > GROUND) { this.py = GROUND; bounced = true; }
      if (bounced) { this.novaAim(); this.ambientSpawn = true; this.spawn('spark', this.px, this.py - 42, 6, 0xffd23f, 0.8); this.ambientSpawn = false; }
      this.facing = F.novaDx >= 0 ? 1 : -1;
      this.actionAnim = 'rush'; this.actionT = 0.1;
      this.onGround = false; this.standing = null; this.pvx = 0; this.pvy = 0;
      const atk = this.attacks.find((a) => a.style === 'nova' && a.owner === F.index);
      if (atk) { atk.x = this.px - 48; atk.y = this.py - 100; }
      if (F.novaT <= 0) {
        F.novaT = 0; this.invulnT = 0.6; this.actionAnim = null; this.actionT = 0; this.pvy = -260;
        this.attacks = this.attacks.filter((a) => !(a.style === 'nova' && a.owner === F.index));
        this.spawn('ring', this.px, this.py - 42, 1, 0xffd23f); this.spawn('spark', this.px, this.py - 42, 18, 0xff9b2f, 1.2);
      }
      return;
    }
    const m = F.meteor!;
    m.t += dt;
    if (m.phase === 'up') {
      this.py -= 1900 * dt; this.actionAnim = 'jump'; this.actionT = 0.1;
      if (this.py < -140) { m.phase = 'hang'; m.t = 0; this.py = -160; }
    } else if (m.phase === 'hang') {
      // the landing spot follows the opponent briefly, then locks (a fair warning in versus)
      const t = this.foeCenter();
      if (m.t < 0.3) { m.tx += (Math.max(40, Math.min(W - 40, t.x)) - m.tx) * Math.min(1, dt * 10); m.ty = this.multi === 'versus' && t.onGround ? t.feet : GROUND; }
      if (m.t >= 0.5) {
        m.phase = 'dive'; m.t = 0;
        const side = m.tx > W / 2 ? -1 : 1;
        this.px = Math.max(20, Math.min(W - 20, m.tx + side * 300)); this.py = -160;
        this.facing = m.tx >= this.px ? 1 : -1;
        add2(this, { style: 'meteor', x: this.px - 34, y: this.py - 84, w: 68, h: 88, life: 2, dmg: (F.meteorDmg ?? 40) * 0.4, basic: false, kb: 0 });
        this.cfg.sound('dodge');
      }
    } else {
      const dx = m.tx - this.px, dy = m.ty - this.py, L = Math.hypot(dx, dy) || 1, step = 1750 * dt;
      this.actionAnim = 'slam'; this.actionT = 0.1;
      if (L <= step) { this.px = m.tx; this.py = m.ty; } else { this.px += dx / L * step; this.py += dy / L * step; }
      const atk = this.attacks.find((a) => a.style === 'meteor' && a.owner === F.index);
      if (atk) { atk.x = this.px - 34; atk.y = this.py - 84; }
      if (L <= step || m.t > 1.2) this.meteorLand();
    }
    this.pvx = 0; this.pvy = 0; this.onGround = false; this.standing = null;
  }

  meteorLand() {
    const F = this.F, m = F.meteor!;
    F.meteor = null;
    this.py = m.ty; this.onGround = true;
    this.standing = m.ty < GROUND - 1 ? this.arena.platforms.find((pl) => Math.abs(pl.y - m.ty) < 3 && this.px >= pl.x - 6 && this.px <= pl.x + pl.w + 6) ?? null : null;
    if (m.ty < GROUND - 1 && !this.standing) this.onGround = false;
    this.attacks = this.attacks.filter((a) => !(a.style === 'meteor' && a.owner === F.index));
    const dmg = F.meteorDmg ?? 40;
    this.attacks.push({ owner: F.index, id: `pw${++this.attackSeq}`, style: 'crater', x: this.px - 150, y: this.py - 150, w: 300, h: 155, t: 0, life: 0.3, dmg, basic: false, kb: this.facing * PLAYER.maxKnockbackPx, hit: false });
    this.decals.push({ kind: 'crater', x: this.px - 110, y: this.py, w: 220, life: 4, max: 4 });
    this.spawn('dust', this.px, this.py, 26, 0xc9b08a, 1.4); this.spawn('spark', this.px, this.py - 20, 30, 0xff7a1a, 1.9); this.spawn('spark', this.px, this.py - 10, 12, 0x8a6a4f, 1.5);
    this.spawn('ring', this.px, this.py - 10, 1, 0xffffff); this.spawn('ring', this.px, this.py - 40, 1, 0xff9b2f);
    this.ambientSpawn = true; this.spawn('ember', this.px, this.py - 10, 12, 0xffb347); this.ambientSpawn = false;
    if (!this.cfg.reducedMotion) { this.shakeAmt = Math.max(this.shakeAmt, 14); this.flashT = 0.25; }
    this.invulnT = 0.4; this.actionAnim = 'duck'; this.actionT = 0.3; this.punchCd = 0.3;
    this.cfg.sound('hit');
  }

  /** Held Chain Lightning: one homing zap per tick into the nearest foe in range (pops decoys too). */
  lightningTick(dmg: number) {
    const range = 540;
    const hand = { x: this.px + this.facing * 24, y: this.py - 64 };
    const pts: { x: number; y: number }[] = [hand];
    for (const d of this.ctx.mothDecoys) if (d.alive && Math.abs(d.x - this.px) < range) { d.alive = false; pts.push({ x: d.x, y: d.y - 50 }); this.float(d.x, d.y - 80, 'Decoy!', '#ff7ce0'); }
    let rect: { x: number; y: number; w: number; h: number } | null = null;
    if (this.multi === 'versus') {
      const o = this.fighters.find((f) => f !== this.cur);
      if (o && Math.abs(o.px - this.px) < range) {
        // a dodge or Ice Dash shakes the lightning off, and it cannot grab you again for a moment
        if (o.dodgeT > 0 && this.elapsed >= o.zapFreeAt) { o.zapFreeAt = this.elapsed + 0.7; this.float(o.px, o.py - 110, 'Escaped!', '#59e3ff'); }
        if (o.dodgeT <= 0 && this.elapsed >= o.zapFreeAt) rect = this.rectOf(o);
      }
    }
    else if (this.challenge) rect = this.challenge.nearestTarget(this.px, this.py, range);
    else if (this.boss.alpha > 0.05 && this.boss.state !== 'defeated' && Math.abs(this.boss.x - this.px) < range) rect = this.boss.bounds();
    if (rect) {
      const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
      this.facing = cx >= this.px ? 1 : -1; hand.x = this.px + this.facing * 24;
      pts.push({ x: cx, y: cy });
      this.attacks.push({ owner: this.F.index, id: `pw${++this.attackSeq}`, x: rect.x, y: rect.y, w: rect.w, h: rect.h, t: 0, life: 0.12, dmg, basic: false, kb: 0, hit: false, style: 'bolt' });
    } else pts.push({ x: hand.x + this.facing * (110 + Math.random() * 60), y: hand.y + (Math.random() - 0.5) * 80 });
    this.bolts.push({ pts, life: 0.12, big: !!rect });
    if (Math.floor(this.laserT / 0.4) !== Math.floor((this.laserT - 0.1) / 0.4)) this.cfg.sound('laser');
  }

  /** Hologram Decoy clone: run at the opponent, punch, and soak up attacks until hit 3 times. */
  updateClone(dt: number) {
    const c = this.playerDecoy;
    if (!c) return;
    c.t -= dt; c.animT += dt; c.hurtT = Math.max(0, c.hurtT - dt); c.cd -= dt;
    if (c.t <= 0 || (this.multi !== 'versus' && this.boss.state === 'defeated')) { this.popClone(this.F, false); return; }
    const foe = this.foeCenter();
    const dx = foe.x - c.x, reach = 46;
    c.face = dx >= 0 ? 1 : -1;
    const grounded = c.y >= GROUND - 0.5;
    if (c.hurtT > 0) c.anim = 'hurt';
    else if (Math.abs(dx) > reach) { c.x += Math.sign(dx) * Math.min(Math.abs(dx) - reach, 330 * dt); c.anim = grounded ? 'run' : 'jump'; }
    else c.anim = c.cd > 0.4 ? 'punch' : 'idle';
    // jump at an opponent that is up high
    if (grounded && c.hurtT <= 0 && foe.feet < GROUND - 80 && Math.abs(dx) < 170) c.vy = -760;
    c.vy += 1500 * dt; c.y += c.vy * dt;
    if (c.y >= GROUND) { c.y = GROUND; c.vy = 0; }
    c.x = Math.max(16, Math.min(W - 16, c.x));
    if (Math.abs(dx) <= reach + 14 && c.cd <= 0 && c.hurtT <= 0) {
      c.cd = 0.6; c.anim = 'punch'; c.animT = 0;
      const x = c.face > 0 ? c.x + 2 : c.x - 2 - 60;
      this.attacks.push({ owner: this.F.index, id: `cl${++this.attackSeq}`, x, y: c.y - 74, w: 60, h: 56, t: 0, life: 0.12, dmg: c.dmg, basic: false, kb: 0, hit: false, style: 'punch' });
      this.cfg.sound('punch');
    }
  }
  cloneRect(c: Clone) { return { x: c.x - 17, y: c.y - 84, w: 34, h: 84 }; }
  /** The clone takes a hit; on the third it vanishes. */
  hitClone(f: Fighter) {
    const c = f.playerDecoy; if (!c || c.hurtT > 0) return;
    c.hits++; c.hurtT = 0.55; c.anim = 'hurt';
    this.spawn('spark', c.x, c.y - 50, 10, 0x7df9ff, 1);
    this.comic(c.x, c.y - 100, 'hurt');
    if (c.hits >= 3) this.popClone(f, true); else this.cfg.sound('hurt');
  }
  popClone(f: Fighter, beaten: boolean) {
    const c = f.playerDecoy; if (!c) return;
    f.playerDecoy = null;
    this.spawn('ring', c.x, c.y - 44, 1, 0x7df9ff); this.spawn('spark', c.x, c.y - 44, 20, 0x7df9ff, 1.2);
    if (beaten) this.float(c.x, c.y - 110, 'Clone popped!', '#7df9ff');
  }

  updatePending() {
    const now = this.elapsed;
    const keep: typeof this.pending = [];
    const prev = this.cur;
    for (const p of this.pending) {
      this.cur = this.fighters[p.owner] ?? this.fighters[0];
      if (p.at === -1) { if (this.onGround) p.fn(); else keep.push(p); }
      else if (now >= p.at) p.fn(); else keep.push(p);
    }
    this.cur = prev;
    this.pending = keep;
  }

  updateAttacks(dt: number) {
    const b = this.boss;
    const prevCur = this.cur;
    for (const a of this.attacks) {
      this.cur = this.fighters[a.owner] ?? this.fighters[0];
      a.t += dt;
      if (a.vx) a.x += a.vx * dt;
      if (a.vy) { a.y += a.vy * dt; if (a.style === 'fire' && a.y + a.h > GROUND) { a.y = GROUND - a.h; a.vy = 0; a.t = a.life; } }
      if (a.style === 'dash') { a.x = this.px - a.w / 2; a.y = this.py - a.h; }
      if (a.style === 'phase') { a.x = this.px - a.w / 2; a.y = this.py - a.h; }
      if (a.style === 'glove') { const e = (a.reach ?? 200) * Math.sin(Math.PI * Math.min(1, a.t / a.life)); a.x = this.px + this.facing * (24 + e) - a.w / 2; a.y = this.py - 92; }
      if (a.style === 'slam') { a.x = this.px - 26; a.y = this.py - 40; }
      if (a.style === 'rush') { a.x = this.facing > 0 ? this.px : this.px - a.w; a.y = this.py - 74; }
      // Titan Fist: the shadow follows the opponent for a moment, then locks
      if (a.style === 'titan' && a.t < 0.45) { const fx = Math.max(80, Math.min(W - 80, this.foeX())); a.tx = (a.tx ?? fx) + (fx - (a.tx ?? fx)) * Math.min(1, dt * 7); a.x = a.tx - a.w / 2; }
      if (a.rehit && a.t - (a.lastHit ?? 0) >= a.rehit) { a.hit = false; a.hitSet = []; }
      if (a.armT && a.t < a.armT) continue;
      if (this.challenge) { this.challenge.onAttack(a); continue; }
      // moth decoys pop on any hit
      for (const d of this.ctx.mothDecoys) if (d.alive && overlap(a, { x: d.x - 26, y: d.y - 90, w: 52, h: 90 })) { d.alive = false; this.float(d.x, d.y - 80, 'Decoy!', '#ff7ce0'); }
      if (a.style === 'burn' && a.t > a.life - 0.3) continue;
      if (this.multi === 'versus') { this.pvpHit(a); if (a.style === 'fire' && a.hitSet?.length) a.hit = true; continue; }
      if (a.hit || this.ended) continue;
      if (a.group && this.hitGroups.has(a.group)) continue;
      if (overlap(a, b.bounds())) {
        a.hit = true; a.lastHit = a.t;
        if (a.group) this.hitGroups.add(a.group);
        if (b.shielded) { b.onBlocked(); this.float(b.x, b.y - 100, 'BLOCKED', '#ffd36e'); this.cfg.sound('hit'); this.spawn('spark', a.x + a.w / 2, a.y + a.h / 2, 6, 0xffd36e); continue; }
        const vulnerable = b.vulnerable;
        if (!vulnerable) continue;
        const kb = a.kb ? Math.sign(a.kb) * Math.min(Math.abs(a.kb), PLAYER.maxKnockbackPx) : 0;
        if (b.takeHit(a.dmg, kb)) {
          this.cfg.sound('hit');
          this.lastHitDmg = a.dmg;
          const hx = Math.max(b.bounds().x, Math.min(a.x + a.w / 2, b.bounds().x + b.bounds().w)), hy = a.y + a.h / 2;
          this.spawn('spark', hx, hy, a.basic ? 8 : 16, a.basic ? 0xffe066 : 0xff9b2f, a.basic ? 1 : 1.5);
          this.spawn('ring', hx, hy, 1, 0xffffff);
          this.comic(hx, hy - 30, a.style === 'beam' || a.style === 'bolt' || a.style === 'burn' ? 'energy' : a.basic && a.style !== 'power' && a.style !== 'blast' ? 'punch' : 'big');
          if (a.basic) {
            const g = this.meter.onBasicHit(a.id, this.elapsed, vulnerable, this.active);
            this.tut.punched = true;
          }
          if (a.freeze) { b.frozenT = a.freeze; b.slowT = a.freeze + 1.5; this.float(b.x, b.y - 120, 'FROZEN!', '#bfe9ff'); this.spawn('frost', b.x, b.y - 60, 18, 0x9be7ff, 1.2); this.spawn('ring', b.x, b.y - 60, 1, 0xe0f7ff); }
          if (a.style === 'crater' || a.style === 'titan') { this.spawn('dust', hx, b.y, 10, 0xd8d0f0); }
        }
      }
    }
    // Flame Blast fireballs burst when they hit something, reach a wall, or burn out
    for (const a of this.attacks) if (a.style === 'fire' && !a.done && (a.hit || a.t >= a.life || a.x < -10 || a.x + a.w > W + 10)) { a.done = true; a.t = a.life; this.cur = this.fighters[a.owner] ?? this.fighters[0]; this.flameBurst(a); }
    this.cur = prevCur;
    this.attacks = this.attacks.filter((a) => a.t < a.life && a.x > -100 && a.x < W + 100);
  }
  /** Ground Shockwave: rock spikes burst out of the floor one after another, racing away both ways. */
  shockwave(dmg: number, level: number) {
    const F = this.F, y = this.py, pl = this.standing;
    const lo = pl ? pl.x : 0, hi = pl ? pl.x + pl.w : W;
    const group = `sw${++this.attackSeq}`;
    const n = 7 + level; // more spikes at higher levels
    this.attacks.push({ owner: F.index, id: `pw${++this.attackSeq}`, group, style: 'spike', x: this.px - 34, y: y - 78, w: 68, h: 78, t: 0, life: 0.36, dmg, basic: false, kb: 0, hit: false });
    for (let i = 1; i <= n; i++) for (const d of [-1, 1]) {
      const x = this.px + d * i * 52;
      if (x < lo + 10 || x > hi - 10) continue;
      this.pending.push({ at: this.elapsed + i * 0.05, owner: F.index, fn: () => {
        const h = 70 - i * 2;
        this.attacks.push({ owner: F.index, id: `pw${++this.attackSeq}`, group, style: 'spike', x: x - 26, y: y - h, w: 52, h, t: 0, life: 0.34, dmg, basic: false, kb: d * 90, hit: false });
        if (i % 2 === 0) { this.ambientSpawn = true; this.spawn('dust', x, y, 3, 0xc9b08a); this.ambientSpawn = false; }
      } });
    }
    this.decals.push({ kind: 'crack', x: Math.max(lo, this.px - n * 52), y, w: Math.min(hi, this.px + n * 52) - Math.max(lo, this.px - n * 52), life: 2.5, max: 2.5 });
    this.spawn('dust', this.px, y, 16, 0xd8d0f0, 1.2); this.spawn('ring', this.px, y - 8, 1, 0xfde68a); this.spawn('spark', this.px, y - 10, 12, 0xb08158, 1.2);
    if (!this.cfg.reducedMotion) this.shakeAmt = Math.max(this.shakeAmt, 10);
    this.cfg.sound('hit');
  }
  flameBurst(a: PlayerAttack) {
    const cx = Math.max(20, Math.min(W - 20, a.x + a.w / 2)), cy = a.y + a.h / 2;
    this.attacks.push({ owner: a.owner, id: `pw${++this.attackSeq}`, style: 'boom', x: cx - 80, y: cy - 80, w: 160, h: 160, t: 0, life: 0.3, dmg: a.boom ?? 10, basic: false, kb: Math.sign(a.vx ?? 1) * 80, hit: false });
    const fy = cy > GROUND - 160 ? GROUND : null;
    const floorY = fy ?? GROUND;
    this.attacks.push({ owner: a.owner, id: `pw${++this.attackSeq}`, style: 'burn', x: cx - 75, y: floorY - 36, w: 150, h: 36, t: 0, life: 2.8, dmg: (a.boom ?? 10) * 0.25, basic: false, kb: 0, hit: false, rehit: 0.5 });
    this.decals.push({ kind: 'scorch', x: cx - 70, y: floorY, w: 140, life: 3.5, max: 3.5 });
    this.spawn('spark', cx, cy, 24, 0xff7a1a, 1.5); this.spawn('spark', cx, cy, 10, 0xffd23f, 0.9);
    this.spawn('ring', cx, cy, 1, 0xffb347); this.spawn('dust', cx, cy, 8, 0x5a3a2a);
    if (!this.cfg.reducedMotion) this.shakeAmt = Math.max(this.shakeAmt, 7);
    this.cfg.sound('hit');
  }
  /** Versus: an attack from one hero landing on the other (dodges and post-hit invulnerability still apply). */
  pvpHit(a: PlayerAttack) {
    if (this.ended || this.roundOver) return;
    const atk = this.cur;
    for (const f of this.fighters) {
      // the other hero's clone can be hit too
      if (f !== atk && f.playerDecoy && !(a.hitSet ?? []).includes(10 + f.index) && overlap(a, this.cloneRect(f.playerDecoy))) { (a.hitSet ??= []).push(10 + f.index); a.lastHit = a.t; this.hitClone(f); }
      if (f === atk || f.hp <= 0 || (a.hitSet ?? []).includes(f.index)) continue;
      if (a.group && this.hitGroups.has(`${a.group}:${f.index}`)) continue;
      if (!overlap(a, this.rectOf(f))) continue;
      (a.hitSet ??= []).push(f.index); a.lastHit = a.t;
      if (a.group) this.hitGroups.add(`${a.group}:${f.index}`);
      if (f.dodgeInvulnT > 0) { this.float(f.px, f.py - 100, 'Dodged!', '#59e3ff'); continue; }
      if (f.invulnT > 0) continue;
      this.cur = f;
      this.damagePlayer({ id: a.id, owner: 'boss', shape: 'rect', x: a.x, y: a.y, w: a.w, h: a.h, r: 0, vx: 0, vy: 0, t: 0, warn: 0, active: 0, dmg: a.dmg, style: 'punch', color: 0 });
      if (a.kb) f.pvx = Math.sign(a.kb) * Math.min(Math.abs(a.kb), PLAYER.maxKnockbackPx) * 3.2;
      this.cur = atk;
      this.spawn('spark', f.px, f.py - 50, a.basic ? 8 : 16, a.basic ? 0xffe066 : 0xff9b2f, a.basic ? 1 : 1.5);
      this.spawn('ring', f.px, f.py - 50, 1, 0xffffff);
      if (a.basic) atk.meter.onBasicHit(a.id, this.elapsed, true, this.active);
      this.comic(f.px, f.py - 90, a.style === 'beam' || a.style === 'bolt' || a.style === 'burn' ? 'energy' : a.basic && a.style !== 'power' && a.style !== 'blast' ? 'punch' : 'big');
      if (a.freeze) { f.frozenT = a.freeze; f.pvx = 0; f.laserKey = null; f.chanId = null; this.float(f.px, f.py - 120, 'FROZEN!', '#bfe9ff'); this.spawn('frost', f.px, f.py - 50, 18, 0x9be7ff, 1.2); this.spawn('ring', f.px, f.py - 50, 1, 0xe0f7ff); }
    }
  }

  updateMothDecoys(dt: number) {
    for (const d of this.ctx.mothDecoys) { d.t += dt; if (d.t > d.life) d.alive = false; d.y = this.boss.y + Math.sin(d.t * 2.2 + d.x) * 4; }
    if (this.ctx.mothDecoys.some((d) => !d.alive)) this.ctx.mothDecoys.splice(0, this.ctx.mothDecoys.length, ...this.ctx.mothDecoys.filter((d) => d.alive));
  }

  damagePlayer(h: Hazard) {
    if (this.dev.god) return;
    let dmg = h.dmg * (this.auraT > 0 ? 0.5 : 1);
    if (dmg <= 0) return;
    if (this.bonusShield > 0) { const a = Math.min(this.bonusShield, dmg); this.bonusShield -= a; dmg -= a; }
    if (this.shield > 0) { const a = Math.min(this.shield, dmg); this.shield -= a; dmg -= a; this.shieldIdle = 0; if (a) this.spawn('ring', this.px, this.py - 44, 1, 0x59e3ff); }
    this.shieldIdle = 0;
    if (dmg > 0) {
      this.hp = Math.max(0, this.hp - dmg);
      if (this.multi !== 'versus') this.comic(this.px, this.py - 100, 'hurt');
    }
    if (h.slow) { this.slowT = h.slow; this.float(this.px, this.py - 110, 'Chilled!', '#bfe9ff'); }
    this.invulnT = PLAYER.hurtInvuln; this.hurtT = 0.35;
    const away = Math.sign(this.px - (h.shape === 'circle' ? h.x : h.x + h.w / 2)) || -this.facing;
    this.pvx = away * 160; if (this.onGround) this.pvy = -180;
    this.cfg.sound('hurt');
    this.spawn('spark', this.px, this.py - 40, 10, 0xff6b6b);
    if (!this.cfg.reducedMotion) this.shakeAmt = Math.max(this.shakeAmt, 5);
  }

  updateHazards(dt: number) {
    for (const h of this.hazards) {
      h.t += dt;
      if (h.t >= h.warn) {
        if (h.ballistic) { h.vy += 1100 * dt; if (h.y + h.vy * dt >= GROUND - h.r) { h.y = GROUND - h.r; if (h.vy > 200) { this.spawn('dust', h.x, GROUND, 6, 0xd9b48a); this.shakeAmt = Math.max(this.shakeAmt, this.cfg.reducedMotion ? 0 : 4); } h.vy = 0; } }
        h.x += h.vx * dt; h.y += h.vy * dt;
      }
      if (h.gravity && h.t >= h.warn && h.y >= GROUND - h.r) { h.hit = true; this.shakeAmt = Math.max(this.shakeAmt, this.cfg.reducedMotion ? 0 : 3); }
    }
    // collisions, for every hero still standing (each hero tracks its own hits and dodges)
    this.each((f) => {
      const pr = this.playerRect();
      for (const h of this.hazards) {
        const live = h.t >= h.warn && h.t < h.warn + h.active;
        if (!live || h.dmg <= 0) continue;
        const touching = h.shape === 'rect' ? overlap(h, pr) : circleRect(h.x, h.y, h.r, pr);
        if (h.style === 'band' && h.gap && this.px > h.gap.x && this.px < h.gap.x + h.gap.w) continue;
        if (!touching) continue;
        const tag = (h as any) as { hitBy?: number[]; dodgedBy?: number[]; lastHitBy?: Record<number, number> };
        if (this.dodgeInvulnT > 0) {
          // a well-timed dodge through a real attack: reward once per avoided attack
          if (!(tag.dodgedBy ?? []).includes(f.index)) { (tag.dodgedBy ??= []).push(f.index); h.dodged = true; const g = this.meter.onPerfectDodge(`${h.id}:${f.index}`, this.active); if (g) this.float(this.px, this.py - 100, 'Perfect dodge!', '#59e3ff'); }
          continue;
        }
        if (this.invulnT > 0) continue; // brief invulnerability after being hit
        if ((tag.dodgedBy ?? []).includes(f.index)) continue;
        if (h.repeat) { const lh = tag.lastHitBy?.[f.index]; if (lh !== undefined && this.elapsed - lh < h.repeat) continue; (tag.lastHitBy ??= {})[f.index] = this.elapsed; }
        else if ((tag.hitBy ?? []).includes(f.index)) continue;
        if (!h.repeat) (tag.hitBy ??= []).push(f.index);
        this.damagePlayer(h);
        if (h.destroyOnHit) { h.hit = true; h.t = 1e9; }
      }
      // the clone soaks up attacks aimed at it (each attack counts once)
      if (this.playerDecoy) for (const h of this.hazards) {
        const live = h.t >= h.warn && h.t < h.warn + h.active;
        if (!live || h.dmg <= 0 || !this.playerDecoy) continue;
        const tag = (h as any) as { cloneHit?: number[] };
        if ((tag.cloneHit ?? []).includes(f.index)) continue;
        const r = this.cloneRect(this.playerDecoy);
        if (h.shape === 'rect' ? overlap(h, r) : circleRect(h.x, h.y, h.r, r)) { (tag.cloneHit ??= []).push(f.index); this.hitClone(f); if (h.destroyOnHit) h.t = 1e9; }
      }
    });
    for (const h of this.hazards) if (h.gap) h.gap.x = Math.max(0, Math.min(W - h.gap.w, h.gap.x + h.gap.vx * dt));
    this.hazards = this.hazards.filter((h) => h.t < h.warn + h.active && !(h.hit && (h.destroyOnHit || h.gravity)) && h.x > -200 && h.x < W + 200 && h.y < H + 100);
  }

  updateEnv(dt: number) {
    if (this.cfg.mode === 'training' || this.cfg.mode === 'tutorial') return;
    const tier = this.ctx.tier;
    const warnMul = Math.max(1, this.ctx.telegraphMul);
    if (this.arena.vents?.length) {
      this.ventT -= dt;
      if (this.ventT <= 0) {
        this.ventT = 5.5 + this.ctx.rng() * 2.5;
        const v = this.arena.vents[Math.floor(this.ctx.rng() * this.arena.vents.length)];
        this.addHazard({ owner: 'env', shape: 'rect', style: 'burst', x: v.x, y: GROUND - 190, w: v.w, h: 190, warn: 1.3 * warnMul, active: 0.6, dmg: Math.round(this.ctx.damage * 0.55), color: 0xff7a1a });
      }
    }
    if (this.arena.rockfall) {
      this.rockT -= dt;
      if (this.rockT <= 0) {
        this.rockT = 6 + this.ctx.rng() * 3;
        const x = 70 + this.ctx.rng() * (W - 140);
        this.addHazard({ owner: 'env', shape: 'circle', style: 'debris', x, y: GROUND - 18, r: 28, warn: 1.4 * warnMul, active: 0.3, dmg: Math.round(this.ctx.damage * 0.5), color: 0x8a6a4f });
      }
    }
    if (tier.hazards || this.ctx.extraHazards) {
      this.envT -= dt;
      if (this.envT <= 0) {
        this.envT = 7 + this.ctx.rng() * 3;
        const warn = Math.max(1.0, 1.4 * this.ctx.telegraphMul);
        const xs = [60 + this.ctx.rng() * (W - 120)];
        xs.push((xs[0] + W / 2) % (W - 80) + 40);
        for (const x of xs) this.addHazard({ owner: 'env', shape: 'circle', style: 'debris', x, y: GROUND - 18, r: 30, warn, active: 0.3, dmg: Math.round(this.ctx.damage * 0.6), color: 0xbbbbbb });
      }
    }
    if (tier.feints) { // Champion+: a floor band with a moving safe window (platforms are always safe too)
      this.bandT -= dt;
      if (this.bandT <= 0) {
        this.bandT = 13 + this.ctx.rng() * 4;
        const warn = Math.max(1.6, 2.0 * this.ctx.telegraphMul);
        const gx = this.ctx.rng() * (W - 220);
        this.addHazard({ owner: 'env', shape: 'rect', style: 'band', x: 0, y: GROUND - 24, w: W, h: 24, warn, active: 0.5, dmg: Math.round(this.ctx.damage * 0.6), color: 0xff6b6b, gap: { x: gx, w: 200, vx: gx > W / 2 - 100 ? -50 : 50 } });
      }
    }
  }

  updateCoach() {
    if (this.cfg.mode !== 'tutorial') return;
    const steps: [string, () => boolean][] = [
      ['Move with ← → (or the arrow buttons).', () => this.tut.moved > 140],
      ['Jump with Space (or ⤒). The platforms are optional.', () => this.tut.jumped],
      ['Punch with J (or 👊). Punches are always free.', () => this.tut.punched],
      ['Dodge with K (or 💨) — you are safe while dodging.', () => this.tut.dodged],
      ['Watch the RED striped marker: jump or dodge away, then punch while the bot is recovering.', () => false],
    ];
    while (this.coachStep < steps.length - 1 && steps[this.coachStep][1]()) this.coachStep++;
    this.coach = steps[this.coachStep][0];
  }

  // ---------- rendering ----------
  drawBackground() {
    const key = `bg-${this.arena.key}`;
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, W, H)!;
      paintArena(tex.getContext(), this.arena.key);
      tex.refresh();
    }
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
    this.bg.setDepth(1);
  }

  // ---------- particles ----------
  spawn(kind: Particle['kind'], x: number, y: number, n: number, color = 0xffffff, spread = 1) {
    if (this.netRec && !this.ambientSpawn) this.netEvents.push(['spawn', [kind, x, y, n, color, spread]]);
    if (this.cfg.reducedMotion && kind !== 'ring') n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, sp = (60 + Math.random() * 220) * spread;
      const p: Particle = { kind, x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0.35 + Math.random() * 0.3, max: 0, color, size: 3 + Math.random() * 3 };
      if (kind === 'dust') { p.vx = (Math.random() - 0.5) * 160; p.vy = -20 - Math.random() * 50; p.size = 5 + Math.random() * 6; p.life = 0.5; }
      if (kind === 'streak') { p.vx = 0; p.vy = 0; p.size = 30 + Math.random() * 30; p.life = 0.18; }
      if (kind === 'ring') { p.vx = 0; p.vy = 0; p.size = 10; p.life = 0.35; }
      if (kind === 'ember') { p.vx = (Math.random() - 0.5) * 30; p.vy = -30 - Math.random() * 60; p.life = 2 + Math.random() * 2; p.size = 1.5 + Math.random() * 2; }
      if (kind === 'snow') { p.vx = -10 + Math.random() * 20; p.vy = 25 + Math.random() * 30; p.life = 8; p.size = 1.5 + Math.random() * 2; }
      if (kind === 'flame') { p.vx = (Math.random() - 0.5) * 30; p.vy = -40 - Math.random() * 50; p.life = 0.35 + Math.random() * 0.2; p.size = 4 + Math.random() * 3; }
      if (kind === 'frost') { p.vx *= 0.35; p.vy = p.vy * 0.25 + 20; p.life = 0.55 + Math.random() * 0.4; p.size = 3 + Math.random() * 4; }
      if (kind === 'twinkle') { p.vx = 0; p.vy = 0; p.life = 1 + Math.random(); p.size = 1 + Math.random() * 2.5; }
      p.max = p.life;
      this.particles.push(p);
    }
  }
  updateParticles(dt: number) {
    this.ambientT -= dt;
    if (this.ambientT <= 0 && !this.cfg.reducedMotion) {
      this.ambientSpawn = true;
      this.ambientT = 0.12;
      const k = this.arena.key;
      if (k === 'foundry') this.spawn('ember', Math.random() * W, GROUND - 6, 1, Math.random() > 0.5 ? 0xffb347 : 0xff6a1a);
      if (k === 'lab') this.spawn('snow', Math.random() * W, -5, 1, 0xffffff);
      if (k === 'observatory' || k === 'theater') this.spawn('twinkle', Math.random() * W, Math.random() * 300, 1, k === 'theater' ? 0xff7ce0 : 0xffffff);
      if (k === 'quarry' && Math.random() < 0.3) this.spawn('dust', Math.random() * W, GROUND - 2, 1, 0xd9b48a);
      this.ambientSpawn = false;
    }
    for (const p of this.particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'spark') { p.vx *= 0.9; p.vy = p.vy * 0.9 + 300 * dt; }
      if (p.kind === 'dust') { p.vx *= 0.92; p.size += dt * 10; }
      if (p.kind === 'ring') p.size += dt * 160;
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y < H + 20);
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }
  drawParticles() {
    const g = this.fx; g.clear();
    for (const p of this.particles) {
      const f = Math.max(0, p.life / p.max);
      switch (p.kind) {
        case 'spark': g.fillStyle(p.color, f); g.fillCircle(p.x, p.y, p.size * f + 1); g.fillStyle(0xffffff, f); g.fillCircle(p.x, p.y, p.size * f * 0.4 + 0.5); break;
        case 'dust': g.fillStyle(p.color, 0.45 * f); g.fillCircle(p.x, p.y, p.size); break;
        case 'streak': g.fillStyle(0xffffff, 0.6 * f); g.fillRect(p.x - p.size / 2, p.y, p.size, 3); break;
        case 'ring': g.lineStyle(4 * f + 1, p.color, f); g.strokeCircle(p.x, p.y, p.size); break;
        case 'ember': g.fillStyle(p.color, Math.min(1, f * 2)); g.fillCircle(p.x, p.y, p.size); break;
        case 'flame': g.fillStyle(p.color, 0.8 * f); g.fillCircle(p.x, p.y, p.size * (0.4 + 0.6 * f)); g.fillStyle(0xfff3b0, 0.7 * f); g.fillCircle(p.x, p.y + 1, p.size * 0.4 * f); break;
        case 'snow': g.fillStyle(p.color, 0.8); g.fillCircle(p.x + Math.sin(p.life * 2 + p.vx) * 6, p.y, p.size); break;
        case 'frost': {
          // a spinning six-pointed ice crystal
          const a = p.life * 5 + p.vx, rr = p.size * (0.5 + 0.5 * f);
          g.lineStyle(1.6, 0xffffff, 0.95 * f);
          for (let i = 0; i < 3; i++) { const t = a + (i * Math.PI) / 3; g.lineBetween(p.x - Math.cos(t) * rr, p.y - Math.sin(t) * rr, p.x + Math.cos(t) * rr, p.y + Math.sin(t) * rr); }
          g.fillStyle(p.color, 0.9 * f); g.fillCircle(p.x, p.y, rr * 0.3 + 0.6);
          break;
        }
        case 'twinkle': { const a = Math.sin((1 - f) * Math.PI); g.fillStyle(p.color, a); g.fillCircle(p.x, p.y, p.size); g.fillRect(p.x - p.size * 2.5, p.y - 0.5, p.size * 5, 1); g.fillRect(p.x - 0.5, p.y - p.size * 2.5, 1, p.size * 5); break; }
      }
    }
    if (this.flashT > 0) { g.fillStyle(0xffffff, this.flashT * 0.6); g.fillRect(-20, -20, W + 40, H + 40); }
  }

  render() {
    const g = this.g;
    g.clear();
    const sx = this.shakeAmt ? (Math.random() - 0.5) * this.shakeAmt : 0, sy = this.shakeAmt ? (Math.random() - 0.5) * this.shakeAmt : 0;
    this.cameras.main.setScroll(sx, sy);
    const ph = this.elapsed;
    // slippery patches (snowflake stripes) and heavy gravity zones (down arrows)
    for (const z of this.ctx.slippery) { stripes(g, z.x, GROUND - 6, z.w, 10, 0xe8f8ff, 0.9, 0); g.fillStyle(0xffffff, 0.9); for (let x = z.x + 12; x < z.x + z.w; x += 28) { g.fillCircle(x, GROUND - 14, 3); g.lineStyle(2, 0xffffff, 0.9); g.lineBetween(x - 6, GROUND - 14, x + 6, GROUND - 14); g.lineBetween(x, GROUND - 20, x, GROUND - 8); } }
    for (const z of this.ctx.heavy) {
      const on = z.on;
      const blink = !on && Math.floor(ph * 6) % 2 === 0;
      g.fillStyle(0x7a3cc9, on ? 0.28 : blink ? 0.2 : 0.08); g.fillRect(z.x, 0, z.w, GROUND);
      g.lineStyle(4, 0xb9a8ff, on ? 0.9 : 0.6);
      for (let x = z.x + 40; x < z.x + z.w; x += 90) for (let y = 120 + ((ph * 80) % 90); y < GROUND - 20; y += 90) { g.lineBetween(x, y, x, y + 26); g.lineBetween(x - 10, y + 16, x, y + 26); g.lineBetween(x + 10, y + 16, x, y + 26); }
      const safeX = z.x === 0 ? W / 2 : 0;
      g.lineStyle(3, 0x2fcf7a, 0.9); g.strokeRect(safeX + 6, 110, W / 2 - 12, GROUND - 116);
    }
    // floor gadgets
    for (const c of this.arena.conveyors ?? []) {
      g.fillStyle(0x1b1446, 1); g.fillRect(c.x - 2, GROUND - 8, c.w + 4, 10);
      g.fillStyle(0x52525b, 1); g.fillRect(c.x, GROUND - 6, c.w, 7);
      g.lineStyle(3, 0xfacc15, 0.9);
      const dir = Math.sign(c.v), off = (ph * Math.abs(c.v) * 0.6) % 26;
      for (let x = c.x + (dir > 0 ? off : 26 - off); x < c.x + c.w - 8; x += 26) { g.lineBetween(x, GROUND - 5, x + dir * 7, GROUND - 2); g.lineBetween(x + dir * 7, GROUND - 2, x, GROUND + 1); }
    }
    for (const pad of this.arena.pads ?? []) {
      const squash = this.padFlash > 0 && Math.abs(this.px - (pad.x + pad.w / 2)) < 60 ? 4 : 0;
      g.fillStyle(0x1b1446, 1); g.fillRoundedRect(pad.x - 3, GROUND - 16 + squash, pad.w + 6, 18 - squash, 6);
      g.fillStyle(0xfacc15, 1); g.fillRoundedRect(pad.x, GROUND - 14 + squash, pad.w, 8, 4);
      g.fillStyle(0xef4444, 1); g.fillRoundedRect(pad.x + 4, GROUND - 7, pad.w - 8, 6, 3);
      g.lineStyle(3, 0xfde047, 0.5 + Math.sin(ph * 6) * 0.3); const cx = pad.x + pad.w / 2; g.lineBetween(cx - 8, GROUND - 26, cx, GROUND - 36); g.lineBetween(cx, GROUND - 36, cx + 8, GROUND - 26);
    }
    for (const v of this.arena.vents ?? []) {
      g.fillStyle(0x1b1446, 1); g.fillRoundedRect(v.x - 4, GROUND - 10, v.w + 8, 12, 4);
      g.fillStyle(0x7c2d12, 1); g.fillRoundedRect(v.x, GROUND - 8, v.w, 8, 3);
      g.fillStyle(0xfb923c, 0.4 + Math.sin(ph * 5 + v.x) * 0.2); for (let x = v.x + 6; x < v.x + v.w - 4; x += 10) g.fillRect(x, GROUND - 7, 4, 6);
    }
    // scorch marks, craters and ice trails left by abilities
    for (const d of this.decals) {
      const k = Math.min(1, d.life / Math.min(1, d.max)), cx = d.x + d.w / 2;
      if (d.kind === 'crater') {
        g.fillStyle(0x1b1020, 0.55 * k); g.fillEllipse(cx, d.y + 2, d.w, 22);
        g.fillStyle(0x3a2a20, 0.6 * k); g.fillEllipse(cx, d.y + 1, d.w * 0.7, 14);
        g.lineStyle(3, 0x1b1020, 0.8 * k);
        for (let i = -2; i <= 2; i++) { const x0 = cx + i * d.w * 0.12; g.lineBetween(x0, d.y, x0 + i * 14, d.y - 10 - Math.abs(i) * 3); }
        g.fillStyle(0x8a6a4f, k); for (let i = 0; i < 6; i++) g.fillTriangle(cx - d.w / 2 + i * d.w / 5, d.y, cx - d.w / 2 + i * d.w / 5 + 10, d.y, cx - d.w / 2 + i * d.w / 5 + 5, d.y - 8 - (i % 2) * 5);
      } else if (d.kind === 'crack') {
        g.lineStyle(3, 0x1b1020, 0.7 * k);
        let x = d.x, y = d.y - 1; while (x < d.x + d.w) { const nx = x + 14 + (x % 7); const ny = d.y - 1 - ((nx * 13) % 5); g.lineBetween(x, y, Math.min(nx, d.x + d.w), ny); x = nx; y = ny; }
      } else if (d.kind === 'scorch') {
        g.fillStyle(0x24140c, 0.5 * k); g.fillEllipse(cx, d.y + 2, d.w, 16);
        g.fillStyle(0xff6a1a, 0.25 * k * (0.7 + 0.3 * Math.sin(ph * 12))); g.fillEllipse(cx, d.y + 1, d.w * 0.6, 8);
      } else {
        // glossy ice sheet
        g.fillStyle(0x7dd3fc, 0.35 * k); g.fillRoundedRect(d.x - 4, d.y - 6, d.w + 8, 10, 5);
        g.fillStyle(0xdff6ff, 0.7 * k); g.fillRoundedRect(d.x, d.y - 5, d.w, 7, 4);
        g.fillStyle(0xffffff, 0.85 * k); g.fillRect(d.x + 6, d.y - 4, d.w - 12, 1.5);
        for (let x = d.x + 18; x < d.x + d.w - 10; x += 46) { g.fillStyle(0xffffff, 0.6 * k * (0.5 + 0.5 * Math.sin(ph * 4 + x))); g.fillRect(x, d.y - 3, 12, 1.5); }
        // clusters of ice crystals that shrink as they melt
        const grow = Math.min(1, (d.max - d.life) / 0.12) * Math.min(1, d.life / 0.8);
        for (let x = d.x + 14; x < d.x + d.w - 8; x += 38) {
          const hgt = (14 + ((x * 7) % 13)) * grow;
          g.fillStyle(0xbfe9ff, 0.85 * k); g.lineStyle(1.5, 0xffffff, 0.9 * k);
          g.fillTriangle(x - 6, d.y - 3, x + 6, d.y - 3, x, d.y - 3 - hgt); g.strokeTriangle(x - 6, d.y - 3, x + 6, d.y - 3, x, d.y - 3 - hgt);
          g.fillStyle(0xe0f7ff, 0.85 * k);
          g.fillTriangle(x + 3, d.y - 3, x + 11, d.y - 3, x + 10, d.y - 3 - hgt * 0.6);
          g.fillTriangle(x - 3, d.y - 3, x - 10, d.y - 3, x - 9, d.y - 3 - hgt * 0.5);
          g.fillStyle(0xffffff, 0.8 * k); g.fillRect(x - 1, d.y - 3 - hgt * 0.8, 1.5, hgt * 0.5);
        }
      }
    }
    // platforms, styled per arena
    const ps = this.arena.plat;
    const pal: Record<string, [number, number, number]> = { metal: [0x6b7bb8, 0x3b3f63, 0x67e8f9], stone: [0xb08158, 0x6b4428, 0xfde68a], ice: [0xbae6fd, 0x38bdf8, 0xffffff], neon: [0x581c87, 0x2e1065, 0xf472b6], cosmic: [0x4338ca, 0x1e1b4b, 0xfacc15], steel: [0x57534e, 0x292524, 0xfb923c], gym: [0x818cf8, 0x4338ca, 0xe0e7ff] };
    const [top, side, accent] = pal[ps] ?? pal.metal;
    for (const pl of this.arena.platforms) {
      const broken = (pl.brokenT ?? 0) > 0;
      const shakeX = pl.crumble && (pl.crumbleT ?? 0) > 0 && !broken ? (Math.random() - 0.5) * 4 : 0;
      const x = pl.x + shakeX, y = pl.y;
      if (broken) { g.lineStyle(2, accent, 0.35); for (let i = 0; i < pl.w; i += 12) g.lineBetween(x + i, y + 6, x + i + 6, y + 6); continue; }
      g.fillStyle(0x000000, 0.22); g.fillEllipse(x + pl.w / 2, y + 34, pl.w * 0.85, 10);
      g.fillStyle(0x1b1446, 1); g.fillRoundedRect(x - 3, y - 3, pl.w + 6, 24, 8);
      g.fillStyle(side, 1); g.fillRoundedRect(x, y + 6, pl.w, 12, { tl: 0, tr: 0, bl: 7, br: 7 });
      g.fillStyle(top, 1); g.fillRoundedRect(x, y, pl.w, 9, { tl: 6, tr: 6, bl: 0, br: 0 });
      g.fillStyle(0xffffff, 0.45); g.fillRect(x + 6, y + 2, pl.w - 12, 2);
      if (ps === 'neon' || ps === 'cosmic' || ps === 'metal') { g.lineStyle(2, accent, 0.85); g.lineBetween(x + 4, y + 17, x + pl.w - 4, y + 17); }
      if (ps === 'ice') { g.fillStyle(0xffffff, 0.9); for (let i = 8; i < pl.w - 8; i += 18) g.fillTriangle(x + i, y + 18, x + i + 8, y + 18, x + i + 4, y + 26 + (i % 3) * 3); }
      if (ps === 'stone' && pl.crumble) { g.lineStyle(2, 0x3b2414, 0.9); g.lineBetween(x + pl.w * 0.3, y, x + pl.w * 0.38, y + 16); g.lineBetween(x + pl.w * 0.62, y + 2, x + pl.w * 0.55, y + 16); }
      if (pl.vy) { g.lineStyle(2, accent, 0.4); g.lineBetween(x + pl.w / 2, y + 22, x + pl.w / 2, GROUND); }
      if (pl.vx || pl.vy) { g.fillStyle(accent, 0.9); g.fillCircle(x + 8, y + 12, 3); g.fillCircle(x + pl.w - 8, y + 12, 3); }
    }
    // hazards: telegraph first (outlines, stripes, arrows), then active
    for (const h of this.hazards) this.drawHazard(h, ph);
    this.challenge?.render(g);
    // moth decoys (no shadow) and the hologram
    const bossStyle = this.boss.style;
    this.sprDecoys.forEach((sp, i) => { const d = this.ctx.mothDecoys[i]; if (d) sp.draw(figureShapes(bossStyle, this.boss.anim, this.boss.animT), d.x, d.y, this.boss.facing, this.boss.scale, { alpha: 0.95 }); else sp.hide(); });
    // boss (with floor shadow — the real Prism Moth's tell)
    const b = this.boss;
    g.fillStyle(0x000000, 0.45); g.fillEllipse(b.x, GROUND + 3, 56 * b.scale, 12);
    if (b.alpha > 0.3 && b.state !== 'defeated') { g.lineStyle(2, 0xffffff, 0.75); g.strokeEllipse(b.x, GROUND + 3, 56 * b.scale, 12); }
    if (b.alpha > 0.02) this.sprBoss.draw(figureShapes(b.style, b.anim, b.animT), b.x, b.y, b.facing, b.scale, { alpha: b.alpha, flash: b.hurtFlash > 0 }); else this.sprBoss.hide();
    const gt = this.gTop; gt.clear();
    if (b.shielded) { gt.lineStyle(4, 0xffd36e, 0.9); gt.fillStyle(0xffd36e, 0.18); const pts: { x: number; y: number }[] = []; for (let i = 0; i < 6; i++) pts.push({ x: b.x + Math.cos(i * Math.PI / 3) * 60, y: b.y - 50 + Math.sin(i * Math.PI / 3) * 60 }); gt.fillPoints(pts, true); gt.strokePoints(pts, true); }
    if (b.frozenT > 0 && b.state !== 'defeated') this.iceBlock(gt, b.bounds());
    else if (b.slowT > 0) { gt.lineStyle(2, 0xbfe9ff, 0.9); gt.strokeCircle(b.x, b.y - 50, 46); }
    if (b.state === 'recover') { gt.fillStyle(0xffe066, 1); for (let i = 0; i < 3; i++) { const a = ph * 4 + i * 2.1; gt.fillCircle(b.x + Math.cos(a) * 22, b.y - 104 * b.scale + Math.sin(a) * 6, 4); } }
    // heroes
    this.each(() => {
      const f = this.F;
      const c = this.playerDecoy;
      if (c) {
        const flick = c.hurtT > 0 && Math.floor(ph * 18) % 2 === 0;
        g.fillStyle(0x7df9ff, 0.25); g.fillEllipse(c.x, GROUND + 3, 40, 9);
        this.sprHolo.draw(heroShapes(this.F.appearance, c.anim, c.anim === 'run' ? c.animT * 1.4 : c.animT), c.x, c.y, c.face, PS, { alpha: flick ? 0.3 : 0.72 + Math.sin(ph * 20) * 0.08, tint: 0x7df9ff });
        // scan lines and remaining hits
        gt.lineStyle(1, 0xe6ffff, 0.25); for (let y = c.y - 104; y < c.y; y += 7) gt.lineBetween(c.x - 22, y + ((ph * 40) % 7), c.x + 22, y + ((ph * 40) % 7));
        for (let i = 0; i < 3; i++) { gt.fillStyle(i < 3 - c.hits ? 0x7df9ff : 0x2d2756, 1); gt.fillCircle(c.x - 12 + i * 12, c.y - 122, 4); gt.lineStyle(2, 0x1b1446, 1); gt.strokeCircle(c.x - 12 + i * 12, c.y - 122, 4); }
      } else this.sprHolo.hide();
      // afterimages / flame streaks (local visuals only)
      const fdt = Math.min(0.05, this.game.loop.delta / 1000);
      const zooming = this.speedBoost() > 1 && Math.abs(this.pvx) > this.stats.runSpeed * 1.1 && this.onGround;
      if (zooming && Math.random() < 0.5 && !this.paused) { this.ambientSpawn = true; this.spawn('streak', this.px - Math.sign(this.pvx) * 30, this.py - 14 - Math.random() * 60, 1); this.ambientSpawn = false; }
      // rocket boots: a harmless trail of little flames while moving or in the air
      if (f.appearance.boots === 'rocket' && (f.appearance.shape ?? 'hero') === 'hero' && (Math.abs(this.pvx) > 30 || !this.onGround) && !this.paused && Math.random() < 0.7) {
        this.ambientSpawn = true; this.spawn('flame', this.px - this.facing * 6 + (Math.random() - 0.5) * 10, this.py - 2, 1, Math.random() < 0.5 ? 0xff7a1a : 0xffd23f); this.ambientSpawn = false;
      }
      // Hover: a glowing energy disc under the feet, rising sparkles, and a ring showing hover time left
      if (f.hovering) {
        const fy = this.py + 4, pul = 0.75 + 0.25 * Math.sin(this.elapsed * 14);
        g.fillStyle(0x7df9ff, 0.18 * pul); g.fillEllipse(this.px, fy + 6, 92, 26);
        g.fillStyle(0xbff8ff, 0.5 * pul); g.fillEllipse(this.px, fy, 58, 12);
        g.lineStyle(2, 0xffffff, 0.85); g.strokeEllipse(this.px, fy, 58, 12);
        g.lineStyle(2, 0x7df9ff, 0.5); g.strokeEllipse(this.px, fy + 10, 74 + 8 * pul, 16);
        for (let i = 0; i < 3; i++) { const t = (this.elapsed * 1.6 + i / 3) % 1; g.fillStyle(0xe0fdff, 0.7 * (1 - t)); g.fillRect(this.px - 22 + i * 22, fy + 18 - t * 26, 2, 8); }
        const left = f.hoverFuel / Math.max(0.01, this.hoverMax());
        g.lineStyle(4, 0x1b1446, 0.6); g.beginPath(); g.arc(this.px, this.py - 118, 9, 0, Math.PI * 2); g.strokePath();
        g.lineStyle(3, left > 0.3 ? 0x7df9ff : 0xffb347, 1); g.beginPath(); g.arc(this.px, this.py - 118, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); g.strokePath();
        if (!this.paused && Math.random() < 0.5) { this.ambientSpawn = true; this.spawn('twinkle', this.px + (Math.random() - 0.5) * 50, fy + 4, 1, 0xbff8ff); this.ambientSpawn = false; }
      }
      const streaking = zooming || f.novaT > 0 || this.phaseT > 0 || f.meteor?.phase === 'dive' || (this.dodgeT > 0 && this.attacks.some((a) => a.owner === f.index && a.style === 'dash'));
      f.trailT -= fdt;
      if (streaking && f.trailT <= 0 && !this.paused) { f.trailT = 0.035; f.trail.push({ x: this.px, y: this.py, life: 0.32, face: this.facing, fire: f.novaT > 0 || !!f.meteor }); }
      for (const t of f.trail) t.life -= fdt;
      f.trail = f.trail.filter((t) => t.life > 0).slice(-14);
      if (f.novaT > 0 || f.meteor) {
        // flame tail behind the hero
        for (const t of f.trail) { if (!t.fire) continue; const k = t.life / 0.32; g.fillStyle(0xff4d1f, 0.35 * k); g.fillCircle(t.x, t.y - 42, 18 + 26 * k); g.fillStyle(0xffd23f, 0.45 * k); g.fillCircle(t.x, t.y - 42, 8 + 12 * k); }
        f.sprAfter.forEach((sp) => sp.hide());
      } else {
        const ghosts = f.trail.filter((t, i) => !t.fire && i % 3 === 0).slice(-4);
        const tint = this.phaseT > 0 ? 0xc4b5fd : 0xbfe9ff;
        f.sprAfter.forEach((sp, i) => { const t = ghosts[i]; if (t) sp.draw(heroShapes(this.F.appearance, 'dodge', ph), t.x, t.y, t.face, PS, { alpha: 0.45 * (t.life / 0.32), tint }); else sp.hide(); });
      }
      g.fillStyle(0x000000, 0.35); g.fillEllipse(this.px, (this.standing ? this.standing.y : GROUND) + 3, 40, 9);
      const lost = this.multi === 'versus' ? this.hp <= 0 : this.hp <= 0 || f.ko;
      const won = this.ended && !lost && (this.multi !== 'versus' || f.wins >= 2);
      const anim: Anim = lost ? 'hurt' : won || (this.roundOver && this.hp > 0) ? 'victory' : this.hurtT > 0 ? 'hurt' : this.dodgeT > 0 ? 'dodge' : this.actionAnim ?? (!this.onGround ? (this.pvy < 0 || this.F.hovering ? 'jump' : 'fall') : this.F.inp.down ? 'crouch' : Math.abs(this.pvx) > 20 ? 'run' : 'idle');
      const spinFace = this.facing;
      const blink = this.invulnT > 0 && Math.floor(ph * 16) % 2 === 0;
      if (this.dodgeT > 0) this.sprGhost.draw(heroShapes(this.F.appearance, 'dodge', ph), this.px - this.facing * 26, this.py, this.facing, PS, { alpha: 0.35, tint: this.phaseT > 0 ? 0x86efac : 0xc4b5fd }); else this.sprGhost.hide();
      const calm = anim === 'meditate';
      if (calm) {
        // golden calm: soft glow, slow ripples, and sparks of adrenaline drifting up around the hero
        const cx = this.px, cy = this.py - 40, pulse = 0.5 + 0.5 * Math.sin(ph * 3);
        g.fillStyle(0xffd23f, 0.12 + 0.08 * pulse); g.fillCircle(cx, cy, 70);
        g.fillStyle(0xff9b2f, 0.1 + 0.06 * pulse); g.fillCircle(cx, cy, 48);
        for (let i = 0; i < 3; i++) { const k = ((ph * 0.6 + i / 3) % 1); g.lineStyle(3 * (1 - k) + 1, 0xffe9a8, 0.7 * (1 - k)); g.strokeEllipse(cx, this.py + 2, 50 + 120 * k, 12 + 26 * k); }
        g.fillStyle(0xffd23f, 0.35); g.fillEllipse(cx, this.py + 2, 70, 12);
        if (Math.random() < 0.35 && !this.paused) { this.ambientSpawn = true; this.spawn('ember', cx + (Math.random() - 0.5) * 80, this.py - Math.random() * 20, 1, Math.random() < 0.5 ? 0xffd23f : 0xff9b2f); this.ambientSpawn = false; }
        for (let i = 0; i < 5; i++) { const a = ph * 1.6 + i * 1.256; gt.fillStyle(0xfff3b0, 0.85); gt.fillCircle(cx + Math.cos(a) * 46, cy + Math.sin(a) * 16 - 6, 3); }
      }
      this.sprPlayer.draw(heroShapes(this.F.appearance, anim, anim === 'run' ? ph * (0.6 + this.stats.speedMult * 0.4) : ph), this.px, this.py - (calm ? 14 + Math.sin(ph * 2.4) * 4 : 0), spinFace, PS, { alpha: f.ko ? 0.45 : this.phaseT > 0 ? 0.35 : blink ? 0.4 : 1 });
      if (this.chargeT > 0.25) {
        const full = this.chargeT >= 0.6, k = Math.min(1, (this.chargeT - 0.25) / 0.35);
        const fx = this.px - this.facing * 14, fy = this.py - 70;
        gt.fillStyle(full ? 0xffd23f : 0xfde68a, 0.35 + 0.25 * Math.sin(ph * 30)); gt.fillCircle(fx, fy, 10 + k * 16);
        gt.lineStyle(3, full ? 0xffffff : 0xffd23f, 0.9); gt.strokeCircle(fx, fy, 10 + k * 16);
        if (full && Math.random() < 0.4) this.spawn('spark', fx, fy, 1, 0xffd23f, 0.4);
      }
      if (f.novaT > 0 || (f.meteor && f.meteor.phase !== 'hang')) {
        // the hero is wrapped in fire
        const cx = this.px, cy = this.py - 44, fl = 0.85 + Math.sin(ph * 30) * 0.15;
        const dx = f.meteor ? (f.meteor.phase === 'up' ? 0 : Math.sign(f.meteor.tx - this.px) * 0.6) : f.novaDx, dy = f.meteor ? (f.meteor.phase === 'up' ? -1 : 0.8) : f.novaDy;
        gt.fillStyle(0xff4d1f, 0.32 * fl); gt.fillCircle(cx, cy, 62);
        gt.fillStyle(0xff9b2f, 0.4 * fl); gt.fillCircle(cx, cy, 46);
        for (let i = 0; i < 5; i++) { const a = Math.atan2(-dy, -dx) + (i - 2) * 0.35, L = 70 + Math.sin(ph * 24 + i) * 16; gt.fillStyle(i % 2 ? 0xffd23f : 0xff7a1a, 0.7); gt.fillTriangle(cx + Math.cos(a + 1.4) * 24, cy + Math.sin(a + 1.4) * 24, cx + Math.cos(a - 1.4) * 24, cy + Math.sin(a - 1.4) * 24, cx + Math.cos(a) * L, cy + Math.sin(a) * L); }
        gt.lineStyle(3, 0xfff3b0, 0.8 * fl); gt.strokeCircle(cx, cy, 50);
        if (Math.random() < 0.5) { this.ambientSpawn = true; this.spawn('ember', cx + (Math.random() - 0.5) * 40, cy + (Math.random() - 0.5) * 40, 1, Math.random() < 0.5 ? 0xffb347 : 0xff6a1a); this.ambientSpawn = false; }
      }
      if (f.meteor && f.meteor.phase === 'hang') {
        // landing marker
        const m = f.meteor, k = Math.min(1, m.t / 0.5), mx = m.tx, my = m.ty;
        g.fillStyle(0x000000, 0.25 + 0.3 * k); g.fillEllipse(mx, my + 2, 60 + 120 * k, 16);
        gt.lineStyle(3, 0xff7a1a, 0.6 + 0.4 * Math.sin(ph * 20)); gt.strokeEllipse(mx, my + 2, 180, 24);
        gt.lineBetween(mx - 100, my + 2, mx - 70, my + 2); gt.lineBetween(mx + 70, my + 2, mx + 100, my + 2);
        this.warnIcon(mx, my - 40 - 20 * (1 - k), '☄');
      }
      if (f.frozenT > 0) this.iceBlock(gt, this.rectOf(f));
      if (this.F.chanId === 'power:chain-lightning' && this.laserKey) { const hx = this.px + this.facing * 24, hy = this.py - 64; gt.fillStyle(0x7dd3fc, 0.45 + 0.3 * Math.random()); gt.fillCircle(hx, hy, 14); gt.fillStyle(0xffffff, 0.9); gt.fillCircle(hx, hy, 6); }
      if (this.shield > 0 || this.bonusShield > 0) { g.lineStyle(3, 0x59e3ff, 0.7); g.strokeCircle(this.px, this.py - 44, 50); }
      if (this.auraT > 0) { const pulse = 0.5 + Math.sin(ph * 8) * 0.2; g.fillStyle(0x4ade80, 0.18 * pulse + 0.08); g.fillCircle(this.px, this.py - 44, 62); g.lineStyle(4, 0x86efac, pulse); g.strokeCircle(this.px, this.py - 44, 62); }
      if (this.multi !== 'none') {
        // player marker so friends can tell their heroes apart
        const c = f.index === 0 ? 0x38bdf8 : 0xfb7185;
        const ty = this.py - 150 + Math.sin(ph * 4) * 3;
        gt.fillStyle(0x1b1446, 1); gt.fillRoundedRect(this.px - 18, ty - 20, 36, 20, 8);
        gt.fillStyle(c, 1); gt.fillRoundedRect(this.px - 16, ty - 18, 32, 16, 6); gt.fillTriangle(this.px - 8, ty - 2, this.px + 8, ty - 2, this.px, ty + 8);
        const lbl = this.tags[f.index]; if (lbl) lbl.setPosition(this.px, ty - 10).setVisible(true);
        if (f.ko) { gt.lineStyle(5, 0x1b1446, 0.6); gt.strokeCircle(this.px, this.py - 150, 16); gt.lineStyle(4, 0x86efac, 1); gt.beginPath(); gt.arc(this.px, this.py - 150, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - f.koT / 8)); gt.strokePath(); }
      }
    }, false);
    for (const bo of this.bolts) {
      const g = gt;
      const a = Math.min(1, bo.life / 0.15);
      for (let i = 0; i < bo.pts.length - 1; i++) {
        const p0 = bo.pts[i], p1 = bo.pts[i + 1];
        const segs = 8; let lx = p0.x, ly = p0.y;
        for (let k = 1; k <= segs; k++) {
          const nx = p0.x + (p1.x - p0.x) * k / segs + (k < segs ? (Math.random() - 0.5) * 26 : 0), ny = p0.y + (p1.y - p0.y) * k / segs + (k < segs ? (Math.random() - 0.5) * 26 : 0);
          g.lineStyle(bo.big ? 14 : 9, 0x38bdf8, 0.35 * a); g.lineBetween(lx, ly, nx, ny);
          g.lineStyle(bo.big ? 4 : 3, 0xffffff, a); g.lineBetween(lx, ly, nx, ny);
          if (bo.big && k < segs && Math.random() < 0.35) { g.lineStyle(2, 0xbae6fd, a * 0.8); g.lineBetween(nx, ny, nx + (Math.random() - 0.5) * 50, ny + (Math.random() - 0.5) * 50); }
          lx = nx; ly = ny;
        }
      }
    }
    // player attacks (drawn above the characters)
    { const g = gt; const keepCur = this.cur;
    for (const a of this.attacks) {
      this.cur = this.fighters[a.owner] ?? this.fighters[0];
      if (a.style === 'beam') { g.fillStyle(0xff3b3b, 0.85); g.fillRect(a.x, a.y, a.w, a.h); g.fillStyle(0xffffff, 0.9); g.fillRect(a.x, a.y + a.h / 3, a.w, a.h / 3); }
      else if (a.style === 'wave') { g.fillStyle(0xffe066, 0.9); g.fillTriangle(a.x, a.y + a.h, a.x + a.w / 2, a.y, a.x + a.w, a.y + a.h); }
      else if (a.style === 'blast') { g.lineStyle(6, 0xffe066, 1 - a.t / a.life); g.strokeEllipse(a.x + a.w / 2, a.y + a.h, a.w * (0.5 + a.t * 3), 60); }
      else if (a.style === 'punch' && a.w > 60) { g.fillStyle(0xffe066, 0.5); g.fillCircle(a.x + a.w / 2, a.y + a.h / 2, 30); }
      else if (a.style === 'dash') {
        const f = this.facing, cx = a.x + a.w / 2, cy = a.y + a.h / 2;
        // cold glow
        g.fillStyle(0x7dd3fc, 0.18); g.fillEllipse(cx, cy, a.w + 46, a.h + 26);
        g.fillStyle(0xe0f7ff, 0.3); g.fillEllipse(cx, cy, a.w + 14, a.h);
        // icy speed lines with crystal tips
        for (let i = 0; i < 5; i++) {
          const y = a.y + 8 + i * 16, x0 = cx - f * (18 + i * 6), x1 = cx - f * (90 + ((i * 37) % 40));
          g.lineStyle(5, 0x7dd3fc, 0.55); g.lineBetween(x0, y, x1, y);
          g.lineStyle(2, 0xffffff, 0.95); g.lineBetween(x0, y, x1 + f * 10, y);
          g.fillStyle(0xffffff, 0.9); g.fillTriangle(x1, y - 4, x1, y + 4, x1 - f * 9, y);
        }
        // jagged ice shell pointing forward
        g.fillStyle(0xbfe9ff, 0.55); g.lineStyle(2, 0xffffff, 0.9);
        const tip = cx + f * (a.w / 2 + 26);
        const pts = [tip, cy, cx + f * a.w * 0.4, cy - a.h * 0.5, cx + f * a.w * 0.15, cy - a.h * 0.3, cx + f * a.w * 0.1, cy - a.h * 0.62, cx + f * (a.w * 0.55), cy - a.h * 0.15, tip, cy, cx + f * (a.w * 0.55), cy + a.h * 0.18, cx + f * a.w * 0.12, cy + a.h * 0.52, cx + f * a.w * 0.2, cy + a.h * 0.28, cx + f * a.w * 0.42, cy + a.h * 0.46];
        g.fillPoints(Array.from({ length: pts.length / 2 }, (_, i) => ({ x: pts[i * 2], y: pts[i * 2 + 1] })), true); g.strokePoints(Array.from({ length: pts.length / 2 }, (_, i) => ({ x: pts[i * 2], y: pts[i * 2 + 1] })), true);
        if (!this.paused && Math.random() < 0.9) { this.ambientSpawn = true; this.spawn('frost', cx - f * 20 + (Math.random() - 0.5) * 20, a.y + Math.random() * a.h, 2, 0x9be7ff, 0.4); this.ambientSpawn = false; }
      }
      else if (a.style === 'fire') {
        const cx = a.x + a.w / 2, cy = a.y + a.h / 2, d = Math.sign(a.vx ?? 1);
        for (let i = 5; i >= 1; i--) { const r = 22 - i * 3 + Math.sin(ph * 30 + i) * 3; g.fillStyle(i % 2 ? 0xff4d1f : 0xff9b2f, 0.55 - i * 0.07); g.fillCircle(cx - d * i * 16, cy + Math.sin(ph * 20 + i * 1.7) * 5, r); }
        g.fillStyle(0xff4d1f, 0.35); g.fillCircle(cx, cy, 36);
        g.fillStyle(0xff7a1a, 0.95); g.fillCircle(cx, cy, 25);
        g.fillStyle(0xffd23f, 1); g.fillCircle(cx + d * 3, cy, 16);
        g.fillStyle(0xfffbe6, 1); g.fillCircle(cx + d * 5, cy - 2, 8);
        if (Math.random() < 0.6) { this.ambientSpawn = true; this.spawn('ember', cx - d * 20, cy + (Math.random() - 0.5) * 20, 1, 0xffb347); this.ambientSpawn = false; }
      }
      else if (a.style === 'boom') {
        const k = a.t / a.life, cx = a.x + a.w / 2, cy = a.y + a.h / 2;
        g.fillStyle(0xff7a1a, 0.55 * (1 - k)); g.fillCircle(cx, cy, 40 + 60 * k);
        g.fillStyle(0xffd23f, 0.7 * (1 - k)); g.fillCircle(cx, cy, 24 + 40 * k);
        g.lineStyle(6 * (1 - k) + 1, 0xfff3b0, 1 - k); g.strokeCircle(cx, cy, 50 + 70 * k);
      }
      else if (a.style === 'burn') {
        const k = Math.min(1, (a.life - a.t) / 0.5), base = a.y + a.h;
        for (let i = 0; i < 6; i++) { const fx = a.x + 10 + i * (a.w - 20) / 5, fl = (22 + Math.sin(ph * 14 + i * 2.3) * 9) * k; g.fillStyle(0xff4d1f, 0.85 * k); g.fillTriangle(fx - 11, base, fx + 11, base, fx, base - fl - 12); g.fillStyle(0xffd36e, 0.95 * k); g.fillTriangle(fx - 6, base, fx + 6, base, fx, base - fl * 0.6); }
      }
      else if (a.style === 'titan') {
        // shadow grows under the target, then the giant fist falls from the sky
        const cx = a.x + a.w / 2, arm = a.armT ?? 0.8, k = Math.min(1, a.t / arm);
        if (a.t < arm) { g.fillStyle(0x000000, 0.2 + 0.4 * k); g.fillEllipse(cx, GROUND + 2, 70 + 120 * k, 14 + 10 * k); g.lineStyle(3, 0xffd23f, 0.5 + 0.5 * Math.sin(ph * 22)); g.strokeEllipse(cx, GROUND + 2, 190, 26); }
        const fall = Math.max(0, Math.min(1, (a.t - 0.25) / (arm - 0.25)));
        const bottom = a.t >= arm ? GROUND - 4 : -40 + (GROUND - 4 + 40) * fall * fall;
        const alpha = a.t >= arm ? Math.max(0, 1 - (a.t - arm) / (a.life - arm)) : 1;
        if (a.t > 0.2) this.drawTitanFist(g, cx, bottom, alpha, a.t < arm);
      }
      else if (a.style === 'crater') { const k = a.t / a.life, cx = a.x + a.w / 2, by = a.y + a.h; g.lineStyle(8 * (1 - k) + 1, 0xff9b2f, 1 - k); g.strokeEllipse(cx, by, a.w * (0.4 + k * 0.8), 50 + 30 * k); g.fillStyle(0xffd23f, 0.4 * (1 - k)); g.fillEllipse(cx, by - 10, a.w * 0.6, 70 * (1 - k)); }
      else if (a.style === 'spike') {
        // jagged rocks shoot up, then sink back into the floor
        const k = a.t / a.life, rise = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7 * 0.85, base = a.y + a.h, cx = a.x + a.w / 2, hh = a.h * rise;
        const rocks: [number, number, number][] = [[-14, 12, 0.6], [12, 12, 0.7], [0, 16, 1]];
        for (const [ox, hw, hs] of rocks) {
          const top = base - hh * hs;
          g.fillStyle(0x8a6a4f, 1); g.fillTriangle(cx + ox - hw, base, cx + ox + hw, base, cx + ox + (ox ? ox * 0.15 : 0), top);
          g.fillStyle(0xc9a27a, 1); g.fillTriangle(cx + ox - hw * 0.4, base, cx + ox + hw * 0.1, base, cx + ox + (ox ? ox * 0.15 : 0), top + 4);
          g.lineStyle(2, 0x1b1446, 1); g.strokeTriangle(cx + ox - hw, base, cx + ox + hw, base, cx + ox + (ox ? ox * 0.15 : 0), top);
        }
        g.fillStyle(0xd8d0f0, 0.5 * (1 - k)); g.fillEllipse(cx, base, a.w + 16, 12);
      }
      else if (a.style === 'glove') {
        // accordion spring from the fist to a big red boxing glove
        const f = this.facing, hx = this.px + f * 20, gy = a.y + a.h / 2, gx = a.x + a.w / 2 - f * 22;
        const L = (gx - hx) * f, coils = Math.max(3, Math.floor(L / 14));
        g.lineStyle(5, 0x1b1446, 1); let px0 = hx, py0 = gy;
        for (let i = 1; i <= coils; i++) { const nx = hx + f * L * i / coils, ny = gy + (i === coils ? 0 : (i % 2 ? -9 : 9)); g.lineBetween(px0, py0, nx, ny); px0 = nx; py0 = ny; }
        g.lineStyle(3, 0xd1d5db, 1); px0 = hx; py0 = gy;
        for (let i = 1; i <= coils; i++) { const nx = hx + f * L * i / coils, ny = gy + (i === coils ? 0 : (i % 2 ? -9 : 9)); g.lineBetween(px0, py0, nx, ny); px0 = nx; py0 = ny; }
        const cx = a.x + a.w / 2;
        g.fillStyle(0xffffff, 1); g.fillRoundedRect(cx - f * 30 - 9, gy - 18, 18, 36, 5); g.lineStyle(3, 0x1b1446, 1); g.strokeRoundedRect(cx - f * 30 - 9, gy - 18, 18, 36, 5);
        g.fillStyle(0xdc2626, 1); g.fillRoundedRect(cx - 28, gy - 30, 56, 60, 24); g.lineStyle(4, 0x1b1446, 1); g.strokeRoundedRect(cx - 28, gy - 30, 56, 60, 24);
        g.fillStyle(0xef4444, 1); g.fillRoundedRect(cx - f * 18 - 12, gy - 4, 24, 30, 10); g.lineStyle(3, 0x1b1446, 1); g.strokeRoundedRect(cx - f * 18 - 12, gy - 4, 24, 30, 10);
        g.fillStyle(0xffffff, 0.55); g.fillRoundedRect(cx - 14, gy - 24, 22, 9, 4);
        if (a.t < a.life * 0.5) { g.lineStyle(3, 0xffe066, 0.7); g.lineBetween(cx + f * 34, gy - 16, cx + f * 48, gy - 22); g.lineBetween(cx + f * 36, gy, cx + f * 52, gy); g.lineBetween(cx + f * 34, gy + 16, cx + f * 48, gy + 22); }
      }
      else if (a.style === 'phase') { g.fillStyle(0xa78bfa, 0.18); g.fillEllipse(a.x + a.w / 2, a.y + a.h / 2, a.w + 30, a.h + 10); }
      else if (a.style === 'slam') { g.lineStyle(4, 0xffffff, 0.7); for (let i = 0; i < 4; i++) g.lineBetween(this.px - 18 + i * 12, this.py - 120, this.px - 18 + i * 12, this.py - 60); }
      else if (a.style === 'power') { const cx = this.facing > 0 ? a.x + a.w - 12 : a.x + 12, cy = a.y + 28, k = 1 - a.t / a.life; g.fillStyle(0xffd23f, 0.6 * k); g.fillCircle(cx, cy, 34); g.fillStyle(0xffffff, 0.9 * k); g.fillCircle(cx, cy, 14); }
      else if (a.style === 'duck') { const cx = a.x + a.w / 2, cy = a.y + a.h / 2; g.fillStyle(0xffe066, 0.55 * (1 - a.t / a.life)); g.fillCircle(cx, cy, 20); g.fillStyle(0xffffff, 0.8 * (1 - a.t / a.life)); g.fillCircle(cx, cy, 8); }
      else if (a.style === 'rush') { const fx = this.facing > 0 ? a.x + a.w - 10 : a.x + 10; g.fillStyle(0xffe066, 0.55); g.fillCircle(fx, a.y + 26, 22); g.fillStyle(0xffffff, 0.8); g.fillCircle(fx, a.y + 26, 10); g.lineStyle(3, 0xffe066, 0.7); g.lineBetween(fx - this.facing * 70, a.y + 16, fx - this.facing * 20, a.y + 16); g.lineBetween(fx - this.facing * 80, a.y + 36, fx - this.facing * 24, a.y + 36); }
    }
    this.cur = keepCur;
    }
    if (this.dev.hitboxes) this.drawHitboxes();
    this.drawParticles();
    this.renderHud();
  }

  /** A translucent block of ice around a frozen fighter or CPU. */
  iceBlock(g: Phaser.GameObjects.Graphics, r: { x: number; y: number; w: number; h: number }) {
    const x = r.x - 14, y = r.y - 12, w = r.w + 28, h = r.h + 14;
    g.fillStyle(0xbfe9ff, 0.45); g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(3, 0xffffff, 0.9); g.strokeRoundedRect(x, y, w, h, 8);
    g.lineStyle(2, 0xffffff, 0.7); g.lineBetween(x + 8, y + 14, x + w * 0.45, y + 6); g.lineBetween(x + 6, y + 30, x + w * 0.3, y + 22);
    g.lineStyle(2, 0x7dd3fc, 0.8); g.lineBetween(x + w * 0.6, y + h * 0.4, x + w * 0.8, y + h * 0.55); g.lineBetween(x + w * 0.7, y + h * 0.48, x + w * 0.62, y + h * 0.7);
    g.fillStyle(0xffffff, 0.9); g.fillTriangle(x + w - 6, y - 8, x + w - 16, y + 4, x + w + 2, y + 4); g.fillTriangle(x + 6, y - 6, x - 2, y + 6, x + 14, y + 6);
  }
  /** Titan Fist: a giant golden fist pointing down, with its knuckles at `bottom`. */
  drawTitanFist(g: Phaser.GameObjects.Graphics, cx: number, bottom: number, alpha: number, falling: boolean) {
    const N = 0x1b1446;
    if (falling) { g.lineStyle(4, 0xfff3b0, 0.6 * alpha); for (let i = -2; i <= 2; i++) g.lineBetween(cx + i * 34, bottom - 170 - Math.abs(i) * 20, cx + i * 34, bottom - 300 - Math.abs(i) * 20); }
    g.fillStyle(0xffd23f, 0.3 * alpha); g.fillCircle(cx, bottom - 60, 100);
    // forearm and cuff (reaching up off screen)
    g.fillStyle(0xd97706, alpha); g.fillRect(cx - 46, bottom - 420, 92, 300);
    g.lineStyle(5, N, alpha); g.strokeRect(cx - 46, bottom - 420, 92, 300);
    g.fillStyle(0x7c2d12, alpha); g.fillRoundedRect(cx - 58, bottom - 150, 116, 30, 8); g.strokeRoundedRect(cx - 58, bottom - 150, 116, 30, 8);
    g.fillStyle(0xfde68a, 0.8 * alpha); g.fillRect(cx - 36, bottom - 410, 14, 260);
    // fist
    g.fillStyle(0xf59e0b, alpha); g.fillRoundedRect(cx - 72, bottom - 128, 144, 112, 30);
    g.lineStyle(5, N, alpha); g.strokeRoundedRect(cx - 72, bottom - 128, 144, 112, 30);
    // knuckles along the bottom
    for (let i = 0; i < 4; i++) { const kx = cx - 64 + i * 32; g.fillStyle(0xfbbf24, alpha); g.fillRoundedRect(kx, bottom - 44, 32, 40, 12); g.lineStyle(4, N, alpha); g.strokeRoundedRect(kx, bottom - 44, 32, 40, 12); g.fillStyle(0xfff3b0, 0.8 * alpha); g.fillRoundedRect(kx + 6, bottom - 38, 12, 8, 4); }
    // thumb wrapped across
    g.fillStyle(0xfbbf24, alpha); g.fillRoundedRect(cx - 60, bottom - 96, 90, 30, 14); g.lineStyle(4, N, alpha); g.strokeRoundedRect(cx - 60, bottom - 96, 90, 30, 14);
    g.fillStyle(0xffffff, 0.5 * alpha); g.fillRoundedRect(cx - 54, bottom - 120, 56, 12, 6);
  }

  /** Developer view: hurtboxes (green), boss (red), live hazards (orange) and hero attacks (yellow). */
  drawHitboxes() {
    const g = this.gTop;
    for (const f of this.fighters) { const r = this.rectOf(f); g.lineStyle(2, 0x22c55e, 1); g.strokeRect(r.x, r.y, r.w, r.h); }
    if (this.multi !== 'versus') { const b = this.boss.bounds(); g.lineStyle(2, this.boss.vulnerable ? 0xef4444 : 0x9ca3af, 1); g.strokeRect(b.x, b.y, b.w, b.h); }
    for (const h of this.hazards) {
      const live = h.t >= h.warn && h.t < h.warn + h.active;
      g.lineStyle(2, live ? 0xf97316 : 0xfef08a, live ? 1 : 0.35);
      if (h.shape === 'rect') g.strokeRect(h.x, h.y, h.w, h.h); else g.strokeCircle(h.x, h.y, h.r);
    }
    for (const a of this.attacks) { g.lineStyle(2, 0xfde047, 1); g.strokeRect(a.x, a.y, a.w, a.h); }
  }
  /** Developer: instantly drop the CPU to the next phase threshold, or finish it. */
  devBossTo(frac: number) { if (this.multi === 'versus') return; const b = this.boss; b.hp = Math.max(1, Math.round(b.maxHp * frac)); if (frac <= 0) { b.hp = 0; b.defeat(); } }

  drawHazard(h: Hazard, ph: number) {
    const g = this.g;
    const warning = h.t < h.warn;
    const frac = h.warn > 0 ? Math.min(1, h.t / h.warn) : 1;
    const pulse = 0.45 + 0.35 * Math.sin(ph * 14);
    const c = h.color;
    switch (h.style) {
      case 'beam':
        if (warning) { g.lineStyle(2, 0xffffff, 0.35 + 0.4 * frac); g.lineBetween(h.x, h.y + h.h / 2, h.x + h.w, h.y + h.h / 2); stripes(g, h.x, h.y, h.w, h.h, c, 0.2 + frac * 0.5, ph); this.warnIcon(h.dir! > 0 ? h.x + 30 : h.x + h.w - 30, h.y - 20, h.label === 'HIGH' ? '⬇' : '⬆'); }
        else { g.fillStyle(c, 0.9); g.fillRect(h.x, h.y, h.w, h.h); g.fillStyle(0xffffff, 1); g.fillRect(h.x, h.y + h.h / 3, h.w, h.h / 3); }
        break;
      case 'lane': chevrons(g, h.dir! >= 0 ? h.x : h.x + h.w, h.dir! >= 0 ? h.x + h.w : h.x, h.y + h.h / 2, c, pulse, ph); g.fillStyle(c, 0.12); g.fillRoundedRect(h.x, h.y, h.w, h.h, 8); if (h.dir === 0) stripes(g, h.x, h.y, h.w, h.h, c, 0.3, ph); break;
      case 'punch': case 'burst':
        if (warning) {
          if (h.style === 'burst') { g.lineStyle(3, c, 0.9); g.strokeEllipse(h.x + h.w / 2, GROUND, h.w * 1.2, 22); g.fillStyle(c, 0.5); g.fillEllipse(h.x + h.w / 2, GROUND, h.w * 1.2 * frac, 22 * frac); }
          else { stripes(g, h.x, h.y, h.w, h.h, c, 0.25 + frac * 0.5, ph); this.warnIcon(h.x + h.w / 2, h.y - 18, '!'); }
        } else { const r = Math.min(12, h.h / 2); g.fillStyle(c, 0.3); g.fillRoundedRect(h.x - 6, h.y - 6, h.w + 12, h.h + 12, r + 4); g.fillStyle(c, 0.75); g.fillRoundedRect(h.x, h.y, h.w, h.h, r); g.fillStyle(0xffffff, 0.55); g.fillRoundedRect(h.x + 10, h.y + h.h * 0.3, h.w - 20, h.h * 0.4, r / 2); }
        break;
      case 'shadow': case 'debris':
        if (warning) { g.fillStyle(0x000000, 0.25 + 0.3 * frac); g.fillEllipse(h.x, GROUND, h.r * 2 * (0.4 + 0.6 * frac), 18); g.lineStyle(3, c, 0.9); g.strokeEllipse(h.x, GROUND, h.r * 2, 20); if (h.style === 'debris') { g.fillStyle(c === 0xbbbbbb ? 0x777777 : c, 1); g.fillCircle(h.x, GROUND - 40 - (1 - frac) * 380, 16); } }
        else { g.fillStyle(c, 0.7); g.fillEllipse(h.x, GROUND - 6, h.r * 2.2, 30); }
        break;
      case 'wave': g.fillStyle(c, warning ? 0.4 : 0.95); g.fillTriangle(h.x, h.y + h.h, h.x + h.w / 2, h.y - 6, h.x + h.w, h.y + h.h); g.lineStyle(2, 0x1b1446, 1); g.strokeTriangle(h.x, h.y + h.h, h.x + h.w / 2, h.y - 6, h.x + h.w, h.y + h.h); break;
      case 'orb':
        if (h.gravity) { g.fillStyle(0x000000, 0.3); const s = Math.max(0.3, Math.min(1, (h.y + 60) / GROUND)); g.fillEllipse(h.x, GROUND, h.r * 2.6 * s, 10); g.lineStyle(2, c, 0.8); g.strokeEllipse(h.x, GROUND, h.r * 2.6, 12); }
        if (warning && !h.gravity) { g.lineStyle(2, c, 0.5); for (let i = 1; i < 7; i++) g.fillStyle(c, 0.4).fillCircle(h.x + h.vx * i * 0.12, h.y + h.vy * i * 0.12, 3); }
        g.fillStyle(c, warning ? 0.5 : 1); g.fillCircle(h.x, h.y, h.r); g.fillStyle(0xffffff, 0.8); g.fillCircle(h.x, h.y, h.r * 0.45); g.lineStyle(2, 0x1b1446, 1); g.strokeCircle(h.x, h.y, h.r);
        break;
      case 'icicle':
        if (warning && h.aim) {
          const locked = h.label === 'locked';
          g.lineStyle(locked ? 4 : 2, locked ? 0xffffff : c, locked ? 0.95 : 0.6);
          if (locked) g.lineBetween(h.aim.x1, h.aim.y1, h.aim.x2 + (h.aim.x2 - h.aim.x1) * 2, h.aim.y2 + (h.aim.y2 - h.aim.y1) * 2);
          else for (let i = 0; i < 1; i += 0.08) g.lineBetween(h.aim.x1 + (h.aim.x2 - h.aim.x1) * i, h.aim.y1 + (h.aim.y2 - h.aim.y1) * i, h.aim.x1 + (h.aim.x2 - h.aim.x1) * (i + 0.04), h.aim.y1 + (h.aim.y2 - h.aim.y1) * (i + 0.04));
          this.warnIcon(h.aim.x2, h.aim.y2 - 50, locked ? '⨯' : '◎');
        }
        { const a = Math.atan2(h.vy || 1, h.vx || 0); const L = 22; g.fillStyle(0xe8f8ff, 1); g.fillTriangle(h.x + Math.cos(a) * L, h.y + Math.sin(a) * L, h.x + Math.cos(a + 2.6) * 9, h.y + Math.sin(a + 2.6) * 9, h.x + Math.cos(a - 2.6) * 9, h.y + Math.sin(a - 2.6) * 9); g.lineStyle(2, 0x1b1446, 1); g.strokeTriangle(h.x + Math.cos(a) * L, h.y + Math.sin(a) * L, h.x + Math.cos(a + 2.6) * 9, h.y + Math.sin(a + 2.6) * 9, h.x + Math.cos(a - 2.6) * 9, h.y + Math.sin(a - 2.6) * 9); }
        break;
      case 'zone':
        if (h.pull) {
          const R = 170;
          g.lineStyle(3, c, warning ? pulse : 0.8); g.strokeCircle(h.pull.cx, h.pull.cy, R);
          for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + ph * (warning ? 0.5 : 1.5); const r1 = R - 10 - ((ph * 60) % 60); const x = h.pull.cx + Math.cos(a) * r1, y = h.pull.cy + Math.sin(a) * r1 * 0.6; g.lineBetween(x, y, x - Math.cos(a) * 16, y - Math.sin(a) * 10); }
          g.fillStyle(c, warning ? 0.3 : 0.75); g.fillCircle(h.x, h.y, h.r);
        } else { stripes(g, h.x, h.y - 6, h.w, h.h + 6, c, pulse, ph); }
        break;
      case 'body': break; // the boss itself is the visible threat
      case 'pillar':
        if (warning) { stripes(g, h.x, 0, h.w, GROUND, c, 0.15 + frac * 0.35, ph); chevrons(g, h.x + h.w / 2, h.x + h.w / 2 + Math.sign(h.vx || 1) * 120, GROUND - 40, c, pulse, ph); this.warnIcon(h.x + h.w / 2, 120, h.vx > 0 ? '→' : h.vx < 0 ? '←' : '!'); }
        else { g.fillStyle(c, 0.35); g.fillRect(h.x - 8, 0, h.w + 16, GROUND); g.fillStyle(c, 0.85); g.fillRect(h.x, 0, h.w, GROUND); g.fillStyle(0xffffff, 0.9); g.fillRect(h.x + h.w * 0.35, 0, h.w * 0.3, GROUND); }
        break;
      case 'fire':
        if (warning) { g.lineStyle(3, c, 0.9); g.strokeEllipse(h.x + h.w / 2, GROUND - 4, h.w, 14); }
        else { for (let i = 0; i < 4; i++) { const fx = h.x + 8 + i * (h.w - 16) / 3, fl = 18 + Math.sin(ph * 14 + i * 2) * 8; g.fillStyle(0xff7a1a, 0.9); g.fillTriangle(fx - 9, GROUND, fx + 9, GROUND, fx, GROUND - fl - 10); g.fillStyle(0xffd36e, 0.95); g.fillTriangle(fx - 5, GROUND, fx + 5, GROUND, fx, GROUND - fl * 0.6); } }
        break;
      case 'boulder':
        g.fillStyle(0x7d6a58, warning ? 0.6 : 1); g.fillCircle(h.x, h.y, h.r); g.lineStyle(3, 0x1b1446, 1); g.strokeCircle(h.x, h.y, h.r);
        g.lineStyle(2, 0x4e3f33, 1); { const a = h.x / h.r; g.lineBetween(h.x + Math.cos(a) * h.r * 0.6, h.y + Math.sin(a) * h.r * 0.6, h.x - Math.cos(a) * h.r * 0.2, h.y - Math.sin(a) * h.r * 0.2); g.lineBetween(h.x + Math.cos(a + 2) * h.r * 0.7, h.y + Math.sin(a + 2) * h.r * 0.7, h.x, h.y); }
        break;
      case 'breath':
        if (warning) { stripes(g, h.x, h.y, h.w, h.h, c, 0.2 + frac * 0.45, ph); this.warnIcon(h.x + h.w / 2, h.y - 18, '❄'); }
        else { for (let i = 0; i < 10; i++) { g.fillStyle(i % 2 ? 0xffffff : c, 0.75); g.fillCircle(h.x + Math.random() * h.w, h.y + Math.random() * h.h, 5 + Math.random() * 8); } }
        break;
      case 'satellite':
        g.fillStyle(c, warning ? 0.4 : 1); g.fillCircle(h.x, h.y, h.r); g.fillStyle(0xffffff, warning ? 0.3 : 0.9); g.fillCircle(h.x - 3, h.y - 3, h.r * 0.4); g.lineStyle(2, 0x1b1446, 1); g.strokeCircle(h.x, h.y, h.r);
        g.lineStyle(2, c, 0.5); g.strokeCircle(h.x, h.y, h.r + 6 + Math.sin(ph * 10) * 2);
        break;
      case 'band':
        if (warning) { stripes(g, h.x, h.y, h.w, h.h, c, 0.25 + 0.4 * frac, ph); if (h.gap) { safeZone(g, h.gap.x, h.y - 30, h.gap.w, h.h + 30, ph); this.warnIcon(h.gap.x + h.gap.w / 2, h.y - 50, h.gap.vx > 0 ? '→' : '←'); } }
        else { g.fillStyle(c, 0.85); g.fillRect(h.x, h.y, h.gap ? h.gap.x : h.w, h.h); if (h.gap) g.fillRect(h.gap.x + h.gap.w, h.y, W - h.gap.x - h.gap.w, h.h); }
        break;
      case 'feint': g.lineStyle(2, 0xffffff, 0.8); for (let i = 0; i < h.w; i += 14) { g.lineBetween(h.x + i, h.y, h.x + i + 7, h.y); g.lineBetween(h.x + i, h.y + h.h, h.x + i + 7, h.y + h.h); } this.warnIcon(h.x + h.w / 2, h.y - 18, '?'); break;
    }
  }
  private icons: Phaser.GameObjects.Text[] = [];
  private iconIdx = 0;
  warnIcon(x: number, y: number, ch: string) {
    let t = this.icons[this.iconIdx];
    if (!t) { t = this.add.text(0, 0, '', { ...TXT, fontSize: '22px', color: '#ffe066' }).setOrigin(0.5).setDepth(8); this.icons.push(t); }
    t.setText(ch).setPosition(x, y).setVisible(true);
    this.iconIdx++;
  }

  renderHud() {
    for (let i = this.iconIdx; i < this.icons.length; i++) this.icons[i].setVisible(false);
    this.iconIdx = 0;
    const g = this.hud; g.clear();
    // player panel: portrait, HP bar with a lagging damage trail, adrenaline meter with move-cost markers
    const hpw = 236, px0 = 70;
    const bar = (x: number, y: number, w: number, h: number, frac: number, c1: number, c2: number, trail?: number) => {
      g.fillStyle(0x0d0a26, 1); g.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, (h + 4) / 2);
      g.fillStyle(0x2d2756, 1); g.fillRoundedRect(x, y, w, h, h / 2);
      if (trail !== undefined && trail > frac) { g.fillStyle(0xffffff, 0.7); g.fillRoundedRect(x, y, Math.max(h, w * trail), h, h / 2); }
      if (frac > 0) { g.fillGradientStyle(c1, c2, c1, c2, 1); g.fillRoundedRect(x, y, Math.max(h, w * frac), h, h / 2); g.fillStyle(0xffffff, 0.35); g.fillRoundedRect(x + 3, y + 2, Math.max(0, w * frac - 6), h / 3, h / 6); }
    };
    const panel = (f: Fighter, ox: number, oy: number) => {
      const frame = this.multi === 'none' ? 0x8b5cf6 : f.index === 0 ? 0x38bdf8 : 0xfb7185;
      g.fillStyle(0x1b1446, 0.92); g.fillRoundedRect(ox, oy, hpw + 72, 72, 14);
      g.lineStyle(3, frame, 1); g.strokeRoundedRect(ox, oy, hpw + 72, 72, 14);
      g.fillStyle(0x3b2a7a, 1); g.fillCircle(ox + 30, oy + 36, 26); g.lineStyle(3, 0xffd23f, 1); g.strokeCircle(ox + 30, oy + 36, 26);
      drawShapes(g, heroPortrait(f.appearance), ox + 30, oy + 38 + 79 * 1.45, 1, 1.45);
      f.hpTrail = Math.max(f.hp / f.maxHp, (f.hpTrail ?? 1) - 0.006);
      const bx = ox + 60;
      bar(bx, oy + 24, hpw, 13, f.hp / f.maxHp, 0x2fcf7a, 0x9ef01a, f.hpTrail);
      if (f.shield > 0 || f.bonusShield > 0) { g.fillStyle(0x59e3ff, 1); g.fillRoundedRect(bx, oy + 20, hpw * Math.min(1, (f.shield + f.bonusShield) / f.maxHp), 4, 2); }
      bar(bx, oy + 52, hpw, 10, f.meter.value / f.meter.max, 0xff7a1a, 0xffd23f);
      for (const id of [...f.loadout.active]) {
        const pw = id ? POWERS[id] : null;
        if (!pw || !pw.cost) continue;
        const x = bx + hpw * Math.min(1, pw.cost / f.meter.max);
        g.fillStyle(pw.cost > f.meter.max ? 0xff4d4d : f.meter.value >= pw.cost ? 0xffffff : 0x9a90c8, 1); g.fillTriangle(x - 5, oy + 45, x + 5, oy + 45, x, oy + 51); g.fillRect(x - 1, oy + 52, 2, 10);
      }
      if (this.multi === 'versus') for (let i = 0; i < 2; i++) { g.fillStyle(i < f.wins ? 0xffd23f : 0x2d2756, 1); g.fillCircle(ox + hpw + 52 - i * 16, oy + 10, 5); g.lineStyle(2, 0x1b1446, 1); g.strokeCircle(ox + hpw + 52 - i * 16, oy + 10, 5); }
      const t = this.ptexts[f.index];
      const label = this.multi === 'none' ? (this.cfg.mode === 'training' ? 'Training' : 'HP') : `P${f.index + 1} ${f.name}`;
      t.hp.setText(`${label} ${f.ko ? 'K.O.' : `${Math.ceil(f.hp)} / ${f.maxHp}`}${f.bonusShield > 0 ? `  🛡${f.bonusShield}` : ''}`).setPosition(bx + 2, oy + 2);
      t.adr.setText(`Adrenaline ${Math.floor(f.meter.value)} / ${f.meter.max}`).setPosition(bx + 2, oy + 35);
    };
    panel(this.fighters[0], 10, 8);
    if (this.fighters[1]) panel(this.fighters[1], this.multi === 'versus' ? W - hpw - 82 : 10, this.multi === 'versus' ? 8 : 86);
    // boss (not shown in versus)
    const b = this.boss;
    this.texts.boss.setVisible(this.multi !== 'versus' && !this.challenge);
    if (this.multi !== 'versus' && !this.challenge) {
    const bw = 250;
    g.fillStyle(0x1b1446, 0.92); g.fillRoundedRect(W - bw - 82, 8, bw + 72, 60, 14);
    g.lineStyle(3, 0xff4d6d, 1); g.strokeRoundedRect(W - bw - 82, 8, bw + 72, 60, 14);
    g.fillStyle(0x3b1a3a, 1); g.fillCircle(W - 40, 38, 24); g.lineStyle(3, 0xff4d6d, 1); g.strokeCircle(W - 40, 38, 24);
    drawShapes(g, portraitShapes(b.style), W - 40, 41 + 79 * 1.3, -1, 1.3);
    this.bossTrail = Math.max(b.hp / b.maxHp, (this.bossTrail ?? 1) - 0.004);
    bar(W - bw - 72, 38, bw, 14, b.hp / b.maxHp, 0xff3b5c, 0xff9b2f, this.bossTrail);
    const th = b.phases >= 3 ? [0.66, 0.33] : b.phases === 2 ? [0.5] : [];
    for (const t of th) { g.fillStyle(0xffffff, 1); g.fillRect(W - bw - 72 + bw * t - 1, 34, 3, 22); }
    const tierName = this.cfg.mode === 'training' || this.cfg.mode === 'tutorial' ? '' : ` · ${TIER_STATS[this.cfg.tier].name}`;
    this.texts.boss.setText(`${b.name}${tierName}${this.cfg.mode === 'training' ? '' : `  ${Math.ceil(b.hp)}`}${b.phases > 1 ? `  P${b.phase}` : ''}`);
    // no instructions during real battles; the tutorial still coaches
    this.texts.bossState.setText(this.cfg.mode === 'tutorial' && b.state !== 'defeated' ? b.stateLabel : '');
    } else this.texts.bossState.setText('');
    this.texts.timer.setText(this.challenge ? this.challenge.hudText() : this.multi === 'versus' ? `Round ${this.round}  ·  ${Math.floor(this.elapsed / 60)}:${String(Math.floor(this.elapsed % 60)).padStart(2, '0')}` : this.cfg.mode === 'training' ? (this.sprint.best ? `Best sprint ${this.sprint.best.toFixed(2)}s` : 'Sprint flag to flag') : `${Math.floor(this.elapsed / 60)}:${String(Math.floor(this.elapsed % 60)).padStart(2, '0')}`);
    this.texts.info.setText(this.coach && (this.cfg.mode === 'tutorial' || this.cfg.mode === 'training') ? this.coach + (this.cfg.mode === 'training' && this.lastHitDmg ? `\nLast hit: ${Math.round(this.lastHitDmg)} damage` : '') + (this.demoLeft > 0 ? `\nDemo: ${Math.ceil(this.demoLeft)}s left (press Q / power 1)` : '') : '');
  }
}

export { ADRENALINE };

// Player fields on the scene delegate to the active fighter (this.cur), so the single-player code path is unchanged.
for (const k of FIGHTER_KEYS) {
  Object.defineProperty(BattleScene.prototype, k, {
    get(this: BattleScene) { return (this.cur as any)[k]; },
    set(this: BattleScene, v: unknown) { (this.cur as any)[k] = v; },
    configurable: true,
  });
}
