// Combat tuning: player kit, powers, adrenaline, difficulty modes, enemy tiers and Power Rating bands.

export type CombatDifficulty = 'relaxed' | 'standard' | 'challenge';
export type TierId = 'rookie' | 'challenger' | 'elite' | 'champion' | 'legendary';
export const TIERS: TierId[] = ['rookie', 'challenger', 'elite', 'champion', 'legendary'];

export const PLAYER = {
  baseRunSpeed: 190,        // px/s at Speed 1 (responsive, just slow)
  maxRunSpeed: 460,         // controllability cap
  accelTime: 0.08,          // seconds to reach run speed (kept tiny: no input lag)
  jumpVelocity: 610,        // independent of Speed
  gravity: 1500,
  extraJumpVelocity: 560,
  punchDamage: 8,           // Strength-scaled
  punchCooldown: 0.33,
  punchRange: 54,
  dodgeDistance: 150,
  dodgeTime: 0.22,
  dodgeInvuln: 0.28,
  dodgeRecovery: 0.75,      // shortened modestly by Speed
  hurtInvuln: 1.0,
  maxKnockbackPx: 140,
};

export const ADRENALINE = {
  startFraction: 0.5,
  passivePerSecond: 4,     // steady refill over time (paused while a held power is draining)
  basicHit: 4,
  hitRewardMinInterval: 0.4,
  perfectDodge: 8,
};

export interface PowerDef {
  id: string;
  cost: number;           // adrenaline
  cooldown: number;       // seconds
  damage: number;
  strengthScaled: boolean;
  /** Energy attacks: damage × Willpower multiplier */
  willpowerScaled?: boolean;
  minWillpower: number;
  /** held beam: adrenaline drained per second while held; `damage` is then damage per second and `cost` the amount needed to start */
  channel?: { drainPerSec: number; regenPerSec?: number[] };
}
export const POWERS: Record<string, PowerDef> = {
  // Costs are small next to the starting meter (40 at Willpower 1): most abilities can be used every few seconds.
  // Ultimates (Titan Fist, Supernova, Guardian Aura) take almost a full bar at their Willpower requirement (80).
  'power:super-punch': { id: 'power:super-punch', cost: 10, cooldown: 2.5, damage: 20, strengthScaled: true, minWillpower: 1 },
  'power:ground-shockwave': { id: 'power:ground-shockwave', cost: 12, cooldown: 3.5, damage: 18, strengthScaled: true, minWillpower: 1 },
  'power:meteor-punch': { id: 'power:meteor-punch', cost: 20, cooldown: 6, damage: 42, strengthScaled: true, minWillpower: 1 },
  'power:titan-fist': { id: 'power:titan-fist', cost: 72, cooldown: 12, damage: 115, strengthScaled: true, minWillpower: 21 },
  'power:laser-eyes': { id: 'power:laser-eyes', cost: 4, cooldown: 0.8, damage: 10, strengthScaled: false, willpowerScaled: true, minWillpower: 1, channel: { drainPerSec: 13 } },
  'power:chain-lightning': { id: 'power:chain-lightning', cost: 5, cooldown: 1, damage: 14, strengthScaled: false, willpowerScaled: true, minWillpower: 1, channel: { drainPerSec: 17 } },
  'power:mega-laser': { id: 'power:mega-laser', cost: 16, cooldown: 4, damage: 34, strengthScaled: false, willpowerScaled: true, minWillpower: 1 },
  'power:nova-storm': { id: 'power:nova-storm', cost: 72, cooldown: 12, damage: 41, strengthScaled: false, willpowerScaled: true, minWillpower: 21 },
  'power:ice-dash': { id: 'power:ice-dash', cost: 25, cooldown: 12, damage: 14, strengthScaled: false, minWillpower: 1 },
  'power:hologram-decoy': { id: 'power:hologram-decoy', cost: 14, cooldown: 9, damage: 6, strengthScaled: false, minWillpower: 1 },
  // Meditate (kept the old Phase Shift ID so saves carry over): hold to sit still and refill adrenaline fast; regen per level
  'power:phase-shift': { id: 'power:phase-shift', cost: 0, cooldown: 1.5, damage: 0, strengthScaled: false, minWillpower: 1, channel: { drainPerSec: 0, regenPerSec: [20, 26, 32] } },
  'power:guardian-aura': { id: 'power:guardian-aura', cost: 66, cooldown: 16, damage: 0, strengthScaled: false, minWillpower: 21 },
// Super Speed (kept the old Gravity Burst ID so saves carry over): always on while equipped in the Movement slot
  'power:gravity-burst': { id: 'power:gravity-burst', cost: 0, cooldown: 0, damage: 0, strengthScaled: false, minWillpower: 1 },
};
/** Ability upgrade levels (bought in the Ability Map): damage/strength multiplier and cooldown multiplier. */
export const POWER_LEVELS = [
  { level: 1, power: 1, cooldown: 1 },
  { level: 2, power: 1.25, cooldown: 0.85 },
  { level: 3, power: 1.5, cooldown: 0.7 },
];
/** Upgrade price as a fraction of the ability's purchase price. */
/** Super Speed run-speed multiplier at levels 1, 2 and 3 (may go past the normal top speed). */
/** Hover (save ID power:triple-jump): seconds of hovering per jump at levels 1, 2 and 3. */
export const HOVER_TIME = [1.2, 1.6, 2];
export const SUPER_SPEED = [1.5, 1.7, 2];
export const POWER_UPGRADE_COST = [0, 0.75, 1.25];
export const SHIELD = { absorb: 30, rechargeDelay: 10 };

export const DIFFICULTY: Record<CombatDifficulty, { label: string; telegraph: number; incoming: number; assist: boolean; extraHazards: boolean; desc: string }> = {
  relaxed: { label: 'Relaxed', telegraph: 1.5, incoming: 0.6, assist: true, extraHazards: false, desc: 'Longer warnings, less damage taken, aim assist.' },
  standard: { label: 'Standard', telegraph: 1, incoming: 1, assist: false, extraHazards: false, desc: 'The intended timing.' },
  challenge: { label: 'Challenge', telegraph: 0.85, incoming: 1.15, assist: false, extraHazards: true, desc: 'Tighter patterns and extra hazards, same readable tells. Can earn a cosmetic trophy.' },
};
/** No telegraph is ever shorter than this, in any mode or tier (seconds). */
export const MIN_TELEGRAPH = 0.45;

export interface TierStats {
  id: TierId;
  name: string;
  hp: number;
  damage: number;         // base damage per boss hit before move multipliers
  telegraph: number;      // multiplier on move warning times
  recovery: number;       // multiplier on recovery windows
  speed: number;          // movement multiplier
  comboChance: number;    // chance to chain a second move
  hazards: boolean;
  feints: boolean;
  phases: number;         // 2, or 3 at Legendary
  reaction: number;       // seconds of AI reaction delay to visible player position
  desc: string;
}
export const TIER_STATS: Record<TierId, TierStats> = {
  rookie: { id: 'rookie', name: 'Rookie', hp: 420, damage: 16, telegraph: 1.2, recovery: 1.1, speed: 0.95, comboChance: 0.15, hazards: false, feints: false, phases: 2, reaction: 0.38, desc: 'Long warnings, simple movement, clearly separated attacks.' },
  challenger: { id: 'challenger', name: 'Challenger', hp: 700, damage: 25, telegraph: 1.05, recovery: 0.98, speed: 1.08, comboChance: 0.45, hazards: false, feints: false, phases: 2, reaction: 0.35, desc: 'Faster recovery, purposeful positioning, two-move combinations.' },
  elite: { id: 'elite', name: 'Elite', hp: 1150, damage: 40, telegraph: 0.95, recovery: 0.88, speed: 1.16, comboChance: 0.55, hazards: true, feints: false, phases: 2, reaction: 0.3, desc: 'Stronger attacks, arena hazards, and a more varied second phase.' },
  champion: { id: 'champion', name: 'Champion', hp: 1950, damage: 56, telegraph: 0.88, recovery: 0.8, speed: 1.24, comboChance: 0.65, hazards: true, feints: true, phases: 2, reaction: 0.25, desc: 'Feints with readable cues, linked attacks, and moving safe areas.' },
  legendary: { id: 'legendary', name: 'Legendary', hp: 2950, damage: 74, telegraph: 0.82, recovery: 0.75, speed: 1.32, comboChance: 0.75, hazards: true, feints: true, phases: 3, reaction: 0.22, desc: 'Much stronger, three phases, demanding pattern combinations.' },
};

/**
 * Power Rating bands (matchmaking only — not a currency). Thresholds are a starting point
 * measured against the sample builds in tests/matchmaking.test.ts.
 */
export const POWER_BANDS: { tier: TierId; min: number }[] = [
  { tier: 'rookie', min: 0 },
  { tier: 'challenger', min: 45 },
  { tier: 'elite', min: 120 },
  { tier: 'champion', min: 210 },
  { tier: 'legendary', min: 310 },
];
export const POWER_RATING = {
  weights: { speed: 0.9, strength: 1.25, health: 0.85, willpower: 0.8 },
  /** extra weight for strongly specialized builds: × (max level − 1) */
  specialization: 0.55,
  activePower: 7,
  movementPower: 4,
  passivePower: 4,
};
/** Chance to draw from the adjacent cleared band instead of the current band. */
export const ADJACENT_BAND_CHANCE = 0.2;

/** Rewards for higher-tier first victories: bossId -> tier -> blueprint/title IDs */
export const TIER_MILESTONES: { boss: string | '*'; tier: TierId; blueprint?: string; title?: string; text: string }[] = [
  { boss: 'circuit-lynx', tier: 'challenger', blueprint: 'bp:mega-laser', text: 'Flame Blast blueprint' },
  { boss: 'granite-glove', tier: 'elite', blueprint: 'bp:meteor-punch', text: 'Meteor Slam blueprint' },
  { boss: 'frost-finch', tier: 'elite', title: 'Frost Breaker', text: 'The title "Frost Breaker"' },
  { boss: '*', tier: 'champion', blueprint: 'bp:titan-fist', title: 'Arena Champion', text: 'Titan Fist blueprint and title "Arena Champion"' },
  { boss: 'prism-moth', tier: 'champion', title: 'Prism Master', text: 'The title "Prism Master"' },
  { boss: '*', tier: 'legendary', blueprint: 'bp:nova-storm', title: 'Legendary Hero', text: 'Supernova blueprint and title "Legendary Hero"' },
];

/**
 * Reactive AI tuning per tier (chances are per opportunity, after the tier's reaction delay).
 * evade: sidestep/hop away from a visible player attack · jab: punish a player standing in melee range
 * guard: raise a brief readable guard against an attack · hop: jump onto platforms to chase
 * aggression: how much idle time is trimmed between moves
 */
export const TIER_AI: Record<TierId, { evade: number; jab: number; guard: number; hop: number; aggression: number; cooldown: number }> = {
  rookie: { evade: 0.16, jab: 0.45, guard: 0.05, hop: 0.5, aggression: 0.15, cooldown: 2.8 },
  challenger: { evade: 0.3, jab: 0.5, guard: 0.1, hop: 0.55, aggression: 0.2, cooldown: 2.6 },
  elite: { evade: 0.45, jab: 0.65, guard: 0.25, hop: 0.75, aggression: 0.35, cooldown: 2.1 },
  champion: { evade: 0.55, jab: 0.75, guard: 0.35, hop: 0.85, aggression: 0.45, cooldown: 1.8 },
  legendary: { evade: 0.65, jab: 0.85, guard: 0.45, hop: 0.9, aggression: 0.55, cooldown: 1.5 },
};
