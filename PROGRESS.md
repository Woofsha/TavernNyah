# Nyah & Fifi's Tavern — Progress & Verification Log

## Execution Plan
1. **Milestone 0 (Inventory & Frozen Foundation)**: Inventory canon sprites/portraits/UI into `assets/characters/manifest.json`, freeze `ARCHITECTURE.md`, `tools/palette.py` (`data/palette.json`), `tools/palette_chars.py`, `tools/draw_helpers.py`, `tools/qa_assets.py`, and `tools/validate_data.py`.
2. **Milestone 1 (Tavern Asset Pipeline & Visual Critique)**: Delegate modular prop/tile/icon generators (`tools/props_*.py`) to file-allowlisted `flash` workers, integrate `tools/gen_tavern_assets.py`, verify QA exit 0, render `sheet.png` and `preview.png`, and run 2 visual critique-and-fix passes.
3. **Milestone 2 (NPC Paper-Doll Generator & Playable Vertical Slice)**: Build `tools/gen_npcs.py` (matching Nyah & Fifi's 48x48 chibi scale & strict QA), delegate initial data tables, and assemble the Milestone 2 playable vertical slice (integer-scaled 640x360 diorama, Y-sort + shadows, Nyah, Fifi, Old Barnaby, starter tables, full autonomous customer loop, gold, early upgrades). Verify in headless Chrome.
4. **Milestone 3 (Full Economy, Expansions, Save/Offline & Sim Tuning)**: Complete all recipes, upgrades, visual building expansions (Kitchen, Supply Counter, Expanded Hall, Upstairs Rooms, Cellar, Stage, Garden), staff hires, autosave/import/export, offline summary, and tune via `tools/sim_economy.mjs` to hit pacing targets (<60s first buy, ~10m first expansion, ~5h full unlock).
5. **Milestone 4 (Adventurers, Quests, Richer Tiers, Rooms & Entertainers)**: Implement pre-quest ration/potion counter & quest board visits, returning adventurer room rentals, Veteran/Merchant/Noble tiers, and stage entertainers (Musician + Dancer).
6. **Milestone 5 (NPC Inspector, Thoughts/Opinions, Banter, Hire Skits & Story Intro)**: Build live NPC Inspector panel, overhead pixel emote bubbles, 90+ cooldown banter lines, 4 new-maid personality skits squeezing Fifi in the middle, and the skippable ~40s portrait story intro.
7. **Milestone 6 (Web Audio, Atmosphere, Title Screen, Settings & UI Polish)**: Integrate procedural cozy Stardew-style Web Audio music (with dynamic musician layer + day/night shifts) & SFX, toggleable atmosphere (dust motes, embers, steam, flickering hearth/lantern light pools, swaying sign, day/night tint, vignette), title screen, settings, ambient UI-hide mode, and 1x/2x/4x speed controls.
8. **Milestone 7 (8h Soak Test, Browser QA, Performance & README)**: Run 8-hour accelerated soak test (`tools/soak_test.mjs`: 0 stuck actors, 0 NaN, <20% heap growth), full headless Chrome walkthrough (`tools/browser_qa.mjs`: 0 console errors + visual screenshot audit), and write `README.md`.

---

## Assumptions & Canon Inspection Decisions
- **Canon World Sprites (`144x192`, `3x4` cells of `48x48`)**:
  - Row 0 = South (Down), Row 1 = North (Up), Row 2 = West (Left).
  - Row 3 has only one East-facing frame at `(2, 3)` while `(0, 3)` faces West and `(1, 3)` faces South (Nyah) / West (Fifi). **Fallback chosen**: flip Row 2 (`West`) horizontally at runtime for a smooth 3-frame East walk cycle, and use vertical bob + prop overlays (`ale_tray_three`, dish icons) for carrying/serving without touching canon PNG pixels.
  - **Style deviation recorded**: `nyah_world.png` and `fifi_world.png` contain ~7,470 downsampled colors, `(0,0,0,255)` pixels, and semi-transparent edge pixels from high-res source sheets (`660x880`). All newly generated props (`assets/tavern/`) and paper-doll NPCs (`assets/npcs/`) strictly obey 1x pixel-art QA rules (palette-only, zero pure black, binary 0/255 alpha, closed 1px hue-shifted outlines) while matching Nyah & Fifi's `48x48` cell size and ~41-43px 2-head chibi proportions.
- **Base Tile Size**: `32x32` px (`640x360` internal viewport, integer nearest-neighbor scaling + whole-pixel camera panning for expansions).
- **Starter Kitchen Loop**: So the autonomous `maid -> chef -> maid` loop runs immediately at second 0 before any staff purchases, the starter tavern includes Nyah, Fifi, and grumpy starter cook **Old Barnaby** at a rustic hearth pot; expansions and hires upgrade the kitchen and add sous-chefs, bartenders, maids, and entertainers.
- **Headless Browser**: Local Google Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) is available and verified with `--headless=new`; we will test both in Node (`tools/sim_economy.mjs`, `tools/soak_test.mjs`) and live Headless Chrome (`tools/browser_qa.mjs`).

---

## Milestone Log

### Milestone 0 — Character Inventory & Architecture
- **Status**: COMPLETE
- **Artifacts Created**:
  - `assets/characters/manifest.json` (inventories `nyah_world.png`, `nyah_big.png`, `fifi_world.png`, `fifi_big.png`, `nyah_native.png`, `nyah_full.png`, `fifi_native.png`, `fifi_full.png`, and `Ui Elements/freeversion.png` with exact cell rects and fallback rules).
  - `ARCHITECTURE.md` (stack, directory layout, frozen JSON schemas, FSM timeout contract, economy & rendering specs).
  - Frozen tooling foundation (`tools/palette.py`, `data/palette.json`, `tools/palette_chars.py`, `tools/draw_helpers.py`, `tools/qa_assets.py`, `tools/validate_data.py`).

### Milestone 1 — Tavern Asset Pipeline & Visual Critique
- **Status**: COMPLETE
- **Verification**:
  - `python tools/gen_tavern_assets.py` -> **exit 0** (`checked 104 items | errors=0 | warnings=0`, byte-identical across 2 runs, exported 102 PNGs + `assets/tavern/manifest.json` + `sheet.png` + `preview.png`).
  - `python tools/gen_npcs.py` -> **exit 0** (`checked 975 items | errors=0 | warnings=0`, exported 9 named staff + 30 diverse customer sheets & 64x64 busts + `assets/npcs/manifest.json` + `assets/npcs/npc_sheet.png`).
  - `python tools/validate_data.py` -> **exit 0** (`VALIDATION PASSED (all)`).
- **Visual Critique Passes (2/2 completed)**:
  - **Pass 1**: Inspected `sheet.png` (sliced into 3 readable regions) and `preview.png`. Fixed 1px strokes turning dark under `finalize_prop` on `chandelier`, `icon_upg_table`, and `icon_upg_build` by wrapping strokes with `outline()` prior to `finalize_prop`; deepened bar counter wooden recesses; enlarged hearth fire logs/flames; reshaped `roast_chicken_platter` drumsticks; upgraded `gen_npcs.py` 64x64 busts to tapered anime faces, feathered bangs, sloped shoulders, bunny ears on Clover, and rounded beard on Barnaby.
  - **Pass 2**: Re-inspected `sheet.png`, `npc_sheet.png`, and `preview.png`. Repositioned wall mounts and hanging `chandelier` in `preview.png` so both glowing windows (`tx=3` and `tx=9`) are unobstructed, and verified Nyah & Fifi's `48x48` canon sprites harmonize with the `32x32` plank floor, tables, stools, and contact shadows. Minor remaining note: `chandelier` slightly overlaps `painting_landscape` in `preview.png`'s static demo arrangement; in-game `src/layout.js` places them on non-overlapping tiles.

### Milestone 2 — NPC Paper-Doll Generator & Playable Vertical Slice
- **Status**: COMPLETE
- **Verification**:
  - `python tools/gen_npcs.py` -> **exit 0** (`checked 975 items | errors=0 | warnings=0`).
  - Starter vertical slice verified in Headless Chrome (`tools/browser_qa.mjs`): `640x360` internal viewport scaled `2x` integer to `1280x720` (`imageSmoothingEnabled = false`), Nyah + Fifi + Old Barnaby autonomous loop (`arrive -> seat -> order -> cook -> deliver -> eat -> pay -> leave`) earned `45g` across 3 served patrons in first 65s with **0 console errors**.

### Milestone 3 — Full Economy, Building Expansions, Save/Offline & Pacing Sim
- **Status**: COMPLETE
- **Verification**:
  - Normalized all 35 upgrade icons and 15 recipe icons against `assets/tavern/manifest.json`; `python tools/validate_data.py` -> **exit 0**.
  - Tuned mid/late progression curve in `data/upgrades.json`, `data/recipes.json`, and `data/customers.json` via `node tools/sim_economy.mjs` -> **exit 0**:
    - Gate 1 (First purchase <= 60s): **36.0s** -> **PASS**
    - Gate 2 (Early cadence 1–10m): **26 purchases, 19.8s avg gap** -> **PASS**
    - Gate 3 (First expansion `exp_kitchen` ~10m): **11.10m** -> **PASS**
    - Gate 4 (Full progression unlock ~5h): **5.40h** (`exp_garden` at `4h 54m`, final prestige chandelier at `5h 23m`) -> **PASS**
  - Verified `localStorage` autosave (~20s), Base64/JSON save export/import, background-tab catch-up, and capped reduced-rate offline earnings modal (`live_06_offline_modal.png`).

### Milestone 4 — Adventurers, Quests, Richer Tiers, Rooms & Entertainers
- **Status**: COMPLETE
- **Verification**:
  - Pre-quest adventurers inspect `quest_board_full` and purchase rations/potions (`4,398` sold in 8h soak); returning adventurers carry bonus loot, trigger `quest_return` banter, and rent upstairs beds overnight (`1,522` rooms rented in 8h soak).
  - Verified Veteran Adventurer, Merchant, and Noble patron tiers plus stage entertainers **Lyra** (musician) and **Soleil** (dancer) boosting patience, mood, and tips (`live_05_grand_tavern.png`, `live_07_upstairs_night.png`).

### Milestone 5 — Live NPC Inspector, Thoughts/Opinions, Banter, Hire Skits & Story Intro
- **Status**: COMPLETE
- **Verification**:
  - Skippable `39.5s` 10-beat portrait Story Intro (`15.5s` continuous Fifi protest + `3.5s` silent stern Nyah glare) verified in `live_02_intro.png`.
  - 92 cooldown-driven banter lines + 8 personality-specific new-hire comedy skits (`flustered` Clover, `defiant` Roxie, `delighted` Pippa, `unimpressed` Velvet squeezing Fifi in the middle) verified in `data/dialogue.json` & live ticker.
  - Live **NPC Inspector** (`live_04_inspector.png`) displays portrait/bust, name, class/archetype, level, gold, mood bar, current activity, favorite dish, live thought (160 variants across 16 situations), 5 dynamic opinions (60 variants), and recent events while the game continues running.

### Milestone 6 — Procedural Web Audio, Atmosphere, Settings & UI Polish
- **Status**: COMPLETE
- **Verification**:
  - `src/audio.js` synthesizes 4 day-phase cozy progressions, smoothly fades in the dynamic Musician lute/harp stem when `sim.isMusicianPerforming` is active, scales crowd murmur & hearth crackle, and plays 12 SFX + per-speaker dialogue blips.
  - Toggleable atmosphere (dust motes, fireplace embers, hot-food steam, swaying tavern sign, flickering warm light pools, day/night tint, pixel-stepped vignette), Ambient UI-hide mode (`[H]`), `1x/2x/4x` speed toggle, and `30/60 FPS` idle cap verified (`live_08_settings_modal.png`).
  - **Runtime Visual Critique Passes (2/2 completed)**:
    - **Pass 1**: Inspected `live_01..06` in `browser_v1`. Added missing `|` and `^` bitmap glyphs in `src/font.js`; adjusted `bard_stage` `sortY` so Lyra & Soleil render cleanly atop the stage platform; moved `sign_tavern` to upper wall and `lamppost` beside cobble walkway; expanded Shop card height to `48px` to eliminate subtitle/button touch; made overhead speech bubbles auto-height up to 6 lines and suppressed them behind modals; wrapped NPC Inspector opinions to 2 lines.
    - **Pass 2**: Re-inspected `live_01..08` in `browser_v2`. Caught and fixed `ext_tree_l` overlapping the expanded Supply Counter floor when `counter_shop` was unlocked before `garden`; re-verified clean exterior placement in `live_07_upstairs_night.png`. Remaining minor roughness: very long 2-sentence NPC opinion strings clip cleanly at 2 lines inside the `220px` left inspector so all 5 opinions + recent events fit simultaneously on `640x360` without scrolling.

### Milestone 7 — 8h Soak Test, Full QA Gate Sweep & Delivery
- **Status**: COMPLETE
- **Final Deterministic Exit Gate Sweep**:
  - `python tools/gen_tavern_assets.py` -> **exit 0** (`104 items | errors=0 | warnings=0`)
  - `python tools/gen_npcs.py` -> **exit 0** (`975 items | errors=0 | warnings=0`)
  - `python tools/validate_data.py` -> **exit 0** (`VALIDATION PASSED (all)`)
  - `node tools/sim_economy.mjs` -> **exit 0** (`First buy 36.0s, Kitchen 11.10m, Full unlock 5.40h`)
  - `node tools/soak_test.mjs` -> **exit 0** (`8.0h / 288,000 ticks in 0.89s, 20,258 served, 0 stuck actors, 0 NaN, 4.84% heap growth < 20%`)
  - `node tools/browser_qa.mjs` -> **exit 0** (`0 console errors, 0 page exceptions, 0 HTTP failures, 2x integer pixel scaling`)
  - Raw hex scan outside `tools/palette.py` (`data/palette.json`) & `tools/palette_chars.py` -> **0 violations**.

### Post-Review Batch 1 — Guest Flow Retune (`B1` + `B4`), Sprite Identity (`A1`) & Layout Fixes (`A2` + `A3`)
- **Status**: COMPLETE
- **Changes & Verification**:
  - **Guest Flow & Reputation Ramp (`#1`: `B1` + `B4`)**: Decoupled guest spawn rate from `seatCap` in `src/sim.js` (`getTargetGuestsPerMin()`), driving arrivals by fame (`reputation`), `ambience`, unlocked building expansions, and `dayPhase` with a `10.0s` opening delay. Retuned `repReward`, `minRep`, and phase weights in `data/customers.json`, plus upgrade/recipe progression costs in `data/upgrades.json` and `data/recipes.json`.
    - `0–3 min`: **`2.67 guests/min`** (`2–3/min` target), **`100%` Villagers**, **`6.4%` average seat occupancy** (`<=35%` target; buying tables leaves visible open seats).
    - `3–10 min`: **`3.57 guests/min`** (`3–5/min` target), first **Rookie Adventurer** arrives at **`6.52m`** (`6–8m` target).
    - `Post-Kitchen`: **`7.27 guests/min`** (`5–8/min` target), **`36.8%` adventurer share** (`~33%` target).
    - All 4 economy gates pass (`First buy 34.0s`, `1–10m avg gap 48.3s`, `Kitchen 10.50m`, `Full unlock 5.44h`).
  - **Guest Sprite & Folk Identity (`#2`: `A1`)**: Updated `generateCustomerProfile` in `src/npc_traits.js` to select from the 6 pre-generated sheets dedicated to each `archetypeSpec.id` (`cust_00..cust_29`) and bind the exact `folk` rendered on that sprite (`9,889 / 9,889 = 100%` match verified).
  - **Layout Fixes (`A2` + `A3`)**: Ordered `candidateTableCoords` in `src/layout.js` strictly along the expansion dependency chain so existing tables never shift slots when expansions unlock, and kept `maidIdleSpots[4]` inside the main room until `counter_shop` is unlocked.

### Post-Review Batch 2 — Shop Card Layout (`A5`), Cutaway Walls & Facades (`A4`), Upgrade Visuals (`B2`), Regulars & Adventurer Parties (`C1` + `A6`), and Audio/Banter Polish (`B6`)
- **Status**: COMPLETE
- **Changes & Verification**:
  - **Shop Card Layout Overhaul (`#3`: `A5`)**: Expanded shop cards in `src/ui.js` (`64px` height on regular tabs, `55px` on Building tab) with a dedicated right-aligned `levelBadge`, 2-line wrapped complete descriptions (`_conciseUpgradeSubline` with live stat readouts), and concise requirement labels (`_shortReqLabel`), eliminating all mid-word truncation across all 5 shop tabs (`live_03_starter_tavern.png`, `live_04_inspector.png`, `live_09_building_tab.png`).
  - **Cutaway Walls & Exterior Facade Banner (`A4`)**: Added `_drawCutawayBorderWalls` in `src/renderer.js` to frame the interior wood/stone floor and front doorway with timber cutaway wall sills, and rendered `facade_t1..t4` in an Exterior Tier banner at the top of the Building shop tab (`src/ui.js`).
  - **Visible World Feedback for Early Upgrades (`#4`: `B2`)**: Added `ale_tray_three` on the bar + animated beeswax shine glints on the bar and tables when `decor_polish > 0`, `drying_rack_herbs` above the stove when `train_chefs > 0`, `quest_board_full` when `town_crier > 0`, and floating world stat popups + staff `emote_sparkle` on every upgrade purchase (`src/sim.js`, `src/layout.js`, `src/renderer.js`).
  - **Returning Regulars, Adventurer Party Waves & Lane Offsets (`#5`: `C1` + `A6`)**: Added `this.regularsRoster` (up to 20 returning patrons tracking `visits`, `affinity`, and favorite dish orders), 2-to-3 person Adventurer Party waves (`this.partyQueue` + `preferredTableIndex` seating together), and lateral `laneOffsetX` in `src/actors.js` and `src/sim.js`.
  - **Banter De-duplication & Audio Polish (`B6`)**: Suppressed duplicate overhead world speech bubbles unless in `[H]` Ambient Mode (`src/main.js`), wired active walking footsteps (`audio.playSfx('footstep')`), and added `'expansion_fanfare'` (`_sfxExpansionFanfare`) + camera focus + celebratory ember burst when unlocking any building wing (`src/audio.js`, `src/ui.js`, `src/main.js`).
  - **QA Gate Sweep**: `python tools/validate_data.py` -> **exit 0**; `node tools/sim_economy.mjs` -> **exit 0** (`34.0s` first buy, `10.87m` Kitchen, `5.44h` full unlock, `9,872/9,872` sprite/folk match); `node tools/soak_test.mjs` -> **exit 0** (`0` stuck, `0` NaN, `5.09%` heap growth); `node tools/browser_qa.mjs` -> **exit 0** (`0` console/page/HTTP errors).

