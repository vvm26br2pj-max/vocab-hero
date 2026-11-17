import { content, GRADES, allItems } from '../src/core/content';
import { buildMission } from '../src/core/mission';
import { createProfile } from '../src/core/profile';
import { buildPlacement, suggestFromPlacement } from '../src/core/placement';
import { parseWordList, buildCustomEntry } from '../src/core/customWords';

describe('authored content packs', () => {
  const idx = content();
  it('every grade 2-9 has at least 40 distinct words with pending review', () => {
    const seen = new Set<string>();
    for (const g of GRADES) {
      const words = idx.byGrade.get(g)!;
      expect(words.length).toBeGreaterThanOrEqual(40);
      for (const w of words) {
        expect(seen.has(w.word)).toBe(false); seen.add(w.word);
        expect(w.grade).toBe(g);
        expect(w.review).toBe('pending');
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(320);
  });
  it('every entry has teaching content, 4+ items across 3+ formats, and explanations for every item', () => {
    for (const g of GRADES) for (const w of idx.byGrade.get(g)!) {
      expect(w.definition.length).toBeGreaterThan(3);
      expect(w.hero.text && w.everyday && w.contrast.nonExample && w.contrast.explanation).toBeTruthy();
      expect(w.items.length).toBeGreaterThanOrEqual(4);
      expect(new Set(w.items.map((i) => i.format)).size).toBeGreaterThanOrEqual(3);
      for (const it of allItems(w)) { expect(it.explanation.length).toBeGreaterThan(5); expect(it.hint.length).toBeGreaterThan(3); }
    }
  });
  it('higher grades use longer, more demanding passages on average', () => {
    const avg = (g: number) => { const ps = idx.byGrade.get(g)!.flatMap((w) => w.items.map((i) => (i.passage ?? i.prompt).length)); return ps.reduce((a, b) => a + b, 0) / ps.length; };
    expect(avg(9)).toBeGreaterThan(avg(2));
    expect(avg(7)).toBeGreaterThan(avg(3));
  });
  it('a first mission at every grade teaches its own grade words before testing them', () => {
    for (const g of GRADES) {
      const p = createProfile('T', g);
      const { mission } = buildMission(p, idx);
      expect(mission.newWords.length).toBeGreaterThan(0);
      for (const id of mission.newWords) {
        expect(idx.byId.get(id)!.grade).toBe(g);
        const teach = mission.steps.findIndex((s) => s.wordId === id && s.kind === 'teach');
        const q = mission.steps.findIndex((s) => s.wordId === id && s.kind === 'question');
        expect(teach).toBeLessThan(q);
      }
    }
  });
  it('placement suggests but never changes the grade', () => {
    const qs = buildPlacement(idx);
    expect(qs.length).toBe(16);
    expect(suggestFromPlacement({ 2: 2, 3: 2, 4: 2, 5: 1, 6: 0 })).toBe(4);
  });
  it('parent word lists flag missing data and build practice items', () => {
    const rows = parseWordList('habitat | noun | the natural home of an animal | The pond is a habitat for frogs. | A desert habitat is dry.\nblorp | | | ', new Set());
    expect(rows[0].issues).toEqual([]);
    expect(rows[1].issues.length).toBeGreaterThan(0);
    const e = buildCustomEntry(rows[0], idx.byGrade.get(4)!, 1);
    expect(e.items.map((i) => i.stage)).toEqual(['supported', 'independent', 'transfer']);
  });
});
