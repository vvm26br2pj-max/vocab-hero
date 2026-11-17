import lobbyTheme from '@lobby-theme';
import '../combat/styles'; // registers rival looks for shapeshifting
import { useCallback, useEffect, useState } from 'react';
import { useProfile, useSave, startupNotice } from './store';
import { Toasts } from './components/common';
import { setVolumes, setLobbyMusic } from './sound';
import { setVoicePrefs } from './speech';
import { Welcome } from './screens/Welcome';
import { Headquarters } from './screens/Headquarters';
import { Mission } from './screens/Mission';
import { Workshop } from './screens/Workshop';
import { Arena } from './screens/Arena';
import { Challenges } from './screens/Challenges';
import { WordBook } from './screens/WordBook';
import { Parent } from './screens/Parent';
import { Placement } from './screens/Placement';
import { Battle, type BattleRequest } from './screens/Battle';
import { Gallery } from './screens/Gallery';
import { Multiplayer } from './screens/Multiplayer';
import { DevConsole, useSecretWord } from './components/DevConsole';
import { FullscreenButton } from './fullscreen';

export type Screen = 'hq' | 'mission' | 'workshop' | 'arena' | 'challenges' | 'words' | 'parent' | 'placement' | 'battle' | 'profiles' | 'multiplayer';
export interface Nav { go: (s: Screen, opts?: { battle?: BattleRequest; tab?: string }) => void; tab?: string }

export function App() {
  const save = useSave();
  const profile = useProfile();
  const [screen, setScreen] = useState<Screen>('hq');
  const [battle, setBattle] = useState<BattleRequest | null>(null);
  const [tab, setTab] = useState<string | undefined>();
  const [notice, setNotice] = useState(startupNotice);
  const [devOpen, setDevOpen] = useState(false);
  useSecretWord(useCallback(() => setDevOpen(true), []));

  useEffect(() => {
    if (!profile) return;
    const r = document.documentElement;
    r.classList.toggle('large-text', profile.settings.largeText);
    r.classList.toggle('reduced-motion', profile.settings.reducedMotion);
    setVolumes(profile.settings.sfxVolume, profile.settings.musicVolume);
    setVoicePrefs(profile.settings.voiceName, profile.settings.speechRate);
  }, [profile?.settings.largeText, profile?.settings.reducedMotion, profile?.settings.sfxVolume, profile?.settings.musicVolume, profile?.settings.voiceName, profile?.settings.speechRate, profile]);

  useEffect(() => { window.scrollTo(0, 0); }, [screen]);
  // menu music everywhere except lessons (mission, placement test, word book) and battles, which have their own music
  const learning = !!profile && profile.onboarded && screen !== 'profiles' && (screen === 'mission' || screen === 'placement' || screen === 'words' || screen === 'battle');
  useEffect(() => { setLobbyMusic(lobbyTheme, !learning); }, [learning]);

  const nav: Nav = {
    tab,
    go: (s, opts) => { setTab(opts?.tab); if (opts?.battle) setBattle(opts.battle); setScreen(s); },
  };

  if (import.meta.env.DEV && location.hash === '#gallery') return <Gallery />;
  let body;
  if (!profile || screen === 'profiles') body = <Welcome save={save} onDone={(s) => setScreen(s ?? 'hq')} showList={screen === 'profiles' || Object.keys(save.profiles).length > 0} />;
  else if (!profile.onboarded) body = <Welcome save={save} onDone={(s) => setScreen(s ?? 'hq')} showList={false} />;
  else switch (screen) {
    case 'mission': body = <Mission nav={nav} />; break;
    case 'workshop': body = <Workshop nav={nav} />; break;
    case 'arena': body = <Arena nav={nav} />; break;
    case 'challenges': body = <Challenges nav={nav} />; break;
    case 'words': body = <WordBook nav={nav} />; break;
    case 'parent': body = <Parent nav={nav} />; break;
    case 'placement': body = <Placement nav={nav} />; break;
    case 'multiplayer': body = <Multiplayer nav={nav} />; break;
    case 'battle': body = battle ? <Battle req={battle} nav={nav} /> : <Arena nav={nav} />; break;
    default: body = <Headquarters nav={nav} />;
  }
  return (
    <>
      <Toasts />
      {devOpen && profile && <DevConsole nav={nav} onClose={() => setDevOpen(false)} />}
      {notice && (
        <div className="toasts" style={{ top: 'auto', bottom: 12 }}>
          <div className="toast" role="alert" style={{ pointerEvents: 'auto' }}>{notice} <button className="btn small" onClick={() => setNotice(undefined)}>OK</button></div>
        </div>
      )}
      {body}
      {screen !== 'battle' && <FullscreenButton floating />}
    </>
  );
}
