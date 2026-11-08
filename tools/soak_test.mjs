import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { TavernSim, SIM_DT } from '../src/sim.js';

// Ensure deterministic V8 mark-sweep GC is available even when invoked as plain `node tools/soak_test.mjs`
const forceGc = (() => {
  if (typeof global.gc === 'function') return global.gc;
  try {
    v8.setFlagsFromString('--expose_gc');
    return vm.runInNewContext('gc');
  } catch {
    return null;
  }
})();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function loadJson(relPath) {
  const fullPath = path.join(rootDir, relPath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

const data = {
  palette: loadJson('data/palette.json'),
  recipes: loadJson('data/recipes.json'),
  upgrades: loadJson('data/upgrades.json'),
  customers: loadJson('data/customers.json'),
  staff: loadJson('data/staff.json'),
  dialogue: loadJson('data/dialogue.json'),
  thoughts: loadJson('data/thoughts.json'),
};

const sim = new TavernSim(data, { seed: 987654 });

const TOTAL_HOURS = 8.0;
const TOTAL_SEC = TOTAL_HOURS * 3600;
const TOTAL_TICKS = Math.round(TOTAL_SEC / SIM_DT); // 288,000
const WARMUP_TICKS = Math.round((30 * 60) / SIM_DT); // 18,000 (30 minutes)
const STEADY_STATE_TICKS = Math.round((90 * 60) / SIM_DT); // 54,000 (1.5 hours, full tavern buildout)

console.log(`Starting Soak Test: ${TOTAL_HOURS} simulated hours (${TOTAL_TICKS} ticks)...`);

let baselineHeap = 0;
let finalHeap = 0;
const steadyStateSamples = [];
let stuckActorsCount = 0;
let nanChecksPassed = true;
let totalChecks = 0;

// Progressive buyer ensuring all rooms, staff, tables, and recipes get unlocked
function progressiveBuyer(sim) {
  // 1. Expansions
  for (const u of data.upgrades.upgrades) {
    if (u.kind === 'expansion' && sim.canBuyUpgrade(u)) {
      sim.buyUpgrade(u.id);
      return;
    }
  }
  // 2. Staff hires
  for (const u of data.upgrades.upgrades) {
    if (u.kind === 'staff_hire' && sim.canBuyUpgrade(u)) {
      sim.buyUpgrade(u.id);
      return;
    }
  }
  // 3. Tiers
  for (const u of data.upgrades.upgrades) {
    if ((u.effect?.type === 'table_tier' || u.effect?.type === 'bed_tier') && sim.canBuyUpgrade(u)) {
      sim.buyUpgrade(u.id);
      return;
    }
  }
  // 4. Recipes
  for (const r of data.recipes.recipes) {
    if (sim.canUnlockRecipe(r)) {
      sim.unlockRecipe(r.id);
      return;
    }
  }
  // 5. Dining tables
  const addTable = data.upgrades.upgrades.find((u) => u.id === 'add_table');
  if (addTable && sim.canBuyUpgrade(addTable)) {
    sim.buyUpgrade(addTable.id);
    return;
  }
  // 6. One-offs
  for (const u of data.upgrades.upgrades) {
    if (u.kind === 'one_off' && sim.canBuyUpgrade(u)) {
      sim.buyUpgrade(u.id);
      return;
    }
  }
  // 7. Repeatables when rich
  for (const u of data.upgrades.upgrades) {
    if (u.kind === 'repeatable' && sim.canBuyUpgrade(u)) {
      if (sim.getUpgradeCost(u) <= sim.gold * 0.3) {
        sim.buyUpgrade(u.id);
        return;
      }
    }
  }
}

const startWallMs = Date.now();

for (let tick = 1; tick <= TOTAL_TICKS; tick++) {
  sim.step(SIM_DT);

  if (tick % 20 === 0) {
    progressiveBuyer(sim);
  }

  // Warmup checkpoint at 30 minutes
  if (tick === WARMUP_TICKS) {
    forceGc?.();
    baselineHeap = process.memoryUsage().heapUsed;
    console.log(`Warmup completed (30m / 18,000 ticks). Baseline Heap: ${(baselineHeap / 1024 / 1024).toFixed(2)} MB`);
  }

  // Every 1,000 ticks: invariant asserts & memory sampling
  if (tick % 1000 === 0) {
    totalChecks++;
    if (!Number.isFinite(sim.gold) || !Number.isFinite(sim.reputation)) {
      nanChecksPassed = false;
      console.error(`[FAIL] NaN/Infinity in sim gold (${sim.gold}) or reputation (${sim.reputation}) at tick ${tick}`);
    }

    const allActors = [...sim.staff, ...sim.customers];
    for (const a of allActors) {
      if (
        !Number.isFinite(a.x) ||
        !Number.isFinite(a.y) ||
        !Number.isFinite(a.mood) ||
        !Number.isFinite(a.stateTimer)
      ) {
        nanChecksPassed = false;
        console.error(`[FAIL] NaN in actor ${a.id} (${a.name}): x=${a.x}, y=${a.y}, mood=${a.mood}, stateTimer=${a.stateTimer}`);
      }

      if (a.stateTimer > a.maxStateTimeout + 0.5) {
        stuckActorsCount++;
        console.error(
          `[FAIL] Stuck actor detected: ${a.id} (${a.name}) state=${a.state} timer=${a.stateTimer.toFixed(2)}s > max=${a.maxStateTimeout.toFixed(2)}s`
        );
      }
    }

    if (tick >= STEADY_STATE_TICKS) {
      steadyStateSamples.push(process.memoryUsage().heapUsed);
    }
  }
}

// Immediately capture final heap of simulation
forceGc?.();
finalHeap = process.memoryUsage().heapUsed;

const wallSec = ((Date.now() - startWallMs) / 1000).toFixed(2);
console.log(`8-Hour Simulation finished in ${wallSec}s wall time.`);

// Calculate heap growth %
let heapGrowthPct = 0;
if (typeof forceGc === 'function') {
  heapGrowthPct = baselineHeap > 0 ? ((finalHeap - baselineHeap) / baselineHeap) * 100 : 0;
} else if (steadyStateSamples.length >= 30) {
  // Without --expose-gc: sample steady-state post-warmup min/avg vs final window
  const earlyWindow = steadyStateSamples.slice(0, 30);
  const lateWindow = steadyStateSamples.slice(-30);
  const minEarly = Math.min(...earlyWindow);
  const minLate = Math.min(...lateWindow);
  heapGrowthPct = ((minLate - minEarly) / minEarly) * 100;
} else {
  heapGrowthPct = baselineHeap > 0 ? ((finalHeap - baselineHeap) / baselineHeap) * 100 : 0;
}

// Save / Load Round-trip & Offline Verification
console.log('\nTesting save export / import round-trip & offline earnings...');
let saveOk = true;
try {
  const saveStr = sim.exportSaveString();
  const testSim = new TavernSim(data, { seed: 111111 });

  // Test 2-hour offline earnings (7,200 seconds offline)
  const twoHoursLaterMs = Date.now() + 2 * 3600 * 1000;
  const offlineSummary = testSim.importSaveString(saveStr, twoHoursLaterMs);

  console.log('Save import returned offline summary:', offlineSummary ? 'YES' : 'NONE');
  console.log(`Original gold: ${sim.gold} -> Restored with 2h offline: ${testSim.gold}`);
  console.log(`Original reputation: ${sim.reputation} -> Restored: ${testSim.reputation}`);

  if (testSim.gold <= sim.gold) {
    console.error('[FAIL] Offline earnings did not increase gold!');
    saveOk = false;
  }
  if (testSim.reputation !== sim.reputation) {
    console.error('[FAIL] Reputation mismatch across save import!');
    saveOk = false;
  }
} catch (err) {
  console.error('[FAIL] Exception during save export/import:', err);
  saveOk = false;
}

console.log('\n--- SOAK TEST REPORT ---');
console.log(`Simulated Time: ${TOTAL_HOURS} hours (${TOTAL_TICKS} ticks)`);
console.log(`Wall-Clock Runtime: ${wallSec}s`);
console.log(`Customers Served: ${sim.stats.customersServed}`);
console.log(`Rooms Rented: ${sim.stats.roomsRented}`);
console.log(`Supplies Sold: ${sim.stats.suppliesSold}`);
console.log(`Stuck Actors Count: ${stuckActorsCount}`);
console.log(`NaN/Infinity Checks: ${nanChecksPassed ? 'PASS' : 'FAIL'} (${totalChecks} checkpoints)`);
console.log(`Baseline Heap (30m): ${(baselineHeap / 1024 / 1024).toFixed(2)} MB`);
console.log(`Final Heap (8h): ${(finalHeap / 1024 / 1024).toFixed(2)} MB`);
console.log(`Heap Growth: ${heapGrowthPct.toFixed(2)}% (Target: < 20%)`);
console.log(`Save Round-trip & Offline: ${saveOk ? 'PASS' : 'FAIL'}`);

const passed = stuckActorsCount === 0 && nanChecksPassed && saveOk && heapGrowthPct < 20;

if (passed) {
  console.log('\n[PASS] All soak test invariants passed cleanly!');
  process.exit(0);
} else {
  console.error('\n[FAIL] Soak test failed one or more invariants!');
  process.exit(1);
}
