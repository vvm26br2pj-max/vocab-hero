// The six CPU heroes. Behaviour lives in src/combat/bosses/*.ts; this is the menu-facing data.

export interface BossInfo {
  id: string;
  name: string;
  arena: string;
  arenaKey: 'rooftop' | 'quarry' | 'lab' | 'theater' | 'observatory' | 'foundry';
  blueprint: string;
  blueprintName: string;
  /** Order in which opponents are revealed; lower = earlier. */
  reveal: number;
  colors: { main: string; accent: string; eye: string };
  pattern: string;
  phase2: string;
  tip: string;
}

export const BOSSES: BossInfo[] = [
  {
    id: 'circuit-lynx', name: 'Circuit Lynx', arena: 'Rooftop', arenaKey: 'rooftop', blueprint: 'bp:laser-eyes', blueprintName: 'Laser Eyes', reveal: 0,
    colors: { main: '#3d4a6b', accent: '#38e1ff', eye: '#aef6ff' },
    pattern: 'Horizontal lasers (watch the warning line), orb bursts, a marked dash, drone strikes, and a pounce onto platforms.',
    phase2: 'Alternates low and high beams with safe jump windows, then dashes.',
    tip: 'Jump the low beam, stay on the ground under the high beam, punch during the recovery after the dash.',
  },
  {
    id: 'granite-glove', name: 'Granite Glove', arena: 'Training Quarry', arenaKey: 'quarry', blueprint: 'bp:super-punch', blueprintName: 'Super Punch', reveal: 0,
    colors: { main: '#8a7663', accent: '#d9a441', eye: '#fff1c1' },
    pattern: 'Rush Punches across a marked lane, a leap slam, rolling boulders, and a floor shockwave.',
    phase2: 'Chains two slams before a longer recovery.',
    tip: 'Jump over the floor shockwave. The shadow shows where the slam lands.',
  },
  {
    id: 'frost-finch', name: 'Frost Finch', arena: 'Cold Laboratory', arenaKey: 'lab', blueprint: 'bp:ice-dash', blueprintName: 'Ice Dash', reveal: 1,
    colors: { main: '#cfeeff', accent: '#4aa8ff', eye: '#1a3a6b' },
    pattern: 'Slippery ice patches, aimed icicles, hail columns, a chilling frost breath, and a sliding charge.',
    phase2: 'Changes which patches are slippery and adds an icicle before the charge.',
    tip: 'Patches with snowflake stripes are slippery. Step aside when the aim line locks.',
  },
  {
    id: 'prism-moth', name: 'Prism Moth', arena: 'Neon Theater', arenaKey: 'theater', blueprint: 'bp:hologram-decoy', blueprintName: 'Hologram Decoy', reveal: 2,
    colors: { main: '#b07cff', accent: '#ff7ce0', eye: '#ffffff' },
    pattern: 'Decoys, a fan of light, sweeping light pillars, and a marked teleport strike.',
    phase2: 'Uses more decoys. The real Prism Moth always casts a shadow on the floor.',
    tip: 'Look at the floor: only the real Moth has a shadow. Decoys pop in one hit.',
  },
  {
    id: 'captain-gravity', name: 'Captain Gravity', arena: 'Observatory', arenaKey: 'observatory', blueprint: 'bp:triple-jump', blueprintName: 'Hover', reveal: 2,
    colors: { main: '#2c2a5a', accent: '#ffcf4a', eye: '#ffe9a8' },
    pattern: 'A pull field, falling energy orbs, orbiting satellites, and a meteor slam with shockwaves.',
    phase2: 'Alternates gravity zones with clearly marked safe periods.',
    tip: 'Walk against the pull field arrows. Orbs show their landing spot on the floor.',
  },
  {
    id: 'copper-comet', name: 'Copper Comet', arena: 'Foundry', arenaKey: 'foundry', blueprint: 'bp:ground-shockwave', blueprintName: 'Ground Shockwave', reveal: 3,
    colors: { main: '#c8743a', accent: '#ffd36e', eye: '#fff7d6' },
    pattern: 'Straight charges, ground bursts, a fiery comet dive, and a shield that counters if you keep hitting it.',
    phase2: 'Combines a charge with one delayed burst, then shows a clear recovery window.',
    tip: 'Do not punch the shield — wait for it to drop. Burst circles erupt after they fill.',
  },
];

export const BOSS_BY_ID: Record<string, BossInfo> = Object.fromEntries(BOSSES.map((b) => [b.id, b]));
