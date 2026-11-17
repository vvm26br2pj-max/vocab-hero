import g2 from '../src/content/grades/grade2.json';
import type { GradePack } from '../src/content/schema';
import { indexFrom } from '../src/core/content';
import { createProfile } from '../src/core/profile';

export const pack2 = g2 as unknown as GradePack;
export function idx2() {
  // tests use the grade-2 pack also as the "grade 4" pack to exercise grade switching
  const p4 = { ...pack2, grade: 4, words: pack2.words.map((w) => { const id = w.id.replace(/\.(\d+)$/, '.4$1'); return { ...w, id, grade: 4, items: w.items.map((it) => ({ ...it, id: it.id.replace(w.id, id) })) }; }) };
  return indexFrom([pack2, p4]);
}
export function profile(grade = 2) { return createProfile('Tester', grade); }
export const DAY = 86400000;
export function seeded(seed = 1) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
