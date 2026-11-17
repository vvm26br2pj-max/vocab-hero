// Central tuning for rewards, prices, attributes, mastery and review.
// Every number a playtester may want to change lives here or in combat.ts / shop.ts.

export const STARTING_POINTS = 25;

export const REWARDS = {
  /** Correct response without an answer hint */
  correct: 5,
  /** Correct response after a hint */
  correctAfterHint: 3,
  /** Completing a correction after reteaching */
  correction: 2,
  /** Completing a mission with at least `missionMinResponses` purposeful responses */
  missionComplete: 20,
  missionMinResponses: 8,
  /** First time a word reaches Secure */
  firstSecure: 15,
} as const;

export const ARENA_ENTRY_FEE = 10;

/** Price per individual level, by the level being purchased. */
export const ATTRIBUTE_COST_BANDS: { from: number; to: number; cost: number }[] = [
  { from: 2, to: 10, cost: 20 },
  { from: 11, to: 25, cost: 40 },
  { from: 26, to: 50, cost: 70 },
  { from: 51, to: 75, cost: 110 },
  { from: 76, to: 99, cost: 160 },
];
export const ATTRIBUTE_MIN = 1;
export const ATTRIBUTE_MAX = 99;

/** Derived-stat formulas. Bump DERIVED_CONFIG_VERSION when these change so saves can record it. */
export const DERIVED_CONFIG_VERSION = 1;
export const DERIVED = {
  speed: { base: 1, gainAt99: 1.4 },          // run multiplier = 1 + 1.4 * (L-1)/98
  strength: { perLevel: 0.025 },              // damage multiplier = 1 + 0.025 * (L-1)
  /** Willpower also multiplies Energy-attack damage, at the same rate Strength multiplies Might */
  willpowerDamage: { perLevel: 0.025 },       // energy damage multiplier = 1 + 0.025 * (L-1)
  health: { base: 100, perLevel: 6 },         // max HP = 100 + 6 * (L-1)
  willpower: { base: 40, perLevel: 2 },       // max adrenaline = 40 + 2 * (L-1)
  /** Speed also modestly shortens dodge recovery: from base to base*(1-dodgeRecoveryCut) at 99 */
  dodgeRecoveryCut: 0.3,
};

export const MASTERY = {
  /** independent correct responses (no hint, not a supported item), counted once per item per date */
  independentCorrect: 4,
  distinctDates: 3,
  distinctFormats: 2,
  distinctItems: 2,
  /** at least this many correct responses on a fresh-context ("transfer" stage) item */
  freshContexts: 1,
  /** independent corrects needed to move from Learning to Practicing */
  practicingAt: 2,
};

/** Days after each successful review step. Configurable starting point, not a proven optimum. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30];

export const MISSION = {
  minResponses: 10,
  maxResponses: 16,
  reviewWords: 5,
  /** max near-identical prompts (same format) in a row */
  maxSameFormatRun: 2,
  /** how many due reviews to take per mission when a backlog exists */
  maxDuePerMission: 5,
};

export const ACADEMY_RANKS: { name: string; at: number }[] = [
  { name: 'Recruit', at: 0 },
  { name: 'Cadet', at: 10 },
  { name: 'Trainee', at: 30 },
  { name: 'Sidekick', at: 60 },
  { name: 'Hero', at: 110 },
  { name: 'Guardian', at: 180 },
  { name: 'Champion', at: 280 },
  { name: 'Legend', at: 420 },
];
/** Rank points: introduced word = 1, Secure word = 4, completed mission = 2 */
export const RANK_POINTS = { introduced: 1, secure: 4, mission: 2 };
