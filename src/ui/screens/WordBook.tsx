import { useState } from 'react';
import type { Nav } from '../App';
import { useProfile } from '../store';
import { content } from '../../core/content';
import { isDue, STATE_LABEL, summarize, wordState } from '../../core/mastery';
import { Btn, Modal, Speak } from '../components/common';
import { Scene } from '../components/Scene';
import type { WordState } from '../../core/types';

export function WordBook({ nav }: { nav: Nav }) {
  const p = useProfile()!;
  const idx = content(p.customWords);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | WordState | 'due'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const words = Object.values(p.words).filter((w) => w.introducedAt !== null).map((w) => ({ prog: w, entry: idx.byId.get(w.id)! })).filter((x) => x.entry)
    .filter((x) => !q || x.entry.word.includes(q.toLowerCase()) || x.entry.definition.toLowerCase().includes(q.toLowerCase()))
    .filter((x) => filter === 'all' || (filter === 'due' ? isDue(x.prog) : wordState(x.prog) === filter))
    .sort((a, b) => a.entry.word.localeCompare(b.entry.word));
  const sel = open ? idx.byId.get(open) : null;
  return (
    <div className="app">
      <div className="topbar"><Btn kind="ghost" size="small" onClick={() => nav.go('hq')}>← HQ</Btn><span className="brand">My Word Book</span></div>
      <div className="card col">
        <div className="row">
          <input className="textin" style={{ flex: 1, minWidth: 200 }} placeholder="Search words or meanings" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)} style={{ minHeight: 48, borderRadius: 10, border: '3px solid var(--ink)' }} aria-label="Filter">
            <option value="all">All</option><option value="learning">Learning</option><option value="practicing">Practicing</option><option value="secure">Secure</option><option value="due">Review Due</option>
          </select>
        </div>
        <p className="small muted">{words.length} words · New → Learning → Practicing → Secure. Review Due means it is a good day to see that word again.</p>
        {words.length === 0 && <p>Your word book fills up as you learn. <Btn size="small" onClick={() => nav.go('mission')}>Start a mission</Btn></p>}
        <div className="word-list">
          {words.map(({ prog, entry }) => {
            const st = wordState(prog);
            return (
              <button key={entry.id} className="word-row" onClick={() => setOpen(entry.id)}>
                <b style={{ minWidth: 110 }}>{entry.word}</b>
                <span className="small" style={{ flex: 1 }}>{entry.definition}</span>
                <span className={`tag ${st}`}>{STATE_LABEL[st]}</span>
                {isDue(prog) && <span className="tag due">Review Due</span>}
              </button>
            );
          })}
        </div>
      </div>
      {sel && (
        <Modal title={sel.word} onClose={() => setOpen(null)}>
          <div className="row"><Speak text={sel.word} /><span className="muted">{sel.say} · {sel.pos}{sel.grade ? ` · grade ${sel.grade} pack` : ' · parent list'}</span></div>
          <p><b>Meaning:</b> {sel.definition}</p>
          {sel.contrast.nonExample && <Scene scene={sel.hero.scene} size={240} animate={false} />}
          <p>🦸 {sel.hero.text}</p>
          <p>🏠 {sel.everyday}</p>
          {sel.contrast.nonExample && <p>❌ <i>{sel.contrast.nonExample}</i> — {sel.contrast.explanation}</p>}
          {(sel.related.synonyms.length > 0 || sel.related.antonyms.length > 0) && <p className="small">Similar: {sel.related.synonyms.join(', ') || '—'} · Opposite: {sel.related.antonyms.join(', ') || '—'}</p>}
          {(() => { const s = summarize(p.words[sel.id]); return <p className="small muted">Independent correct answers: {s.independentCorrect} on {s.dates} day(s), {s.formats} kind(s) of question{s.fresh ? ', including a new context' : ''}.</p>; })()}
          <Btn onClick={() => setOpen(null)}>Close</Btn>
        </Modal>
      )}
    </div>
  );
}
