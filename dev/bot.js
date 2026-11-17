// Dev-only test bot (not part of the build). Load in the browser console: await import('/dev/bot.js')
window.__bot = async function (maxSec = 200, opts = {}) {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const held = {};
  const key = (code, down) => { if (!!held[code] === down) return; held[code] = down; window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true })); };
  const tap = async (code, ms = 40) => { key(code, true); await sleep(ms); key(code, false); };
  const GROUND = 470; const t0 = performance.now();
  while ((performance.now() - t0) / 1000 < maxSec) {
    const s = window.__battle;
    if (!s || s.ended) break;
    if (s.paused) { await sleep(100); continue; }
    const b = s.boss, px = s.px, dx = b.x - px, dist = Math.abs(dx);
    const pr = s.playerRect();
    let act = null; let fleeDir = 0;
    for (const z of s.ctx.heavy) if ((z.on || z.warn > 0) && px >= z.x && px <= z.x + z.w) { act = 'flee'; fleeDir = z.x === 0 ? 1 : -1; }
    for (const h of s.hazards) {
      if (act === 'dodge' || act === 'jump') break;
      const left = h.warn - h.t;
      if (h.style === 'body') { const c = h.x + h.w / 2; const approaching = Math.sign(px - c) === Math.sign(b.vx) || Math.abs(px - c) < 50; if (approaching && Math.abs(px - c) < 140) { act = 'dodge'; break; } continue; }
      if (h.pull) { if (h.t > h.warn - 0.3) { act = 'flee'; fleeDir = Math.sign(px - h.pull.cx) || 1; } continue; }
      if (h.dmg <= 0) continue;
      if (h.style === 'boulder') { if (h.t >= h.warn && Math.abs(h.x - px) < 110 && Math.sign(px - h.x) === Math.sign(h.vx) && h.y > GROUND - 40) act = 'jump'; else if (h.t >= h.warn && h.vy !== 0 && Math.abs(h.x + h.vx * 0.5 - px) < 70) { act = 'flee'; fleeDir = Math.sign(px - h.x) || 1; } continue; }
      if (h.style === 'pillar') { if (h.t >= h.warn - 0.1) { const c = h.x + h.w / 2; const comingAt = h.vx === 0 ? Math.abs(c - px) < 40 : (Math.sign(px - c) === Math.sign(h.vx) && Math.abs(c - px) < 60); if (comingAt) act = 'dodge'; } else if (h.vx === 0 && Math.abs(h.x + h.w / 2 - px) < 50) { act = 'flee'; fleeDir = Math.sign(px - h.x - h.w / 2) || 1; } continue; }
      if (h.style === 'satellite') { if (Math.hypot(h.x - px, h.y - (s.py - 38)) < 70) { act = 'flee'; fleeDir = Math.sign(px - b.x) || 1; } continue; }
      let near;
      if (h.shape === 'rect') near = pr.x < h.x + h.w + 20 && pr.x + pr.w > h.x - 20 && pr.y < h.y + h.h + 10 && pr.y + pr.h > h.y - 10;
      else { const fx = h.x + h.vx * Math.max(0, left), fy = h.gravity ? GROUND - 20 : h.y + h.vy * Math.max(0, left); near = Math.hypot(fx - px, fy - (s.py - 38)) < h.r + 70; if (h.gravity) near = Math.abs(h.x - px) < h.r + 40; }
      if (h.style === 'beam') { if (h.y > GROUND - 60 && left < 0.25 && left > -0.1 && near) act = 'jump'; continue; }
      if (h.style === 'wave') { const c = h.x + h.w / 2; if (Math.abs(c - px) < 90 && Math.sign(px - c) === Math.sign(h.vx)) act = 'jump'; continue; }
      if (h.style === 'band') { if (left < 0.9 && h.gap) { const gc = h.gap.x + h.gap.w / 2; act = 'flee'; fleeDir = Math.sign(gc - px); } continue; }
      if (near && (left < 0.8 || h.gravity || h.style === 'fire')) { act = 'flee'; fleeDir = h.shape === 'circle' ? Math.sign(px - h.x) || 1 : Math.sign(px - (h.x + h.w / 2)) || 1; if (left < 0.2 && !h.gravity && h.style !== 'fire') act = 'dodge'; }
      if (h.t >= h.warn && near && !h.gravity && h.style !== 'fire') act = 'dodge';
    }
    for (const c of ['ArrowLeft', 'ArrowRight']) key(c, false);
    if (act === 'jump') { if (s.onGround) await tap('Space', 300); await sleep(30); continue; }
    if (act === 'dodge') { if (s.dodgeCd <= 0) await tap('KeyK'); else if (s.onGround) await tap('Space', 300); await sleep(30); continue; }
    if (act === 'flee') { const d = fleeDir || (dx > 0 ? -1 : 1); key(d > 0 ? 'ArrowRight' : 'ArrowLeft', true); await sleep(60); continue; }
    if (s.onGround && s.py < 455) { key('ArrowDown', true); await tap('Space'); key('ArrowDown', false); }
    let tgt = b;
    if (s.ctx.mothDecoys.length && b.state !== 'recover') { const d = s.ctx.mothDecoys.reduce((a, c) => Math.abs(c.x - px) < Math.abs(a.x - px) ? c : a); tgt = { x: d.x, vulnerable: true, state: 'idle' }; }
    const tdx = tgt.x - px, tdist = Math.abs(tdx);
    if (tgt.vulnerable && (tgt.state === 'recover' || tgt.state === 'idle' || (tgt.state === 'approach' && tdist < 70) || s.ctx.mothDecoys.length)) {
      if (tdist > 55) key(tdx > 0 ? 'ArrowRight' : 'ArrowLeft', true);
      else { if (Math.sign(tdx) !== s.facing) { key(tdx > 0 ? 'ArrowRight' : 'ArrowLeft', true); await sleep(25); key(tdx > 0 ? 'ArrowRight' : 'ArrowLeft', false); } await tap('KeyJ'); }
      if (opts.powers) { await tap('KeyQ'); await tap('KeyE'); }
    } else if (dist < 170 && b.state !== 'recover') key(dx > 0 ? 'ArrowLeft' : 'ArrowRight', true);
    await sleep(45);
  }
  for (const c of Object.keys(held)) key(c, false);
  const s = window.__battle;
  return { ended: s?.ended, playerHp: Math.round(s?.hp), bossHp: Math.round(s?.boss.hp), phase: s?.boss.phase, secs: Math.round(s?.elapsed) };
};
window.__run = async (name, tier = 'Rookie', opts = {}) => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const click = (re) => { const b = [...document.querySelectorAll('button')].find(b => re.test(b.textContent) && !b.disabled); b?.click(); return !!b; };
  if (document.querySelector('canvas')) { click(/Pause/); await sleep(200); click(/^Leave$/) || click(/^Back$/); await sleep(400); }
  if (!/Arena Trials/.test(document.body.innerText)) { click(/HQ/); await sleep(300); document.querySelector('.arena-btn')?.click(); await sleep(400); }
  const rows = [...document.querySelectorAll('.row')].filter(r => r.textContent.includes(name) && r.textContent.includes(tier) && /Practice/.test(r.textContent));
  rows[0]?.querySelector('button')?.click(); await sleep(2400);
  window.__botResult = null; window.__bot(400, opts).then(r => window.__botResult = r);
  return window.__battle?.cfg.bossId;
};
window.__wait = async (sec) => { const sleep = (ms) => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < sec && !window.__botResult; i++) { await sleep(1000); const s = window.__battle; if (s?.paused) [...document.querySelectorAll('button')].find(b => /Resume/.test(b.textContent))?.click(); } const s = window.__battle; return window.__botResult ?? { hp: Math.round(s.hp), boss: Math.round(s.boss.hp), ph: s.boss.phase, t: Math.round(s.elapsed) }; };
