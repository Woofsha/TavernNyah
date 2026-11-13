// Multi-tier tavern architectural layout, room expansions, table slots, guest beds, and decor placements.
// Coordinates are in world pixels on a 32x32 base tile grid (`TILE = 32`).

export const TILE = 32;

export const TABLE_TIER_SEAT_CONFIGS = {
  1: [
    { dx: 0, dy: -26, facing: 'S', chairType: 'chair' },
    { dx: 0, dy: 16, facing: 'N', chairType: 'chair' },
    { dx: -34, dy: -6, facing: 'E', chairType: 'chair' },
    { dx: 34, dy: -6, facing: 'W', chairType: 'chair' },
  ],
  2: [
    { dx: 0, dy: -26, facing: 'S', chairType: 'chair' },
    { dx: 0, dy: 16, facing: 'N', chairType: 'chair' },
    { dx: -34, dy: -6, facing: 'E', chairType: 'chair' },
    { dx: 34, dy: -6, facing: 'W', chairType: 'chair' },
  ],
  3: [
    { dx: 0, dy: -26, facing: 'S', chairType: 'chair' },
    { dx: 0, dy: 16, facing: 'N', chairType: 'chair' },
    { dx: -34, dy: -6, facing: 'E', chairType: 'chair' },
    { dx: 34, dy: -6, facing: 'W', chairType: 'chair' },
  ],
  4: [
    { dx: 0, dy: -26, facing: 'S', chairType: 'chair' },
    { dx: 0, dy: 16, facing: 'N', chairType: 'chair' },
    { dx: -34, dy: -6, facing: 'E', chairType: 'chair' },
    { dx: 34, dy: -6, facing: 'W', chairType: 'chair' },
  ],
};

// World coordinate origin: starter shack occupies tiles x=8..17, y=5..11 (so expansions can grow up, left, right, down!)
export function buildTavernLayout(state, data) {
  const unlockedRooms = state.unlockedRooms || new Set();
  const hasKitchen = unlockedRooms.has('kitchen');
  const hasCounter = unlockedRooms.has('counter_shop');
  const hasHall = unlockedRooms.has('main_hall');
  const hasUpstairs = unlockedRooms.has('upstairs');
  const hasCellar = unlockedRooms.has('cellar');
  const hasStage = unlockedRooms.has('stage');
  const hasGarden = unlockedRooms.has('garden');

  const expansionCount = unlockedRooms.size;
  const tavernTier = expansionCount >= 6 ? 4 : expansionCount >= 4 ? 3 : expansionCount >= 2 ? 2 : 1;

  // Main room tile bounds
  const mainLeft = hasCounter ? 5 : 8;
  const mainRight = 17;
  const mainTop = 6;
  const mainBottom = hasHall ? 14 : 11;

  const floors = [];
  const walls = [];
  const rugs = [];
  const props = [];
  const wallMounts = [];

  // Helper to push floor rectangles in tile coords
  const fillFloor = (tx0, ty0, tx1, ty1, asset) => {
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        floors.push({ tx, ty, x: tx * TILE, y: ty * TILE, asset });
      }
    }
  };

  // Exterior surrounding grass & cobble approach path
  fillFloor(-1, -1, 25, 17, 'floor_grass');
  const doorTileX = 12;
  const doorTileY = mainBottom;
  for (let ty = doorTileY + 1; ty <= 17; ty++) {
    fillFloor(doorTileX, ty, doorTileX + 1, ty, 'floor_cobble');
  }

  // 1. Main Common Room Floor & Cutaway Back Wall
  fillFloor(mainLeft, mainTop, mainRight, mainBottom, 'floor_wood_planks');
  for (let tx = mainLeft; tx <= mainRight; tx++) {
    let wallAsset = 'wall_timber_mid';
    if (tx === mainLeft) wallAsset = 'wall_corner_l';
    else if (tx === mainRight && !hasKitchen) wallAsset = 'wall_corner_r';
    else if (tx === 10 || tx === 15) wallAsset = 'wall_timber_window';
    walls.push({ tx, ty: mainTop - 2, x: tx * TILE, y: (mainTop - 2) * TILE, asset: wallAsset });
  }

  // 2. Kitchen Wing (right side: tx = 18..22, ty = 6..11)
  if (hasKitchen) {
    fillFloor(18, 6, 22, 11, 'floor_kitchen');
    for (let tx = 18; tx <= 22; tx++) {
      walls.push({
        tx,
        ty: 4,
        x: tx * TILE,
        y: 4 * TILE,
        asset: tx === 22 ? 'wall_corner_r' : 'wall_stone_mid',
      });
    }
    props.push(
      { id: 'kitchen_stove', asset: 'stove_cauldron', x: 19 * TILE + 16, y: 6 * TILE + 24, shadow: true },
      { id: 'kitchen_prep', asset: 'prep_counter', x: 19 * TILE + 16, y: 9 * TILE + 8, shadow: true },
      { id: 'kitchen_spit', asset: 'spit_roast', x: 21 * TILE + 16, y: 10 * TILE + 20, shadow: true },
      { id: 'kitchen_pantry', asset: 'pantry', x: 21 * TILE + 20, y: 6 * TILE + 24, shadow: true },
    );
    wallMounts.push({ asset: 'drying_rack_herbs', x: 19 * TILE + 16, y: 4 * TILE + 4 });
  } else {
    // Compact starter hearth cook-pot tucked right behind the bar
    props.push({
      id: 'starter_stove',
      asset: 'stove_cauldron',
      x: 16 * TILE + 12,
      y: 6 * TILE + 24,
      shadow: true,
    });
  }

  // 3. Adventurer Supply Counter & Quest Alcove (left side: tx = 5..7, ty = 6..10)
  if (hasCounter) {
    props.push(
      { id: 'supply_potions', asset: 'potion_display', x: 6 * TILE, y: 6 * TILE + 20, shadow: true },
      { id: 'supply_crates', asset: 'crates_sacks', x: 5 * TILE + 24, y: 10 * TILE + 8, shadow: true },
    );
    wallMounts.push({ asset: 'quest_board_full', x: 5 * TILE + 26, y: 4 * TILE + 4 });
  }

  // 4. Upstairs Lodging Wing (cutaway upper terrace: tx = 8..17, ty = 1..3)
  const beds = [];
  if (hasUpstairs) {
    fillFloor(8, 1, 17, 3, 'floor_wood_planks');
    for (let tx = 8; tx <= 17; tx++) {
      const wAsset = tx === 8 ? 'wall_corner_l' : tx === 17 ? 'wall_corner_r' : (tx % 3 === 0 ? 'wall_timber_window' : 'wall_timber_mid');
      walls.push({ tx, ty: -1, x: tx * TILE, y: -1 * TILE, asset: wAsset });
    }
    props.push(
      { id: 'stairs_up_prop', asset: 'stairs_up', x: 8 * TILE + 28, y: 6 * TILE + 20, shadow: true },
      { id: 'upstairs_landing', asset: 'stairs_down', x: 8 * TILE + 28, y: 3 * TILE + 12, sortY: 2 * TILE + 16, shadow: false },
    );
    wallMounts.push(
      { asset: 'lantern_wall', x: 10 * TILE + 16, y: -1 * TILE + 8, lightPool: true },
      { asset: 'lantern_wall', x: 14 * TILE + 16, y: -1 * TILE + 8, lightPool: true },
    );
    const bedAsset = state.bedTier >= 2 ? 'bed_t2' : 'bed_t1';
    const bedCols = [10, 12, 14, 16];
    bedCols.forEach((btx, idx) => {
      const bx = btx * TILE + 8;
      const by = 2 * TILE + 26;
      props.push({ id: `guest_bed_${idx}`, asset: bedAsset, x: bx, y: by, shadow: true });
      beds.push({ id: `bed_${idx}`, index: idx, x: bx, y: by, occupiedBy: null });
    });
    props.push({ id: 'upstairs_chest', asset: 'chest', x: 17 * TILE + 10, y: 3 * TILE + 12, shadow: true });
  }

  // 5. Deep Stone Wine Cellar (lower-right vault: tx = 18..22, ty = 12..15)
  if (hasCellar) {
    fillFloor(18, 13, 22, 15, 'floor_cellar');
    for (let tx = 18; tx <= 22; tx++) {
      walls.push({ tx, ty: 11, x: tx * TILE, y: 11 * TILE, asset: 'wall_stone_mid' });
    }
    props.push(
      { id: 'cellar_stairs', asset: 'stairs_down', x: 18 * TILE + 28, y: 13 * TILE + 20, shadow: true },
      { id: 'cellar_kegs_1', asset: 'keg_rack', x: 20 * TILE + 16, y: 13 * TILE + 22, shadow: true },
      { id: 'cellar_kegs_2', asset: 'keg_rack', x: 22 * TILE, y: 15 * TILE + 8, shadow: true },
    );
  }

  // 6. Bardic Performance Stage (west wing: tx = 2..4, ty = 9..13)
  let stageSpot = null;
  if (hasStage) {
    fillFloor(2, 8, 5, 13, 'floor_wood_planks');
    for (let tx = 2; tx <= 4; tx++) {
      walls.push({ tx, ty: 6, x: tx * TILE, y: 6 * TILE, asset: tx === 2 ? 'wall_corner_l' : 'wall_timber_mid' });
    }
    const sx = 3 * TILE + 16;
    const sy = 10 * TILE + 20;
    props.push(
      { id: 'bard_stage', asset: 'stage_small', x: sx, y: sy, sortY: sy - 36, shadow: true },
      { id: 'stage_harp', asset: 'prop_harp', x: sx - 32, y: sy - 16, sortY: sy - 30, shadow: true },
      { id: 'stage_lute', asset: 'prop_lute', x: sx + 34, y: sy - 16, sortY: sy - 30, shadow: true },
    );
    wallMounts.push({ asset: 'string_lights', x: 2 * TILE + 16, y: 6 * TILE + 12 });
    stageSpot = {
      musicianX: sx - 12,
      musicianY: sy - 14,
      dancerX: sx + 14,
      dancerY: sy - 10,
    };
  }

  // 7. Verdant Garden Terrace (open-air courtyard: tx = 0..4, ty = 14..16 or west patio tx = 0..4, ty = 3..7)
  if (hasGarden) {
    fillFloor(0, 3, 4, 7, 'floor_cobble');
    props.push(
      { id: 'garden_tree_1', asset: 'tree_oak', x: 0 * TILE + 24, y: 3 * TILE + 16, shadow: true },
      { id: 'garden_bush_1', asset: 'bush_berry', x: 4 * TILE + 12, y: 3 * TILE + 20, shadow: true },
      { id: 'garden_lamp_1', asset: 'lamppost', x: 0 * TILE + 20, y: 7 * TILE + 16, shadow: true },
    );
    wallMounts.push({ asset: 'string_lights', x: 1 * TILE + 16, y: 2 * TILE + 20 });
  } else {
    // Exterior decorative trees framing the building outside active expansions
    const leftTreeTileX = hasStage ? 0 : hasCounter ? 3 : 6;
    const rightTreeTileX = (hasKitchen || hasCellar) ? 23 : 19;
    props.push(
      { id: 'ext_tree_l', asset: 'tree_oak', x: leftTreeTileX * TILE + 12, y: 9 * TILE, shadow: true },
      { id: 'ext_tree_r', asset: 'tree_oak', x: rightTreeTileX * TILE + 16, y: 13 * TILE, shadow: true },
      { id: 'ext_bush_l', asset: 'bush_berry', x: 10 * TILE + 12, y: (doorTileY + 1) * TILE + 20, shadow: true },
      { id: 'ext_lamp', asset: 'lamppost', x: (doorTileX + 2) * TILE + 18, y: (doorTileY + 1) * TILE + 22, shadow: true },
    );
  }

  // Core Bar Counter & Front Entrance Door
  const barX = 14 * TILE + 16;
  const barY = 7 * TILE + 20;
  props.push(
    { id: 'main_bar', asset: 'bar_counter_taps', x: barX, y: barY, shadow: true },
    { id: 'bar_keg', asset: 'keg_rack', x: 14 * TILE + 16, y: 6 * TILE + 18, shadow: true },
    { id: 'bar_shelves', asset: 'shelves_bottles', x: 12 * TILE + 12, y: 6 * TILE + 18, shadow: true },
    { id: 'bar_stool_1', asset: 'stool_s', x: barX - 28, y: barY + 10, shadow: true },
    { id: 'bar_stool_2', asset: 'stool_s', x: barX, y: barY + 10, shadow: true },
    { id: 'bar_stool_3', asset: 'stool_s', x: barX + 28, y: barY + 10, shadow: true },
    { id: 'front_door', asset: 'door_front', x: (doorTileX + 1) * TILE, y: (doorTileY + 1) * TILE, shadow: false },
  );
  wallMounts.push(
    { asset: 'sign_tavern', x: 12 * TILE + 22, y: (mainTop - 2) * TILE - 2, sways: true },
    { asset: 'lantern_wall', x: 9 * TILE - 4, y: (mainTop - 2) * TILE + 4, lightPool: true },
    { asset: 'lantern_wall', x: 16 * TILE + 4, y: (mainTop - 2) * TILE + 4, lightPool: true },
  );

  // Decor & Repeatable Upgrades -> Visible World Props (B2)!
  const upg = state.upgradeLevels || {};
  if ((upg.decor_polish || 0) > 0) {
    props.push({
      id: 'bar_polished_tray',
      asset: 'ale_tray_three',
      x: barX - 18,
      y: barY - 14,
      sortY: barY + 2,
      shadow: false,
    });
  }
  if ((upg.train_chefs || 0) > 0 && !hasKitchen) {
    wallMounts.push({ asset: 'drying_rack_herbs', x: 16 * TILE + 24, y: 4 * TILE + 4 });
  }
  if ((upg.town_crier || 0) > 0 && !hasCounter) {
    wallMounts.push({ asset: 'quest_board_full', x: 7 * TILE + 30, y: 4 * TILE + 4 });
  }
  if ((upg.decor_hearth || 0) > 0) {
    props.push({ id: 'hearth_fire', asset: 'fireplace_1', x: 10 * TILE + 16, y: 6 * TILE + 16, shadow: false, emitsEmbers: true, lightPool: true });
  }
  if ((upg.decor_rug_red || 0) > 0) {
    rugs.push({ group: 'rug_red', x: 11 * TILE, y: 9 * TILE });
  }
  if ((upg.decor_rug_accent || 0) > 0) {
    rugs.push({ group: 'rug_accent', x: 8 * TILE + 16, y: 8 * TILE + 16 });
  }
  if ((upg.decor_herbs || 0) > 0) {
    wallMounts.push({
      asset: 'drying_rack_herbs',
      x: hasKitchen ? 17 * TILE + 28 : 16 * TILE + 24,
      y: 4 * TILE + 6,
    });
  }
  if ((upg.decor_plants || 0) > 0) {
    props.push(
      { id: 'plant_1', asset: 'plant_pot', x: (mainLeft * TILE) + 14, y: (mainBottom * TILE) + 18, shadow: true },
      { id: 'plant_2', asset: 'plant_pot', x: (mainRight * TILE) + 18, y: (mainBottom * TILE) + 18, shadow: true },
    );
  }
  if ((upg.decor_banners || 0) > 0) {
    wallMounts.push(
      { asset: 'banner_red', x: hasCounter ? 5 * TILE : 8 * TILE + 4, y: 4 * TILE + 2 },
      { asset: 'banner_accent', x: hasKitchen ? 17 * TILE : 16 * TILE + 22, y: 4 * TILE + 2 },
    );
  }
  if ((upg.decor_painting || 0) > 0) {
    wallMounts.push({ asset: 'painting_landscape', x: 11 * TILE + 18, y: 4 * TILE - 2 });
  }
  if ((upg.decor_armor || 0) > 0) {
    props.push({ id: 'armor_1', asset: 'armor_stand', x: (doorTileX - 1) * TILE + 16, y: (doorTileY + 1) * TILE - 4, shadow: true });
  }
  if ((upg.decor_trophy || 0) > 0) {
    wallMounts.push({ asset: 'trophy_stag', x: 14 * TILE, y: 4 * TILE - 6 });
  }
  if ((upg.decor_chandelier || 0) > 0) {
    wallMounts.push({ asset: 'chandelier', x: 12 * TILE, y: 5 * TILE + 8, foreground: true, lightPool: true });
  }

  // Dining Table Slots (starter 2 tables + `add_table` repeatable upgrade, ordered strictly by unlock chain so tables never shift)
  const candidateTableCoords = [
    { x: 9 * TILE + 16, y: 8 * TILE + 24, zone: 'main' },
    { x: 12 * TILE + 16, y: 9 * TILE + 16, zone: 'main' },
    { x: 9 * TILE + 16, y: 10 * TILE + 24, zone: 'main' },
    { x: 15 * TILE + 16, y: 10 * TILE + 16, zone: 'main' },
    { x: 15 * TILE + 16, y: 8 * TILE + 24, zone: 'main' },
    // Unlocked with Supply Counter (requires Kitchen)
    { x: 6 * TILE + 24, y: 9 * TILE + 4, zone: 'counter', req: 'counter_shop' },
    // Unlocked with Great Timber Hall (requires Supply Counter)
    { x: 9 * TILE + 16, y: 13 * TILE + 4, zone: 'hall', req: 'main_hall' },
    { x: 12 * TILE + 16, y: 12 * TILE + 20, zone: 'hall', req: 'main_hall' },
    { x: 15 * TILE + 16, y: 13 * TILE + 4, zone: 'hall', req: 'main_hall' },
    { x: 6 * TILE + 24, y: 12 * TILE + 16, zone: 'hall', req: 'main_hall' },
    // Unlocked with Verdant Garden Terrace (requires Stage -> Cellar -> Upstairs -> Hall)
    { x: 2 * TILE + 16, y: 5 * TILE + 12, zone: 'garden', req: 'garden' },
    { x: 2 * TILE + 16, y: 7 * TILE + 8, zone: 'garden', req: 'garden' },
  ];

  const availableSlots = candidateTableCoords.filter((s) => !s.req || unlockedRooms.has(s.req));
  const ownedTableCount = Math.min(availableSlots.length, 2 + (upg.add_table || 0));

  const tableTier = state.tableTier || 1;
  const tableAssetByTier = {
    1: 'table_t1_bare',
    2: 'table_t2_polished',
    3: 'table_t3_clothed',
    4: 'table_t4_ornate',
  };
  const tableAsset = tableAssetByTier[tableTier] || 'table_round';
  const hasCandles = (upg.decor_candles || 0) > 0;

  const tables = [];
  for (let i = 0; i < ownedTableCount; i++) {
    const slot = availableSlots[i];
    const tx = slot.x;
    const ty = slot.y;
    const seatConfigs = TABLE_TIER_SEAT_CONFIGS[tableTier] || TABLE_TIER_SEAT_CONFIGS[1];

    const seats = seatConfigs.map((so, sIdx) => {
      const chairAsset = `${so.chairType || 'chair'}_${so.facing.toLowerCase()}`;
      const cx = tx + so.dx;
      const cy = ty + so.dy;
      let sortY = cy - 2;
      if (so.facing === 'S') sortY = cy - 4;
      else if (so.facing === 'N') sortY = cy + 4;

      props.push({
        id: `table_${i}_chair_${sIdx}`,
        asset: chairAsset,
        x: cx,
        y: cy,
        sortY,
        shadow: true,
      });

      const dir = so.facing === 'S' ? 'down' : so.facing === 'N' ? 'up' : so.facing === 'E' ? 'right' : 'left';
      return {
        id: `t${i}_s${sIdx}`,
        tableIndex: i,
        seatIndex: sIdx,
        x: cx,
        y: cy,
        facing: so.facing,
        dir,
        occupiedBy: null,
      };
    });

    props.push({
      id: `dining_table_${i}`,
      asset: tableAsset,
      x: tx,
      y: ty,
      shadow: true,
      tableIndex: i,
      hasCandles,
    });

    tables.push({
      index: i,
      x: tx,
      y: ty,
      serviceX: tx,
      serviceY: ty + 12,
      seats,
      activeDishProp: null,
      dirty: false,
    });
  }

  // Key navigation waypoints
  const waypoints = {
    entranceOutside: { x: (doorTileX + 1) * TILE, y: (doorTileY + 3) * TILE },
    entranceInside: { x: (doorTileX + 1) * TILE, y: doorTileY * TILE + 8 },
    barPickup: { x: barX - 8, y: barY + 20 },
    barBehind: { x: barX, y: barY - 12 },
    kitchenPickup: hasKitchen
      ? { x: 18 * TILE + 12, y: 8 * TILE + 16 }
      : { x: 16 * TILE + 4, y: 7 * TILE + 24 },
    kitchenCookSpot: hasKitchen
      ? { x: 19 * TILE + 16, y: 7 * TILE + 18 }
      : { x: 16 * TILE + 12, y: 7 * TILE + 10 },
    kitchenSousSpot: hasKitchen
      ? { x: 20 * TILE + 20, y: 9 * TILE + 20 }
      : { x: 16 * TILE + 24, y: 7 * TILE + 16 },
    counterCustomerSpot: hasCounter
      ? { x: 6 * TILE + 8, y: 7 * TILE + 24 }
      : { x: barX - 24, y: barY + 20 },
    questBoardSpot: hasCounter
      ? { x: 6 * TILE + 28, y: 6 * TILE + 24 }
      : { x: 9 * TILE + 16, y: 6 * TILE + 24 },
    stairsBottom: { x: 8 * TILE + 28, y: 7 * TILE - 2 },
    stairsUpMid: { x: 8 * TILE + 28, y: 5 * TILE + 12 },
    stairsTop: { x: 8 * TILE + 28, y: 3 * TILE + 4 },
    maidIdleSpots: [
      { x: 13 * TILE + 8, y: 8 * TILE + 12 },
      { x: 11 * TILE + 8, y: 8 * TILE + 16 },
      { x: 14 * TILE + 24, y: 9 * TILE + 12 },
      { x: 10 * TILE + 16, y: 11 * TILE + 8 },
      hasCounter
        ? { x: 7 * TILE + 24, y: 8 * TILE + 16 }
        : { x: 11 * TILE + 24, y: 10 * TILE + 16 },
      { x: 13 * TILE + 16, y: 11 * TILE + 12 },
    ],
    stageSpot,
  };

  // Camera bounds in world pixels
  const minTileX = hasGarden ? 0 : hasStage ? 2 : mainLeft - 1;
  const maxTileX = hasKitchen ? 23 : mainRight + 2;
  const minTileY = hasUpstairs ? -1 : mainTop - 2;
  const maxTileY = Math.max(doorTileY + 3, hasCellar ? 16 : mainBottom + 2);

  return {
    tavernTier,
    facadeAsset: `facade_t${tavernTier}`,
    polishedLevel: upg.decor_polish || 0,
    doorTileX,
    doorTileY,
    floors,
    walls,
    rugs,
    props,
    wallMounts,
    tables,
    beds,
    waypoints,
    maxTableSlots: availableSlots.length,
    bounds: {
      minX: minTileX * TILE,
      minY: minTileY * TILE,
      maxX: maxTileX * TILE,
      maxY: maxTileY * TILE,
      defaultCenterX: 12.5 * TILE,
      defaultCenterY: 8.5 * TILE,
    },
  };
}
