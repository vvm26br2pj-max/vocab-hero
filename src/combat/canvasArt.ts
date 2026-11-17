import Phaser from 'phaser';
import { shade, type Shape } from '../art/hero';

/** Sprite-space window painted onto each character canvas (symmetric around the body centre x=40). */
const X0 = -50, X1 = 130, Y0 = -40, Y1 = 116;
const RES = 2.4;
const CW = Math.ceil((X1 - X0) * RES), CH = Math.ceil((Y1 - Y0) * RES);
const INK = '#1b1446';

function bbox(s: Shape): [number, number] {
  switch (s.t) {
    case 'rect': return [s.y, s.y + s.h];
    case 'circle': return [s.y - s.r, s.y + s.r];
    case 'ellipse': return [s.y - s.ry, s.y + s.ry];
    case 'poly': { let lo = Infinity, hi = -Infinity; for (let i = 1; i < s.pts.length; i += 2) { lo = Math.min(lo, s.pts[i]); hi = Math.max(hi, s.pts[i]); } return [lo, hi]; }
    case 'limb': return [Math.min(s.y1, s.y2), Math.max(s.y1, s.y2)];
  }
}

/** Paint shapes with top-lit gradients, ink outlines and optional glow. */
export function paintShapes(ctx: CanvasRenderingContext2D, shapes: Shape[], flash = false) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const s of shapes) {
    if (s.t === 'circle' && s.fill === '#00000000') continue;
    const a = s.alpha ?? 1;
    ctx.globalAlpha = a;
    let fill: string | CanvasGradient = flash ? '#ffffff' : s.fill;
    if (!flash && s.t !== 'limb' && !s.nl) {
      const [y0, y1] = bbox(s);
      if (y1 - y0 > 2.5) {
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, shade(s.fill, 0.3));
        g.addColorStop(0.45, s.fill);
        g.addColorStop(1, shade(s.fill, -0.28));
        fill = g;
      }
    }
    const glow = (s as any).glow as string | undefined;
    if (glow && !flash) { ctx.shadowColor = glow; ctx.shadowBlur = 10; } else { ctx.shadowBlur = 0; }
    ctx.fillStyle = fill;
    ctx.beginPath();
    switch (s.t) {
      case 'rect': { const r = Math.min(s.r ?? 0, s.w / 2, s.h / 2); ctx.roundRect(s.x, s.y, s.w, s.h, r); break; }
      case 'circle': ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); break;
      case 'ellipse': ctx.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, Math.PI * 2); break;
      case 'poly': ctx.moveTo(s.pts[0], s.pts[1]); for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i], s.pts[i + 1]); ctx.closePath(); break;
      case 'limb': {
        if (!s.nl && s.w > 2) { ctx.strokeStyle = INK; ctx.lineWidth = s.w + 2.4; ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); ctx.beginPath(); }
        ctx.strokeStyle = flash ? '#ffffff' : s.fill; ctx.lineWidth = s.w; ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
        continue;
      }
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    if (!s.nl) { ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

let texSeq = 0;
/** A character drawn into its own high-resolution canvas texture each frame. */
export class CharSprite {
  readonly img: Phaser.GameObjects.Image;
  private tex: Phaser.Textures.CanvasTexture;
  constructor(scene: Phaser.Scene, depth = 3) {
    const key = `char-${++texSeq}`;
    this.tex = scene.textures.createCanvas(key, CW, CH)!;
    this.img = scene.add.image(0, 0, key).setDepth(depth).setOrigin(0.5, (108 - Y0) / (Y1 - Y0));
  }
  draw(shapes: Shape[], x: number, feetY: number, facing: number, scale: number, opts: { alpha?: number; flash?: boolean; tint?: number } = {}) {
    const ctx = this.tex.getContext();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, CW, CH);
    ctx.setTransform(RES, 0, 0, RES, -X0 * RES, -Y0 * RES);
    paintShapes(ctx, shapes, opts.flash);
    this.tex.refresh();
    this.img.setVisible(true).setPosition(x, feetY).setScale(scale / RES).setFlipX(facing < 0).setAlpha(opts.alpha ?? 1);
    if (opts.tint !== undefined) this.img.setTint(opts.tint); else this.img.clearTint();
  }
  hide() { this.img.setVisible(false); }
  destroy() { this.img.destroy(); this.tex.destroy(); }
}
