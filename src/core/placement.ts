import type { PracticeItem, WordEntry } from '../content/schema';
import { GRADES, type ContentIndex } from './content';
import { shuffle } from './mission';
import type { Profile } from './types';

export interface PlacementQ { grade: number; word: WordEntry; item: PracticeItem; order: string[] }

/** Optional short sampler: two quick meaning checks per grade. Suggests, never changes the grade. */
export function buildPlacement(idx: ContentIndex, rng = Math.random): PlacementQ[] {
  const qs: PlacementQ[] = [];
  for (const g of GRADES) {
    const words = shuffle(idx.byGrade.get(g) ?? [], rng).slice(0, 2);
    for (const w of words) {
      const item = w.items.find((i) => i.stage === 'supported' && i.options && i.format !== 'example_nonexample') ?? w.items.find((i) => i.options && i.format !== 'example_nonexample');
      if (item?.options) qs.push({ grade: g, word: w, item, order: shuffle(item.options.map((o) => o.id), rng) });
    }
  }
  return qs;
}

export function suggestFromPlacement(correctByGrade: Record<number, number>): number {
  let suggested = 2;
  for (const g of GRADES) {
    if ((correctByGrade[g] ?? 0) >= 2) suggested = g;
    else if ((correctByGrade[g] ?? 0) === 0) break;
  }
  return Math.min(9, suggested);
}

export interface GradeSuggestion { grade: number; reason: string }
/** Suggest a grade change to the parent, with a reason. Never applied automatically. */
export function suggestGradeChange(p: Profile, idx: ContentIndex): GradeSuggestion | null {
  const g = p.settings.grade;
  const recent = p.responses.filter((r) => idx.byId.get(r.wordId)?.grade === g && r.stage !== 'supported').slice(-40);
  if (recent.length < 25) return null;
  const acc = recent.filter((r) => r.correct && !r.hinted).length / recent.length;
  if (acc >= 0.92 && g < 9) return { grade: g + 1, reason: `Over the last ${recent.length} independent questions at grade ${g}, ${Math.round(acc * 100)}% were correct without hints. Grade ${g + 1} words may be a better stretch.` };
  if (acc <= 0.45 && g > 2) return { grade: g - 1, reason: `Over the last ${recent.length} independent questions at grade ${g}, ${Math.round(acc * 100)}% were correct without hints. Grade ${g - 1} words may build confidence first.` };
  return null;
}
