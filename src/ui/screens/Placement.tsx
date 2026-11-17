import { useState } from 'react';
import type { Nav } from '../App';
import { mutate, useProfile } from '../store';
import { content } from '../../core/content';
import { buildPlacement, suggestFromPlacement } from '../../core/placement';
import { localDate } from '../../core/dates';
import { Btn, Speak } from '../components/common';

export function Placement({ nav }: { nav: Nav }) {
  const p = useProfile()!;
  const [qs] = useState(() => buildPlacement(content()));
  const [i, setI] = useState(0);
  const [score, setScore] = useState<Record<number, number>>({});
  const [done, setDone] = useState(false);
  if (done || i >= qs.length) {
    const sug = suggestFromPlacement(score);
    return (
      <div className="app mission"><div className="mission-card col">
        <h2>Sampler finished</h2>
        <p><b>For the grown-up:</b> this short sampler suggests starting around <b>grade {sug}</b> words. It is only a starting point from {Object.values(score).reduce((a, b) => a + b, 0)} quick answers, not a reading assessment. The current setting is grade {p.settings.grade}, and nothing changes unless you choose it.</p>
        <div className="row">
          {sug !== p.settings.grade && <Btn kind="go" onClick={() => { mutate((pp) => { pp.settings.grade = sug; pp.placement = { suggestedGrade: sug, date: localDate(), correctByGrade: score }; }); nav.go('hq'); }}>Use grade {sug}</Btn>}
          <Btn onClick={() => { mutate((pp) => { pp.placement = { suggestedGrade: sug, date: localDate(), correctByGrade: score }; }); nav.go('hq'); }}>Keep grade {p.settings.grade}</Btn>
        </div>
      </div></div>
    );
  }
  const q = qs[i];
  const answer = (id: string) => {
    if (id === q.item.answer) setScore({ ...score, [q.grade]: (score[q.grade] ?? 0) + 1 });
    setI(i + 1);
  };
  return (
    <div className="app mission">
      <div className="topbar"><span className="brand">Placement sampler</span><span className="spacer" /><Btn kind="ghost" size="small" onClick={() => setDone(true)}>Skip the rest</Btn></div>
      <div className="mission-card col">
        <p className="small muted">Question {i + 1} of {qs.length}. Some of these words are meant to be unfamiliar — just pick your best guess, or choose "I don't know yet". No points are won or lost.</p>
        <h3>{q.word.word} <Speak enabled={p.settings.readAloud} text={q.word.word} /></h3>
        {q.item.passage && <div className="passage">{q.item.passage}</div>}
        <p><b>{q.item.prompt}</b></p>
        <div className="opts">
          {q.order.map((id) => <button key={id} className="opt" onClick={() => answer(id)}>{q.item.options!.find((o) => o.id === id)!.text}</button>)}
          <button className="opt" onClick={() => setI(i + 1)}>🤷 I don't know yet</button>
        </div>
      </div>
    </div>
  );
}
