// Main Browser Bootloader, Offline Asset Loader, Fixed-Timestep Loop, Input & Save Manager.

import { SIM_DT, TavernSim } from './sim.js';
import { TavernRenderer } from './renderer.js';
import { TavernUI } from './ui.js';
import { AudioManager } from './audio.js';

const SAVE_STORAGE_KEY = 'nyah_fifi_tavern_save_v1';
const SETTINGS_STORAGE_KEY = 'nyah_fifi_tavern_settings_v1';

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'sync';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = encodeURI(url);
  });
}

async function fetchJson(url) {
  const res = await fetch(encodeURI(url));
  if (!res.ok) throw new Error(`Failed to fetch JSON ${url}: ${res.status}`);
  return res.json();
}

function applyPaletteCssVars(colors) {
  const root = document.documentElement.style;
  root.setProperty('--bg-outer', colors.OUTLINE_COOL);
  root.setProperty('--panel-bg', colors.WOOD_DEEP);
  root.setProperty('--panel-border', colors.GOLD_BASE);
  root.setProperty('--parch-bg', colors.PARCHMENT_LIGHT);
  root.setProperty('--ink-dark', colors.OUTLINE_WARM);
  root.setProperty('--gold-hi', colors.GOLD_LIGHT);
}

async function loadAllGameResources() {
  const [
    palette,
    recipes,
    upgrades,
    customers,
    staff,
    dialogue,
    thoughts,
    tavernManifest,
    npcManifest,
    charManifest,
  ] = await Promise.all([
    fetchJson('./data/palette.json'),
    fetchJson('./data/recipes.json'),
    fetchJson('./data/upgrades.json'),
    fetchJson('./data/customers.json'),
    fetchJson('./data/staff.json'),
    fetchJson('./data/dialogue.json'),
    fetchJson('./data/thoughts.json'),
    fetchJson('./assets/tavern/manifest.json'),
    fetchJson('./assets/npcs/manifest.json'),
    fetchJson('./assets/characters/manifest.json'),
  ]);

  const tavernMap = new Map();
  const tavernEntries = Object.entries(tavernManifest.assets);
  await Promise.all(
    tavernEntries.map(async ([name, meta]) => {
      const img = await loadImage(`./${meta.file}`);
      tavernMap.set(name, img);
    })
  );

  const npcMap = new Map();
  const npcEntries = Object.entries(npcManifest.npcs);
  await Promise.all(
    npcEntries.map(async ([id, meta]) => {
      const [sheetImg, bustImg] = await Promise.all([
        loadImage(`./${meta.sheet}`),
        loadImage(`./${meta.bust}`),
      ]);
      npcMap.set(id, sheetImg);
      npcMap.set(`${id}_bust`, bustImg);
    })
  );

  const charMap = new Map();
  const [nyahWorld, fifiWorld, nyahPortrait, fifiPortrait, uiSheet] = await Promise.all([
    loadImage(`./${charManifest.characters.nyah.worldSheet}`),
    loadImage(`./${charManifest.characters.fifi.worldSheet}`),
    loadImage(`./${charManifest.characters.nyah.portraitNative}`),
    loadImage(`./${charManifest.characters.fifi.portraitNative}`),
    loadImage(`./${charManifest.suppliedUi.sheet}`),
  ]);
  charMap.set('nyah', nyahWorld);
  charMap.set('fifi', fifiWorld);
  charMap.set('nyah_portrait', nyahPortrait);
  charMap.set('fifi_portrait', fifiPortrait);

  return {
    data: { palette, recipes, upgrades, customers, staff, dialogue, thoughts },
    assets: { tavern: tavernMap, npcs: npcMap, chars: charMap, uiSheet },
  };
}

function readLocalJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalJson(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {
    // Ignore storage quota errors in restricted sandboxes
  }
}

async function boot() {
  const canvas = document.getElementById('game-canvas');
  const { data, assets } = await loadAllGameResources();
  applyPaletteCssVars(data.palette.colors);

  const audio = new AudioManager();
  audio.init();

  const savedSettings = readLocalJson(SETTINGS_STORAGE_KEY) || {};
  audio.applySettings(savedSettings);

  let sim = new TavernSim(data);
  const renderer = new TavernRenderer(canvas, assets, data.palette);
  if (typeof savedSettings.atmosphereEnabled === 'boolean') {
    renderer.atmosphereEnabled = savedSettings.atmosphereEnabled;
  }

  renderer.resizeToWindow(window.innerWidth, window.innerHeight);
  renderer.centerCameraOn(sim.layout.bounds.defaultCenterX, sim.layout.bounds.defaultCenterY, sim.layout.bounds);

  const persistSettings = () => {
    writeLocalJson(SETTINGS_STORAGE_KEY, {
      ...audio.getState(),
      atmosphereEnabled: renderer.atmosphereEnabled,
      fpsCap: ui.fpsCap,
    });
  };

  const saveGameNow = () => {
    writeLocalJson(SAVE_STORAGE_KEY, sim.serializeSave(Date.now()));
  };

  const focusRoom = (roomKey) => {
    const b = sim.layout.bounds;
    if (roomKey === 'kitchen') {
      renderer.centerCameraOn(19 * 32, 8.5 * 32, b);
    } else if (roomKey === 'upstairs') {
      renderer.centerCameraOn(12.5 * 32, 2.5 * 32, b);
    } else if (roomKey === 'stage') {
      renderer.centerCameraOn(3.5 * 32, 9.5 * 32, b);
    } else {
      renderer.centerCameraOn(b.defaultCenterX, b.defaultCenterY, b);
    }
  };

  // Save Export / Import DOM overlay wiring
  const saveDialog = document.getElementById('save-dialog');
  const saveTextarea = document.getElementById('save-textarea');
  const openSaveDialog = () => {
    saveTextarea.value = sim.exportSaveString(Date.now());
    saveDialog.classList.add('open');
    saveTextarea.focus();
    saveTextarea.select();
  };

  document.getElementById('btn-copy-save').addEventListener('click', () => {
    saveTextarea.select();
    navigator.clipboard?.writeText(saveTextarea.value).catch(() => {});
    ui.pushToast('Copied!', 'Save string copied to clipboard.');
  });

  document.getElementById('btn-import-save').addEventListener('click', () => {
    try {
      const offline = sim.importSaveString(saveTextarea.value, Date.now());
      saveDialog.classList.remove('open');
      ui.mode = 'playing';
      ui.settingsOpen = false;
      if (offline) ui.offlineModal = offline;
      saveGameNow();
      ui.pushToast('Save Loaded!', 'Imported tavern state successfully.');
      audio.playSfx('upgrade');
    } catch {
      ui.pushToast('Invalid Save', 'Could not parse that save string.');
      audio.playSfx('complaint');
    }
  });

  document.getElementById('btn-close-save').addEventListener('click', () => {
    saveDialog.classList.remove('open');
  });

  const ui = new TavernUI(assets, data.palette, {
    onAudioUnlock: () => audio.unlock(),
    onPlaySfx: (type, opts) => audio.playSfx(type, opts),
    onContinueGame: () => {
      const saved = readLocalJson(SAVE_STORAGE_KEY);
      if (saved) {
        const offline = sim.loadSave(saved, Date.now());
        if (offline) ui.offlineModal = offline;
      }
      focusRoom('center');
    },
    onStartNewGame: (playIntro) => {
      sim = new TavernSim(data);
      window.__tavernGame.sim = sim;
      focusRoom('center');
      if (playIntro) {
        sim.banter.startIntro();
      } else {
        sim.state.hasSeenIntro = true;
      }
      saveGameNow();
    },
    onSaveNow: () => saveGameNow(),
    onOpenSaveDialog: () => openSaveDialog(),
    onResetSave: () => {
      try { localStorage.removeItem(SAVE_STORAGE_KEY); } catch {}
      sim = new TavernSim(data);
      window.__tavernGame.sim = sim;
      ui.selectedActorId = null;
      focusRoom('center');
      ui.pushToast('Tavern Reset', 'Started a fresh run-down tavern!');
    },
    onFocusRoom: (rk) => focusRoom(rk),
    onSettingsChange: (patch) => {
      audio.applySettings(patch);
      if (typeof patch.atmosphereEnabled === 'boolean') {
        renderer.atmosphereEnabled = patch.atmosphereEnabled;
      }
      persistSettings();
    },
  });

  if (savedSettings.fpsCap === 30) ui.fpsCap = 30;

  window.addEventListener('resize', () => {
    renderer.resizeToWindow(window.innerWidth, window.innerHeight);
  });

  // Pointer Drag-Pan + Click Handling
  let isDragging = false;
  let dragMoved = false;
  let dragStartClientX = 0;
  let dragStartClientY = 0;
  let dragStartCamX = 0;
  let dragStartCamY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock();
    const { cx, cy } = renderer.screenToCanvas(e.clientX, e.clientY);
    ui.handlePointerMove(cx, cy);

    isDragging = true;
    dragMoved = false;
    dragStartClientX = e.clientX;
    dragStartClientY = e.clientY;
    dragStartCamX = renderer.camX;
    dragStartCamY = renderer.camY;
  });

  window.addEventListener('pointermove', (e) => {
    const { cx, cy } = renderer.screenToCanvas(e.clientX, e.clientY);
    ui.handlePointerMove(cx, cy);

    if (isDragging && ui.mode === 'playing' && !sim.banter.introActive && !ui.settingsOpen && !ui.offlineModal) {
      const dxScreen = e.clientX - dragStartClientX;
      const dyScreen = e.clientY - dragStartClientY;
      if (Math.hypot(dxScreen, dyScreen) > 5) {
        dragMoved = true;
      }
      if (dragMoved && !(ui.shopOpen && !ui.ambientMode && cx >= 406)) {
        renderer.camX = Math.round(dragStartCamX - dxScreen / renderer.scale);
        renderer.camY = Math.round(dragStartCamY - dyScreen / renderer.scale);
        renderer.clampCamera(sim.layout.bounds);
      }
    }
  });

  window.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    if (dragMoved) return;

    const { cx, cy } = renderer.screenToCanvas(e.clientX, e.clientY);
    const consumedByUi = ui.handleClick(cx, cy, sim);
    if (!consumedByUi && ui.mode === 'playing' && !sim.banter.introActive) {
      const { wx, wy } = renderer.canvasToWorld(cx, cy);
      const hitActor = sim.findActorAtWorld(wx, wy);
      if (hitActor) {
        ui.selectedActorId = hitActor.id;
        ui.ambientMode = false;
        audio.playSfx('ui_click');
      } else {
        ui.selectedActorId = null;
      }
    }
  });

  canvas.addEventListener('wheel', (e) => {
    const { cx, cy } = renderer.screenToCanvas(e.clientX, e.clientY);
    if (ui.handleWheel(cx, cy, e.deltaY)) {
      e.preventDefault();
      return;
    }
    if (ui.mode === 'playing' && !sim.banter.introActive) {
      renderer.camY += Math.sign(e.deltaY) * 20;
      renderer.clampCamera(sim.layout.bounds);
      e.preventDefault();
    }
  }, { passive: false });

  // Keyboard Pan & Shortcut Controls
  const heldKeys = new Set();
  window.addEventListener('keydown', (e) => {
    if (saveDialog.classList.contains('open')) {
      if (e.key === 'Escape') saveDialog.classList.remove('open');
      return;
    }
    heldKeys.add(e.key.toLowerCase());
    if (e.key === 'h' || e.key === 'H') {
      if (ui.mode === 'playing' && !sim.banter.introActive) {
        ui.ambientMode = !ui.ambientMode;
      }
    } else if (e.key === 'Escape') {
      if (sim.banter.introActive) {
        sim.banter.skipIntro();
        sim.state.hasSeenIntro = true;
      } else if (ui.settingsOpen) {
        ui.settingsOpen = false;
      } else if (ui.selectedActorId) {
        ui.selectedActorId = null;
      } else if (ui.ambientMode) {
        ui.ambientMode = false;
      }
    } else if (e.key === ' ' && sim.banter.introActive) {
      e.preventDefault();
      const more = sim.banter.advanceIntroBeat();
      if (!more) sim.state.hasSeenIntro = true;
    } else if (e.key === '1') {
      ui.speedMultiplier = 1;
    } else if (e.key === '2') {
      ui.speedMultiplier = 2;
    } else if (e.key === '3') {
      ui.speedMultiplier = 4;
    }
  });

  window.addEventListener('keyup', (e) => {
    heldKeys.delete(e.key.toLowerCase());
  });

  // Drain simulation events into Web Audio SFX
  function processSimEvents() {
    const evs = sim.drainEvents();
    for (const ev of evs) {
      switch (ev.type) {
        case 'door_enter':
          audio.playSfx('door_bell', 0.65);
          break;
        case 'serve_order':
          audio.playSfx('mug_clink', 0.8);
          break;
        case 'cook_start':
          audio.playSfx('sizzle', 0.55);
          break;
        case 'payment':
          audio.playSfx('coin', 0.85);
          break;
        case 'complaint':
          audio.playSfx('complaint', 0.8);
          break;
        default:
          break;
      }
    }
  }

  // Main Fixed-Timestep + Idle Frame-Cap Loop
  let lastTimestamp = performance.now();
  let lastRenderTime = lastTimestamp;
  let simAccumulator = 0;
  let autosaveTimer = 0;

  function frame(now) {
    requestAnimationFrame(frame);

    const rawDeltaSec = Math.max(0, (now - lastTimestamp) / 1000);
    lastTimestamp = now;

    // Keyboard camera panning
    if (ui.mode === 'playing' && !sim.banter.introActive) {
      const panStep = Math.min(0.1, rawDeltaSec) * 180;
      if (heldKeys.has('w') || heldKeys.has('arrowup')) renderer.camY -= panStep;
      if (heldKeys.has('s') || heldKeys.has('arrowdown')) renderer.camY += panStep;
      if (heldKeys.has('a') || heldKeys.has('arrowleft')) renderer.camX -= panStep;
      if (heldKeys.has('d') || heldKeys.has('arrowright')) renderer.camX += panStep;
    }

    // Long background tab catch-up (>15m -> reduced-rate offline summary; <=15m -> deterministic tick catch-up)
    if (ui.mode === 'playing' && !sim.banter.introActive && rawDeltaSec > 900) {
      const capped = Math.min(rawDeltaSec, 8 * 3600);
      const earned = Math.max(1, Math.round(capped * Math.max(0.25, sim.stats.avgGoldPerSec) * 0.45));
      const guests = Math.max(1, Math.round(capped / 14));
      sim.gold = Math.round(sim.gold + earned);
      sim.stats.goldEarnedTotal += earned;
      sim.stats.customersServed += guests;
      ui.offlineModal = sim.banter.formatOfflineSummary(rawDeltaSec / 60, earned, guests);
    } else if (sim.banter.introActive) {
      sim.banter.updateIntro(Math.min(0.2, rawDeltaSec), (spk) => audio.playSfx('blip', spk));
    } else {
      // Even on the title screen, run gentle background tavern simulation at 1x so diorama is alive!
      const speed = ui.mode === 'playing' ? ui.speedMultiplier : 1;
      simAccumulator += Math.min(rawDeltaSec, 120) * speed;
      let ticksRun = 0;
      const maxCatchupTicks = 6000; // up to 10 minutes per frame without freezing UI
      while (simAccumulator >= SIM_DT && ticksRun < maxCatchupTicks) {
        sim.step(SIM_DT, ui.mode === 'playing' ? (spk) => audio.playSfx('blip', spk) : null);
        simAccumulator -= SIM_DT;
        ticksRun += 1;
      }
      if (ticksRun >= maxCatchupTicks) simAccumulator = 0;

      if (ui.mode === 'playing') {
        processSimEvents();
        autosaveTimer += Math.min(rawDeltaSec, 5);
        if (autosaveTimer >= 20.0) {
          autosaveTimer = 0;
          saveGameNow();
        }
      } else {
        sim.drainEvents();
      }
    }

    const visDt = Math.min(0.1, rawDeltaSec);
    ui.update(visDt);
    audio.hasFireplace = sim.isUpgradeOwned('decor_hearth');
    audio.update(visDt, sim.dayPhase, sim.isMusicianPerforming, sim.customers.length);

    // Respect Low-CPU FPS Cap (30 FPS = ~32ms interval; 60 FPS = uncapped rAF)
    const minFrameMs = ui.fpsCap === 30 ? 31.0 : 0;
    if (now - lastRenderTime >= minFrameMs) {
      const renderDt = Math.min(0.1, (now - lastRenderTime) / 1000);
      lastRenderTime = now;
      renderer.updateAtmosphere(renderDt, sim);
      const suppressBubbles =
        ui.mode !== 'playing' || sim.banter.introActive || Boolean(ui.offlineModal) || ui.settingsOpen;
      renderer.render(sim, ui.selectedActorId, suppressBubbles);
      const hasAutosave = Boolean(readLocalJson(SAVE_STORAGE_KEY));
      ui.render(renderer.ctx, sim, hasAutosave, {
        ...audio.getState(),
        atmosphereEnabled: renderer.atmosphereEnabled,
      });
    }
  }

  window.__tavernGame = {
    get sim() { return sim; },
    set sim(v) { sim = v; },
    renderer,
    ui,
    audio,
    data,
    assets,
    saveGameNow,
  };

  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error('Tavern boot failed:', err);
});
