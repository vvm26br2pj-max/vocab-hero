import type { SceneSpec } from '../../content/schema';
import { HeroSprite, ShapesSvg } from './Sprite';
import { figureShapes, heroShapes } from '../../art/hero';
import { DEFAULT_APPEARANCE } from '../../core/profile';
import { useEffect, useState } from 'react';

const BG: Record<string, [string, string, string]> = {
  city: ['#7fc8ff', '#c7e9ff', '#5b6c8f'], school: ['#ffe9b8', '#fff6dd', '#c9965b'], park: ['#9fe3ff', '#dff7ff', '#5cbf5c'],
  lab: ['#d6f0ff', '#f2fbff', '#9fb3c8'], home: ['#ffd9c2', '#fff0e6', '#b07b5a'], sky: ['#5fb6ff', '#bfe4ff', '#ffffff'],
  street: ['#a9d5ff', '#e2f1ff', '#6b6b7b'], stage: ['#3b2366', '#6d3fa8', '#8a4b2a'], nature: ['#a8e8ff', '#e8fbff', '#4aa35a'], night: ['#1b1f4a', '#3b3f7a', '#2a3355'],
};

// The academy's heroes appear in lesson scenes; "Nova" is the default star.
const NOVA = { ...DEFAULT_APPEARANCE, palette: 'royal', hair: 'ponytail', hairColor: '#1d1a1a', skin: '#a8714a', cape: 'classic', emblem: 'star' };

export function Scene({ scene, caption, size = 260, animate = true }: { scene: SceneSpec; caption?: string; size?: number; animate?: boolean }) {
  const [c1, c2, ground] = BG[scene.setting] ?? BG.city;
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!animate) return;
    let raf = 0; const s = performance.now();
    const loop = (n: number) => { setT((n - s) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [animate]);
  const props = scene.props.slice(0, 3);
  const propPos = [[150, 50], [175, 92], [128, 18]];
  return (
    <figure className="scene" style={{ width: size }}>
      <svg viewBox="0 0 220 140" width={size} height={size * 140 / 220} role="img" aria-label={caption ?? 'Illustration'}>
        <defs><linearGradient id={`bg-${scene.setting}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient></defs>
        <rect width="220" height="140" fill={`url(#bg-${scene.setting})`} />
        {scene.setting === 'city' || scene.setting === 'street' ? [10, 40, 175, 200].map((x, i) => <rect key={i} x={x} y={40 + (i % 2) * 15} width={22} height={80} fill="#9bb0d6" opacity={0.6} />) : null}
        {scene.setting === 'night' && [20, 60, 120, 190].map((x, i) => <circle key={i} cx={x} cy={15 + (i % 2) * 12} r={1.5} fill="#fff" />)}
        <rect y="118" width="220" height="22" fill={ground} />
        <g transform="translate(30,14) scale(0.95)">
          <ShapesSvg shapes={heroShapes(NOVA, scene.pose, t)} />
        </g>
        {scene.second && (
          <g transform="translate(150,14) scale(0.95) translate(80,0) scale(-1,1)">
            <ShapesSvg shapes={figureShapes({ kind: 'hero', main: '#2fae66', accent: '#ffd23f', eye: '#1b1b2f', skin: '#eebb94' }, scene.second, t + 0.3, { ...DEFAULT_APPEARANCE, palette: 'leaf-green', hair: 'curly', hairColor: '#5a3825' })} />
          </g>
        )}
        {props.map((p, i) => (
          <text key={i} x={scene.second ? propPos[i][0] - 20 : propPos[i][0]} y={propPos[i][1] + Math.sin(t * 2 + i) * (animate ? 2 : 0)} fontSize="26" textAnchor="middle" dominantBaseline="middle">{p}</text>
        ))}
      </svg>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

export { HeroSprite };
