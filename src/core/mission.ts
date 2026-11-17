import { MISSION, REWARDS } from '../config/economy';
import type { PracticeItem, WordEntry } from '../content/schema';
import { allItems, type ContentIndex, type RecallItem } from './content';
import { localDate } from './dates';
import { isDue, markIntroduced, newProgress, recordEvidence, summarize, wordState } from './mastery';
import { award } from './rewards';
import { newId } from './profile';
import type { MissionState, MissionStep, Profile, StepResult } from './types';

type Rng = () => number;

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function progressFor(p: Profile, id: string) {
  return (p.words[id] ??= newProgress(id));
}

/** Recent first-try accuracy (0..1), or null if too little data. */
export function recentAccuracy(p: Profile, n = 20): number | null {
  const r = p.responses.slice(-n);
  if (r.length < 6) return null;
  return r.filter((x) => x.correct && !x.hinted).length / r.length;
}

export function newWordPool(p: Profile, idx: ContentIndex): WordEntry[] {
  const s = p.settings;
  const grades = s.mixedGrades ? [s.grade - 1, s.grade, s.grade + 1].filter((g) => g >= 2 && g <= 9) : [s.grade];
  const pool: WordEntry[] = [];
  if (s.useCustomWords) pool.push(...(idx.byGrade.get(0) ?? []));
  for (const g of grades) pool.push(...(idx.byGrade.get(g) ?? []));
  return pool.filter((w) => !p.words[w.id] || p.words[w.id].introducedAt === null);
}

export function dueWords(p: Profile, idx: ContentIndex, today = localDate()): WordEntry[] {
  return Object.values(p.words)
    .filter((w) => isDue(w, today))
    .map((w) => idx.byId.get(w.id))
    .filter((w): w is WordEntry => !!w)
    .filter((w) => !p.settings.pauseOlderReviews || w.grade === 0 || w.grade === p.settings.grade)
    .sort((a, b) => {
      const pa = p.words[a.id], pb = p.words[b.id];
      // most overdue first, then words with more mistakes
      return (pa.nextReview! < pb.nextReview! ? -1 : pa.nextReview! > pb.nextReview! ? 1 : 0) || pb.mistakes - pa.mistakes;
    });
}

export function newWordCount(p: Profile, idx: ContentIndex, today = localDate()): number {
  const pace = p.settings.newWordPace;
  if (pace !== 'auto') return pace;
  const acc = recentAccuracy(p);
  const backlog = dueWords(p, idx, today).length;
  if (acc !== null && acc < 0.6) return 2;
  if (backlog > 12) return 2;
  return 3;
}

function lastFormats(steps: MissionStep[], idx: ContentIndex, n = MISSION.maxSameFormatRun): string[] {
  return steps.filter((s) => s.kind === 'question').slice(-n).map((s) => idx.items.get(s.itemId!)!.item.format);
}

interface PickOpts { stages: string[]; used: Set<string>; avoidFormats: string[]; prefer?: string[]; }
function pickItem(w: WordEntry, opts: PickOpts, rng: Rng): PracticeItem | null {
  const items = allItems(w).filter((it) => opts.stages.includes(it.stage) && !opts.used.has(it.id));
  if (!items.length) return null;
  const run = opts.avoidFormats;
  const blocked = run.length >= MISSION.maxSameFormatRun && run.every((f) => f === run[0]) ? run[0] : null;
  const score = (it: PracticeItem) => (it.format === blocked ? -10 : 0) + (opts.prefer?.includes(it.format) ? 2 : 0) + (run.includes(it.format) ? -1 : 0) + rng();
  return items.sort((a, b) => score(b) - score(a))[0];
}

function initResult(item: PracticeItem | undefined, rng: Rng): StepResult {
  const r: StepResult = { attempts: 0, hinted: false, correct: null, done: false, corrected: false };
  if (item?.format === 'sentence_build' && item.chunks) r.order = shuffle(item.chunks.map((c) => c.id), rng);
  else if (item?.options && item.format !== 'example_nonexample') r.order = shuffle(item.options.map((o) => o.id), rng);
  return r;
}

export interface BuildResult { mission: MissionState; packComplete: boolean; }

export function buildMission(p: Profile, idx: ContentIndex, now = Date.now(), rng: Rng = Math.random): BuildResult {
  const today = localDate(now);
  const pool = newWordPool(p, idx);
  const packComplete = pool.length === 0;
  const nNew = Math.min(newWordCount(p, idx, today), pool.length);
  const newWords = pool.slice(0, nNew);
  // reviews: due first (spread backlog), then not-yet-secure words for spaced practice
  const due = dueWords(p, idx, today).slice(0, MISSION.maxDuePerMission);
  const extra = Object.values(p.words)
    .filter((w) => w.introducedAt !== null && wordState(w) !== 'secure' && !due.find((d) => d.id === w.id))
    .map((w) => idx.byId.get(w.id)).filter((w): w is WordEntry => !!w)
    .filter((w) => !p.settings.pauseOlderReviews || w.grade === 0 || w.grade === p.settings.grade);
  const reviewWords = [...due, ...shuffle(extra, rng)].slice(0, MISSION.reviewWords);
  const steps: MissionStep[] = [];
  const used = new Set<string>();
  const acc = recentAccuracy(p);
  const strong = acc !== null && acc > 0.85;
  const struggling = acc !== null && acc < 0.6;
  let k = 0;
  const q = (w: WordEntry, stages: string[], prefer?: string[], followUp = false): boolean => {
    const it = pickItem(w, { stages, used, avoidFormats: lastFormats(steps, idx), prefer }, rng);
    if (!it) return false;
    used.add(it.id);
    steps.push({ key: `s${k++}`, kind: 'question', wordId: w.id, itemId: it.id, followUp });
    return true;
  };
  const teach = (w: WordEntry) => {
    for (const card of (w.contrast?.nonExample ? ['word', 'hero', 'everyday', 'contrast'] as const : ['word', 'everyday'] as const)) steps.push({ key: `s${k++}`, kind: 'teach', wordId: w.id, card });
    q(w, ['supported']) || q(w, ['independent']);
  };
  const reviewPrefer = struggling ? ['meaning', 'example_nonexample', 'scene_choice'] : strong ? ['context_clues', 'sentence_build', 'best_word', 'recall'] : undefined;
  const reviewQ = (w: WordEntry) => {
    const prog = p.words[w.id];
    const needsFresh = prog && summarize(prog).fresh === 0 && wordState(prog) !== 'learning';
    return (needsFresh && q(w, ['transfer'], reviewPrefer)) || q(w, ['independent', 'transfer'], reviewPrefer) || q(w, ['supported']);
  };
  const reviews = reviewWords.slice();
  newWords.forEach((w, i) => {
    teach(w);
    if (i > 0) q(newWords[i - 1], ['independent']);
    const r = reviews.shift(); if (r) reviewQ(r);
  });
  if (newWords.length) q(newWords[newWords.length - 1], ['independent']);
  const second = newWords.slice();
  while (reviews.length || second.length) {
    const r = reviews.shift(); if (r) reviewQ(r);
    const w = second.shift(); if (w) q(w, ['independent'], ['sentence_build', 'recall', 'context_clues']);
  }
  // top up to the minimum with extra review/independent questions
  const pad = [...reviewWords, ...newWords];
  let guard = 0;
  while (steps.filter((s) => s.kind === 'question').length < MISSION.minResponses && pad.length && guard++ < 40) {
    const w = pad[guard % pad.length];
    q(w, idx.byId.get(w.id) && newWords.includes(w) ? ['independent'] : ['independent', 'transfer']);
  }
  // cap
  let count = 0;
  const capped = steps.filter((s) => s.kind !== 'question' || ++count <= MISSION.maxResponses);
  if (newWords.length) capped.push({ key: `s${k++}`, kind: 'reflect', wordId: newWords[0].id });
  const results: Record<string, StepResult> = {};
  for (const s of capped) results[s.key] = initResult(s.itemId ? idx.items.get(s.itemId)?.item : undefined, rng);
  return {
    packComplete,
    mission: {
      id: newId('m'), startedAt: now, date: today, newWords: newWords.map((w) => w.id), reviewWords: reviewWords.map((w) => w.id),
      steps: capped, index: 0, results, completed: false, purposeful: 0,
    },
  };
}

// ---------- answering ----------

export function normalize(s: string) { return s.toLowerCase().trim().replace(/[^a-z' -]/g, ''); }
export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
/** Typed recall: accepts listed inflections and tolerates minor spelling errors. */
export function recallMatches(typed: string, accepted: string[]): { ok: boolean; exact: boolean; matched?: string } {
  const t = normalize(typed);
  if (!t) return { ok: false, exact: false };
  for (const a of accepted) if (normalize(a) === t) return { ok: true, exact: true, matched: a };
  for (const a of accepted) {
    const n = normalize(a);
    const tol = n.length <= 4 ? 0 : n.length <= 7 ? 1 : 2;
    if (levenshtein(n, t) <= tol) return { ok: true, exact: false, matched: a };
  }
  return { ok: false, exact: false };
}

export function checkAnswer(item: PracticeItem, answer: string | string[]): boolean {
  if (item.format === 'recall') return recallMatches(String(answer), (item as RecallItem).accepted ?? [String(item.answer)]).ok;
  if (Array.isArray(item.answer)) return Array.isArray(answer) && answer.length === item.answer.length && answer.every((a, i) => a === (item.answer as string[])[i]);
  return answer === item.answer;
}

export interface AnswerOutcome {
  correct: boolean;
  points: number;
  securedNow: boolean;
  revealed: boolean;     // the answer was shown after repeated misses (no points)
  explanation: string;
  targeted?: string;
  followUpAdded: boolean;
}

export const MAX_ATTEMPTS = 3;

export function useHint(m: MissionState, stepKey: string) {
  const r = m.results[stepKey];
  if (r && !r.done) r.hinted = true;
}

/** Submit an answer for the current question step. Safe to call repeatedly: points are idempotent. */
export function submitAnswer(p: Profile, idx: ContentIndex, m: MissionState, stepKey: string, answer: string | string[], now = Date.now(), rng: Rng = Math.random): AnswerOutcome {
  const step = m.steps.find((s) => s.key === stepKey)!;
  const r = m.results[stepKey];
  const { item, word } = idx.items.get(step.itemId!)!;
  const base = { explanation: item.explanation, securedNow: false, followUpAdded: false, revealed: false, points: 0 };
  if (r.done) return { ...base, correct: checkAnswer(item, answer) }; // replay: feedback only, no points
  const correct = checkAnswer(item, answer);
  const firstTry = r.attempts === 0;
  r.attempts++;
  const prog = progressFor(p, word.id);
  if (prog.introducedAt === null) markIntroduced(prog, now);
  const date = localDate(now);
  const wrongText = !correct && !Array.isArray(answer) ? item.options?.find((o) => o.id === answer)?.text ?? String(answer) : undefined;
  let securedNow = false;
  if (firstTry || correct) {
    securedNow = recordEvidence(prog, {
      itemId: item.id, format: item.format, stage: item.stage, date, ts: now, correct,
      hinted: r.hinted, correction: !firstTry, missionId: m.id,
    }, wrongText);
  } else {
    recordEvidence(prog, { itemId: item.id, format: item.format, stage: item.stage, date, ts: now, correct: false, hinted: r.hinted, correction: true, missionId: m.id }, wrongText);
  }
  if (firstTry) {
    r.correct = correct;
    p.responses.push({ ts: now, wordId: word.id, itemId: item.id, format: item.format, stage: item.stage, correct, hinted: r.hinted });
    if (p.responses.length > 3000) p.responses.splice(0, p.responses.length - 3000);
  }
  let points = 0;
  const rid = `resp:${m.id}:${stepKey}`;
  if (correct) {
    r.done = true;
    if (firstTry) points = award(p, rid, r.hinted ? REWARDS.correctAfterHint : REWARDS.correct, r.hinted ? 'Correct with a hint' : 'Correct answer', now);
    else { r.corrected = true; points = award(p, rid, REWARDS.correction, 'Fixed it after reteaching', now); }
    m.purposeful++;
  }
  let followUpAdded = false;
  if (!correct && firstTry) {
    // targeted re-practice later in this session with a different question
    const usedIds = new Set(m.steps.map((s) => s.itemId).filter(Boolean) as string[]);
    const alt = allItems(word).filter((it) => !usedIds.has(it.id) && it.stage !== 'transfer');
    const pick = alt.find((it) => it.format !== item.format) ?? alt[0];
    if (pick) {
      const at = Math.min(m.steps.length, m.steps.indexOf(step) + 4);
      const key = `f${m.steps.length}-${stepKey}`;
      m.steps.splice(at, 0, { key, kind: 'question', wordId: word.id, itemId: pick.id, followUp: true });
      m.results[key] = initResult(pick, rng);
      followUpAdded = true;
    }
  }
  let revealed = false;
  if (!correct && r.attempts >= MAX_ATTEMPTS) { r.done = true; revealed = true; m.purposeful++; }
  if (securedNow) points += award(p, `secure:${word.id}`, REWARDS.firstSecure, `“${word.word}” is Secure!`, now);
  const targeted = !correct && !Array.isArray(answer) ? item.wrong?.[answer] : undefined;
  return { correct, points, securedNow, revealed, explanation: item.explanation, targeted, followUpAdded };
}

/** Advance past a teach/reflect step or a finished question. */
export function advance(p: Profile, idx: ContentIndex, m: MissionState, now = Date.now()) {
  const step = m.steps[m.index];
  if (!step) return;
  if (step.kind === 'teach') {
    const prog = progressFor(p, step.wordId);
    markIntroduced(prog, now);
    m.results[step.key].done = true;
  }
  if (step.kind === 'reflect') m.results[step.key].done = true;
  if (step.kind === 'question' && !m.results[step.key].done) return; // must answer first
  m.index++;
  if (m.index >= m.steps.length) completeMission(p, m, now);
}

export function completeMission(p: Profile, m: MissionState, now = Date.now()): number {
  if (m.completed) return 0;
  m.completed = true;
  m.index = m.steps.length;
  const questions = m.steps.filter((s) => s.kind === 'question' && m.results[s.key].done).length;
  m.purposeful = questions;
  if (p.awarded[`missiondone:${m.id}`] === undefined) { p.awarded[`missiondone:${m.id}`] = now; p.completedMissions++; }
  if (questions >= REWARDS.missionMinResponses) return award(p, `mission:${m.id}`, REWARDS.missionComplete, 'Mission complete', now);
  return 0;
}

export function missionPointsEarned(p: Profile, m: MissionState): number {
  return p.ledger.filter((l) => l.delta > 0 && (l.id.includes(m.id) || (l.id.startsWith('secure:') && l.ts >= m.startedAt))).reduce((a, l) => a + l.delta, 0);
}

export function addReflection(p: Profile, wordId: string, text: string, now = Date.now()) {
  if (text.trim()) p.reflections.unshift({ ts: now, wordId, text: text.trim().slice(0, 500) });
}
