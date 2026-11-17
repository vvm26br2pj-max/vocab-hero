import { useId } from 'react';

export type AbilityIconId =
  | 'super-punch'
  | 'ground-shockwave'
  | 'meteor-slam'
  | 'titan-fist'
  | 'laser-eyes'
  | 'chain-lightning'
  | 'flame-blast'
  | 'supernova'
  | 'double-jump'
  | 'ice-dash'
  | 'triple-jump'
  | 'gravity-burst'
  | 'energy-shield'
  | 'hologram-decoy'
  | 'phase-shift'
  | 'meditate'
  | 'super-speed'
  | 'hover'
  | 'guardian-aura';

const NAVY = '#1b1446';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

interface Ctx {
  /** prefixed id */
  id: (name: string) => string;
  /** url(#prefixed id) */
  url: (name: string) => string;
}

const f = (n: number): string => (Math.round(n * 100) / 100).toString();

/** Star / burst polygon path. */
function starPath(cx: number, cy: number, outer: number, inner: number, points: number, rot = -90): string {
  let d = '';
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((rot + (i * 360) / total) * Math.PI) / 180;
    d += `${i === 0 ? 'M' : 'L'}${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`;
  }
  return d + 'Z';
}

/** Irregular burst (alternating jittered radii) for impact bursts. */
function jaggedBurst(cx: number, cy: number, outer: number, inner: number, points: number, seed = 1): string {
  let d = '';
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const jitter = 0.78 + 0.22 * Math.abs(Math.sin((i + 1) * 12.9898 * seed));
    const r = i % 2 === 0 ? outer * jitter : inner;
    const a = ((-90 + (i * 360) / total) * Math.PI) / 180;
    d += `${i === 0 ? 'M' : 'L'}${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`;
  }
  return d + 'Z';
}

/** Wavy flame-like blob around a center. */
function wavyBlob(cx: number, cy: number, r: number, amp: number, waves: number, stretchY = 1, phase = 0): string {
  const steps = 72;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const rr = r + amp * Math.sin(t * waves + phase);
    const x = cx + rr * Math.cos(t);
    const y = cy + rr * Math.sin(t) * stretchY;
    d += `${i === 0 ? 'M' : 'L'}${f(x)},${f(y)}`;
  }
  return d + 'Z';
}

/** Regular hexagon (pointy top) path. */
function hexPath(cx: number, cy: number, r: number, rot = -90): string {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = ((rot + i * 60) * Math.PI) / 180;
    d += `${i === 0 ? 'M' : 'L'}${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`;
  }
  return d + 'Z';
}

/** Sunburst wedges from the badge centre. */
function raysPath(count: number, r = 60, cx = 50, cy = 50): string {
  let d = '';
  const step = 360 / count;
  for (let i = 0; i < count; i++) {
    const a1 = ((i * step - step / 4) * Math.PI) / 180;
    const a2 = ((i * step + step / 4) * Math.PI) / 180;
    d += `M${cx},${cy}L${f(cx + r * Math.cos(a1))},${f(cy + r * Math.sin(a1))}L${f(cx + r * Math.cos(a2))},${f(cy + r * Math.sin(a2))}Z`;
  }
  return d;
}

/** Small four-point sparkle. */
function Sparkle({ x, y, s = 1, fill = '#fff', opacity = 1 }: { x: number; y: number; s?: number; fill?: string; opacity?: number }) {
  const d = `M${x},${f(y - 5 * s)}Q${f(x + 0.9 * s)},${f(y - 0.9 * s)} ${f(x + 5 * s)},${y}Q${f(x + 0.9 * s)},${f(y + 0.9 * s)} ${x},${f(y + 5 * s)}Q${f(x - 0.9 * s)},${f(y + 0.9 * s)} ${f(x - 5 * s)},${y}Q${f(x - 0.9 * s)},${f(y - 0.9 * s)} ${x},${f(y - 5 * s)}Z`;
  return <path d={d} fill={fill} opacity={opacity} />;
}

/* ------------------------------------------------------------------ */
/* Hero silhouette                                                     */
/* ------------------------------------------------------------------ */

type Pose = 'stand' | 'leap' | 'run' | 'float';

interface PoseDef {
  cape: string;
  head: [number, number, number];
  torso: string;
  limbs: { d: string; w: number }[];
  hands: [number, number][];
  feet: [number, number][];
  star: [number, number];
}

const POSES: Record<Pose, PoseDef> = {
  stand: {
    cape: 'M-8,-12 C-18,0 -21,14 -18,25 Q-9,20 0,25 Q9,20 18,25 C21,14 18,0 8,-12 Z',
    head: [0, -19.5, 6.3],
    torso: 'M-9.5,-12.5 Q0,-15.5 9.5,-12.5 L7,5 Q0,7 -7,5 Z',
    limbs: [
      { d: 'M-8.5,-10.5 Q-16,-3 -9.5,3', w: 5 },
      { d: 'M8.5,-10.5 Q16,-3 9.5,3', w: 5 },
      { d: 'M-4,5 L-6,22', w: 6 },
      { d: 'M4,5 L6,22', w: 6 },
    ],
    hands: [
      [-9.5, 3],
      [9.5, 3],
    ],
    feet: [
      [-6.3, 22.5],
      [6.3, 22.5],
    ],
    star: [0, -5],
  },
  leap: {
    cape: 'M-4,-13 C-15,-9 -23,2 -27,14 Q-20,10 -16,15 Q-12,7 -5,3 Z',
    head: [6, -20.5, 6],
    torso: 'M-4.5,-13 Q4,-16.5 10.5,-11 L5,4 Q-1,5.5 -6.5,2 Z',
    limbs: [
      { d: 'M8.5,-12 L16,-24', w: 5 },
      { d: 'M-3,-11 L-11,-4', w: 5 },
      { d: 'M3,3 L9,12 L4,21', w: 6 },
      { d: 'M-4,2 L-12,9 L-19,7', w: 6 },
    ],
    hands: [
      [16.5, -25],
      [-11.5, -3.5],
    ],
    feet: [
      [4, 21.5],
      [-19.5, 7],
    ],
    star: [3, -6],
  },
  run: {
    cape: 'M-3,-12 C-14,-15 -25,-11 -33,-4 Q-25,-2 -27,4 Q-16,1 -6,2 Z',
    head: [7, -19.5, 6],
    torso: 'M-3.5,-12.5 Q5,-16 11,-10 L4.5,4 Q-2,5.5 -6.5,2 Z',
    limbs: [
      { d: 'M8.5,-10 L15,-3.5 L21,-8', w: 5 },
      { d: 'M-2,-10 L-10,-3.5 L-14.5,-9', w: 5 },
      { d: 'M3,3 L12,10 L14,20', w: 6 },
      { d: 'M-3,2 L-8,12 L-18,16', w: 6 },
    ],
    hands: [
      [21.5, -8.5],
      [-15, -9.5],
    ],
    feet: [
      [15, 20.5],
      [-18.5, 16.5],
    ],
    star: [3, -5],
  },
  float: {
    cape: 'M-8,-12 C-23,-6 -25,10 -21,23 Q-10,17 0,23 Q10,17 21,23 C25,10 23,-6 8,-12 Z',
    head: [0, -19.5, 6.3],
    torso: 'M-9.5,-12.5 Q0,-15.5 9.5,-12.5 L7,5 Q0,7 -7,5 Z',
    limbs: [
      { d: 'M-8.5,-10.5 L-18,-17', w: 5 },
      { d: 'M8.5,-10.5 L18,-17', w: 5 },
      { d: 'M-3,5 L-5,14 L-3,22', w: 6 },
      { d: 'M3,5 L5,14 L3,22', w: 6 },
    ],
    hands: [
      [-18.5, -17.5],
      [18.5, -17.5],
    ],
    feet: [
      [-3, 22.5],
      [3, 22.5],
    ],
    star: [0, -5],
  },
};

interface HeroProps {
  c: Ctx;
  pose: Pose;
  x: number;
  y: number;
  s?: number;
  suit?: string;
  cape?: string;
  accent?: string;
  skin?: string;
  outline?: string;
  /** single colour silhouette (holograms / afterimages) */
  mono?: string;
  opacity?: number;
  star?: boolean;
  dashed?: boolean;
}

function Hero({
  c,
  pose,
  x,
  y,
  s = 1,
  suit,
  cape,
  accent,
  skin,
  outline = NAVY,
  mono,
  opacity = 1,
  star = true,
  dashed = false,
}: HeroProps) {
  const p = POSES[pose];
  const suitFill = mono ?? suit ?? c.url('suit');
  const capeFill = mono ?? cape ?? c.url('cape');
  const accentFill = mono ?? accent ?? '#ff3b4d';
  const skinFill = mono ?? skin ?? c.url('skin');
  const [hx, hy, hr] = p.head;
  const ow = 3;
  const dash = dashed ? '2.5 2' : undefined;
  const hair = `M${f(hx - hr)},${f(hy - 0.5)}A${hr},${hr} 0 0 1 ${f(hx + hr)},${f(hy - 0.5)}Q${f(hx + 1.5)},${f(hy - hr * 0.55)} ${f(hx - hr)},${f(hy - 0.5)}Z`;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`} opacity={opacity}>
      {/* cape */}
      <path d={p.cape} fill={capeFill} stroke={outline} strokeWidth={2.4} strokeLinejoin="round" strokeDasharray={dash} />
      {!mono && <path d={p.cape} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={1} transform="translate(0.8,0.8) scale(0.92)" />}
      {/* outline pass */}
      {!dashed && (
        <g stroke={outline} fill={outline} strokeLinecap="round" strokeLinejoin="round">
          {p.limbs.map((l, i) => (
            <path key={i} d={l.d} fill="none" strokeWidth={l.w + ow} />
          ))}
          <path d={p.torso} strokeWidth={ow} />
          <circle cx={hx} cy={hy} r={hr + ow / 2} stroke="none" />
          {p.hands.map(([hxx, hyy], i) => (
            <circle key={i} cx={hxx} cy={hyy} r={3.4 + ow / 2} stroke="none" />
          ))}
          {p.feet.map(([fx, fy], i) => (
            <ellipse key={i} cx={fx} cy={fy} rx={4 + ow / 2} ry={3 + ow / 2} stroke="none" />
          ))}
        </g>
      )}
      {/* fill pass */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {p.limbs.map((l, i) => (
          <path key={i} d={l.d} fill="none" stroke={suitFill} strokeWidth={l.w} />
        ))}
        <path d={p.torso} fill={suitFill} stroke={dashed ? outline : 'none'} strokeWidth={dashed ? 1.2 : 0} strokeDasharray={dash} />
        <circle cx={hx} cy={hy} r={hr} fill={skinFill} stroke={dashed ? outline : 'none'} strokeWidth={dashed ? 1.2 : 0} strokeDasharray={dash} />
        {!mono && <path d={hair} fill={NAVY} />}
        {!mono && <path d={`M${f(hx - hr + 1)},${f(hy + 0.3)}L${f(hx + hr - 1)},${f(hy + 0.3)}L${f(hx + hr - 1.5)},${f(hy + 2.3)}L${f(hx - hr + 1.5)},${f(hy + 2.3)}Z`} fill={accentFill} />}
        {p.hands.map(([hxx, hyy], i) => (
          <circle key={i} cx={hxx} cy={hyy} r={3.4} fill={accentFill} />
        ))}
        {p.feet.map(([fx, fy], i) => (
          <ellipse key={i} cx={fx} cy={fy} rx={4} ry={3} fill={accentFill} />
        ))}
        {/* belt */}
        {!mono && <path d={pose === 'stand' || pose === 'float' ? 'M-7.4,2.5 Q0,4.5 7.4,2.5' : 'M-6,0.5 Q0,2.5 5.5,1.5'} stroke="#ffd23f" strokeWidth={1.8} fill="none" />}
        {/* glossy highlight on suit */}
        <path d={p.torso} fill="#fff" opacity={mono ? 0.18 : 0.22} transform="translate(-1.5,-1.2) scale(0.55)" />
        <circle cx={hx - hr * 0.35} cy={hy - hr * 0.35} r={hr * 0.3} fill="#fff" opacity={0.45} />
        {star && <path d={starPath(p.star[0], p.star[1], 4.2, 1.8, 5)} fill={mono ? '#fff' : '#ffd23f'} stroke={mono ? 'none' : NAVY} strokeWidth={0.8} opacity={mono ? 0.7 : 1} />}
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Shared props: glove fist, rocks, clouds                             */
/* ------------------------------------------------------------------ */

/** Boxing-glove style fist facing +x, centred at origin (approx 70 x 40). */
function Fist({ c, glove, sleeve = true }: { c: Ctx; glove?: string; sleeve?: boolean }) {
  const fill = glove ?? c.url('red');
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {sleeve && <path d="M-52,-9 L-25,-10.5 L-25,12.5 L-52,14 Z" fill={c.url('suit')} stroke={NAVY} strokeWidth={2.5} />}
      {sleeve && <path d="M-50,-5 L-27,-6" stroke="#fff" strokeOpacity={0.35} strokeWidth={2} />}
      {/* cuff */}
      <path d="M-27,-12 L-13,-14 L-13,16 L-27,14 Z" fill="#fff4e0" stroke={NAVY} strokeWidth={2.5} />
      <path d="M-27,-4 L-13,-5 M-27,5 L-13,6" stroke="#e7b98a" strokeWidth={1.4} />
      {/* fist body */}
      <path
        d="M-15,-14 C-8,-20 10,-21 16,-16 C23,-11 23,-3 21,1 C23,6 22,14 15,18 C6,22 -8,20 -15,16 Z"
        fill={fill}
        stroke={NAVY}
        strokeWidth={2.8}
      />
      {/* finger creases */}
      <path d="M7,-8 Q14,-9.5 21.5,-6.5 M7,0.5 Q14,-0.5 21.5,2 M7,9 Q13,9 19.5,11" stroke={NAVY} strokeWidth={1.8} fill="none" />
      {/* thumb */}
      <path d="M-8,4 C0,1 9,3 12,8 C10,13 -1,13 -8,10.5 Z" fill={fill} stroke={NAVY} strokeWidth={2} />
      <path d="M-5,5.5 C0,4 5,4.5 8,6.5" stroke="#fff" strokeOpacity={0.5} strokeWidth={1.2} fill="none" />
      {/* highlights */}
      <path d="M-10,-13 C-3,-17 8,-18 14,-14.5" stroke="#fff" strokeOpacity={0.75} strokeWidth={2.4} fill="none" />
      <ellipse cx={15} cy={-11} rx={2.6} ry={1.6} fill="#fff" opacity={0.85} />
      <path d="M-12,12 C-4,16 6,17 13,14" stroke="#000" strokeOpacity={0.18} strokeWidth={2.5} fill="none" />
    </g>
  );
}

function Rock({ c, x, y, s = 1, rot = 0 }: { c: Ctx; x: number; y: number; s?: number; rot?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) scale(${s})`}>
      <path d="M-6,-3 L-2,-6.5 L4.5,-5.5 L7,-0.5 L4,5.5 L-3,6 L-7,2 Z" fill={c.url('rock')} stroke={NAVY} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M-4,-3 L-1.5,-5 L3.5,-4.2" stroke="#fff" strokeOpacity={0.55} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <path d="M-1,1 L2,3" stroke={NAVY} strokeOpacity={0.5} strokeWidth={1} />
    </g>
  );
}

function Cloud({ x, y, s = 1, opacity = 1 }: { x: number; y: number; s?: number; opacity?: number }) {
  const d = 'M-16,4 C-20,4 -21,-3 -15,-4 C-15,-10 -7,-12 -3,-7 C0,-13 10,-12 10,-5 C16,-6 19,0 15,4 Z';
  return (
    <g transform={`translate(${x},${y}) scale(${s})`} opacity={opacity}>
      <path d={d} fill="#fff" stroke={NAVY} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M-15,3 C-6,5 6,5 14,3 L15,4 L-16,4 Z" fill="#c9d6ff" />
      <path d="M-12,-4 C-11,-8 -6,-9 -4,-6" stroke="#fff" strokeWidth={1.5} fill="none" strokeLinecap="round" />
    </g>
  );
}

/** White motion streak lines. */
function Streaks({ lines, color = '#fff', opacity = 0.85 }: { lines: [number, number, number, number, number][]; color?: string; opacity?: number }) {
  return (
    <g stroke={color} strokeLinecap="round" opacity={opacity}>
      {lines.map(([x1, y1, x2, y2, w], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={w} />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Branch palettes                                                     */
/* ------------------------------------------------------------------ */

type Palette = [string, string, string];

const PAL = {
  might: ['#ffe58f', '#ff8a24', '#a8180d'] as Palette,
  energy: ['#c8fbff', '#26b4f0', '#0a2f86'] as Palette,
  nova: ['#ffe2a0', '#ff6a3d', '#4a1488'] as Palette,
  motion: ['#e4dcff', '#8f6bff', '#2f1a86'] as Palette,
  sky: ['#d4f3ff', '#6f8dff', '#36208f'] as Palette,
  guard: ['#d6ffe6', '#25cc95', '#08504f'] as Palette,
};

const BG: Record<AbilityIconId, Palette> = {
  'super-punch': PAL.might,
  'ground-shockwave': ['#ffd27a', '#f06a1e', '#8e140c'],
  'meteor-slam': ['#ffc56b', '#e3401f', '#5e0d18'],
  'titan-fist': ['#fff0a8', '#f2a21c', '#8a3a07'],
  'laser-eyes': ['#b8f1ff', '#1f9fe6', '#0b2470'],
  'chain-lightning': ['#a9e8ff', '#1876e0', '#0a1a5e'],
  'flame-blast': ['#ffe0a8', '#f0571e', '#6e0f12'],
  supernova: PAL.nova,
  'double-jump': PAL.sky,
  'ice-dash': ['#d8f7ff', '#5fa8ff', '#33208a'],
  'triple-jump': PAL.motion,
  'gravity-burst': ['#e8c9ff', '#8a43e8', '#250c63'],
  'energy-shield': PAL.guard,
  'hologram-decoy': ['#cffff6', '#1cc2b0', '#074658'],
  'phase-shift': ['#d9fff0', '#2bb39a', '#123a5c'],
  meditate: ['#fff4c2', '#f5a524', '#6b2a8a'],
  'super-speed': ['#fff3a8', '#ff9f1c', '#8a1c3a'],
  hover: ['#e0fdff', '#38d6ff', '#1e3a8a'],
  'guardian-aura': ['#e6ffd0', '#3fcf6e', '#0a4a3a'],
};

/* ------------------------------------------------------------------ */
/* Icon illustrations                                                  */
/* ------------------------------------------------------------------ */

type Art = (c: Ctx) => JSX.Element;

const ART: Record<AbilityIconId, Art> = {
  /* ---------------- MIGHT ---------------- */
  'super-punch': (c) => (
    <g>
      <circle cx={68} cy={46} r={26} fill={c.url('glowY')} />
      <path d={jaggedBurst(70, 46, 27, 13, 11, 1.3)} fill="#ff5a1f" stroke={NAVY} strokeWidth={2.4} strokeLinejoin="round" />
      <path d={jaggedBurst(70, 46, 20, 10, 11, 2.1)} fill="#ffd23f" />
      <path d={jaggedBurst(70, 46, 11, 6, 9, 3.3)} fill="#fffbe6" />
      <Streaks
        lines={[
          [6, 40, 24, 38, 3],
          [4, 52, 20, 51, 2.2],
          [8, 64, 26, 61, 3],
          [14, 30, 26, 30, 1.6],
          [12, 74, 24, 70, 1.6],
        ]}
      />
      <g transform="translate(46,55) rotate(-14)" filter={c.url('shadow')}>
        <Fist c={c} />
      </g>
      <Sparkle x={84} y={22} s={1.1} />
      <Sparkle x={90} y={64} s={0.8} />
      <Sparkle x={58} y={20} s={0.7} fill="#fff6c2" />
      {/* impact chips */}
      <path d="M86,36 L93,32 M88,50 L96,51 M82,62 L88,68" stroke={NAVY} strokeWidth={4.2} strokeLinecap="round" />
      <path d="M86,36 L93,32 M88,50 L96,51 M82,62 L88,68" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
    </g>
  ),

  'ground-shockwave': (c) => (
    <g>
      {/* ground */}
      <path d="M0,68 Q50,60 100,68 L100,100 L0,100 Z" fill={c.url('ground')} stroke={NAVY} strokeWidth={2.4} />
      <path d="M0,70 Q50,62 100,70" stroke="#fff" strokeOpacity={0.35} strokeWidth={1.4} fill="none" />
      {/* shock rings */}
      <g fill="none" strokeLinecap="round">
        <ellipse cx={50} cy={73} rx={42} ry={11} stroke="#ffd23f" strokeWidth={2} opacity={0.55} />
        <ellipse cx={50} cy={73} rx={31} ry={8} stroke="#ffe680" strokeWidth={2.6} opacity={0.8} />
        <ellipse cx={50} cy={73} rx={20} ry={5.2} stroke="#fff6c2" strokeWidth={3} />
        <ellipse cx={50} cy={73} rx={10} ry={2.8} fill="#fffbe6" stroke="#fff" strokeWidth={2} />
      </g>
      {/* cracks */}
      <g stroke={NAVY} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round">
        <path d="M44,75 L36,80 L30,79 L20,88 L14,89" />
        <path d="M56,75 L64,81 L70,80 L80,90" />
        <path d="M50,76 L48,84 L52,90 L50,98" />
        <path d="M36,80 L34,86" />
        <path d="M70,80 L76,78 L86,80" />
      </g>
      {/* flying debris */}
      <Rock c={c} x={20} y={58} s={0.75} rot={15} />
      <Rock c={c} x={82} y={56} s={0.85} rot={-20} />
      <Rock c={c} x={30} y={46} s={0.5} rot={40} />
      <Rock c={c} x={72} y={44} s={0.55} rot={-35} />
      {/* dust puffs */}
      <g fill="#fff3d6" stroke={NAVY} strokeWidth={1.8}>
        <circle cx={30} cy={68} r={5} />
        <circle cx={24} cy={70} r={3.6} />
        <circle cx={70} cy={68} r={5} />
        <circle cx={76} cy={70} r={3.6} />
      </g>
      {/* fist slamming down */}
      <g transform="translate(50,40) rotate(90) scale(0.82)" filter={c.url('shadow')}>
        <Fist c={c} />
      </g>
      <Streaks
        lines={[
          [33, 8, 34, 22, 2.4],
          [67, 8, 66, 22, 2.4],
          [27, 20, 28, 30, 1.6],
          [73, 20, 72, 30, 1.6],
        ]}
      />
      <Sparkle x={50} y={64} s={1.2} />
    </g>
  ),

  'meteor-slam': (c) => (
    <g>
      {/* flame trail (local +x points down-left) */}
      <g transform="translate(42,60) rotate(140)">
        <path
          d="M-4,-21 C-28,-27 -50,-16 -70,-10 C-56,-5 -60,1 -74,6 C-58,9 -54,14 -66,22 C-44,22 -26,24 -4,21 Z"
          fill="#d81e1e"
          stroke={NAVY}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        <path d="M-4,-16 C-24,-20 -40,-12 -56,-7 C-44,-3 -46,2 -58,6 C-44,8 -40,12 -50,17 C-34,17 -22,19 -4,16 Z" fill="#ff7a1a" />
        <path d="M-4,-11 C-18,-13 -28,-8 -40,-4 C-30,-1 -32,3 -40,6 C-28,8 -18,12 -4,11 Z" fill="#ffd23f" />
        <path d="M-4,-6 C-12,-7 -18,-3 -24,0 C-18,2 -12,6 -4,6 Z" fill="#fffbe6" />
      </g>
      {/* meteor rock with fist */}
      <g transform="translate(42,60)">
        <circle r={21} fill={c.url('glowY')} />
        <path d="M-17,-6 L-10,-16 L4,-18 L15,-10 L18,4 L10,15 L-4,18 L-15,10 Z" fill={c.url('rockHot')} stroke={NAVY} strokeWidth={2.6} strokeLinejoin="round" />
        <path d="M-13,-6 L-8,-13 L3,-15" stroke="#ffe6a0" strokeWidth={2} fill="none" strokeLinecap="round" />
        <g stroke="#ffd23f" strokeWidth={1.6} fill="none" strokeLinecap="round">
          <path d="M-6,4 L0,0 L5,6 L11,4" />
          <path d="M0,0 L2,-8" />
          <path d="M-10,10 L-4,12" />
        </g>
        <g transform="rotate(130) scale(0.66) translate(6,0)">
          <Fist c={c} sleeve={false} />
        </g>
      </g>
      {/* scattered rocks */}
      <Rock c={c} x={80} y={74} s={0.9} rot={20} />
      <Rock c={c} x={16} y={30} s={0.6} rot={-30} />
      <Rock c={c} x={70} y={88} s={0.55} rot={60} />
      <Rock c={c} x={20} y={86} s={0.7} rot={10} />
      {/* embers */}
      <g fill="#ffd23f" stroke={NAVY} strokeWidth={0.8}>
        <circle cx={64} cy={58} r={1.8} />
        <circle cx={76} cy={50} r={1.3} />
        <circle cx={24} cy={52} r={1.5} />
        <circle cx={58} cy={80} r={1.4} />
      </g>
      <Sparkle x={82} y={20} s={0.9} fill="#fff6c2" />
    </g>
  ),

  'titan-fist': (c) => (
    <g>
      <circle cx={50} cy={46} r={34} fill={c.url('glowY')} />
      <path d={starPath(50, 46, 40, 22, 8, -67.5)} fill="#fff6c2" opacity={0.28} />
      <g transform="translate(50,54)" filter={c.url('shadow')} strokeLinejoin="round" strokeLinecap="round">
        {/* bracer */}
        <path d="M-17,46 L-15,10 L15,10 L17,46 Z" fill={c.url('gold')} stroke={NAVY} strokeWidth={2.8} />
        <path d="M-16.2,22 L16.2,22 M-16.8,32 L16.8,32" stroke={NAVY} strokeWidth={2} />
        <path d="M-12,13 L-12,44" stroke="#fff" strokeOpacity={0.55} strokeWidth={2.2} />
        <path d={hexPath(0, 16.5, 4.6, 0)} fill={c.url('gem')} stroke={NAVY} strokeWidth={1.8} />
        <circle cx={-1.4} cy={15} r={1.3} fill="#fff" />
        {/* fist block */}
        <path d="M-21,11 C-24,-6 -22,-20 -15,-26 L15,-26 C22,-20 24,-6 21,11 Z" fill={c.url('gold')} stroke={NAVY} strokeWidth={3} />
        {/* knuckle plates */}
        {[-19, -9.5, 0, 9.5].map((x, i) => (
          <g key={i}>
            <rect x={x} y={-28} width={9.5} height={14} rx={4} fill={c.url('goldLight')} stroke={NAVY} strokeWidth={2} />
            <rect x={x + 2} y={-26} width={3} height={7} rx={1.5} fill="#fff" opacity={0.75} />
          </g>
        ))}
        {/* finger lines */}
        <path d="M-9.5,-14 L-9.5,-4 M0,-14 L0,-4 M9.5,-14 L9.5,-4" stroke={NAVY} strokeWidth={1.8} />
        {/* thumb plate */}
        <path d="M-21,-4 C-10,-9 5,-7 11,0 C5,5 -10,6 -21,4 Z" fill={c.url('goldLight')} stroke={NAVY} strokeWidth={2.2} />
        <path d="M-17,-3 C-10,-6 0,-5 6,-1.5" stroke="#fff" strokeWidth={1.4} fill="none" opacity={0.8} />
        {/* rivets */}
        <g fill="#fff6c2" stroke={NAVY} strokeWidth={0.9}>
          <circle cx={-15} cy={6} r={1.5} />
          <circle cx={15} cy={6} r={1.5} />
          <circle cx={-12} cy={27} r={1.3} />
          <circle cx={12} cy={27} r={1.3} />
        </g>
        <path d="M16,-24 C21,-16 22,-2 19,9" stroke="#000" strokeOpacity={0.2} strokeWidth={3} fill="none" />
      </g>
      {/* sparks */}
      <Sparkle x={18} y={26} s={1.4} />
      <Sparkle x={83} y={30} s={1.1} fill="#fff6c2" />
      <Sparkle x={80} y={70} s={0.8} />
      <Sparkle x={20} y={66} s={0.9} fill="#fff6c2" />
      <g stroke="#fff6c2" strokeWidth={2} strokeLinecap="round">
        <path d="M26,14 L22,8 M74,14 L78,8 M14,46 L8,46 M86,48 L92,48" />
      </g>
    </g>
  ),

  /* ---------------- ENERGY ---------------- */
  'laser-eyes': (c) => (
    <g>
      {/* beams behind glow */}
      <g filter={c.url('glow')}>
        <path d="M38,42 L4,92 L22,104 Z" fill="#ff2a3d" opacity={0.85} />
        <path d="M62,42 L96,92 L78,104 Z" fill="#ff2a3d" opacity={0.85} />
      </g>
      {/* face */}
      <g filter={c.url('shadow')}>
        <path d="M50,14 C67,14 75,27 75,42 C75,58 64,70 50,70 C36,70 25,58 25,42 C25,27 33,14 50,14 Z" fill={c.url('skin')} stroke={NAVY} strokeWidth={2.8} />
      </g>
      {/* hair */}
      <path d="M24,38 C22,22 34,10 50,10 C66,10 79,20 76,38 C72,30 66,26 62,28 C60,22 54,20 50,24 C46,19 38,22 37,28 C32,26 27,30 24,38 Z" fill={NAVY} />
      <path d="M38,16 C44,12 54,12 60,15" stroke="#5a4fb0" strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* mask */}
      <path d="M23,38 C33,32 43,34 50,38 C57,34 67,32 77,38 L75,48 C67,46 58,48 50,51 C42,48 33,46 25,48 Z" fill={c.url('mask')} stroke={NAVY} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M27,38.5 C34,35 42,36 48,39" stroke="#fff" strokeOpacity={0.5} strokeWidth={1.4} fill="none" />
      {/* glowing eyes */}
      <ellipse cx={39} cy={42} rx={6} ry={3.6} fill="#fff" stroke={NAVY} strokeWidth={1.6} />
      <ellipse cx={61} cy={42} rx={6} ry={3.6} fill="#fff" stroke={NAVY} strokeWidth={1.6} />
      <circle cx={39} cy={42} r={7} fill={c.url('glowR')} />
      <circle cx={61} cy={42} r={7} fill={c.url('glowR')} />
      {/* mouth & chin */}
      <path d="M43,59 Q50,63 57,59" stroke={NAVY} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <path d="M32,54 C34,62 40,66 46,67" stroke="#fff" strokeOpacity={0.35} strokeWidth={1.6} fill="none" />
      {/* beams (cores) */}
      <path d="M38,42 L8,90 L20,98 Z" fill="#ff4b5c" stroke={NAVY} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M62,42 L92,90 L80,98 Z" fill="#ff4b5c" stroke={NAVY} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M38.5,43 L12,90 L17,93 Z" fill="#ffe2e5" />
      <path d="M61.5,43 L88,90 L83,93 Z" fill="#ffe2e5" />
      {/* impact flares */}
      <path d={jaggedBurst(14, 92, 9, 4, 7, 1.7)} fill="#ffd23f" stroke={NAVY} strokeWidth={1.4} />
      <path d={jaggedBurst(86, 92, 9, 4, 7, 2.4)} fill="#ffd23f" stroke={NAVY} strokeWidth={1.4} />
      <Sparkle x={39} y={42} s={1.3} />
      <Sparkle x={61} y={42} s={1.3} />
    </g>
  ),

  'chain-lightning': (c) => {
    const forks = [
      'M44,47 L34,52 L30,60 L22,64',
      'M40,64 L54,70 L58,78 L70,80',
      'M56,34 L68,36 L72,46 L82,50',
      'M50,52 L48,62 L52,70 L46,86',
    ];
    return (
      <g>
        <circle cx={52} cy={46} r={30} fill={c.url('glowC')} />
        {/* forks */}
        <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          {forks.map((d, i) => (
            <path key={`o${i}`} d={d} stroke={NAVY} strokeWidth={6} />
          ))}
          <g filter={c.url('glow')}>
            {forks.map((d, i) => (
              <path key={`c${i}`} d={d} stroke="#5fe1ff" strokeWidth={3.6} />
            ))}
          </g>
          {forks.map((d, i) => (
            <path key={`w${i}`} d={d} stroke="#fff" strokeWidth={1.4} />
          ))}
        </g>
        {/* chain nodes */}
        {[
          [22, 64],
          [70, 80],
          [82, 50],
          [46, 86],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={8} fill={c.url('glowC')} />
            <circle cx={x} cy={y} r={4.2} fill="#bff4ff" stroke={NAVY} strokeWidth={1.8} />
            <circle cx={x - 1.2} cy={y - 1.2} r={1.4} fill="#fff" />
          </g>
        ))}
        {/* main bolt */}
        <g filter={c.url('shadow')}>
          <path d="M60,6 L36,46 L49,46 L35,82 L70,36 L56,36 L72,6 Z" fill={c.url('bolt')} stroke={NAVY} strokeWidth={2.8} strokeLinejoin="round" />
        </g>
        <path d="M62,9 L42,43 L47,43" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M58,39 L44,62" stroke="#fff" strokeWidth={1.6} strokeOpacity={0.8} strokeLinecap="round" />
        <Sparkle x={24} y={24} s={1.1} />
        <Sparkle x={84} y={22} s={0.8} />
        <Sparkle x={30} y={84} s={0.7} fill="#bff4ff" />
      </g>
    );
  },

  'flame-blast': (c) => (
    <g>
      {/* fire trail */}
      <g filter={c.url('glow')}>
        <path d="M8,92 C22,74 30,66 44,58 L58,72 C48,84 34,90 8,92 Z" fill="#ff7a1a" opacity={0.7} />
      </g>
      <path d="M10,90 C26,72 34,64 46,57 C40,66 38,70 36,76 C44,70 50,68 58,70 C46,80 32,88 10,90 Z" fill="#ff5a1f" stroke={NAVY} strokeWidth={2} strokeLinejoin="round" />
      <path d="M20,84 C30,74 38,70 46,66 C40,74 32,80 20,84 Z" fill="#ffd23f" />
      {/* fireball */}
      <path d={jaggedBurst(62, 42, 30, 20, 11, 2.2)} fill="#ff4d1f" stroke={NAVY} strokeWidth={2.2} strokeLinejoin="round" />
      <path d={jaggedBurst(62, 42, 24, 16, 11, 3.1)} fill="#ff9a1f" />
      <circle cx={62} cy={42} r={15} fill={c.url('sun')} stroke={NAVY} strokeWidth={2} />
      <circle cx={62} cy={42} r={8} fill="#fffbe6" opacity={0.9} />
      <ellipse cx={56} cy={36} rx={4} ry={2.4} fill="#fff" transform="rotate(-35 56 36)" />
      {/* embers */}
      <circle cx={30} cy={60} r={2.2} fill="#ffd23f" stroke={NAVY} strokeWidth={1} />
      <circle cx={22} cy={70} r={1.6} fill="#ffb21f" />
      <circle cx={42} cy={82} r={1.8} fill="#ffd23f" />
      <Sparkle x={86} y={16} s={1} fill="#fff6c2" />
      <Sparkle x={88} y={70} s={0.8} />
    </g>
  ),

  supernova: (c) => (
    <g>
      <circle cx={50} cy={50} r={40} fill={c.url('glowY')} />
      <path d={raysPath(16, 56)} fill="#fff6c2" opacity={0.2} />
      {/* shockwave ring */}
      <ellipse cx={50} cy={50} rx={40} ry={13} fill="none" stroke="#ffd0f0" strokeWidth={2.4} opacity={0.75} transform="rotate(-18 50 50)" />
      <ellipse cx={50} cy={50} rx={34} ry={10} fill="none" stroke="#fff" strokeWidth={1.2} opacity={0.6} transform="rotate(-18 50 50)" />
      {/* bursts */}
      <path d={jaggedBurst(50, 50, 40, 18, 16, 1.9)} fill="#c22fd6" stroke={NAVY} strokeWidth={2.2} strokeLinejoin="round" />
      <path d={jaggedBurst(50, 50, 33, 15, 16, 2.7)} fill="#ff6a3d" />
      <path d={starPath(50, 50, 28, 11, 8, -90)} fill="#ffb21f" stroke={NAVY} strokeWidth={1.8} strokeLinejoin="round" />
      <path d={starPath(50, 50, 20, 9, 8, -67.5)} fill="#ffe680" />
      <circle cx={50} cy={50} r={11} fill={c.url('core')} stroke="#fff" strokeWidth={1.5} />
      <circle cx={46.5} cy={46.5} r={3.2} fill="#fff" />
      {/* debris particles */}
      <g fill="#fff" stroke={NAVY} strokeWidth={0.8}>
        <circle cx={16} cy={30} r={2} />
        <circle cx={84} cy={70} r={2.2} />
        <circle cx={80} cy={22} r={1.6} />
        <circle cx={22} cy={78} r={1.6} />
      </g>
      <Sparkle x={86} y={40} s={1} />
      <Sparkle x={14} y={56} s={1} fill="#ffe680" />
      <Sparkle x={58} y={12} s={0.8} />
      <Sparkle x={44} y={88} s={0.8} fill="#ffd0f0" />
    </g>
  ),

  /* ---------------- MOTION ---------------- */
  'double-jump': (c) => (
    <g>
      <Cloud x={26} y={80} s={1.15} />
      {/* arc trails */}
      <g fill="none" strokeLinecap="round">
        <path d="M24,74 Q28,50 42,56" stroke={NAVY} strokeWidth={6} />
        <path d="M42,56 Q48,28 62,34" stroke={NAVY} strokeWidth={6} />
        <path d="M24,74 Q28,50 42,56" stroke={c.url('trail')} strokeWidth={3.6} />
        <path d="M42,56 Q48,28 62,34" stroke={c.url('trail')} strokeWidth={3.6} />
        <path d="M25,70 Q28,54 36,54" stroke="#fff" strokeWidth={1.2} />
        <path d="M43,52 Q47,34 55,32" stroke="#fff" strokeWidth={1.2} />
      </g>
      {/* jump puffs */}
      <g fill="none" stroke="#fff" strokeWidth={2}>
        <ellipse cx={42} cy={57} rx={7} ry={2.4} />
        <ellipse cx={42} cy={57} rx={4} ry={1.3} opacity={0.6} />
      </g>
      <g fill="#fff" stroke={NAVY} strokeWidth={1.4}>
        <circle cx={36} cy={60} r={2.6} />
        <circle cx={48} cy={60} r={2.2} />
      </g>
      {/* numbered chevrons */}
      <path d="M17,52 L21,47 L25,52" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17,46 L21,41 L25,46" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      <g filter={c.url('shadow')}>
        <Hero c={c} pose="leap" x={66} y={38} s={0.82} />
      </g>
      <Sparkle x={84} y={66} s={1} />
      <Sparkle x={30} y={24} s={0.8} />
      <Sparkle x={88} y={18} s={0.6} />
    </g>
  ),

  'ice-dash': (c) => (
    <g>
      {/* frost ground */}
      <path d="M4,78 Q50,70 96,78" stroke="#e8fbff" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.75} />
      {/* speed lines */}
      <Streaks
        lines={[
          [4, 34, 30, 34, 2.6],
          [2, 48, 22, 48, 2],
          [6, 62, 34, 62, 2.6],
          [14, 24, 28, 24, 1.4],
        ]}
      />
      {/* ice shards trailing */}
      {[
        { x: 22, y: 50, s: 1.1, r: -80 },
        { x: 14, y: 66, s: 0.8, r: -100 },
        { x: 30, y: 72, s: 0.7, r: -60 },
        { x: 18, y: 38, s: 0.65, r: -120 },
        { x: 34, y: 30, s: 0.55, r: -70 },
      ].map((sh, i) => (
        <g key={i} transform={`translate(${sh.x},${sh.y}) rotate(${sh.r}) scale(${sh.s})`}>
          <path d="M0,-12 L5,-2 L2,10 L-3,10 L-5,-2 Z" fill={c.url('ice')} stroke={NAVY} strokeWidth={1.8} strokeLinejoin="round" />
          <path d="M0,-12 L0,10 M-5,-2 L0,0 L5,-2" stroke="#fff" strokeWidth={0.9} fill="none" opacity={0.85} />
        </g>
      ))}
      <g filter={c.url('shadow')}>
        <Hero c={c} pose="run" x={60} y={50} s={0.92} suit={c.url('suitIce')} accent="#3fd0ff" />
      </g>
      {/* frost burst at back foot */}
      <path d={starPath(42, 66, 6, 2, 6)} fill="#e8fbff" stroke={NAVY} strokeWidth={1} />
      <Sparkle x={82} y={24} s={1} />
      <Sparkle x={88} y={70} s={0.8} fill="#c9f4ff" />
      <Sparkle x={46} y={18} s={0.6} />
    </g>
  ),

  'triple-jump': (c) => {
    const arcs = ['M10,74 Q20,52 32,70', 'M32,70 Q46,36 60,64', 'M60,64 Q74,14 84,40'];
    return (
      <g>
        <Cloud x={14} y={82} s={0.75} />
        <Cloud x={36} y={78} s={0.85} />
        <Cloud x={64} y={74} s={1} />
        <g fill="none" strokeLinecap="round">
          {arcs.map((d, i) => (
            <path key={`o${i}`} d={d} stroke={NAVY} strokeWidth={5.6} />
          ))}
          {arcs.map((d, i) => (
            <path key={`t${i}`} d={d} stroke={c.url('trail')} strokeWidth={3.4} strokeDasharray={i === 2 ? undefined : '6 3'} />
          ))}
        </g>
        {/* landing rings */}
        <g fill="none" stroke="#fff" strokeWidth={1.6}>
          <ellipse cx={32} cy={71} rx={5} ry={1.6} />
          <ellipse cx={60} cy={65} rx={6} ry={2} />
        </g>
        {/* apex stars */}
        <path d={starPath(21, 59, 4, 1.8, 5)} fill="#ffd23f" stroke={NAVY} strokeWidth={1.1} />
        <path d={starPath(46, 48, 5, 2.2, 5)} fill="#ffd23f" stroke={NAVY} strokeWidth={1.2} />
        <path d={starPath(73, 26, 6, 2.6, 5)} fill="#ffd23f" stroke={NAVY} strokeWidth={1.3} />
        <g filter={c.url('shadow')}>
          <Hero c={c} pose="leap" x={84} y={34} s={0.5} />
        </g>
        <Sparkle x={20} y={30} s={1} />
        <Sparkle x={58} y={16} s={0.7} />
        <Sparkle x={90} y={60} s={0.7} />
      </g>
    );
  },

  'gravity-burst': (c) => (
    <g>
      <circle cx={50} cy={50} r={30} fill={c.url('glowP')} />
      {/* ring (back half) */}
      <g transform="rotate(-14 50 58)">
        <path d="M12,58 A38,11 0 0 1 88,58" fill="none" stroke={NAVY} strokeWidth={7} />
        <path d="M12,58 A38,11 0 0 1 88,58" fill="none" stroke="#b46bff" strokeWidth={4} opacity={0.85} />
      </g>
      <Rock c={c} x={30} y={44} s={0.55} rot={20} />
      <Rock c={c} x={72} y={36} s={0.5} rot={-30} />
      {/* floating hero */}
      <g filter={c.url('shadow')}>
        <Hero c={c} pose="float" x={50} y={46} s={0.86} />
      </g>
      {/* ring (front half) */}
      <g transform="rotate(-14 50 58)">
        <path d="M12,58 A38,11 0 0 0 88,58" fill="none" stroke={NAVY} strokeWidth={7} strokeLinecap="round" />
        <path d="M12,58 A38,11 0 0 0 88,58" fill="none" stroke={c.url('ring')} strokeWidth={4} strokeLinecap="round" />
        <path d="M24,64 A38,11 0 0 0 60,69" fill="none" stroke="#fff" strokeWidth={1.4} opacity={0.8} strokeLinecap="round" />
      </g>
      {/* orbiting rocks on ring */}
      <Rock c={c} x={16} y={66} s={0.85} rot={10} />
      <Rock c={c} x={84} y={46} s={0.8} rot={-25} />
      <Rock c={c} x={58} y={76} s={0.7} rot={45} />
      {/* gravity waves */}
      <g fill="none" stroke="#e8c9ff" strokeWidth={1.6} strokeLinecap="round" opacity={0.8}>
        <path d="M38,86 Q50,90 62,86" />
        <path d="M42,91 Q50,94 58,91" />
      </g>
      <Sparkle x={20} y={24} s={1} />
      <Sparkle x={80} y={18} s={0.8} fill="#e8c9ff" />
      <Sparkle x={86} y={72} s={0.7} />
    </g>
  ),

  /* ---------------- GUARD ---------------- */
  'energy-shield': (c) => {
    const cells: string[] = [];
    const r = 6;
    const w = Math.sqrt(3) * r;
    for (let row = -5; row <= 5; row++) {
      for (let col = -4; col <= 4; col++) {
        const cx = 50 + col * w + (row % 2 !== 0 ? w / 2 : 0);
        const cy = 52 + row * r * 1.5;
        cells.push(hexPath(cx, cy, r));
      }
    }
    const shield = hexPath(50, 52, 34);
    return (
      <g>
        <defs>
          <clipPath id={c.id('shieldClip')}>
            <path d={shield} />
          </clipPath>
        </defs>
        <path d={shield} fill={c.url('glowG')} filter={c.url('glow')} opacity={0.8} />
        <path d={shield} fill="#7dffc4" fillOpacity={0.2} />
        {/* hero inside */}
        <g filter={c.url('shadow')}>
          <Hero c={c} pose="stand" x={50} y={53} s={0.92} />
        </g>
        {/* hex grid */}
        <g clipPath={`url(#${c.id('shieldClip')})`}>
          <path d={cells.join('')} fill="none" stroke="#c8ffe6" strokeWidth={0.9} opacity={0.55} />
          <path d={hexPath(32, 40, 6)} fill="#c8ffe6" opacity={0.35} />
          <path d={hexPath(68, 62, 6)} fill="#c8ffe6" opacity={0.3} />
          <path d={hexPath(42.4, 76, 6)} fill="#c8ffe6" opacity={0.25} />
          <path d="M20,30 L50,14 L60,20 L28,40 Z" fill="#fff" opacity={0.25} />
        </g>
        {/* rim */}
        <path d={shield} fill="none" stroke={NAVY} strokeWidth={5} strokeLinejoin="round" />
        <path d={shield} fill="none" stroke={c.url('rim')} strokeWidth={2.8} strokeLinejoin="round" />
        <path d={hexPath(50, 52, 31)} fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={1} />
        {/* rim nodes */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = ((-90 + i * 60) * Math.PI) / 180;
          return <circle key={i} cx={50 + 34 * Math.cos(a)} cy={52 + 34 * Math.sin(a)} r={2.4} fill="#eafff4" stroke={NAVY} strokeWidth={1.2} />;
        })}
        <Sparkle x={24} y={24} s={0.9} />
        <Sparkle x={80} y={80} s={0.8} fill="#c8ffe6" />
      </g>
    );
  },

  'hologram-decoy': (c) => {
    const lines: string[] = [];
    for (let y = 18; y < 82; y += 3) lines.push(`M50,${y}L92,${y}`);
    return (
      <g>
        <defs>
          <clipPath id={c.id('holoClip')}>
            <path d="M54,12 L86,12 L94,82 L46,82 Z" />
          </clipPath>
        </defs>
        {/* projector cone */}
        <path d="M70,84 L46,20 L94,20 Z" fill={c.url('holoCone')} opacity={0.6} />
        {/* holographic copy */}
        <g filter={c.url('glow')}>
          <Hero c={c} pose="stand" x={70} y={48} s={0.88} mono="#5ff7ff" outline="#e6ffff" opacity={0.85} dashed />
        </g>
        <g clipPath={`url(#${c.id('holoClip')})`}>
          <path d={lines.join('')} stroke="#e6ffff" strokeWidth={0.8} opacity={0.35} />
          <path d="M50,40 L92,40" stroke="#fff" strokeWidth={1.6} opacity={0.6} />
        </g>
        {/* projector base */}
        <ellipse cx={70} cy={80} rx={14} ry={3.6} fill="#6ff7ff" opacity={0.7} />
        <ellipse cx={70} cy={81} rx={9} ry={2.6} fill="#9ffaff" stroke={NAVY} strokeWidth={1.6} />
        {/* glitch bits */}
        <g fill="#5ff7ff" opacity={0.85}>
          <rect x={84} y={30} width={6} height={1.6} />
          <rect x={52} y={58} width={5} height={1.4} />
          <rect x={86} y={64} width={4} height={1.4} />
        </g>
        {/* real hero */}
        <g filter={c.url('shadow')}>
          <Hero c={c} pose="stand" x={34} y={54} s={0.98} />
        </g>
        <Sparkle x={86} y={18} s={0.9} fill="#e6ffff" />
        <Sparkle x={14} y={28} s={0.7} />
      </g>
    );
  },

  'phase-shift': (c) => (
    <g>
      {/* streaks */}
      <Streaks
        lines={[
          [4, 36, 40, 36, 2.4],
          [2, 50, 30, 50, 1.8],
          [6, 66, 44, 66, 2.4],
          [12, 26, 30, 26, 1.4],
          [10, 76, 30, 76, 1.4],
        ]}
        color="#d9fff0"
        opacity={0.7}
      />
      {/* afterimages */}
      <Hero c={c} pose="run" x={30} y={52} s={0.86} mono="#9b7bff" outline="#9b7bff" opacity={0.32} star={false} />
      <Hero c={c} pose="run" x={42} y={52} s={0.86} mono="#56e0d0" outline="#56e0d0" opacity={0.5} star={false} />
      <Hero c={c} pose="run" x={53} y={52} s={0.86} mono="#9bf5ea" outline="#2e8f86" opacity={0.7} />
      {/* main hero, semi-phased */}
      <g filter={c.url('glow')}>
        <Hero c={c} pose="run" x={64} y={52} s={0.86} opacity={0.92} />
      </g>
      {/* phase ripples */}
      <g fill="none" stroke="#d9fff0" strokeWidth={1.6} opacity={0.85}>
        <ellipse cx={84} cy={52} rx={4} ry={16} />
        <ellipse cx={89} cy={52} rx={3} ry={11} opacity={0.6} />
      </g>
      <Sparkle x={82} y={22} s={1} />
      <Sparkle x={22} y={82} s={0.7} fill="#d9fff0" />
    </g>
  ),

  meditate: (c) => (
    <g>
      {/* calm glow and ripples */}
      <circle cx={50} cy={50} r={38} fill={c.url('glowY')} />
      <ellipse cx={50} cy={80} rx={34} ry={7} fill="none" stroke="#fff3b0" strokeWidth={1.6} opacity={0.7} />
      <ellipse cx={50} cy={80} rx={24} ry={5} fill="none" stroke="#fff3b0" strokeWidth={1.4} opacity={0.85} />
      <ellipse cx={50} cy={80} rx={16} ry={3.4} fill="#ffd23f" opacity={0.55} />
      {/* seated hero, floating */}
      <g stroke={NAVY} strokeWidth={2.2} strokeLinejoin="round">
        {/* crossed legs */}
        <path d="M24,66 C30,56 44,58 50,64 C56,58 70,56 76,66 C70,74 58,72 50,68 C42,72 30,74 24,66 Z" fill="#e0453a" />
        {/* body */}
        <path d="M38,40 C38,32 62,32 62,40 L64,62 L36,62 Z" fill="#e0453a" />
        <path d="M44,36 L56,36 L50,46 Z" fill="#ffd23f" strokeWidth={1.4} />
        {/* arms resting on knees */}
        <path d="M38,42 C30,48 28,56 30,62" fill="none" stroke="#e0453a" strokeWidth={6} strokeLinecap="round" />
        <path d="M62,42 C70,48 72,56 70,62" fill="none" stroke="#e0453a" strokeWidth={6} strokeLinecap="round" />
        <circle cx={30} cy={63} r={4} fill="#ffd23f" />
        <circle cx={70} cy={63} r={4} fill="#ffd23f" />
        {/* head */}
        <circle cx={50} cy={26} r={10} fill="#f1c27d" />
      </g>
      <path d="M44,26 Q46,28 48,26 M52,26 Q54,28 56,26" stroke={NAVY} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <path d="M47,31 Q50,33 53,31" stroke={NAVY} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      {/* rising adrenaline sparks */}
      <g fill="#ff9b2f" stroke={NAVY} strokeWidth={1}>
        <path d="M18,40 C14,34 18,30 18,24 C22,30 24,34 18,40 Z" />
        <path d="M82,40 C86,34 82,30 82,24 C78,30 76,34 82,40 Z" />
      </g>
      <Sparkle x={26} y={14} s={0.9} fill="#fff6c2" />
      <Sparkle x={76} y={12} s={1.1} />
      <Sparkle x={86} y={56} s={0.7} fill="#fff6c2" />
    </g>
  ),

  hover: (c) => (
    <g>
      <Cloud x={18} y={84} s={0.7} />
      <Cloud x={78} y={86} s={0.6} />
      {/* updraft lines */}
      <g stroke="#e0fdff" strokeWidth={2.2} strokeLinecap="round" opacity={0.85}>
        <line x1={36} y1={86} x2={36} y2={76} /><line x1={50} y1={90} x2={50} y2={78} /><line x1={64} y1={86} x2={64} y2={76} />
      </g>
      {/* glowing hover disc */}
      <ellipse cx={50} cy={72} rx={30} ry={8} fill="#7df9ff" opacity={0.35} />
      <ellipse cx={50} cy={70} rx={21} ry={5} fill="#bff8ff" stroke={NAVY} strokeWidth={1.8} />
      <ellipse cx={50} cy={69} rx={12} ry={2.2} fill="#fff" opacity={0.9} />
      {/* hero floating above it */}
      <g filter={c.url('shadow')}>
        <Hero c={c} pose="float" x={50} y={42} s={0.82} />
      </g>
      <Sparkle x={22} y={40} s={0.7} fill="#e0fdff" />
      <Sparkle x={80} y={30} s={0.8} fill="#bff8ff" />
    </g>
  ),

  'super-speed': (c) => (
    <g>
      {/* speed lines */}
      <Streaks
        lines={[
          [2, 30, 40, 30, 2.6],
          [0, 44, 30, 44, 2],
          [4, 58, 36, 58, 2.6],
          [8, 72, 34, 72, 1.8],
          [12, 20, 30, 20, 1.4],
        ]}
        color="#fff6c2"
        opacity={0.85}
      />
      {/* blurred afterimages */}
      <Hero c={c} pose="run" x={36} y={52} s={0.86} mono="#ffb347" outline="#ffb347" opacity={0.35} star={false} />
      <Hero c={c} pose="run" x={48} y={52} s={0.86} mono="#ffd23f" outline="#e08a00" opacity={0.6} star={false} />
      {/* hero sprinting */}
      <g filter={c.url('shadow')}>
        <Hero c={c} pose="run" x={62} y={52} s={0.86} />
      </g>
      {/* lightning-bolt dust kick */}
      <path d="M78,78 L86,70 L83,70 L90,62" stroke="#fff3b0" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx={58} cy={84} rx={26} ry={4} fill="#000" opacity={0.18} />
      <path d={starPath(86, 22, 9, 4, 5, -90)} fill="#ffd23f" stroke={NAVY} strokeWidth={1.6} strokeLinejoin="round" />
      <Sparkle x={20} y={84} s={0.7} fill="#fff6c2" />
    </g>
  ),

  'guardian-aura': (c) => (
    <g>
      <circle cx={50} cy={52} r={40} fill={c.url('glowG')} />
      <path d={wavyBlob(50, 52, 33, 4, 9, 1.08, 0.6)} fill="#5dff9a" opacity={0.35} stroke="#c8ffd8" strokeWidth={1.4} />
      <path d={wavyBlob(50, 54, 26, 3, 7, 1.12, 2)} fill="#9dffbf" opacity={0.35} />
      {/* rising flame tongues */}
      <g fill="#c8ffd8" opacity={0.75}>
        <path d="M22,62 C18,50 24,42 22,32 C28,40 30,50 26,62 Z" />
        <path d="M78,62 C82,50 76,42 78,32 C72,40 70,50 74,62 Z" />
        <path d="M30,30 C30,22 36,18 36,10 C40,18 38,26 34,32 Z" />
        <path d="M70,30 C70,22 64,18 64,10 C60,18 62,26 66,32 Z" />
      </g>
      {/* big billowing cape */}
      <path
        d="M41,40 C24,46 14,64 12,86 Q22,80 30,86 Q38,80 50,86 Q62,80 70,86 Q78,80 88,86 C86,64 76,46 59,40 Z"
        fill={c.url('capeG')}
        stroke={NAVY}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <path d="M40,44 C28,52 20,66 18,80" stroke="#fff" strokeOpacity={0.45} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <path d="M58,46 C66,56 70,68 72,80 M50,46 L50,82" stroke={NAVY} strokeOpacity={0.25} strokeWidth={1.4} fill="none" />
      <g filter={c.url('shadow')}>
        <Hero c={c} pose="stand" x={50} y={54} s={1.02} cape={c.url('capeG')} accent="#2ee07a" />
      </g>
      {/* particles */}
      <g fill="#eafff0" stroke={NAVY} strokeWidth={0.7}>
        <circle cx={20} cy={46} r={1.6} />
        <circle cx={82} cy={40} r={1.8} />
        <circle cx={26} cy={22} r={1.2} />
        <circle cx={74} cy={24} r={1.4} />
      </g>
      <Sparkle x={50} y={12} s={1.2} />
      <Sparkle x={86} y={60} s={0.8} fill="#c8ffd8" />
      <Sparkle x={14} y={70} s={0.8} fill="#c8ffd8" />
    </g>
  ),
};

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function AbilityIcon(props: { id: AbilityIconId; size?: number; locked?: boolean }): JSX.Element {
  const { id, size = 96, locked = false } = props;
  const uid = 'ai' + useId().replace(/:/g, '');
  const c: Ctx = {
    id: (n) => `${uid}-${n}`,
    url: (n) => `url(#${uid}-${n})`,
  };
  const [inner, mid, outer] = BG[id];
  const art = ART[id](c);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${id.replace(/-/g, ' ')}${locked ? ' (locked)' : ''}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        {/* background */}
        <radialGradient id={c.id('bg')} cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor={inner} />
          <stop offset="48%" stopColor={mid} />
          <stop offset="100%" stopColor={outer} />
        </radialGradient>
        <linearGradient id={c.id('gloss')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <radialGradient id={c.id('vignette')} cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000" stopOpacity={0.35} />
        </radialGradient>
        <linearGradient id={c.id('ringGold')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff3a8" />
          <stop offset="45%" stopColor="#ffc93a" />
          <stop offset="100%" stopColor="#b8730c" />
        </linearGradient>

        {/* materials */}
        <linearGradient id={c.id('red')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff7a7a" />
          <stop offset="50%" stopColor="#e3192f" />
          <stop offset="100%" stopColor="#8e0a1c" />
        </linearGradient>
        <linearGradient id={c.id('suit')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5b8cff" />
          <stop offset="100%" stopColor="#1f2fa8" />
        </linearGradient>
        <linearGradient id={c.id('suitIce')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9fe8ff" />
          <stop offset="100%" stopColor="#2a6ee0" />
        </linearGradient>
        <linearGradient id={c.id('cape')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff5262" />
          <stop offset="100%" stopColor="#a10f2c" />
        </linearGradient>
        <linearGradient id={c.id('capeG')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dffa8" />
          <stop offset="55%" stopColor="#1fbf63" />
          <stop offset="100%" stopColor="#0b6b44" />
        </linearGradient>
        <linearGradient id={c.id('skin')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe0c2" />
          <stop offset="100%" stopColor="#f0a77a" />
        </linearGradient>
        <linearGradient id={c.id('mask')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f6bff" />
          <stop offset="100%" stopColor="#2a1f9e" />
        </linearGradient>
        <linearGradient id={c.id('gold')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff2a0" />
          <stop offset="35%" stopColor="#ffc21f" />
          <stop offset="100%" stopColor="#b86a06" />
        </linearGradient>
        <linearGradient id={c.id('goldLight')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fffbd6" />
          <stop offset="50%" stopColor="#ffd84a" />
          <stop offset="100%" stopColor="#d48a0c" />
        </linearGradient>
        <linearGradient id={c.id('gem')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff8fa0" />
          <stop offset="100%" stopColor="#c0102f" />
        </linearGradient>
        <linearGradient id={c.id('rock')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c2a48a" />
          <stop offset="100%" stopColor="#5e4334" />
        </linearGradient>
        <radialGradient id={c.id('rockHot')} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#a8705a" />
          <stop offset="60%" stopColor="#5a3127" />
          <stop offset="100%" stopColor="#2e1418" />
        </radialGradient>
        <linearGradient id={c.id('ground')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b9774a" />
          <stop offset="100%" stopColor="#5a2e1c" />
        </linearGradient>
        <linearGradient id={c.id('ice')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#9fe8ff" />
          <stop offset="100%" stopColor="#3f8fe6" />
        </linearGradient>
        <linearGradient id={c.id('bolt')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#9ff0ff" />
          <stop offset="100%" stopColor="#2fa8ff" />
        </linearGradient>
        <linearGradient id={c.id('beam')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff6b0" />
          <stop offset="100%" stopColor="#ffb21f" />
        </linearGradient>
        <radialGradient id={c.id('sun')} cx="40%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#fffbe6" />
          <stop offset="50%" stopColor="#ffd23f" />
          <stop offset="100%" stopColor="#ff8a1f" />
        </radialGradient>
        <radialGradient id={c.id('core')} cx="45%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#fff6c2" />
          <stop offset="100%" stopColor="#ffd23f" />
        </radialGradient>
        <linearGradient id={c.id('trail')} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#7ee0ff" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id={c.id('ring')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7b2bff" />
          <stop offset="50%" stopColor="#e3a8ff" />
          <stop offset="100%" stopColor="#7b2bff" />
        </linearGradient>
        <linearGradient id={c.id('rim')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eafff4" />
          <stop offset="100%" stopColor="#3fe8a0" />
        </linearGradient>
        <linearGradient id={c.id('holoCone')} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#7ff8ff" stopOpacity={0.8} />
          <stop offset="100%" stopColor="#7ff8ff" stopOpacity={0} />
        </linearGradient>

        {/* glows */}
        {(
          [
            ['glowY', '#fff6c2'],
            ['glowR', '#ff4b5c'],
            ['glowC', '#8ff3ff'],
            ['glowP', '#d58bff'],
            ['glowG', '#8dffb8'],
          ] as const
        ).map(([n, col]) => (
          <radialGradient key={n} id={c.id(n)} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={col} stopOpacity={0.95} />
            <stop offset="55%" stopColor={col} stopOpacity={0.35} />
            <stop offset="100%" stopColor={col} stopOpacity={0} />
          </radialGradient>
        ))}

        {/* filters */}
        <filter id={c.id('glow')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={c.id('shadow')} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.1" floodColor={NAVY} floodOpacity="0.55" />
        </filter>
        <filter id={c.id('gray')} x="0" y="0" width="100%" height="100%">
          <feColorMatrix type="saturate" values="0.12" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="0.8" />
            <feFuncG type="linear" slope="0.8" />
            <feFuncB type="linear" slope="0.85" />
          </feComponentTransfer>
        </filter>
        <clipPath id={c.id('clip')}>
          <circle cx={50} cy={50} r={45.5} />
        </clipPath>
        <linearGradient id={c.id('lockGold')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff3a8" />
          <stop offset="50%" stopColor="#ffc21f" />
          <stop offset="100%" stopColor="#c27a08" />
        </linearGradient>
      </defs>

      <g filter={locked ? c.url('gray') : undefined}>
        {/* badge background */}
        <circle cx={50} cy={50} r={46} fill={c.url('bg')} />
        <g clipPath={c.url('clip')}>
          <path d={raysPath(14, 62)} fill="#fff" opacity={0.08} />
          <circle cx={50} cy={50} r={46} fill={c.url('vignette')} />
          {art}
          {/* glossy top highlight */}
          <path d="M8,44 C10,18 30,6 50,6 C70,6 90,18 92,44 C78,34 64,30 50,30 C36,30 22,34 8,44 Z" fill={c.url('gloss')} opacity={0.38} />
        </g>
        {/* inner rim shading */}
        <circle cx={50} cy={50} r={44} fill="none" stroke="#000" strokeOpacity={0.18} strokeWidth={3} />
      </g>

      {locked && <circle cx={50} cy={50} r={46} fill="#0b0820" opacity={0.48} />}

      {/* rings */}
      <circle cx={50} cy={50} r={46} fill="none" stroke={NAVY} strokeWidth={1.6} />
      <circle cx={50} cy={50} r={47.6} fill="none" stroke={c.url('ringGold')} strokeWidth={2.4} />
      <path d="M17,22 A44,44 0 0 1 50,4.6" fill="none" stroke="#fffbe0" strokeWidth={1} strokeLinecap="round" opacity={0.9} />
      <circle cx={50} cy={50} r={49.2} fill="none" stroke={NAVY} strokeWidth={1.4} />

      {/* padlock badge */}
      {locked && (
        <g transform="translate(80,20)">
          <circle r={13} fill={NAVY} />
          <circle r={11.6} fill="#2c2370" stroke={c.url('ringGold')} strokeWidth={1.4} />
          <path d="M-4.6,-1 V-4.5 A4.6,4.6 0 0 1 4.6,-4.5 V-1" fill="none" stroke={NAVY} strokeWidth={4.4} strokeLinecap="round" />
          <path d="M-4.6,-1 V-4.5 A4.6,4.6 0 0 1 4.6,-4.5 V-1" fill="none" stroke={c.url('lockGold')} strokeWidth={2.2} strokeLinecap="round" />
          <rect x={-7.5} y={-2} width={15} height={11} rx={2.6} fill={c.url('lockGold')} stroke={NAVY} strokeWidth={1.8} />
          <rect x={-5.5} y={-0.6} width={11} height={2.2} rx={1.1} fill="#fff" opacity={0.6} />
          <circle cx={0} cy={3.2} r={1.7} fill={NAVY} />
          <path d="M0,3.6 L0,6.6" stroke={NAVY} strokeWidth={1.6} strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

export default AbilityIcon;
