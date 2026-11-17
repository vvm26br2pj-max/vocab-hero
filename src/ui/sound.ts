// Tiny synthesized sound effects and a light background loop (WebAudio, no asset files).
let ctx: AudioContext | null = null;
let sfxVol = 0.7, musicVol = 0.5;
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try { ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch { return null; }
}
export function setVolumes(sfx: number, music: number) { sfxVol = sfx; musicVol = music; if (musicGain) musicGain.gain.value = 0.08 * musicVol; refreshTrackVolume(); refreshLobbyVolume(); }

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.15, slide = 0) {
  const a = ac(); if (!a || sfxVol <= 0) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), a.currentTime + dur);
  g.gain.setValueAtTime(vol * sfxVol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
}
export const sfx = {
  click: () => tone(660, 0.05, 'square', 0.06),
  correct: () => { tone(660, 0.1, 'triangle', 0.18); setTimeout(() => tone(990, 0.16, 'triangle', 0.18), 90); },
  wrong: () => tone(220, 0.18, 'triangle', 0.12, -60),
  coin: () => { tone(988, 0.07, 'square', 0.08); setTimeout(() => tone(1318, 0.12, 'square', 0.08), 70); },
  punch: () => tone(160, 0.08, 'sawtooth', 0.14, -80),
  hit: () => tone(320, 0.07, 'square', 0.12, -150),
  pop: () => tone(880 + Math.random() * 300, 0.06, 'triangle', 0.1, -500),
  hurt: () => tone(140, 0.2, 'sawtooth', 0.14, -60),
  jump: () => tone(400, 0.1, 'triangle', 0.08, 300),
  dodge: () => tone(700, 0.08, 'sine', 0.08, -400),
  laser: () => tone(1200, 0.3, 'sawtooth', 0.07, -900),
  warn: () => tone(520, 0.12, 'sine', 0.08),
  power: () => tone(300, 0.35, 'sawtooth', 0.1, 500),
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.16), i * 120)),
  lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.12), i * 160)),
};

let musicGain: GainNode | null = null;
let musicTimer: number | null = null;
export function startMusic(kind: 'menu' | 'battle' = 'battle') {
  stopMusic();
  const a = ac(); if (!a || musicVol <= 0) return;
  musicGain = a.createGain(); musicGain.gain.value = 0.08 * musicVol; musicGain.connect(a.destination);
  const notes = kind === 'battle' ? [220, 262, 330, 262, 196, 247, 294, 247] : [262, 330, 392, 330];
  let i = 0;
  const step = () => {
    if (!musicGain || !ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = notes[i++ % notes.length];
    g.gain.setValueAtTime(1, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    o.connect(g).connect(musicGain); o.start(); o.stop(ctx.currentTime + 0.3);
  };
  musicTimer = window.setInterval(step, kind === 'battle' ? 220 : 400);
}
export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  if (musicGain) { try { musicGain.disconnect(); } catch { /* */ } musicGain = null; }
}

// ---------- recorded music tracks (battle theme) ----------
let track: HTMLAudioElement | null = null;
let fadeTimer: number | null = null;
let ducked = false;
const trackLevel = () => Math.min(1, 0.85 * musicVol) * (ducked ? 0.3 : 1);
function fadeTo(target: number, ms: number, then?: () => void) {
  if (fadeTimer) clearInterval(fadeTimer);
  const t = track; if (!t) { then?.(); return; }
  const start = t.volume, steps = Math.max(1, Math.round(ms / 40));
  let i = 0;
  fadeTimer = window.setInterval(() => {
    i++;
    t.volume = Math.max(0, Math.min(1, start + (target - start) * (i / steps)));
    if (i >= steps) { if (fadeTimer) clearInterval(fadeTimer); fadeTimer = null; then?.(); }
  }, 40);
}
/** Start a looping track with a fade-in. */
export function playTrack(url: string, fadeMs = 2000) {
  stopTrack();
  if (musicVol <= 0) return;
  const t = new Audio(url);
  t.loop = true; t.volume = 0; ducked = false;
  track = t;
  t.play().then(() => fadeTo(trackLevel(), fadeMs)).catch(() => { /* autoplay blocked: stay silent */ });
}
/** Fade the current track out, then stop it. */
export function fadeOutTrack(ms = 2000) {
  const t = track; if (!t) return;
  fadeTo(0, ms, () => { t.pause(); if (track === t) track = null; });
}
export function stopTrack() { if (fadeTimer) clearInterval(fadeTimer); fadeTimer = null; if (track) { track.pause(); track = null; } }
/** Quieter while the game is paused. */
export function duckTrack(on: boolean) { if (!track || ducked === on) return; ducked = on; fadeTo(trackLevel(), 300); }
export function refreshTrackVolume() { if (track && !fadeTimer) track.volume = trackLevel(); }

// ---------- menu music (HQ, Workshop, Arena menus, settings, hero creation; never during lessons or battles) ----------
let lobby: HTMLAudioElement | null = null;
let lobbyOn = false;
let lobbyFade: number | null = null;
let gestureHooked = false;
const lobbyLevel = () => Math.min(1, 0.55 * musicVol);
function lobbyFadeTo(target: number, ms: number, then?: () => void) {
  if (lobbyFade) clearInterval(lobbyFade);
  const t = lobby; if (!t) { then?.(); return; }
  const start = t.volume, steps = Math.max(1, Math.round(ms / 40));
  let i = 0;
  lobbyFade = window.setInterval(() => {
    i++;
    t.volume = Math.max(0, Math.min(1, start + (target - start) * (i / steps)));
    if (i >= steps) { if (lobbyFade) clearInterval(lobbyFade); lobbyFade = null; then?.(); }
  }, 40);
}
function startLobby() {
  const t = lobby; if (!t || !lobbyOn || musicVol <= 0) return;
  t.play().then(() => lobbyFadeTo(lobbyLevel(), 1200)).catch(() => {
    // browsers only allow sound after the first tap or key press: try again then
    if (gestureHooked) return;
    gestureHooked = true;
    const retry = () => { gestureHooked = false; window.removeEventListener('pointerdown', retry); window.removeEventListener('keydown', retry); startLobby(); };
    window.addEventListener('pointerdown', retry); window.addEventListener('keydown', retry);
  });
}
/** Turn the menu music on or off (fades; resumes where it left off). */
export function setLobbyMusic(url: string, on: boolean) {
  if (on === lobbyOn && (!on || (lobby && !lobby.paused))) return;
  lobbyOn = on;
  if (on) {
    if (!lobby) { lobby = new Audio(url); lobby.loop = true; lobby.volume = 0; }
    startLobby();
  } else if (lobby) {
    const t = lobby;
    lobbyFadeTo(0, 700, () => { if (!lobbyOn) t.pause(); });
  }
}
export function refreshLobbyVolume() {
  if (!lobby) return;
  if (musicVol <= 0) { lobby.pause(); return; }
  if (lobbyOn && lobby.paused) startLobby();
  else if (!lobbyFade) lobby.volume = lobbyLevel();
}
