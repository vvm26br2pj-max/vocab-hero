import type { BattleScene } from './BattleScene';

/** The battle currently on screen (used by the developer console). */
let active: BattleScene | null = null;
export function setActiveBattle(s: BattleScene | null) { active = s; }
export function activeBattle(): BattleScene | null { return active; }
