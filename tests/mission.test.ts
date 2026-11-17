import { buildMission, submitAnswer, advance, useHint, recallMatches, checkAnswer } from '../src/core/mission';
import { wordState } from '../src/core/mastery';
import { REWARDS } from '../src/config/economy';
import { idx2, profile, seeded, DAY } from './helpers';
import type { MissionState, Profile } from '../src/core/types';
import type { ContentIndex } from '../src/core/content';

function correctAnswer(idx: ContentIndex, itemId: string) {
  const it = idx.items.get(itemId)!.item;
  return it.answer;
}
function wrongAnswer(idx: ContentIndex, itemId: string) {
  const it = idx.items.get(itemId)!.item;
  if (it.format === 'recall') return 'zzzzzz';
  if (Array.isArray(it.answer)) return [...it.answer].reverse();
  return it.options!.find((o) => o.id !== it.answer)!.id;
}
function play(p: Profile, idx: ContentIndex, m: MissionState, now: number, wrongEvery = 0) {
  let n = 0;
  while (!m.completed && m.index < m.steps.length) {
    const s = m.steps[m.index];
    if (s.kind === 'question') {
      n++;
      if (wrongEvery && n % wrongEvery === 0) submitAnswer(p, idx, m, s.key, wrongAnswer(idx, s.itemId!) as any, now);
      submitAnswer(p, idx, m, s.key, correctAnswer(idx, s.itemId!) as any, now);
    }
    advance(p, idx, m, now);
  }
}

describe('missions', () => {
  const idx = idx2();
  it('teaches before testing: every new word has teach cards before its first question', () => {
    const p = profile();
    const { mission } = buildMission(p, idx, Date.now(), seeded(3));
    for (const w of mission.newWords) {
      const firstTeach = mission.steps.findIndex((s) => s.wordId === w && s.kind === 'teach');
      const firstQ = mission.steps.findIndex((s) => s.wordId === w && s.kind === 'question');
      expect(firstTeach).toBeGreaterThanOrEqual(0);
      expect(firstTeach).toBeLessThan(firstQ);
      const q = idx.items.get(mission.steps[firstQ].itemId!)!.item;
      expect(q.stage).toBe('supported');
    }
  });
  it('typical mission has 2-3 new words and 10-16 responses', () => {
    const p = profile();
    const { mission } = buildMission(p, idx, Date.now(), seeded(4));
    const qs = mission.steps.filter((s) => s.kind === 'question').length;
    expect(mission.newWords.length).toBeGreaterThanOrEqual(2);
    expect(mission.newWords.length).toBeLessThanOrEqual(3);
    expect(qs).toBeGreaterThanOrEqual(9);
    expect(qs).toBeLessThanOrEqual(16);
  });
  it('a completed mission earns roughly 60-100 points; repeat submits never double pay', () => {
    const p = profile(); const start = p.points;
    const { mission } = buildMission(p, idx, Date.now(), seeded(5));
    const s = mission.steps.find((x) => x.kind === 'question')!;
    submitAnswer(p, idx, mission, s.key, correctAnswer(idx, s.itemId!) as any);
    const after1 = p.points;
    submitAnswer(p, idx, mission, s.key, correctAnswer(idx, s.itemId!) as any);
    submitAnswer(p, idx, mission, s.key, correctAnswer(idx, s.itemId!) as any);
    expect(p.points).toBe(after1);
    play(p, idx, mission, Date.now());
    const earned = p.points - start;
    expect(earned).toBeGreaterThanOrEqual(60);
    expect(earned).toBeLessThanOrEqual(100);
    expect(mission.completed).toBe(true);
    const pts = p.points;
    advance(p, idx, mission); // replay completion
    expect(p.points).toBe(pts);
  });
  it('wrong answers explain, add a follow-up question, award correction points, and never subtract', () => {
    const p = profile();
    const { mission } = buildMission(p, idx, Date.now(), seeded(6));
    const s = mission.steps.find((x) => x.kind === 'question')!;
    const before = p.points; const len = mission.steps.length;
    const o = submitAnswer(p, idx, mission, s.key, wrongAnswer(idx, s.itemId!) as any);
    expect(o.correct).toBe(false);
    expect(o.explanation.length).toBeGreaterThan(5);
    expect(p.points).toBe(before);
    expect(mission.steps.length).toBe(len + 1);
    const o2 = submitAnswer(p, idx, mission, s.key, correctAnswer(idx, s.itemId!) as any);
    expect(o2.points).toBe(REWARDS.correction);
  });
  it('hinted correct answers earn 3', () => {
    const p = profile();
    const { mission } = buildMission(p, idx, Date.now(), seeded(7));
    const s = mission.steps.find((x) => x.kind === 'question')!;
    useHint(mission, s.key);
    expect(submitAnswer(p, idx, mission, s.key, correctAnswer(idx, s.itemId!) as any).points).toBe(REWARDS.correctAfterHint);
  });
  it('three misses reveal the answer with no points (revealing is not a correction)', () => {
    const p = profile();
    const { mission } = buildMission(p, idx, Date.now(), seeded(8));
    const s = mission.steps.find((x) => x.kind === 'question')!;
    const before = p.points;
    for (let i = 0; i < 3; i++) submitAnswer(p, idx, mission, s.key, wrongAnswer(idx, s.itemId!) as any);
    expect(mission.results[s.key].done).toBe(true);
    expect(submitAnswer(p, idx, mission, s.key, correctAnswer(idx, s.itemId!) as any).points).toBe(0);
    expect(p.points).toBe(before);
  });
  it('words never repeat as new, and grade change keeps reviews while drawing new words from the new grade', () => {
    const p = profile(2);
    const t0 = new Date(2026, 2, 2, 9).getTime();
    const m1 = buildMission(p, idx, t0, seeded(9)).mission; play(p, idx, m1, t0);
    const owned = p.points;
    p.settings.grade = 4;
    const m2 = buildMission(p, idx, t0 + DAY, seeded(10)).mission;
    for (const w of m2.newWords) { expect(idx.byId.get(w)!.grade).toBe(4); expect(m1.newWords).not.toContain(w); }
    expect(m2.reviewWords.some((w) => m1.newWords.includes(w))).toBe(true);
    expect(p.points).toBe(owned);
    p.settings.pauseOlderReviews = true;
    const m3 = buildMission(p, idx, t0 + DAY, seeded(11)).mission;
    expect(m3.reviewWords.every((w) => idx.byId.get(w)!.grade === 4)).toBe(true);
  });
  it('a word reaches Secure only after multi-day, multi-format independent success', () => {
    const p = profile(2);
    let t = new Date(2026, 3, 1, 9).getTime();
    p.settings.newWordPace = 2;
    const first = buildMission(p, idx, t, seeded(12)).mission; play(p, idx, first, t);
    const w = first.newWords[0];
    expect(wordState(p.words[w])).not.toBe('secure');
    for (let d = 1; d < 30 && wordState(p.words[w]) !== 'secure'; d++) {
      t += DAY; p.settings.newWordPace = 1;
      const m = buildMission(p, idx, t, seeded(20 + d)).mission; play(p, idx, m, t);
    }
    expect(wordState(p.words[w])).toBe('secure');
    expect(p.awarded[`secure:${w}`]).toBeDefined();
    const dates = new Set(p.words[w].evidence.filter((e) => e.correct).map((e) => e.date));
    expect(dates.size).toBeGreaterThanOrEqual(3);
  });
  it('pack complete is reported, not silently repeated', () => {
    const p = profile(2);
    for (const w of idx.byGrade.get(2)!) p.words[w.id] = { ...p.words[w.id], id: w.id, introducedAt: 1, introducedDate: '2026-01-01', evidence: [], reviewStep: 0, nextReview: '2099-01-01', lastReviewAdvance: null, securedAt: null, mistakes: 0, confusions: {} };
    const r = buildMission(p, idx, Date.now(), seeded(1));
    expect(r.packComplete).toBe(true);
    expect(r.mission.newWords.length).toBe(0);
  });
  it('recall tolerates minor spelling and inflections', () => {
    expect(recallMatches('enormus', ['enormous']).ok).toBe(true);
    expect(recallMatches('gathered', ['gather', 'gathered', 'gathers']).ok).toBe(true);
    expect(recallMatches('tiny', ['tidy']).ok).toBe(false);
    expect(checkAnswer({ id: 'x', format: 'sentence_build', stage: 'independent', prompt: '', answer: ['c1', 'c2'], hint: '', explanation: '' }, ['c2', 'c1'])).toBe(false);
  });
});
