import { MASTERY, REVIEW_INTERVALS_DAYS } from '../config/economy';
import { addDays, localDate } from './dates';
import type { Evidence, WordProgress, WordState } from './types';

export function newProgress(id: string): WordProgress {
  return { id, introducedAt: null, introducedDate: null, evidence: [], reviewStep: 0, nextReview: null, lastReviewAdvance: null, securedAt: null, mistakes: 0, confusions: {} };
}

/** Evidence that counts toward independent mastery: correct, no hint, not a supported/teaching item, not a correction retry. */
export function isIndependent(e: Evidence): boolean {
  return e.correct && !e.hinted && !e.correction && (e.stage === 'independent' || e.stage === 'transfer');
}

export interface MasterySummary {
  independentCorrect: number; dates: number; formats: number; items: number; fresh: number;
  meets: boolean; supportedCorrect: number; hinted: number;
}
export function summarize(p: WordProgress): MasterySummary {
  const ind = p.evidence.filter(isIndependent);
  // Count at most once per (item, date): repeating one question on one day is not new evidence.
  const unique = new Map<string, Evidence>();
  for (const e of ind) unique.set(`${e.itemId}|${e.date}`, e);
  const list = [...unique.values()];
  const dates = new Set(list.map((e) => e.date)).size;
  const formats = new Set(list.map((e) => e.format)).size;
  const items = new Set(list.map((e) => e.itemId)).size;
  const fresh = list.filter((e) => e.stage === 'transfer').length;
  const meets = list.length >= MASTERY.independentCorrect && dates >= MASTERY.distinctDates && formats >= MASTERY.distinctFormats
    && items >= MASTERY.distinctItems && fresh >= MASTERY.freshContexts;
  return {
    independentCorrect: list.length, dates, formats, items, fresh, meets,
    supportedCorrect: p.evidence.filter((e) => e.correct && !isIndependent(e)).length,
    hinted: p.evidence.filter((e) => e.hinted).length,
  };
}

export function wordState(p: WordProgress | undefined): WordState {
  if (!p || p.introducedAt === null) return 'new';
  if (p.securedAt !== null) return 'secure';
  const s = summarize(p);
  if (s.independentCorrect >= MASTERY.practicingAt) return 'practicing';
  return 'learning';
}

export function isDue(p: WordProgress | undefined, today = localDate()): boolean {
  return !!p && p.introducedAt !== null && p.nextReview !== null && p.nextReview <= today;
}

export function markIntroduced(p: WordProgress, now = Date.now()) {
  if (p.introducedAt !== null) return;
  p.introducedAt = now;
  p.introducedDate = localDate(now);
  p.reviewStep = 0;
  p.nextReview = addDays(p.introducedDate, REVIEW_INTERVALS_DAYS[0]);
}

/**
 * Record a response. Returns true if this response made the word Secure for the first time.
 * - correct independent answers on/after the due date advance the review schedule (once per day)
 * - errors bring the next review forward to tomorrow and step the schedule back, without erasing history
 */
export function recordEvidence(p: WordProgress, e: Evidence, wrongText?: string): boolean {
  p.evidence.push(e);
  if (p.evidence.length > 200) p.evidence.splice(0, p.evidence.length - 200);
  if (!e.correct) {
    p.mistakes++;
    if (wrongText) p.confusions[wrongText] = (p.confusions[wrongText] || 0) + 1;
    if (!e.correction) {
      p.reviewStep = Math.max(0, p.reviewStep - 1);
      p.nextReview = addDays(e.date, 1);
    }
    return false;
  }
  if (isIndependent(e) && p.nextReview !== null && e.date >= p.nextReview && p.lastReviewAdvance !== e.date) {
    p.lastReviewAdvance = e.date;
    p.reviewStep = Math.min(p.reviewStep + 1, REVIEW_INTERVALS_DAYS.length - 1);
    p.nextReview = addDays(e.date, REVIEW_INTERVALS_DAYS[p.reviewStep]);
  }
  if (p.securedAt === null && summarize(p).meets) {
    p.securedAt = e.ts;
    return true;
  }
  return false;
}

export const STATE_LABEL: Record<WordState, string> = { new: 'New', learning: 'Learning', practicing: 'Practicing', secure: 'Secure' };
