import { useState } from 'react';
import { createProfile, HAIR_COLORS, HAIR_STYLES, SKIN_TONES } from '../../core/profile';
import { FREE_PALETTES, PALETTES } from '../../config/shop';
import type { CombatDifficulty } from '../../config/combat';
import { DIFFICULTY } from '../../config/combat';
import type { Appearance, SaveFile } from '../../core/types';
import { addProfile, mutate, setActive, activeProfile } from '../store';
import { HeroSprite } from '../components/Sprite';
import { Btn, Coin } from '../components/common';
import { Logo } from '../components/Logo';
import { GRADE_NOTE, GradeSelect } from '../components/GradeSelect';

export function Welcome({ save, onDone, showList }: { save: SaveFile; onDone: (s?: 'placement') => void; showList: boolean }) {
  const current = activeProfile();
  const [mode, setMode] = useState<'list' | 'create'>(showList && Object.keys(save.profiles).length ? 'list' : 'create');
  const [step, setStep] = useState(current && !current.onboarded ? 1 : 0);
  const [name, setName] = useState('');
  const [look, setLook] = useState<Partial<Appearance>>({ skin: SKIN_TONES[1], hair: 'short', hairColor: HAIR_COLORS[1], palette: 'hero-red' });
  const [grade, setGrade] = useState(4);
  const [readAloud, setReadAloud] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [combat, setCombat] = useState<CombatDifficulty>('standard');

  if (mode === 'list') {
    return (
      <div className="app">
        <div className="topbar"><span className="brand row" style={{ gap: 10 }}><Logo size={44} />Vocab Hero</span></div>
        <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2>Choose your hero</h2>
          <p className="muted">Profiles are saved in this browser only. Use the Parent area to export a backup.</p>
          <div className="grid three" style={{ marginTop: 10 }}>
            {Object.values(save.profiles).map((p) => (
              <button key={p.id} className="card col center" style={{ alignItems: 'center' }} onClick={() => { setActive(p.id); onDone(); }}>
                <HeroSprite appearance={p.appearance} size={80} animate={false} />
                <strong>{p.nickname}</strong>
                <span className="small muted">Grade {p.settings.grade} words · <Coin size={18} /> {p.points}</span>
              </button>
            ))}
          </div>
          <Btn kind="go" style={{ marginTop: 14 }} onClick={() => { setMode('create'); setStep(0); }}>+ New hero</Btn>
        </div>
      </div>
    );
  }

  const appearanceFull = { ...createProfile('x').appearance, ...look };
  const finishCreate = () => {
    addProfile(createProfile(name || 'Recruit', grade, look));
    setStep(1);
  };
  const finishSetup = (placement: boolean) => {
    mutate((p) => {
      p.settings.grade = grade; p.settings.readAloud = readAloud; p.settings.largeText = largeText; p.settings.combatDifficulty = combat;
      p.onboarded = true;
    });
    onDone(placement ? 'placement' : undefined);
  };

  return (
    <div className="app">
      <div className="topbar"><span className="brand row" style={{ gap: 10 }}><Logo size={44} />Vocab Hero</span><span className="spacer" />{Object.keys(save.profiles).length > 0 && step === 0 && <Btn kind="ghost" size="small" onClick={() => setMode('list')}>Back</Btn>}</div>
      {step === 0 && (
        <div className="grid two">
          <div className="card col">
            <h1>Welcome, recruit!</h1>
            <p>The <strong>Vocab Hero Academy</strong> trains heroes whose biggest power is words. Learn words to earn coins, build your hero, and spar in friendly arena battles.</p>
            <label className="field">Hero nickname (no real names needed)
              <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="e.g. Captain Comet" autoFocus />
            </label>
            <div><strong>Skin tone</strong><div className="swatches">{SKIN_TONES.map((c) => <button key={c} aria-label={`Skin tone ${c}`} className={`swatch ${look.skin === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setLook({ ...look, skin: c })} />)}</div></div>
            <div><strong>Hair</strong><div className="row">{HAIR_STYLES.map((h) => <Btn key={h} size="small" kind={look.hair === h ? 'primary' : ''} onClick={() => setLook({ ...look, hair: h })}>{h}</Btn>)}</div></div>
            <div><strong>Hair color</strong><div className="swatches">{HAIR_COLORS.map((c) => <button key={c} aria-label={`Hair color ${c}`} className={`swatch ${look.hairColor === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setLook({ ...look, hairColor: c })} />)}</div></div>
            <div><strong>Suit colors</strong><div className="swatches">{FREE_PALETTES.map((id) => <button key={id} aria-label={PALETTES[id].name} title={PALETTES[id].name} className={`swatch ${look.palette === id ? 'on' : ''}`} style={{ background: `linear-gradient(135deg, ${PALETTES[id].suit} 60%, ${PALETTES[id].accent} 60%)` }} onClick={() => setLook({ ...look, palette: id })} />)}</div></div>
            <p className="small muted">More colors, emblems, capes, masks, boxing gloves and even shapeshifting can be bought in the Hero Workshop.</p>
          </div>
          <div className="col" style={{ alignItems: 'center' }}>
            <div className="hero-stage" style={{ width: '100%' }}>
              <HeroSprite appearance={appearanceFull} size={180} anim="proud" />
              <div className="nameplate">{name || 'Recruit'}</div>
            </div>
            <Btn kind="hero" size="big" onClick={finishCreate}>Create my hero ➜</Btn>
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="card col" style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2>Grown-up setup</h2>
          <p>Please ask a parent or teacher to choose these. They can be changed any time in the Parent area without losing any words, coins, items, or battle progress.</p>
          <GradeSelect value={grade} onChange={setGrade} />
          <p className="small muted">{GRADE_NOTE}</p>
          <div className="grid two">
            <div className="col">
              <strong>Reading support</strong>
              <label className="switch"><input type="checkbox" checked={readAloud} onChange={(e) => setReadAloud(e.target.checked)} /> Read-aloud buttons for words, definitions and instructions</label>
              <label className="switch"><input type="checkbox" checked={largeText} onChange={(e) => setLargeText(e.target.checked)} /> Larger text</label>
            </div>
            <div className="col">
              <strong>Combat difficulty (separate from word level)</strong>
              {(Object.keys(DIFFICULTY) as CombatDifficulty[]).map((d) => (
                <label key={d} className="switch"><input type="radio" name="cd" checked={combat === d} onChange={() => setCombat(d)} /> <span><b>{DIFFICULTY[d].label}</b> — <span className="small">{DIFFICULTY[d].desc}</span></span></label>
              ))}
            </div>
          </div>
          <p className="small muted">Reading support and Relaxed combat never reduce coins or unlocks.</p>
          <div className="row">
            <Btn kind="go" size="big" onClick={() => finishSetup(false)}>Start at the Academy ➜</Btn>
            <Btn onClick={() => finishSetup(true)}>Try the optional placement sampler first</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
