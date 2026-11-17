import type { Anim } from '../art/hero';
import type { AdrenalineMeter } from '../core/adrenaline';
import type { derivedStats } from '../core/attributes';
import type { Appearance, Attributes, LoadoutState } from '../core/types';
import { GROUND, type Platform } from './arenas';
import type { CharSprite } from './canvasArt';
import { inputs, pressedFor, type InputState } from './input';

export interface PlayerCfg {
  name: string;
  appearance: Appearance;
  attributes: Attributes;
  loadout: LoadoutState;
  powerLevels: Record<string, number>;
}

/** Everything that belongs to one hero in a fight (position, health, meter, timers, sprites, controls). */
export class Fighter {
  readonly index: number;
  readonly name: string;
  appearance: Appearance;
  attributes: Attributes;
  loadout: LoadoutState;
  powerLevels: Record<string, number>;
  readonly inp: InputState;
  px = 160; py = GROUND; pvx = 0; pvy = 0; facing = 1; onGround = true; jumpsUsed = 0; maxJumps = 1;
  standing: Platform | null = null; dropT = 0;
  hp = 100; maxHp = 100;
  meter!: AdrenalineMeter;
  stats!: ReturnType<typeof derivedStats>;
  dodgeT = 0; dodgeCd = 0; invulnT = 0; dodgeInvulnT = 0; hurtT = 0; punchCd = 0; actionT = 0; actionAnim: Anim | null = null; hoverT = 0;
  cooldowns: Record<string, number> = {};
  shield = 0; shieldMax = 0; shieldIdle = 0; bonusShield = 0;
  /** Hologram Decoy clone: runs at the opponent and punches until it has been hit 3 times */
  playerDecoy: Clone | null = null;
  history: { t: number; x: number; y: number }[] = [];
  hpTrail = 1; slowT = 0; auraT = 0; phaseT = 0; wasGround = true;
  /** seconds the punch button has been held (0 = not charging) */
  chargeT = 0;
  /** diving down after an air down+punch */
  slamming = false;
  /** held Laser Eyes: which button is keeping it on, time held, next damage tick */
  laserKey: 'power1' | 'power2' | null = null; laserT = 0; laserTick = 0;
  /** which held power is channelling (Laser Eyes or Chain Lightning) */
  chanId: string | null = null;
  /** frozen solid by Ice Dash (versus) */
  frozenT = 0;
  /** Hover: seconds of hover left before landing again, and whether hovering right now */
  hoverFuel = 0;
  hovering = false;
  /** Chain Lightning cannot lock onto this hero again until this time (set by dodging or Ice Dashing out of it) */
  zapFreeAt = 0;
  /** Supernova: seconds left, current zip direction */
  novaT = 0; novaDx = 1; novaDy = -1; novaHitT = 0;
  /** Meteor Slam: leap → hang → dive */
  meteor: { phase: 'up' | 'hang' | 'dive'; t: number; tx: number; ty: number } | null = null;
  meteorDmg = 40;
  /** local-only visual trail (afterimages, flame streaks) */
  trail: { x: number; y: number; life: number; face: number; fire?: boolean }[] = []; trailT = 0;
  sprAfter: CharSprite[] = [];
  sprPlayer!: CharSprite; sprGhost!: CharSprite; sprHolo!: CharSprite;
  /** co-op: knocked out, waiting to get back up */
  ko = false; koT = 0;
  /** versus: rounds won */
  wins = 0;
  constructor(index: number, pc: PlayerCfg, ownInput?: InputState) {
    this.index = index;
    this.name = pc.name;
    this.appearance = pc.appearance;
    this.attributes = pc.attributes;
    this.loadout = pc.loadout;
    this.powerLevels = pc.powerLevels;
    this.inp = ownInput ?? inputs[index];
  }
  consume(k: keyof InputState): boolean { const p = pressedFor(this.index); const v = p[k]; p[k] = false; return v; }
}

export interface Clone { x: number; y: number; vy: number; t: number; hits: number; cd: number; face: number; anim: 'run' | 'idle' | 'punch' | 'hurt' | 'jump'; animT: number; hurtT: number; dmg: number }

/** Fields the scene reads through `this.x` that actually live on the active fighter. */
export const FIGHTER_KEYS = ['px', 'py', 'pvx', 'pvy', 'facing', 'onGround', 'jumpsUsed', 'maxJumps', 'standing', 'dropT', 'hp', 'maxHp', 'meter', 'stats',
  'dodgeT', 'dodgeCd', 'invulnT', 'dodgeInvulnT', 'hurtT', 'punchCd', 'actionT', 'actionAnim', 'hoverT', 'cooldowns', 'shield', 'shieldMax', 'shieldIdle', 'bonusShield',
  'playerDecoy', 'history', 'hpTrail', 'slowT', 'auraT', 'phaseT', 'wasGround', 'chargeT', 'slamming', 'laserKey', 'laserT', 'laserTick', 'chanId', 'frozenT', 'novaT', 'meteor', 'sprPlayer', 'sprGhost', 'sprHolo'] as const;
