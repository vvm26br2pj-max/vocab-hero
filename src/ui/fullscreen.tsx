// Full screen toggle. Inside an embed that doesn't allow it (such as some Google Sites pages), the game opens in its
// own browser tab instead (same approach as Math & Might); saves are shared through the browser's storage.
import { useEffect, useState } from 'react';
import { toast } from './store';

const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void; webkitFullscreenEnabled?: boolean };
export const isFullscreen = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);

function openOwnTab() {
  let url = location.href;
  if (import.meta.env.MODE === 'single' || !/^https?:/.test(location.protocol)) {
    // the page rebuilds itself from its own script in the new tab (React replaces whatever is in #root)
    url = URL.createObjectURL(new Blob(['<!doctype html>' + document.documentElement.outerHTML], { type: 'text/html' }));
  }
  const w = window.open(url, '_blank');
  if (w) toast('🖥️ Full screen isn’t allowed inside this page, so Vocab Hero opened in its own tab. Your progress is saved there too.');
  else toast('⚠️ Full screen isn’t allowed here and the browser blocked a new tab. Try your browser’s own full-screen view (Ctrl+Cmd+F on a Mac, F11 on Windows or Chromebook).');
}

export function toggleFullscreen() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
  if (isFullscreen()) { (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc); return; }
  const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
  if (req && (doc.fullscreenEnabled || doc.webkitFullscreenEnabled)) {
    try { const p = req.call(el); if (p && (p as Promise<void>).catch) (p as Promise<void>).catch(openOwnTab); } catch { openOwnTab(); }
  } else openOwnTab();
}

export function useFullscreen() {
  const [on, setOn] = useState(isFullscreen());
  useEffect(() => {
    const f = () => setOn(isFullscreen());
    document.addEventListener('fullscreenchange', f); document.addEventListener('webkitfullscreenchange', f);
    return () => { document.removeEventListener('fullscreenchange', f); document.removeEventListener('webkitfullscreenchange', f); };
  }, []);
  return on;
}

/** The ⛶ button: corner of every menu screen, and beside Pause in battle. */
export function FullscreenButton({ floating = false }: { floating?: boolean }) {
  const on = useFullscreen();
  return (
    <button className={`fs-btn ${floating ? 'floating' : ''}`} onClick={toggleFullscreen} title={on ? 'Leave full screen' : 'Full screen'} aria-label={on ? 'Leave full screen' : 'Full screen'}>
      <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={on ? 'M8 3v5H3M17 8h-5V3M12 17v-5h5M3 12h5v5' : 'M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5'} />
      </svg>
      {floating && <span>{on ? 'Exit full screen' : 'Full screen'}</span>}
    </button>
  );
}
