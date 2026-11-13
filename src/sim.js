// Pure DOM-free Tavern Simulation Core (`DT = 0.1s` fixed timestep).
// Runs identically in HTML5 browser runtime and headless Node.js (`sim_economy.mjs`, `soak_test.mjs`).

import { buildTavernLayout } from './layout.js';
import { mulberry32 } from './npc_traits.js';
import { BanterSystem } from './banter.js';
import { CustomerActor, StaffActor } from './actors.js';

export const SIM_DT = 0.1;
export const DAY_CYCLE_SEC = 480.0; // 8 real minutes per full tavern day

export class TavernSim {
  constructor(data, options = {}) {
    this.data = data; // { palette, recipes, upgrades, customers, staff, dialogue, thoughts }
    this.seed = options.seed || 12345;
    this.rng = mulberry32(this.seed);
    this.rngSeedCounter = 1;

    this.state = {
      gold: 16,
      reputation: 0,
      dayNumber: 1,
      dayTimeSec: 40.0, // start in cozy mid-morning
      totalTimeSec: 0,
      tableTier: 1,
      bedTier: 1,
      upgradeLevels: {},
      unlockedRecipes: new Set(),
      unlockedRooms: new Set(),
      hiredStaffIds: new Set(),
      hasSeenIntro: false,
    };

    // Unlock starter recipes (unlockCost === 0)
    for (const r of this.data.recipes.recipes) {
      if (r.unlockCost === 0) {
        this.state.unlockedRecipes.add(r.id);
      }
    }

    // Derived modifiers
    this.ambience = 0;
    this.maidSpeedMult = 1.0;
    this.chefSpeedMult = 1.0;
    this.chefBonus = 0;
    this.patronSpawnMult = 1.0;
    this.drinkPriceMult = 1.0;
    this.foodPriceMult = 1.0;
    this.repGainMult = 1.0;

    this.dayPhase = 'morning';
    this.dayPhaseSpec = this.data.customers.dayPhases[0];
    this.isMusicianPerforming = false;
    this.isDancerPerforming = false;
    this.doorOpenTimer = 0;
    this.isDoorOpen = false;

    this.layout = buildTavernLayout(this.state, this.data);
    this.banter = new BanterSystem(this.data.dialogue);

    // Dynamic world entities & bounded queues
    this.staff = [];
    this.customers = [];
    this.pendingOrders = [];
    this.readyOrders = [];
    this.floatingTexts = []; // bounded visual popups { text, x, y, life, maxLife, kind }
    this.events = [];        // bounded audio/UI event queue drained by main loop

    this.nextCustomerNum = 1;
    this.nextOrderId = 1;
    this.spawnTimer = 10.0;  // cozy quiet start: first villager walks in around ~10s
    this.hasSpawnedFirstRookie = false;
    this.regularsRoster = []; // bounded roster of up to 20 returning regulars { seed, archetypeId, visits, affinity }
    this.partyQueue = [];     // queued party companions { arch, partyInfo, delaySec }

    this.stats = {
      customersServed: 0,
      goldEarnedTotal: 0,
      complaintsTotal: 0,
      roomsRented: 0,
      suppliesSold: 0,
      recoveriesTotal: 0,
      recentGoldWindow: 0,
      recentWindowSec: 0,
      avgGoldPerSec: 0.35,
    };

    this.recomputeModifiers();
    this.syncStaffRoster();
  }

  nextSeed() {
    this.rngSeedCounter = (this.rngSeedCounter + 1) | 0;
    return Math.floor(this.rng() * 0x7fffffff) ^ this.rngSeedCounter;
  }

  emitEvent(type, payload = {}) {
    this.events.push({ type, ...payload });
    if (this.events.length > 48) {
      this.events.splice(0, this.events.length - 48);
    }
  }

  drainEvents() {
    if (this.events.length === 0) return [];
    return this.events.splice(0, this.events.length);
  }

  pushFloatingText(text, x, y, kind = 'gold') {
    this.floatingTexts.push({ text, x, y, life: 0, maxLife: 1.4, kind });
    if (this.floatingTexts.length > 24) {
      this.floatingTexts.shift();
    }
  }

  get gold() {
    return this.state.gold;
  }

  set gold(v) {
    this.state.gold = Math.max(0, Math.round(v * 100) / 100);
  }

  get reputation() {
    return this.state.reputation;
  }

  set reputation(v) {
    this.state.reputation = Math.max(0, Math.round(v * 10) / 10);
  }

  get tableTier() {
    return this.state.tableTier;
  }

  isUpgradeOwned(upgradeId) {
    return (this.state.upgradeLevels[upgradeId] || 0) > 0;
  }

  getUpgradeLevel(upgradeId) {
    return this.state.upgradeLevels[upgradeId] || 0;
  }

  getUpgradeCost(upgradeSpec) {
    const lv = this.getUpgradeLevel(upgradeSpec.id);
    return Math.floor(upgradeSpec.baseCost * Math.pow(upgradeSpec.costGrowth || 1.0, lv));
  }

  getUpgradeBlockReason(u) {
    const lv = this.getUpgradeLevel(u.id);
    if (lv >= u.maxLevel) return 'MAXED';
    if (u.requires && !this.isUpgradeOwned(u.requires)) {
      const reqSpec = this.data.upgrades.upgrades.find((x) => x.id === u.requires);
      return `Needs ${reqSpec ? reqSpec.name : u.requires}`;
    }
    if (this.reputation < (u.repRequired || 0)) {
      return `Needs ${u.repRequired} Rep`;
    }
    if (u.effect?.type === 'add_table' && (2 + lv) >= this.layout.maxTableSlots) {
      return 'Expand building for space';
    }
    const cost = this.getUpgradeCost(u);
    if (this.gold < cost) return `Needs ${cost}g`;
    return null;
  }

  canBuyUpgrade(u) {
    return this.getUpgradeBlockReason(u) === null;
  }

  buyUpgrade(upgradeId) {
    const u = this.data.upgrades.upgrades.find((x) => x.id === upgradeId);
    if (!u || !this.canBuyUpgrade(u)) return false;

    const cost = this.getUpgradeCost(u);
    this.gold = Math.floor(this.gold - cost);
    this.state.upgradeLevels[u.id] = (this.state.upgradeLevels[u.id] || 0) + 1;

    const eff = u.effect || {};
    if (eff.type === 'table_tier') {
      this.state.tableTier = Math.max(this.state.tableTier, Number(eff.value) || 2);
    } else if (eff.type === 'bed_tier') {
      this.state.bedTier = Math.max(this.state.bedTier, Number(eff.value) || 2);
    } else if (eff.type === 'unlock_room') {
      this.state.unlockedRooms.add(String(eff.value));
    } else if (eff.type === 'hire_staff') {
      this.state.hiredStaffIds.add(String(eff.value));
    }

    this.recomputeModifiers();
    this.rebuildLayoutPreservingOccupancy();
    this.syncStaffRoster();

    // Visible world feedback for repeatable and one-off purchases (B2)
    if (eff.type === 'maid_speed') {
      const pct = Math.round(this.maidSpeedMult * 100);
      for (const s of this.staff) {
        if (s.role === 'maid') s.setEmote('emote_sparkle', 2.4);
      }
      const nyahActor = this.staff.find((s) => s.id === 'nyah') || this.staff[0];
      if (nyahActor) this.pushFloatingText(`Maid Speed ${pct}%!`, nyahActor.x, nyahActor.y - 46, 'gold');
    } else if (eff.type === 'chef_speed') {
      const pct = Math.round(this.chefSpeedMult * 100);
      for (const s of this.staff) {
        if (s.role === 'chef') s.setEmote('emote_sparkle', 2.4);
      }
      const chefActor = this.staff.find((s) => s.role === 'chef') || this.staff[0];
      if (chefActor) this.pushFloatingText(`Cook Speed ${pct}%!`, chefActor.x, chefActor.y - 46, 'gold');
    } else if (eff.type === 'ambience_bonus') {
      const bp = this.layout.waypoints.barBehind;
      this.pushFloatingText(`Ambience ${this.ambience}!`, bp.x, bp.y - 28, 'gold');
      const fifiActor = this.staff.find((s) => s.id === 'fifi');
      if (fifiActor) fifiActor.setEmote('emote_sparkle', 2.4);
    } else if (eff.type === 'patron_spawn_rate') {
      const pct = Math.round((this.patronSpawnMult - 1) * 100);
      const dp = this.layout.waypoints.entranceInside;
      this.pushFloatingText(`Traffic +${pct}%!`, dp.x, dp.y - 30, 'gold');
    }

    this.emitEvent('upgrade_bought', {
      upgradeId: u.id,
      kind: u.kind,
      name: u.name,
      roomKey: eff.type === 'unlock_room' ? String(eff.value) : null,
      comment: u.nyahComment,
    });

    if (eff.type === 'hire_staff') {
      const staffId = String(eff.value);
      if (!this.banter.triggerHireScene(staffId) && u.nyahComment) {
        this.banter.pushCustomLine('nyah', u.nyahComment, 'emote_sparkle');
      }
    } else if (u.kind === 'expansion') {
      this.banter.trigger('expansion', this, true);
    } else {
      this.banter.trigger('upgrade', this, false);
    }
    return true;
  }

  getRecipeBlockReason(r) {
    if (this.state.unlockedRecipes.has(r.id)) return 'UNLOCKED';
    if (r.requiredExpansion && !this.isUpgradeOwned(r.requiredExpansion)) {
      const reqSpec = this.data.upgrades.upgrades.find((x) => x.id === r.requiredExpansion);
      return `Needs ${reqSpec ? reqSpec.name : r.requiredExpansion}`;
    }
    if (this.reputation < (r.repRequired || 0)) {
      return `Needs ${r.repRequired} Rep`;
    }
    if (this.gold < r.unlockCost) {
      return `Needs ${r.unlockCost}g`;
    }
    return null;
  }

  canUnlockRecipe(r) {
    return this.getRecipeBlockReason(r) === null;
  }

  unlockRecipe(recipeId) {
    const r = this.data.recipes.recipes.find((x) => x.id === recipeId);
    if (!r || !this.canUnlockRecipe(r)) return false;

    this.gold = Math.floor(this.gold - r.unlockCost);
    this.state.unlockedRecipes.add(r.id);
    this.emitEvent('recipe_unlocked', { recipeId: r.id, name: r.name });
    this.banter.trigger('upgrade', this, false);
    return true;
  }

  getUnlockedRecipes() {
    return this.data.recipes.recipes.filter((r) => this.state.unlockedRecipes.has(r.id));
  }

  recomputeModifiers() {
    let ambience = 0;
    let maidSpeed = 1.0;
    let chefSpeed = 1.0;
    let spawnMult = 1.0;
    let drinkMult = 1.0;
    let foodMult = 1.0;
    let repMult = 1.0;

    for (const u of this.data.upgrades.upgrades) {
      const lv = this.getUpgradeLevel(u.id);
      if (lv <= 0) continue;
      const eff = u.effect || {};
      const val = Number(eff.value) || 0;
      switch (eff.type) {
        case 'ambience_bonus':
          ambience += val * lv;
          break;
        case 'maid_speed':
          maidSpeed += val * lv;
          break;
        case 'chef_speed':
          chefSpeed += val * lv;
          break;
        case 'patron_spawn_rate':
          spawnMult += val * lv;
          break;
        case 'drink_price_mult':
          drinkMult += val * lv;
          break;
        case 'food_price_mult':
          foodMult += val * lv;
          break;
        case 'rep_gain_mult':
          repMult += val * lv;
          break;
        default:
          break;
      }
    }

    // Room expansions also contribute natural prestige ambience & beverage quality
    const rooms = this.state.unlockedRooms;
    if (rooms.has('cellar')) drinkMult += 0.20;
    if (rooms.has('kitchen')) foodMult += 0.15;
    if (rooms.has('garden')) ambience += 12;
    if (rooms.has('main_hall')) ambience += 8;

    this.ambience = ambience;
    this.maidSpeedMult = maidSpeed;
    this.chefSpeedMult = chefSpeed;
    this.chefBonus = chefSpeed - 1.0;
    this.patronSpawnMult = spawnMult;
    this.drinkPriceMult = drinkMult;
    this.foodPriceMult = foodMult;
    this.repGainMult = repMult;
  }

  isRoomUnlocked(roomKey) {
    return this.state.unlockedRooms.has(roomKey);
  }

  rebuildLayoutPreservingOccupancy() {
    const prevTables = this.layout ? this.layout.tables : [];
    const prevBeds = this.layout ? this.layout.beds : [];

    const nextLayout = buildTavernLayout(this.state, this.data);

    for (let t = 0; t < Math.min(prevTables.length, nextLayout.tables.length); t++) {
      const oldT = prevTables[t];
      const newT = nextLayout.tables[t];
      newT.activeDishProp = oldT.activeDishProp;
      newT.hasHotFood = oldT.hasHotFood;
      newT.dirty = oldT.dirty;
      newT.claimedCleanBy = oldT.claimedCleanBy;
      for (let s = 0; s < Math.min(oldT.seats.length, newT.seats.length); s++) {
        newT.seats[s].occupiedBy = oldT.seats[s].occupiedBy;
      }
    }

    for (let b = 0; b < Math.min(prevBeds.length, nextLayout.beds.length); b++) {
      nextLayout.beds[b].occupiedBy = prevBeds[b].occupiedBy;
    }

    // Release any customers whose seat/bed belonged to a wing hidden after toggling dev mode off
    const validSeats = new Set();
    for (const t of nextLayout.tables) {
      for (const s of t.seats) validSeats.add(s);
    }
    const validBeds = new Set(nextLayout.beds);
    for (const c of this.customers || []) {
      if (c.seat && !validSeats.has(c.seat)) {
        c.seat = null;
        if (c.state !== 'LEAVING') {
          c.state = 'LEAVING';
          c.anim = 'walk';
          c.path = [];
          c.target = { ...nextLayout.waypoints.doorExit };
        }
      }
      if (c.bed && !validBeds.has(c.bed)) {
        c.bed = null;
        if (c.state !== 'LEAVING') {
          c.state = 'LEAVING';
          c.anim = 'walk';
          c.path = [];
          c.target = { ...nextLayout.waypoints.doorExit };
        }
      }
    }

    this.layout = nextLayout;
  }

  syncStaffRoster() {
    const existingIds = new Set(this.staff.map((s) => s.id));
    for (const cSpec of this.data.staff.canonStaff) {
      if (!existingIds.has(cSpec.id)) {
        this.staff.push(new StaffActor(cSpec, this.staff.length, this));
        existingIds.add(cSpec.id);
      }
    }
    for (const hSpec of this.data.staff.hireableStaff) {
      if (this.state.hiredStaffIds.has(hSpec.id) && !existingIds.has(hSpec.id)) {
        this.staff.push(new StaffActor(hSpec, this.staff.length, this));
        existingIds.add(hSpec.id);
      }
    }
  }

  getTotalSeatCapacity() {
    let total = 0;
    for (const t of this.layout.tables) total += t.seats.length;
    return total;
  }

  hasFreeSeat() {
    for (const t of this.layout.tables) {
      if (t.dirty) continue;
      for (const s of t.seats) {
        if (!s.occupiedBy) return true;
      }
    }
    return false;
  }

  countFreeSeats() {
    let free = 0;
    for (const t of this.layout.tables) {
      if (t.dirty) continue;
      for (const s of t.seats) {
        if (!s.occupiedBy) free++;
      }
    }
    return free;
  }

  claimFreeSeat(customerId, preferredTableIndex = null) {
    // If part of an adventurer party with a preferred table, sit together if possible!
    if (preferredTableIndex !== null && this.layout.tables[preferredTableIndex]) {
      const prefT = this.layout.tables[preferredTableIndex];
      if (!prefT.dirty) {
        for (const s of prefT.seats) {
          if (!s.occupiedBy) {
            s.occupiedBy = customerId;
            return { tableIndex: prefT.index, seatIndex: s.seatIndex };
          }
        }
      }
    }

    // Spread customers evenly across non-dirty tables
    const candidates = [];
    for (const t of this.layout.tables) {
      if (t.dirty) continue;
      for (const s of t.seats) {
        if (!s.occupiedBy) {
          candidates.push({ tableIndex: t.index, seatIndex: s.seatIndex });
        }
      }
    }
    if (candidates.length === 0) return null;
    const pick = candidates[Math.abs(this.nextSeed()) % candidates.length];
    this.layout.tables[pick.tableIndex].seats[pick.seatIndex].occupiedBy = customerId;
    return pick;
  }

  claimFreeBed(customerId) {
    for (const b of this.layout.beds) {
      if (!b.occupiedBy) {
        b.occupiedBy = customerId;
        return b.index;
      }
    }
    return null;
  }

  getCustomerById(id) {
    for (let i = 0; i < this.customers.length; i++) {
      if (this.customers[i].id === id) return this.customers[i];
    }
    return null;
  }

  claimWaitingPatronForOrder(maidId) {
    // Pick longest-waiting patron first
    let best = null;
    for (const c of this.customers) {
      if (c.state === 'WAITING_TO_ORDER' && !c.claimedByMaidId) {
        if (!best || c.stateTimer > best.stateTimer) {
          best = c;
        }
      }
    }
    if (best) {
      best.claimedByMaidId = maidId;
    }
    return best;
  }

  enqueueKitchenOrder(order) {
    this.pendingOrders.push(order);
  }

  claimPendingOrderForCook(staffActor) {
    const hasDedicatedBartender = this.staff.some((s) => s.role === 'bartender');
    for (let i = 0; i < this.pendingOrders.length; i++) {
      const ord = this.pendingOrders[i];
      if (ord.cookingByStaffId) continue;
      if (staffActor.role === 'bartender' && ord.station === 'bar') {
        this.pendingOrders.splice(i, 1);
        ord.cookingByStaffId = staffActor.id;
        return ord;
      }
      if (staffActor.role === 'chef') {
        if (ord.station === 'kitchen' || !hasDedicatedBartender || this.pendingOrders.length > 3) {
          this.pendingOrders.splice(i, 1);
          ord.cookingByStaffId = staffActor.id;
          return ord;
        }
      }
    }
    return null;
  }

  claimReadyOrder(maidId) {
    for (let i = 0; i < this.readyOrders.length; i++) {
      const ord = this.readyOrders[i];
      if (!ord.claimedByMaidId) {
        this.readyOrders.splice(i, 1);
        ord.claimedByMaidId = maidId;
        return ord;
      }
    }
    return null;
  }

  claimDirtyTable(maidId) {
    for (let i = 0; i < this.layout.tables.length; i++) {
      const t = this.layout.tables[i];
      if (t.dirty && !t.claimedCleanBy) {
        t.claimedCleanBy = maidId;
        return i;
      }
    }
    return null;
  }

  cancelOrdersForCustomer(customerId) {
    for (let i = this.pendingOrders.length - 1; i >= 0; i--) {
      if (this.pendingOrders[i].customerId === customerId) {
        this.pendingOrders.splice(i, 1);
      }
    }
    for (let i = this.readyOrders.length - 1; i >= 0; i--) {
      if (this.readyOrders[i].customerId === customerId) {
        this.readyOrders.splice(i, 1);
      }
    }
  }

  onCustomerComplaint() {
    this.stats.complaintsTotal += 1;
    this.reputation = Math.max(0, this.reputation - 0.4);
    this.emitEvent('complaint', {});
    this.banter.trigger('complaint', this);
  }

  settleCustomerPayment(cust) {
    let mealTotal = cust.mealBill;
    if (cust.orderedRecipe) {
      if (cust.orderedRecipe.category === 'drink') mealTotal *= this.drinkPriceMult;
      else if (cust.orderedRecipe.category === 'food') mealTotal *= this.foodPriceMult;
    }
    const tableTierMult = 1 + (this.state.tableTier - 1) * 0.14;
    const subTotal = Math.round(mealTotal * tableTierMult) + cust.supplyBill + cust.roomFee;
    if (subTotal <= 0) return;

    let tip = 0;
    if (cust.mood >= 48) {
      const moodFactor = (cust.mood - 42) / 52;
      const entertainerBonus =
        (this.isMusicianPerforming ? 0.16 : 0) + (this.isDancerPerforming ? 0.20 : 0);
      const ambienceBonus = Math.min(0.45, this.ambience * 0.004);
      const quirkMult = cust.quirk === 'generous' ? 1.3 : cust.quirk === 'frugal' ? 0.65 : 1.0;
      tip = Math.round(
        subTotal *
          (cust.archetype.tipMultiplier || 0.15) *
          moodFactor *
          quirkMult *
          (1 + cust.servedByMaidTipBonus + entertainerBonus + ambienceBonus)
      );
    }

    const totalEarned = Math.max(1, subTotal + tip);
    this.gold = Math.round(this.gold + totalEarned);
    this.stats.goldEarnedTotal += totalEarned;
    this.stats.recentGoldWindow += totalEarned;
    this.stats.customersServed += 1;
    if (cust.roomFee > 0) this.stats.roomsRented += 1;
    if (cust.supplyBill > 0) this.stats.suppliesSold += 1;

    const repDelta =
      (cust.archetype.repReward || 1.0) *
      (cust.mood >= 75 ? 1.25 : cust.mood >= 50 ? 1.0 : 0.4) *
      this.repGainMult;
    this.reputation = Math.round((this.reputation + repDelta) * 10) / 10;

    cust.setEmote(tip >= 15 ? 'emote_heart' : 'emote_coin', 2.4);
    this.pushFloatingText(`+${totalEarned}g`, cust.x, cust.y - 44, 'gold');
    this.emitEvent('payment', { gold: totalEarned, tip, repDelta });

    // Record or level up happy guests in the Returning Regulars roster (up to 20 regulars)
    if (cust.mood >= 58) {
      const existing = this.regularsRoster.find((r) => r.seed === cust.seed);
      if (existing) {
        existing.visits = (existing.visits || 1) + 1;
        existing.affinity = Math.min(20, (existing.affinity || 2) + 2);
      } else if (this.regularsRoster.length < 20) {
        this.regularsRoster.push({
          seed: cust.seed,
          archetypeId: cust.archetype.id,
          visits: 1,
          affinity: 2,
        });
      }
    }

    if (tip >= 20) {
      this.banter.trigger('big_tip', this);
    }
  }

  chooseSpawnArchetype() {
    const hasKitchen = this.isUpgradeOwned('exp_kitchen');
    const eligible = this.data.customers.archetypes.filter((a) => {
      if (this.reputation < (a.minRep || 0)) return false;
      if (a.requiredExpansion && !this.isUpgradeOwned(a.requiredExpansion)) return false;
      // Keep the opening 6 minutes strictly local villagers
      if (a.id !== 'villager' && this.state.totalTimeSec < 360) return false;
      return true;
    });
    const pool = eligible.length > 0 ? eligible : [this.data.customers.archetypes[0]];

    // Guarantee the milestone first Rookie Adventurer sighting once eligible around minute 6-8
    if (!this.hasSpawnedFirstRookie) {
      const rookieSpec = pool.find((a) => a.id === 'adventurer_rookie');
      if (rookieSpec) {
        this.hasSpawnedFirstRookie = true;
        return rookieSpec;
      }
    }

    let totalWeight = 0;
    const weights = pool.map((a) => {
      let w = Math.max(0.05, a.spawnWeightsByPhase?.[this.dayPhase] ?? 1.0);
      // Before Kitchen expansion, rookie adventurers are a rare sighting (~15-18%)
      if (a.id === 'adventurer_rookie' && !hasKitchen) {
        w *= 0.38;
      }
      totalWeight += w;
      return w;
    });
    let roll = (Math.abs(this.nextSeed()) % 10000) / 10000 * totalWeight;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        if (pool[i].id === 'adventurer_rookie') this.hasSpawnedFirstRookie = true;
        return pool[i];
      }
    }
    const chosen = pool[pool.length - 1];
    if (chosen.id === 'adventurer_rookie') this.hasSpawnedFirstRookie = true;
    return chosen;
  }

  getTargetGuestsPerMin() {
    // 1. Cozy opening baseline: ~2.3 guests/min (first 3m averages ~2.4-2.7/min)
    let rate = 2.25;

    // 2. Fame (reputation) & Ambience contribution (never driven by table/seat count!)
    const rep = Math.max(0, this.reputation);
    const repBoost = Math.min(2.2, Math.sqrt(rep) * 0.34) + Math.min(9.0, rep * 0.004);
    const ambienceBoost = Math.min(3.6, this.ambience * 0.045);
    rate += repBoost + ambienceBoost;

    // 3. Building Expansion traffic boosts
    const rooms = this.state.unlockedRooms;
    if (rooms.has('kitchen')) rate += 1.65;       // Pushes post-Kitchen into 5-8 guests/min
    if (rooms.has('counter_shop')) rate += 1.45;  // Supply counter attracts questing traffic
    if (rooms.has('main_hall')) rate += 2.4;
    if (rooms.has('upstairs')) rate += 1.8;
    if (rooms.has('cellar')) rate += 1.6;
    if (rooms.has('stage')) rate += 2.0;
    if (rooms.has('garden')) rate += 2.2;

    // 4. Town Crier / marketing multiplier (gentle before Kitchen so early tavern stays cozy)
    const crierMult = rooms.has('kitchen')
      ? this.patronSpawnMult
      : 1 + (this.patronSpawnMult - 1) * 0.45;
    rate *= crierMult;

    // 5. Time-of-day modulation (evening rush hours surge once Supply Counter is open)
    let phaseMult = this.dayPhaseSpec?.spawnRateMult || 1.0;
    if (this.dayPhase === 'evening' && rooms.has('counter_shop')) {
      phaseMult *= 1.25;
    }
    rate *= phaseMult;

    // Enforce target pacing envelopes per progression stage
    if (!rooms.has('kitchen')) {
      if (this.state.totalTimeSec < 180) {
        rate = Math.min(3.0, Math.max(2.1, rate));
      } else {
        rate = Math.min(5.0, Math.max(3.0, rate));
      }
    } else if (!rooms.has('counter_shop')) {
      rate = Math.min(8.0, Math.max(5.0, rate));
    }

    return Math.max(1.8, Math.min(32.0, rate));
  }

  spawnCustomer(forcedArch = null, partyInfo = null) {
    const seatCap = this.getTotalSeatCapacity();
    const maxActive = seatCap + this.layout.beds.length + 3;
    if (this.customers.length >= maxActive) return null;

    const arch = forcedArch || this.chooseSpawnArchetype();
    const id = `c_${this.nextCustomerNum++}`;

    // Check if an inactive Returning Regular of this archetype wants to revisit (~30% chance)
    let regularEntry = null;
    if (this.regularsRoster.length > 0 && ((Math.abs(this.nextSeed()) % 100) < 30)) {
      const activeSeeds = new Set(this.customers.map((c) => c.seed));
      const candidates = this.regularsRoster.filter(
        (r) => r.archetypeId === arch.id && !activeSeeds.has(r.seed)
      );
      if (candidates.length > 0) {
        regularEntry = candidates[this.nextCustomerNum % candidates.length];
      }
    }

    const seed = regularEntry ? regularEntry.seed : (Math.abs(this.nextSeed()) || 1);
    const cust = new CustomerActor(id, seed, arch, this, { regularEntry, partyInfo });
    this.customers.push(cust);
    return cust;
  }

  updateDayCycle(dt) {
    this.state.dayTimeSec += dt;
    if (this.state.dayTimeSec >= DAY_CYCLE_SEC) {
      this.state.dayTimeSec -= DAY_CYCLE_SEC;
      this.state.dayNumber += 1;
    }
    const norm = this.state.dayTimeSec / DAY_CYCLE_SEC;
    const prevPhase = this.dayPhase;
    let matched = this.data.customers.dayPhases[0];
    for (const p of this.data.customers.dayPhases) {
      if (norm >= p.startNorm && norm < p.endNorm) {
        matched = p;
        break;
      }
    }
    this.dayPhase = matched.id;
    this.dayPhaseSpec = matched;
    if (this.dayPhase !== prevPhase) {
      if (this.dayPhase === 'morning') this.banter.trigger('morning', this);
      else if (this.dayPhase === 'night') this.banter.trigger('night', this);
    }
  }

  step(dt = SIM_DT, onVoiceBlip = null) {
    this.state.totalTimeSec += dt;
    this.updateDayCycle(dt);

    // Update rolling gold/sec estimator every 20s
    this.stats.recentWindowSec += dt;
    if (this.stats.recentWindowSec >= 20.0) {
      const instRate = this.stats.recentGoldWindow / this.stats.recentWindowSec;
      this.stats.avgGoldPerSec = Math.max(0.15, this.stats.avgGoldPerSec * 0.65 + instRate * 0.35);
      this.stats.recentGoldWindow = 0;
      this.stats.recentWindowSec = 0;
    }

    // Drain queued adventurer party companions walking in together (~1.0s apart)
    if (this.partyQueue.length > 0) {
      this.partyQueue[0].delaySec -= dt;
      if (this.partyQueue[0].delaySec <= 0) {
        const nextMember = this.partyQueue.shift();
        this.spawnCustomer(nextMember.arch, nextMember.partyInfo);
      }
    }

    // Spawn logic driven by fame (reputation), ambience, expansions, and time of day (never seat count!)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const spawned = this.spawnCustomer();
      let partySpacingMult = 1.0;

      // Adventurer Party Waves (C1): after Kitchen unlocks, adventurers can arrive in 2-to-3 person parties!
      if (
        spawned &&
        this.isUpgradeOwned('exp_kitchen') &&
        spawned.archetype.id.startsWith('adventurer') &&
        this.partyQueue.length === 0 &&
        this.countFreeSeats() >= 3 &&
        ((this.nextCustomerNum * 13) % 100) < (this.isUpgradeOwned('exp_counter_shop') ? 28 : 18)
      ) {
        const partySize = this.countFreeSeats() >= 4 && (this.nextCustomerNum % 3 === 0) ? 3 : 2;
        // Find a table with >=2 free seats so the party can sit together
        let prefTableIdx = null;
        for (const t of this.layout.tables) {
          if (t.dirty) continue;
          const openCount = t.seats.filter((s) => !s.occupiedBy).length;
          if (openCount >= 2) {
            prefTableIdx = t.index;
            break;
          }
        }
        spawned.partyInfo = { size: partySize, index: 1, preferredTableIndex: prefTableIdx };
        for (let p = 2; p <= partySize; p++) {
          this.partyQueue.push({
            arch: spawned.archetype,
            partyInfo: { size: partySize, index: p, preferredTableIndex: prefTableIdx },
            delaySec: 1.0,
          });
        }
        partySpacingMult = partySize;
      }

      const guestsPerMin = this.getTargetGuestsPerMin();
      const baseInterval = (60.0 / guestsPerMin) * partySpacingMult;
      const jitter = 0.88 + ((Math.abs(this.nextSeed()) % 25) / 100);
      this.spawnTimer = Math.max(1.6, baseInterval * jitter);
    }

    // Update staff & track entertainer flags
    let musicianOn = false;
    let dancerOn = false;
    let recoveries = 0;
    for (let i = 0; i < this.staff.length; i++) {
      const s = this.staff[i];
      const prevRec = s.recoveryCount;
      s.update(dt, this);
      if (s.recoveryCount > prevRec) recoveries += s.recoveryCount - prevRec;
      if (s.role === 'musician' && s.state === 'PERFORMING') musicianOn = true;
      if (s.role === 'dancer' && s.state === 'PERFORMING') dancerOn = true;
    }
    this.isMusicianPerforming = musicianOn;
    this.isDancerPerforming = dancerOn;

    // Update customers & sweep DESPAWNED
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      const prevRec = c.recoveryCount;
      c.update(dt, this);
      if (c.recoveryCount > prevRec) recoveries += c.recoveryCount - prevRec;
      if (c.state === 'DESPAWNED') {
        c.cleanupAll(this);
        this.customers.splice(i, 1);
      }
    }
    this.stats.recoveriesTotal += recoveries;

    // Door open/close tracking: doors swing open as patrons enter or leave
    const doorTileX = this.layout.doorTileX ?? 12;
    const doorTileY = this.layout.doorTileY ?? 11;
    const doorX = (doorTileX + 1) * 32;
    const doorY = (doorTileY + 1) * 32 - 16;
    let actorNearDoor = false;
    for (let i = 0; i < this.customers.length; i++) {
      const c = this.customers[i];
      if (Math.abs(c.x - doorX) < 48 && Math.abs(c.y - doorY) < 64) {
        actorNearDoor = true;
        break;
      }
    }
    if (actorNearDoor) {
      this.doorOpenTimer = 0.8;
    } else if (this.doorOpenTimer > 0) {
      this.doorOpenTimer = Math.max(0, this.doorOpenTimer - dt);
    }
    this.isDoorOpen = this.doorOpenTimer > 0;

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += dt;
      ft.y -= 14 * dt;
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Update banter
    this.banter.update(dt, this, onVoiceBlip);
  }

  findActorAtWorld(wx, wy) {
    // Combine staff and customers, check reverse footY (front-most entity wins!)
    const all = [...this.staff, ...this.customers];
    all.sort((a, b) => b.y - a.y);
    for (const actor of all) {
      if (wx >= actor.x - 18 && wx <= actor.x + 18 && wy >= actor.y - 45 && wy <= actor.y + 4) {
        return actor;
      }
    }
    return null;
  }

  getActorById(id) {
    for (const s of this.staff) if (s.id === id) return s;
    for (const c of this.customers) if (c.id === id) return c;
    return null;
  }

  serializeSave(nowMs = Date.now()) {
    return {
      version: 1,
      savedAtMs: nowMs,
      seed: this.seed,
      gold: Math.floor(this.gold),
      reputation: this.reputation,
      dayNumber: this.state.dayNumber,
      dayTimeSec: this.state.dayTimeSec,
      totalTimeSec: this.state.totalTimeSec,
      tableTier: this.state.tableTier,
      bedTier: this.state.bedTier,
      upgradeLevels: { ...this.state.upgradeLevels },
      unlockedRecipes: Array.from(this.state.unlockedRecipes),
      unlockedRooms: Array.from(this.state.unlockedRooms),
      hiredStaffIds: Array.from(this.state.hiredStaffIds),
      hasSeenIntro: this.state.hasSeenIntro,
      hasSpawnedFirstRookie: this.hasSpawnedFirstRookie,
      regularsRoster: this.regularsRoster.slice(-30).map((r) => ({ ...r })),
      stats: { ...this.stats },
    };
  }

  loadSave(payload, nowMs = Date.now()) {
    if (!payload || typeof payload !== 'object') return null;
    const finiteNum = (v, fallback, min = -Infinity, max = Infinity) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
    };

    const rawSeed = Number(payload.seed);
    if (Number.isFinite(rawSeed) && rawSeed > 0) {
      this.seed = Math.floor(rawSeed);
    }

    this.gold = Math.floor(finiteNum(payload.gold, 16, 0));
    this.reputation = finiteNum(payload.reputation, 0, 0);
    this.state.dayNumber = Math.floor(finiteNum(payload.dayNumber, 1, 1));
    this.state.dayTimeSec = finiteNum(payload.dayTimeSec, 40, 0, DAY_CYCLE_SEC - 0.01);
    this.state.totalTimeSec = finiteNum(payload.totalTimeSec, 0, 0);
    this.state.tableTier = Math.floor(finiteNum(payload.tableTier, 1, 1, 4));
    this.state.bedTier = Math.floor(finiteNum(payload.bedTier, 1, 1, 2));

    const validUpgrades = new Map(this.data.upgrades.upgrades.map((u) => [u.id, u]));
    const cleanUpgrades = {};
    if (payload.upgradeLevels && typeof payload.upgradeLevels === 'object') {
      for (const [uid, rawLvl] of Object.entries(payload.upgradeLevels)) {
        const spec = validUpgrades.get(uid);
        if (!spec) continue;
        const maxLvl = spec.maxLevel ?? 999;
        cleanUpgrades[uid] = Math.floor(finiteNum(rawLvl, 0, 0, maxLvl));
      }
    }
    this.state.upgradeLevels = cleanUpgrades;

    const validRecipes = new Set(this.data.recipes.recipes.map((r) => r.id));
    this.state.unlockedRecipes = new Set(
      (Array.isArray(payload.unlockedRecipes) ? payload.unlockedRecipes : []).filter(
        (id) => typeof id === 'string' && validRecipes.has(id)
      )
    );
    for (const r of this.data.recipes.recipes) {
      if (r.unlockCost === 0) this.state.unlockedRecipes.add(r.id);
    }

    const validRooms = new Set(
      this.data.upgrades.upgrades
        .filter((u) => u.effect?.type === 'unlock_room' && typeof u.effect.value === 'string')
        .map((u) => u.effect.value)
    );
    this.state.unlockedRooms = new Set(
      (Array.isArray(payload.unlockedRooms) ? payload.unlockedRooms : []).filter(
        (id) => typeof id === 'string' && validRooms.has(id)
      )
    );

    const validHireable = new Set(this.data.staff.hireableStaff.map((s) => s.id));
    this.state.hiredStaffIds = new Set(
      (Array.isArray(payload.hiredStaffIds) ? payload.hiredStaffIds : []).filter(
        (id) => typeof id === 'string' && validHireable.has(id)
      )
    );
    this.state.hasSeenIntro = Boolean(payload.hasSeenIntro);
    this.hasSpawnedFirstRookie = Boolean(payload.hasSpawnedFirstRookie);

    const validArchIds = new Set(this.data.customers.archetypes.map((a) => a.id));
    this.regularsRoster = Array.isArray(payload.regularsRoster)
      ? payload.regularsRoster
        .filter((r) => r && typeof r === 'object' && Number.isFinite(Number(r.seed)) && validArchIds.has(r.archetypeId))
        .slice(-30)
        .map((r) => ({
          seed: Math.floor(Number(r.seed)),
          archetypeId: r.archetypeId,
          name: typeof r.name === 'string' ? r.name : 'Patron',
          visits: Math.max(1, Math.floor(finiteNum(r.visits, 1, 1, 99999))),
          lastGoldSpent: Math.max(0, Math.floor(finiteNum(r.lastGoldSpent, 0, 0, 999999))),
          affinity: typeof r.affinity === 'string' ? r.affinity : 'Regular',
        }))
      : [];

    if (payload.stats && typeof payload.stats === 'object') {
      this.stats = {
        customersServed: Math.floor(finiteNum(payload.stats.customersServed, this.stats.customersServed, 0)),
        goldEarnedTotal: Math.floor(finiteNum(payload.stats.goldEarnedTotal, this.stats.goldEarnedTotal, 0)),
        complaintsTotal: Math.floor(finiteNum(payload.stats.complaintsTotal, this.stats.complaintsTotal, 0)),
        roomsRented: Math.floor(finiteNum(payload.stats.roomsRented, this.stats.roomsRented, 0)),
        suppliesSold: Math.floor(finiteNum(payload.stats.suppliesSold, this.stats.suppliesSold, 0)),
        recoveriesTotal: Math.floor(finiteNum(payload.stats.recoveriesTotal, this.stats.recoveriesTotal, 0)),
        recentGoldWindow: finiteNum(payload.stats.recentGoldWindow, 0, 0),
        recentWindowSec: finiteNum(payload.stats.recentWindowSec, 0, 0),
        avgGoldPerSec: finiteNum(payload.stats.avgGoldPerSec, 0.35, 0.05, 10000),
      };
    }

    // Reset active transients cleanly on load
    this.customers = [];
    this.pendingOrders = [];
    this.readyOrders = [];
    this.floatingTexts = [];
    this.partyQueue = [];
    this.staff = [];

    this.recomputeModifiers();
    this.layout = buildTavernLayout(this.state, this.data);
    this.syncStaffRoster();
    this.updateDayCycle(0);

    // Calculate capped, reduced-rate offline earnings if away >= 60s
    const rawSavedAt = Number(payload.savedAtMs);
    const savedAt = Number.isFinite(rawSavedAt) ? rawSavedAt : nowMs;
    const elapsedSec = Math.max(0, (nowMs - savedAt) / 1000);
    if (elapsedSec >= 60) {
      const cappedSec = Math.min(elapsedSec, 8 * 3600);
      const estRate = Math.max(0.25, Number(this.stats.avgGoldPerSec) || 0.35);
      const offlineGold = Math.max(1, Math.round(cappedSec * estRate * 0.45));
      const estCustomers = Math.max(1, Math.round(cappedSec / 14));
      this.gold = Math.round(this.gold + offlineGold);
      this.stats.goldEarnedTotal += offlineGold;
      this.stats.customersServed += estCustomers;
      this.state.totalTimeSec += cappedSec;
      const totalDayOffset = this.state.dayTimeSec + cappedSec;
      this.state.dayNumber += Math.floor(totalDayOffset / DAY_CYCLE_SEC);
      this.state.dayTimeSec = totalDayOffset % DAY_CYCLE_SEC;
      this.updateDayCycle(0);
      return this.banter.formatOfflineSummary(elapsedSec / 60, offlineGold, estCustomers);
    }
    return null;
  }

  exportSaveString(nowMs = Date.now()) {
    const json = JSON.stringify(this.serializeSave(nowMs));
    if (typeof btoa === 'function') {
      return btoa(unescape(encodeURIComponent(json)));
    }
    return Buffer.from(json, 'utf-8').toString('base64');
  }

  importSaveString(str, nowMs = Date.now()) {
    const trimmed = String(str || '').trim();
    if (!trimmed) throw new Error('Empty save string');
    let json = trimmed;
    if (!trimmed.startsWith('{')) {
      if (typeof atob === 'function') {
        json = decodeURIComponent(escape(atob(trimmed)));
      } else {
        json = Buffer.from(trimmed, 'base64').toString('utf-8');
      }
    }
    const parsed = JSON.parse(json);
    return this.loadSave(parsed, nowMs);
  }
}
