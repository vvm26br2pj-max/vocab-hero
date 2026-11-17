import { useEffect, useState } from 'react';
import type { Nav } from '../App';
import { mutate, toast, useProfile } from '../store';
import { HeroSprite } from '../components/Sprite';
import { Btn, Modal, Points, Coin } from '../components/common';
import { EMBLEMS, FREE_EMBLEMS, FREE_PALETTES, PALETTES, SHOP, SHOP_BY_ID, type ShopItem } from '../../config/shop';
import { HAIR_COLORS, HAIR_STYLES, SKIN_TONES } from '../../core/profile';
import { buy, checkBuy, cosmeticAvailable, describeMissing, equip, type LoadoutSlot } from '../../core/shop';
import { POWERS } from '../../config/combat';
import type { Anim } from '../../art/hero';
import type { Appearance } from '../../core/types';
import { HeroProfile } from './HeroProfile';
import { AbilityMap } from './AbilityMap';
import { sfx } from '../sound';

const TABS = ['Hero Profile', 'Appearance', 'Powers'] as const;
const CONFIRM_AT = 100;

export function Workshop({ nav }: { nav: Nav }) {
  const p = useProfile()!;
  // 'Attributes' (from the HQ button) opens Hero Profile scrolled to the attribute upgrades
  const [tab, setTab] = useState<(typeof TABS)[number]>(nav.tab === 'Attributes' ? 'Hero Profile' : (nav.tab as any) ?? 'Hero Profile');
  useEffect(() => { if (nav.tab === 'Attributes') setTimeout(() => document.getElementById('attributes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }, []);
  const [preview, setPreview] = useState<Partial<Appearance> | null>(null);
  const [anim, setAnim] = useState<Anim>('idle');
  const [confirm, setConfirm] = useState<{ title: string; text: string; run: () => void } | null>(null);
  const look = { ...p.appearance, ...(preview ?? {}) };

  const purchase = (it: ShopItem) => {
    const run = () => {
      let ok = false;
      mutate((pp) => { ok = buy(pp, it.id).ok; });
      if (ok) { sfx.coin(); toast(`Bought ${it.name}!${it.kind === 'power' ? ' Equip it in your loadout.' : ''}`); if (it.look) { const [k, v] = Object.entries(it.look)[0]; mutate((pp) => { (pp.appearance as any)[k] = v; }); setPreview(null); } }
    };
    if (it.price >= CONFIRM_AT) setConfirm({ title: `Buy ${it.name}?`, text: `${it.price} coins. You have ${p.points}; you will have ${p.points - it.price} left.`, run });
    else run();
  };

  return (
    <div className="app">
      <div className="topbar">
        <Btn kind="ghost" size="small" onClick={() => nav.go('hq')}>← HQ</Btn>
        <span className="brand">{tab === 'Hero Profile' ? 'Hero Profile' : 'Hero Workshop'}</span><span className="spacer" /><Points value={p.points} />
      </div>
      {tab === 'Hero Profile' && (
        <>
          <div className="tabs" role="tablist">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t}</button>)}</div>
          <HeroProfile />
          <div className="row" style={{ marginTop: 14 }}><Btn kind="sky" onClick={() => nav.go('battle', { battle: { mode: 'training' } })}>🎯 Feel your upgrades in the free Training Room</Btn></div>
        </>
      )}
      {tab !== 'Hero Profile' && <div className="hq-hero">
        <div className="col" style={{ position: 'sticky', top: 8, alignSelf: 'start' }}>
          <div className="hero-stage">
            <HeroSprite appearance={look} size={170} anim={anim} />
            <div className="nameplate">{p.nickname}</div>
          </div>
          <div className="row center small">{(['idle', 'run', 'jump', 'punch', 'power', 'victory'] as Anim[]).map((a) => <Btn key={a} size="small" kind={anim === a ? 'primary' : ''} onClick={() => setAnim(a)}>{a}</Btn>)}</div>
          {preview && (() => {
            const [k, v] = Object.entries(preview)[0] ?? [];
            const it = SHOP.find((i) => i.look && i.look[k as string] === v);
            const c = it ? checkBuy(p, it.id) : null;
            return (
              <div className="card small col">
                <span>Previewing{it ? ` ${it.name}` : ''} — not bought yet.</span>
                <div className="row">
                  {it && !p.owned.includes(it.id) && <Btn kind="go" size="small" disabled={!c?.ok} onClick={() => purchase(it)}>Buy · <Coin size={16} />{it.price}</Btn>}
                  <Btn size="small" onClick={() => setPreview(null)}>Stop preview</Btn>
                </div>
                {it && c && !c.ok && describeMissing(p, it, c.missing).map((r) => <span key={r} className="muted">• {r}</span>)}
              </div>
            );
          })()}
          <Btn kind="sky" onClick={() => nav.go('battle', { battle: { mode: 'training' } })}>🎯 Free Training Room</Btn>
          <p className="small white">Everything you wear here appears on your hero in battle.</p>
        </div>
        <div className="col">
          <div className="tabs" role="tablist">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t}</button>)}</div>
          {tab === 'Appearance' && <AppearanceTab preview={preview} setPreview={setPreview} purchase={purchase} />}
          {tab === 'Powers' && <PowersTab nav={nav} />}
        </div>
      </div>}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p>{confirm.text}</p>
          <div className="row"><Btn kind="go" onClick={() => { confirm.run(); setConfirm(null); }}>Yes, buy it</Btn><Btn onClick={() => setConfirm(null)}>Not now</Btn></div>
        </Modal>
      )}
    </div>
  );
}

function AppearanceTab({ preview, setPreview, purchase }: { preview: Partial<Appearance> | null; setPreview: (a: Partial<Appearance> | null) => void; purchase: (it: ShopItem) => void }) {
  const p = useProfile()!;
  const set = (k: keyof Appearance, v: string) => { setPreview(null); mutate((pp) => { (pp.appearance as any)[k] = v; }); };
  const previewing = (k: keyof Appearance, v: string) => !!preview && (preview as any)[k] === v;
  const [name, setName] = useState(p.nickname);
  const choice = (kind: 'mask' | 'cape' | 'gloves' | 'boots' | 'shape', none: string, label: string) => {
    const items = SHOP.filter((i) => i.kind === kind);
    return (
      <div><strong>{label}</strong> <span className="tag cos">Cosmetic</span>
        <div className="row" style={{ marginTop: 4 }}>
          <Btn size="small" kind={!preview?.[kind] && (p.appearance[kind] ?? none) === none ? 'primary' : ''} onClick={() => set(kind, none)}>{none === 'none' ? 'None' : none === 'hero' ? 'Hero (normal)' : 'Basic'}</Btn>
          {items.map((it) => {
            const v = it.look![kind];
            const have = cosmeticAvailable(p, kind, v);
            return have
              ? <Btn key={it.id} size="small" kind={!preview?.[kind] && p.appearance[kind] === v ? 'primary' : ''} onClick={() => set(kind, v)}>{it.name}</Btn>
              : <Btn key={it.id} size="small" kind={previewing(kind, v) ? 'sky' : ''} onClick={() => setPreview({ [kind]: v })}>🔒 {it.name} · <Coin size={16} />{it.price}</Btn>;
          })}
        </div>
      </div>
    );
  };
  return (
    <div className="card col">
      <label className="field">Hero name<div className="row"><input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} /><Btn size="small" onClick={() => mutate((pp) => { pp.nickname = name.trim() || pp.nickname; })}>Save</Btn></div></label>
      {p.titles.length > 1 && <label className="field">Title<select value={p.equippedTitle ?? ''} onChange={(e) => mutate((pp) => { pp.equippedTitle = e.target.value || null; })}>{p.titles.map((t) => <option key={t}>{t}</option>)}</select></label>}
      <div><strong>Skin tone</strong><div className="swatches">{SKIN_TONES.map((c) => <button key={c} aria-label="skin tone" className={`swatch ${p.appearance.skin === c ? 'on' : ''}`} style={{ background: c }} onClick={() => set('skin', c)} />)}</div></div>
      <div><strong>Hairstyle</strong><div className="row">{HAIR_STYLES.map((h) => <Btn key={h} size="small" kind={p.appearance.hair === h ? 'primary' : ''} onClick={() => set('hair', h)}>{h}</Btn>)}</div></div>
      <div><strong>Hair color</strong><div className="swatches">{HAIR_COLORS.map((c) => <button key={c} aria-label="hair color" className={`swatch ${p.appearance.hairColor === c ? 'on' : ''}`} style={{ background: c }} onClick={() => set('hairColor', c)} />)}</div></div>
      <div><strong>Suit colors</strong> <span className="tag cos">Cosmetic</span>
        <div className="swatches">{Object.entries(PALETTES).map(([id, pal]) => {
          const have = FREE_PALETTES.includes(id) || cosmeticAvailable(p, 'palette', id);
          return <button key={id} title={`${pal.name}${have ? '' : ' (25 points)'}`} aria-label={`${pal.name}${have ? '' : ', locked, 25 points'}`} className={`swatch ${(preview?.palette ?? p.appearance.palette) === id ? 'on' : ''}`} style={{ background: `linear-gradient(135deg, ${pal.suit} 60%, ${pal.accent} 60%)` }} onClick={() => have ? set('palette', id) : setPreview({ palette: id })}>{!have && <span className="lock">🔒</span>}</button>;
        })}</div>
      </div>
      <div><strong>Emblem</strong> <span className="tag cos">Cosmetic</span>
        <div className="row">{Object.entries(EMBLEMS).map(([id, ch]) => {
          const have = FREE_EMBLEMS.includes(id) || cosmeticAvailable(p, 'emblem', id);
          return <Btn key={id} size="small" kind={previewing('emblem', id) ? 'sky' : !preview?.emblem && p.appearance.emblem === id ? 'primary' : ''} aria-label={`${id} emblem${have ? '' : ', locked'}`} onClick={() => have ? set('emblem', id) : setPreview({ emblem: id })}>{have ? '' : '🔒'}{ch}</Btn>;
        })}</div>
      </div>
      {choice('mask', 'none', 'Mask')}
      {choice('cape', 'none', 'Cape')}
      {choice('gloves', 'basic', 'Gloves')}
      {choice('boots', 'basic', 'Boots')}
      {choice('shape', 'hero', 'Shapeshift')}
      <p className="small muted">Shapeshifting changes your whole body, in menus and in battle. It is looks only: your attributes and abilities stay the same.</p>
      <p className="small muted">Tap a locked 🔒 item to preview it on your hero. A buy button appears under the preview.</p>
    </div>
  );
}

function PowersTab({ nav }: { nav: Nav }) {
  const p = useProfile()!;
  const [open, setOpen] = useState(true);
  const slots: [string, string | null][] = [['Power 1', p.loadout.active[0]], ['Power 2', p.loadout.active[1]], ['Movement', p.loadout.movement], ['Passive', p.loadout.passive]];
  return (
    <div className="col">
      <div className="card col">
        <h3>Your abilities</h3>
        <p className="small muted">Basic move, jump, punch and dodge are always free. Buy, upgrade and equip abilities in the Ability Map. Owned abilities never cost coins to use.</p>
        <div className="grid two">{slots.map(([l, id]) => <div key={l} className="slot"><strong>{l}</strong><div>{id ? SHOP_BY_ID[id]?.name : <span className="muted">Empty</span>}</div></div>)}</div>
        <button className="map-open" onClick={() => setOpen(true)}><span>🗺️</span> OPEN ABILITY MAP</button>
        <Btn kind="sky" onClick={() => nav.go('battle', { battle: { mode: 'training' } })}>🎯 Try your abilities in the free Training Room</Btn>
      </div>
      {open && <AbilityMap onClose={() => setOpen(false)} />}
    </div>
  );
}

export { SHOP_BY_ID };
