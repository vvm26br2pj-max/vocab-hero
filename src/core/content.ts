import type { GradePack, PracticeItem, WordEntry } from '../content/schema';
import g2 from '../content/grades/grade2.json';
import g3 from '../content/grades/grade3.json';
import g4 from '../content/grades/grade4.json';
import g5 from '../content/grades/grade5.json';
import g6 from '../content/grades/grade6.json';
import g7 from '../content/grades/grade7.json';
import g8 from '../content/grades/grade8.json';
import g9 from '../content/grades/grade9.json';

export const GRADES = [2, 3, 4, 5, 6, 7, 8, 9];
const RAW: GradePack[] = [g2, g3, g4, g5, g6, g7, g8, g9] as unknown as GradePack[];

export interface RecallItem extends PracticeItem { accepted: string[] }

/** Items generated from each entry so every word also gets typed recall and a scene choice. */
export function generatedItems(w: WordEntry): PracticeItem[] {
  const recall: RecallItem = {
    id: `${w.id}#recall`, format: 'recall', stage: 'independent',
    prompt: `Type the word that means: “${w.definition}”`,
    answer: w.word, accepted: w.forms.length ? w.forms : [w.word],
    hint: `It starts with “${w.word[0]}” and has ${w.word.length} letters.`,
    explanation: `The word is “${w.word}”: ${w.definition}. Example: ${w.everyday}`,
  };
  const items: PracticeItem[] = [recall];
  if (w.hero?.scene && w.contrast?.scene && w.contrast.nonExample) {
    items.push({
      id: `${w.id}#scene`, format: 'scene_choice', stage: 'supported',
      prompt: `Which scene shows the meaning of “${w.word}”?`,
      options: [{ id: 'hero', text: w.hero.text }, { id: 'contrast', text: w.contrast.nonExample }],
      answer: 'hero',
      hint: `Remember: ${w.word} means ${w.definition}.`,
      explanation: `${w.hero.text} That shows ${w.word}. The other scene is a non-example: ${w.contrast.explanation}`,
    });
  }
  return items;
}

export interface ContentIndex {
  byId: Map<string, WordEntry>;
  byGrade: Map<number, WordEntry[]>;
  items: Map<string, { item: PracticeItem; word: WordEntry }>;
  packs: GradePack[];
}

function buildIndex(packs: GradePack[], custom: WordEntry[] = []): ContentIndex {
  const byId = new Map<string, WordEntry>();
  const byGrade = new Map<number, WordEntry[]>();
  const items = new Map<string, { item: PracticeItem; word: WordEntry }>();
  const add = (w: WordEntry) => {
    byId.set(w.id, w);
    for (const it of [...w.items, ...generatedItems(w)]) items.set(it.id, { item: it, word: w });
  };
  for (const p of packs) {
    byGrade.set(p.grade, p.words);
    p.words.forEach(add);
  }
  custom.forEach(add);
  byGrade.set(0, custom);
  return { byId, byGrade, items, packs };
}

let index = buildIndex(RAW);
let customKey = '';
export function content(custom?: WordEntry[]): ContentIndex {
  if (custom) {
    const key = custom.map((c) => c.id).join('|');
    if (key !== customKey) { customKey = key; index = buildIndex(RAW, custom); }
  }
  return index;
}
export function packFor(grade: number): GradePack | undefined { return RAW.find((p) => p.grade === grade); }
export function allItems(w: WordEntry): PracticeItem[] { return [...w.items, ...generatedItems(w)]; }

/** For tests: build an index from arbitrary packs. */
export function indexFrom(packs: GradePack[], custom: WordEntry[] = []): ContentIndex { return buildIndex(packs, custom); }
