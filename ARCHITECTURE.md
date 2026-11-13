# Nyah & Fifi's Tavern — Architecture & Frozen Contracts

## 1. Stack & Runtime Constraints
- **Runtime**: Vanilla ES2022 JavaScript modules + HTML5 Canvas 2D (`index.html` + `src/*.js`), zero build step, zero external libraries, zero network calls or CDNs.
- **Launch Command**: `python -m http.server 8000` from repository root, open `http://localhost:8000`.
- **Asset Pipeline**: Python 3.12 + Pillow (`PIL`). Deterministic seeded generation (`random.Random(seed)`), 1x pixel drawing only, nearest-neighbor upscaling only for contact sheets.
- **Headless Verification**: Node.js (`v24+`) runs `src/sim.js` directly in headless mode (`tools/sim_economy.mjs`, `tools/soak_test.mjs`) and drives local headless Chrome via CDP (`tools/browser_qa.mjs`) to verify zero console errors and capture runtime screenshots.

## 2. Scale, Resolution & Visual Rules
- **Canon Character Measurements**:
  - `character sprites/nyah_world.png` & `fifi_world.png`: `144x192` (`3x4` cells of `48x48` px). Visual height `41-44` px, chibi ~2-head proportions, anchor `(0.5, 1.0)`.
  - Missing East walk cycle in Row 3 is handled at runtime by flipping Row 2 (West) horizontally (`ctx.scale(-1, 1)`). Original canon PNGs are never modified or resampled; runtime prefers pre-slimmed `nyah_world_small.png` & `fifi_world_small.png` (~14% smaller in-cell figures inside matching `144x192` sheets) so Nyah & Fifi match generated NPC proportions cleanly.
- **Base Tile**: `32x32` px (`TILE_SIZE = 32`). Fits 48x48 chibi character footprints (~20px wide feet) comfortably in 1-tile aisles.
- **Internal Viewport**: `640x360` px (`INTERNAL_W = 640`, `INTERNAL_H = 360`), scaled to the browser window using **integer scale factors only** (`Math.max(1, Math.floor(Math.min(winW / 640, winH / 360)))`), centered with letterbox/pillarbox, `ctx.imageSmoothingEnabled = false`, CSS `image-rendering: pixelated`.
- **Camera**: Integer pixel coordinates `(Math.round(camX), Math.round(camY))`. Supports drag-pan, WASD/Arrow keys, and room quick-focus buttons as building expansions grow the tavern footprint from `10x7` tiles up to `26x16` tiles.
- **Y-Sorting & Contact Shadows**:
  - Every world prop and character uses `anchor: [0.5, 1.0]` (bottom-center of footprint) and sorts by `footY` (`entity.y`). Sleeping upstairs patrons sort slightly ahead of bed headboards (`footY = c.y + 2`) and clip to the top `29px` so faces rest cleanly on pillows behind bed covers.
  - Cutaway border walls (`_drawCutawayBorderWalls`) follow continuous outer corner sills and match stone (`floor_kitchen`, `floor_cellar`) vs timber flooring cleanly.
  - Engine renders a crisp pixel-ellipse contact shadow directly beneath every Y-sorted dynamic actor and free-standing prop before drawing its sprite (no baked shadows in PNGs, omitted for tucked sleepers).
- **Art Rules (All Generated PNGs)**:
  - Palette-only pixels (`tools/palette.py` for tavern/UI, `tools/palette_chars.py` for generated NPCs). Never raw hex outside palette modules; never `#000000`.
  - Binary alpha (`0` or `255` only).
  - Closed 1px hue-shifted outlines (`OUTLINE_WARM`, `OUTLINE_COOL`, `OUTLINE_LEAF`) on all 4-neighbor outer edges and image borders for non-tileable props/characters.
  - Top-left directional lighting: highlights on top/left faces, cool-leaning shadows on bottom/right faces.

## 3. Repository File Tree
```text
TavernNyah/
├── index.html                      # Offline entry point, integer-scaled canvas + native <dialog id="save-dialog">
├── ARCHITECTURE.md                 # Frozen specs, schemas, module boundaries (Primary Agent)
├── CHANGELOG.md                    # Release changelog (v1.0.0 -> v1.1.0)
├── PROGRESS.md                     # Milestone log, assumptions, visual critique notes
├── README.md                       # How to run, controls, architecture & modding guide
├── sheet.png                       # 4-col 8x nearest-neighbor labeled asset contact sheet
├── preview.png                     # Y-sorted tavern diorama preview with contact shadows
├── character sprites/              # Canon world/big sheets + slimmed worldSheetSmall variants
├── tests/
│   └── regression_suite.mjs        # 23 automated invariant checks (data, sim, UI, audio, layout)
├── portraits/                      # Untouched canon portraits
├── Ui Elements/                    # Untouched supplied pixel UI sheet
├── assets/
│   ├── characters/manifest.json    # Canon sprite/portrait/UI inventory & frame map
│   ├── tavern/                     # Generated tavern props, tiles, icons + manifest.json
│   └── npcs/                       # Generated paper-doll NPC sheets, busts + manifest.json
├── data/
│   ├── palette.json                # Auto-mirrored from tools/palette.py
│   ├── schemas.json                # Frozen JSON structure definitions
│   ├── recipes.json                # 14+ dishes, drinks, rations, potions
│   ├── upgrades.json               # Tables, building expansions, staff slots/training, decor
│   ├── customers.json              # Villagers, rookie/veteran adventurers, merchants, nobles
│   ├── staff.json                  # Nyah, Fifi, Old Barnaby + hireable maids/chefs/bard/dancer
│   ├── dialogue.json               # Story intro, 90+ banter lines, hire skits, offline text
│   └── thoughts.json               # Seeded names, 8+ live thoughts/situation, 8+ opinions/topic
├── tools/
│   ├── palette.py                  # Frozen 43-color tavern & UI palette
│   ├── palette_chars.py            # Frozen 46-color NPC paper-doll palette
│   ├── draw_helpers.py             # Frozen 1x pixel drawing, shading, dither, stamp, outline
│   ├── qa_assets.py                # Frozen deterministic PNG & manifest QA validator
│   ├── validate_data.py            # Frozen JSON schema & cross-reference validator
│   ├── props_core.py               # Original 12 required tavern props
│   ├── props_structure_furniture.py# Tileable floors/walls, 4-tier tables, beds, facades, trees
│   ├── props_kitchen_decor_icons.py# Kitchen, stage, decor, 16x16 icons, emotes, 9-slice UI
│   ├── gen_tavern_assets.py        # Registry assembler, QA runner, sheet.png & preview.png
│   ├── gen_npcs.py                 # Seeded paper-doll NPC + bust + trait generator & QA
│   ├── sim_economy.mjs             # Headless 6h pacing simulator & timeline verifier
│   ├── soak_test.mjs               # Headless 8h max-speed soak test (stuck/NaN/heap check)
│   └── browser_qa.mjs              # Headless Chrome CDP console-error & screenshot harness
└── src/
    ├── main.js                     # Bootloader, asset/JSON loader, fixed-timestep loop, save IO
    ├── sim.js                      # Pure DOM-free simulation state, day/night, economy, quests
    ├── actors.js                   # Timeout-guarded FSMs for customers, maids, chefs, bards
    ├── layout.js                   # Multi-tier tavern floorplans, expansion geometry, waypoints
    ├── npc_traits.js               # Deterministic seeded traits, live thoughts, opinions
    ├── banter.js                   # Cooldown-driven banter, rush/complaint reactions, hire skits
    ├── renderer.js                 # Integer-scaled 2.5D renderer, Y-sort, shadows, atmosphere
    ├── font.js                     # Crisp code-generated pixel bitmap font (ASCII + punctuation)
    ├── ui.js                       # 9-slice HUD, shop tabs, NPC inspector, intro, offline modal
    └── audio.js                    # Generative cozy Web Audio music (+ musician layer) & SFX
```

## 4. Frozen JSON Data Schemas (`data/`)

### 4.1 `data/recipes.json`
`{ "recipes": [ RecipeSpec ] }`
- `id`: `string` (snake_case unique ID)
- `name`: `string`
- `category`: `"drink" | "food" | "ration" | "potion"`
- `station`: `"bar" | "kitchen" | "counter"`
- `tier`: `1 | 2 | 3 | 4`
- `price`: `integer >= 2`
- `cookTime`: `number` (seconds, `0.4` to `8.0`)
- `unlockCost`: `integer >= 0` (`0` = unlocked at start)
- `repRequired`: `number >= 0`
- `requiredExpansion`: `string | null` (expansion upgrade `id` or `null`)
- `icon`: `string` (16x16 asset name in `assets/tavern/manifest.json`)
- `worldProp`: `string` (prop shown on table/tray, e.g. `"ale_tray_three"` or `"roast_chicken_platter"` or icon)
- `desc`: `string`

### 4.2 `data/upgrades.json`
`{ "upgrades": [ UpgradeSpec ] }`
- `id`: `string`
- `name`: `string`
- `tab`: `"tables" | "building" | "staff" | "decor"`
- `kind`: `"repeatable" | "one_off" | "expansion" | "staff_hire"`
- `baseCost`: `integer >= 5`
- `costGrowth`: `number` (`1.0` for one-offs; `1.12` to `1.25` for repeatables)
- `maxLevel`: `integer >= 1` (`1` for one-offs/expansions/named hires)
- `repRequired`: `number >= 0`
- `requires`: `string | null` (prerequisite upgrade `id`)
- `icon`: `string`
- `effect`: `{ "type": string, "value": number | string, "secondary"?: object }`
  - Allowed `effect.type`: `"add_table"`, `"table_tier"`, `"unlock_room"`, `"hire_staff"`, `"maid_speed"`, `"chef_speed"`, `"ambience_bonus"`, `"rep_gain_mult"`, `"drink_price_mult"`, `"food_price_mult"`, `"bed_tier"`, `"patron_spawn_rate"`.
- `nyahComment`: `string` (short reaction toast when bought)
- `desc`: `string`

### 4.3 `data/customers.json`
`{ "archetypes": [ CustomerArchetype ], "dayPhases": [ DayPhaseSpec ] }`
- `CustomerArchetype`:
  - `id`: `"villager" | "adventurer_rookie" | "adventurer_veteran" | "merchant" | "noble"`
  - `name`: `string`
  - `minRep`: `number >= 0`
  - `requiredExpansion`: `string | null`
  - `levelRange`: `[int, int]`
  - `goldRange`: `[int, int]`
  - `patienceSec`: `number` (`25` to `65`)
  - `tipMultiplier`: `number` (`0.1` to `0.6`)
  - `repReward`: `number`
  - `preferredCategories`: `string[]`
  - `maxRecipeTier`: `1 | 2 | 3 | 4`
  - `wantsQuestSupplies`: `number` (`0.0` to `1.0` probability pre-quest)
  - `wantsRoomNight`: `number` (`0.0` to `1.0` probability in evening/night)
  - `spawnWeightsByPhase`: `{ "morning": number, "afternoon": number, "evening": number, "night": number }`
  - `outfitPool`: `string[]`
- `DayPhaseSpec`:
  - `id`: `"morning" | "afternoon" | "evening" | "night"`
  - `startNorm`: `number` (`0.0` to `1.0` across the 480s = 8-minute day cycle)
  - `endNorm`: `number`
  - `spawnRateMult`: `number`
  - `ambientTint`: `[r, g, b, alpha]`

### 4.4 `data/staff.json`
`{ "canonStaff": [ StaffSpec ], "hireableStaff": [ StaffSpec ] }`
- `id`: `string`
- `name`: `string`
- `role`: `"maid" | "chef" | "bartender" | "musician" | "dancer"`
- `personality`: `"tsundere_boss" | "meek_loyal" | "grumpy_vet" | "flustered" | "defiant" | "delighted" | "unimpressed" | "jolly" | "stoic" | "dramatic" | "graceful"`
- `moveSpeed`: `number` (px/sec, e.g. `58` to `90`)
- `workSpeed`: `number` (multiplier `0.85` to `1.6`)
- `tipBonus`: `number` (`0.0` to `0.20`)
- `seed`: `integer` (used by `gen_npcs.py` for non-canon hires)
- `bio`: `string`

### 4.5 `data/dialogue.json`
`{ "intro": [ IntroBeat ], "banter": [ BanterLine ], "hireScenes": { [staffId]: [ ScriptBeat ] }, "offlineTemplates": [ OfflineTemplate ] }`
- `IntroBeat`: `{ "speaker": "nyah" | "fifi" | "narrator", "portrait": "nyah" | "fifi" | null, "mood": string, "durationSec": number, "text": string }` (total duration ~40s; includes ~15s continuous Fifi protest sequence followed by Nyah's silent stern glare beat and Fifi folding).
- `BanterLine`: `{ "id": string, "trigger": "idle" | "rush" | "complaint" | "upgrade" | "expansion" | "big_tip" | "morning" | "night" | "music" | "quest_return", "speaker": string, "replySpeaker"?: string, "text": string, "replyText"?: string, "cooldownSec": number }` (MUST contain **80+ entries**).
- `hireScenes[staffId]`: Array of `{ "speaker": string, "text": string, "emote"?: string }` depicting Nyah trying to boss the new hire, the hire's personality-specific reaction (`flustered`, `defiant`, `delighted`, `unimpressed`), and Fifi getting squeezed in the middle.
- `offlineTemplates`: `{ "minMinutes": number, "nyahText": string, "fifiText": string }` with `{gold}`, `{minutes}`, `{customers}` placeholders.

### 4.6 `data/thoughts.json`
`{ "namesByFolk": { [folk]: { "first": string[], "last": string[] } }, "liveThoughts": { [situation]: string[] }, "opinions": { "tavern": TieredText, "food": TieredText, "prices": TieredText, "nyah": TieredText, "fifi": TieredText } }`
- Every `liveThoughts[situation]` array MUST have **>= 8 templates**.
  - Required situations: `"entering"`, `"waiting_to_order"`, `"waiting_for_food"`, `"eating_happy"`, `"eating_unimpressed"`, `"buying_supplies"`, `"heading_on_quest"`, `"returned_from_quest"`, `"renting_room"`, `"sleeping"`, `"enjoying_entertainment"`, `"leaving_happy"`, `"leaving_upset"`, `"maid_working"`, `"chef_working"`, `"entertainer_working"`.
- Every `opinions[topic]` (`TieredText = { "low": string[], "mid": string[], "high": string[] }`) MUST have **>= 8 templates** across its state/trait buckets (`>= 3` per tier, `>= 9` total per topic).

## 5. Actor State Machine & Timeout Recovery Contract
Every dynamic actor holds `(state, stateTimer, maxStateTimeout)`:
1. **Customer**: `ENTERING` (12s) -> `SEEKING_SEAT` / `AT_COUNTER` / `AT_QUEST_BOARD` (10s) -> `WAITING_TO_ORDER` (patience, ~35s) -> `ORDER_TAKEN_WAITING_FOOD` (patience, ~45s) -> `EATING` (8-14s) -> (`SEEKING_ROOM` [22s, `stairPhase` stair walk] -> `SLEEPING` 25-45s at night if room available) -> `PAYING` (12s when descending stairs / 2s downstairs) -> `LEAVING` (15s) -> `DESPAWNED`.
   - **Recovery**: Any state exceeding `maxStateTimeout` logs a recovery transition (never hangs): waiting patrons lose mood and transition cleanly to `LEAVING`; walking actors blocked or delayed snap to waypoint and advance.
2. **Maid (Nyah, Fifi, Hires)**: `IDLE` -> `WALK_TO_PATRON` (10s) -> `TAKING_ORDER` (1.2s) -> `SUBMIT_ORDER` -> `WALK_TO_PICKUP` (10s) -> `CARRYING_TO_PATRON` (10s) -> `SERVING` (0.8s) -> `CLEANING_TABLE` (1.5s) -> `IDLE`.
3. **Chef / Bartender**: `IDLE` -> `PREP_ORDER` (`cookTime / workSpeed`, max 15s) -> `PLATE_READY` -> `IDLE`.
4. **Entertainer (Musician / Dancer)**: `IDLE_REST` (8s) -> `WALK_TO_STAGE` (10s) -> `PERFORMING` (25s; activates ambient mood/tip aura + Web Audio musician stem) -> `IDLE_REST`.

## 6. Economy & Idle Catch-Up Formulas
- **Repeatable Cost**: `Math.floor(baseCost * Math.pow(costGrowth, level))` with `costGrowth` in `[1.14, 1.24]`.
- **Fixed Timestep**: `DT = 0.1` s (10 Hz deterministic simulation ticks; renderer interpolates at 60 FPS or user-selected 30 FPS idle cap). Background tab catch-up runs fast-forward ticks up to 15 minutes seamlessly; longer absences compute capped reduced-rate offline earnings (`min(elapsedSec, 8 * 3600) * avgGoldPerSec * 0.45`) and present the Nyah & Fifi "While You Were Away" modal.
