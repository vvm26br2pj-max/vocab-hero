import { HeroSprite, FigureSprite } from '../components/Sprite';
import { DEFAULT_APPEARANCE, HAIR_STYLES, HAIR_COLORS, SKIN_TONES } from '../../core/profile';
import { bossStyle } from '../../combat/styles';
import type { Anim } from '../../art/hero';

/** Dev-only art check page: open the app with #gallery. */
export function Gallery() {
  const anims: Anim[] = ['idle', 'run', 'jump', 'fall', 'punch', 'rush', 'power', 'hurt', 'victory', 'dodge', 'meditate', 'thinking', 'hesitant'];
  return (
    <div className="app">
      <div className="card"><h3>Hair</h3><div className="row">{HAIR_STYLES.map((h, i) => <div key={h} className="col center"><HeroSprite appearance={{ ...DEFAULT_APPEARANCE, hair: h, hairColor: HAIR_COLORS[i % HAIR_COLORS.length], skin: SKIN_TONES[i % 6] }} size={200} animate={false} /><span className="small">{h}</span></div>)}</div></div>
      <div className="card" style={{ marginTop: 10 }}><h3>Shapeshifts, boxing gloves, rocket boots</h3><div className="row">{['hero', 'blob', 'stickman', 'circuit-lynx', 'granite-glove', 'frost-finch', 'prism-moth', 'captain-gravity', 'copper-comet'].flatMap((sh) => (['idle', 'run', 'punch'] as Anim[]).map((an) => <div key={sh + an} className="col center"><HeroSprite appearance={{ ...DEFAULT_APPEARANCE, shape: sh, gloves: 'power', boots: 'rocket', palette: 'ocean' }} anim={an} size={90} /><span className="small">{sh} {an}</span></div>))}</div></div>
      <div className="card" style={{ marginTop: 10 }}><h3>Animations</h3><div className="row">{anims.map((a) => <div key={a} className="col center"><HeroSprite appearance={{ ...DEFAULT_APPEARANCE, cape: 'classic', mask: 'domino', palette: 'royal' }} anim={a} size={90} /><span className="small">{a}</span></div>)}</div></div>
      <div className="card" style={{ marginTop: 10 }}><h3>Bosses</h3><div className="row">{['circuit-lynx', 'granite-glove', 'frost-finch', 'prism-moth', 'captain-gravity', 'copper-comet', 'bot'].map((b) => <div key={b} className="col center"><FigureSprite style={bossStyle(b)} anim="idle" size={90} /><span className="small">{b}</span></div>)}</div></div>
    </div>
  );
}
