import type { CombatDifficulty, TierId } from '../config/combat';
import type { Format, Stage, WordEntry } from '../content/schema';

export type AttributeKey = 'speed' | 'strength' | 'health' | 'willpower';
export type Attributes = Record<AttributeKey, number>;

export interface Appearance {
  skin: string;
  hair: string;
  hairColor: string;
  palette: string;
  emblem: string;
  mask: string;   // 'none' or id
  cape: string;   // 'none' or id
  gloves: string; // 'basic' | 'power'
  boots: string;  // 'basic' | 'rocket'
  armor: string;  // retired (armor looks were removed); always 'none'
  /** shapeshift: 'hero' (normal), 'blob', 'stickman' or a rival's id */
  shape?: string;
}

export interface Settings {
  grade: number;
  combatDifficulty: CombatDifficulty;
  readAloud: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  musicVolume: number;
  sfxVolume: number;
  newWordPace: 'auto' | 1 | 2 | 3;
  pauseOlderReviews: boolean;
  mixedGrades: boolean;
  learningOnly: boolean;
  dailyArenaLimit: number | null;
  useCustomWords: boolean;
  /** read-aloud voice chosen by a parent (null = best available) and speaking speed */
  voiceName: string | null;
  speechRate: number;
  /** parent permission for online room-code play */
  onlinePlay: boolean;
}

export interface Evidence {
  itemId: string;
  format: Format;
  stage: Stage | 'teach';
  date: string;      // local YYYY-MM-DD
  ts: number;
  correct: boolean;
  hinted: boolean;
  /** true when this is the follow-up attempt after reteaching */
  correction: boolean;
  missionId: string;
}

export type WordState = 'new' | 'learning' | 'practicing' | 'secure';

export interface WordProgress {
  id: string;
  introducedAt: number | null;
  introducedDate: string | null;
  evidence: Evidence[];
  reviewStep: number;
  nextReview: string | null;
  lastReviewAdvance: string | null;
  securedAt: number | null;
  mistakes: number;
  /** wrong option texts chosen, for "common confusions" */
  confusions: Record<string, number>;
}

export type StepKind = 'teach' | 'question' | 'reflect';
export interface MissionStep {
  key: string;            // unique within mission
  kind: StepKind;
  wordId: string;
  itemId?: string;
  /** teach steps: which card */
  card?: 'word' | 'hero' | 'everyday' | 'contrast';
  /** marks a question inserted after an error */
  followUp?: boolean;
}
export interface StepResult {
  attempts: number;
  hinted: boolean;
  correct: boolean | null; // first-try correctness
  done: boolean;
  corrected: boolean;
  /** shuffled option order persisted for resume */
  order?: string[];
}
export interface MissionState {
  id: string;
  startedAt: number;
  date: string;
  newWords: string[];
  reviewWords: string[];
  steps: MissionStep[];
  index: number;
  results: Record<string, StepResult>;
  completed: boolean;
  purposeful: number;
}

export interface LoadoutState {
  active: [string | null, string | null];
  movement: string | null;
  passive: string | null;
}

export interface EnemyLock {
  bossId: string;
  tier: TierId;
  difficulty: CombatDifficulty;
  hp: number;
  damage: number;
  seed: number;
}

export interface CombatSnapshot {
  playerHp: number;
  adrenaline: number;
  bossHp: number;
  phase: number;
  elapsed: number;
  playerX: number;
  bossX: number;
  cooldowns: Record<string, number>;
}

export interface TrialState {
  id: string;
  mode: 'paid' | 'practice' | 'tutorial';
  enemy: EnemyLock;
  paid: boolean;
  retryAvailable: boolean;
  retryUsed: boolean;
  attempt: number;
  status: 'ready' | 'active' | 'lost' | 'won' | 'abandoned';
  snapshot: CombatSnapshot | null;
  shieldBonus: boolean;
  createdAt: number;
}

export interface BossRecord {
  encountered: TierId[];
  wins: Partial<Record<TierId, number>>;
  bestTime: Partial<Record<TierId, number>>;
  challengeTrophies: TierId[];
}

export interface ResponseLog {
  ts: number;
  wordId: string;
  itemId: string;
  format: Format;
  stage: Stage | 'teach';
  correct: boolean;
  hinted: boolean;
}

export interface LedgerEntry { ts: number; delta: number; reason: string; id: string; }

export interface Profile {
  id: string;
  nickname: string;
  createdAt: number;
  settings: Settings;
  appearance: Appearance;
  points: number;
  awarded: Record<string, number>;
  ledger: LedgerEntry[];
  /** Challenges mode: completed challenges, best scores, attempts */
  challenges?: { cleared: ('balloons' | 'evade' | 'horde')[]; best: Partial<Record<'balloons' | 'evade' | 'horde', number>>; plays: number };
  words: Record<string, WordProgress>;
  mission: MissionState | null;
  completedMissions: number;
  owned: string[];
  /** Ability upgrade levels 1–3, keyed by power id (missing = 1). */
  powerLevels: Record<string, number>;
  blueprints: string[];
  attributes: Attributes;
  loadout: LoadoutState;
  bosses: Record<string, BossRecord>;
  trophies: string[];
  titles: string[];
  equippedTitle: string | null;
  arena: {
    highestBand: number;
    recent: string[];
    daily: { date: string; count: number };
    trial: TrialState | null;
    tutorialDone: boolean;
  };
  customWords: WordEntry[];
  responses: ResponseLog[];
  reflections: { ts: number; wordId: string; text: string }[];
  derivedConfigVersion: number;
  placement: { suggestedGrade: number; date: string; correctByGrade: Record<number, number> } | null;
  rankRewardsClaimed: number[];
  onboarded: boolean;
}

export interface SaveFile {
  app: 'vocab-hero';
  version: number;
  activeProfileId: string | null;
  profiles: Record<string, Profile>;
  savedAt: number;
}
