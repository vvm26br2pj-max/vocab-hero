import { DERIVED_CONFIG_VERSION } from '../config/economy';
import { createProfile, DEFAULT_APPEARANCE, DEFAULT_SETTINGS } from './profile';
import type { Profile, SaveFile } from './types';

export const SAVE_VERSION = 2;
const KEY = 'vocabhero.save';
const PREV_KEY = 'vocabhero.save.previous';

export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
function storage(): StorageLike | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export function emptySave(): SaveFile {
  return { app: 'vocab-hero', version: SAVE_VERSION, activeProfileId: null, profiles: {}, savedAt: Date.now() };
}

const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Fill in fields added by later versions; repair what can be repaired. Throws on unusable data. */
export function migrateProfile(raw: any): Profile {
  if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.nickname !== 'string') throw new Error('Profile is missing its id or nickname');
  const base = createProfile(raw.nickname, raw.settings?.grade ?? 4);
  const p: Profile = { ...base, ...raw };
  p.settings = { ...DEFAULT_SETTINGS, ...(isObj(raw.settings) ? raw.settings : {}) };
  p.appearance = { ...DEFAULT_APPEARANCE, ...(isObj(raw.appearance) ? raw.appearance : {}) };
  p.arena = { ...base.arena, ...(isObj(raw.arena) ? raw.arena : {}) };
  p.attributes = { ...base.attributes, ...(isObj(raw.attributes) ? raw.attributes : {}) };
  p.loadout = isObj(raw.loadout) && Array.isArray(raw.loadout.active) ? (raw.loadout as Profile["loadout"]) : base.loadout;
  for (const k of ['owned', 'blueprints', 'trophies', 'titles', 'customWords', 'responses', 'reflections', 'ledger', 'rankRewardsClaimed'] as const)
    if (!Array.isArray((p as any)[k])) (p as any)[k] = (base as any)[k];
  for (const k of ['awarded', 'words', 'bosses', 'powerLevels'] as const) if (!isObj((p as any)[k])) (p as any)[k] = {};
  if (typeof p.points !== 'number' || !isFinite(p.points) || p.points < 0) throw new Error('Coins value is invalid');
  for (const k of ['speed', 'strength', 'health', 'willpower'] as const) {
    const v = p.attributes[k];
    if (typeof v !== 'number' || v < 1 || v > 99) throw new Error(`Attribute ${k} is out of range`);
  }
  // armor looks were retired: give back what was paid (once) and take them off
  for (const id of p.owned.filter((x) => x.startsWith('armor:'))) {
    const key = `refund:${id}`;
    if (!p.awarded[key]) { p.awarded[key] = Date.now(); p.points += 120; p.ledger.unshift({ ts: Date.now(), delta: 120, reason: 'Refund: armor looks were retired', id: key } as any); }
  }
  p.owned = p.owned.filter((x) => !x.startsWith('armor:'));
  p.appearance.armor = 'none';
  if (p.settings.grade < 2 || p.settings.grade > 9) p.settings.grade = 4;
  p.derivedConfigVersion = DERIVED_CONFIG_VERSION;
  return p;
}

/** Validate and migrate any save object (from storage or an imported file). */
export function validateSave(data: unknown): SaveFile {
  if (!isObj(data) || data.app !== 'vocab-hero') throw new Error('This file is not a Vocab Hero save.');
  if (typeof data.version !== 'number' || data.version > SAVE_VERSION) throw new Error('This save comes from a newer version of Vocab Hero.');
  if (!isObj(data.profiles)) throw new Error('The save has no profiles.');
  const profiles: Record<string, Profile> = {};
  for (const [id, raw] of Object.entries(data.profiles)) profiles[id] = migrateProfile(raw);
  const active = typeof data.activeProfileId === 'string' && profiles[data.activeProfileId] ? data.activeProfileId : Object.keys(profiles)[0] ?? null;
  return { app: 'vocab-hero', version: SAVE_VERSION, activeProfileId: active, profiles, savedAt: Number(data.savedAt) || Date.now() };
}

export function loadSave(s: StorageLike | null = storage()): { save: SaveFile; recovered: boolean; error?: string } {
  if (!s) return { save: emptySave(), recovered: false, error: 'Browser storage is unavailable; progress will not be kept after closing.' };
  const raw = s.getItem(KEY);
  if (!raw) return { save: emptySave(), recovered: false };
  try { return { save: validateSave(JSON.parse(raw)), recovered: false }; }
  catch (e) {
    const prev = s.getItem(PREV_KEY);
    if (prev) { try { return { save: validateSave(JSON.parse(prev)), recovered: true, error: 'The latest save was damaged, so the previous save was restored.' }; } catch { /* fallthrough */ } }
    return { save: emptySave(), recovered: false, error: `Save could not be read (${(e as Error).message}). Starting fresh; the damaged data was kept in storage.` };
  }
}

let lastWritten = '';
export function writeSave(save: SaveFile, s: StorageLike | null = storage()): boolean {
  if (!s) return false;
  save.savedAt = Date.now();
  const json = JSON.stringify(save);
  if (json === lastWritten) return true;
  try {
    const cur = s.getItem(KEY);
    if (cur) {
      // keep the last *valid* save as the recoverable previous copy
      try { validateSave(JSON.parse(cur)); s.setItem(PREV_KEY, cur); } catch { /* keep older previous */ }
    }
    s.setItem(KEY, json);
    lastWritten = json;
    return true;
  } catch { return false; }
}

export function exportSave(save: SaveFile): string { return JSON.stringify({ ...save, exportedAt: new Date().toISOString() }, null, 1); }

export function importSave(text: string): { ok: true; save: SaveFile } | { ok: false; error: string } {
  try { return { ok: true, save: validateSave(JSON.parse(text)) }; }
  catch (e) { return { ok: false, error: e instanceof SyntaxError ? 'The file is not valid JSON.' : (e as Error).message }; }
}

export function restorePrevious(s: StorageLike | null = storage()): SaveFile | null {
  const prev = s?.getItem(PREV_KEY);
  if (!prev) return null;
  try { return validateSave(JSON.parse(prev)); } catch { return null; }
}
