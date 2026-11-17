// Input state for up to two local players, written by keyboards, gamepads and touch buttons.
export interface InputState {
  left: boolean; right: boolean; down: boolean;
  jump: boolean; punch: boolean; dodge: boolean; power1: boolean; power2: boolean; move: boolean;
}
const blank = (): InputState => ({ left: false, right: false, down: false, jump: false, punch: false, dodge: false, power1: false, power2: false, move: false });
export const inputs: [InputState, InputState] = [blank(), blank()];
const pressed: [InputState, InputState] = [blank(), blank()];
/** Player 1's state (single-player code and touch buttons use this). */
export const input = inputs[0];

export function pressedFor(player: number): InputState { return pressed[player]; }
const changeListeners = new Set<(k: keyof InputState, v: boolean, player: number) => void>();
/** Online guests forward every local button change to the host. */
export function onInputChange(fn: (k: keyof InputState, v: boolean, player: number) => void) { changeListeners.add(fn); return () => { changeListeners.delete(fn); }; }
export function setInput(k: keyof InputState, v: boolean, player = 0) {
  const changed = inputs[player][k] !== v;
  if (v && !inputs[player][k]) pressed[player][k] = true;
  inputs[player][k] = v;
  if (changed) changeListeners.forEach((fn) => fn(k, v, player));
}
export function consume(k: keyof InputState, player = 0): boolean { const v = pressed[player][k]; pressed[player][k] = false; return v; }
export function resetInput() { for (const p of [0, 1]) (Object.keys(inputs[p]) as (keyof InputState)[]).forEach((k) => { inputs[p][k] = false; pressed[p][k] = false; }); }

const SOLO: Record<string, keyof InputState> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyJ: 'punch', KeyZ: 'punch', KeyK: 'dodge', KeyX: 'dodge', ShiftLeft: 'dodge', ShiftRight: 'dodge',
  KeyU: 'power1', KeyQ: 'power1', Digit1: 'power1', KeyI: 'power2', KeyE: 'power2', Digit2: 'power2', KeyL: 'move', KeyF: 'move', Digit3: 'move',
};
/** Two players on one keyboard: left hand vs right hand. */
const DUO: Record<string, [keyof InputState, number]> = {
  KeyA: ['left', 0], KeyD: ['right', 0], KeyW: ['jump', 0], KeyS: ['down', 0], KeyF: ['punch', 0], KeyG: ['dodge', 0], KeyR: ['power1', 0], KeyT: ['power2', 0], KeyY: ['move', 0],
  ArrowLeft: ['left', 1], ArrowRight: ['right', 1], ArrowUp: ['jump', 1], ArrowDown: ['down', 1], KeyK: ['punch', 1], KeyL: ['dodge', 1], KeyI: ['power1', 1], KeyO: ['power2', 1], KeyP: ['move', 1],
  Numpad1: ['punch', 1], Numpad2: ['dodge', 1], Numpad4: ['power1', 1], Numpad5: ['power2', 1], Numpad6: ['move', 1],
};
export function attachKeyboard(twoPlayer = false): () => void {
  const map = (code: string): [keyof InputState, number] | null => (twoPlayer ? DUO[code] ?? null : SOLO[code] ? [SOLO[code], 0] : null);
  const down = (e: KeyboardEvent) => { const m = map(e.code); if (m) { setInput(m[0], true, m[1]); e.preventDefault(); } };
  const up = (e: KeyboardEvent) => { const m = map(e.code); if (m) { setInput(m[0], false, m[1]); e.preventDefault(); } };
  window.addEventListener('keydown', down); window.addEventListener('keyup', up);
  return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); resetInput(); };
}

/** Standard-mapping gamepads: pad 0 → player 1, pad 1 → player 2 (single player: any pad drives player 1). */
const padPrev: Record<number, Partial<InputState>> = {};
export function pollGamepads(twoPlayer: boolean) {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  let slot = 0;
  for (const gp of pads) {
    if (!gp || !gp.connected) continue;
    const player = twoPlayer ? slot : 0;
    slot++;
    if (player > 1) break;
    const b = (i: number) => !!gp.buttons[i]?.pressed;
    const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
    const st: InputState = {
      left: ax < -0.4 || b(14), right: ax > 0.4 || b(15), down: ay > 0.6 || b(13),
      jump: b(0), punch: b(2), dodge: b(1) || b(7), power1: b(3), power2: b(5), move: b(4),
    };
    const prev = padPrev[gp.index] ?? {};
    (Object.keys(st) as (keyof InputState)[]).forEach((k) => { if (st[k] !== !!prev[k]) setInput(k, st[k], player); });
    padPrev[gp.index] = st;
  }
}
export const KEY_HELP = '← → / A D move · Space / W jump · ↓+Space drop · J / Z punch · K / X / Shift dodge · Q / 1 power 1 · E / 2 power 2 · Esc pause · Gamepads work too · Hold punch = power punch · In the air, Down + punch = ground slam · Down + punch = double side strike · hold Down to crouch';
export const DUO_HELP = [
  'Player 1: A D move · W jump · S drop · F punch · G dodge · R power 1 · T power 2',
  'Player 2: ← → move · ↑ jump · ↓ drop · K punch · L dodge · I power 1 · O power 2',
  'Combos: hold punch = power punch · in the air, down + punch = ground slam · down + punch = double side strike · hold down to crouch',
];
