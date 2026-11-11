// Timeout-guarded finite state machines (FSMs) for Customers, Maids, Chefs/Bartenders, and Entertainers.
// Pure ES module (browser + headless Node compatible, zero DOM dependencies).

import { generateCustomerProfile, resolveLiveThought, resolveOpinions, moodLabel } from './npc_traits.js';

function pushBounded(arr, item, maxLen = 6) {
  arr.unshift(item);
  if (arr.length > maxLen) arr.length = maxLen;
}

function stepTowards(actor, tx, ty, speedPxPerSec, dt) {
  const dx = tx - actor.x;
  const dy = ty - actor.y;
  const dist = Math.hypot(dx, dy);
  if (!Number.isFinite(dist) || dist <= 2.0) {
    actor.x = tx;
    actor.y = ty;
    return true;
  }
  const step = speedPxPerSec * dt;
  if (Math.abs(dx) > Math.abs(dy)) {
    actor.dir = dx >= 0 ? 'right' : 'left';
  } else {
    actor.dir = dy >= 0 ? 'down' : 'up';
  }
  if (step >= dist) {
    actor.x = tx;
    actor.y = ty;
    return true;
  }
  actor.x += (dx / dist) * step;
  actor.y += (dy / dist) * step;
  return false;
}

export class CustomerActor {
  constructor(id, seed, archetypeSpec, sim) {
    const profile = generateCustomerProfile(seed, archetypeSpec, sim.data);
    this.id = id;
    this.isStaff = false;
    this.seed = seed;
    this.archetype = archetypeSpec;
    this.archetypeId = archetypeSpec.id;
    this.archetypeName = archetypeSpec.name;
    this.name = profile.name;
    this.folk = profile.folk;
    this.role = profile.role;
    this.className = profile.className;
    this.level = profile.level;
    this.gold = profile.gold;
    this.quirk = profile.quirk;
    this.mood = Math.min(96, profile.baselineMood + Math.min(14, sim.ambience * 0.25));
    this.favoriteDishId = profile.favoriteDishId;
    this.favoriteDishName = profile.favoriteDishName;
    this.spriteIndex = profile.spriteIndex;
    this.spriteKey = `cust_${String(profile.spriteIndex).padStart(2, '0')}`;

    const rngRoll = ((seed >>> 3) % 100) / 100;
    const isAdv = archetypeSpec.id.startsWith('adventurer');
    this.isReturningFromQuest = isAdv && (sim.dayPhase === 'evening' || sim.dayPhase === 'night') && rngRoll < 0.55;
    if (this.isReturningFromQuest) {
      this.gold = Math.round(this.gold * 1.35);
    }

    const wp = sim.layout.waypoints.entranceOutside;
    this.x = wp.x + (((seed % 5) - 2) * 5);
    this.y = wp.y;
    this.dir = 'up';
    this.anim = 'walk';
    this.animTime = (seed % 17) * 0.13;

    this.state = 'ENTERING';
    this.stateTimer = 0;
    this.maxStateTimeout = 14.0;
    this.recoveryCount = 0;

    this.seatRef = null;      // { tableIndex, seatIndex }
    this.bedIndex = null;
    this.orderedRecipe = null;
    this.claimedByMaidId = null;
    this.orderSubmitted = false;
    this.servedByMaidTipBonus = 0;
    this.ateFavorite = false;
    this.supplyBill = 0;
    this.mealBill = 0;
    this.roomFee = 0;
    this.hasPaid = false;
    this.thoughtSalt = 0;

    this.emote = null;
    this.emoteTimer = 0;
    this.recentEvents = [];
    pushBounded(
      this.recentEvents,
      this.isReturningFromQuest ? 'Returned dusty from a quest' : 'Arrived at the tavern'
    );
  }

  setEmote(emoteName, duration = 2.4) {
    this.emote = emoteName;
    this.emoteTimer = duration;
  }

  transition(nextState, maxTimeout) {
    this.state = nextState;
    this.stateTimer = 0;
    this.maxStateTimeout = maxTimeout;
    this.thoughtSalt = (this.thoughtSalt + 1) % 31;
  }

  releaseSeat(sim) {
    if (!this.seatRef) return;
    const tbl = sim.layout.tables[this.seatRef.tableIndex];
    if (tbl && tbl.seats[this.seatRef.seatIndex]) {
      if (tbl.seats[this.seatRef.seatIndex].occupiedBy === this.id) {
        tbl.seats[this.seatRef.seatIndex].occupiedBy = null;
      }
    }
    this.seatRef = null;
  }

  releaseBed(sim) {
    if (this.bedIndex === null) return;
    const bed = sim.layout.beds[this.bedIndex];
    if (bed && bed.occupiedBy === this.id) {
      bed.occupiedBy = null;
    }
    this.bedIndex = null;
  }

  cancelPendingOrders(sim) {
    sim.cancelOrdersForCustomer(this.id);
    this.claimedByMaidId = null;
  }

  cleanupAll(sim) {
    this.releaseSeat(sim);
    this.releaseBed(sim);
    this.cancelPendingOrders(sim);
  }

  chooseRecipe(sim) {
    const unlocked = sim.getUnlockedRecipes();
    const maxTier = this.archetype.maxRecipeTier || 1;
    const prefCats = this.archetype.preferredCategories || ['drink', 'food'];
    // Filter dining items (food & drink) for table service
    let pool = unlocked.filter(
      (r) => (r.category === 'drink' || r.category === 'food') && r.tier <= maxTier
    );
    if (pool.length === 0) {
      pool = unlocked.filter((r) => r.category === 'drink' || r.category === 'food');
    }
    if (pool.length === 0) pool = unlocked;

    // Favorite dish preference if unlocked
    const fav = pool.find((r) => r.id === this.favoriteDishId);
    const roll = Math.abs(sim.nextSeed()) % 100;
    if (fav && roll < 38) return fav;

    // Richer patrons bias toward top unlocked tier
    const sorted = [...pool].sort((a, b) => b.price - a.price);
    const topSlice = sorted.slice(0, Math.max(2, Math.ceil(sorted.length * 0.6)));
    const preferred = topSlice.filter((r) => prefCats.includes(r.category));
    const pickFrom = preferred.length > 0 ? preferred : topSlice;
    return pickFrom[Math.abs(sim.nextSeed()) % pickFrom.length];
  }

  chooseCounterSupply(sim) {
    const unlocked = sim.getUnlockedRecipes().filter(
      (r) => (r.category === 'ration' || r.category === 'potion') && r.tier <= (this.archetype.maxRecipeTier || 2)
    );
    if (unlocked.length === 0) return null;
    return unlocked[Math.abs(sim.nextSeed()) % unlocked.length];
  }

  receiveFood(sim, maid) {
    if (this.state !== 'WAITING_FOR_FOOD') return;
    this.servedByMaidTipBonus = maid ? maid.tipBonus || 0 : 0;
    const recipe = this.orderedRecipe;
    if (recipe) {
      this.mealBill += recipe.price;
      if (recipe.id === this.favoriteDishId) {
        this.ateFavorite = true;
        this.mood = Math.min(100, this.mood + 18);
        this.setEmote('emote_heart', 3.0);
        pushBounded(this.recentEvents, `Delighted by favorite: ${recipe.name}!`);
      } else {
        this.mood = Math.min(100, this.mood + 8 + (sim.tableTier - 1) * 3);
        this.setEmote('emote_sparkle', 2.0);
        pushBounded(this.recentEvents, `Served ${recipe.name}`);
      }
      if (this.seatRef) {
        const tbl = sim.layout.tables[this.seatRef.tableIndex];
        if (tbl) {
          tbl.activeDishProp = recipe.worldProp || recipe.icon;
          tbl.hasHotFood = recipe.category === 'food';
        }
      }
    }
    this.anim = 'eat';
    this.transition('EATING', 16.0);
  }

  update(dt, sim) {
    this.stateTimer += dt;
    this.animTime += dt;
    if (this.emoteTimer > 0) {
      this.emoteTimer -= dt;
      if (this.emoteTimer <= 0) this.emote = null;
    }

    // Coordinate sanity guard (zero NaN guarantee)
    if (!Number.isFinite(this.x) || !Number.isFinite(this.y) || !Number.isFinite(this.mood)) {
      const wp = sim.layout.waypoints.entranceInside;
      this.x = wp.x;
      this.y = wp.y;
      this.mood = 50;
      this.recoveryCount += 1;
    }

    // Timeout recovery contract
    if (this.stateTimer > this.maxStateTimeout) {
      this.recoveryCount += 1;
      if (this.state === 'ENTERING') {
        const wp = sim.layout.waypoints.entranceInside;
        this.x = wp.x;
        this.y = wp.y;
        this.transition('SEEKING_SEAT', 12.0);
        return;
      }
      if (this.state === 'WAITING_TO_ORDER' || this.state === 'WAITING_FOR_FOOD') {
        this.mood = Math.max(10, this.mood - 28);
        this.setEmote('emote_anger', 3.0);
        pushBounded(this.recentEvents, 'Left impatiently after waiting too long');
        sim.onCustomerComplaint(this);
        this.cleanupAll(sim);
        this.transition('LEAVING', 16.0);
        return;
      }
      if (this.state === 'SEEKING_ROOM') {
        // Snap to bed if still owned, otherwise proceed to PAYING
        if (this.bedIndex !== null && sim.layout.beds[this.bedIndex]) {
          const bed = sim.layout.beds[this.bedIndex];
          this.x = bed.x;
          this.y = bed.y;
          this.transition('SLEEPING', 34.0);
        } else {
          this.transition('PAYING', 4.0);
        }
        return;
      }
      if (this.state === 'SLEEPING') {
        this.releaseBed(sim);
        const sb = sim.layout.waypoints.stairsBottom;
        this.x = sb.x;
        this.y = sb.y;
        this.transition('PAYING', 4.0);
        return;
      }
      if (this.state === 'LEAVING') {
        this.cleanupAll(sim);
        this.state = 'DESPAWNED';
        return;
      }
      // Generic safe fallback -> pay if owed, else leave
      this.cleanupAll(sim);
      if ((this.mealBill + this.supplyBill + this.roomFee) > 0 && !this.hasPaid) {
        this.transition('PAYING', 4.0);
      } else {
        this.transition('LEAVING', 16.0);
      }
      return;
    }

    const walkSpeed = 54 + (this.seed % 9);
    const patienceMult = 1 + (sim.isMusicianPerforming ? 0.35 : 0) + Math.min(0.35, sim.ambience * 0.006);

    switch (this.state) {
      case 'ENTERING': {
        this.anim = 'walk';
        const wp = sim.layout.waypoints.entranceInside;
        if (stepTowards(this, wp.x, wp.y, walkSpeed, dt)) {
          sim.emitEvent('door_enter', { actorId: this.id });
          if (this.isReturningFromQuest) {
            sim.banter.trigger('quest_return', sim);
          }
          // Pre-quest adventurer supply / quest board check
          const supplyItem = this.chooseCounterSupply(sim);
          const wantsSupplies =
            !this.isReturningFromQuest &&
            supplyItem !== null &&
            ((Math.abs(this.seed * 7) % 100) / 100) < (this.archetype.wantsQuestSupplies || 0);

          if (wantsSupplies) {
            this.pendingSupplyItem = supplyItem;
            this.transition('AT_QUEST_BOARD', 12.0);
          } else {
            this.transition('SEEKING_SEAT', 12.0);
          }
        }
        break;
      }

      case 'AT_QUEST_BOARD': {
        const qwp = sim.layout.waypoints.questBoardSpot;
        if (Math.hypot(this.x - qwp.x, this.y - qwp.y) > 4) {
          this.anim = 'walk';
          stepTowards(this, qwp.x, qwp.y, walkSpeed, dt);
        } else {
          this.anim = 'idle';
          this.dir = 'up';
          if (this.stateTimer > 2.2) {
            this.setEmote('emote_exclaim', 2.0);
            pushBounded(this.recentEvents, 'Picked a bounty notice off the quest board');
            this.transition('AT_COUNTER', 14.0);
          }
        }
        break;
      }

      case 'AT_COUNTER': {
        const cwp = sim.layout.waypoints.counterCustomerSpot;
        if (Math.hypot(this.x - cwp.x, this.y - cwp.y) > 4) {
          this.anim = 'walk';
          stepTowards(this, cwp.x, cwp.y, walkSpeed, dt);
        } else {
          this.anim = 'idle';
          this.dir = 'up';
          if (this.stateTimer > 2.0) {
            const item = this.pendingSupplyItem || this.chooseCounterSupply(sim);
            if (item) {
              this.supplyBill += item.price;
              this.mood = Math.min(100, this.mood + 6);
              this.setEmote('emote_sparkle', 2.0);
              pushBounded(this.recentEvents, `Bought ${item.name} for expedition`);
            }
            // Half of pre-quest adventurers grab a quick meal too, half head straight out after paying
            if ((this.seed % 2) === 0 && sim.hasFreeSeat()) {
              this.transition('SEEKING_SEAT', 12.0);
            } else {
              this.transition('PAYING', 4.0);
            }
          }
        }
        break;
      }

      case 'SEEKING_SEAT': {
        if (!this.seatRef) {
          const found = sim.claimFreeSeat(this.id);
          if (found) {
            this.seatRef = found;
          } else {
            // Wait briefly inside entrance for a seat to open up
            this.anim = 'idle';
            if (this.stateTimer > 5.5) {
              this.mood = Math.max(20, this.mood - 15);
              this.setEmote('emote_question', 2.2);
              pushBounded(this.recentEvents, 'No open tables available');
              sim.banter.trigger('rush', sim);
              if (this.supplyBill > 0) {
                this.transition('PAYING', 4.0);
              } else {
                this.transition('LEAVING', 16.0);
              }
            }
            break;
          }
        }
        const tbl = sim.layout.tables[this.seatRef.tableIndex];
        const seat = tbl?.seats[this.seatRef.seatIndex];
        if (!seat) {
          this.seatRef = null;
          break;
        }
        this.anim = 'walk';
        if (stepTowards(this, seat.x, seat.y, walkSpeed, dt)) {
          this.dir = seat.dir;
          this.anim = 'sit';
          this.orderedRecipe = this.chooseRecipe(sim);
          this.setEmote('emote_question', 1.8);
          this.transition('WAITING_TO_ORDER', (this.archetype.patienceSec || 40) * patienceMult);
        }
        break;
      }

      case 'WAITING_TO_ORDER': {
        this.anim = 'sit';
        const decay = (this.quirk === 'impatient' ? 0.65 : 0.42) * (sim.isMusicianPerforming ? 0.35 : 1.0);
        this.mood = Math.max(12, this.mood - decay * dt);
        if (sim.isMusicianPerforming && (Math.floor(this.stateTimer * 10) % 75 === 0)) {
          this.setEmote('emote_music', 1.8);
        }
        break;
      }

      case 'WAITING_FOR_FOOD': {
        this.anim = 'sit';
        if (sim.isMusicianPerforming || sim.isDancerPerforming) {
          this.mood = Math.min(100, this.mood + 0.35 * dt);
          if (!this.emote && ((Math.floor(this.animTime * 10) + this.seed) % 90 === 0)) {
            this.setEmote('emote_music', 2.0);
          }
        } else {
          const decay = this.quirk === 'impatient' ? 0.50 : 0.30;
          this.mood = Math.max(12, this.mood - decay * dt);
        }
        break;
      }

      case 'EATING': {
        this.anim = 'eat';
        const eatDuration = 8.5 + (this.seed % 4);
        if (sim.isDancerPerforming) {
          this.mood = Math.min(100, this.mood + 0.6 * dt);
        }
        if (this.stateTimer >= eatDuration) {
          if (this.seatRef) {
            const tbl = sim.layout.tables[this.seatRef.tableIndex];
            if (tbl) {
              tbl.activeDishProp = null;
              tbl.hasHotFood = false;
              if ((Math.abs(sim.nextSeed()) % 100) < 48) {
                tbl.dirty = true;
              }
            }
          }
          this.releaseSeat(sim);

          // Check overnight room rental!
          const wantsRoomNow =
            sim.layout.beds.length > 0 &&
            (sim.dayPhase === 'evening' || sim.dayPhase === 'night' || this.isReturningFromQuest) &&
            ((Math.abs(this.seed * 13 + 5) % 100) / 100) < (this.archetype.wantsRoomNight || 0);

          if (wantsRoomNow) {
            const bedIdx = sim.claimFreeBed(this.id);
            if (bedIdx !== null) {
              this.bedIndex = bedIdx;
              pushBounded(this.recentEvents, 'Rented an upstairs room for the night');
              this.transition('SEEKING_ROOM', 16.0);
              break;
            }
          }
          this.transition('PAYING', 4.0);
        }
        break;
      }

      case 'SEEKING_ROOM': {
        const bed = this.bedIndex !== null ? sim.layout.beds[this.bedIndex] : null;
        if (!bed) {
          this.transition('PAYING', 4.0);
          break;
        }
        this.anim = 'walk';
        const sb = sim.layout.waypoints.stairsBottom;
        const st = sim.layout.waypoints.stairsTop;
        // Two-stage stair climb: if still downstairs (y > st.y + 24), walk to stairsBottom then hop up to stairsTop
        if (this.y > st.y + 36) {
          if (stepTowards(this, sb.x, sb.y, walkSpeed, dt)) {
            this.x = st.x;
            this.y = st.y;
          }
        } else if (stepTowards(this, bed.x, bed.y, walkSpeed, dt)) {
          this.dir = 'down';
          this.anim = 'sit';
          this.setEmote('emote_zzz', 3.5);
          this.transition('SLEEPING', 34.0);
        }
        break;
      }

      case 'SLEEPING': {
        this.anim = 'sit';
        if (!this.emote) this.setEmote('emote_zzz', 2.8);
        this.mood = Math.min(100, this.mood + 0.7 * dt);
        const sleepDur = 20.0 + (this.seed % 7);
        if (this.stateTimer >= sleepDur) {
          const baseRoomRate = sim.state.bedTier >= 2 ? 48 : 24;
          const tierMult = 1 + 0.25 * ((this.archetype.maxRecipeTier || 1) - 1);
          this.roomFee += Math.round(baseRoomRate * tierMult);
          this.releaseBed(sim);
          // Step back down stairs to common room
          const sb = sim.layout.waypoints.stairsBottom;
          this.x = sb.x;
          this.y = sb.y;
          pushBounded(this.recentEvents, 'Woke up refreshed from lodging suite');
          this.transition('PAYING', 4.0);
        }
        break;
      }

      case 'PAYING': {
        this.anim = 'idle';
        if (!this.hasPaid) {
          this.hasPaid = true;
          sim.settleCustomerPayment(this);
        }
        if (this.stateTimer >= 0.8) {
          this.transition('LEAVING', 18.0);
        }
        break;
      }

      case 'LEAVING': {
        this.anim = 'walk';
        const inside = sim.layout.waypoints.entranceInside;
        const outside = sim.layout.waypoints.entranceOutside;
        if (this.y < inside.y - 6) {
          stepTowards(this, inside.x, inside.y, walkSpeed, dt);
        } else if (stepTowards(this, outside.x, outside.y, walkSpeed, dt)) {
          this.cleanupAll(sim);
          this.state = 'DESPAWNED';
        }
        break;
      }

      default:
        this.state = 'DESPAWNED';
    }
  }

  getInspectorSnapshot(sim) {
    return {
      id: this.id,
      isStaff: false,
      name: this.name,
      role: `${this.className} (${this.archetypeName})`,
      folk: this.folk,
      level: this.level,
      gold: this.gold,
      mood: Math.round(this.mood),
      moodLabel: moodLabel(this.mood),
      quirk: this.quirk,
      favoriteDish: this.favoriteDishName,
      activity: this.describeActivity(),
      liveThought: resolveLiveThought(this, sim, sim.data.thoughts),
      opinions: resolveOpinions(this, sim, sim.data.thoughts),
      recentEvents: [...this.recentEvents],
      spriteKey: this.spriteKey,
    };
  }

  describeActivity() {
    switch (this.state) {
      case 'ENTERING': return 'Stepping into the tavern';
      case 'AT_QUEST_BOARD': return 'Inspecting guild quest postings';
      case 'AT_COUNTER': return 'Buying expedition rations & potions';
      case 'SEEKING_SEAT': return 'Looking for a free table';
      case 'WAITING_TO_ORDER': return `Ready to order ${this.orderedRecipe?.name || 'a meal'}`;
      case 'WAITING_FOR_FOOD': return `Waiting for ${this.orderedRecipe?.name || 'order'}`;
      case 'EATING': return `Enjoying ${this.orderedRecipe?.name || 'tavern fare'}`;
      case 'SEEKING_ROOM': return 'Heading upstairs to guest room';
      case 'SLEEPING': return 'Sleeping soundly upstairs';
      case 'PAYING': return 'Settling the tab & tipping';
      case 'LEAVING': return 'Heading back out into town';
      default: return 'Visiting';
    }
  }
}

export class StaffActor {
  constructor(spec, index, sim) {
    this.id = spec.id;
    this.isStaff = true;
    this.isCanon = spec.id === 'nyah' || spec.id === 'fifi';
    this.name = spec.name;
    this.role = spec.role; // 'maid' | 'chef' | 'bartender' | 'musician' | 'dancer'
    this.personality = spec.personality;
    this.baseMoveSpeed = spec.moveSpeed || 70;
    this.baseWorkSpeed = spec.workSpeed || 1.0;
    this.tipBonus = spec.tipBonus || 0;
    this.seed = spec.seed || (1000 + index);
    this.bio = spec.bio || '';
    this.level = 1 + Math.floor(index / 2);
    this.gold = 40 + (this.seed % 90);
    this.mood = 84;
    this.quirk = spec.personality;
    this.favoriteDishId = 'honey_mead';
    this.favoriteDishName = spec.id === 'nyah' ? 'Herb-Roasted Farm Chicken' : spec.id === 'fifi' ? 'Meadow Herb Tea' : 'Hearty Root Stew';
    this.spriteKey = spec.id;

    const startPos = this.computeHomeSpot(sim, index);
    this.x = startPos.x;
    this.y = startPos.y;
    this.dir = 'down';
    this.anim = 'idle';
    this.animTime = index * 0.37;

    this.state = this.role === 'musician' || this.role === 'dancer' ? 'IDLE_REST' : 'IDLE';
    this.stateTimer = 0;
    this.maxStateTimeout = 20.0;
    this.recoveryCount = 0;
    this.idleRoamTimer = 2.0 + (index % 4);
    this.roamTarget = null;

    // Task bindings
    this.targetCustomerId = null;
    this.currentOrder = null;
    this.targetTableIndex = null;
    this.carryingProp = null;

    this.emote = null;
    this.emoteTimer = 0;
    this.thoughtSalt = index;
    this.recentEvents = ['Reported for shift at the tavern'];
  }

  computeHomeSpot(sim, idx = 0) {
    const wp = sim.layout.waypoints;
    if (this.role === 'chef') {
      return this.id === 'barnaby' ? { ...wp.kitchenCookSpot } : { ...wp.kitchenSousSpot };
    }
    if (this.role === 'bartender') {
      return { ...wp.barBehind };
    }
    if ((this.role === 'musician' || this.role === 'dancer') && wp.stageSpot) {
      return this.role === 'musician'
        ? { x: wp.stageSpot.musicianX, y: wp.stageSpot.musicianY + 28 }
        : { x: wp.stageSpot.dancerX, y: wp.stageSpot.dancerY + 28 };
    }
    const spots = wp.maidIdleSpots;
    return { ...spots[idx % spots.length] };
  }

  setEmote(emoteName, duration = 2.2) {
    this.emote = emoteName;
    this.emoteTimer = duration;
  }

  transition(nextState, maxTimeout) {
    this.state = nextState;
    this.stateTimer = 0;
    this.maxStateTimeout = maxTimeout;
    this.thoughtSalt = (this.thoughtSalt + 1) % 29;
  }

  resetTaskClaims(sim) {
    if (this.targetCustomerId) {
      const cust = sim.getCustomerById(this.targetCustomerId);
      if (cust && cust.claimedByMaidId === this.id) {
        cust.claimedByMaidId = null;
      }
      this.targetCustomerId = null;
    }
    if (this.currentOrder) {
      this.currentOrder.claimedByMaidId = null;
      this.currentOrder.cookingByStaffId = null;
      // Return unfinished order safely if patron is still waiting
      const cust = sim.getCustomerById(this.currentOrder.customerId);
      if (cust && cust.state === 'WAITING_FOR_FOOD') {
        if (this.currentOrder.ready) {
          if (!sim.readyOrders.includes(this.currentOrder)) sim.readyOrders.push(this.currentOrder);
        } else if (!sim.pendingOrders.includes(this.currentOrder)) {
          sim.pendingOrders.push(this.currentOrder);
        }
      }
      this.currentOrder = null;
    }
    if (this.targetTableIndex !== null) {
      const tbl = sim.layout.tables[this.targetTableIndex];
      if (tbl && tbl.claimedCleanBy === this.id) {
        tbl.claimedCleanBy = null;
      }
      this.targetTableIndex = null;
    }
    this.carryingProp = null;
  }

  update(dt, sim) {
    this.stateTimer += dt;
    this.animTime += dt;
    if (this.emoteTimer > 0) {
      this.emoteTimer -= dt;
      if (this.emoteTimer <= 0) this.emote = null;
    }

    if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) {
      const home = this.computeHomeSpot(sim, 0);
      this.x = home.x;
      this.y = home.y;
      this.recoveryCount += 1;
    }

    if (this.stateTimer > this.maxStateTimeout) {
      this.recoveryCount += 1;
      this.resetTaskClaims(sim);
      const fallback = this.role === 'musician' || this.role === 'dancer' ? 'IDLE_REST' : 'IDLE';
      this.transition(fallback, 20.0);
      return;
    }

    if (this.role === 'maid') {
      this.updateMaid(dt, sim);
    } else if (this.role === 'chef' || this.role === 'bartender') {
      this.updateChefOrBartender(dt, sim);
    } else {
      this.updateEntertainer(dt, sim);
    }
  }

  updateMaid(dt, sim) {
    const moveSpeed = this.baseMoveSpeed * sim.maidSpeedMult;
    const workSpeed = this.baseWorkSpeed * sim.maidSpeedMult;

    switch (this.state) {
      case 'IDLE': {
        this.carryingProp = null;
        // Priority 1: Pick up ready cooked order
        const readyOrd = sim.claimReadyOrder(this.id);
        if (readyOrd) {
          this.currentOrder = readyOrd;
          this.transition('WALK_TO_PICKUP', 14.0);
          return;
        }
        // Priority 2: Take waiting customer's order
        const waitingCust = sim.claimWaitingPatronForOrder(this.id);
        if (waitingCust) {
          this.targetCustomerId = waitingCust.id;
          this.transition('WALK_TO_PATRON', 14.0);
          return;
        }
        // Priority 3: Wipe dirty table
        const dirtyTblIdx = sim.claimDirtyTable(this.id);
        if (dirtyTblIdx !== null) {
          this.targetTableIndex = dirtyTblIdx;
          this.transition('WALK_TO_CLEAN', 14.0);
          return;
        }

        // Gentle idle roam around common room
        this.idleRoamTimer -= dt;
        if (this.roamTarget) {
          this.anim = 'walk';
          if (stepTowards(this, this.roamTarget.x, this.roamTarget.y, moveSpeed * 0.55, dt)) {
            this.roamTarget = null;
            this.anim = 'idle';
            this.dir = 'down';
          }
        } else {
          this.anim = 'idle';
          if (this.idleRoamTimer <= 0) {
            const spots = sim.layout.waypoints.maidIdleSpots;
            this.roamTarget = spots[Math.abs(sim.nextSeed()) % spots.length];
            this.idleRoamTimer = 4.5 + (Math.abs(sim.nextSeed()) % 5);
          }
        }
        // Reset stateTimer during pure IDLE so IDLE never triggers timeout recovery
        this.stateTimer = 0;
        break;
      }

      case 'WALK_TO_PATRON': {
        const cust = sim.getCustomerById(this.targetCustomerId);
        if (!cust || cust.state !== 'WAITING_TO_ORDER' || !cust.seatRef) {
          this.resetTaskClaims(sim);
          this.transition('IDLE', 20.0);
          return;
        }
        const tbl = sim.layout.tables[cust.seatRef.tableIndex];
        if (!tbl) {
          this.resetTaskClaims(sim);
          this.transition('IDLE', 20.0);
          return;
        }
        this.anim = 'walk';
        if (stepTowards(this, tbl.serviceX, tbl.serviceY, moveSpeed, dt)) {
          this.dir = 'up';
          this.anim = 'idle';
          this.transition('TAKING_ORDER', 4.0);
        }
        break;
      }

      case 'TAKING_ORDER': {
        const cust = sim.getCustomerById(this.targetCustomerId);
        if (!cust || cust.state !== 'WAITING_TO_ORDER') {
          this.resetTaskClaims(sim);
          this.transition('IDLE', 20.0);
          return;
        }
        this.anim = 'idle';
        if (this.stateTimer >= Math.max(0.35, 0.9 / workSpeed)) {
          const recipe = cust.orderedRecipe || cust.chooseRecipe(sim);
          cust.orderedRecipe = recipe;
          cust.claimedByMaidId = null;
          cust.transition('WAITING_FOR_FOOD', 55.0);
          sim.enqueueKitchenOrder({
            id: `ord_${sim.nextOrderId++}`,
            customerId: cust.id,
            recipe,
            station: recipe.station === 'bar' ? 'bar' : 'kitchen',
            ready: false,
            cookingByStaffId: null,
            claimedByMaidId: null,
          });
          pushBounded(this.recentEvents, `Took ${cust.name}'s order (${recipe.name})`);
          this.targetCustomerId = null;
          this.transition('IDLE', 20.0);
        }
        break;
      }

      case 'WALK_TO_PICKUP': {
        const ord = this.currentOrder;
        if (!ord) {
          this.transition('IDLE', 20.0);
          return;
        }
        const cust = sim.getCustomerById(ord.customerId);
        if (!cust || cust.state !== 'WAITING_FOR_FOOD') {
          this.currentOrder = null;
          this.transition('IDLE', 20.0);
          return;
        }
        const pickupSpot =
          ord.station === 'bar' ? sim.layout.waypoints.barPickup : sim.layout.waypoints.kitchenPickup;
        this.anim = 'walk';
        if (stepTowards(this, pickupSpot.x, pickupSpot.y, moveSpeed, dt)) {
          this.carryingProp = ord.recipe.worldProp || ord.recipe.icon;
          this.transition('CARRYING_TO_PATRON', 14.0);
        }
        break;
      }

      case 'CARRYING_TO_PATRON': {
        const ord = this.currentOrder;
        const cust = ord ? sim.getCustomerById(ord.customerId) : null;
        if (!ord || !cust || cust.state !== 'WAITING_FOR_FOOD' || !cust.seatRef) {
          this.carryingProp = null;
          this.currentOrder = null;
          this.transition('IDLE', 20.0);
          return;
        }
        const tbl = sim.layout.tables[cust.seatRef.tableIndex];
        if (!tbl) {
          this.carryingProp = null;
          this.currentOrder = null;
          this.transition('IDLE', 20.0);
          return;
        }
        this.anim = 'carry';
        if (stepTowards(this, tbl.serviceX, tbl.serviceY, moveSpeed, dt)) {
          this.dir = 'up';
          this.transition('SERVING', 4.0);
        }
        break;
      }

      case 'SERVING': {
        const ord = this.currentOrder;
        const cust = ord ? sim.getCustomerById(ord.customerId) : null;
        this.anim = 'carry';
        if (this.stateTimer >= Math.max(0.25, 0.55 / workSpeed)) {
          if (cust && cust.state === 'WAITING_FOR_FOOD') {
            cust.receiveFood(sim, this);
            sim.emitEvent('serve_order', { maidId: this.id, recipeId: ord.recipe.id });
            pushBounded(this.recentEvents, `Served ${ord.recipe.name} to ${cust.name}`);
          }
          this.carryingProp = null;
          this.currentOrder = null;
          this.transition('IDLE', 20.0);
        }
        break;
      }

      case 'WALK_TO_CLEAN': {
        const tbl = this.targetTableIndex !== null ? sim.layout.tables[this.targetTableIndex] : null;
        if (!tbl || !tbl.dirty) {
          this.resetTaskClaims(sim);
          this.transition('IDLE', 20.0);
          return;
        }
        this.anim = 'walk';
        if (stepTowards(this, tbl.serviceX, tbl.serviceY, moveSpeed, dt)) {
          this.dir = 'up';
          this.anim = 'idle';
          this.transition('CLEANING_TABLE', 4.0);
        }
        break;
      }

      case 'CLEANING_TABLE': {
        const tbl = this.targetTableIndex !== null ? sim.layout.tables[this.targetTableIndex] : null;
        this.anim = 'idle';
        if (this.stateTimer >= Math.max(0.4, 1.0 / workSpeed)) {
          if (tbl) {
            tbl.dirty = false;
            tbl.claimedCleanBy = null;
          }
          pushBounded(this.recentEvents, 'Wiped down a dining table');
          this.targetTableIndex = null;
          this.transition('IDLE', 20.0);
        }
        break;
      }

      default:
        this.transition('IDLE', 20.0);
    }
  }

  updateChefOrBartender(dt, sim) {
    const home = this.computeHomeSpot(sim, 0);
    const moveSpeed = this.baseMoveSpeed;
    const workSpeed = this.baseWorkSpeed * sim.chefSpeedMult;

    switch (this.state) {
      case 'IDLE': {
        if (Math.hypot(this.x - home.x, this.y - home.y) > 4) {
          this.anim = 'walk';
          stepTowards(this, home.x, home.y, moveSpeed, dt);
        } else {
          this.anim = 'idle';
          this.dir = 'down';
        }
        const ord = sim.claimPendingOrderForCook(this);
        if (ord) {
          this.currentOrder = ord;
          if (ord.station === 'kitchen') {
            sim.emitEvent('cook_start', { staffId: this.id });
          }
          const cookDur = Math.max(0.35, (ord.recipe.cookTime || 1.5) / workSpeed);
          this.prepTargetDuration = cookDur;
          this.transition('PREP_ORDER', Math.max(8.0, cookDur + 5.0));
          return;
        }
        this.stateTimer = 0;
        break;
      }

      case 'PREP_ORDER': {
        const ord = this.currentOrder;
        if (!ord) {
          this.transition('IDLE', 20.0);
          return;
        }
        // Move to station spot if needed (e.g. Barnaby stepping between stove and taps when Garrett isn't hired)
        const targetSpot =
          ord.station === 'bar' ? sim.layout.waypoints.barBehind : home;
        if (Math.hypot(this.x - targetSpot.x, this.y - targetSpot.y) > 6) {
          this.anim = 'walk';
          stepTowards(this, targetSpot.x, targetSpot.y, moveSpeed * 1.15, dt);
          return;
        }
        this.anim = 'cook';
        this.dir = 'down';
        if (this.stateTimer >= (this.prepTargetDuration || 1.5)) {
          const cust = sim.getCustomerById(ord.customerId);
          ord.cookingByStaffId = null;
          if (cust && cust.state === 'WAITING_FOR_FOOD') {
            ord.ready = true;
            sim.readyOrders.push(ord);
            pushBounded(this.recentEvents, `Prepared ${ord.recipe.name}`);
          }
          this.currentOrder = null;
          this.transition('IDLE', 20.0);
        }
        break;
      }

      default:
        this.transition('IDLE', 20.0);
    }
  }

  updateEntertainer(dt, sim) {
    const stageSpot = sim.layout.waypoints.stageSpot;
    const targetX = stageSpot
      ? (this.role === 'musician' ? stageSpot.musicianX : stageSpot.dancerX)
      : sim.layout.waypoints.maidIdleSpots[0].x;
    const targetY = stageSpot
      ? (this.role === 'musician' ? stageSpot.musicianY : stageSpot.dancerY)
      : sim.layout.waypoints.maidIdleSpots[0].y;

    switch (this.state) {
      case 'IDLE_REST': {
        this.anim = 'idle';
        if (this.stateTimer >= 5.5 && stageSpot) {
          this.transition('WALK_TO_STAGE', 14.0);
        } else if (!stageSpot) {
          this.stateTimer = 0;
        }
        break;
      }

      case 'WALK_TO_STAGE': {
        this.anim = 'walk';
        if (stepTowards(this, targetX, targetY, this.baseMoveSpeed, dt)) {
          this.dir = 'down';
          this.setEmote(this.role === 'musician' ? 'emote_music' : 'emote_sparkle', 3.0);
          pushBounded(
            this.recentEvents,
            this.role === 'musician' ? 'Began a cozy harp ballad on stage' : 'Started a silk-ribbon dance set'
          );
          this.transition('PERFORMING', 32.0);
        }
        break;
      }

      case 'PERFORMING': {
        this.anim = this.role === 'musician' ? 'play' : 'dance';
        this.dir = 'down';
        if (!this.emote && Math.floor(this.stateTimer * 10) % 60 === 0) {
          this.setEmote(this.role === 'musician' ? 'emote_music' : 'emote_sparkle', 2.2);
        }
        if (this.stateTimer >= 26.0) {
          this.transition('IDLE_REST', 12.0);
        }
        break;
      }

      default:
        this.transition('IDLE_REST', 12.0);
    }
  }

  getInspectorSnapshot(sim) {
    const rolePretty =
      this.id === 'nyah'
        ? 'Head Maid & Co-Owner'
        : this.id === 'fifi'
          ? 'Loyal Maid'
          : this.role.charAt(0).toUpperCase() + this.role.slice(1);
    return {
      id: this.id,
      isStaff: true,
      isCanon: this.isCanon,
      name: this.name,
      role: rolePretty,
      folk: this.id === 'nyah' ? 'Catgirl' : this.id === 'fifi' ? 'Doggirl' : 'Tavern Staff',
      level: this.level + Math.floor((sim.state.upgradeLevels.train_maids || 0) / 3),
      gold: this.gold,
      mood: Math.round(this.mood),
      moodLabel: moodLabel(this.mood),
      quirk: this.personality,
      favoriteDish: this.favoriteDishName,
      activity: this.describeActivity(),
      bio: this.bio,
      liveThought: resolveLiveThought(this, sim, sim.data.thoughts),
      opinions: resolveOpinions(this, sim, sim.data.thoughts),
      recentEvents: [...this.recentEvents],
      spriteKey: this.spriteKey,
    };
  }

  describeActivity() {
    switch (this.state) {
      case 'IDLE': return 'Watching the floor for guests';
      case 'WALK_TO_PATRON': return 'Heading over to take an order';
      case 'TAKING_ORDER': return 'Jotting down a table order';
      case 'WALK_TO_PICKUP': return 'Walking to pick up hot plates';
      case 'CARRYING_TO_PATRON': return 'Carrying a loaded tray to table';
      case 'SERVING': return 'Serving drinks & dishes';
      case 'WALK_TO_CLEAN': return 'Walking over to wipe a table';
      case 'CLEANING_TABLE': return 'Scrubbing spilled ale off wood';
      case 'PREP_ORDER': return `Preparing ${this.currentOrder?.recipe?.name || 'an order'}`;
      case 'IDLE_REST': return 'Catching breath between stage sets';
      case 'WALK_TO_STAGE': return 'Stepping onto the performance stage';
      case 'PERFORMING': return this.role === 'musician' ? 'Playing harp melodies on stage' : 'Performing ribbon dance on stage';
      default: return 'On shift';
    }
  }
}
