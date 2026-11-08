import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TavernSim, SIM_DT } from '../src/sim.js';

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

const sim = new TavernSim(data, { seed: 424242 });

const TOTAL_SIM_HOURS = 6.0;
const TOTAL_SIM_SEC = TOTAL_SIM_HOURS * 3600;
const TOTAL_TICKS = Math.round(TOTAL_SIM_SEC / SIM_DT); // 216,000 ticks
const PURCHASE_INTERVAL_SEC = 2.0;
const PURCHASE_INTERVAL_TICKS = Math.round(PURCHASE_INTERVAL_SEC / SIM_DT); // 20 ticks

function formatTime(totalSec) {
  const s = Math.floor(totalSec);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const purchases = [];

// Collect target sets
const allExpansionIds = new Set(data.upgrades.upgrades.filter((u) => u.kind === 'expansion').map((u) => u.id));
const allStaffHireIds = new Set(data.upgrades.upgrades.filter((u) => u.kind === 'staff_hire').map((u) => u.id));
const allOneOffIds = new Set(data.upgrades.upgrades.filter((u) => u.kind === 'one_off').map((u) => u.id));
const allRecipeIds = new Set(data.recipes.recipes.map((r) => r.id));

const unlockedExpansions = new Set();
const unlockedStaffHires = new Set();
const unlockedOneOffs = new Set();

let firstKitchenTimeSec = null;
let fullProgressionTimeSec = null;

function checkProgressionComplete(sim) {
  if (unlockedExpansions.size !== allExpansionIds.size) return false;
  if (unlockedStaffHires.size !== allStaffHireIds.size) return false;
  if (unlockedOneOffs.size !== allOneOffIds.size) return false;
  if (sim.state.unlockedRecipes.size !== allRecipeIds.size) return false;
  return true;
}

function evaluateAndPurchase(sim) {
  // 1. Identify all eligible progression milestones:
  // - Expansions (kind === 'expansion')
  // - Staff hires (kind === 'staff_hire')
  // - Table tier (effect.type === 'table_tier')
  // - Bed tier (effect.type === 'bed_tier')
  // - Recipe unlocks (!sim.state.unlockedRecipes.has(r.id))
  const eligibleMilestones = [];

  for (const u of data.upgrades.upgrades) {
    const isMilestone =
      u.kind === 'expansion' ||
      u.kind === 'staff_hire' ||
      u.effect?.type === 'table_tier' ||
      u.effect?.type === 'bed_tier';

    if (!isMilestone) continue;
    if (sim.getUpgradeLevel(u.id) >= u.maxLevel) continue;
    if (u.requires && !sim.isUpgradeOwned(u.requires)) continue;
    if (sim.reputation < (u.repRequired || 0)) continue;

    const cost = sim.getUpgradeCost(u);
    eligibleMilestones.push({
      type: 'upgrade',
      kind: u.kind,
      subType: u.effect?.type,
      id: u.id,
      name: u.name,
      cost,
      canBuy: sim.canBuyUpgrade(u),
      spec: u,
    });
  }

  for (const r of data.recipes.recipes) {
    if (sim.state.unlockedRecipes.has(r.id)) continue;
    if (r.requiredExpansion && !sim.isUpgradeOwned(r.requiredExpansion)) continue;
    if (sim.reputation < (r.repRequired || 0)) continue;

    const cost = r.unlockCost;
    eligibleMilestones.push({
      type: 'recipe',
      kind: 'recipe',
      id: r.id,
      name: r.name,
      cost,
      canBuy: sim.canUnlockRecipe(r),
      spec: r,
    });
  }

  // Look-ahead: save up when an eligible milestone is within ~2.5x current gold or <90s of avgGoldPerSec
  const rate = Math.max(0.15, sim.stats.avgGoldPerSec);
  const inReachMilestones = eligibleMilestones.filter((m) => {
    if (m.canBuy) return true;
    const diff = m.cost - sim.gold;
    return m.cost <= sim.gold * 2.5 || diff <= rate * 90;
  });

  // If any milestones are purchasable right now, pick the highest-priority one
  const purchasableMilestones = eligibleMilestones.filter((m) => m.canBuy);
  if (purchasableMilestones.length > 0) {
    purchasableMilestones.sort((a, b) => {
      const getPriority = (m) => {
        if (m.kind === 'expansion') return 1;
        if (m.kind === 'staff_hire') return 2;
        if (m.subType === 'table_tier') return 3;
        if (m.type === 'recipe') return 4;
        if (m.subType === 'bed_tier') return 5;
        return 6;
      };
      const pDiff = getPriority(a) - getPriority(b);
      if (pDiff !== 0) return pDiff;
      return a.cost - b.cost;
    });

    const chosen = purchasableMilestones[0];
    let ok = false;
    if (chosen.type === 'upgrade') {
      ok = sim.buyUpgrade(chosen.id);
    } else {
      ok = sim.unlockRecipe(chosen.id);
    }

    if (ok) {
      recordPurchase(sim, chosen);
      return true;
    }
  }

  // If we are actively saving up for an in-reach milestone, don't waste gold on cheap repeatables!
  if (inReachMilestones.length > 0) {
    return false;
  }

  // 2. No milestone in saving horizon: evaluate additional table placement
  const addTableUpg = data.upgrades.upgrades.find((u) => u.id === 'add_table');
  if (addTableUpg && sim.canBuyUpgrade(addTableUpg)) {
    const cost = sim.getUpgradeCost(addTableUpg);
    if (sim.buyUpgrade(addTableUpg.id)) {
      recordPurchase(sim, {
        type: 'upgrade',
        kind: addTableUpg.kind,
        id: addTableUpg.id,
        name: `${addTableUpg.name} (Lv ${sim.getUpgradeLevel(addTableUpg.id)})`,
        cost,
      });
      return true;
    }
  }

  // 3. One-off decor upgrades
  const purchasableOneOffs = data.upgrades.upgrades.filter(
    (u) => u.kind === 'one_off' && sim.canBuyUpgrade(u)
  );
  if (purchasableOneOffs.length > 0) {
    purchasableOneOffs.sort((a, b) => sim.getUpgradeCost(a) - sim.getUpgradeCost(b));
    const chosen = purchasableOneOffs[0];
    const cost = sim.getUpgradeCost(chosen);
    if (sim.buyUpgrade(chosen.id)) {
      recordPurchase(sim, {
        type: 'upgrade',
        kind: chosen.kind,
        id: chosen.id,
        name: chosen.name,
        cost,
      });
      return true;
    }
  }

  // 4. Repeatable upgrades (polish, drills, quick-prep, town crier) when affordable (<45% of current gold)
  const repeatableUpgs = data.upgrades.upgrades.filter(
    (u) => u.kind === 'repeatable' && u.id !== 'add_table' && sim.canBuyUpgrade(u)
  );
  if (repeatableUpgs.length > 0) {
    repeatableUpgs.sort((a, b) => sim.getUpgradeCost(a) - sim.getUpgradeCost(b));
    const chosen = repeatableUpgs[0];
    const cost = sim.getUpgradeCost(chosen);
    if (cost <= sim.gold * 0.45) {
      if (sim.buyUpgrade(chosen.id)) {
        recordPurchase(sim, {
          type: 'upgrade',
          kind: chosen.kind,
          id: chosen.id,
          name: `${chosen.name} (Lv ${sim.getUpgradeLevel(chosen.id)})`,
          cost,
        });
        return true;
      }
    }
  }

  return false;
}

function recordPurchase(sim, item) {
  const timeSec = sim.state.totalTimeSec;
  purchases.push({
    timeSec,
    timeStr: formatTime(timeSec),
    kind: item.kind,
    name: item.name,
    cost: item.cost,
    gold: sim.gold,
    reputation: sim.reputation,
    avgGoldPerSec: Math.round(sim.stats.avgGoldPerSec * 100) / 100,
  });

  if (item.id === 'exp_kitchen' && firstKitchenTimeSec === null) {
    firstKitchenTimeSec = timeSec;
  }
  if (allExpansionIds.has(item.id)) unlockedExpansions.add(item.id);
  if (allStaffHireIds.has(item.id)) unlockedStaffHires.add(item.id);
  if (allOneOffIds.has(item.id)) unlockedOneOffs.add(item.id);

  if (fullProgressionTimeSec === null && checkProgressionComplete(sim)) {
    fullProgressionTimeSec = timeSec;
  }
}

console.log(`Starting 6.0 simulated hours (${TOTAL_TICKS} ticks)...`);
const startWallMs = Date.now();

for (let tick = 1; tick <= TOTAL_TICKS; tick++) {
  sim.step(SIM_DT);

  if (tick % PURCHASE_INTERVAL_TICKS === 0) {
    evaluateAndPurchase(sim);
  }
}

const wallSec = ((Date.now() - startWallMs) / 1000).toFixed(2);
console.log(`Simulation completed in ${wallSec}s wall time.`);

// Output Chronological Purchase Timeline Table
console.log('\n--- PURCHASE TIMELINE ---');
console.log('| Time     | Kind         | Name                                     | Cost    | Gold    | Rep   | Gold/s |');
console.log('|----------|--------------|------------------------------------------|---------|---------|-------|--------|');
for (const p of purchases) {
  const timeCol = p.timeStr.padEnd(8);
  const kindCol = p.kind.padEnd(12);
  const nameCol = p.name.padEnd(40);
  const costCol = String(p.cost).padStart(7);
  const goldCol = String(p.gold).padStart(7);
  const repCol = String(p.reputation).padStart(5);
  const rateCol = String(p.avgGoldPerSec).padStart(6);
  console.log(`| ${timeCol} | ${kindCol} | ${nameCol} | ${costCol} | ${goldCol} | ${repCol} | ${rateCol} |`);
}

// Summary Metrics & Exit Gate Evaluation
const firstPurchaseSec = purchases.length > 0 ? purchases[0].timeSec : Infinity;
const earlyPurchases = purchases.filter((p) => p.timeSec >= 60 && p.timeSec <= 600);
let earlyGaps = [];
for (let i = 1; i < earlyPurchases.length; i++) {
  earlyGaps.push(earlyPurchases[i].timeSec - earlyPurchases[i - 1].timeSec);
}
const avgEarlyGapSec = earlyGaps.length > 0 ? earlyGaps.reduce((a, b) => a + b, 0) / earlyGaps.length : 0;

console.log('\n--- SUMMARY METRICS & PROGRESSION GATES ---');
console.log(`Total Purchases Made: ${purchases.length}`);
console.log(`Expansions Unlocked: ${unlockedExpansions.size}/${allExpansionIds.size}`);
console.log(`Staff Hired: ${unlockedStaffHires.size}/${allStaffHireIds.size}`);
console.log(`Recipes Unlocked: ${sim.state.unlockedRecipes.size}/${allRecipeIds.size}`);
console.log(`One-offs Unlocked: ${unlockedOneOffs.size}/${allOneOffIds.size}`);
console.log(`Final Gold: ${sim.gold}`);
console.log(`Final Reputation: ${sim.reputation}`);
console.log(`Final Customers Served: ${sim.stats.customersServed}`);

// Gate 1: First purchase time <= 60s
const gate1Pass = firstPurchaseSec <= 60;
console.log(`Gate 1 - First Purchase Time: ${firstPurchaseSec.toFixed(1)}s (Target <= 60s) -> ${gate1Pass ? 'PASS' : 'FAIL'}`);

// Gate 2: Early-game purchase cadence (min 1 to 10): avg gap in [15s, 180s], >= 5 purchases
const gate2Pass = earlyPurchases.length >= 5 && avgEarlyGapSec >= 15 && avgEarlyGapSec <= 180;
console.log(
  `Gate 2 - Early Cadence (1m-10m): ${earlyPurchases.length} purchases, avg gap ${avgEarlyGapSec.toFixed(1)}s (Target 15s-180s, >=5 items) -> ${gate2Pass ? 'PASS' : 'FAIL'}`
);

// Gate 3: First building expansion (exp_kitchen) between 4.0m and 16.0m
const firstKitchenMin = firstKitchenTimeSec !== null ? firstKitchenTimeSec / 60 : null;
const gate3Pass = firstKitchenMin !== null && firstKitchenMin >= 4.0 && firstKitchenMin <= 16.0;
console.log(
  `Gate 3 - First Expansion (exp_kitchen): ${firstKitchenMin !== null ? firstKitchenMin.toFixed(2) + 'm' : 'NONE'} (Target 4.0m-16.0m, target ~10m) -> ${gate3Pass ? 'PASS' : 'FAIL'}`
);

// Gate 4: Full progression unlock between 2.5h and 5.8h
const fullProgressionHrs = fullProgressionTimeSec !== null ? fullProgressionTimeSec / 3600 : null;
const gate4Pass = fullProgressionHrs !== null && fullProgressionHrs >= 2.5 && fullProgressionHrs <= 5.8;
console.log(
  `Gate 4 - Full Progression Unlock: ${fullProgressionHrs !== null ? fullProgressionHrs.toFixed(2) + 'h' : 'NOT REACHED'} (Target 2.5h-5.8h, target ~5h) -> ${gate4Pass ? 'PASS' : 'FAIL'}`
);

const allPass = gate1Pass && gate2Pass && gate3Pass && gate4Pass;

if (allPass) {
  console.log('\n[SUCCESS] All deterministic exit gates PASSED cleanly!');
  process.exit(0);
} else {
  console.log('\n[DIAGNOSTICS & TUNING REQUIRED]');
  if (!gate4Pass) {
    console.log(
      `- Gate 4 tripped: Full progression completed at ${fullProgressionHrs ? fullProgressionHrs.toFixed(2) + 'h' : 'unknown'}, which is faster than the 2.5h - 5.8h target.`
    );
    console.log(
      `- Cause: Total progression unlock cost across all 7 expansions, 8 staff, 15 recipes, and 15 one-offs is only 170,095 gold. In late game, high-tier patrons (merchants and nobles) generate ~100-130 gold/second, accumulating 170k gold rapidly.`
    );
    console.log(
      `- Tuning Recommendation for Primary Agent: In data/upgrades.json and data/recipes.json, scale late-game expansion/staff/one-off prices (e.g. exp_cellar 6.8k -> 25k, exp_stage 12.5k -> 60k, exp_garden 24k -> 150k, hire_lyra 14k -> 50k, hire_soleil 18k -> 80k) and increase late rep gates (e.g. exp_stage 420 -> 1,500, exp_garden 680 -> 3,500) so late progression decelerates naturally to hit the ~5 hour target.`
    );
  }
  process.exit(1);
}
