import { useSyncExternalStore } from 'react';
import { loadSave, writeSave } from '../core/save';
import { claimRankRewards } from '../core/rank';
import { refreshBand } from '../core/arena';
import type { Profile, SaveFile } from '../core/types';

const initial = loadSave();
let save: SaveFile = initial.save;
let version = 0;
const listeners = new Set<() => void>();
export const startupNotice: string | undefined = initial.error;
let toasts: { id: number; text: string }[] = [];
let toastId = 0;

function emit() { version++; listeners.forEach((l) => l()); }
export function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
export function useVersion() { return useSyncExternalStore(subscribe, () => version); }

export function getSave() { return save; }
export function activeProfile(): Profile | null { return save.activeProfileId ? save.profiles[save.activeProfileId] ?? null : null; }

export function useProfile(): Profile | null { useVersion(); return activeProfile(); }
export function useSave(): SaveFile { useVersion(); return save; }
export function useToasts() { useVersion(); return toasts; }

export function toast(text: string) {
  const id = ++toastId;
  toasts = [...toasts, { id, text }];
  emit();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit(); }, 4200);
}

/** Mutate the active profile, then persist. Rank-based learning unlocks are granted here. */
export function mutate(fn: (p: Profile) => void) {
  const p = activeProfile();
  if (!p) return;
  fn(p);
  for (const text of claimRankRewards(p)) toast(`🎓 ${text}`);
  refreshBand(p);
  persist();
}
export function persist() { writeSave(save); emit(); }
export function replaceSave(s: SaveFile) { save = s; persist(); }
export function setActive(id: string | null) { save.activeProfileId = id; persist(); }
export function addProfile(p: Profile) { save.profiles[p.id] = p; save.activeProfileId = p.id; persist(); }
export function deleteProfile(id: string) { delete save.profiles[id]; if (save.activeProfileId === id) save.activeProfileId = Object.keys(save.profiles)[0] ?? null; persist(); }
