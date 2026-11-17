// Layered, procedurally drawn character art. One geometry source renders to SVG (menus, lessons)
// and to Phaser Graphics (combat), so every equipped item appears identically in battle.
//
// Conventions (sprite faces RIGHT, 80×110 box, feet at y≈108):
//   arm angle: 0 = hanging down, + = rotated forward (toward facing). Elbow: + bends the forearm forward (natural).
//   leg angle: 0 = straight down, + = forward. Knee: − bends the shin backward (natural, so runs look right).
import { PALETTES } from '../config/shop';
import type { Appearance } from '../core/types';
import type { Pose } from '../content/schema';

export type Shape = ShapeBase & { glow?: string };
type ShapeBase =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill: string; r?: number; alpha?: number; nl?: boolean }
  | { t: 'circle'; x: number; y: number; r: number; fill: string; alpha?: number; nl?: boolean }
  | { t: 'ellipse'; x: number; y: number; rx: number; ry: number; fill: string; alpha?: number; nl?: boolean }
  | { t: 'poly'; pts: number[]; fill: string; alpha?: number; nl?: boolean }
  | { t: 'limb'; x1: number; y1: number; x2: number; y2: number; w: number; fill: string; alpha?: number; nl?: boolean };

export type Anim = 'idle' | 'run' | 'jump' | 'fall' | 'punch' | 'power' | 'hurt' | 'victory' | 'dodge' | 'charge' | 'rush' | 'slam' | 'duck' | 'crouch' | 'meditate' | Pose;

interface PoseParams {
  lean: number; bob: number;
  armF: [number, number]; armB: [number, number];
  legF: [number, number]; legB: [number, number];
  eyes: 'normal' | 'wide' | 'closed' | 'x' | 'glow' | 'narrow' | 'happy' | 'side';
  mouth: 'smile' | 'frown' | 'open' | 'flat' | 'grin' | 'o' | 'wobbly' | 'shout';
  brows: 'none' | 'up' | 'worried' | 'angry' | 'flat';
  headTilt: number;
  sitting?: boolean;
}

const base: PoseParams = { lean: 0, bob: 0, armF: [8, 14], armB: [-8, 14], legF: [4, 0], legB: [-4, 0], eyes: 'normal', mouth: 'smile', brows: 'flat', headTilt: 0 };

export function poseFor(anim: Anim, t: number): PoseParams {
  const s = Math.sin(t * 2 * Math.PI);
  switch (anim) {
    case 'idle': return { ...base, bob: s * 1, armF: [12 + s * 2, 22], armB: [-10 - s * 2, 20], legF: [6, -2], legB: [-6, -2] };
    case 'run': {
      const ph = t * 2 * Math.PI * 1.7;
      const sf = Math.sin(ph), cf = Math.cos(ph);
      return {
        ...base, lean: 7, bob: -Math.abs(cf) * 2.5,
        legF: [36 * sf, -(8 + 62 * Math.max(0, cf))], legB: [-36 * sf, -(8 + 62 * Math.max(0, -cf))],
        armF: [-42 * sf, 78], armB: [42 * sf, 78], mouth: 'grin', brows: 'flat',
      };
    }
    case 'jump': return { ...base, bob: -2, armF: [160, 15], armB: [-40, 60], legF: [62, -88], legB: [6, -38], mouth: 'open', brows: 'up' };
    case 'fall': return { ...base, armF: [120, 25], armB: [-110, 20], legF: [22, -28], legB: [-12, -40], eyes: 'wide', mouth: 'o', brows: 'up' };
    case 'punch': return { ...base, lean: 9, armF: [92, 0], armB: [-25, 110], legF: [32, -8], legB: [-30, -12], eyes: 'narrow', brows: 'angry', mouth: 'shout' };
    case 'rush': return { ...base, lean: 18, bob: 2, armF: [95, 0], armB: [-60, 100], legF: [58, -50], legB: [-55, -35], eyes: 'narrow', brows: 'angry', mouth: 'shout' };
    case 'slam': return { ...base, lean: 6, bob: -4, armF: [168, 6], armB: [158, 10], legF: [55, -95], legB: [20, -70], eyes: 'narrow', brows: 'angry', mouth: 'shout' };
    case 'duck': return { ...base, lean: 4, bob: 14, armF: [94, 0], armB: [-94, 0], legF: [70, -120], legB: [-65, 55], eyes: 'narrow', brows: 'angry', mouth: 'shout' };
    case 'crouch': return { ...base, lean: 5, bob: 14, armF: [45, 115], armB: [30, 110], legF: [70, -120], legB: [-65, 55], eyes: 'narrow', brows: 'flat', mouth: 'flat' };
    case 'charge': return { ...base, lean: -4, armF: [-55, 110], armB: [35, 95], legF: [30, -28], legB: [-26, -12], eyes: 'narrow', brows: 'angry', mouth: 'flat' };
    case 'power': return { ...base, lean: 3, armF: [88, 8], armB: [78, 18], legF: [22, -4], legB: [-22, -6], eyes: 'glow', brows: 'angry', mouth: 'shout' };
    case 'hurt': return { ...base, lean: -11, armF: [-35, 45], armB: [55, 35], legF: [18, -25], legB: [-20, -12], eyes: 'x', mouth: 'wobbly', headTilt: -12 };
    case 'victory': return { ...base, bob: s * 1.5, armF: [172, 4], armB: [-30, 105], legF: [12, 0], legB: [-12, 0], eyes: 'happy', mouth: 'grin', brows: 'up' };
    case 'meditate': return { ...base, bob: 15 + s * 1.2, armF: [18, 52], armB: [8, 58], legF: [82, -158], legB: [74, -150], eyes: 'closed', mouth: 'smile', brows: 'flat', sitting: true };
    case 'dodge': return { ...base, lean: 18, bob: 4, armF: [-70, 40], armB: [-95, 25], legF: [72, -95], legB: [-48, -45], eyes: 'narrow', mouth: 'flat' };
    // learning-scene poses
    case 'neutral': return { ...base, bob: s * 0.5 };
    case 'happy': return { ...base, bob: s, armF: [35, 70], armB: [-30, 65], eyes: 'happy', mouth: 'grin', brows: 'up' };
    case 'excited': return { ...base, bob: -Math.abs(s) * 4, armF: [165, 12], armB: [155, 12], eyes: 'wide', mouth: 'open', brows: 'up' };
    case 'sad': return { ...base, lean: 3, bob: 1, armF: [3, 4], armB: [-3, 4], eyes: 'closed', mouth: 'frown', brows: 'worried', headTilt: 10 };
    case 'angry': return { ...base, armF: [35, -105], armB: [-35, 105], eyes: 'narrow', mouth: 'frown', brows: 'angry' };
    case 'scared': return { ...base, lean: -7, bob: s * 0.8, armF: [115, 65], armB: [100, 70], legF: [12, -10], legB: [-14, -6], eyes: 'wide', mouth: 'wobbly', brows: 'worried' };
    case 'surprised': return { ...base, armF: [145, 25], armB: [-140, -20], eyes: 'wide', mouth: 'o', brows: 'up' };
    case 'thinking': return { ...base, armF: [28, 148], armB: [-10, 70], eyes: 'side', mouth: 'flat', brows: 'up', headTilt: 6 };
    case 'hesitant': return { ...base, lean: -5, armF: [22, 132], armB: [-6, 10], legF: [12, -6], legB: [-6, 0], eyes: 'side', mouth: 'wobbly', brows: 'worried', headTilt: -7 };
    case 'confident': return { ...base, armF: [35, -105], armB: [-35, 105], mouth: 'grin' };
    case 'tired': return { ...base, lean: 6, bob: 2, armF: [2, 4], armB: [-2, 4], eyes: 'closed', mouth: 'o', brows: 'worried', headTilt: 12 };
    case 'calm': return { ...base, bob: s * 0.4, armF: [6, 12], armB: [-6, 12], eyes: 'closed', mouth: 'smile' };
    case 'proud': return { ...base, lean: -3, armF: [35, -105], armB: [-35, 105], eyes: 'happy', mouth: 'grin', headTilt: -7 };
    case 'confused': return { ...base, armF: [140, 150], armB: [-10, 30], eyes: 'side', mouth: 'wobbly', brows: 'worried', headTilt: 10 };
    case 'determined': return { ...base, lean: 4, armF: [70, 105], armB: [-30, 95], legF: [20, -4], legB: [-20, -6], eyes: 'narrow', mouth: 'flat', brows: 'angry' };
    case 'kind': return { ...base, armF: [62, 40], armB: [-8, 14], eyes: 'happy', mouth: 'smile', brows: 'up', headTilt: 5 };
    case 'sneaky': return { ...base, lean: 10, bob: 3, armF: [60, 85], armB: [-40, 70], legF: [35, -60], legB: [-30, -42], eyes: 'side', mouth: 'flat' };
    case 'looking': return { ...base, armF: [140, 125], armB: [-8, 12], eyes: 'wide', mouth: 'flat', brows: 'up' };
    case 'pointing': return { ...base, armF: [92, 0], armB: [-8, 14], mouth: 'open' };
    case 'lifting': return { ...base, bob: 1, armF: [172, 8], armB: [168, 8], legF: [20, -10], legB: [-20, -10], eyes: 'narrow', mouth: 'flat', brows: 'angry' };
    case 'running': return poseFor('run', t);
    case 'jumping': return poseFor('jump', t);
    case 'flying': return { ...base, lean: 22, armF: [172, 0], armB: [150, 0], legF: [-18, -12], legB: [-36, -24], mouth: 'grin' };
    case 'sitting': return { ...base, bob: 14, armF: [40, 50], armB: [-20, 30], legF: [85, -85], legB: [80, -80], sitting: true };
    case 'talking': return { ...base, armF: [52 + s * 14, 70], armB: [-8, 14], mouth: t % 0.5 < 0.25 ? 'open' : 'smile', brows: 'up' };
    case 'listening': return { ...base, armF: [28, 130], armB: [-8, 14], mouth: 'flat', brows: 'up', headTilt: 8 };
    case 'writing': return { ...base, lean: 6, armF: [55, 65], armB: [30, 70], eyes: 'side', mouth: 'flat', headTilt: 10 };
    case 'building': return { ...base, lean: 6, armF: [70 + s * 25, 55], armB: [40, 60], legF: [30, -40], legB: [-20, -20], eyes: 'narrow', mouth: 'flat' };
    case 'waving': return { ...base, armF: [150, 25 + s * 30], armB: [-8, 14], eyes: 'happy', mouth: 'grin' };
    case 'shrugging': return { ...base, armF: [40, 85], armB: [-40, -85], mouth: 'wobbly', brows: 'up' };
  }
  return base;
}

// ---------- color + geometry helpers ----------
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * (amt > 0 ? 255 - v : v))));
  const r = c((n >> 16) & 255), g = c((n >> 8) & 255), b = c(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
const rad = (d: number) => (d * Math.PI) / 180;

/** Closed Catmull-Rom spline through points → smooth polygon. */
function smooth(pts: number[], seg = 4, closed = true): number[] {
  const P: [number, number][] = [];
  for (let i = 0; i < pts.length; i += 2) P.push([pts[i], pts[i + 1]]);
  const n = P.length, out: number[] = [];
  const get = (i: number) => (closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let k = 0; k < seg; k++) {
      const t = k / seg, t2 = t * t, t3 = t2 * t;
      out.push(
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      );
    }
  }
  if (!closed) out.push(P[n - 1][0], P[n - 1][1]);
  return out;
}
/** Tapered capsule from (x1,y1) radius r1 to (x2,y2) radius r2. */
function capsule(x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, n = 6): number[] {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) { const t = a - Math.PI / 2 + (Math.PI * i) / n; pts.push(x2 + Math.cos(t) * r2, y2 + Math.sin(t) * r2); }
  for (let i = 0; i <= n; i++) { const t = a + Math.PI / 2 + (Math.PI * i) / n; pts.push(x1 + Math.cos(t) * r1, y1 + Math.sin(t) * r1); }
  return pts;
}
function joint(x: number, y: number, a: number, e: number, l1: number, l2: number) {
  const ex = x + Math.sin(rad(a)) * l1, ey = y + Math.cos(rad(a)) * l1;
  const hx = ex + Math.sin(rad(a + e)) * l2, hy = ey + Math.cos(rad(a + e)) * l2;
  return { ex, ey, hx, hy };
}
/** Translate head-local points (head center origin) into sprite space with tilt. */
function local(pts: number[], hx: number, hy: number, tilt: number): number[] {
  const c = Math.cos(rad(tilt)), s = Math.sin(rad(tilt));
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) out.push(hx + pts[i] * c - pts[i + 1] * s, hy + pts[i] * s + pts[i + 1] * c);
  return out;
}

export function emblemShapes(id: string, cx: number, cy: number, s: number, fill: string): Shape[] {
  const star = (n: number, r1: number, r2: number, rot = -90) => {
    const pts: number[] = [];
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1; const a = rad(rot + (i * 180) / n); pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    return pts;
  };
  const nl = true;
  switch (id) {
    case 'bolt': return [{ t: 'poly', fill, nl, pts: [cx + s * 0.2, cy - s, cx - s * 0.6, cy + s * 0.1, cx - s * 0.05, cy + s * 0.1, cx - s * 0.3, cy + s, cx + s * 0.6, cy - s * 0.2, cx + s * 0.05, cy - s * 0.2] }];
    case 'heart': return [{ t: 'poly', fill, nl, pts: smooth([cx, cy - s * 0.35, cx + s * 0.5, cy - s * 0.85, cx + s * 0.95, cy - s * 0.3, cx, cy + s * 0.85, cx - s * 0.95, cy - s * 0.3, cx - s * 0.5, cy - s * 0.85], 3) }];
    case 'diamond': return [{ t: 'poly', fill, nl, pts: [cx, cy - s, cx + s * 0.7, cy, cx, cy + s, cx - s * 0.7, cy] }];
    case 'moon': return [{ t: 'poly', fill, nl, pts: smooth([cx - s * 0.2, cy - s * 0.9, cx - s * 0.85, cy, cx - s * 0.2, cy + s * 0.9, cx + s * 0.55, cy + s * 0.55, cx + 0.05 * s, cy + s * 0.3, cx - s * 0.2, cy, cx + 0.05 * s, cy - s * 0.3, cx + s * 0.55, cy - s * 0.55], 3) }];
    case 'crown': return [{ t: 'poly', fill, nl, pts: [cx - s, cy + s * 0.6, cx - s, cy - s * 0.5, cx - s * 0.5, cy, cx, cy - s * 0.8, cx + s * 0.5, cy, cx + s, cy - s * 0.5, cx + s, cy + s * 0.6] }];
    case 'leaf': return [{ t: 'poly', fill, nl, pts: smooth([cx, cy - s, cx + s * 0.55, cy, cx, cy + s, cx - s * 0.55, cy], 4) }];
    case 'atom': return [{ t: 'ellipse', x: cx, y: cy, rx: s, ry: s * 0.32, fill, alpha: 0.9, nl }, { t: 'ellipse', x: cx, y: cy, rx: s * 0.32, ry: s, fill, alpha: 0.9, nl }, { t: 'circle', x: cx, y: cy, r: s * 0.3, fill: shade(fill, -0.5), nl }];
    case 'key': return [{ t: 'circle', x: cx - s * 0.4, y: cy, r: s * 0.45, fill, nl }, { t: 'rect', x: cx - s * 0.1, y: cy - s * 0.15, w: s * 1.1, h: s * 0.3, fill, nl }, { t: 'rect', x: cx + s * 0.6, y: cy, w: s * 0.2, h: s * 0.5, fill, nl }];
    case 'book': return [{ t: 'poly', fill, nl, pts: [cx - s, cy - s * 0.5, cx, cy - s * 0.3, cx + s, cy - s * 0.5, cx + s, cy + s * 0.6, cx, cy + s * 0.8, cx - s, cy + s * 0.6] }];
    default: return [{ t: 'poly', fill, nl, pts: star(5, s, s * 0.45) }];
  }
}

export interface BodyStyle {
  kind: 'hero' | 'lynx' | 'granite' | 'finch' | 'moth' | 'gravity' | 'comet' | 'bot';
  main: string; accent: string; eye: string; skin?: string;
}

export function heroShapes(a: Appearance, anim: Anim, t: number): Shape[] {
  const pal = PALETTES[a.palette] ?? PALETTES['hero-red'];
  const sh = a.shape ?? 'hero';
  if (sh === 'blob') return blobShapes(pal.suit, pal.accent, anim, t);
  if (sh === 'stickman') return stickShapes(pal.suit, pal.accent, anim, t);
  if (sh !== 'hero' && RIVAL_STYLES[sh]) return figureShapes(RIVAL_STYLES[sh], anim, t);
  return figureShapes({ kind: 'hero', main: pal.suit, accent: pal.accent, eye: '#1b1b2f', skin: a.skin }, anim, t, a);
}

export function figureShapes(style: BodyStyle, anim: Anim, t: number, a?: Appearance): Shape[] {
  const P = poseFor(anim, t);
  const out: Shape[] = [];
  const k = style.kind;
  const suit = style.main, acc = style.accent;
  const dark = shade(suit, -0.32), light = shade(suit, 0.25);
  const skin = style.skin ?? (k === 'lynx' ? shade(suit, 0.35) : k === 'granite' ? '#a8927c' : k === 'finch' ? '#eaf7ff' : k === 'moth' ? '#e9d8ff' : k === 'comet' ? '#f2c39a' : k === 'gravity' ? '#d6c3a5' : '#c7cfdd');
  const bulk = k === 'granite' ? 1.35 : k === 'gravity' ? 1.08 : 1;
  const limbR = (k === 'granite' ? 5.6 : 4.2) * (k === 'moth' || k === 'finch' ? 0.88 : 1);
  const bob = P.bob;
  const sx = 40 + P.lean * 0.5, sy = 45 + bob;
  const hipX = 40, hipY = P.sitting ? 86 : 72 + bob;
  const headR = k === 'granite' ? 10.5 : 12.5;
  const headX = 40 + P.lean * 0.95, headY = (k === 'granite' ? 33 : 29) + bob;
  const tilt = P.headTilt;
  const gloveC = a?.gloves === 'power' ? acc : k === 'hero' ? shade(acc, -0.05) : k === 'granite' ? '#7d6a58' : acc;
  const bootC = a?.boots === 'rocket' ? shade(acc, -0.15) : k === 'hero' ? shade(suit, -0.45) : dark;
  const wave = Math.sin(t * 2 * Math.PI) * 3;

  // ===== back layers =====
  if (k === 'hero' && a && a.mask !== 'cowl') out.push(...hairBack(a.hair, a.hairColor, headX, headY, tilt, t));
  if (a && a.cape !== 'none') {
    const len = a.cape === 'short' ? 30 : 58;
    const tip = sy + len;
    const flutter = P.lean * 1.4;
    const outer = a.cape === 'storm'
      ? [sx - 7, sy - 3, sx + 5, sy - 2, sx + 1 + wave, tip - 10, sx - 6 + wave, tip - 2, sx - 11 - flutter + wave, tip - 9, sx - 18 - flutter + wave, tip, sx - 24 - flutter, tip - 14]
      : smooth([sx - 8, sy - 3, sx + 5, sy - 2, sx + 3 + wave, tip - len * 0.5, sx + 1 + wave, tip, sx - 13 - flutter + wave * 1.5, tip + 2, sx - 22 - flutter + wave, tip - 6, sx - 16 - flutter * 0.5, sy + len * 0.4], 4);
    out.push({ t: 'poly', fill: shade(acc, -0.12), pts: outer });
    out.push({ t: 'poly', fill: shade(acc, -0.4), alpha: 0.55, nl: true, pts: smooth([sx - 6, sy, sx + 1, sy + 2, sx - 2 + wave, tip - 6, sx - 12 - flutter + wave, tip - 4, sx - 12 - flutter * 0.5, sy + len * 0.4], 3) });
  }
  if (k === 'finch' || k === 'moth') {
    const flap = Math.sin(t * 2 * Math.PI * 2.2) * 9;
    if (k === 'moth') {
      out.push({ t: 'poly', fill: acc, alpha: 0.9, pts: smooth([sx - 2, sy - 2, sx - 30, sy - 34 - flap, sx - 52, sy - 22 - flap, sx - 48, sy + 2 - flap * 0.4, sx - 16, sy + 10], 4) });
      out.push({ t: 'poly', fill: shade(acc, -0.25), alpha: 0.9, pts: smooth([sx - 4, sy + 8, sx - 34, sy + 14 - flap * 0.3, sx - 40, sy + 34 - flap * 0.2, sx - 14, sy + 26], 4) });
      out.push({ t: 'circle', x: sx - 34, y: sy - 18 - flap * 0.7, r: 7, fill: style.eye, nl: true, glow: acc });
      out.push({ t: 'circle', x: sx - 34, y: sy - 18 - flap * 0.7, r: 3.5, fill: '#1b1446', nl: true });
      out.push({ t: 'circle', x: sx - 26, y: sy + 22 - flap * 0.2, r: 4, fill: '#ffffff', alpha: 0.8, nl: true });
    } else {
      for (let i = 0; i < 4; i++) out.push({ t: 'poly', fill: i % 2 ? shade(suit, -0.18) : shade(suit, -0.05), pts: smooth([sx - 2, sy + i * 3, sx - 26 - i * 4, sy - 22 + i * 10 - flap * (1 - i * 0.2), sx - 34 - i * 3, sy - 14 + i * 11 - flap * (1 - i * 0.2), sx - 10, sy + 12 + i * 2], 3) });
      out.push({ t: 'poly', fill: shade(acc, -0.1), pts: [hipX - 6, hipY - 4, hipX - 24, hipY + 6, hipX - 22, hipY + 10, hipX - 4, hipY + 2] });
    }
  }
  if (k === 'gravity') out.push({ t: 'poly', fill: shade(acc, -0.55), pts: smooth([sx - 9, sy - 3, sx + 6, sy - 2, sx + 3 + wave, sy + 50, sx - 18 + wave, sy + 56, sx - 26, sy + 40], 4) });
  if (k === 'comet') {
    const f = Math.sin(t * 2 * Math.PI * 3);
    out.push({ t: 'poly', fill: '#ff7a1a', alpha: 0.9, glow: '#ff9b2f', pts: smooth([headX - 6, headY - 12, headX - 30, headY - 22 + f * 3, headX - 50, headY - 10 - f * 2, headX - 34, headY - 4, headX - 52, headY + 6 + f * 2, headX - 20, headY + 8], 4) });
    out.push({ t: 'poly', fill: '#ffd36e', alpha: 0.9, nl: true, pts: smooth([headX - 6, headY - 8, headX - 26, headY - 12 + f * 2, headX - 36, headY - 4, headX - 20, headY + 4], 3) });
  }
  if (k === 'lynx') {
    const sw = Math.sin(t * 2 * Math.PI) * 6;
    out.push({ t: 'poly', fill: dark, pts: capsule(hipX - 4, hipY - 4, hipX - 18, hipY - 16 + sw * 0.5, 3, 3.4) });
    out.push({ t: 'poly', fill: dark, pts: capsule(hipX - 18, hipY - 16 + sw * 0.5, hipX - 26, hipY - 34 + sw, 3.4, 3.8) });
    out.push({ t: 'circle', x: hipX - 26, y: hipY - 34 + sw, r: 4, fill: acc });
  }

  // ===== back limbs =====
  const thigh = 17, shin = 17;
  const leg = (hx: number, ang: [number, number], front: boolean) => {
    const j = joint(hx, hipY, ang[0], ang[1], thigh, shin);
    const c = front ? suit : dark;
    const bc = front ? bootC : shade(bootC, -0.2);
    out.push({ t: 'poly', fill: c, pts: capsule(hx, hipY, j.ex, j.ey, limbR * bulk * 1.15, limbR * bulk) });
    out.push({ t: 'poly', fill: c, pts: capsule(j.ex, j.ey, j.hx, j.hy, limbR * bulk * 1.02, limbR * bulk * 0.9) });
    const cuffT = 0.42;
    // boot from mid-shin down, then the cuff and a forward-pointing foot
    out.push({ t: 'poly', fill: bc, pts: capsule(j.ex + (j.hx - j.ex) * cuffT, j.ey + (j.hy - j.ey) * cuffT, j.hx, j.hy, limbR * bulk * 1.02, limbR * bulk * 0.95) });
    out.push({ t: 'poly', fill: front ? shade(bc, 0.2) : bc, nl: !front, pts: capsule(j.ex + (j.hx - j.ex) * cuffT, j.ey + (j.hy - j.ey) * cuffT, j.ex + (j.hx - j.ex) * (cuffT + 0.12), j.ey + (j.hy - j.ey) * (cuffT + 0.12), limbR * bulk * 1.15, limbR * bulk * 1.12) });
    const fa = rad(ang[0] + ang[1]) * 0.35;
    const toe = k === 'finch' ? [j.hx - 3, j.hy, j.hx + 10, j.hy + 3, j.hx + 3, j.hy + 4] : [j.hx - 4.5, j.hy - 2.5, j.hx + 4 + Math.cos(fa) * 6, j.hy - 1 + Math.sin(fa) * 3, j.hx + 5 + Math.cos(fa) * 6, j.hy + 3.5, j.hx - 5, j.hy + 3.5];
    out.push({ t: 'poly', fill: k === 'finch' ? '#ffb238' : bc, pts: toe });
    if (a?.boots === 'rocket') {
      out.push({ t: 'poly', fill: acc, pts: [j.hx - 5, j.hy - 6, j.hx - 11, j.hy, j.hx - 4, j.hy + 1] });
      // little flame jet under the heel while moving or in the air
      if (anim === 'run' || anim === 'jump' || anim === 'fall' || anim === 'rush' || anim === 'dodge' || anim === 'slam' || anim === 'flying') {
        const fl = 7 + Math.sin(t * 2 * Math.PI * 6 + (front ? 0 : 2)) * 3;
        out.push({ t: 'poly', fill: '#ff7a1a', alpha: 0.9, nl: true, glow: '#ff9b2f', pts: [j.hx - 6, j.hy + 3, j.hx + 1, j.hy + 3, j.hx - 3, j.hy + 3 + fl * 1.6] });
        out.push({ t: 'poly', fill: '#ffe066', nl: true, pts: [j.hx - 4.5, j.hy + 3, j.hx - 0.5, j.hy + 3, j.hx - 2.5, j.hy + 3 + fl] });
      }
    }
  };
  const arm = (shx: number, ang: [number, number], front: boolean) => {
    const j = joint(shx, sy + 2, ang[0], ang[1], 14, 13);
    const c = front ? suit : dark;
    out.push({ t: 'poly', fill: c, pts: capsule(shx, sy + 2, j.ex, j.ey, limbR * bulk * 1.05, limbR * bulk * 0.9) });
    out.push({ t: 'poly', fill: c, pts: capsule(j.ex, j.ey, j.hx, j.hy, limbR * bulk * 0.9, limbR * bulk * 0.82) });
    const boxing = a?.gloves === 'power';
    const gr = (k === 'granite' ? 9.5 : 5) * (boxing ? 1.75 : 1);
    const gc = boxing ? (front ? '#e11d2e' : '#a3121f') : front ? gloveC : shade(gloveC, -0.2);
    if (boxing) {
      // big padded boxing glove: white wrist cuff, round red glove, thumb bump and a shine
      const ax = j.hx - j.ex, ay = j.hy - j.ey, al = Math.hypot(ax, ay) || 1, ux = ax / al, uy = ay / al;
      out.push({ t: 'poly', fill: front ? '#f8fafc' : '#cbd5e1', pts: capsule(j.ex + ax * 0.45, j.ey + ay * 0.45, j.hx - ux * 3, j.hy - uy * 3, limbR * bulk * 1.25, limbR * bulk * 1.25) });
      out.push({ t: 'circle', x: j.hx + ux * 2, y: j.hy + uy * 2, r: gr, fill: gc });
      out.push({ t: 'ellipse', x: j.hx + ux * 1 - uy * 5, y: j.hy + uy * 1 + ux * 5, rx: 3.6, ry: 3.6, fill: shade(gc, 0.12) });
      if (front) out.push({ t: 'circle', x: j.hx + ux * 2 - gr * 0.35, y: j.hy + uy * 2 - gr * 0.4, r: gr * 0.32, fill: '#ffffff', alpha: 0.45, nl: true });
      return;
    }
    // glove cuff then fist
    out.push({ t: 'poly', fill: gc, pts: capsule(j.ex + (j.hx - j.ex) * 0.55, j.ey + (j.hy - j.ey) * 0.55, j.hx, j.hy, limbR * bulk * 1.05, limbR * bulk * 1.0) });
    if (k === 'granite') out.push({ t: 'poly', fill: gc, pts: smooth([j.hx - gr, j.hy - gr * 0.4, j.hx - gr * 0.3, j.hy - gr, j.hx + gr * 0.8, j.hy - gr * 0.7, j.hx + gr, j.hy + gr * 0.3, j.hx + gr * 0.2, j.hy + gr, j.hx - gr * 0.8, j.hy + gr * 0.6], 2) });
    else out.push({ t: 'circle', x: j.hx, y: j.hy, r: gr, fill: gc });
    if (front) out.push({ t: 'circle', x: j.hx - gr * 0.3, y: j.hy - gr * 0.35, r: gr * 0.35, fill: '#ffffff', alpha: 0.35, nl: true });
  };
  leg(hipX - 3, P.legB, false);
  arm(sx - 4, P.armB, false);

  // ===== neck + torso =====
  out.push({ t: 'poly', fill: k === 'hero' ? shade(skin, -0.12) : shade(skin, -0.1), pts: capsule(headX - 1, headY + 8, sx, sy - 2, 3.4, 3.8) });
  const tw = 13 * bulk;
  const torso = smooth([
    sx - tw, sy - 1, sx - tw * 0.4, sy - 4, sx + tw * 0.4, sy - 4, sx + tw, sy - 1,
    sx + tw * 0.92, sy + 10, hipX + 9 * bulk, hipY - 3, hipX - 9 * bulk, hipY - 3, sx - tw * 0.92, sy + 10,
  ], 3);
  out.push({ t: 'poly', fill: suit, pts: torso });
  // back-side shading + chest highlight
  out.push({ t: 'poly', fill: dark, alpha: 0.5, nl: true, pts: smooth([sx - tw + 1, sy, sx - tw * 0.4, sy - 2, sx - tw * 0.55, sy + 14, hipX - 5, hipY - 4, hipX - 8.5 * bulk, hipY - 4, sx - tw * 0.9, sy + 10], 3) });
  out.push({ t: 'poly', fill: light, alpha: 0.6, nl: true, pts: smooth([sx + 2, sy - 1, sx + tw * 0.75, sy + 1, sx + tw * 0.65, sy + 9, sx + 3, sy + 6], 3) });
  // suit details per kind
  if (k === 'hero') {
    out.push({ t: 'poly', fill: acc, pts: [sx - 5, sy - 3.5, sx + 5, sy - 3.5, sx, sy + 3] });
    out.push({ t: 'circle', x: sx + 1.5, y: sy + 10, r: 6.2, fill: shade(acc, 0.1) });
    out.push(...emblemShapes(a?.emblem ?? 'star', sx + 1.5, sy + 10, 4.4, shade(suit, -0.25)));
  } else if (k === 'lynx') {
    out.push({ t: 'limb', x1: sx - 6, y1: sy + 2, x2: sx - 2, y2: sy + 12, w: 1.6, fill: acc, nl: true, glow: acc });
    out.push({ t: 'limb', x1: sx - 2, y1: sy + 12, x2: sx + 6, y2: sy + 12, w: 1.6, fill: acc, nl: true });
    out.push({ t: 'circle', x: sx + 6, y: sy + 12, r: 2, fill: acc, nl: true });
    out.push({ t: 'poly', fill: acc, pts: [sx - 4, sy - 3, sx + 6, sy - 3, sx + 1, sy + 5] });
  } else if (k === 'granite') {
    out.push({ t: 'limb', x1: sx - 8, y1: sy + 2, x2: sx - 2, y2: sy + 12, w: 1.4, fill: shade(suit, -0.5), nl: true });
    out.push({ t: 'limb', x1: sx - 2, y1: sy + 12, x2: sx + 6, y2: sy + 8, w: 1.4, fill: shade(suit, -0.5), nl: true });
    out.push({ t: 'poly', fill: acc, pts: smooth([sx - 6, sy + 16, sx + 8, sy + 15, sx + 8, sy + 22, sx - 6, sy + 22], 2) });
  } else if (k === 'gravity') {
    out.push({ t: 'circle', x: sx + 1, y: sy + 9, r: 6.5, fill: acc });
    out.push({ t: 'ellipse', x: sx + 1, y: sy + 9, rx: 9.5, ry: 2.6, fill: shade(acc, 0.3), alpha: 0.9 });
    out.push({ t: 'circle', x: sx + 1, y: sy + 9, r: 3, fill: suit, nl: true });
  } else if (k === 'comet') {
    out.push({ t: 'poly', fill: acc, pts: smooth([sx - 4, sy + 4, sx + 6, sy + 2, sx + 8, sy + 10, sx + 1, sy + 16, sx - 4, sy + 11], 2) });
  } else if (k === 'moth') {
    out.push({ t: 'poly', fill: '#ffffff', alpha: 0.9, pts: smooth([sx - 10, sy - 3, sx, sy + 5, sx + 10, sy - 3, sx + 6, sy - 6, sx, sy - 2, sx - 6, sy - 6], 3) });
  } else if (k === 'finch') {
    out.push({ t: 'poly', fill: '#ffffff', alpha: 0.9, nl: true, pts: smooth([sx - 2, sy + 2, sx + 9, sy + 4, sx + 8, sy + 18, sx, sy + 20], 3) });
  } else if (k === 'bot') {
    out.push({ t: 'rect', x: sx - 6, y: sy + 4, w: 13, h: 9, fill: '#22324a', r: 2 });
    out.push({ t: 'circle', x: sx + 0.5, y: sy + 8.5, r: 2.6, fill: acc, nl: true });
  }
  // belt
  out.push({ t: 'rect', x: hipX - 9.5 * bulk, y: hipY - 6, w: 19 * bulk, h: 5, fill: k === 'hero' ? acc : shade(acc, -0.1), r: 2 });
  out.push({ t: 'rect', x: hipX + 1, y: hipY - 6.6, w: 5, h: 6.2, fill: k === 'hero' ? shade(acc, -0.35) : dark, r: 1.5 });
  // ===== rival armour & signature details =====
  if (k !== 'hero' && k !== 'bot') {
    const glowC = style.eye;
    if (k === 'granite') {
      for (const [x1, y1, x2, y2] of [[sx - 9, sy + 2, sx - 2, sy + 10], [sx - 2, sy + 10, sx + 7, sy + 6], [sx + 2, sy + 14, sx - 4, sy + 22]]) out.push({ t: 'limb', x1, y1, x2, y2, w: 1.8, fill: '#ffb347', nl: true, glow: '#ff8c1a' });
      out.push({ t: 'circle', x: sx + 1, y: sy + 8, r: 3.6, fill: '#ffd36e', nl: true, glow: '#ff8c1a' });
    }
    if (k === 'lynx' || k === 'gravity' || k === 'comet') {
      out.push({ t: 'circle', x: sx + 2, y: sy + 9, r: 4.2, fill: glowC, glow: glowC });
      out.push({ t: 'circle', x: sx + 1, y: sy + 8, r: 1.6, fill: '#ffffff', nl: true });
    }
    if (k === 'moth') {
      // flowing neon gown over the legs
      out.push({ t: 'poly', fill: shade(acc, -0.15), pts: smooth([hipX - 10, hipY - 5, hipX + 11, hipY - 5, hipX + 18 + wave, hipY + 24, hipX + 4, hipY + 28, hipX - 14 + wave, hipY + 26], 4) });
      out.push({ t: 'poly', fill: style.eye, alpha: 0.5, nl: true, pts: smooth([hipX - 2, hipY - 2, hipX + 8, hipY - 2, hipX + 12 + wave, hipY + 22, hipX + 2, hipY + 24], 3), glow: acc });
    }
    if (k === 'comet' && (anim === 'run' || anim === 'rush' || anim === 'dodge')) {
      out.push({ t: 'poly', fill: '#ff7a1a', alpha: 0.85, nl: true, glow: '#ff9b2f', pts: smooth([hipX - 6, hipY + 20, hipX - 34, hipY + 26 + wave, hipX - 46, hipY + 34, hipX - 22, hipY + 34, hipX - 4, hipY + 32], 3) });
    }
  }

  // ===== front limbs =====
  leg(hipX + 3, P.legF, true);
  arm(sx + 4, P.armF, true);
  if (k !== 'hero' && k !== 'bot' && k !== 'moth') {
    // shoulder pauldrons with a bright rim
    const pc = k === 'granite' ? '#6d5a49' : k === 'finch' ? '#e0f4ff' : k === 'comet' ? shade(suit, -0.2) : acc;
    for (const [px2, sz] of [[sx - tw * 0.85, 0.9], [sx + tw * 0.8, 1]] as [number, number][]) {
      out.push({ t: 'poly', fill: pc, pts: smooth([px2 - 8 * sz, sy + 3, px2 - 6 * sz, sy - 5, px2 + 2, sy - 7, px2 + 8 * sz, sy - 3, px2 + 8 * sz, sy + 4, px2, sy + 6], 3) });
      out.push({ t: 'poly', fill: '#ffffff', alpha: 0.5, nl: true, pts: [px2 - 4, sy - 4, px2 + 4, sy - 5, px2 + 1, sy - 2] });
    }
  }
  if (k === 'gravity') {
    for (let i = 0; i < 3; i++) {
      const a = t * 2.2 + (i * Math.PI * 2) / 3;
      out.push({ t: 'circle', x: headX + Math.cos(a) * 22, y: headY - 6 + Math.sin(a) * 7, r: 2.6, fill: style.accent, glow: style.accent });
    }
  }

  // ===== head =====
  out.push(...headShapes(style, P, headX, headY, headR, tilt, skin, a, t));
  return out;
}


function headShapes(style: BodyStyle, P: PoseParams, hx: number, hy: number, R: number, tilt: number, skin: string, a: Appearance | undefined, t: number): Shape[] {
  const out: Shape[] = [];
  const k = style.kind;
  const L = (pts: number[]) => local(pts, hx, hy, tilt);
  const suit = style.main, acc = style.accent;
  // ears / head-top features behind the face
  if (k === 'lynx' || a?.mask === 'cowl') {
    const ec = k === 'lynx' ? suit : shade(suit, -0.35);
    out.push({ t: 'poly', fill: ec, pts: L([-11, -5, -9, -22, -1, -10]) });
    out.push({ t: 'poly', fill: ec, pts: L([2, -11, 9, -23, 12, -5]) });
    if (k === 'lynx') { out.push({ t: 'poly', fill: acc, nl: true, pts: L([-9, -8, -8.5, -17, -4, -10]) }); out.push({ t: 'poly', fill: acc, nl: true, pts: L([4, -11, 8.5, -18, 9.5, -7]) }); }
  }
  if (k === 'hero') out.push({ t: 'ellipse', x: L([-3, 1])[0], y: L([-3, 1])[1], rx: 3, ry: 4, fill: shade(skin, -0.08) });
  // face shape
  if (k === 'granite') out.push({ t: 'poly', fill: skin, pts: L(smooth([-11, -7, -4, -12, 7, -11, 12, -3, 11, 8, 3, 11, -8, 9, -12, 2], 2)) });
  else if (k === 'bot') out.push({ t: 'poly', fill: '#aab4c6', pts: L(smooth([-11, -10, 11, -10, 12, 8, -11, 9], 2)) });
  else if (k === 'gravity') out.push({ t: 'circle', x: hx, y: hy, r: R + 1, fill: skin });
  else out.push({ t: 'poly', fill: skin, pts: L(smooth([-12, -2, -10, -10, -2, -13.5, 7, -12, 12.5, -4, 12.5, 4, 9, 10.5, 2, 12.5, -6, 11, -11.5, 5], 3)) });
  // cheek shading (back of face) + blush
  if (k === 'hero' || k === 'comet') {
    out.push({ t: 'poly', fill: shade(skin, -0.12), alpha: 0.45, nl: true, pts: L(smooth([-12, -2, -10, -10, -6, -9, -8, 2, -6, 10, -11, 5], 3)) });
    out.push({ t: 'ellipse', x: L([7, 5])[0], y: L([7, 5])[1], rx: 2.6, ry: 1.6, fill: '#ff8a8a', alpha: 0.35, nl: true });
  }
  // kind features
  if (k === 'lynx') {
    out.push({ t: 'poly', fill: shade(suit, 0.6), nl: true, pts: L(smooth([3, 2, 12, 1, 13, 8, 6, 11, 2, 8], 3)) });
    out.push({ t: 'poly', fill: '#1b1446', nl: true, pts: L([10.5, 2.5, 13, 2.5, 11.8, 4.2]) });
    for (const dy of [5, 7]) out.push({ t: 'limb', ...pt2(L([9, dy, 18, dy - 1 + (dy - 6)])), w: 0.8, fill: '#ffffff', nl: true });
  }
  if (k === 'finch') {
    out.push({ t: 'poly', fill: '#ffb238', pts: L([9, -2, 22, 2, 9, 5]) });
    out.push({ t: 'poly', fill: '#ff8f1f', nl: true, pts: L([9, 2, 20, 2.5, 9, 5]) });
    out.push({ t: 'poly', fill: acc, pts: L(smooth([-6, -11, -2, -24, 2, -16, 6, -26, 6, -11], 2)) });
  }
  if (k === 'moth') {
    for (const sgn of [-1, 1]) {
      const tip = L([sgn * 9 + 2, -27]);
      out.push({ t: 'limb', ...pt2([...L([sgn * 3 + 2, -11]), ...tip]), w: 1.6, fill: acc });
      out.push({ t: 'poly', fill: acc, alpha: 0.85, pts: smooth([tip[0] - 4, tip[1], tip[0], tip[1] - 4, tip[0] + 4, tip[1], tip[0], tip[1] + 3], 2) });
    }
    out.push({ t: 'poly', fill: '#ffffff', alpha: 0.85, nl: true, pts: L(smooth([-12, 6, -6, 12, 2, 13, 10, 10, 6, 15, -4, 16, -12, 12], 2)) });
  }
  if (k === 'granite') {
    out.push({ t: 'poly', fill: shade(skin, -0.35), pts: L([-10, -6, 12, -5, 11, -1, -10, -2]) });
    out.push({ t: 'limb', ...pt2(L([-4, 4, 0, 9])), w: 1.2, fill: shade(skin, -0.4), nl: true });
  }
  if (k === 'comet') out.push({ t: 'poly', fill: '#ff7a1a', pts: L(smooth([-12, -2, -10, -12, -2, -16, 8, -14, 13, -6, 6, -9, 0, -6, -6, -7], 3)) });
  if (k === 'bot') { out.push({ t: 'rect', x: hx - 1.5, y: hy - 18, w: 3, h: 8, fill: '#8792a8' }); out.push({ t: 'circle', x: hx, y: hy - 19, r: 2.6, fill: acc }); }
  // hero hair (front)
  const masked = a?.mask === 'domino' || a?.mask === 'cowl' || k === 'lynx' || k === 'comet';
  // eyes
  const eyeCol = k === 'hero' ? '#2a1f4d' : style.eye;
  const glow = P.eyes === 'glow';
  if (k === 'gravity' || k === 'bot' || a?.mask === 'visor') {
    const vc = k === 'bot' ? '#22324a' : k === 'gravity' ? '#1b1446' : '#59e3ff';
    out.push({ t: 'poly', fill: vc, alpha: 0.95, pts: L(smooth([-4, -6, 12, -6, 13, 1, 9, 4, -4, 3], 2)) });
    out.push({ t: 'poly', fill: glow ? '#ff3b3b' : k === 'gravity' ? style.eye : '#bff6ff', alpha: 0.9, nl: true, glow: k === 'gravity' ? style.eye : '#59e3ff', pts: L([0, -4, 11, -4, 11, -1, 0, -1]) });
  } else {
    if (masked) {
      const mc = k === 'hero' ? shade(style.accent, -0.55) : k === 'lynx' ? shade(suit, -0.45) : '#3a1f10';
      out.push({ t: 'poly', fill: mc, pts: L(smooth([-6, -5, 1, -7, 7, -6, 13.5, -6.5, 13, 0, 8, 2.5, 4, 0, 0, 2.5, -5, 0], 3)) });
    }
    for (const [ex, far] of [[3.5, true], [9.5, false]] as [number, boolean][]) {
      const [cx, cy] = L([ex, -1]);
      const rw = far ? 2.2 : 2.7, rh = 3.3;
      switch (P.eyes) {
        case 'closed': out.push({ t: 'limb', x1: cx - rw, y1: cy, x2: cx + rw, y2: cy, w: 1.4, fill: '#2a1f4d', nl: true }); break;
        case 'happy': out.push({ t: 'poly', fill: '#2a1f4d', nl: true, pts: [cx - rw, cy + 1, cx, cy - 1.8, cx + rw, cy + 1, cx + rw - 0.6, cy + 1.6, cx, cy - 0.4, cx - rw + 0.6, cy + 1.6] }); break;
        case 'x': out.push({ t: 'limb', x1: cx - 2, y1: cy - 2, x2: cx + 2, y2: cy + 2, w: 1.3, fill: '#2a1f4d', nl: true }); out.push({ t: 'limb', x1: cx - 2, y1: cy + 2, x2: cx + 2, y2: cy - 2, w: 1.3, fill: '#2a1f4d', nl: true }); break;
        default: {
          const h = P.eyes === 'narrow' ? rh * 0.5 : P.eyes === 'wide' ? rh * 1.15 : rh;
          out.push({ t: 'ellipse', x: cx, y: cy, rx: rw, ry: h, fill: '#ffffff', nl: !masked && false });
          const px = cx + (P.eyes === 'side' ? -0.9 : 0.7);
          out.push({ t: 'ellipse', x: px, y: cy + 0.3, rx: rw * 0.62, ry: Math.min(h * 0.75, 2.4), fill: glow ? '#ff3b3b' : eyeCol, nl: true, glow: k !== 'hero' || glow ? (glow ? '#ff3b3b' : style.eye) : undefined });
          out.push({ t: 'circle', x: px + 0.7, y: cy - 0.9, r: 0.75, fill: '#ffffff', nl: true });
          if (glow) out.push({ t: 'circle', x: cx, y: cy, r: rw + 2, fill: '#ff6b6b', alpha: 0.35, nl: true });
        }
      }
    }
  }
  // brows
  if (P.brows !== 'none' && !masked && k !== 'gravity' && k !== 'bot' && a?.mask !== 'visor') {
    const bc = k === 'hero' ? shade(a?.hairColor ?? '#333', -0.25) : shade(suit, -0.5);
    const tiltB = P.brows === 'angry' ? 1.8 : P.brows === 'worried' ? -1.8 : 0;
    const lift = P.brows === 'up' ? -1.6 : 0;
    for (const ex of [3.5, 9.5]) {
      const inner = ex < 6 ? 1 : -1;
      const p = L([ex - 2.4, -5.6 + lift - tiltB * inner * 0.5, ex + 2.4, -5.6 + lift + tiltB * inner * 0.5]);
      out.push({ t: 'limb', x1: p[0], y1: p[1], x2: p[2], y2: p[3], w: 1.5, fill: bc, nl: true });
    }
  }
  // nose + mouth
  if (k === 'hero' || k === 'comet' || k === 'gravity') out.push({ t: 'limb', ...pt2(L([12, 1, 12.6, 3.4])), w: 1.1, fill: shade(skin, -0.3), nl: true });
  if (k !== 'finch' && k !== 'bot') {
    const [mx, my] = L([7.5, 6.5]);
    const mc = '#6b2a3a';
    switch (P.mouth) {
      case 'smile': out.push({ t: 'poly', fill: mc, nl: true, pts: [mx - 3, my - 0.5, mx + 3, my - 1, mx + 1.5, my + 1.6, mx - 1.5, my + 1.4] }); break;
      case 'grin': out.push({ t: 'poly', fill: mc, nl: true, pts: [mx - 3.5, my - 1, mx + 3.5, my - 1.4, mx + 2.2, my + 2.6, mx - 2, my + 2.2] }); out.push({ t: 'rect', x: mx - 3, y: my - 1.2, w: 6, h: 1.3, fill: '#ffffff', nl: true }); break;
      case 'frown': out.push({ t: 'poly', fill: mc, nl: true, pts: [mx - 3, my + 1.4, mx + 3, my + 1.2, mx + 1.5, my - 0.6, mx - 1.5, my - 0.4] }); break;
      case 'open': case 'shout': out.push({ t: 'ellipse', x: mx, y: my + 0.6, rx: P.mouth === 'shout' ? 3 : 2.4, ry: P.mouth === 'shout' ? 2.8 : 2.2, fill: mc, nl: true }); out.push({ t: 'ellipse', x: mx, y: my + 1.8, rx: 1.5, ry: 0.8, fill: '#ff8a8a', nl: true }); break;
      case 'o': out.push({ t: 'circle', x: mx, y: my + 0.5, r: 1.5, fill: mc, nl: true }); break;
      case 'wobbly': out.push({ t: 'poly', fill: mc, nl: true, pts: [mx - 3, my + 0.8, mx - 1.5, my - 0.4, mx, my + 0.8, mx + 1.5, my - 0.4, mx + 3, my + 0.8, mx + 3, my + 1.5, mx - 3, my + 1.5] }); break;
      default: out.push({ t: 'limb', x1: mx - 2.5, y1: my, x2: mx + 2.5, y2: my, w: 1.3, fill: mc, nl: true });
    }
  }
  // helmet / cowl / front hair over the top of the head
  if (k === 'gravity') {
    out.push({ t: 'poly', fill: shade(suit, -0.1), pts: L(smooth([-13, 2, -13, -8, -6, -15, 6, -15, 13, -8, 13, -6, -2, -6, -6, 2], 3)) });
    out.push({ t: 'ellipse', x: L([0, -14])[0], y: L([0, -14])[1], rx: 21, ry: 3.6, fill: style.accent, alpha: 0.9 });
  }
  if (a?.mask === 'cowl') out.push({ t: 'poly', fill: shade(suit, -0.35), pts: L(smooth([-13, 4, -13, -7, -6, -14, 6, -14, 13, -7, 13, -5, 6, -6, -2, -5, -6, 3], 3)) });
  if (k === 'hero' && a && a.mask !== 'cowl') out.push(...hairFront(a.hair, a.hairColor, hx, hy, tilt, t));
  return out;
}

function pt2(p: number[]) { return { x1: p[0], y1: p[1], x2: p[2], y2: p[3] }; }

// ---------- hairstyles (head-local coords, face looks toward +x) ----------
function hairBack(style: string, c: string, hx: number, hy: number, tilt: number, t: number): Shape[] {
  const d = shade(c, -0.22);
  const L = (pts: number[]) => local(pts, hx, hy, tilt);
  const sw = Math.sin(t * 2 * Math.PI) * 2;
  switch (style) {
    case 'long': return [{ t: 'poly', fill: d, pts: L(smooth([-13, -8, -4, -15, 6, -13, 8, 2, 6, 14, 2, 24, -6, 30 + sw * 0.3, -16, 27 + sw, -19, 12, -17, -2], 4)) }];
    case 'ponytail': return [{ t: 'poly', fill: d, pts: L(smooth([-10, -10, -13, -6, -20, 0 + sw, -22, 12 + sw, -18, 22 + sw * 1.5, -15, 12, -14, 0], 4)) }];
    case 'bun': return [{ t: 'circle', x: L([-9, -12])[0], y: L([-9, -12])[1], r: 6.5, fill: d }, { t: 'ellipse', x: L([-7, -9])[0], y: L([-7, -9])[1], rx: 3, ry: 2, fill: shade(c, 0.1), nl: true }];
    case 'curly': return [-12, -6, 0].map((dx, i) => ({ t: 'circle' as const, x: L([dx - 2, 4 + i * 2])[0], y: L([dx - 2, 4 + i * 2])[1], r: 6.5, fill: d }));
    default: return [];
  }
}

function hairFront(style: string, c: string, hx: number, hy: number, tilt: number, t: number): Shape[] {
  const hi = shade(c, 0.35), d = shade(c, -0.18);
  const L = (pts: number[]) => local(pts, hx, hy, tilt);
  const shine = (pts: number[]): Shape => ({ t: 'poly', fill: hi, alpha: 0.55, nl: true, pts: L(smooth(pts, 3)) });
  switch (style) {
    case 'spiky': return [
      { t: 'poly', fill: c, pts: L([-13, 2, -16, -8, -11, -9, -14, -18, -6, -14, -5, -24, 1, -15, 6, -23, 8, -13, 15, -16, 12, -7, 14, -3, 8, -6, 6, -2, 2, -6, -3, -3, -7, -5, -9, 3]) },
      { t: 'poly', fill: hi, alpha: 0.5, nl: true, pts: L([-2, -14, 1, -18, 3, -13]) },
    ];
    case 'long': return [
      { t: 'poly', fill: c, pts: L(smooth([-13, 6, -14, -6, -8, -14, 2, -15.5, 10, -12, 13.5, -5, 11, -4, 6, -8, 1, -6, -4, -8, -8, -2, -9, 8], 4)) },
      shine([-6, -11, 2, -13, 6, -11, 1, -10]),
    ];
    case 'bun': return [
      { t: 'poly', fill: c, pts: L(smooth([-12.5, 2, -13, -7, -7, -13.5, 2, -14.5, 10, -11.5, 13.5, -4, 9, -5.5, 4, -8, -2, -6.5, -7, -5, -10, 3], 4)) },
      shine([-5, -11, 3, -12.5, 7, -10, 1, -9.5]),
    ];
    case 'curly': {
      const out: Shape[] = [];
      const spots = [[-11, -3], [-9, -10], [-3, -14], [4, -14], [10, -10], [12, -4], [-12, 4]];
      spots.forEach(([x, y], i) => { const p = L([x, y]); out.push({ t: 'circle', x: p[0], y: p[1], r: 5.4, fill: i % 2 ? d : c }); });
      const f = L([6, -7]); out.push({ t: 'circle', x: f[0], y: f[1], r: 4, fill: c });
      const g = L([-2, -9]); out.push({ t: 'circle', x: g[0], y: g[1], r: 4.4, fill: d });
      out.push(shine([-4, -15, 2, -16.5, 4, -14, -1, -13.5]));
      return out;
    }
    case 'buzz': return [
      { t: 'poly', fill: c, alpha: 0.9, pts: L(smooth([-12.5, 0, -12, -8, -6, -13.5, 3, -14, 10, -11, 12.5, -6, 8, -7.5, 0, -8.5, -7, -6.5, -10, 1], 4)) },
      ...[[-6, -10], [-1, -11.5], [4, -11], [-9, -5]].map(([x, y]) => { const p = L([x, y]); return { t: 'circle' as const, x: p[0], y: p[1], r: 0.7, fill: hi, nl: true }; }),
    ];
    case 'ponytail': return [
      { t: 'poly', fill: c, pts: L(smooth([-12.5, 0, -13, -8, -7, -14, 2, -15, 10, -12, 13.5, -5, 8, -7, 2, -9, -4, -7, -9, -4, -11, 2], 4)) },
      { t: 'ellipse', x: L([-13, -5])[0], y: L([-13, -5])[1], rx: 2.4, ry: 3, fill: shade(c, -0.4) },
      shine([-6, -12, 2, -13.5, 6, -11.5, 0, -10.5]),
    ];
    case 'mohawk': return [
      { t: 'poly', fill: shade(c, -0.1), alpha: 0.45, nl: true, pts: L(smooth([-12, 0, -11, -9, -3, -13, 8, -12, 12, -6, 6, -8, -6, -7], 3)) },
      { t: 'poly', fill: c, pts: L(smooth([-10, -6, -9, -16, -3, -22, 3, -24, 9, -20, 12, -12, 9, -10, 4, -14, -2, -13, -6, -8], 3)) },
      shine([-3, -19, 3, -21.5, 6, -18, 1, -17]),
    ];
    default: return [ // short
      { t: 'poly', fill: c, pts: L(smooth([-12.5, 3, -13, -7, -7.5, -14, 2, -15, 10, -12, 13.5, -5.5, 11, -4, 7, -8, 3, -6, -2, -8.5, -6, -5, -9, -4, -10, 4], 4)) },
      shine([-6, -11.5, 2, -13.5, 7, -11, 1, -10]),
    ];
  }
}

/** Head-only shapes for HUD portraits (head centre at 40,29 in sprite space). */
export function portraitShapes(style: BodyStyle, a?: Appearance): Shape[] {
  const P = poseFor('neutral', 0);
  const skin = style.skin ?? (style.kind === 'lynx' ? shade(style.main, 0.35) : style.kind === 'granite' ? '#a8927c' : style.kind === 'finch' ? '#eaf7ff' : style.kind === 'moth' ? '#e9d8ff' : style.kind === 'comet' ? '#f2c39a' : style.kind === 'gravity' ? '#d6c3a5' : '#c7cfdd');
  const back = style.kind === 'hero' && a && a.mask !== 'cowl' ? hairBack(a.hair, a.hairColor, 40, 29, 0, 0) : [];
  return [...back, ...headShapes(style, P, 40, 29, style.kind === 'granite' ? 10.5 : 12.5, 0, skin, a, 0)];
}
export function heroPortrait(a: Appearance): Shape[] {
  const pal = PALETTES[a.palette] ?? PALETTES['hero-red'];
  const sh = a.shape ?? 'hero';
  if (sh === 'blob') return blobFace(pal.suit, 40, 31, 15, 0);
  if (sh === 'stickman') return [{ t: 'circle', x: 40, y: 29, r: 12, fill: '#ffffff' }, ...stickFace(40, 29, pal.accent)];
  if (sh !== 'hero' && RIVAL_STYLES[sh]) return portraitShapes(RIVAL_STYLES[sh]);
  return portraitShapes({ kind: 'hero', main: pal.suit, accent: pal.accent, eye: '#1b1b2f', skin: a.skin }, a);
}

// ---------- shapeshifting ----------
/** Rival looks a hero can shapeshift into (same colors as the rivals, see config/bosses). */
export const RIVAL_STYLES: Record<string, BodyStyle> = {};
/** Filled in by combat/styles at start-up, so this file does not depend on the boss list. */
export function registerRivalStyle(id: string, style: BodyStyle) { RIVAL_STYLES[id] = style; }

function blobFace(c: string, cx: number, cy: number, r: number, look: number, closed = false, angry = false): Shape[] {
  const out: Shape[] = [];
  for (const dx of [-0.42, 0.42]) {
    const ex = cx + dx * r + look, ey = cy - r * 0.15;
    if (closed) { out.push({ t: 'limb', x1: ex - 3.5, y1: ey, x2: ex + 3.5, y2: ey, w: 1.6, fill: '#1b1446', nl: true }); continue; }
    out.push({ t: 'ellipse', x: ex, y: ey, rx: r * 0.27, ry: r * 0.33, fill: '#ffffff' });
    out.push({ t: 'circle', x: ex + look * 0.4 + 1, y: ey + 1, r: r * 0.15, fill: '#1b1446', nl: true });
    out.push({ t: 'circle', x: ex + look * 0.4 + 2, y: ey - 1, r: r * 0.05, fill: '#ffffff', nl: true });
    if (angry) out.push({ t: 'limb', x1: ex - 4, y1: ey - r * 0.42 + (dx < 0 ? -1 : 1), x2: ex + 4, y2: ey - r * 0.42 + (dx < 0 ? 1 : -1), w: 1.8, fill: '#1b1446', nl: true });
  }
  out.push({ t: 'poly', fill: shade(c, -0.55), nl: true, pts: smooth([cx - r * 0.3 + look, cy + r * 0.3, cx + r * 0.3 + look, cy + r * 0.3, cx + r * 0.15 + look, cy + r * 0.52, cx - r * 0.15 + look, cy + r * 0.52], 3) });
  out.push({ t: 'ellipse', x: cx + look, y: cy + r * 0.45, rx: r * 0.12, ry: r * 0.06, fill: '#ff8fa3', nl: true });
  return out;
}

/** A wobbly, gooey blob in the suit colors. Arms become goo tendrils when it attacks. */
function blobShapes(suit: string, acc: string, anim: Anim, t: number): Shape[] {
  const P = poseFor(anim, t);
  const out: Shape[] = [];
  const w = Math.sin(t * 2 * Math.PI * 1.3);
  const squash = anim === 'jump' ? -0.12 : anim === 'fall' || anim === 'slam' ? 0.1 : anim === 'duck' || anim === 'crouch' || anim === 'meditate' ? 0.22 : anim === 'hurt' ? 0.08 : 0;
  const lean = P.lean * 0.6;
  const bw = 27 * (1 + squash), top = 50 + 30 * squash + w * 1.5, base = 108;
  const cx = 40 + lean * 0.3;
  const body = smooth([
    cx - bw - 3, base, cx - bw + 2 + w, top + 34, cx - bw * 0.7 + lean, top + 8, cx + lean, top - 2 + w,
    cx + bw * 0.7 + lean, top + 8, cx + bw - 2 - w, top + 34, cx + bw + 3, base, cx + 10, base + 2, cx - 10, base + 2,
  ], 5);
  out.push({ t: 'ellipse', x: cx, y: base, rx: bw + 8, ry: 4, fill: shade(suit, -0.25), alpha: 0.6 });
  // tendril arms (behind, then in front)
  const tend = (ang: [number, number], front: boolean) => {
    const sx0 = cx + (front ? bw * 0.62 : -bw * 0.45) + lean, sy0 = top + 40;
    const j = joint(sx0, sy0, ang[0], ang[1], 15, 14);
    out.push({ t: 'poly', fill: front ? suit : shade(suit, -0.25), pts: capsule(sx0, sy0, j.ex, j.ey, 6, 4.6) });
    out.push({ t: 'poly', fill: front ? suit : shade(suit, -0.25), pts: capsule(j.ex, j.ey, j.hx, j.hy, 4.6, 5.6) });
    out.push({ t: 'circle', x: j.hx, y: j.hy, r: 4.4, fill: front ? shade(suit, 0.15) : shade(suit, -0.15), nl: true });
  };
  tend(P.armB, false);
  out.push({ t: 'poly', fill: suit, pts: body });
  // goo shine, accent spots and drips
  out.push({ t: 'poly', fill: '#ffffff', alpha: 0.35, nl: true, pts: smooth([cx - bw * 0.5 + lean, top + 12, cx - bw * 0.15 + lean, top + 6, cx - bw * 0.3 + lean, top + 22, cx - bw * 0.6 + lean, top + 28], 3) });
  out.push({ t: 'circle', x: cx + bw * 0.45 + lean * 0.5, y: top + 40, r: 3.4, fill: acc, alpha: 0.85, nl: true });
  out.push({ t: 'circle', x: cx - bw * 0.35, y: top + 48, r: 2.4, fill: acc, alpha: 0.7, nl: true });
  const drip = 3 + (Math.sin(t * 2 * Math.PI * 0.7) + 1) * 3;
  out.push({ t: 'poly', fill: suit, nl: true, pts: smooth([cx + bw * 0.55 - 3, base - 4, cx + bw * 0.55 + 3, base - 4, cx + bw * 0.55 + 1.5, base + drip, cx + bw * 0.55 - 1.5, base + drip], 2) });
  tend(P.armF, true);
  const look = anim === 'punch' || anim === 'rush' || anim === 'power' ? 3 : anim === 'dodge' ? -2 : 1;
  out.push(...blobFace(suit, cx + 2 + lean, top + 19, 19, look, P.eyes === 'closed', P.brows === 'angry'));
  return out;
}

function stickFace(cx: number, cy: number, acc: string): Shape[] {
  return [
    { t: 'circle', x: cx + 3, y: cy - 2, r: 1.8, fill: '#1b1446', nl: true },
    { t: 'circle', x: cx + 8, y: cy - 2, r: 1.8, fill: '#1b1446', nl: true },
    { t: 'limb', x1: cx + 3, y1: cy + 5, x2: cx + 8, y2: cy + 4, w: 1.4, fill: '#1b1446', nl: true },
    // headband in the accent colour with flapping tails
    { t: 'rect', x: cx - 12, y: cy - 9, w: 24, h: 4, fill: acc, r: 1.5 },
    { t: 'poly', fill: acc, pts: [cx - 11, cy - 8, cx - 20, cy - 12, cx - 19, cy - 7] },
  ];
}

/** A quick-sketch stick figure: thick ink lines, round head, a headband in the accent color. */
function stickShapes(suit: string, acc: string, anim: Anim, t: number): Shape[] {
  const P = poseFor(anim, t);
  const out: Shape[] = [];
  const ink = '#1b1446', W = 3.6;
  const bob = P.bob;
  const sx = 40 + P.lean * 0.5, sy = 47 + bob;
  const hipX = 40, hipY = P.sitting ? 84 : 74 + bob;
  const headX = 40 + P.lean * 0.95, headY = 30 + bob;
  const line = (x1: number, y1: number, x2: number, y2: number, c = ink, w = W, nl = true) => out.push({ t: 'limb', x1, y1, x2, y2, w, fill: c, nl });
  const limb = (x: number, y: number, ang: [number, number], l1: number, l2: number, c: string) => { const j = joint(x, y, ang[0], ang[1], l1, l2); line(x, y, j.ex, j.ey, c); line(j.ex, j.ey, j.hx, j.hy, c); return j; };
  limb(hipX - 2, hipY, P.legB, 17, 17, shade(ink, 0.25));
  limb(sx - 2, sy, P.armB, 14, 13, shade(ink, 0.25));
  line(headX, headY + 11, hipX, hipY);
  // a little suit-colored scarf so it still matches the hero's colors
  out.push({ t: 'poly', fill: suit, pts: [sx - 6, sy - 3, sx + 6, sy - 3, sx + 3, sy + 2, sx - 3, sy + 2] });
  out.push({ t: 'poly', fill: suit, pts: [sx - 4, sy, sx - 14, sy + 6 + Math.sin(t * 2 * Math.PI * 2) * 2, sx - 8, sy + 9] });
  const lj = limb(hipX + 2, hipY, P.legF, 17, 17, ink);
  out.push({ t: 'ellipse', x: lj.hx + 2, y: lj.hy, rx: 4, ry: 2, fill: ink, nl: true });
  const aj = limb(sx + 2, sy, P.armF, 14, 13, ink);
  out.push({ t: 'circle', x: aj.hx, y: aj.hy, r: 2.6, fill: ink, nl: true });
  out.push({ t: 'circle', x: headX, y: headY, r: 11, fill: '#ffffff' });
  out.push(...stickFace(headX, headY, acc));
  return out;
}
