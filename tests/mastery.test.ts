import { newProgress, recordEvidence, summarize, wordState, markIntroduced, isDue } from '../src/core/mastery';
import type { Evidence } from '../src/core/types';
import { DAY } from './helpers';

const T0 = new Date(2026, 0, 5, 10).getTime();
const ev = (o: Partial<Evidence>): Evidence => ({ itemId: 'w#2', format: 'context_gap', stage: 'independent', date: '2026-01-05', ts: T0, correct: true, hinted: false, correction: false, missionId: 'm', ...o });

describe('mastery', () => {
  it('one correct multiple-choice answer never makes a word Secure', () => {
    const p = newProgress('w'); markIntroduced(p, T0);
    recordEvidence(p, ev({}));
    expect(wordState(p)).toBe('learning');
  });
  it('repeating one question many times on one day cannot satisfy mastery', () => {
    const p = newProgress('w'); markIntroduced(p, T0);
    for (let i = 0; i < 20; i++) recordEvidence(p, ev({ ts: T0 + i }));
    expect(summarize(p).independentCorrect).toBe(1);
    expect(wordState(p)).not.toBe('secure');
  });
  it('supported and hinted answers count as practice, not mastery evidence', () => {
    const p = newProgress('w'); markIntroduced(p, T0);
    const dates = ['2026-01-05', '2026-01-06', '2026-01-08', '2026-01-10'];
    dates.forEach((d, i) => recordEvidence(p, ev({ date: d, stage: 'supported', itemId: `w#${i}` })));
    dates.forEach((d, i) => recordEvidence(p, ev({ date: d, hinted: true, itemId: `w#h${i}` })));
    expect(summarize(p).independentCorrect).toBe(0);
    expect(wordState(p)).toBe('learning');
  });
  it('needs 4 independent corrects, 3 dates, 2 formats, and a fresh context', () => {
    const p = newProgress('w'); markIntroduced(p, T0);
    recordEvidence(p, ev({ date: '2026-01-05', itemId: 'w#2' }));
    recordEvidence(p, ev({ date: '2026-01-06', itemId: 'w#3', format: 'synonym' }));
    expect(wordState(p)).toBe('practicing');
    recordEvidence(p, ev({ date: '2026-01-06', itemId: 'w#4', format: 'synonym' }));
    expect(recordEvidence(p, ev({ date: '2026-01-06', itemId: 'w#2' }))).toBe(false); // only 2 dates, no fresh
    const secured = recordEvidence(p, ev({ date: '2026-01-09', itemId: 'w#5', stage: 'transfer', format: 'context_clues', ts: T0 + 4 * DAY }));
    expect(secured).toBe(true);
    expect(wordState(p)).toBe('secure');
  });
  it('a later mistake schedules review without erasing the achievement', () => {
    const p = newProgress('w'); markIntroduced(p, T0);
    p.securedAt = T0; p.reviewStep = 3;
    recordEvidence(p, ev({ date: '2026-02-01', correct: false }));
    expect(wordState(p)).toBe('secure');
    expect(p.nextReview).toBe('2026-02-02');
    expect(p.reviewStep).toBe(2);
    expect(p.evidence.length).toBe(1);
  });
  it('review schedule advances 1,3,7,14,30 days, once per day', () => {
    const p = newProgress('w'); markIntroduced(p, T0);
    expect(p.nextReview).toBe('2026-01-06');
    expect(isDue(p, '2026-01-05')).toBe(false);
    expect(isDue(p, '2026-01-06')).toBe(true);
    recordEvidence(p, ev({ date: '2026-01-06' }));
    expect(p.nextReview).toBe('2026-01-09');
    recordEvidence(p, ev({ date: '2026-01-06', itemId: 'w#3' }));
    expect(p.nextReview).toBe('2026-01-09');
    recordEvidence(p, ev({ date: '2026-01-20', itemId: 'w#3' })); // missed days: no punishment
    expect(p.nextReview).toBe('2026-01-27');
  });
});
