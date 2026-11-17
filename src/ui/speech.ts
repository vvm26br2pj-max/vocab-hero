// Read-aloud via the browser's speech synthesis, with a clear silent fallback.
// Voice quality depends entirely on the device: we rank the voices it offers and prefer natural/neural,
// premium and enhanced ones, and skip novelty voices. Parents can pick a voice in the Parent area.

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** Novelty or very robotic system voices that should never be chosen automatically. */
const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|hysterical|deranged|pipe organ)\b/i;
/** Apple's "Eloquence" voices: clear but robotic. */
const ELOQUENCE = /\b(eddy|flo|reed|rocko|sandy|shelley|grandma|grandpa)\b/i;
const GOOD_NAMES = /\b(ava|zoe|evan|allison|susan|nathan|joelle|noelle|tom|nicky|aaron|serena|kate|oliver|jenny|aria|guy|emma|libby|sonia|natasha|samantha|daniel|karen|moira|tessa)\b/i;

export function voiceScore(v: SpeechSynthesisVoice): number {
  const n = v.name;
  let s = 0;
  if (!/^en/i.test(v.lang)) return -9999;
  if (NOVELTY.test(n)) return -1000;
  if (ELOQUENCE.test(n)) s -= 200;
  if (/natural|neural/i.test(n)) s += 120;
  if (/premium/i.test(n)) s += 100;
  if (/enhanced/i.test(n)) s += 80;
  if (/online/i.test(n)) s += 40;
  if (/google/i.test(n)) s += 60;
  if (/siri/i.test(n)) s += 90;
  if (GOOD_NAMES.test(n)) s += 20;
  if (/en[-_]US/i.test(v.lang)) s += 15; else if (/en[-_](GB|AU|CA|IE|NZ)/i.test(v.lang)) s += 8;
  if (v.default) s += 5;
  return s;
}
export function voiceQuality(v: SpeechSynthesisVoice): 'natural' | 'good' | 'basic' | 'robotic' {
  const s = voiceScore(v);
  if (s >= 100) return 'natural';
  if (s >= 55) return 'good';
  if (s >= 0) return 'basic';
  return 'robotic';
}

let voices: SpeechSynthesisVoice[] = [];
const listeners = new Set<() => void>();
function refresh() {
  if (!speechAvailable()) return;
  voices = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)).sort((a, b) => voiceScore(b) - voiceScore(a));
  listeners.forEach((l) => l());
}
if (speechAvailable()) { refresh(); window.speechSynthesis.addEventListener?.('voiceschanged', refresh); }
export function englishVoices(): SpeechSynthesisVoice[] { if (!voices.length) refresh(); return voices.filter((v) => voiceScore(v) > -1000); }
export function onVoicesChanged(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

let prefName: string | null = null;
let prefRate = 1;
/** Called when the parent's voice settings change. */
export function setVoicePrefs(name: string | null | undefined, rate: number | undefined) { prefName = name ?? null; prefRate = rate ?? 1; }

/** The original Vocab Hero voice choice: a US English voice like Samantha or Google, else the first English voice. */
function originalVoice(): SpeechSynthesisVoice | null {
  if (!speechAvailable()) return null;
  const vs = window.speechSynthesis.getVoices();
  return vs.find((v) => /en[-_]US/i.test(v.lang) && /female|samantha|google/i.test(v.name)) ?? vs.find((v) => /^en/i.test(v.lang)) ?? null;
}

export function currentVoice(): SpeechSynthesisVoice | null {
  return (prefName && englishVoices().find((v) => v.name === prefName)) || originalVoice();
}

/** Returns false when speech is unavailable so callers can show a fallback message. */
export function speak(text: string, opts: { rate?: number; voiceName?: string } = {}): boolean {
  if (!speechAvailable() || !text.trim()) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92 * (opts.rate ?? prefRate);
    const v = (opts.voiceName && englishVoices().find((x) => x.name === opts.voiceName)) || currentVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-US';
    window.speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}
export function stopSpeaking() { if (speechAvailable()) window.speechSynthesis.cancel(); }
