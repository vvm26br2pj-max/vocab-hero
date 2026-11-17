// Painted arena backdrops (Canvas2D: gradients, glows, silhouettes). Drawn once per fight into a texture.
import { GROUND, H, W } from './arenas';

function rng(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

function sky(ctx: CanvasRenderingContext2D, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, a = 0.6) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
}
function stars(ctx: CanvasRenderingContext2D, n: number, maxY: number, r: () => number) {
  for (let i = 0; i < n; i++) { ctx.globalAlpha = 0.3 + r() * 0.7; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r() * W, r() * maxY, r() * 1.6 + 0.3, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function floor(ctx: CanvasRenderingContext2D, top: string, bottom: string, line: string) {
  const g = ctx.createLinearGradient(0, GROUND, 0, H);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
  for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, GROUND + 6); ctx.lineTo(x + 30, GROUND + 6); ctx.lineTo(x + 18, H); ctx.lineTo(x - 14, H); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = line; ctx.fillRect(0, GROUND, W, 4);
  ctx.fillStyle = '#1b1446'; ctx.fillRect(0, GROUND - 2, W, 3);
}
function vignette(ctx: CanvasRenderingContext2D) {
  const g = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,4,30,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function buildings(ctx: CanvasRenderingContext2D, r: () => number, base: number, minH: number, maxH: number, wMin: number, wMax: number, color: string, windows: string[] | null, winA = 0.9) {
  let x = -20;
  while (x < W + 20) {
    const w = wMin + r() * (wMax - wMin), h = minH + r() * (maxH - minH);
    ctx.fillStyle = color; ctx.fillRect(x, base - h, w, h);
    if (r() > 0.6) { ctx.fillRect(x + w * 0.3, base - h - 18, w * 0.4, 18); ctx.fillRect(x + w * 0.48, base - h - 34, 3, 16); }
    if (windows) for (let wy = base - h + 10; wy < base - 12; wy += 15) for (let wx = x + 6; wx < x + w - 10; wx += 11) if (r() > 0.5) { ctx.globalAlpha = winA * (0.5 + r() * 0.5); ctx.fillStyle = windows[Math.floor(r() * windows.length)]; ctx.fillRect(wx, wy, 6, 8); ctx.globalAlpha = 1; }
    x += w + 4 + r() * 10;
  }
}

export function paintArena(ctx: CanvasRenderingContext2D, key: string) {
  const r = rng(11 + key.length * 97);
  ctx.save();
  switch (key) {
    case 'rooftop': {
      sky(ctx, [[0, '#1e1b4b'], [0.55, '#6d28d9'], [0.85, '#f472b6'], [1, '#fdba74']]);
      stars(ctx, 70, 200, r);
      glow(ctx, 760, 150, 120, '#fde68a', 0.7); ctx.fillStyle = '#fff7d6'; ctx.beginPath(); ctx.arc(760, 150, 40, 0, 7); ctx.fill();
      buildings(ctx, r, GROUND - 30, 150, 300, 40, 80, '#3b2a7a', ['#c4b5fd'], 0.5);
      buildings(ctx, r, GROUND, 110, 230, 60, 110, '#1e1747', ['#fde68a', '#93c5fd', '#f9a8d4'], 0.95);
      // neon billboard
      ctx.save(); ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 18; ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 4; ctx.strokeRect(560, 160, 150, 60);
      ctx.font = 'bold 30px Bangers, Impact, sans-serif'; ctx.fillStyle = '#a5f3fc'; ctx.fillText('WORD UP!', 578, 202); ctx.restore();
      floor(ctx, '#3b3f63', '#141530', '#8b93c9');
      break;
    }
    case 'quarry': {
      sky(ctx, [[0, '#7c2d12'], [0.4, '#f97316'], [0.8, '#fdba74'], [1, '#fde68a']]);
      glow(ctx, 230, 170, 160, '#fff3c4', 0.8); ctx.fillStyle = '#fff1c1'; ctx.beginPath(); ctx.arc(230, 170, 46, 0, 7); ctx.fill();
      const layer = (c: string, base: number, amp: number, seed: number) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, GROUND); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, base - Math.abs(Math.sin(x * 0.012 + seed)) * amp - r() * 18); ctx.lineTo(W, GROUND); ctx.fill(); };
      layer('#b45309', 300, 110, 1); layer('#92400e', 360, 90, 2.2); layer('#6b2f0c', 420, 50, 4.1);
      ctx.strokeStyle = 'rgba(40,15,5,0.35)'; ctx.lineWidth = 3; for (let y = 370; y < GROUND; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 8); ctx.stroke(); }
      // crane + hanging rocks
      ctx.fillStyle = '#3f1d0b'; ctx.fillRect(830, 120, 14, 300); ctx.fillRect(700, 120, 160, 12); ctx.strokeStyle = '#3f1d0b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(720, 132); ctx.lineTo(720, 210); ctx.stroke(); ctx.fillStyle = '#78716c'; ctx.beginPath(); ctx.arc(720, 222, 16, 0, 7); ctx.fill();
      floor(ctx, '#8b5e3c', '#3b2414', '#d6a26f');
      break;
    }
    case 'lab': {
      sky(ctx, [[0, '#082f49'], [0.5, '#0e7490'], [1, '#a5f3fc']]);
      for (let i = 0; i < 6; i++) {
        const x = 30 + i * 160;
        glow(ctx, x + 50, 230, 110, '#67e8f9', 0.35);
        const g = ctx.createLinearGradient(x, 0, x + 100, 0); g.addColorStop(0, 'rgba(165,243,252,0.25)'); g.addColorStop(0.5, 'rgba(236,254,255,0.6)'); g.addColorStop(1, 'rgba(165,243,252,0.25)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, 110, 100, 250, 20); ctx.fill();
        ctx.strokeStyle = '#155e75'; ctx.lineWidth = 5; ctx.stroke();
        for (let b = 0; b < 6; b++) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x + 20 + r() * 60, 150 + r() * 190, 2 + r() * 4, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#164e63'; ctx.fillRect(x - 6, 355, 112, 18); ctx.fillRect(x - 6, 96, 112, 16);
      }
      ctx.fillStyle = '#0c4a6e'; ctx.fillRect(0, 60, W, 14);
      for (let i = 0; i < 24; i++) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; const x = i * 40 + r() * 10; ctx.beginPath(); ctx.moveTo(x, 74); ctx.lineTo(x + 8, 74); ctx.lineTo(x + 4, 90 + r() * 18); ctx.fill(); }
      floor(ctx, '#6b93b0', '#1e3a5f', '#e0f2fe');
      break;
    }
    case 'theater': {
      sky(ctx, [[0, '#0b0217'], [0.6, '#3b0764'], [1, '#86198f']]);
      for (let i = 0; i < 5; i++) { const x = 160 + i * 160; const g = ctx.createLinearGradient(x, 0, x, GROUND); g.addColorStop(0, 'rgba(244,114,182,0.35)'); g.addColorStop(1, 'rgba(244,114,182,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 10, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(x + 90, GROUND); ctx.lineTo(x - 90, GROUND); ctx.fill(); }
      const curtain = (x: number, dir: number) => { for (let i = 0; i < 8; i++) { const g = ctx.createLinearGradient(x + dir * i * 11, 0, x + dir * (i * 11 + 11), 0); g.addColorStop(0, '#9f1239'); g.addColorStop(0.5, '#e11d48'); g.addColorStop(1, '#881337'); ctx.fillStyle = g; ctx.fillRect(Math.min(x + dir * i * 11, x + dir * (i * 11 + 11)), 0, 11, H); } };
      curtain(0, 1); curtain(W, -1);
      ctx.fillStyle = '#881337'; ctx.fillRect(0, 0, W, 40); for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.arc(x + 20, 40, 20, 0, Math.PI); ctx.fill(); }
      for (let i = 0; i < 16; i++) { ctx.save(); ctx.shadowColor = i % 2 ? '#fde047' : '#f472b6'; ctx.shadowBlur = 12; ctx.fillStyle = i % 2 ? '#fef08a' : '#f9a8d4'; ctx.beginPath(); ctx.arc(110 + i * 50, 70, 5, 0, 7); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = '#1e0526'; for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.arc(18 + i * 38, H - 8, 22, 0, 7); ctx.fill(); }
      floor(ctx, '#4a1d3b', '#1a0614', '#f472b6');
      break;
    }
    case 'observatory': {
      sky(ctx, [[0, '#020617'], [0.6, '#1e1b4b'], [1, '#4c1d95']]);
      glow(ctx, 300, 160, 260, '#7c3aed', 0.45); glow(ctx, 690, 120, 220, '#db2777', 0.3);
      stars(ctx, 220, 380, r);
      glow(ctx, 170, 110, 80, '#fef3c7', 0.7); ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.arc(170, 110, 34, 0, 7); ctx.fill(); ctx.fillStyle = '#e7d9a8'; ctx.beginPath(); ctx.arc(160, 102, 8, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(183, 121, 5, 0, 7); ctx.fill();
      // ringed planet
      ctx.save(); ctx.translate(800, 150); ctx.rotate(-0.3); ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fill(); ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 52, 12, 0, 0, 7); ctx.stroke(); ctx.restore();
      // dome + telescope
      ctx.fillStyle = '#1e1b4b'; ctx.beginPath(); ctx.ellipse(W / 2, GROUND, 380, 150, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#312e81'; ctx.beginPath(); ctx.arc(W / 2, GROUND - 60, 90, Math.PI, 0); ctx.fill(); ctx.save(); ctx.translate(W / 2, GROUND - 120); ctx.rotate(-0.6); ctx.fillStyle = '#6366f1'; ctx.fillRect(-12, -80, 24, 90); ctx.restore();
      floor(ctx, '#312e81', '#0b0a24', '#facc15');
      break;
    }
    case 'foundry': {
      sky(ctx, [[0, '#1c0606'], [0.55, '#7c2d12'], [1, '#ea580c']]);
      glow(ctx, W / 2, GROUND, 420, '#f97316', 0.55);
      for (let i = 0; i < 6; i++) { const x = 20 + i * 170; const g = ctx.createLinearGradient(x, 0, x + 50, 0); g.addColorStop(0, '#1c0a05'); g.addColorStop(0.5, '#3f1d0b'); g.addColorStop(1, '#1c0a05'); ctx.fillStyle = g; ctx.fillRect(x, 70, 50, 360); ctx.fillStyle = '#5a2a14'; ctx.fillRect(x - 8, 62, 66, 16); }
      ctx.fillStyle = '#1c0a05'; ctx.fillRect(0, 150, W, 12); ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = 4; for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 150); ctx.lineTo(x + 20, 162); ctx.stroke(); }
      // molten bucket pouring
      ctx.fillStyle = '#292524'; ctx.beginPath(); ctx.moveTo(150, 175); ctx.lineTo(230, 175); ctx.lineTo(215, 230); ctx.lineTo(165, 230); ctx.fill();
      ctx.save(); ctx.shadowColor = '#fb923c'; ctx.shadowBlur = 20; const lg = ctx.createLinearGradient(0, 230, 0, GROUND); lg.addColorStop(0, '#fde047'); lg.addColorStop(1, '#ea580c'); ctx.fillStyle = lg; ctx.fillRect(184, 230, 12, GROUND - 260); ctx.restore();
      floor(ctx, '#3b2a24', '#120806', '#fb923c');
      break;
    }
    case 'carnival': {
      sky(ctx, [[0, '#0ea5e9'], [0.55, '#7dd3fc'], [1, '#fbcfe8']]);
      glow(ctx, 790, 110, 150, '#fff7c2', 0.8); ctx.fillStyle = '#fff3a8'; ctx.beginPath(); ctx.arc(790, 110, 40, 0, 7); ctx.fill();
      // fluffy clouds
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const [cx, cy, s] of [[140, 90, 1], [420, 60, 0.8], [600, 150, 0.7]]) { for (const [dx, dy, rr] of [[0, 0, 26], [28, -10, 30], [58, 0, 24], [30, 10, 24]]) { ctx.beginPath(); ctx.arc(cx + dx * s, cy + dy * s, rr * s, 0, 7); ctx.fill(); } }
      // Ferris wheel
      ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(250, 260, 110, 0, 7); ctx.stroke();
      ctx.lineWidth = 3; for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; ctx.beginPath(); ctx.moveTo(250, 260); ctx.lineTo(250 + Math.cos(a) * 110, 260 + Math.sin(a) * 110); ctx.stroke(); const cols = ['#f43f5e', '#facc15', '#22c55e', '#38bdf8']; ctx.fillStyle = cols[i % 4]; ctx.fillRect(250 + Math.cos(a) * 110 - 9, 260 + Math.sin(a) * 110, 18, 14); }
      ctx.fillStyle = '#5b21b6'; ctx.beginPath(); ctx.moveTo(250, 260); ctx.lineTo(200, GROUND); ctx.lineTo(214, GROUND); ctx.lineTo(250, 285); ctx.lineTo(286, GROUND); ctx.lineTo(300, GROUND); ctx.fill();
      // striped tents
      const tent = (x: number, w: number, h: number, a: string, b: string) => {
        for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? a : b; ctx.beginPath(); ctx.moveTo(x + w / 2, GROUND - h); ctx.lineTo(x + (i * w) / 6, GROUND - h * 0.45); ctx.lineTo(x + ((i + 1) * w) / 6, GROUND - h * 0.45); ctx.fill(); ctx.fillRect(x + (i * w) / 6, GROUND - h * 0.45, w / 6, h * 0.45); }
        ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(x + w / 2, GROUND - h - 22); ctx.lineTo(x + w / 2 + 16, GROUND - h - 15); ctx.lineTo(x + w / 2, GROUND - h - 8); ctx.fill(); ctx.fillRect(x + w / 2 - 1, GROUND - h - 22, 2, 22);
      };
      tent(520, 170, 170, '#ef4444', '#fff1f2'); tent(740, 140, 130, '#2563eb', '#eff6ff');
      // bunting
      ctx.strokeStyle = '#1b1446'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 40); ctx.quadraticCurveTo(W / 2, 90, W, 40); ctx.stroke();
      for (let x = 20; x < W; x += 40) { const y = 40 + (50 * 4 * (x / W) * (1 - x / W)); ctx.fillStyle = ['#f43f5e', '#facc15', '#22c55e', '#38bdf8', '#a855f7'][Math.floor(x / 40) % 5]; ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.lineTo(x, y + 18); ctx.fill(); }
      floor(ctx, '#a16207', '#422006', '#fde68a');
      break;
    }
    default: {
      sky(ctx, [[0, '#312e81'], [1, '#93c5fd']]);
      buildings(ctx, r, GROUND, 120, 260, 50, 100, '#4f46e5', ['#e0e7ff'], 0.6);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GROUND); ctx.stroke(); }
      ctx.fillStyle = '#facc15'; ctx.fillRect(56, GROUND - 60, 4, 60); ctx.fillRect(888, GROUND - 60, 4, 60);
      ctx.beginPath(); ctx.moveTo(60, GROUND - 60); ctx.lineTo(84, GROUND - 52); ctx.lineTo(60, GROUND - 44); ctx.fill(); ctx.beginPath(); ctx.moveTo(892, GROUND - 60); ctx.lineTo(916, GROUND - 52); ctx.lineTo(892, GROUND - 44); ctx.fill();
      floor(ctx, '#4b5578', '#1e2338', '#c7d2fe');
    }
  }
  vignette(ctx);
  ctx.restore();
  void hex;
}
