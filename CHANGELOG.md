# Changelog

All notable changes to **Nyah & Fifi's Tavern** are documented in this file.

## v1.1.0 (2026-11-13)

### Added & Upgraded
- **Settings & Game Version UI (`src/ui.js`)**:
  - Renamed top-bar `Menu` button to `Settings` so it no longer collides with the Shop `Menu` recipe tab.
  - Added `GAME_VERSION` (`v1.1.0`) displayed directly in the Settings modal footer.
  - Added live `Music: NEW/OLD` toggle in Settings to compare the upgraded 8-bar acoustic hall arrangement with the classic 4-bar synth.
  - Added native HTML `<dialog id="save-dialog" closedby="any">` in `index.html` for Save Export/Import.
- **Audio Overhaul (`src/audio.js`)**:
  - Upgraded procedural music to an 8-bar stereo acoustic hall arrangement with percussion across Morning/Afternoon/Evening/Night plus dynamic Musician layer fade-in.
  - Rebuilt all 12 `_sfx*` synthesizers (`mug`, `footstep`, `coin`, `doorbell`, `sizzle`, `fire_crackle`, `click`, `hover`, `tab`, `upgrade`, `expansion`, `complaint`) and per-speaker `_sfxBlip` voices through a warm `2200 Hz` (`Q=0.55`) lowpass filter (`sfxWarmFilter`), eliminating harsh high frequencies and raw sawtooth/square dialogue buzzers.
- **Slimmed Maid World Sprites (`character sprites/`, `assets/characters/manifest.json`, `src/renderer.js`)**:
  - Added `nyah_world_small.png` and `fifi_world_small.png` (`~14%` slimmed figures inside matching `144x192` / `48x48`-cell sheets) so Nyah and Fifi align cleanly with generated paper-doll NPC proportions while preserving the original canon sheets untouched.
- **Regression Suite (`tests/regression_suite.mjs`)**:
  - Added 23 automated Node invariant checks covering data cross-references, deterministic sim replay, FSM timeouts/shared-table/orphan-order recovery, hostile save sanitization, UI hitbox clipping/scrolling, north `wallMount` non-overlap, crisp `0.5px` strokes, `Music: NEW/OLD`, wing layouts, sleeper crop/depth sort, and warm SFX envelopes.

### Fixed
- **Corner Cutaway Walls (`src/renderer.js`)**: Connected cutaway side border walls cleanly with 64px north back walls at top-left/top-right corners and matched stone cutaway borders (`STONE_SHADOW` / `STONE_BASE`) to `floor_kitchen` and `floor_cellar`.
- **Upstairs Lodging (`src/layout.js`, `src/actors.js`, `src/renderer.js`)**: Added `upstairs_landing` (`stairs_down`), warm upstairs wall lanterns, relocated blocking `upstairs_chest`, wired `stairPhase` (`stairsBottom` -> `stairsUpMid` -> `stairsTop`) walk animation for ascending/descending guests, fixed sleeper Y-sort (`footY = c.y + 2`), and cropped sleeping sprites to the top `29px` on pillows cleanly above bed headboards.
- **Kitchen (`src/layout.js`)**: Replaced the misplaced wooden-window corner (`wall_corner_r`) at `tx=22` with `wall_stone_mid`, lit stove & spit pools, de-overlapped wall herbs, and aligned prep/larder/herb plant spacing.
- **Wine Cellar (`src/layout.js`, `src/renderer.js`, `src/main.js`)**: Trimmed cellar flooring flush at `ty=14`, added dual warm wall lanterns, bottle shelf (`cellar_vintages`), crates, and candlelit tasting table (`cellar_tasting`), and fixed `focusRoom('cellar')`.
- **Verdant Garden Terrace (`src/layout.js`, `src/main.js`)**: Removed the floating cobble slab over Stage (`tx=0..4, ty=3..7`), rebuilt Garden as a south-west courtyard below `doorTileY` connected to the front entrance walk with separated oak tree & berry bushes, string lights, lamppost, and outdoor tables, and fixed `focusRoom('garden')`.
- **UI & Input Polish (`src/ui.js`, `src/main.js`, `src/font.js`)**: Added scrollable NPC Inspector revealing all 5 opinions, viewport-clipped Shop hitboxes, opaque intro framing, 2-step Save Reset confirmation, focus/blur held-key clearing, and normalized missing bitmap glyphs.

## v1.0.0

- Initial complete offline HTML5 Canvas 2D tavern diorama build across Milestones 0–7 and Post-Review Batches 1–2 (102 generated tavern props/tiles/UI assets, 39 NPC paper-doll sheets/busts, full 7-wing tavern progression, quests & regular patrons, adventurer party waves, Story Intro, 92 banter lines, Inspector thoughts/opinions, and Web Audio atmosphere).
