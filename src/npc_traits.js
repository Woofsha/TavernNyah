// Deterministic seeded RNG, NPC trait synthesis, live thoughts, and dynamic opinions.
// Pure ES module (browser + Node headless compatible, zero DOM dependencies).

export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickSeeded(rng, arr) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

const FOLK_LIST = ['human', 'dwarf', 'elf', 'halfling', 'beastfolk'];

// Exact archetype & folk index order used by tools/gen_npcs.py for cust_00..cust_29
const SHEET_ARCHETYPES = [
  'villager',
  'adventurer_rookie',
  'adventurer_veteran',
  'merchant',
  'noble',
];
const SHEET_FOLK_TYPES = ['human', 'elf', 'beastfolk', 'dwarf', 'halfling'];

const CLASS_BY_ARCHETYPE = {
  villager: ['Miller', 'Herbalist', 'Blacksmith', 'Cooper', 'Weaver', 'Farrier', 'Beekeeper', 'Woodcutter'],
  adventurer_rookie: ['Squire', 'Scout', 'Hedge Apprentice', 'Fletcher', 'Torchbearer', 'Dungeon Delver'],
  adventurer_veteran: ['Knight Errant', 'Battle Cleric', 'Spellsword', 'Ranger Captain', 'Wyvern Slayer', 'Arcanist'],
  merchant: ['Spice Factor', 'Silk Trader', 'Gem Appraiser', 'Guild Quartermaster', 'Wine Broker', 'Cartographer'],
  noble: ['Viscount', 'Baroness', 'Court Envoy', 'High Chamberlain', 'Royal Patron', 'Margrave'],
};

const TRAIT_QUIRKS = [
  'generous',
  'impatient',
  'foodie',
  'frugal',
  'boisterous',
  'polite',
  'picky',
  'music_lover',
];

export function generateCustomerProfile(seed, archetypeSpec, data) {
  const rng = mulberry32(seed);

  // Pick one of the 6 pre-generated sheets dedicated to this exact archetype
  const archIndex = Math.max(0, SHEET_ARCHETYPES.indexOf(archetypeSpec.id));
  const variantIndex = Math.floor(rng() * 6) % 6;
  const spriteIndex = variantIndex * 5 + archIndex; // 0..29, matches cust_00..cust_29
  const folk = SHEET_FOLK_TYPES[(spriteIndex + Math.floor(spriteIndex / 5)) % 5] || pickSeeded(rng, FOLK_LIST);

  const folkNames = data.thoughts.namesByFolk[folk] || data.thoughts.namesByFolk.human;
  const first = pickSeeded(rng, folkNames.first);
  const last = pickSeeded(rng, folkNames.last);

  const [minLv, maxLv] = archetypeSpec.levelRange;
  const level = minLv + Math.floor(rng() * (maxLv - minLv + 1));

  const [minG, maxG] = archetypeSpec.goldRange;
  const gold = minG + Math.floor(rng() * (maxG - minG + 1));

  const classes = CLASS_BY_ARCHETYPE[archetypeSpec.id] || ['Traveler'];
  const className = pickSeeded(rng, classes).trim();

  const quirk = pickSeeded(rng, TRAIT_QUIRKS);
  const baselineMood = 62 + Math.floor(rng() * 22); // 62..83

  const unlockedOrTierRecipes = data.recipes.recipes.filter(
    (r) => r.tier <= Math.max(2, archetypeSpec.maxRecipeTier)
  );
  const favPool = unlockedOrTierRecipes.length ? unlockedOrTierRecipes : data.recipes.recipes;
  const favRecipe = pickSeeded(rng, favPool);

  return {
    seed,
    name: `${first} ${last}`,
    folk,
    archetypeId: archetypeSpec.id,
    archetypeName: archetypeSpec.name,
    role: className,
    className,
    level,
    gold,
    quirk,
    baselineMood,
    favoriteDishId: favRecipe.id,
    favoriteDishName: favRecipe.name,
    spriteIndex,
  };
}

export function formatTemplate(tpl, ctx) {
  if (!tpl) return '';
  return tpl
    .replace(/\{dish\}/g, ctx.dish || 'House Ale')
    .replace(/\{tavern\}/g, ctx.tavern || "Nyah & Fifi's Tavern")
    .replace(/\{gold\}/g, String(ctx.gold ?? 10))
    .replace(/\{name\}/g, ctx.name || 'Traveler');
}

export function resolveLiveThought(actor, sim, thoughtsData) {
  const lt = thoughtsData.liveThoughts || {};
  let situation = 'entering';

  if (actor.isStaff) {
    if (actor.role === 'maid') situation = 'maid_working';
    else if (actor.role === 'chef' || actor.role === 'bartender') situation = 'chef_working';
    else situation = 'entertainer_working';
  } else {
    switch (actor.state) {
      case 'ENTERING':
      case 'SEEKING_SEAT':
        situation = actor.isReturningFromQuest ? 'returned_from_quest' : 'entering';
        break;
      case 'AT_QUEST_BOARD':
        situation = 'heading_on_quest';
        break;
      case 'AT_COUNTER':
        situation = 'buying_supplies';
        break;
      case 'WAITING_TO_ORDER':
        situation = sim.isMusicianPerforming && actor.mood >= 70
          ? 'enjoying_entertainment'
          : 'waiting_to_order';
        break;
      case 'WAITING_FOR_FOOD':
        situation = sim.isMusicianPerforming && actor.mood >= 72
          ? 'enjoying_entertainment'
          : 'waiting_for_food';
        break;
      case 'EATING':
        situation = actor.mood >= 58 ? 'eating_happy' : 'eating_unimpressed';
        break;
      case 'SEEKING_ROOM':
        situation = 'renting_room';
        break;
      case 'SLEEPING':
        situation = 'sleeping';
        break;
      case 'PAYING':
      case 'LEAVING':
        situation = actor.mood >= 50 ? 'leaving_happy' : 'leaving_upset';
        break;
      default:
        situation = 'entering';
    }
  }

  const variants = lt[situation] || lt.entering || ['Cozy place.'];
  const idx = Math.abs((actor.seed || 1) + (actor.thoughtSalt || 0)) % variants.length;
  const dishName = actor.orderedRecipe?.name || actor.favoriteDishName || 'House Ale';
  return formatTemplate(variants[idx], {
    dish: dishName,
    tavern: "Nyah & Fifi's Tavern",
    gold: actor.gold,
    name: actor.name,
  });
}

export function resolveOpinions(actor, sim, thoughtsData) {
  const ops = thoughtsData.opinions || {};
  const seed = actor.seed || 7;

  const tierForScore = (score) => {
    if (score < 45) return 'low';
    if (score < 76) return 'mid';
    return 'high';
  };

  const ambienceScore = Math.min(100, 45 + sim.ambience * 1.4 + (actor.mood - 60) * 0.4);
  const foodScore = Math.min(
    100,
    50 + (actor.ateFavorite ? 30 : 0) + (actor.mood - 55) * 0.7 + sim.chefBonus * 25
  );
  const priceBias = actor.quirk === 'frugal' ? -18 : actor.quirk === 'generous' ? 18 : 0;
  const priceScore = Math.max(10, Math.min(100, 65 + priceBias + (actor.mood - 60) * 0.5));
  const nyahScore = Math.max(15, Math.min(100, 52 + (actor.mood - 55) * 0.8 + (seed % 17) - 6));
  const fifiScore = Math.max(30, Math.min(100, 72 + (actor.mood - 55) * 0.5 + (seed % 13) - 4));

  const pickTiered = (topic, score, salt) => {
    const bucket = ops[topic];
    if (!bucket) return 'No strong opinion yet.';
    const tier = tierForScore(score);
    const arr = bucket[tier] || bucket.mid || [];
    if (!arr.length) return 'Seems alright.';
    const tpl = arr[Math.abs(seed + salt * 13) % arr.length];
    return formatTemplate(tpl, {
      dish: actor.favoriteDishName || 'House Ale',
      tavern: "Nyah & Fifi's Tavern",
      gold: actor.gold,
    });
  };

  return {
    tavern: pickTiered('tavern', ambienceScore, 1),
    food: pickTiered('food', foodScore, 2),
    prices: pickTiered('prices', priceScore, 3),
    nyah: pickTiered('nyah', nyahScore, 4),
    fifi: pickTiered('fifi', fifiScore, 5),
  };
}

export function moodLabel(mood) {
  if (mood >= 85) return 'Delighted';
  if (mood >= 68) return 'Content';
  if (mood >= 50) return 'Neutral';
  if (mood >= 32) return 'Impatient';
  return 'Fuming';
}
