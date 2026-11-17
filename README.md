# Vocab Hero

A browser game for vocabulary at parent-selected levels, grades 2 to 9. Children learn words to earn **silver coins**, spend them on a superhero (attributes, powers, looks), and take on short 2D platform trials against six CPU heroes. Everything runs locally: no accounts, no network services, no ads, no real-money purchases.

## Run it

You need Node 18 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 154 automated checks
npm run build      # static site in dist/ (host anywhere, or open via any static server)
node scripts/validate-content.mjs   # check every vocabulary pack
```

Saves live in this browser's localStorage. **Parent area → Saves** downloads and uploads backups. Saves do not sync between devices.

## How it fits together

| Folder | Contents |
|---|---|
| `src/content/grades/gradeN.json` | Authored vocabulary: 40 words per grade, 320 in total, each with 5 practice items. Schema: `src/content/schema.ts`. Authoring rules: `CONTENT_GUIDE.md`. |
| `src/config/` | **All tuning**: `economy.ts` (rewards, attribute prices, mastery rule, review intervals, ranks), `combat.ts` (player kit, powers, adrenaline, difficulty modes, enemy tiers, Power Rating bands, milestone rewards), `shop.ts` (cosmetics, powers, blueprints, rank unlocks), `bosses.ts` (menu data for the six rivals). |
| `src/core/` | Pure logic with no UI, covered by tests: mastery/review, mission builder and answering, idempotent rewards and spending, shop and attributes, arena (matchmaking, fees, retries, unlocks), adrenaline meter, saves (versioned, validated, previous-save recovery), placement, parent word lists. |
| `src/combat/` | Phaser battle scene, arenas, and one state-machine file per CPU hero in `bosses/`. |
| `src/art/hero.ts` | A single layered, procedural sprite definition that renders both to SVG (menus) and to Phaser (battle), so equipped items always appear in fights. |
| `src/ui/` | React screens: Headquarters, Mission, Hero Profile (level-based attributes), Workshop, Arena, Battle, Word Book, Parent area, Placement. Open `#gallery` in dev to see every hairstyle, animation and boss sprite. |
| `tests/` | Vitest suites: mastery, missions and rewards, purchases and the level-99 cap, adrenaline, matchmaking tiers, entry fees and retries, save import/migration, content checks, and a headless run of every boss at every tier and difficulty (no crashes, all phases reached, readable warnings). |

### Adding words
Add entries to a grade pack (or a new pack file, which `src/core/content.ts` must import), following `CONTENT_GUIDE.md`. Then run `node scripts/validate-content.mjs`. Parents can also import their own lists in the app (Parent area → Word lists); each entry gets a review step for missing or ambiguous data.

### Adding a boss
1. Write a class extending `Boss` in `src/combat/bosses/`. It defines moves as telegraph / attack / recover steps and implements `pattern()` per phase.
2. Register it in `bosses/index.ts`.
3. Add its menu entry, arena and blueprint in `src/config/bosses.ts`, and its arena layout in `src/combat/arenas.ts`.

## Two versions

- **Website (GitHub Pages):** `npm run build` makes the normal multi-file site in `dist/`. Pushing to `main` on GitHub runs `.github/workflows/pages.yml`, which tests, builds and publishes it. Online play here uses PeerJS (direct device-to-device). Add `?relay` to the address to use relay play instead.
- **Google Sites:** `npm run build:sites` makes one self-contained file (`../vocab-hero-google-sites.html`). `.env.single` sets `VITE_NET=relay`, so its online play goes through a free public MQTT relay (EMQX, then HiveMQ, then Mosquitto over secure WebSockets, `src/net/relay.ts`), which works inside the Google Sites frame and on networks that block direct links. The host sends 15 updates a second through the relay (30 with PeerJS).

## Google Sites
`npm run build:sites` writes `../vocab-hero-google-sites.html`: the whole game in one plain-ASCII file (about 5.3 million characters, with compact copies of the battle and menu music). In Google Sites choose **Insert → Embed → Embed code**, paste the file's contents, then drag the embed box large. Saves live in that embedded page's browser storage, separate from any other copy of the game.

## Local multiplayer
Two heroes created on the same device share one screen (HQ → 🎮 2-Player, or the Arena page).
- **Versus**: hero vs hero, best of 3 rounds, in any arena. "Fair fight" (on by default) gives both heroes the same attributes; their own abilities still count.
- **Co-op**: both heroes against a rival at any tier either hero has reached. The rival has 1.6× health. A knocked-out hero gets back up after 8 seconds while their partner keeps fighting.
- Controls: Player 1 uses A/D/W/S + F punch, G dodge, R/T powers. Player 2 uses the arrows + K punch, L dodge, I/O powers. Two game controllers work too, and tablets get a touch pad in each corner.
- Friendly play only: no coins, entry fees or unlocks. Engine: `src/combat/fighter.ts` holds each hero's state; the scene runs every update per fighter.

## Online play (codes)
2-Player → **Online with a code** (a parent must switch on *Online play* in Parent area → Settings first; it is off by default).
- One player taps **Create room** and reads out the 5-character code; the other types it in **Join room**. The host picks the mode, arena or rival.
- Matchmaking uses the free public **PeerJS** broker (`0.peerjs.com`); after that the two devices connect directly over WebRTC. Only hero nickname, look, attributes, abilities and button presses are sent. There is no chat, and no coins or unlocks.
- The host's device runs the battle and streams a snapshot 30×/second; the guest sends button presses and mirrors the battle (`src/net/online.ts`, `BattleScene.getNetState` / `applyNetState`).
- Limits: the free broker has no uptime guarantee; some school or office networks block WebRTC; if the host's tab is hidden, the browser pauses the battle for both players.
- Every copy of the game has its own save, so the Google Sites copy needs *Online play* switched on in its own Parent area (on both players' devices).
- **Test connection** (under the room boxes) checks each step in turn: embedded-page restrictions, browser support, the matchmaking service, direct connections (STUN), the relay fallback (TURN), and a real test room created and joined on the same device. It names the step that fails.

## Battle systems
- **Abilities** cost little adrenaline (most fit easily in the starting 40-point meter); the ultimates (Titan Fist, Supernova, Guardian Aura) need Willpower 21 and use about 90% of that meter. Adrenaline refills by 4 per second on its own (paused while a held power is draining) plus a bonus for hits. Might attacks (Super Punch, Ground Shockwave, Meteor Slam, Titan Fist) multiply their damage by Strength; Energy attacks (Laser Eyes, Chain Lightning, Flame Blast, Supernova) multiply theirs by Willpower at the same rate (×1 at level 1, +0.025 per level, ×3.45 at 99). Laser Eyes and Chain Lightning are held: they drain adrenaline while the button is held. Chain Lightning homes in, but in 2-player a dodge or Ice Dash shakes it off and it cannot re-grab that hero for 0.7 s. Flame Blast throws an exploding fireball that leaves the floor burning; Titan Fist drops a giant fist from the sky onto a marked shadow; Supernova turns the hero into a fireball that zips across the arena in diagonals; Meteor Slam leaps off-screen and dives onto the opponent; Hologram Decoy summons a clone that fights until hit 3 times; Ice Dash skates on a trail of ice crystals and freezes what it passes through, holding it in place for 3 seconds; Hover (Movement slot, where Triple Jump used to be, same save ID) keeps the double jump and lets the hero hold jump while falling to hover for 1.2 / 1.6 / 2 s by level, refilled on landing; Super Speed (Movement slot, where Gravity Burst used to be, same save ID) makes the hero run 1.5×, 1.7× or 2× faster by level; Meditate (held, in the Guard branch where Phase Shift used to be, same save ID) floats the hero cross-legged and refills adrenaline at 20 / 26 / 32 per second by level, broken by any hit.
- **Looks** are bought in Workshop → Appearance (there is no separate shop). Boxing gloves, rocket boots (a harmless flame trail), capes, masks, emblems, 29 suit colors, and **Shapeshifting** (Goo Blob or Stickman, 1,500 coins; any of the six rivals, 2,500 coins), which changes the whole body in menus and battle but nothing about stats. Armor looks were retired; anyone who owned one gets 120 coins back once (`migrateProfile` in `src/core/save.ts`).
- **Ability Map** (Workshop → Powers): four branches (Might, Energy, Motion, Guard) with 16 abilities, tree prerequisites, blueprints from wins or Academy Rank, and 3 upgrade levels each (more damage, shorter cooldowns). Edit `SHOP` in `src/config/shop.ts`, `POWERS` / `POWER_LEVELS` in `src/config/combat.ts`. Icons: `src/ui/components/AbilityIcons.tsx`.
- **Arenas** (`src/combat/arenas.ts`): each has its own layout and gadgets: lifts, drifting platforms, crumbling ledges, bounce pads, conveyors, lava vents, rockfalls. Backdrops are painted in `src/combat/backgrounds.ts`.
- **Enemy AI** (`src/combat/bosses/Boss.ts`, tuning in `TIER_AI`): bosses react to what the player visibly does, after a reaction delay. They dodge, guard, counter-jab when you stand too close, chase onto platforms, escape corners, pick moves by distance, and get more aggressive when low. Every attack still has a readable warning (enforced by `tests/bosses.test.ts`).
- **Rendering**: battle characters are painted each frame on high-resolution canvases with gradient shading and glow (`src/combat/canvasArt.ts`); menus use the same shapes as SVG with matching gradients.
- `dev/bot.js` is a dev-only scripted player used for balance testing (not part of the build).

## Challenges

HQ → Challenges (green button under the Arena). Three action trials, played in order: each unlocks once the one before it is complete, and any can be replayed. Logic lives in `src/combat/challengeMode.ts` (plugged into `BattleScene` with the CPU hidden, like versus) and progress/rewards in `src/core/challenges.ts`.

1. **Balloon Pop** (Carnival arena): about 290 balloons rise over 1 minute; pop 100 by punching, using powers or touching them.
2. **Evade the Goo Blob** (Cold Laboratory): the Goo Blob (the shapeshift look) cannot be hurt, wakes after 3 s, chases at 50% → 75% of your run speed and only jumps (after a visible crouch) to reach you on a platform. One touch loses; survive 1 minute.
3. **Hero Horde** (Rooftop): six random-looking heroes at a time, 1 HP each, replaced as they fall; their punches are telegraphed. Defeat 100 in 2 minutes; being knocked out ends the attempt.

Every success gives a random cosmetic you don't own yet: rarity is rolled first (Common 60% for 25-coin items, Rare 28% for 50-coin items, Epic 9% for 1500-coin looks, Legendary 3% for 2500-coin looks), then an item of that rarity; if that rarity is all owned it steps down, then up. With everything owned it pays 100 coins. The developer console (type "oxymoron") has buttons to finish a running challenge and to unlock or reset challenges.

## Key rules as built
- **Attribute prices** per level: 20 (levels 2–10, Rookie), 40 (Bronze, 11–25), 70 (Silver, 26–50), 110 (Gold, 51–75), 160 (Platinum, 76–99). One attribute from 1 to 99 costs 9,120 Hero Points. Edit `ATTRIBUTE_COST_BANDS` in `src/config/economy.ts`.
- **Super Punch** fires a giant boxing glove on a spring from the hero's fist (about 230 px reach), with bonus damage on a recovering or winding-up opponent. **Ground Shockwave** sends a line of rock spikes bursting out of the floor both ways; each target is hit once.
- **Teach before testing:** every new word gets a word card, a hero scene, an everyday example, an example vs. non-example contrast, then a guided question. Independent questions in new contexts come later; "transfer" items are held for later missions.
- **Secure** requires at least 4 independent correct answers (no hints, not guided, at most one per item per day) on at least 3 dates, in at least 2 formats and 2 items, including a fresh-context item. All thresholds are in `MASTERY`. Review intervals are 1, 3, 7, 14 and 30 days. A mistake brings review forward without erasing history.
- **Rewards are idempotent.** Every payment and charge has a stable ID, so double taps, reloads and resumed lessons cannot pay or charge twice. Mistakes never cost points. Hints, read-aloud and Relaxed combat never reduce rewards.
- **Combat never pays spendable points.** First wins unlock blueprints (bought with Hero Points); higher-tier first wins unlock variants and titles once.
- **Matchmaking** uses a Power Rating built only from attributes (weighted, with a specialization bonus) plus a modest bonus for equipped powers. Grade, rank, reading support, cosmetics and unspent points are never inputs. Bands never move backwards. Opponent stats are locked when a match starts.

## Verification done
- 56 automated tests pass, and `tsc` is clean.
- Played in the browser: hero creation, a full mission (wrong answers, corrections, sentence building, typed recall with a spelling slip), a reload mid-mission (no double pay), purchases, the tutorial, a paid Circuit Lynx loss, then the free retry (resumed after an interruption with saved HP and adrenaline), then a win that unlocked the blueprint without buying it.
- A scripted bot using only the starting kit, with Speed raised to 6, beat **all six Rookie bosses**. It also beat an Elite fight with an all-35 build (about 170 seconds) and a three-phase Legendary fight with an all-95 build (about 190 seconds).
- Checked phone portrait (lessons, HQ) and phone landscape (battle with touch controls).

## Needs editorial review
- **All 320 words are original drafts marked `"review": "pending"`**. They are not curriculum-certified, and grade labels describe approximate difficulty only.
- Words whose entries mix two senses and may be better split into separate entries: *rhetoric, antithesis, benign* (grade 9); *reconcile, volatile, tenacious* (grade 8); *coincide, arbitrary* (grade 7); *decline, minor, sequence, threaten* (grade 5).
- Grade 4 example facts worth checking: Marie Curie's shed, the weight of Great Pyramid blocks, wood frogs freezing, killdeer broken-wing displays, London's 1800s sewers, hummingbird feeding frequency.
- The balance numbers (tier health, Power Rating bands, prices) were tuned against a scripted bot. Playtest with children before relying on them.
