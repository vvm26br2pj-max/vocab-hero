import { useEffect, useMemo, useState } from 'react';
import type { Nav } from '../App';
import { mutate, useProfile } from '../store';
import { content, type RecallItem } from '../../core/content';
import { buildMission, submitAnswer, advance, useHint, addReflection, missionPointsEarned, type AnswerOutcome, MAX_ATTEMPTS, recallMatches } from '../../core/mission';
import { wordState } from '../../core/mastery';
import type { PracticeItem, WordEntry } from '../../content/schema';
import type { MissionStep } from '../../core/types';
import { Scene } from '../components/Scene';
import { Btn, Points, Bar, Speak } from '../components/common';
import { sfx } from '../sound';
import { REWARDS } from '../../config/economy';

const FORMAT_LABEL: Record<string, string> = {
  meaning: 'Meaning match', context_gap: 'Context gap', example_nonexample: 'Example or not?', synonym: 'Synonym / antonym',
  context_clues: 'Context clues', sentence_build: 'Build a sentence', best_word: 'Best word', word_parts: 'Word parts',
  dialogue: 'Dialogue repair', recall: 'Short recall', scene_choice: 'Scene choice',
};
const POS_SHORT: Record<string, string> = { noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb' };

export function Mission({ nav }: { nav: Nav }) {
  const p = useProfile()!;
  const idx = content(p.customWords);
  const [packComplete, setPackComplete] = useState(false);

  useEffect(() => {
    if (!p.mission) {
      const r = buildMission(p, idx);
      setPackComplete(r.packComplete);
      if (r.mission.steps.some((s) => s.kind === 'question')) mutate((pp) => { pp.mission = r.mission; });
    }
  }, [p.mission === null]);

  const m = p.mission;
  if (!m) {
    return (
      <div className="app mission">
        <div className="mission-card col">
          <h2>{packComplete ? 'Pack complete! 🎉' : 'Nothing to practice yet'}</h2>
          <p>{packComplete ? `You have met every word in the grade ${p.settings.grade} pack, and there are no reviews due right now.` : 'There are no words to practice at the moment.'}</p>
          <p>Options: turn on <b>mixed-grade mode</b> for neighboring grades, ask a parent to choose another grade pack or add a word list, or come back later when reviews are due.</p>
          <div className="row">
            {!p.settings.mixedGrades && <Btn kind="go" onClick={() => mutate((pp) => { pp.settings.mixedGrades = true; pp.mission = null; })}>Turn on mixed-grade words</Btn>}
            <Btn onClick={() => nav.go('words')}>Browse my Word Book</Btn>
            <Btn onClick={() => nav.go('hq')}>Back to HQ</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (m.completed) return <Summary nav={nav} />;
  const step = m.steps[m.index];
  const word = idx.byId.get(step.wordId);
  if (!word) { // content missing (e.g. a removed custom list): skip safely
    mutate((pp) => { const mm = pp.mission!; mm.results[step.key].done = true; mm.index++; if (mm.index >= mm.steps.length) mm.completed = true; });
    return null;
  }
  const questions = m.steps.filter((s) => s.kind === 'question');
  const qDone = questions.filter((s) => m.results[s.key].done).length;
  return (
    <div className="app mission">
      <div className="topbar">
        <Btn kind="ghost" size="small" onClick={() => nav.go('hq')} aria-label="Save and exit">💾 Save & exit</Btn>
        <span className="spacer" />
        <Points value={p.points} />
      </div>
      <div className="col" style={{ marginBottom: 10 }}>
        <Bar value={m.index} max={m.steps.length} />
        <span className="small white">Step {m.index + 1} of {m.steps.length} · {qDone}/{questions.length} practice answers · new words: {m.newWords.map((id) => idx.byId.get(id)?.word).join(', ') || 'review only'}</span>
      </div>
      {step.kind === 'teach' && <TeachCard key={step.key} word={word} card={step.card!} readAloud={p.settings.readAloud} onNext={() => mutate((pp) => advance(pp, idx, pp.mission!))} />}
      {step.kind === 'question' && <Question key={step.key} step={step} />}
      {step.kind === 'reflect' && <Reflect key={step.key} word={word} onDone={(text) => mutate((pp) => { addReflection(pp, word.id, text); advance(pp, idx, pp.mission!); })} />}
    </div>
  );
}

function TeachCard({ word, card, readAloud, onNext }: { word: WordEntry; card: string; readAloud: boolean; onNext: () => void }) {
  return (
    <div className="mission-card col">
      <span className="tag new">New word · {card === 'word' ? 'Meet the word' : card === 'hero' ? 'Hero scene' : card === 'everyday' ? 'Everyday example' : 'Example vs. non-example'}</span>
      {card === 'word' && (
        <>
          <div className="row"><span className="word-big">{word.word}</span><Speak text={word.word} label={`Say ${word.word}`} /></div>
          <div className="muted">say it: <b>{word.say}</b> · <i>{POS_SHORT[word.pos]}</i></div>
          <div className="passage row" style={{ justifyContent: 'space-between' }}><span><b>Meaning:</b> {word.definition}</span><Speak enabled={readAloud} text={`${word.word}. ${word.definition}`} /></div>
          {word.parts?.length ? <div className="small"><b>Word parts:</b> {word.parts.map((x) => `${x.part} = ${x.meaning}`).join(' · ')}</div> : null}
        </>
      )}
      {card === 'hero' && (
        <>
          <Scene scene={word.hero.scene} />
          <div className="passage row" style={{ justifyContent: 'space-between' }}><span>{highlightWord(word.hero.text, word.word)}</span><Speak enabled={readAloud} text={word.hero.text} /></div>
        </>
      )}
      {card === 'everyday' && (
        <>
          <p className="muted">Heroes are not the only ones who use this word. In everyday life:</p>
          <div className="passage row" style={{ justifyContent: 'space-between', fontSize: '1.2rem' }}><span>{highlightWord(word.everyday, word.word)}</span><Speak enabled={readAloud} text={word.everyday} /></div>
          <p className="small"><b>{word.word}</b> = {word.definition}</p>
        </>
      )}
      {card === 'contrast' && (
        <>
          <div className="grid two">
            <div><Scene scene={word.hero.scene} size={220} animate={false} caption={`✅ ${word.word}`} /></div>
            <div><Scene scene={word.contrast.scene} size={220} animate={false} caption={`❌ not ${word.word}`} /></div>
          </div>
          <div className="passage"><b>Not an example:</b> {word.contrast.nonExample}</div>
          <div className="row" style={{ justifyContent: 'space-between' }}><p><b>Why?</b> {word.contrast.explanation}</p><Speak enabled={readAloud} text={`${word.contrast.nonExample} ${word.contrast.explanation}`} /></div>
        </>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}><Btn kind="go" size="big" onClick={onNext} autoFocus>Next ➜</Btn></div>
    </div>
  );
}

function highlightWord(text: string, word: string) {
  const stem = word.slice(0, Math.max(3, word.length - 2));
  const re = new RegExp(`(\\b${stem}[a-z]*)`, 'i');
  const parts = text.split(re);
  return parts.map((s, i) => (re.test(s) && i % 2 === 1 ? <mark key={i}>{s}</mark> : <span key={i}>{s}</span>));
}

function renderPassage(text: string, clue?: string, showClue = false) {
  const clues = showClue && clue ? clue.split(';').map((c) => c.trim()).filter(Boolean) : [];
  let nodes: (string | JSX.Element)[] = [text];
  for (const c of clues) {
    nodes = nodes.flatMap((n) => {
      if (typeof n !== 'string') return [n];
      const i = n.toLowerCase().indexOf(c.toLowerCase());
      if (i < 0) return [n];
      return [n.slice(0, i), <mark key={c + i}>{n.slice(i, i + c.length)}</mark>, n.slice(i + c.length)];
    });
  }
  return nodes.map((n, i) => (typeof n === 'string' ? n.split('___').flatMap((s, j, arr) => (j < arr.length - 1 ? [<span key={`${i}-${j}`}>{s}</span>, <span key={`b${i}-${j}`} style={{ borderBottom: '3px solid #1b1446', display: 'inline-block', minWidth: 70 }}>&nbsp;</span>] : [<span key={`${i}-${j}`}>{s}</span>])) : n));
}

function Question({ step }: { step: MissionStep }) {
  const p = useProfile()!;
  const idx = content(p.customWords);
  const m = p.mission!;
  const r = m.results[step.key];
  const { item, word } = idx.items.get(step.itemId!)!;
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [built, setBuilt] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const ra = p.settings.readAloud;
  const done = r.done;
  const canAnswer = !done;

  const submit = (ans: string | string[]) => {
    if (!canAnswer) return;
    let o: AnswerOutcome | null = null;
    mutate((pp) => { o = submitAnswer(pp, idx, pp.mission!, step.key, ans); });
    const out = o as AnswerOutcome | null;
    if (!out) return;
    setOutcome(out);
    if (!Array.isArray(ans)) setChosen((c) => [...c, ans]);
    if (out.correct) { sfx.correct(); if (out.points) setTimeout(() => sfx.coin(), 200); } else sfx.wrong();
  };
  const next = () => mutate((pp) => advance(pp, idx, pp.mission!));
  const order = r.order ?? item.options?.map((o) => o.id) ?? [];
  const optText = (id: string) => item.options?.find((o) => o.id === id)?.text ?? '';
  const correctText = Array.isArray(item.answer) ? item.answer.map((id) => item.chunks?.find((c) => c.id === id)?.text).join(' ') : item.format === 'recall' ? String(item.answer) : optText(item.answer);
  const tryAgain = outcome && !outcome.correct && !done;
  const recallInfo = item.format === 'recall' && outcome?.correct ? recallMatches(typed, (item as RecallItem).accepted) : null;

  return (
    <div className="mission-card col">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="tag">{FORMAT_LABEL[item.format]}{item.stage === 'supported' ? ' · guided' : item.stage === 'transfer' ? ' · new context' : ''}{step.followUp ? ' · another look' : ''}</span>
        <span className="small muted">word: <b>{word.word}</b></span>
      </div>
      {item.passage && <div className="passage row" style={{ justifyContent: 'space-between' }}><span>{renderPassage(item.passage, item.clue, !!outcome && (outcome.correct || done))}</span><Speak enabled={ra} text={item.passage.replace(/___/g, 'blank')} /></div>}
      <div className="row" style={{ justifyContent: 'space-between' }}><h3 style={{ fontFamily: 'Nunito', fontWeight: 900, fontSize: '1.15rem' }}>{item.prompt}</h3><Speak enabled={ra} text={item.prompt} /></div>

      {item.format === 'scene_choice' && (
        <div className="scene-pick">
          {order.map((id) => {
            const scene = id === 'hero' ? word.hero.scene : word.contrast.scene;
            const cls = chosen.includes(id) ? (id === item.answer ? 'chosen-right' : 'chosen-wrong') : '';
            return <button key={id} className={`opt ${cls}`} disabled={!canAnswer || chosen.includes(id)} onClick={() => submit(id)} aria-label={`Scene ${order.indexOf(id) + 1}`}><Scene scene={scene} size={220} animate={false} caption={outcome ? optText(id) : `Scene ${order.indexOf(id) + 1}`} /></button>;
          })}
        </div>
      )}
      {item.options && item.format !== 'scene_choice' && (
        <div className="opts" role="group" aria-label="Answer choices">
          {order.map((id, i) => {
            const cls = chosen.includes(id) ? (id === item.answer ? 'chosen-right' : 'chosen-wrong') : done && id === item.answer ? 'chosen-right' : '';
            return (
              <button key={id} className={`opt ${cls}`} disabled={!canAnswer || chosen.includes(id)} onClick={() => submit(id)}>
                <span className="letter">{item.format === 'example_nonexample' ? (id === 'yes' ? '✓' : '✗') : 'ABCD'[i]}</span>{optText(id)}
                {ra && <span style={{ float: 'right' }} onClick={(e) => e.stopPropagation()}><Speak text={optText(id)} /></span>}
              </button>
            );
          })}
        </div>
      )}
      {item.format === 'sentence_build' && item.chunks && (
        <>
          <div className="build-line" aria-label="Your sentence">
            {built.length === 0 && <span className="muted small">Tap the pieces in order. Leave out any piece that does not fit the meaning.</span>}
            {built.map((id) => <button key={id} className="chip placed" disabled={!canAnswer} onClick={() => setBuilt(built.filter((b) => b !== id))}>{item.chunks!.find((c) => c.id === id)!.text}</button>)}
          </div>
          <div className="chips">
            {(r.order ?? item.chunks.map((c) => c.id)).filter((id) => !built.includes(id)).map((id) => <button key={id} className="chip" disabled={!canAnswer} onClick={() => setBuilt([...built, id])}>{item.chunks!.find((c) => c.id === id)!.text}</button>)}
          </div>
          <div className="row"><Btn kind="primary" disabled={!canAnswer || built.length < 2 || !!tryAgain} onClick={() => submit(built)}>Check my sentence</Btn>{built.length > 0 && canAnswer && <Btn size="small" onClick={() => setBuilt([])}>Clear</Btn>}</div>
        </>
      )}
      {item.format === 'recall' && (
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) submit(typed); }}>
          <input className="textin" style={{ flex: 1, minWidth: 180 }} value={typed} disabled={!canAnswer} onChange={(e) => setTyped(e.target.value)} placeholder="Type the word" autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Your answer" />
          <Btn kind="primary" type="submit" disabled={!canAnswer || !typed.trim() || !!tryAgain}>Check</Btn>
        </form>
      )}

      {!outcome && !done && (
        <div>
          {r.hinted ? <div className="hintbox">💡 {item.hint}<Speak enabled={ra} text={item.hint} /></div>
            : <Btn size="small" onClick={() => mutate((pp) => useHint(pp.mission!, step.key))}>💡 Hint (correct answers after a hint still earn {REWARDS.correctAfterHint})</Btn>}
        </div>
      )}

      {outcome && (
        <div className={`feedback ${outcome.correct ? 'good' : outcome.revealed ? 'reveal' : 'try'}`} role="status">
          {outcome.correct && <div className="row"><strong style={{ fontSize: '1.2rem' }}>{r.corrected ? '💪 You fixed it — great persistence!' : step.followUp ? '🌟 You remembered it in a new way!' : '✅ Correct!'}</strong>{outcome.points > 0 && <span className="points">+{outcome.points}</span>}</div>}
          {outcome.securedNow && <div className="confetti">🏅 “{word.word}” is now Secure!</div>}
          {recallInfo && !recallInfo.exact && <p className="small">Spelled: <b>{recallInfo.matched}</b> — meaning counts here, so small spelling slips are fine.</p>}
          {!outcome.correct && !outcome.revealed && (
            <>
              <strong>Not quite — good try. Let’s look again.</strong>
              {outcome.targeted && <p>{outcome.targeted}</p>}
              <p><b>{word.word}</b> means <i>{word.definition}</i>. Example: {word.everyday}</p>
              {!r.hinted && <p className="small">💡 Hint: {item.hint}</p>}
              <p className="small muted">Try again ({MAX_ATTEMPTS - r.attempts} more {MAX_ATTEMPTS - r.attempts === 1 ? 'try' : 'tries'}). We will also come back to this word later with a different question.</p>
            </>
          )}
          {outcome.revealed && <><strong>Let’s see it together.</strong><p>The best answer is: <b>{correctText}</b></p></>}
          {(outcome.correct || outcome.revealed) && <p>{outcome.explanation}</p>}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Speak enabled={ra} text={outcome.correct || outcome.revealed ? outcome.explanation : `${outcome.targeted ?? ''} ${word.word} means ${word.definition}.`} />
            {done ? <Btn kind="go" size="big" onClick={next} autoFocus>Next ➜</Btn> : tryAgain && item.format === 'sentence_build' ? <Btn onClick={() => { setBuilt([]); setOutcome(null); }}>Try again</Btn> : tryAgain && item.format === 'recall' ? <Btn onClick={() => { setTyped(''); setOutcome(null); }}>Try again</Btn> : null}
          </div>
        </div>
      )}
      {done && !outcome && <div className="row" style={{ justifyContent: 'flex-end' }}><p className="small muted" style={{ flex: 1 }}>{item.explanation}</p><Btn kind="go" onClick={next}>Next ➜</Btn></div>}
    </div>
  );
}

function Reflect({ word, onDone }: { word: WordEntry; onDone: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <div className="mission-card col">
      <span className="tag">Optional · your own words</span>
      <h3>Use “{word.word}” to describe something from your own life.</h3>
      <p className="small muted">This is saved as a reflection for a grown-up to read. It is not graded, and it does not change your points.</p>
      <textarea className="textin" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Example: ${word.everyday}`} />
      <div className="row"><Btn kind="go" onClick={() => onDone(text)} disabled={!text.trim()}>Save reflection</Btn><Btn onClick={() => onDone('')}>Skip</Btn></div>
    </div>
  );
}

function Summary({ nav }: { nav: Nav }) {
  const p = useProfile()!;
  const idx = content(p.customWords);
  const m = p.mission!;
  const earned = useMemo(() => missionPointsEarned(p, m), [m.id]);
  useEffect(() => { sfx.win(); }, []);
  const qs = m.steps.filter((s) => s.kind === 'question');
  const firstTry = qs.filter((s) => m.results[s.key].correct).length;
  const fixed = qs.filter((s) => m.results[s.key].corrected).length;
  const finish = (to: 'hq' | 'workshop' | 'mission') => { mutate((pp) => { pp.mission = null; }); nav.go(to === 'mission' ? 'hq' : to); if (to === 'mission') setTimeout(() => nav.go('mission'), 0); };
  return (
    <div className="app mission">
      <div className="mission-card col center" style={{ alignItems: 'center' }}>
        <h1>Mission complete!</h1>
        <div className="points" style={{ fontSize: '1.4rem' }}>+{earned} coins</div>
        <p>{firstTry} answered right the first time{fixed ? `, and ${fixed} fixed after a second look — that's how heroes learn` : ''}.</p>
        <div className="col" style={{ width: '100%' }}>
          {[...m.newWords, ...m.reviewWords].map((id) => {
            const w = idx.byId.get(id); if (!w) return null;
            const st = wordState(p.words[id]);
            return <div key={id} className="word-row"><b>{w.word}</b><span className="muted small" style={{ flex: 1 }}>{w.definition}</span><span className={`tag ${st}`}>{st}</span></div>;
          })}
        </div>
        <p className="small muted">Words become Secure after you get them right on your own on several different days, in different kinds of questions.</p>
        <div className="row center">
          <Btn kind="primary" size="big" onClick={() => finish('workshop')}>🛠️ Spend points</Btn>
          <Btn kind="go" onClick={() => finish('mission')}>Another mission</Btn>
          <Btn onClick={() => finish('hq')}>Back to HQ</Btn>
        </div>
      </div>
    </div>
  );
}
