import type Phaser from 'phaser';
import type { Shape } from '../art/hero';

const hex = (c: string) => parseInt(c.slice(1, 7), 16);

/** Draw sprite shapes (80×110 box, feet at 40,108) at world (x, feetY), facing ±1. */
export function drawShapes(g: Phaser.GameObjects.Graphics, shapes: Shape[], x: number, feetY: number, facing: number, scale = 1, opts: { alpha?: number; flash?: boolean } = {}) {
  const X = (sx: number) => x + facing * (sx - 40) * scale;
  const Y = (sy: number) => feetY + (sy - 108) * scale;
  const A = opts.alpha ?? 1;
  const ink = 0x1b1446;
  for (const s of shapes) {
    const fill = opts.flash ? 0xffffff : s.t === 'circle' && s.fill === '#00000000' ? -1 : hex(s.fill);
    if (fill < 0) continue;
    const a = (s.alpha ?? 1) * A;
    const lw = s.nl ? 0 : 1.5 * scale;
    switch (s.t) {
      case 'rect': {
        const x1 = facing > 0 ? X(s.x) : X(s.x + s.w);
        g.fillStyle(fill, a); g.lineStyle(lw, ink, a);
        g.fillRoundedRect(x1, Y(s.y), s.w * scale, s.h * scale, Math.min((s.r ?? 0) * scale, (s.h * scale) / 2, (s.w * scale) / 2));
        if (lw) g.strokeRoundedRect(x1, Y(s.y), s.w * scale, s.h * scale, Math.min((s.r ?? 0) * scale, (s.h * scale) / 2, (s.w * scale) / 2));
        break;
      }
      case 'circle': g.fillStyle(fill, a); g.fillCircle(X(s.x), Y(s.y), s.r * scale); if (lw) { g.lineStyle(lw, ink, a); g.strokeCircle(X(s.x), Y(s.y), s.r * scale); } break;
      case 'ellipse': g.fillStyle(fill, a); g.fillEllipse(X(s.x), Y(s.y), s.rx * 2 * scale, s.ry * 2 * scale); if (lw) { g.lineStyle(lw, ink, a); g.strokeEllipse(X(s.x), Y(s.y), s.rx * 2 * scale, s.ry * 2 * scale); } break;
      case 'poly': {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < s.pts.length; i += 2) pts.push({ x: X(s.pts[i]), y: Y(s.pts[i + 1]) });
        g.fillStyle(fill, a); g.fillPoints(pts, true); if (lw) { g.lineStyle(lw, ink, a); g.strokePoints(pts, true); }
        break;
      }
      case 'limb': {
        const w = s.w * scale;
        if (!s.nl && s.w > 2) { g.lineStyle(w + 2.4 * scale, ink, a); g.lineBetween(X(s.x1), Y(s.y1), X(s.x2), Y(s.y2)); g.fillStyle(ink, a); g.fillCircle(X(s.x1), Y(s.y1), (w + 2.4 * scale) / 2); g.fillCircle(X(s.x2), Y(s.y2), (w + 2.4 * scale) / 2); }
        g.lineStyle(w, fill, a); g.lineBetween(X(s.x1), Y(s.y1), X(s.x2), Y(s.y2));
        g.fillStyle(fill, a); g.fillCircle(X(s.x1), Y(s.y1), w / 2); g.fillCircle(X(s.x2), Y(s.y2), w / 2);
        break;
      }
    }
  }
}

/** Danger-zone telegraph: a soft glowing area that brightens as the attack charges, with thin moving
 *  diagonal hatching (a shape cue, not only color) and corner brackets instead of a hard box. */
export function stripes(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha: number, phase = 0) {
  const a = Math.max(0, Math.min(1, alpha));
  const r = Math.min(10, w / 4, h / 4);
  // soft outer glow and inner fill
  g.fillStyle(color, a * 0.16); g.fillRoundedRect(x - 5, y - 5, w + 10, h + 10, r + 4);
  g.fillStyle(color, a * 0.24); g.fillRoundedRect(x, y, w, h, r);
  // brighter band along the floor edge of the zone
  g.fillStyle(color, a * 0.35); g.fillRoundedRect(x, y + h - Math.min(8, h / 3), w, Math.min(8, h / 3), Math.min(4, r));
  // thin diagonal hatching that drifts slowly
  const step = 16, off = (phase * 22) % step;
  g.lineStyle(2, 0xffffff, a * 0.22);
  for (let k = -h + off; k < w; k += step) {
    let x1 = x + k, y1 = y + h, x2 = x + k + h, y2 = y;
    if (x1 < x) { y1 -= x - x1; x1 = x; }
    if (x2 > x + w) { y2 += x2 - (x + w); x2 = x + w; }
    if (x2 > x1) g.lineBetween(x1, y1, x2, y2);
  }
  // corner brackets
  const L = Math.min(16, w / 3, h / 2);
  g.lineStyle(3, color, Math.min(1, a + 0.35));
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]] as const) {
    g.lineBetween(cx, cy, cx + dx * L, cy); g.lineBetween(cx, cy, cx, cy + dy * L);
  }
}

/** Safe spot: a soft green column of light with a glowing floor marker. */
export function safeZone(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, phase = 0) {
  const p = 0.75 + 0.25 * Math.sin(phase * 6);
  g.fillStyle(0x34d399, 0.1 * p); g.fillRoundedRect(x - 6, y - 40, w + 12, h + 40, 12);
  g.fillStyle(0x6ee7b7, 0.2 * p); g.fillRoundedRect(x + w * 0.15, y - 30, w * 0.7, h + 30, 10);
  g.fillStyle(0xd1fae5, 0.55 * p); g.fillEllipse(x + w / 2, y + h, w, 12);
  g.lineStyle(2, 0xffffff, 0.7 * p); g.strokeEllipse(x + w / 2, y + h, w, 12);
}

export function chevrons(g: Phaser.GameObjects.Graphics, x1: number, x2: number, y: number, color: number, alpha: number, phase = 0) {
  const dir = x2 > x1 ? 1 : -1;
  g.lineStyle(4, color, alpha);
  const len = Math.abs(x2 - x1);
  for (let d = (phase * 120) % 40; d < len; d += 40) {
    const cx = x1 + dir * d;
    g.lineBetween(cx, y - 8, cx + dir * 10, y);
    g.lineBetween(cx + dir * 10, y, cx, y + 8);
  }
}
