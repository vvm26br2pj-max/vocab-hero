import { useEffect, useId, useState } from 'react';
import { figureShapes, heroShapes, shade, type Anim, type BodyStyle, type Shape } from '../../art/hero';
import type { Appearance } from '../../core/types';

function useClock(animate: boolean) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!animate) return;
    let raf = 0; const start = performance.now();
    const loop = (now: number) => { setT(((now - start) / 1000) % 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate]);
  return t;
}

export function ShapesSvg({ shapes, flip }: { shapes: Shape[]; flip?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const colors = [...new Set(shapes.filter((s) => s.t !== 'limb' && !s.nl).map((s) => s.fill))];
  const fillOf = (s: Shape) => (s.t !== 'limb' && !s.nl && s.fill.startsWith('#') ? `url(#${uid}${s.fill.slice(1)})` : s.fill);
  return (
    <g transform={flip ? 'translate(80,0) scale(-1,1)' : undefined}>
      <defs>{colors.filter((c) => c.startsWith('#') && c.length === 7).map((c) => (
        <linearGradient key={c} id={`${uid}${c.slice(1)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={shade(c, 0.3)} /><stop offset="0.45" stopColor={c} /><stop offset="1" stopColor={shade(c, -0.28)} /></linearGradient>
      ))}<filter id={`${uid}glow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      {shapes.map((s, i) => {
        const o = s.alpha ?? 1;
        const fl = s.glow ? `url(#${uid}glow)` : undefined;
        const outline = s.nl ? {} : { stroke: '#1b1446', strokeWidth: 1.15, strokeLinejoin: 'round' as const };
        switch (s.t) {
          case 'rect': return <rect key={i} filter={fl} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r ?? 0} fill={fillOf(s)} opacity={o} {...outline} />;
          case 'circle': return s.fill === '#00000000' ? null : <circle key={i} filter={fl} cx={s.x} cy={s.y} r={s.r} fill={fillOf(s)} opacity={o} {...outline} />;
          case 'ellipse': return <ellipse key={i} filter={fl} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill={fillOf(s)} opacity={o} {...outline} />;
          case 'poly': return <polygon key={i} filter={fl} points={s.pts.map((v) => v.toFixed(2)).join(',')} fill={fillOf(s)} opacity={o} {...outline} />;
          case 'limb': return (
            <g key={i} opacity={o}>
              {!s.nl && s.w > 2 && <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#1b1446" strokeWidth={s.w + 2.2} strokeLinecap="round" />}
              <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.fill} strokeWidth={s.w} strokeLinecap="round" />
            </g>
          );
        }
      })}
    </g>
  );
}

export function HeroSprite({ appearance, anim = 'idle', size = 120, animate = true, flip = false, title }: { appearance: Appearance; anim?: Anim; size?: number; animate?: boolean; flip?: boolean; title?: string }) {
  const t = useClock(animate);
  return (
    <svg viewBox="-10 -14 100 124" width={size} height={size * 1.24} role="img" aria-label={title ?? 'Your hero'}>
      <ellipse cx={40} cy={108} rx={20} ry={4} fill="#000" opacity={0.18} />
      <ShapesSvg shapes={heroShapes(appearance, anim, t)} flip={flip} />
    </svg>
  );
}

export function FigureSprite({ style, anim = 'idle', size = 120, animate = true, flip = false, title }: { style: BodyStyle; anim?: Anim; size?: number; animate?: boolean; flip?: boolean; title?: string }) {
  const t = useClock(animate);
  return (
    <svg viewBox="-30 -20 140 130" width={size * 1.4} height={size * 1.3} role="img" aria-label={title ?? 'Character'}>
      <ellipse cx={40} cy={108} rx={22} ry={4} fill="#000" opacity={0.18} />
      <ShapesSvg shapes={figureShapes(style, anim, t)} flip={flip} />
    </svg>
  );
}
