import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TavernSim, SIM_DT, DAY_CYCLE_SEC } from '../src/sim.js';
import { BanterSystem } from '../src/banter.js';
import { buildTavernLayout } from '../src/layout.js';
import { wrapPixelText, measurePixelText } from '../src/font.js';
import * as fontMod from '../src/font.js';
import { AudioManager } from '../src/audio.js';
import { TavernRenderer } from '../src/renderer.js';
import { TavernUI } from '../src/ui.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function loadGameData() {
  return {
    recipes: loadJson('data/recipes.json'),
    upgrades: loadJson('data/upgrades.json'),
    customers: loadJson('data/customers.json'),
    staff: loadJson('data/staff.json'),
    dialogue: loadJson('data/dialogue.json'),
    thoughts: loadJson('data/thoughts.json'),
  };
}

function makeFakeAssets() {
  return {
    tavern: new Map(),
    chars: new Map(),
    npcs: new Map(),
    uiSheet: null,
  };
}

function makeFakeCanvasCtx() {
  return {
    imageSmoothingEnabled: false,
    fillStyle: '#000',
    strokeStyle: '#000',
    globalAlpha: 1,
    lineWidth: 1,
    font: '10px monospace',
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    clip() {},
    rect() {},
    fillRect() {},
    strokeRect() {},
    clearRect() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    ellipse() {},
    drawImage() {},
    translate() {},
    scale() {},
    measureText(s) { return { width: String(s || '').length * 6 }; },
  };
}

function makeFakeCanvas(w = 640, h = 360) {
  const ctx = makeFakeCanvasCtx();
  return {
    width: w,
    height: h,
    style: {},
    parentElement: { clientWidth: 1280, clientHeight: 720 },
    getContext() { return ctx; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; },
  };
}

function createFakeAudioContext() {
  const createdNodes = [];
  const makeParam = (init = 0) => ({
    value: init,
    setValueAtTime(v) { this.value = v; },
    linearRampToValueAtTime(v) { this.value = v; },
    exponentialRampToValueAtTime(v) { this.value = v; },
    setTargetAtTime(v) { this.value = v; },
    cancelScheduledValues() {},
  });
  const makeNode = (kind) => {
    const node = {
      kind,
      connections: [],
      gain: makeParam(1),
      frequency: makeParam(440),
      Q: makeParam(1),
      detune: makeParam(0),
      threshold: makeParam(0),
      knee: makeParam(0),
      ratio: makeParam(1),
      attack: makeParam(0),
      release: makeParam(0),
      buffer: null,
      loop: false,
      type: 'sine',
      connect(target) {
        this.connections.push(target);
        return target;
      },
      disconnect() {},
      start() {},
      stop() {},
    };
    createdNodes.push(node);
    return node;
  };
  const ctx = {
    state: 'running',
    sampleRate: 44100,
    currentTime: 10.0,
    destination: { kind: 'destination' },
    createdNodes,
    resume() { return Promise.resolve(); },
    createGain() { return makeNode('gain'); },
    createOscillator() { return makeNode('oscillator'); },
    createBiquadFilter() { return makeNode('filter'); },
    createBufferSource() { return makeNode('bufferSource'); },
    createDynamicsCompressor() { return makeNode('compressor'); },
    createBuffer(channels, len) {
      return {
        getChannelData() { return new Float32Array(len); },
      };
    },
  };
  return ctx;
}

const args = new Set(process.argv.slice(2));
const RUN_AUDIT = args.has('--audit');

// Promotion mask: enable checks by default once their fix commit lands.
// At baseline (pre-fixes), ENABLED_AUDITS is empty; `--audit` runs all checks.
const ENABLED_AUDITS = new Set(['C1', 'C2', 'C3']);

const results = [];
function runCheck(name, fn, auditGroup = null) {
  if (auditGroup && !RUN_AUDIT && !ENABLED_AUDITS.has(auditGroup)) {
    return;
  }
  const label = auditGroup ? `[${auditGroup}] ${name}` : `[CORE] ${name}`;
  try {
    fn();
    results.push({ label, pass: true });
    console.log(`PASS: ${label}`);
  } catch (err) {
    results.push({ label, pass: false, err });
    console.error(`FAIL: ${label}\n  -> ${err.message}`);
  }
}

const data = loadGameData();
const palette = loadJson('data/palette.json');
const manifest = loadJson('assets/tavern/manifest.json');

// =========================================================================
// CORE BASELINE CHECKS
// =========================================================================
runCheck('JSON datasets cross-reference cleanly', () => {
  const roomIds = new Set(['main_hall', 'kitchen', 'upstairs', 'cellar', 'stage', 'garden']);
  const upgradeIds = new Set(data.upgrades.upgrades.map((u) => u.id));
  const recipeIds = new Set(data.recipes.recipes.map((r) => r.id));
  const allStaff = [...data.staff.canonStaff, ...data.staff.hireableStaff];
  const staffIds = new Set(allStaff.map((s) => s.id));
  assert.ok(upgradeIds.size >= 30, 'Expected >= 30 upgrades');
  assert.ok(recipeIds.size >= 10, 'Expected >= 10 recipes');
  assert.ok(staffIds.size >= 8, 'Expected >= 8 staff specs');
  for (const r of data.recipes.recipes) {
    if (r.requiresUpgrade) {
      assert.ok(upgradeIds.has(r.requiresUpgrade), `Unknown recipe requiresUpgrade: ${r.requiresUpgrade}`);
    }
    if (r.requiresRoom) {
      assert.ok(roomIds.has(r.requiresRoom), `Unknown recipe requiresRoom: ${r.requiresRoom}`);
    }
  }
  for (const u of data.upgrades.upgrades) {
    if (u.requires) {
      assert.ok(upgradeIds.has(u.requires), `Unknown upgrade dependency: ${u.requires}`);
    }
  }
});

runCheck('BanterSystem intro & offline templates work', () => {
  const b = new BanterSystem(data.dialogue);
  b.startIntro();
  assert.equal(b.introActive, true);
  assert.ok(b.getCurrentIntroBeat(), 'Expected an initial intro beat');
  b.skipIntro();
  assert.equal(b.introActive, false);
  const modal = b.formatOfflineSummary(120, 450, 22);
  assert.equal(modal.minutes, 120);
  assert.equal(modal.gold, 450);
  assert.equal(modal.customers, 22);
  assert.ok(modal.nyahText.includes('450') && modal.fifiText.includes('120'));
});

runCheck('TavernSim deterministic replay matches across identical seeds', () => {
  const simA = new TavernSim(data, { seed: 424242 });
  const simB = new TavernSim(data, { seed: 424242 });
  for (let i = 0; i < 1200; i++) {
    simA.step(SIM_DT);
    simB.step(SIM_DT);
  }
  assert.equal(simA.state.gold, simB.state.gold);
  assert.equal(simA.state.reputation, simB.state.reputation);
  assert.equal(simA.state.dayTimeSec, simB.state.dayTimeSec);
  assert.equal(simA.stats.customersServed, simB.stats.customersServed);
  assert.equal(simA.customers.length, simB.customers.length);
  assert.equal(simA.staff.length, simB.staff.length);
});

runCheck('Seat and bed exclusivity + cleanup invariants hold under 10m step', () => {
  const sim = new TavernSim(data, { seed: 1337 });
  sim.state.gold = 50000;
  sim.state.reputation = 500;
  for (const id of ['exp_upstairs', 'exp_kitchen', 'add_table', 'hire_maid_clover']) {
    if (sim.canBuyUpgrade(id)) sim.buyUpgrade(id);
  }
  for (let t = 0; t < 6000; t++) {
    sim.step(SIM_DT);
    const seenSeats = new Set();
    const seenBeds = new Set();
    for (const c of sim.customers) {
      if (c.seatRef) {
        const key = `${c.seatRef.tableIndex}:${c.seatRef.seatIndex}`;
        assert.ok(!seenSeats.has(key), `Double seat occupancy at ${key}`);
        seenSeats.add(key);
        const s = sim.layout.tables[c.seatRef.tableIndex].seats[c.seatRef.seatIndex];
        assert.equal(s.occupiedBy, c.id);
      }
      if (c.bedRef) {
        assert.ok(!seenBeds.has(c.bedRef.bedIndex), `Double bed occupancy at ${c.bedRef.bedIndex}`);
        seenBeds.add(c.bedRef.bedIndex);
      }
    }
  }
});

runCheck('wrapPixelText & measurePixelText handle edge inputs without NaN or infinite loop', () => {
  for (const sample of ['', null, undefined, 'A'.repeat(120), 'hello   world\nline2']) {
    const lines = wrapPixelText(sample, 80, 1);
    assert.ok(Array.isArray(lines) && lines.length >= 1);
    for (const line of lines) {
      const m = measurePixelText(line, 1);
      assert.ok(Number.isFinite(m.width) && m.width >= 0);
      assert.ok(Number.isFinite(m.height) && m.height > 0);
    }
  }
});

runCheck('v1 save export/import round-trip works for base fields', () => {
  const sim = new TavernSim(data, { seed: 99 });
  sim.state.gold = 345;
  sim.state.reputation = 28;
  sim.state.hasSeenIntro = true;
  sim.buyUpgrade('add_table');
  const encoded = sim.exportSaveString(1_000_000);
  const sim2 = new TavernSim(data);
  sim2.importSaveString(encoded, 1_000_000);
  assert.equal(sim2.state.gold, sim.state.gold);
  assert.equal(sim2.state.reputation, sim.state.reputation);
  assert.equal(sim2.getUpgradeLevel('add_table'), 1);
});

// =========================================================================
// AUDIT / REGRESSION CHECKS (Commits 1..5)
// =========================================================================

// Commit 1: Data triggers/speakers + Font glyph normalization
runCheck('All dialogue banter lines have valid speaker and reachable trigger', () => {
  const validTriggers = new Set([
    'idle', 'music', 'morning', 'night', 'upgrade', 'expansion',
    'complaint', 'big_tip', 'rush', 'quest_return',
  ]);
  const allStaff = [...data.staff.canonStaff, ...data.staff.hireableStaff];
  const validSpeakers = new Set(['nyah', 'fifi', ...allStaff.map((s) => s.id)]);
  for (const b of data.dialogue.banter) {
    assert.ok(validTriggers.has(b.trigger), `Unreachable trigger "${b.trigger}" on ${b.id}`);
    assert.ok(validSpeakers.has(b.speaker), `Missing/invalid speaker "${b.speaker}" on ${b.id}`);
  }
}, 'C1');

runCheck('All text glyphs across data/*.json render cleanly without unexpected ? fallback', () => {
  const fontSrc = fs.readFileSync(path.join(ROOT, 'src/font.js'), 'utf8');
  assert.equal(typeof fontMod.normalizeGlyphText, 'function', 'Expected normalizeGlyphText helper in src/font.js');
  const glyphKeys = new Set();
  const re = /'((?:[^'\\]|\\.)+)'\s*:\s*\[/g;
  let m;
  while ((m = re.exec(fontSrc)) !== null) {
    glyphKeys.add(m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
  }
  const dqRe = /"([^"]+)"\s*:\s*\[/g;
  while ((m = dqRe.exec(fontSrc)) !== null) glyphKeys.add(m[1]);

  const unmapped = [];
  const datasets = ['customers.json', 'dialogue.json', 'recipes.json', 'staff.json', 'thoughts.json', 'upgrades.json'];
  for (const file of datasets) {
    const raw = loadJson(`data/${file}`);
    const walk = (v, ctx) => {
      if (typeof v === 'string') {
        const rendered = fontMod.normalizeGlyphText(v);
        for (const ch of rendered) {
          if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') continue;
          if (!glyphKeys.has(ch) && !glyphKeys.has(ch.toUpperCase())) {
            unmapped.push(`${file} (${ctx}): ${JSON.stringify(ch)} U+${ch.charCodeAt(0).toString(16)}`);
          }
        }
      } else if (Array.isArray(v)) {
        v.forEach((item, idx) => walk(item, `${ctx}[${idx}]`));
      } else if (v && typeof v === 'object') {
        for (const [k, val] of Object.entries(v)) {
          if (k === 'id' || k === 'trigger' || k === 'speaker' || k === 'emote' || k === 'icon' || k === 'tab' || k === 'kind' || k === 'requires' || k === 'requiresUpgrade' || k === 'requiresRoom' || k === 'effect' || k === 'role' || k === 'type') continue;
          walk(val, `${ctx}.${k}`);
        }
      }
    };
    walk(raw, file);
  }
  assert.equal(unmapped.length, 0, `Unmapped glyphs in JSON data:\n${unmapped.slice(0, 12).join('\n')}`);
}, 'C1');

// Commit 2: Sim table sharing, regulars persistence, offline progression, save sanitization, abandoned order
runCheck('Shared table co-diner meal stays intact when first patron finishes eating', () => {
  const sim = new TavernSim(data, { seed: 777 });
  const tbl = sim.layout.tables[0];
  tbl.dirty = false;
  // Spawn two customers and seat both on table 0
  const c1 = sim.spawnCustomer();
  const c2 = sim.spawnCustomer();
  assert.ok(c1 && c2);
  c1.releaseSeat(sim);
  c2.releaseSeat(sim);
  const s0 = sim.claimFreeSeat(c1.id, 0);
  const s1 = sim.claimFreeSeat(c2.id, 0);
  assert.equal(s0.tableIndex, 0);
  assert.equal(s1.tableIndex, 0);
  c1.seatRef = s0;
  c2.seatRef = s1;
  c1.x = s0.x; c1.y = s0.y;
  c2.x = s1.x; c2.y = s1.y;
  tbl.activeDishProp = 'food_stew';
  tbl.hasHotFood = true;
  c1.transition('EATING', 20);
  c2.transition('EATING', 20);
  // Make customer 1 finish eating deterministically
  let dirtyWasTriggeredEarly = false;
  for (let i = 0; i < 150 && c1.state === 'EATING'; i++) {
    c1.update(SIM_DT, sim);
    if (c1.state !== 'EATING' && c2.state === 'EATING') {
      if (tbl.dirty || !tbl.activeDishProp || !tbl.hasHotFood) {
        dirtyWasTriggeredEarly = true;
      }
    }
  }
  assert.notEqual(c1.state, 'EATING', 'Customer 1 should finish eating');
  assert.equal(dirtyWasTriggeredEarly, false, 'Table became dirty or lost dish prop while co-diner was still EATING');
  assert.equal(tbl.dirty, false, 'Table must not be dirty while patron 2 is still seated');
  assert.equal(tbl.activeDishProp, 'food_stew', 'Dish prop cleared mid-meal for patron 2');
}, 'C2');

runCheck('regularsRoster and hasSpawnedFirstRookie persist across save round-trip', () => {
  const sim = new TavernSim(data, { seed: 202 });
  sim.hasSpawnedFirstRookie = true;
  sim.regularsRoster.push({
    seed: 918273,
    archetypeId: 'villager',
    name: 'Alden Ashford',
    visits: 4,
    lastGoldSpent: 28,
    affinity: 'Regular',
  });
  const encoded = sim.exportSaveString(5_000_000);
  const restored = new TavernSim(data);
  restored.importSaveString(encoded, 5_000_000);
  assert.equal(restored.hasSpawnedFirstRookie, true);
  assert.equal(restored.regularsRoster.length, 1);
  assert.equal(restored.regularsRoster[0].seed, 918273);
  assert.equal(restored.regularsRoster[0].visits, 4);
}, 'C2');

runCheck('Offline catch-up advances dayTimeSec & dayNumber without mutating reputation', () => {
  const sim = new TavernSim(data, { seed: 303 });
  sim.state.reputation = 85;
  sim.state.dayNumber = 2;
  sim.state.dayTimeSec = 100;
  const savedAt = 10_000_000;
  const encoded = sim.exportSaveString(savedAt);
  const restored = new TavernSim(data);
  const twoHoursLater = savedAt + 7200 * 1000;
  const offline = restored.importSaveString(encoded, twoHoursLater);
  assert.ok(offline && offline.gold > 0);
  assert.equal(restored.state.reputation, 85, 'Reputation must stay invariant across offline catchup');
  assert.ok(restored.state.dayNumber > 2, `Expected dayNumber to advance past 2 after 2 hours offline, got ${restored.state.dayNumber}`);
  assert.ok(restored.state.totalTimeSec >= 7200, 'totalTimeSec should reflect elapsed offline time');
}, 'C2');

runCheck('Hostile malformed save payload is sanitized without NaN/Infinity/invalid IDs', () => {
  const sim = new TavernSim(data, { seed: 404 });
  const hostile = {
    version: 1,
    savedAtMs: 'not-a-number',
    gold: Number.NaN,
    reputation: -999,
    dayNumber: -5,
    dayTimeSec: Number.POSITIVE_INFINITY,
    totalTimeSec: -10,
    tableTier: 99,
    bedTier: 0,
    upgradeLevels: { add_table: -3, unknown_fake_upg: 99, hire_maid_clover: 50 },
    unlockedRecipes: ['ale', 'nonexistent_dish', 123],
    unlockedRooms: ['bogus_wing', 'main_hall'],
    hiredStaffIds: ['fifi', 'hacker_npc'],
  };
  sim.loadSave(hostile, 1_000_000);
  assert.ok(Number.isFinite(sim.state.gold) && sim.state.gold >= 0);
  assert.ok(Number.isFinite(sim.state.reputation) && sim.state.reputation >= 0);
  assert.ok(Number.isFinite(sim.state.dayNumber) && sim.state.dayNumber >= 1);
  assert.ok(Number.isFinite(sim.state.dayTimeSec) && sim.state.dayTimeSec >= 0 && sim.state.dayTimeSec < DAY_CYCLE_SEC);
  assert.ok(Number.isFinite(sim.state.totalTimeSec) && sim.state.totalTimeSec >= 0);
  assert.ok(sim.state.tableTier >= 1 && sim.state.tableTier <= 4);
  assert.ok(sim.state.bedTier >= 1 && sim.state.bedTier <= 2);
  assert.equal(sim.state.upgradeLevels.unknown_fake_upg, undefined);
  assert.equal(sim.state.upgradeLevels.add_table, 0);
  assert.ok(sim.state.upgradeLevels.hire_maid_clover <= 1);
  assert.equal(sim.state.unlockedRecipes.has('nonexistent_dish'), false);
  assert.equal(sim.state.unlockedRooms.has('bogus_wing'), false);
  assert.equal(sim.state.hiredStaffIds.has('hacker_npc'), false);
}, 'C2');

runCheck('Chef aborts PREP_ORDER immediately if customer left WAITING_FOR_FOOD', () => {
  const sim = new TavernSim(data, { seed: 505 });
  const chef = sim.staff.find((s) => s.role === 'chef');
  assert.ok(chef);
  const cust = sim.spawnCustomer();
  const recipe = data.recipes.recipes[0];
  const ord = {
    id: 999,
    customerId: cust.id,
    recipe,
    station: 'bar',
    cookingByStaffId: chef.id,
    ready: false,
  };
  chef.currentOrder = ord;
  chef.prepTargetDuration = 10.0;
  chef.x = sim.layout.waypoints.barBehind.x;
  chef.y = sim.layout.waypoints.barBehind.y;
  chef.transition('PREP_ORDER', 25.0);
  // Simulate customer walking out / leaving before order finishes
  cust.state = 'EXITING';
  chef.update(SIM_DT, sim);
  assert.notEqual(chef.state, 'PREP_ORDER', 'Chef kept cooking after customer abandoned WAITING_FOR_FOOD');
  assert.equal(chef.currentOrder, null);
}, 'C2');

// Commit 3: focusRoom particle bug, Audio AM wiring & throttling, Native <dialog>
runCheck('focusRoom uses valid TavernRenderer.spawnParticle positional args', () => {
  const mainSrc = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  assert.equal(
    /spawnParticle\s*\(\s*\{/.test(mainSrc),
    false,
    'main.js still calls renderer.spawnParticle({...}) object form instead of (kind, wx, wy)'
  );
  // Also test TavernRenderer.spawnParticle directly with valid coords
  const renderer = new TavernRenderer(makeFakeCanvas(), makeFakeAssets(), palette);
  renderer.spawnParticle('ember', 320, 240);
  const active = renderer.particles.find((p) => p.active);
  assert.ok(active && Number.isFinite(active.x) && Number.isFinite(active.y));
}, 'C3');

runCheck('AudioManager _sfxSizzle connects AM oscillator and throttles SFX floods', () => {
  const originalGlobal = globalThis.window;
  const fakeCtx = createFakeAudioContext();
  globalThis.window = {
    AudioContext: function () { return fakeCtx; },
    addEventListener() {},
  };
  try {
    const audio = new AudioManager();
    audio.init();
    const beforeSizzle = fakeCtx.createdNodes.length;
    audio._sfxSizzle(10.0, 0.2, 1.0);
    // Every created oscillator & gain/filter node in _sfxSizzle must connect downstream (no dangling amGain!)
    const sizzleNodes = fakeCtx.createdNodes.slice(beforeSizzle);
    for (const node of sizzleNodes) {
      assert.ok(node.connections.length > 0, `AudioManager created a disconnected ${node.kind} node in _sfxSizzle`);
    }
    const beforeBurstNodes = fakeCtx.createdNodes.length;
    for (let i = 0; i < 60; i++) {
      audio.playSfx('coin');
    }
    const spawnedDuringBurst = fakeCtx.createdNodes.length - beforeBurstNodes;
    // 1 coin triggers multiple nodes, so 60 unthrottled coins creates >180 nodes. Throttled should create <= 18!
    assert.ok(spawnedDuringBurst <= 25, `Unthrottled SFX burst spawned ${spawnedDuringBurst} Web Audio nodes in 1 instant`);
  } finally {
    globalThis.window = originalGlobal;
  }
}, 'C3');

runCheck('index.html uses native <dialog id="save-dialog" closedby="any">', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(/<dialog[^>]*id="save-dialog"[^>]*closedby="any"|<dialog[^>]*closedby="any"[^>]*id="save-dialog"/.test(html), 'Expected native <dialog id="save-dialog" closedby="any">');
  assert.equal(/role="dialog"/.test(html), false, 'Native <dialog> should not duplicate role="dialog"');
  const mainSrc = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  assert.ok(mainSrc.includes('saveDialog.showModal()'), 'Expected main.js to open saveDialog with .showModal()');
}, 'C3');

// Commit 4: North wall mount de-overlapping & crisp 0.5px strokes
runCheck('Grand tavern north wallMounts do not overlap windows, fireplace, stairs, or sign_tavern', () => {
  const sim = new TavernSim(data);
  sim.state.gold = 99999999;
  sim.state.reputation = 99999;
  for (let pass = 0; pass < 8; pass++) {
    for (const u of data.upgrades.upgrades) {
      for (let k = 0; k < 25 && sim.canBuyUpgrade(u.id); k++) sim.buyUpgrade(u.id);
    }
  }
  const l = sim.layout;
  const spriteBox = (asset, x, y) => {
    const spec = manifest.frames?.[asset] || manifest.assets?.[asset] || manifest[asset];
    assert.ok(spec, `Missing manifest entry for ${asset}`);
    const [w, h] = spec.size;
    return { asset, left: x - w / 2, right: x + w / 2, top: y - h, bottom: y };
  };
  const boxesOverlap = (a, b, pad = 0) => (
    a.left < b.right - pad &&
    a.right > b.left + pad &&
    a.top < b.bottom - pad &&
    a.bottom > b.top + pad
  );

  // North wall structural props (y <= 215, excluding floor/ceiling items like chandelier)
  const mainNorthMounts = l.wallMounts.filter((m) => m.y >= 120 && m.y <= 150 && m.x >= 160 && m.x <= 544);
  const windows = l.walls
    .filter((w) => w.asset === 'wall_timber_window' && w.y >= 100)
    .map((w) => ({ asset: w.asset, left: w.x, right: w.x + 32, top: w.y - 32, bottom: w.y + 32 }));
  const fireplace = l.props.find((p) => p.asset === 'fireplace_1');
  const fireplaceBox = fireplace ? spriteBox('fireplace_1', fireplace.x, fireplace.y) : null;

  const decorMounts = mainNorthMounts.filter((m) => m.asset !== 'chandelier');
  for (const m of decorMounts) {
    const mb = spriteBox(m.asset, m.x, m.y);
    for (const wb of windows) {
      assert.equal(boxesOverlap(mb, wb, 2), false, `${m.asset}@(${m.x},${m.y}) overlaps window [${wb.left}..${wb.right}]`);
    }
    if (fireplaceBox && m.asset !== 'quest_board_full') {
      assert.equal(boxesOverlap(mb, fireplaceBox, 4), false, `${m.asset}@(${m.x},${m.y}) overlaps fireplace_1 [${fireplaceBox.left}..${fireplaceBox.right}]`);
    }
  }
  // Check sign_tavern doesn't overlap drying_rack_herbs
  const sign = decorMounts.find((m) => m.asset === 'sign_tavern');
  const herbs = decorMounts.filter((m) => m.asset === 'drying_rack_herbs');
  if (sign) {
    const sb = spriteBox(sign.asset, sign.x, sign.y);
    for (const h of herbs) {
      const hb = spriteBox(h.asset, h.x, h.y);
      assert.equal(boxesOverlap(sb, hb, 2), false, `sign_tavern overlaps drying_rack_herbs at (${h.x},${h.y})`);
    }
  }
}, 'C4');

runCheck('UI and Renderer use crisp half-pixel aligned strokeRect calls', () => {
  const uiSrc = fs.readFileSync(path.join(ROOT, 'src/ui.js'), 'utf8');
  const renSrc = fs.readFileSync(path.join(ROOT, 'src/renderer.js'), 'utf8');
  assert.equal(/ctx\.strokeRect\(Math\.round\(x \+ 1\)/.test(uiSrc), false, 'ui.js still uses integer strokeRect causing blurry 2px outline');
  assert.equal(/ctx\.strokeRect\(sx - 12, sy - 6/.test(renSrc), false, 'renderer.js still uses integer strokeRect for speech bubble border');
}, 'C4');

// Commit 5: Scrollable Inspector, Clipped Shop Hitboxes, Wrapped Tooltip Height, Two-Click Reset
runCheck('Inspector scrolls to reveal all 5 opinions & Shop clips out-of-viewport hitboxes & Reset needs confirmation', () => {
  const sim = new TavernSim(data, { seed: 606 });
  const ctx = makeFakeCanvasCtx();
  const ui = new TavernUI(makeFakeAssets(), palette, {});
  ui.mode = 'playing';

  // 1) Inspector scrolling
  const cust = sim.spawnCustomer();
  ui.selectedActorId = cust.id;
  ui.render(ctx, sim, false, {});
  assert.ok('inspectorScroll' in ui, 'TavernUI missing inspectorScroll property');
  assert.ok((ui._inspectorMaxScroll ?? -1) > 0, 'Expected inspector content taller than panel so scrolling exposes opinions');
  ui.inspectorScroll = 999;
  ui.render(ctx, sim, false, {});
  assert.ok(ui.inspectorScroll <= ui._inspectorMaxScroll, 'inspectorScroll should clamp to _inspectorMaxScroll');

  // 2) Settings Reset requires confirmation instead of 1-click wipe
  let resetCalls = 0;
  const uiReset = new TavernUI(makeFakeAssets(), palette, { onResetSave: () => { resetCalls += 1; } });
  uiReset.mode = 'playing';
  uiReset.settingsOpen = true;
  uiReset.render(ctx, sim, false, {});
  const resetHit = uiReset.hitRegions.find((h) => h.id === 'btn_reset_save');
  assert.ok(resetHit, 'Expected btn_reset_save hit region');
  resetHit.onClick();
  assert.equal(resetCalls, 0, 'First click on Reset Save Data wiped save immediately without confirmation!');
  uiReset.render(ctx, sim, false, {});
  const confirmHit = uiReset.hitRegions.find((h) => h.id === 'btn_reset_save');
  confirmHit.onClick();
  assert.equal(resetCalls, 1, 'Second confirmation click should trigger onResetSave');

  // 3) Shop off-screen clipped items must not leak click hit regions above drawer list viewport
  ui.selectedActorId = null;
  ui.settingsOpen = false;
  ui.shopOpen = true;
  ui.shopTab = 'upgrades';
  ui.shopScroll = 140;
  ui.render(ctx, sim, false, {});
  const listTop = 67; // panelY(16) + 51
  const listBottom = 16 + 324 - 10;
  for (const hr of ui.hitRegions) {
    if (hr.id.startsWith('buy_')) {
      assert.ok(hr.y >= listTop && (hr.y + hr.h) <= listBottom, `Shop hit region ${hr.id} leaked outside scroll viewport (${hr.y}..${hr.y + hr.h})`);
    }
  }
}, 'C5');

const failed = results.filter((r) => !r.pass);
console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed (${failed.length} failed)`);
if (failed.length > 0) {
  process.exit(1);
}
