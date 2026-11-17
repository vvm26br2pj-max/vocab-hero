import type { TierStats } from '../config/combat';
import type { ArenaDef } from './arenas';

export type HazardStyle = 'beam' | 'lane' | 'slam' | 'wave' | 'orb' | 'bolt' | 'zone' | 'burst' | 'body' | 'debris' | 'band' | 'icicle' | 'punch' | 'feint' | 'shadow' | 'pillar' | 'fire' | 'boulder' | 'breath' | 'satellite';

export interface Hazard {
  id: string;
  owner: 'boss' | 'env';
  shape: 'rect' | 'circle';
  /** rect: top-left; circle: center */
  x: number; y: number; w: number; h: number; r: number;
  vx: number; vy: number;
  t: number;
  /** telegraph time before it becomes dangerous */
  warn: number;
  /** dangerous duration */
  active: number;
  dmg: number;
  style: HazardStyle;
  color: number;
  /** For lanes and beams: direction of travel */
  dir?: number;
  pull?: { cx: number; cy: number; strength: number };
  /** re-hit interval for lingering hazards */
  repeat?: number;
  lastHit?: number;
  /** safe window for 'band' hazards */
  gap?: { x: number; w: number; vx: number };
  /** this attack has already rewarded a perfect dodge */
  dodged?: boolean;
  hit?: boolean;
  /** remove when it lands / hits */
  destroyOnHit?: boolean;
  /** aim line data for icicles */
  aim?: { x1: number; y1: number; x2: number; y2: number };
  gravity?: number;
  label?: string;
  /** arcs under gravity, then rolls along the floor */
  ballistic?: boolean;
  /** slows the player for this many seconds on hit */
  slow?: number;
}

export interface Decoy { x: number; y: number; t: number; life: number; alive: boolean }

export interface BattleCtx {
  time: number;
  rng: () => number;
  tier: TierStats;
  telegraphMul: number;
  extraHazards: boolean;
  damage: number;
  arena: ArenaDef;
  /** Visible player position from `tier.reaction` seconds ago, or the hologram decoy. */
  target(): { x: number; y: number };
  playerNow(): { x: number; y: number; onGround: boolean };
  addHazard(h: Partial<Hazard> & Pick<Hazard, 'shape' | 'style' | 'warn' | 'active' | 'dmg'>): Hazard;
  removeHazard(id: string): void;
  shake(amount: number): void;
  sound(name: string): void;
  floatText(x: number, y: number, text: string, color?: string): void;
  banner(text: string): void;
  /** Frost Finch slippery patches */
  slippery: { x: number; w: number }[];
  /** Captain Gravity heavy-gravity zones */
  heavy: { x: number; w: number; warn: number; on: boolean }[];
  /** Prism Moth decoys (visual copies; only the real one casts a shadow) */
  mothDecoys: Decoy[];
  /** What the boss can SEE the player doing (never raw input): swinging, charging a power, or attacks in flight. */
  playerThreat(): { attacking: boolean; x: number; y: number; dist: number };
  /** called when the hologram decoy has absorbed an attack */
  consumePlayerDecoy(): void;
}
