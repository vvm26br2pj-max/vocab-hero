import { STARTING_POINTS, DERIVED_CONFIG_VERSION } from '../config/economy';
import { localDate } from './dates';
import type { Appearance, Profile, Settings } from './types';

export const SKIN_TONES = ['#f9d7b9', '#eebb94', '#d39a6a', '#a8714a', '#7a4e2d', '#4f3220'];
export const HAIR_STYLES = ['short', 'spiky', 'long', 'bun', 'curly', 'buzz', 'ponytail', 'mohawk'];
export const HAIR_COLORS = ['#1d1a1a', '#5a3825', '#a0522d', '#e2b659', '#d94f2b', '#7c7c8a', '#3d6bff', '#e05fb4'];

export const DEFAULT_SETTINGS: Settings = {
  grade: 4,
  combatDifficulty: 'standard',
  readAloud: false,
  largeText: false,
  reducedMotion: false,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  newWordPace: 'auto',
  pauseOlderReviews: false,
  mixedGrades: false,
  learningOnly: false,
  dailyArenaLimit: null,
  useCustomWords: false,
  voiceName: null,
  speechRate: 1,
  onlinePlay: false,
};

export const DEFAULT_APPEARANCE: Appearance = {
  skin: SKIN_TONES[1], hair: 'short', hairColor: HAIR_COLORS[1], palette: 'hero-red', emblem: 'star',
  mask: 'none', cape: 'none', gloves: 'basic', boots: 'basic', armor: 'none', shape: 'hero',
};

export function newId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createProfile(nickname: string, grade = 4, appearance: Partial<Appearance> = {}, now = Date.now()): Profile {
  return {
    id: newId('p'),
    nickname: nickname.trim().slice(0, 20) || 'Recruit',
    createdAt: now,
    settings: { ...DEFAULT_SETTINGS, grade },
    appearance: { ...DEFAULT_APPEARANCE, ...appearance },
    points: STARTING_POINTS,
    awarded: { 'start:bonus': now },
    ledger: [{ ts: now, delta: STARTING_POINTS, reason: 'Welcome to the Academy', id: 'start:bonus' }],
    words: {},
    mission: null,
    completedMissions: 0,
    owned: [],
    powerLevels: {},
    blueprints: [],
    attributes: { speed: 1, strength: 1, health: 1, willpower: 1 },
    loadout: { active: [null, null], movement: null, passive: null },
    bosses: {},
    trophies: [],
    titles: ['Recruit'],
    equippedTitle: 'Recruit',
    arena: { highestBand: 0, recent: [], daily: { date: localDate(now), count: 0 }, trial: null, tutorialDone: false },
    customWords: [],
    responses: [],
    reflections: [],
    derivedConfigVersion: DERIVED_CONFIG_VERSION,
    placement: null,
    rankRewardsClaimed: [],
    onboarded: false,
  };
}
