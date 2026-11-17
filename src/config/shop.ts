// Shop catalog: cosmetics, powers and power variants. Prices are coins.

export type ItemKind = 'palette' | 'emblem' | 'mask' | 'cape' | 'gloves' | 'boots' | 'armor' | 'shape' | 'power';
export type PowerSlot = 'active' | 'movement' | 'passive';

export interface ShopItem {
  id: string;
  kind: ItemKind;
  name: string;
  price: number;
  /** "Cosmetic" items never change combat. "Combat" items do. */
  label: 'Cosmetic' | 'Combat';
  desc: string;
  slot?: PowerSlot;
  /** Requirements beyond coins */
  requires?: { blueprint?: string; owns?: string; ownsAny?: string[]; willpower?: number };
  /** Ability Map placement */
  branch?: 'might' | 'energy' | 'motion' | 'guard';
  tier?: number;
  /** Visual data for cosmetics */
  look?: Record<string, string>;
}

export const FREE_PALETTES = ['hero-red', 'sky-blue', 'leaf-green', 'sun-gold'];

export const PALETTES: Record<string, { name: string; suit: string; accent: string }> = {
  'hero-red': { name: 'Hero Red', suit: '#e0453a', accent: '#ffd23f' },
  'sky-blue': { name: 'Sky Blue', suit: '#3a86e0', accent: '#f4f4f4' },
  'leaf-green': { name: 'Leaf Green', suit: '#2fae66', accent: '#1b2a49' },
  'sun-gold': { name: 'Sun Gold', suit: '#f2b233', accent: '#7a3cc9' },
  'midnight': { name: 'Midnight', suit: '#26305e', accent: '#59e3ff' },
  'neon-pink': { name: 'Neon Pink', suit: '#ff4fa3', accent: '#2b2b2b' },
  'storm-gray': { name: 'Storm Gray', suit: '#6e7a8a', accent: '#ffe066' },
  'lava': { name: 'Lava', suit: '#ff7a1a', accent: '#3a1010' },
  'ocean': { name: 'Ocean', suit: '#0fb5b0', accent: '#fff3b0' },
  'royal': { name: 'Royal', suit: '#6a3cc9', accent: '#f2c94c' },
  'cherry': { name: 'Cherry', suit: '#b3123b', accent: '#ffe4ec' },
  'tangerine': { name: 'Tangerine', suit: '#ff9f1c', accent: '#14213d' },
  'lime': { name: 'Lime', suit: '#9be22d', accent: '#1f2d16' },
  'mint': { name: 'Mint', suit: '#4fe3b0', accent: '#5b2a86' },
  'teal-steel': { name: 'Teal Steel', suit: '#1d6f78', accent: '#ffb703' },
  'arctic': { name: 'Arctic', suit: '#dff3ff', accent: '#2563eb' },
  'cobalt': { name: 'Cobalt', suit: '#1e40af', accent: '#f97316' },
  'violet': { name: 'Violet', suit: '#9b5de5', accent: '#f15bb5' },
  'bubblegum': { name: 'Bubblegum', suit: '#ff8fc7', accent: '#5ee7ff' },
  'coral': { name: 'Coral', suit: '#ff6f61', accent: '#2a9d8f' },
  'chocolate': { name: 'Chocolate', suit: '#6b3e26', accent: '#ffcf70' },
  'forest': { name: 'Forest', suit: '#1f5130', accent: '#d4a017' },
  'shadow': { name: 'Shadow', suit: '#1c1c24', accent: '#e11d48' },
  'silver': { name: 'Silver', suit: '#b8c0cc', accent: '#0f172a' },
  'galaxy': { name: 'Galaxy', suit: '#2b1055', accent: '#7ee8fa' },
  'toxic': { name: 'Toxic', suit: '#39ff14', accent: '#111111' },
  'sunset': { name: 'Sunset', suit: '#f25f5c', accent: '#ffe066' },
  'ruby-gold': { name: 'Ruby & Gold', suit: '#9b111e', accent: '#ffd700' },
};

export const EMBLEMS: Record<string, string> = {
  star: '★', bolt: 'ϟ', heart: '♥', book: '📖', leaf: '❦', moon: '☾', atom: '⚛', crown: '♛', key: '⚷', diamond: '◆',
};
export const FREE_EMBLEMS = ['star'];

export const SHOP: ShopItem[] = [
  // ---- Color schemes & emblems (25) ----
  ...Object.entries(PALETTES).filter(([id]) => !FREE_PALETTES.includes(id)).map(([id, p]): ShopItem => ({
    id: `palette:${id}`, kind: 'palette', name: `${p.name} colors`, price: 25, label: 'Cosmetic',
    desc: 'A new suit color scheme.', look: { palette: id },
  })),
  ...Object.keys(EMBLEMS).filter((id) => !FREE_EMBLEMS.includes(id)).map((id): ShopItem => ({
    id: `emblem:${id}`, kind: 'emblem', name: `${id[0].toUpperCase() + id.slice(1)} emblem`, price: 25, label: 'Cosmetic',
    desc: 'A chest emblem for your suit.', look: { emblem: id },
  })),
  // ---- Capes, masks, small accessories (50) ----
  { id: 'cape:classic', kind: 'cape', name: 'Classic cape', price: 50, label: 'Cosmetic', desc: 'A flowing cape in your accent color.', look: { cape: 'classic' } },
  { id: 'cape:tattered', kind: 'cape', name: 'Storm cape', price: 50, label: 'Cosmetic', desc: 'A jagged, windswept cape.', look: { cape: 'storm' } },
  { id: 'cape:short', kind: 'cape', name: 'Short cape', price: 50, label: 'Cosmetic', desc: 'A short shoulder cape.', look: { cape: 'short' } },
  { id: 'mask:domino', kind: 'mask', name: 'Domino mask', price: 50, label: 'Cosmetic', desc: 'A classic eye mask.', look: { mask: 'domino' } },
  { id: 'mask:visor', kind: 'mask', name: 'Tech visor', price: 50, label: 'Cosmetic', desc: 'A glowing visor.', look: { mask: 'visor' } },
  { id: 'mask:cowl', kind: 'mask', name: 'Cowl', price: 50, label: 'Cosmetic', desc: 'A hood with pointed ears.', look: { mask: 'cowl' } },
  { id: 'gloves:power', kind: 'gloves', name: 'Boxing gloves', price: 50, label: 'Cosmetic', desc: 'Big padded boxing gloves.', look: { gloves: 'power' } },
  { id: 'boots:rocket', kind: 'boots', name: 'Rocket boots', price: 50, label: 'Cosmetic', desc: 'Boots with fins that leave a harmless trail of flames (looks only).', look: { boots: 'rocket' } },
  // ---- Shapeshifting (expensive): replaces the whole hero body ----
  { id: 'shape:blob', kind: 'shape', name: 'Goo Blob', price: 1500, label: 'Cosmetic', desc: 'Shapeshift into a wobbly, gooey blob in your suit colors. Looks only: your attributes and abilities stay the same.', look: { shape: 'blob' } },
  { id: 'shape:stickman', kind: 'shape', name: 'Stickman', price: 1500, label: 'Cosmetic', desc: 'Shapeshift into a quick-sketch stick figure. Looks only.', look: { shape: 'stickman' } },
  { id: 'shape:circuit-lynx', kind: 'shape', name: 'Circuit Lynx', price: 2500, label: 'Cosmetic', desc: 'Shapeshift into Circuit Lynx. Looks only.', look: { shape: 'circuit-lynx' } },
  { id: 'shape:granite-glove', kind: 'shape', name: 'Granite Glove', price: 2500, label: 'Cosmetic', desc: 'Shapeshift into Granite Glove. Looks only.', look: { shape: 'granite-glove' } },
  { id: 'shape:frost-finch', kind: 'shape', name: 'Frost Finch', price: 2500, label: 'Cosmetic', desc: 'Shapeshift into Frost Finch. Looks only.', look: { shape: 'frost-finch' } },
  { id: 'shape:prism-moth', kind: 'shape', name: 'Prism Moth', price: 2500, label: 'Cosmetic', desc: 'Shapeshift into Prism Moth. Looks only.', look: { shape: 'prism-moth' } },
  { id: 'shape:captain-gravity', kind: 'shape', name: 'Captain Gravity', price: 2500, label: 'Cosmetic', desc: 'Shapeshift into Captain Gravity. Looks only.', look: { shape: 'captain-gravity' } },
  { id: 'shape:copper-comet', kind: 'shape', name: 'Copper Comet', price: 2500, label: 'Cosmetic', desc: 'Shapeshift into Copper Comet. Looks only.', look: { shape: 'copper-comet' } },

  // ---- Ability Map: four branches. `requires.owns` / `ownsAny` are the tree links. ----
  // MIGHT
  { id: 'power:super-punch', kind: 'power', slot: 'active', branch: 'might', tier: 1, name: 'Super Punch', price: 100, label: 'Combat', desc: 'A giant boxing glove springs out of your fist on a coiled spring, smacks your opponent from a distance and knocks them back. Strength-scaled. Extra damage on a recovering or winding-up opponent.', requires: { blueprint: 'bp:super-punch' } },
  { id: 'power:ground-shockwave', kind: 'power', slot: 'active', branch: 'might', tier: 2, name: 'Ground Shockwave', price: 150, label: 'Combat', desc: 'Slam the floor so a line of jagged rock spikes bursts out of the ground, racing away in both directions. Higher levels make the line longer. Strength-scaled. Great against opponents that stay low.', requires: { blueprint: 'bp:ground-shockwave', owns: 'power:super-punch' } },
  { id: 'power:meteor-punch', kind: 'power', slot: 'active', branch: 'might', tier: 3, name: 'Meteor Slam', price: 220, label: 'Combat', desc: 'Rocket off the top of the screen, then dive onto your opponent as a flaming meteor. You cannot be hit during the leap, and the crash leaves a crater blast. Strength-scaled.', requires: { blueprint: 'bp:meteor-punch', owns: 'power:ground-shockwave' } },
  { id: 'power:titan-fist', kind: 'power', slot: 'active', branch: 'might', tier: 4, name: 'Titan Fist', price: 320, label: 'Combat', desc: 'Ultimate: a shadow marks your opponent, then a giant golden fist comes down from the sky and smashes them flat, sending shockwaves along the floor. Uses almost a full adrenaline bar. Huge Strength-scaled damage.', requires: { blueprint: 'bp:titan-fist', owns: 'power:meteor-punch', willpower: 21 } },
  // ENERGY
  { id: 'power:laser-eyes', kind: 'power', slot: 'active', branch: 'energy', tier: 1, name: 'Laser Eyes', price: 100, label: 'Combat', desc: 'Hold the button to fire a steady beam from your eyes. It drains adrenaline while you hold it, so a bigger Willpower meter means a longer beam. Willpower-scaled damage.', requires: { blueprint: 'bp:laser-eyes' } },
  { id: 'power:chain-lightning', kind: 'power', slot: 'active', branch: 'energy', tier: 2, name: 'Chain Lightning', price: 150, label: 'Combat', desc: 'Hold the button to pour crackling lightning into the nearest foe. It drains adrenaline while held, like Laser Eyes, but it homes in on its target and hits harder. A dodge or Ice Dash shakes it off for a moment. Willpower-scaled damage. Also pops decoys.', requires: { blueprint: 'bp:chain-lightning', owns: 'power:laser-eyes' } },
  { id: 'power:mega-laser', kind: 'power', slot: 'active', branch: 'energy', tier: 3, name: 'Flame Blast', price: 220, label: 'Combat', desc: 'Hurl a roaring fireball that explodes on impact and leaves the floor burning for a few seconds. Willpower-scaled damage.', requires: { blueprint: 'bp:mega-laser', owns: 'power:chain-lightning' } },
  { id: 'power:nova-storm', kind: 'power', slot: 'active', branch: 'energy', tier: 4, name: 'Supernova', price: 320, label: 'Combat', desc: 'Ultimate: burst into flames and zip across the arena in blazing diagonal streaks, burning anything you crash through. Hold up or down to steer. You cannot be hurt while it lasts. Uses almost a full adrenaline bar. Huge Willpower-scaled damage.', requires: { blueprint: 'bp:nova-storm', owns: 'power:mega-laser', willpower: 21 } },
  // MOTION
  { id: 'power:double-jump', kind: 'power', slot: 'movement', branch: 'motion', tier: 1, name: 'Double Jump', price: 75, label: 'Combat', desc: 'Jump once more in mid-air. Reach higher platforms and escape ground attacks.' },
  { id: 'power:ice-dash', kind: 'power', slot: 'active', branch: 'motion', tier: 3, name: 'Ice Dash', price: 200, label: 'Combat', desc: 'Skate forward on a trail of ice (safe while dashing). Any foe you pass through is frozen solid in a block of ice, held in place for 3 seconds.', requires: { blueprint: 'bp:ice-dash', owns: 'power:triple-jump' } },
  { id: 'power:triple-jump', kind: 'power', slot: 'movement', branch: 'motion', tier: 2, name: 'Hover', price: 150, label: 'Combat', desc: 'Keeps your double jump. Hold jump while falling to hover in the air on a glowing energy disc, then drift down. Hovers 1.2s, 1.6s or 2s per jump by level, and refills when you land.', requires: { blueprint: 'bp:triple-jump', owns: 'power:double-jump' } },
  { id: 'power:gravity-burst', kind: 'power', slot: 'movement', branch: 'motion', tier: 4, name: 'Super Speed', price: 260, label: 'Combat', desc: 'Equip it in your Movement slot and you run 1.5× faster all the time (1.7× at level 2, 2× at level 3), even past the normal top speed. It takes the Movement slot, so you give up the extra jumps.', requires: { blueprint: 'bp:gravity-burst', owns: 'power:ice-dash' } },
  // GUARD
  { id: 'power:energy-shield', kind: 'power', slot: 'passive', branch: 'guard', tier: 1, name: 'Energy Shield', price: 120, label: 'Combat', desc: 'A shield that absorbs damage, then recharges after a few seconds without being hit. Always on.', requires: { blueprint: 'bp:energy-shield' } },
  { id: 'power:hologram-decoy', kind: 'power', slot: 'active', branch: 'guard', tier: 2, name: 'Hologram Decoy', price: 160, label: 'Combat', desc: 'Summon a glowing clone of yourself that runs at your opponent and punches them. Opponents attack the clone instead of you until it has been hit 3 times.', requires: { blueprint: 'bp:hologram-decoy', owns: 'power:energy-shield' } },
  { id: 'power:phase-shift', kind: 'power', slot: 'active', branch: 'guard', tier: 3, name: 'Meditate', price: 220, label: 'Combat', desc: 'Hold the button to float cross-legged in a glowing calm. You cannot move, but your adrenaline refills very fast (faster at each level). Getting hit breaks your focus, so find a safe moment.', requires: { blueprint: 'bp:phase-shift', owns: 'power:hologram-decoy' } },
  { id: 'power:guardian-aura', kind: 'power', slot: 'active', branch: 'guard', tier: 4, name: 'Guardian Aura', price: 320, label: 'Combat', desc: 'Ultimate: a glowing aura that halves incoming damage and slowly heals you for several seconds.', requires: { blueprint: 'bp:guardian-aura', owns: 'power:phase-shift', willpower: 21 } },
];

export const SHOP_BY_ID: Record<string, ShopItem> = Object.fromEntries(SHOP.map((i) => [i.id, i]));

/** Human names for blueprints */
export const BLUEPRINT_NAMES: Record<string, string> = {
  'bp:laser-eyes': 'Laser Eyes', 'bp:super-punch': 'Super Punch', 'bp:ice-dash': 'Ice Dash',
  'bp:hologram-decoy': 'Hologram Decoy', 'bp:triple-jump': 'Hover', 'bp:ground-shockwave': 'Ground Shockwave',
  'bp:gravity-burst': 'Super Speed', 'bp:energy-shield': 'Energy Shield', 'bp:chain-lightning': 'Chain Lightning',
  'bp:mega-laser': 'Flame Blast', 'bp:meteor-punch': 'Meteor Slam', 'bp:nova-storm': 'Supernova', 'bp:titan-fist': 'Titan Fist',
  'bp:phase-shift': 'Meditate', 'bp:guardian-aura': 'Guardian Aura',
  'bp:armor-crystal': 'Crystal Armor look', 'bp:armor-champion': 'Champion Armor look',
};
export const BLUEPRINT_ITEM: Record<string, string> = Object.fromEntries(
  SHOP.filter((i) => i.requires?.blueprint).map((i) => [i.requires!.blueprint!, i.id]),
);

/** Learning achievements: Academy Rank milestones grant cosmetics, titles or blueprints. */
export const RANK_UNLOCKS: { rank: number; reward: { blueprint?: string; title?: string; free?: string }; text: string }[] = [
  { rank: 1, reward: { free: 'emblem:book', title: 'Word Cadet' }, text: 'Book emblem (free) and the title "Word Cadet"' },
  { rank: 2, reward: { blueprint: 'bp:energy-shield' }, text: 'Energy Shield blueprint' },
  { rank: 3, reward: { blueprint: 'bp:chain-lightning', free: 'palette:ocean', title: 'Sidekick Scholar' }, text: 'Chain Lightning blueprint, Ocean colors (free) and the title "Sidekick Scholar"' },
  { rank: 4, reward: { blueprint: 'bp:gravity-burst' }, text: 'Super Speed blueprint' },
  { rank: 5, reward: { blueprint: 'bp:phase-shift', title: 'Lexicon Guardian' }, text: 'Meditate blueprint and the title "Lexicon Guardian"' },
  { rank: 6, reward: { blueprint: 'bp:guardian-aura', free: 'cape:short', title: 'Vocabulary Champion' }, text: 'Guardian Aura blueprint, a short cape (free) and the title "Vocabulary Champion"' },
  { rank: 7, reward: { title: 'Legend of Words' }, text: 'The title "Legend of Words"' },
];
