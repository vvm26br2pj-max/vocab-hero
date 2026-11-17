import { useEffect, useState } from 'react';
import { mutate, useProfile } from '../store';
import { currentVoice, englishVoices, onVoicesChanged, speak, speechAvailable, voiceQuality } from '../speech';
import { Btn } from './common';

const BADGE: Record<string, string> = { natural: '★ Natural', good: 'Good', basic: 'Basic', robotic: 'Robotic' };
const SAMPLE = 'Reluctant means hesitant, or not wanting to do something. Mia was reluctant to speak in front of the class.';

function platform(): 'mac' | 'ios' | 'windows' | 'chromeos' | 'android' | 'other' {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Macintosh/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'windows';
  if (/CrOS/.test(ua)) return 'chromeos';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

/** Parent-facing read-aloud voice chooser: pick a voice, set speed, hear a sample, and learn how to get better voices. */
export function VoicePicker() {
  const p = useProfile()!;
  const [, bump] = useState(0);
  useEffect(() => onVoicesChanged(() => bump((n) => n + 1)), []);
  if (!speechAvailable()) return <p className="small muted">This browser has no read-aloud voices. Text is always shown on screen.</p>;
  const list = englishVoices();
  const cur = currentVoice();
  const best = currentVoice();
  const hasNatural = list.some((v) => voiceQuality(v) === 'natural');
  const os = platform();
  return (
    <div className="voicebox col">
      <strong>Read-aloud voice</strong>
      <div className="row">
        <select value={p.settings.voiceName ?? ''} onChange={(e) => mutate((pp) => { pp.settings.voiceName = e.target.value || null; })} style={{ flex: 1, minWidth: 220, minHeight: 44, borderRadius: 10, border: '3px solid var(--ink)' }} aria-label="Read-aloud voice">
          <option value="">Standard voice{!p.settings.voiceName && best ? ` (${best.name})` : ''}</option>
          {list.map((v) => <option key={v.name + v.lang} value={v.name}>{v.name} · {v.lang} · {BADGE[voiceQuality(v)]}</option>)}
        </select>
        <Btn size="small" kind="go" onClick={() => speak(SAMPLE)}>▶ Test voice</Btn>
      </div>
      <label className="field">Speaking speed: {p.settings.speechRate.toFixed(2)}×
        <input type="range" min={0.7} max={1.2} step={0.05} value={p.settings.speechRate} onChange={(e) => mutate((pp) => { pp.settings.speechRate = Number(e.target.value); })} />
      </label>
      <span className="small">Now using: <b>{cur?.name ?? 'none'}</b> ({cur ? BADGE[voiceQuality(cur)] : '—'})</span>
      {!hasNatural && (
        <div className="voicetip small">
          <b>Want a more natural voice?</b> This device only has basic voices installed. Free, much better voices are available:
          {os === 'mac' && <ol><li>Open <b>System Settings → Accessibility → Spoken Content</b>.</li><li>Next to <b>System voice</b>, choose <b>Manage Voices…</b></li><li>Under English, download a <b>Premium</b> or <b>Enhanced</b> voice (for example <b>Ava (Premium)</b>, <b>Zoe (Premium)</b> or <b>Evan (Enhanced)</b>).</li><li>Quit and reopen the browser, then pick the new voice here.</li></ol>}
          {os === 'ios' && <ol><li>Open <b>Settings → Accessibility → Spoken Content → Voices → English</b>.</li><li>Download an <b>Enhanced</b> or <b>Premium</b> voice (for example Ava or Zoe).</li><li>Reopen Safari and choose it here.</li></ol>}
          {os === 'windows' && <p>Open Vocab Hero in <b>Microsoft Edge</b>: it includes free "Natural" voices (like <b>Microsoft Ava Online (Natural)</b>) that sound close to a real person. Google Chrome offers <b>Google US English</b>.</p>}
          {(os === 'chromeos' || os === 'android') && <p>Use <b>Google Chrome</b> and choose a <b>Google</b> voice here. On Android you can also install higher-quality voices in Settings → Accessibility → Text-to-speech.</p>}
          {os === 'other' && <p>Try Microsoft Edge (Natural voices) or Google Chrome (Google voices), or install enhanced voices in your system's speech settings.</p>}
        </div>
      )}
    </div>
  );
}
