# Nyah & Fifi's Tavern

A cozy, fully offline HTML5 Canvas 2D pixel-art idle tavern-management diorama game starring bossy catgirl head-maid **Nyah** and her loyal, easily flustered dog-girl maid **Fifi**.

- **Play Live on GitHub Pages**: https://woofsha.github.io/TavernNyah/
- **Repository**: https://github.com/Woofsha/TavernNyah

## Quick Start (One Command, Zero Build Step)

From this repository root:

```bash
python -m http.server 8000
```

Then open **http://localhost:8000** in any modern browser. Click any button on the title screen to unlock the procedural Web Audio synthesizer.

- **100% Offline Runtime**: Zero CDNs, zero external fonts, zero audio files, zero network calls. Every non-canon sprite, bitmap glyph, musical note, and sound effect is generated deterministically by code.

## Controls & Second-Monitor Features

| Input | Action |
| --- | --- |
| **Left Click (World)** | Inspect any staff member or customer live (opens **NPC Inspector** while the tavern keeps running) |
| **Left Click + Drag** | Pan camera across expanded tavern wings |
| **WASD / Arrow Keys** | Pan camera smoothly |
| **Mouse Wheel** | Scroll Shop upgrade/recipe cards (when hovering Shop) or pan vertically |
| **`H` Key** | Toggle **Ambient Mode** (hides all UI panels to watch the cozy tavern) |
| **`1` / `2` / `3` Keys** | Set simulation speed to **`1x` / `2x` / `4x`** |
| **`Space` / `Escape`** | Advance or skip the ~40s Story Intro; close open modals/inspector |

## Architecture & Directory Layout

- `index.html` & `src/` — Vanilla ES2022 runtime:
  - `src/main.js` — Offline resource loader, fixed-timestep loop (`DT = 0.1s`), background-tab catch-up, `localStorage` autosave (~20s) + Base64/JSON save export/import.
  - `src/sim.js` — Pure DOM-free simulation core (8-minute day/night cycle, economy, room expansions, recipe unlocks, offline earnings).
  - `src/actors.js` — Timeout-guarded finite state machines (`maxStateTimeout` recovery) for villagers, pre-quest & returning adventurers, veterans, merchants, nobles, maids, chefs, bartenders, musicians, and dancers.
  - `src/layout.js` — Multi-tier architectural floorplan builder (`32x32` base tile grid; expands from a `10x7` shack to a grand multi-wing hall with Kitchen, Adventurer Supply Counter, Great Timber Hall, Upstairs Lodging, Wine Cellar, Bardic Stage, and Garden Terrace).
  - `src/renderer.js` — `640x360` internal viewport, integer nearest-neighbor scaling, Y-sorting by `footY` (`anchor: [0.5, 1.0]`), pixel-ellipse contact shadows, canon sprite fallbacks, and toggleable atmosphere (dust motes, hearth embers, hot-food steam, swaying sign, flickering warm light pools, day/night tint, soft vignette).
  - `src/ui.js` & `src/font.js` — 9-slice wood & parchment pixel UI, code-generated 5x7 bitmap font, 5-tab Shop (`Tables`, `Build`, `Staff`, `Menu`, `Decor`), live **NPC Inspector**, skippable ~40s Story Intro, and dual-voice offline earnings summary.
  - `src/banter.js` & `src/npc_traits.js` — Cooldown-driven banter (92 lines), new-hire comedy skits squeezing Fifi in the middle, and seeded NPC thoughts/opinions.
  - `src/audio.js` — Procedural Web Audio cozy Stardew-inspired music (shifts across Morning/Afternoon/Evening/Night + dynamic Musician lute/harp stem fade-in) and 12 tactile SFX + per-speaker voice blips.
- `data/` — All balance numbers and player-facing text in pure JSON (`palette.json`, `recipes.json`, `upgrades.json`, `customers.json`, `staff.json`, `dialogue.json`, `thoughts.json`). Edit any JSON file and reload the browser to rebalance or rewrite without touching engine code.
- `tools/` — Deterministic asset generators & QA harnesses:
  - `python tools/gen_tavern_assets.py` — Generates 102 pixel-art props/tiles/icons/UI skins into `assets/tavern/`, validates strict palette/outline/alpha QA, and outputs `sheet.png` and `preview.png`.
  - `python tools/gen_npcs.py` — Generates 39 paper-doll NPC sprite sheets (`4x6` of `48x48`) and `64x64` bust portraits into `assets/npcs/`.
  - `python tools/validate_data.py` — Validates all `data/*.json` schemas and narrative/economy constraints.
  - `node tools/sim_economy.mjs` — Fast-forwards 6 hours of play and verifies purchase pacing gates (<60s first buy, ~10m first expansion, ~5h full unlock).
  - `node tools/soak_test.mjs` — Fast-forwards 8 simulated hours (`288,000` ticks) and asserts 0 stuck actors, 0 `NaN`, <20% heap growth, and save/offline round-trip integrity.
  - `node tools/browser_qa.mjs` — Launches Headless Chrome via CDP, verifies integer scaling and 0 console/page/HTTP errors, and captures live screenshots.

## Scale & Canon Sprite Notes

- Canon character sheets (`character sprites/nyah_world.png`, `fifi_world.png`, `portraits/nyah_native.png`, `fifi_native.png`) and `Ui Elements/freeversion.png` are preserved untouched and inventoried in `assets/characters/manifest.json`.
- World sprites measure `48x48` px per cell (~41–44px tall chibi 2-head proportions, ~20px foot width), so `32x32` px was selected as the base tile size on a `640x360` internal canvas (clean `2x` integer scale at `1280x720`, `3x` at `1920x1080`, `4x` at `2560x1440`).
