import { packFor } from '../../core/content';
import { GRADES } from '../../core/content';

export const GRADE_NOTE = 'Grade labels describe approximate content difficulty, not an externally validated reading assessment. Word packs are original and pending editorial review.';

export function GradeSelect({ value, onChange }: { value: number; onChange: (g: number) => void }) {
  return (
    <label className="field">Vocabulary grade
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {GRADES.map((g) => {
          const p = packFor(g);
          return <option key={g} value={g}>Grade {g}{g === 4 ? ' (default)' : ''} — {p?.emphasis ?? ''}</option>;
        })}
      </select>
      <span className="small muted">Examples: {packFor(value)?.words.slice(0, 5).map((w) => w.word).join(', ')}</span>
    </label>
  );
}
