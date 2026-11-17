// Loading splash: the Mansfield Games logo (same intro as Math & Might). The giant M is stamped down with a thud
// and a puff of dust, then the name appears and the splash fades away. Click, tap or any key skips it.
import logo from './logo';

export function runSplash() {
  const el = document.getElementById('splash');
  if (!el) return;
  const CREAM = [246, 236, 218], BG = '#0b0b0b';
  const SPLIT = 0.596; // the M is above this fraction of the logo's height, the words below
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas'); el.appendChild(cv);
  const skip = document.createElement('div'); skip.className = 'splash-skip'; skip.textContent = 'Click to skip'; el.appendChild(skip);
  const g = cv.getContext('2d')!;
  let W = 0, H = 0, dpr = 1, iw = 0, ih = 0, t0 = 0, done = false, thudDone = false;
  let mImg: HTMLCanvasElement, wImg: HTMLCanvasElement;
  const dust: { x: number; y: number; vx: number; vy: number; r: number; life: number; age: number; c: string }[] = [];

  const size = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = el.clientWidth; H = el.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  };
  // Turn the dark background of the JPEG into transparency, and cut the logo into the M and the words.
  const prepare = (img: HTMLImageElement) => {
    iw = img.naturalWidth; ih = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = iw; c.height = ih; const x = c.getContext('2d')!;
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, iw, ih), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const l = (p[i] + p[i + 1] + p[i + 2]) / 3;
      p[i] = CREAM[0]; p[i + 1] = CREAM[1]; p[i + 2] = CREAM[2];
      p[i + 3] = Math.max(0, Math.min(255, ((l - 40) * 255) / 170));
    }
    x.putImageData(d, 0, 0);
    const cut = Math.round(ih * SPLIT);
    mImg = document.createElement('canvas'); mImg.width = iw; mImg.height = cut; mImg.getContext('2d')!.drawImage(c, 0, 0);
    wImg = document.createElement('canvas'); wImg.width = iw; wImg.height = ih - cut; wImg.getContext('2d')!.drawImage(c, 0, -cut);
  };
  const thud = () => {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext; if (!AC) return;
      const a: AudioContext = new AC(); if (a.state !== 'running') { a.close?.(); return; } // browsers block sound before the first click
      const o = a.createOscillator(), gn = a.createGain(), n = a.currentTime;
      o.type = 'sine'; o.frequency.setValueAtTime(120, n); o.frequency.exponentialRampToValueAtTime(38, n + 0.35);
      gn.gain.setValueAtTime(0.0001, n); gn.gain.exponentialRampToValueAtTime(0.7, n + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, n + 0.5);
      o.connect(gn); gn.connect(a.destination); o.start(n); o.stop(n + 0.55);
      setTimeout(() => a.close?.(), 900);
    } catch { /* no sound */ }
  };
  const ease = (t: number) => 1 - Math.pow(1 - t, 3), clamp = (t: number) => Math.max(0, Math.min(1, t));
  // Timeline (seconds)
  const DROP0 = 0.35, HIT = 0.85, WORDS = 1.35, GAMES = 1.75, OUT = 3.4, END = 4.0;

  const frame = (now: number) => {
    if (done) return;
    if (!t0) t0 = now;
    const t = reduced ? Math.max(HIT + 0.6, (now - t0) / 1000) : (now - t0) / 1000;
    const tx = g; tx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tx.fillStyle = BG; tx.fillRect(0, 0, W, H);
    const scale = Math.min((W * (W < 700 ? 0.82 : 0.62)) / iw, (H * 0.6) / ih), lw = iw * scale, lh = ih * scale;
    const lx = (W - lw) / 2, ly = (H - lh) / 2 - H * 0.02, cut = mImg.height * scale;
    // camera shake after the impact
    let sx = 0, sy = 0;
    if (t > HIT && t < HIT + 0.45) { const k = 1 - (t - HIT) / 0.45; sx = (Math.random() - 0.5) * 16 * k * k; sy = (Math.random() - 0.5) * 12 * k * k; }
    tx.save(); tx.translate(sx, sy);
    // the M: falls from huge and see-through, accelerating, then lands with a small squash
    const mBaseY = ly + cut;
    if (t >= DROP0) {
      const f = clamp((t - DROP0) / (HIT - DROP0));
      const k = f * f * f;
      const s = 5 - 4 * k, a = Math.min(1, f * 2.2);
      let sqY = 1, sqX = 1;
      if (t > HIT) { const q = (t - HIT) / 0.32; if (q < 1) { const b = Math.sin(q * Math.PI) * (1 - q); sqY = 1 - 0.1 * b; sqX = 1 + 0.06 * b; } }
      tx.save(); tx.globalAlpha = a;
      tx.translate(W / 2, mBaseY); tx.scale(s * sqX, s * sqY);
      if (t < HIT) { tx.shadowColor = 'rgba(0,0,0,.6)'; tx.shadowBlur = 30 * (1 - k); }
      tx.drawImage(mImg, -lw / 2, -cut, lw, cut);
      tx.restore();
      if (t < HIT) { tx.fillStyle = 'rgba(0,0,0,' + 0.5 * k + ')'; tx.beginPath(); tx.ellipse(W / 2, mBaseY + 4, lw * 0.3 * (0.4 + 0.6 * k), 8 * k, 0, 0, Math.PI * 2); tx.fill(); }
    }
    // impact: a flash ring and a burst of dust from under the M
    if (t >= HIT && !thudDone) {
      thudDone = true; thud();
      for (let i = 0; i < 70; i++) {
        const side = Math.random() < 0.5 ? -1 : 1, sp = 120 + Math.random() * 520;
        dust.push({ x: W / 2 + side * lw * (0.05 + Math.random() * 0.22), y: mBaseY - Math.random() * 6, vx: side * sp * (0.6 + Math.random() * 0.6), vy: -Math.random() * 160 - 20, r: 3 + Math.random() * 9, life: 0.8 + Math.random() * 0.9, age: 0, c: Math.random() < 0.6 ? '200,186,160' : '120,110,96' });
      }
    }
    if (t >= HIT && t < HIT + 0.5) {
      const q = (t - HIT) / 0.5;
      tx.strokeStyle = 'rgba(246,236,218,' + 0.55 * (1 - q) + ')'; tx.lineWidth = 6 * (1 - q) + 1;
      tx.beginPath(); tx.ellipse(W / 2, mBaseY, lw * (0.25 + q * 0.6), 10 + q * 26, 0, 0, Math.PI * 2); tx.stroke();
      tx.fillStyle = 'rgba(246,236,218,' + 0.18 * (1 - q) + ')'; tx.fillRect(-20, -20, W + 40, H + 40);
    }
    const dt = 1 / 60;
    for (let i = dust.length - 1; i >= 0; i--) {
      const p = dust[i]; p.age += dt; if (p.age > p.life) { dust.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.93; p.vy = p.vy * 0.93 - 8 * dt; p.r += 14 * dt;
      tx.fillStyle = 'rgba(' + p.c + ',' + 0.45 * (1 - p.age / p.life) + ')';
      tx.beginPath(); tx.arc(p.x, p.y, p.r, 0, Math.PI * 2); tx.fill();
    }
    // the words rise into place: MANSFIELD first, then GAMES
    const wTop = ly + cut, wh = wImg.height * scale, gamesCut = 0.62;
    const drawWords = (y0: number, y1: number, start: number) => {
      const f = ease(clamp((t - start) / 0.5)); if (f <= 0) return;
      tx.save(); tx.globalAlpha = f;
      const sy0 = y0 * wImg.height, sh = (y1 - y0) * wImg.height;
      tx.drawImage(wImg, 0, sy0, iw, sh, lx, wTop + y0 * wh + (1 - f) * 22, lw, sh * scale);
      tx.restore();
    };
    drawWords(0, gamesCut, WORDS); drawWords(gamesCut, 1, GAMES);
    tx.restore();
    if (t >= OUT) el.style.opacity = String(1 - clamp((t - OUT) / (END - OUT)));
    if (t >= END) return finish();
    requestAnimationFrame(frame);
  };
  const finish = () => {
    if (done) return; done = true;
    el.style.transition = 'opacity .35s'; el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
    removeEventListener('keydown', onSkip, true); removeEventListener('resize', size);
  };
  const onSkip = (e?: Event) => { e?.preventDefault?.(); e?.stopPropagation?.(); finish(); };
  el.addEventListener('pointerdown', onSkip);
  addEventListener('keydown', onSkip, true);
  addEventListener('resize', size);
  const img = new Image();
  img.onload = () => { try { size(); prepare(img); el.classList.add('live'); requestAnimationFrame(frame); } catch { finish(); } };
  img.onerror = finish;
  img.src = logo;
  setTimeout(finish, 9000); // never get stuck on the splash
}
