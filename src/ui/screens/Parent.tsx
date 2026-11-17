import { useMemo, useRef, useState } from 'react';
import type { Nav } from '../App';
import { deleteProfile, getSave, mutate, replaceSave, toast, useProfile } from '../store';
import { Btn, Modal } from '../components/common';
import { GRADE_NOTE, GradeSelect } from '../components/GradeSelect';
import { DIFFICULTY, type CombatDifficulty } from '../../config/combat';
import { content } from '../../core/content';
import { STATE_LABEL, summarize, wordState } from '../../core/mastery';
import { suggestGradeChange } from '../../core/placement';
import { buildCustomEntry, parseWordList, type ImportRow } from '../../core/customWords';
import { exportSave, importSave, restorePrevious } from '../../core/save';
import { VoicePicker } from '../components/VoicePicker';
import { localDate } from '../../core/dates';

const SECTIONS = ['Settings', 'Progress', 'Word lists', 'Saves'] as const;

export function Parent({ nav }: { nav: Nav }) {
  const [unlocked, setUnlocked] = useState(false);
  const [gate] = useState(() => { const a = 6 + Math.floor(Math.random() * 7), b = 3 + Math.floor(Math.random() * 7); return { a, b }; });
  const [ans, setAns] = useState('');
  const [sec, setSec] = useState<(typeof SECTIONS)[number]>('Settings');
  if (!unlocked) {
    return (
      <div className="app"><div className="card col" style={{ maxWidth: 460, margin: '40px auto' }}>
        <h2>Grown-ups only</h2>
        <p className="small muted">This simple check helps prevent accidental changes. It is not a password or strong security.</p>
        <form className="col" onSubmit={(e) => { e.preventDefault(); if (Number(ans) === gate.a * gate.b) setUnlocked(true); else setAns(''); }}>
          <label className="field">What is {gate.a} × {gate.b}?<input inputMode="numeric" value={ans} onChange={(e) => setAns(e.target.value)} autoFocus /></label>
          <div className="row"><Btn kind="go" type="submit">Enter</Btn><Btn type="button" onClick={() => nav.go('hq')}>Back</Btn></div>
        </form>
      </div></div>
    );
  }
  return (
    <div className="app">
      <div className="topbar"><Btn kind="ghost" size="small" onClick={() => nav.go('hq')}>← HQ</Btn><span className="brand">Parent area</span></div>
      <div className="tabs">{SECTIONS.map((s) => <button key={s} className={`tab ${sec === s ? 'on' : ''}`} onClick={() => setSec(s)}>{s}</button>)}</div>
      {sec === 'Settings' && <SettingsSec nav={nav} />}
      {sec === 'Progress' && <ProgressSec />}
      {sec === 'Word lists' && <WordListSec />}
      {sec === 'Saves' && <SavesSec nav={nav} />}
    </div>
  );
}

function SettingsSec({ nav }: { nav: Nav }) {
  const p = useProfile()!;
  const idx = content(p.customWords);
  const s = p.settings;
  const sug = suggestGradeChange(p, idx);
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => mutate((pp) => { pp.settings[k] = v; });
  return (
    <div className="grid two">
      <div className="card col">
        <h3>Vocabulary</h3>
        <GradeSelect value={s.grade} onChange={(g) => { set('grade', g); toast(`Grade set to ${g}. All words, coins, items and battle progress are kept.`); }} />
        <p className="small muted">{GRADE_NOTE} Changing grade takes new words from the new pack; reviews of earlier words continue unless paused below.</p>
        {sug && <div className="feedback try small"><b>Suggestion:</b> {sug.reason} <div className="row" style={{ marginTop: 6 }}><Btn size="small" kind="go" onClick={() => set('grade', sug.grade)}>Switch to grade {sug.grade}</Btn><span className="muted">Nothing changes unless you choose it.</span></div></div>}
        <label className="field">New words per mission
          <select value={String(s.newWordPace)} onChange={(e) => set('newWordPace', e.target.value === 'auto' ? 'auto' : (Number(e.target.value) as 1 | 2 | 3))}>
            <option value="auto">Automatic (2–3, adjusts to how it is going)</option><option value="1">1</option><option value="2">2</option><option value="3">3</option>
          </select>
        </label>
        <label className="switch"><input type="checkbox" checked={s.pauseOlderReviews} onChange={(e) => set('pauseOlderReviews', e.target.checked)} /> Pause reviews of words from other grades</label>
        <label className="switch"><input type="checkbox" checked={s.mixedGrades} onChange={(e) => set('mixedGrades', e.target.checked)} /> Mixed-grade mode (new words from neighboring grades too)</label>
        <label className="switch"><input type="checkbox" checked={s.useCustomWords} onChange={(e) => set('useCustomWords', e.target.checked)} disabled={!p.customWords.length} /> Include my word list ({p.customWords.length} words)</label>
        <Btn size="small" onClick={() => nav.go('placement')}>Run the optional placement sampler</Btn>
      </div>
      <div className="card col">
        <h3>Reading support</h3>
        <label className="switch"><input type="checkbox" checked={s.readAloud} onChange={(e) => set('readAloud', e.target.checked)} /> Read-aloud buttons (words, definitions, instructions, examples)</label>
        <label className="switch"><input type="checkbox" checked={s.largeText} onChange={(e) => set('largeText', e.target.checked)} /> Larger text</label>
        <label className="switch"><input type="checkbox" checked={s.reducedMotion} onChange={(e) => set('reducedMotion', e.target.checked)} /> Reduced motion</label>
        <VoicePicker />
        <p className="small muted">Support settings never reduce coins.</p>
        <h3>Combat</h3>
        {(Object.keys(DIFFICULTY) as CombatDifficulty[]).map((d) => <label key={d} className="switch"><input type="radio" checked={s.combatDifficulty === d} onChange={() => set('combatDifficulty', d)} /> <span><b>{DIFFICULTY[d].label}</b> <span className="small">— {DIFFICULTY[d].desc}</span></span></label>)}
        <p className="small muted">Independent of vocabulary grade. Learning rewards and main unlocks are the same in every mode.</p>
        <label className="switch"><input type="checkbox" checked={s.learningOnly} onChange={(e) => set('learningOnly', e.target.checked)} /> Learning-only mode (hide arena battles)</label>
        <label className="switch"><input type="checkbox" checked={s.onlinePlay} onChange={(e) => set('onlinePlay', e.target.checked)} /> <span><b>Online play</b> with a code (2-Player → Online). Uses the free PeerJS matchmaking service, then connects the two devices directly; only hero nickname, look and abilities are shared, no chat.</span></label>
        <label className="field">Daily arena battle limit
          <select value={s.dailyArenaLimit ?? ''} onChange={(e) => set('dailyArenaLimit', e.target.value ? Number(e.target.value) : null)}>
            <option value="">No limit</option>{[1, 2, 3, 5, 8].map((n) => <option key={n} value={n}>{n} per day</option>)}
          </select>
        </label>
        <h3>Sound</h3>
        <label className="field">Effects volume <input type="range" min={0} max={1} step={0.1} value={s.sfxVolume} onChange={(e) => set('sfxVolume', Number(e.target.value))} /></label>
        <label className="field">Music volume <input type="range" min={0} max={1} step={0.1} value={s.musicVolume} onChange={(e) => set('musicVolume', Number(e.target.value))} /></label>
      </div>
    </div>
  );
}

function ProgressSec() {
  const p = useProfile()!;
  const idx = content(p.customWords);
  const [open, setOpen] = useState<string | null>(null);
  const rows = Object.values(p.words).filter((w) => w.introducedAt !== null).map((w) => ({ w, e: idx.byId.get(w.id), s: summarize(w), st: wordState(w) })).filter((r) => r.e);
  const remembered = rows.filter((r) => r.s.fresh > 0).length;
  const confusions = useMemo(() => {
    const out: { word: string; wrong: string; n: number }[] = [];
    for (const r of rows) for (const [wrong, n] of Object.entries(r.w.confusions)) out.push({ word: r.e!.word, wrong, n });
    return out.sort((a, b) => b.n - a.n).slice(0, 12);
  }, [rows.length]);
  const sel = open ? p.words[open] : null;
  const recent = p.responses.slice(-50);
  return (
    <div className="col">
      <div className="grid three">
        <div className="card"><h3>{rows.length}</h3><p className="small">words introduced (taught)</p></div>
        <div className="card"><h3>{remembered}</h3><p className="small">words answered independently in a fresh context</p></div>
        <div className="card"><h3>{rows.filter((r) => r.st === 'secure').length}</h3><p className="small">Secure words (4+ independent answers, 3+ days, 2+ formats, a fresh context)</p></div>
        <div className="card"><h3>{p.completedMissions}</h3><p className="small">missions completed</p></div>
        <div className="card"><h3>{recent.length ? Math.round((recent.filter((r) => r.correct && !r.hinted).length / recent.length) * 100) : 0}%</h3><p className="small">first-try, no-hint accuracy (last {recent.length})</p></div>
        <div className="card"><h3>{recent.filter((r) => r.hinted).length}</h3><p className="small">of the last {recent.length} questions used a hint</p></div>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <h3>Word progress</h3>
        <table className="data">
          <thead><tr><th>Word</th><th>Status</th><th>Taught</th><th>Indep. correct</th><th>Days</th><th>Formats</th><th>Hints</th><th>Next review</th><th></th></tr></thead>
          <tbody>{rows.sort((a, b) => (a.w.introducedAt! - b.w.introducedAt!)).map((r) => (
            <tr key={r.w.id}><td><b>{r.e!.word}</b></td><td>{STATE_LABEL[r.st]}</td><td>{r.w.introducedDate}</td><td>{r.s.independentCorrect}</td><td>{r.s.dates}</td><td>{r.s.formats}</td><td>{r.s.hinted}</td><td>{r.w.nextReview}{r.w.nextReview && r.w.nextReview <= localDate() ? ' (due)' : ''}</td><td><Btn size="small" onClick={() => setOpen(r.w.id)}>Evidence</Btn></td></tr>
          ))}</tbody>
        </table>
        {!rows.length && <p className="muted">No words yet.</p>}
      </div>
      <div className="grid two">
        <div className="card"><h3>Common confusions</h3>{confusions.length ? <ul>{confusions.map((c, i) => <li key={i}><b>{c.word}</b>: chose “{c.wrong.slice(0, 70)}” ×{c.n}</li>)}</ul> : <p className="muted small">None recorded.</p>}</div>
        <div className="card"><h3>Reflections (not graded)</h3>{p.reflections.length ? p.reflections.slice(0, 20).map((r) => <p key={r.ts} className="small"><b>{idx.byId.get(r.wordId)?.word}:</b> {r.text} <span className="muted">({localDate(r.ts)})</span></p>) : <p className="muted small">No reflections yet.</p>}</div>
      </div>
      {sel && (
        <Modal title={`Evidence: ${idx.byId.get(sel.id)?.word}`} onClose={() => setOpen(null)}>
          <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
            <table className="data"><thead><tr><th>Date</th><th>Format</th><th>Type</th><th>Result</th></tr></thead>
              <tbody>{sel.evidence.map((e, i) => <tr key={i}><td>{e.date}</td><td>{e.format}</td><td>{e.correction ? 'retry after reteach' : e.stage}</td><td>{e.correct ? '✓' : '✗'}{e.hinted ? ' (hint)' : ''}</td></tr>)}</tbody></table>
          </div>
          <p className="small muted">Guided ("supported"), hinted and retry answers count as practice but not as independent evidence.</p>
          <Btn onClick={() => setOpen(null)}>Close</Btn>
        </Modal>
      )}
    </div>
  );
}

function WordListSec() {
  const p = useProfile()!;
  const [text, setText] = useState('');
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const builtIn = useMemo(() => new Set(content().packs.flatMap((pk) => pk.words.map((w) => w.word))), []);
  const good = rows?.filter((r) => !r.issues.length) ?? [];
  return (
    <div className="card col">
      <h3>Add your own word list</h3>
      <p className="small">One word per line: <code>word | part of speech | definition | example sentence | second example (optional)</code></p>
      <textarea className="textin" rows={6} value={text} onChange={(e) => { setText(e.target.value); setRows(null); }} placeholder={'habitat | noun | the natural home of a plant or animal | The pond is a habitat for frogs. | A desert habitat gets little rain.'} />
      <div className="row"><Btn kind="primary" disabled={!text.trim()} onClick={() => setRows(parseWordList(text, builtIn))}>Review list</Btn></div>
      {rows && (
        <>
          <table className="data"><thead><tr><th>Line</th><th>Word</th><th>Definition</th><th>Check</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.line}><td>{r.line}</td><td>{r.word}</td><td>{r.definition}</td><td>{r.issues.map((x) => <div key={x} style={{ color: 'var(--bad)' }}>✗ {x}</div>)}{r.warnings.map((x) => <div key={x} className="muted">⚠ {x}</div>)}{!r.issues.length && !r.warnings.length && '✓ ready'}</td></tr>)}</tbody></table>
          <p className="small muted">Lines with ✗ need fixing before they can be added. Parent words are practiced with meaning, fill-in and typed-recall questions built from your definitions and sentences.</p>
          <Btn kind="go" disabled={!good.length} onClick={() => {
            mutate((pp) => {
              const pool = [...content().packs.flatMap((pk) => pk.words), ...pp.customWords];
              good.forEach((r, i) => { pp.customWords = pp.customWords.filter((c) => c.word !== r.word); pp.customWords.push(buildCustomEntry(r, pool, pp.customWords.length + i + 1)); });
              pp.settings.useCustomWords = true;
            });
            toast(`Added ${good.length} words.`); setRows(null); setText('');
          }}>Add {good.length} reviewed word{good.length === 1 ? '' : 's'}</Btn>
        </>
      )}
      {p.customWords.length > 0 && (
        <>
          <h3>Current list ({p.customWords.length})</h3>
          {p.customWords.map((w) => <div key={w.id} className="row small"><b>{w.word}</b> — {w.definition}<Btn size="small" onClick={() => mutate((pp) => { pp.customWords = pp.customWords.filter((c) => c.id !== w.id); })}>Remove</Btn></div>)}
        </>
      )}
    </div>
  );
}

function SavesSec({ nav }: { nav: Nav }) {
  const p = useProfile()!;
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const download = () => {
    const blob = new Blob([exportSave(getSave())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `vocab-hero-backup-${localDate()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="card col">
      <h3>Save management</h3>
      <p className="small">Progress is saved automatically <b>in this browser only</b>. It does not sync between devices. Download a backup to keep it safe or move it to another browser.</p>
      <div className="row">
        <Btn kind="go" onClick={download}>⬇️ Download backup</Btn>
        <Btn onClick={() => file.current?.click()}>⬆️ Load backup</Btn>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const r = importSave(await f.text());
          if (!r.ok) setMsg(`Could not load: ${r.error} Your current save was not changed.`);
          else { replaceSave(r.save); setMsg('Backup loaded. The save you had before is kept as the "previous save" in case you need it.'); }
          e.target.value = '';
        }} />
        <Btn onClick={() => { const prev = restorePrevious(); if (prev) { replaceSave(prev); setMsg('Previous save restored.'); } else setMsg('No previous save found.'); }}>↩️ Restore previous save</Btn>
      </div>
      {msg && <p className="feedback try small">{msg}</p>}
      <h3>Profiles</h3>
      <p className="small">Current: <b>{p.nickname}</b> · <Btn size="small" onClick={() => nav.go('profiles')}>Switch or add hero</Btn></p>
      <Btn kind="hero" size="small" onClick={() => setConfirmDel(true)}>Delete this profile…</Btn>
      {confirmDel && (
        <Modal title="Delete profile?" onClose={() => setConfirmDel(false)}>
          <p>This permanently removes <b>{p.nickname}</b> and all of their words, coins and items from this browser. Download a backup first if you might want it later.</p>
          <div className="row"><Btn kind="hero" onClick={() => { deleteProfile(p.id); nav.go('profiles'); }}>Delete permanently</Btn><Btn onClick={() => setConfirmDel(false)}>Cancel</Btn></div>
        </Modal>
      )}
    </div>
  );
}
