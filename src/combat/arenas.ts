export interface Platform {
  x: number; y: number; w: number;
  /** horizontal mover */
  vx?: number; range?: number; baseX?: number;
  /** vertical lift */
  vy?: number; rangeY?: number; baseY?: number;
  /** crumbles ~0.7s after you land on it, comes back after 4s */
  crumble?: boolean; crumbleT?: number; brokenT?: number;
}
export interface Pad { x: number; w: number }
export interface Conveyor { x: number; w: number; v: number }
export interface Vent { x: number; w: number }
export interface ArenaDef {
  key: string; name: string;
  sky: [number, number]; floor: number; deco: number;
  platforms: Platform[];
  pads?: Pad[];
  conveyors?: Conveyor[];
  vents?: Vent[];
  rockfall?: boolean;
  /** visual style for platforms */
  plat: 'metal' | 'stone' | 'ice' | 'neon' | 'cosmic' | 'steel' | 'gym';
  hint: string;
}
export const W = 960, H = 540, GROUND = 470;

// Rule: every platform top is at most ~105px above the floor or a reachable platform (the starting jump reaches ~124px),
// and the floor is always a complete route. Higher routes, pads and lifts are optional advantages.
export const ARENAS: Record<string, ArenaDef> = {
  rooftop: {
    key: 'rooftop', name: 'Rooftop', sky: [0x1e1b4b, 0x7c3aed], floor: 0x3b3f63, deco: 0x6b7bb8, plat: 'metal',
    platforms: [{ x: 110, y: 370, w: 150 }, { x: 700, y: 370, w: 150 }, { x: 405, y: 285, w: 150 }, { x: 18, y: 290, w: 80, vy: 45, rangeY: 75 }],
    pads: [{ x: 880, w: 60 }],
    hint: 'A lift on the left and a fan pad on the right reach the high ledge.',
  },
  quarry: {
    key: 'quarry', name: 'Training Quarry', sky: [0xf97316, 0xfde68a], floor: 0x7a5034, deco: 0xb08158, plat: 'stone',
    platforms: [{ x: 130, y: 368, w: 140, crumble: true }, { x: 420, y: 300, w: 130, crumble: true }, { x: 690, y: 368, w: 160 }, { x: 420, y: 395, w: 120 }],
    rockfall: true,
    hint: 'Cracked ledges crumble under your feet. Watch the sky for falling rocks.',
  },
  lab: {
    key: 'lab', name: 'Cold Laboratory', sky: [0x0e7490, 0xcffafe], floor: 0x5f7f99, deco: 0x9fd8f5, plat: 'ice',
    platforms: [{ x: 160, y: 365, w: 140 }, { x: 660, y: 365, w: 140 }, { x: 410, y: 268, w: 140 }],
    conveyors: [{ x: 330, w: 300, v: 95 }],
    hint: 'The conveyor belt in the middle pushes you right. Ice patches are slippery.',
  },
  theater: {
    key: 'theater', name: 'Neon Theater', sky: [0x1a0530, 0x86198f], floor: 0x3a1430, deco: 0xf472b6, plat: 'neon',
    platforms: [{ x: 240, y: 368, w: 120 }, { x: 600, y: 368, w: 120 }, { x: 420, y: 270, w: 120 }],
    pads: [{ x: 90, w: 60 }, { x: 810, w: 60 }],
    hint: 'Springy stage pads launch you up to the balconies.',
  },
  observatory: {
    key: 'observatory', name: 'Observatory', sky: [0x020617, 0x312e81], floor: 0x2e2a5e, deco: 0xfacc15, plat: 'cosmic',
    platforms: [{ x: 160, y: 378, w: 130, vx: 40, range: 70 }, { x: 670, y: 378, w: 130, vx: -40, range: 70 }, { x: 415, y: 288, w: 130 }, { x: 860, y: 300, w: 80, vy: 38, rangeY: 70 }],
    hint: 'Floating platforms drift back and forth. A star-lift rises on the right.',
  },
  foundry: {
    key: 'foundry', name: 'Foundry', sky: [0x3b0a0a, 0xea580c], floor: 0x2b1d18, deco: 0xfb923c, plat: 'steel',
    platforms: [{ x: 120, y: 372, w: 140, vx: 35, range: 60 }, { x: 700, y: 372, w: 140 }, { x: 410, y: 285, w: 140 }],
    conveyors: [{ x: 40, w: 230, v: 80 }, { x: 690, w: 230, v: -80 }],
    vents: [{ x: 330, w: 56 }, { x: 574, w: 56 }],
    hint: 'Conveyors push you toward the middle, where lava vents erupt. Watch for the glow.',
  },
  carnival: {
    key: 'carnival', name: 'Carnival', sky: [0x38bdf8, 0xfbcfe8], floor: 0x7c4a2d, deco: 0xf472b6, plat: 'gym',
    platforms: [{ x: 150, y: 372, w: 130 }, { x: 680, y: 372, w: 130 }, { x: 415, y: 290, w: 130 }],
    pads: [{ x: 40, w: 56 }, { x: 864, w: 56 }],
    hint: 'Bounce pads and platforms help you reach the high balloons.',
  },
  training: {
    key: 'training', name: 'Training Room', sky: [0x312e81, 0x93c5fd], floor: 0x4b5578, deco: 0x8892b0, plat: 'gym',
    platforms: [{ x: 520, y: 372, w: 120 }, { x: 680, y: 290, w: 120 }, { x: 830, y: 200, w: 110 }, { x: 330, y: 372, w: 120 }],
    pads: [{ x: 230, w: 50 }],
    hint: 'Try the pad, the course and your powers.',
  },
};
