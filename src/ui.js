// Crisp 9-Slice Pixel-Art UI System on the 640x360 Canvas:
// - Title Screen (starts Web Audio on first click)
// - Skippable ~40s Portrait Story Intro (Nyah's executive purchase + Fifi's 15s protest + silent glare)
// - Top HUD, Speed Controls (1x/2x/4x), Ambient UI-Hide Mode ([H]), Camera Room Jumps
// - 5-Tab Shop Drawer (Tables, Building, Staff, Menu, Decor) with Tooltips & Toasts
// - Live NPC Inspector Panel (Bust/Portrait, Mood Bar, Live Thought, 5 Opinions, Favorite Dish, Event Log)
// - "While You Were Away" Dual-Voice Offline Summary & Settings / Save Export-Import Modal.

import { drawPixelText, drawWrappedPixelText, measurePixelText } from './font.js';
import { INTERNAL_W, INTERNAL_H, drawNineSlice, rgbaFromPalette } from './renderer.js';

const SHOP_TABS = [
  { id: 'tables', label: 'Tables', icon: 'icon_upg_table' },
  { id: 'building', label: 'Build', icon: 'icon_upg_build' },
  { id: 'staff', label: 'Staff', icon: 'icon_upg_staff' },
  { id: 'menu', label: 'Menu', icon: 'icon_roast_chicken' },
  { id: 'decor', label: 'Decor', icon: 'icon_upg_decor' },
];

export class TavernUI {
  constructor(assets, paletteData, callbacks = {}) {
    this.assets = assets;
    this.pal = paletteData.colors;
    this.callbacks = callbacks; // { onAudioUnlock, onPlaySfx, onSaveNow, onOpenSaveDialog, onResetSave, onSettingsChange, onFocusRoom }

    this.mode = 'title'; // 'title' | 'playing'
    this.shopOpen = true;
    this.activeTab = 'tables';
    this.shopScroll = 0;
    this.maxShopScroll = 0;

    this.selectedActorId = null;
    this.ambientMode = false;
    this.settingsOpen = false;
    this.offlineModal = null; // { minutes, gold, customers, nyahText, fifiText }

    this.speedMultiplier = 1; // 1 | 2 | 4
    this.fpsCap = 60;         // 60 | 30

    this.hitRegions = [];     // rebuilt each render frame
    this.hoverX = -1;
    this.hoverY = -1;
    this.hoveredTooltip = null;

    this.toasts = [];         // { title, text, timer }
  }

  pushToast(title, text, duration = 4.5) {
    this.toasts.unshift({ title, text, timer: duration });
    if (this.toasts.length > 3) this.toasts.length = 3;
  }

  update(dt) {
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].timer -= dt;
      if (this.toasts[i].timer <= 0) {
        this.toasts.splice(i, 1);
      }
    }
  }

  addHit(id, x, y, w, h, onClick, tooltip = null) {
    this.hitRegions.push({ id, x, y, w, h, onClick, tooltip });
  }

  isHovered(x, y, w, h) {
    return this.hoverX >= x && this.hoverX <= x + w && this.hoverY >= y && this.hoverY <= y + h;
  }

  handlePointerMove(cx, cy) {
    this.hoverX = cx;
    this.hoverY = cy;
    this.hoveredTooltip = null;
    for (let i = this.hitRegions.length - 1; i >= 0; i--) {
      const r = this.hitRegions[i];
      if (r.tooltip && cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
        this.hoveredTooltip = r.tooltip;
        break;
      }
    }
  }

  handleWheel(cx, cy, deltaY) {
    if (this.mode !== 'playing' || !this.shopOpen || this.settingsOpen || this.offlineModal) return false;
    // Shop panel rect: x = 406..636, y = 32..354
    if (cx >= 406 && cx <= 636 && cy >= 32 && cy <= 354) {
      this.shopScroll = Math.max(0, Math.min(this.maxShopScroll, this.shopScroll + (deltaY > 0 ? 28 : -28)));
      return true;
    }
    return false;
  }

  handleClick(cx, cy, sim) {
    this.callbacks.onAudioUnlock?.();

    // Check top-most registered UI hit region first
    for (let i = this.hitRegions.length - 1; i >= 0; i--) {
      const r = this.hitRegions[i];
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
        r.onClick?.();
        return true;
      }
    }

    // Block world clicks when modal / intro / title is active or pointer is inside open panels
    if (this.mode === 'title' || sim.banter.introActive || this.settingsOpen || this.offlineModal) {
      return true;
    }
    if (!this.ambientMode && this.shopOpen && cx >= 406 && cy >= 30) {
      return true;
    }
    if (!this.ambientMode && this.selectedActorId && cx <= 226 && cy >= 30) {
      return true;
    }
    return false;
  }

  drawButton(ctx, id, x, y, w, h, label, {
    gold = false,
    disabled = false,
    active = false,
    scale = 1,
    icon = null,
    onClick = null,
    tooltip = null,
  } = {}) {
    const hovered = !disabled && this.isHovered(x, y, w, h);
    const skinName = gold || active ? 'ui_button_gold' : 'ui_button_wood';
    const skin = this.assets.tavern.get(skinName);
    drawNineSlice(ctx, skin, x, y + (hovered ? -1 : 0), w, h, 6);

    if (disabled) {
      ctx.fillStyle = rgbaFromPalette(this.pal, 'OUTLINE_COOL', 0.45);
      ctx.fillRect(Math.round(x + 2), Math.round(y + 2), Math.round(w - 4), Math.round(h - 4));
    } else if (hovered) {
      ctx.strokeStyle = this.pal.GOLD_LIGHT;
      ctx.strokeRect(Math.round(x + 1), Math.round(y), Math.round(w - 2), Math.round(h - 2));
    }

    let textX = x + w / 2;
    if (icon) {
      const ic = this.assets.tavern.get(icon);
      if (ic) {
        ctx.drawImage(ic, Math.round(x + 5), Math.round(y + (h - ic.height) / 2 + (hovered ? -1 : 0)));
        textX = x + 10 + w / 2;
      }
    }

    const textCol = disabled
      ? this.pal.STONE_LIGHT
      : (gold || active ? this.pal.OUTLINE_WARM : this.pal.CREAM_LIGHT);
    const shCol = gold || active ? null : this.pal.OUTLINE_WARM;
    drawPixelText(ctx, label, textX, y + Math.floor((h - 7 * scale) / 2) + (hovered ? -1 : 0), {
      color: textCol,
      shadow: shCol,
      scale,
      align: 'center',
    });

    this.addHit(id, x, y, w, h, disabled ? null : () => {
      this.callbacks.onPlaySfx?.('ui_click');
      onClick?.();
    }, tooltip);
  }

  render(ctx, sim, hasAutosave = false, audioState = {}) {
    this.hitRegions = [];

    if (this.mode === 'title') {
      this.renderTitleScreen(ctx, sim, hasAutosave);
      if (this.settingsOpen) this.renderSettingsModal(ctx, sim, audioState);
      return;
    }

    if (sim.banter.introActive) {
      this.renderStoryIntro(ctx, sim);
      return;
    }

    if (this.ambientMode) {
      // Cozy Ambient Mode: hide all UI, show tiny subtle hint if cursor is near top-right
      if (this.hoverY >= 0 && this.hoverY < 42) {
        this.drawButton(ctx, 'exit_ambient', INTERNAL_W - 92, 6, 86, 18, '[H] Show UI', {
          onClick: () => { this.ambientMode = false; },
        });
      }
      return;
    }

    this.renderTopHud(ctx, sim);

    if (this.shopOpen) {
      this.renderShopDrawer(ctx, sim);
    }

    if (this.selectedActorId) {
      const actor = sim.getActorById(this.selectedActorId);
      if (actor) {
        this.renderInspectorPanel(ctx, sim, actor);
      } else {
        this.selectedActorId = null;
      }
    }

    this.renderBottomTickerAndToasts(ctx, sim);

    if (this.offlineModal) {
      this.renderOfflineModal(ctx);
    } else if (this.settingsOpen) {
      this.renderSettingsModal(ctx, sim, audioState);
    }

    if (this.hoveredTooltip && !this.settingsOpen && !this.offlineModal) {
      this.renderTooltip(ctx, this.hoveredTooltip);
    }
  }

  renderTitleScreen(ctx, sim, hasAutosave) {
    ctx.fillStyle = rgbaFromPalette(this.pal, 'OUTLINE_WARM', 0.62);
    ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);

    // Canon Portraits framing the Title Plaque!
    const nyahP = this.assets.chars.get('nyah_portrait');
    const fifiP = this.assets.chars.get('fifi_portrait');
    if (nyahP) {
      ctx.drawImage(nyahP, 12, INTERNAL_H - 134, 150, 112);
    }
    if (fifiP) {
      ctx.drawImage(fifiP, INTERNAL_W - 162, INTERNAL_H - 134, 150, 112);
    }

    const woodPanel = this.assets.tavern.get('ui_panel_wood');
    const parchPanel = this.assets.tavern.get('ui_panel_parchment');
    const uiSheet = this.assets.uiSheet;

    const cardW = 288;
    const cardH = hasAutosave ? 228 : 196;
    const cx = Math.floor((INTERNAL_W - cardW) / 2);
    const cy = 44;
    drawNineSlice(ctx, woodPanel, cx, cy, cardW, cardH, 8);
    drawNineSlice(ctx, parchPanel, cx + 10, cy + 10, cardW - 20, 68, 8);

    // Decorative supplied UI medallion accent if loaded
    if (uiSheet) {
      ctx.drawImage(uiSheet, 196, 131, 56, 56, cx + cardW - 42, cy - 16, 28, 28);
    }

    drawPixelText(ctx, "NYAH & FIFI'S", INTERNAL_W / 2, cy + 20, {
      color: this.pal.CLOTH_RED_BASE,
      shadow: this.pal.CREAM_LIGHT,
      scale: 2,
      align: 'center',
    });
    drawPixelText(ctx, 'TAVERN', INTERNAL_W / 2, cy + 40, {
      color: this.pal.OUTLINE_WARM,
      shadow: this.pal.GOLD_LIGHT,
      scale: 2,
      align: 'center',
    });
    drawPixelText(ctx, 'Cozy Fantasy Idle Tavern Simulator', INTERNAL_W / 2, cy + 62, {
      color: this.pal.WOOD_SHADOW,
      scale: 1,
      align: 'center',
    });

    let btnY = cy + 90;
    const btnW = 210;
    const btnX = Math.floor((INTERNAL_W - btnW) / 2);

    if (hasAutosave) {
      this.drawButton(ctx, 'btn_continue', btnX, btnY, btnW, 26, 'Continue Saved Tavern', {
        gold: true,
        onClick: () => {
          this.mode = 'playing';
          this.callbacks.onContinueGame?.();
        },
      });
      btnY += 32;
    }

    this.drawButton(ctx, 'btn_new_intro', btnX, btnY, btnW, 26, 'New Tavern (Story Intro)', {
      gold: !hasAutosave,
      onClick: () => {
        this.mode = 'playing';
        this.callbacks.onStartNewGame?.(true);
      },
    });
    btnY += 32;

    this.drawButton(ctx, 'btn_quick_start', btnX, btnY, btnW, 24, 'Quick Start (Skip Intro)', {
      onClick: () => {
        this.mode = 'playing';
        this.callbacks.onStartNewGame?.(false);
      },
    });
    btnY += 30;

    this.drawButton(ctx, 'btn_title_settings', btnX, btnY, btnW, 22, 'Audio & Save Settings', {
      onClick: () => {
        this.settingsOpen = true;
      },
    });

    drawPixelText(ctx, 'Click any button to start cozy Web Audio synthesizer', INTERNAL_W / 2, INTERNAL_H - 14, {
      color: this.pal.PARCHMENT_LIGHT,
      shadow: this.pal.OUTLINE_WARM,
      scale: 1,
      align: 'center',
    });
  }

  renderStoryIntro(ctx, sim) {
    const beat = sim.banter.getCurrentIntroBeat();
    if (!beat) {
      sim.banter.skipIntro();
      return;
    }

    ctx.fillStyle = rgbaFromPalette(this.pal, 'OUTLINE_WARM', 0.68);
    ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);

    const nyahP = this.assets.chars.get('nyah_portrait');
    const fifiP = this.assets.chars.get('fifi_portrait');
    const isNyah = beat.speaker === 'nyah';
    const isFifi = beat.speaker === 'fifi';

    // Draw both portraits; active speaker steps forward & brightens!
    if (nyahP) {
      ctx.save();
      ctx.globalAlpha = isNyah || !isFifi ? 1.0 : 0.55;
      const ny = isNyah ? 62 : 72;
      ctx.drawImage(nyahP, 36, ny, 225, 168);
      ctx.restore();
    }
    if (fifiP) {
      ctx.save();
      ctx.globalAlpha = isFifi || !isNyah ? 1.0 : 0.55;
      const fy = isFifi ? 62 : 72;
      ctx.drawImage(fifiP, INTERNAL_W - 261, fy, 225, 168);
      ctx.restore();
    }

    // Top bar: Story Intro progress + Skip button
    const woodSkin = this.assets.tavern.get('ui_panel_wood');
    const parchSkin = this.assets.tavern.get('ui_panel_parchment');
    drawNineSlice(ctx, woodSkin, 16, 10, INTERNAL_W - 32, 28, 6);
    const progStr = `PROLOGUE (${beat.index + 1}/${beat.totalBeats})  ~${Math.round(beat.elapsedSec)}s / ${Math.round(beat.totalSec)}s`;
    drawPixelText(ctx, progStr, 28, 20, {
      color: this.pal.PARCHMENT_LIGHT,
      shadow: this.pal.OUTLINE_WARM,
    });

    this.drawButton(ctx, 'btn_skip_intro', INTERNAL_W - 116, 14, 92, 20, 'Skip Intro >>', {
      gold: true,
      onClick: () => {
        sim.banter.skipIntro();
        sim.state.hasSeenIntro = true;
      },
    });

    // Bottom Dialogue Box
    const boxX = 24;
    const boxY = 232;
    const boxW = INTERNAL_W - 48;
    const boxH = 114;
    drawNineSlice(ctx, woodSkin, boxX, boxY, boxW, boxH, 8);
    drawNineSlice(ctx, parchSkin, boxX + 6, boxY + 6, boxW - 12, boxH - 12, 8);

    // Speaker Nameplate
    const spkLabel =
      beat.speaker === 'nyah'
        ? 'NYAH (Head Maid)'
        : beat.speaker === 'fifi'
          ? 'FIFI (Panicking Maid)'
          : 'NARRATOR';
    const plateCol =
      beat.speaker === 'nyah'
        ? this.pal.CLOTH_RED_BASE
        : beat.speaker === 'fifi'
          ? this.pal.CLOTH_ACCENT_BASE
          : this.pal.WOOD_DEEP;

    drawNineSlice(ctx, woodSkin, boxX + 14, boxY - 10, 168, 22, 6);
    drawPixelText(ctx, spkLabel, boxX + 98, boxY - 3, {
      color: this.pal.GOLD_LIGHT,
      shadow: this.pal.OUTLINE_WARM,
      align: 'center',
    });

    if (beat.mood) {
      drawPixelText(ctx, `[${beat.mood.toUpperCase()}]`, boxX + 192, boxY + 14, {
        color: plateCol,
      });
    }

    drawWrappedPixelText(ctx, beat.visibleText, boxX + 18, boxY + 30, boxW - 36, {
      color: this.pal.OUTLINE_WARM,
      scale: 1,
      lineHeight: 12,
      maxLines: 5,
    });

    this.drawButton(ctx, 'btn_next_beat', boxX + boxW - 96, boxY + boxH - 30, 82, 20, 'Next >', {
      onClick: () => {
        const more = sim.banter.advanceIntroBeat();
        if (!more) sim.state.hasSeenIntro = true;
      },
    });
  }

  renderTopHud(ctx, sim) {
    const woodSkin = this.assets.tavern.get('ui_panel_wood');
    drawNineSlice(ctx, woodSkin, 4, 3, INTERNAL_W - 8, 25, 6);

    // Gold
    const coinImg = this.assets.tavern.get('icon_coin');
    if (coinImg) ctx.drawImage(coinImg, 10, 7);
    drawPixelText(ctx, `${Math.floor(sim.gold)}g`, 29, 12, {
      color: this.pal.GOLD_LIGHT,
      shadow: this.pal.OUTLINE_WARM,
    });

    // Reputation
    const repImg = this.assets.tavern.get('icon_rep_star');
    if (repImg) ctx.drawImage(repImg, 92, 7);
    drawPixelText(ctx, `Rep ${sim.reputation.toFixed(0)}`, 111, 12, {
      color: this.pal.CREAM_LIGHT,
      shadow: this.pal.OUTLINE_WARM,
    });

    // Tavern Tier & Ambience
    drawPixelText(ctx, `Tier ${sim.layout.tavernTier} | Amb ${sim.ambience}`, 182, 12, {
      color: this.pal.PARCHMENT_LIGHT,
      shadow: this.pal.OUTLINE_WARM,
    });

    // Day & Phase Clock
    const phaseLabel = sim.dayPhase.charAt(0).toUpperCase() + sim.dayPhase.slice(1);
    drawPixelText(ctx, `D${sim.state.dayNumber} ${phaseLabel}`, 304, 12, {
      color: sim.dayPhase === 'night' ? this.pal.CLOTH_ACCENT_LIGHT : this.pal.FLAME_YELLOW,
      shadow: this.pal.OUTLINE_WARM,
    });

    // Musician live badge
    if (sim.isMusicianPerforming) {
      const mIcon = this.assets.tavern.get('emote_music');
      if (mIcon) ctx.drawImage(mIcon, 392, 7);
    }

    // Speed Button (`1x` -> `2x` -> `4x`)
    const nextSpeed = this.speedMultiplier === 1 ? 2 : this.speedMultiplier === 2 ? 4 : 1;
    this.drawButton(ctx, 'btn_speed', 416, 6, 40, 19, `${this.speedMultiplier}x`, {
      active: this.speedMultiplier > 1,
      onClick: () => { this.speedMultiplier = nextSpeed; },
      tooltip: { title: 'Sim Speed', body: 'Toggle 1x / 2x / 4x tavern speed.' },
    });

    // Camera Recenter
    this.drawButton(ctx, 'btn_cam_center', 459, 6, 38, 19, 'Cam', {
      onClick: () => { this.callbacks.onFocusRoom?.('center'); },
      tooltip: { title: 'Center Camera', body: 'Drag canvas or use WASD/Arrows to pan across rooms.' },
    });

    // Ambient Mode `[H]`
    this.drawButton(ctx, 'btn_ambient', 500, 6, 34, 19, '[H]', {
      onClick: () => { this.ambientMode = true; },
      tooltip: { title: 'Ambient Mode (H)', body: 'Hide all UI panels to watch the cozy tavern.' },
    });

    // Settings Modal
    this.drawButton(ctx, 'btn_settings', 537, 6, 42, 19, 'Menu', {
      onClick: () => { this.settingsOpen = !this.settingsOpen; },
      tooltip: { title: 'Settings & Save', body: 'Audio sliders, FPS cap, atmosphere & save export.' },
    });

    // Shop Toggle
    this.drawButton(ctx, 'btn_shop_toggle', 582, 6, 50, 19, this.shopOpen ? 'Hide' : 'Shop', {
      gold: !this.shopOpen,
      onClick: () => { this.shopOpen = !this.shopOpen; },
    });
  }

  renderShopDrawer(ctx, sim) {
    const px = 406;
    const py = 31;
    const pw = 230;
    const ph = 325;

    const woodSkin = this.assets.tavern.get('ui_panel_wood');
    const parchSkin = this.assets.tavern.get('ui_panel_parchment');
    drawNineSlice(ctx, woodSkin, px, py, pw, ph, 8);

    // 5 Category Tabs across top
    const tabW = 43;
     SHOP_TABS.forEach((t, idx) => {
      const tx = px + 6 + idx * (tabW + 1);
      const isAct = this.activeTab === t.id;
      this.drawButton(ctx, `tab_${t.id}`, tx, py + 5, tabW, 20, t.label, {
        active: isAct,
        onClick: () => {
          this.activeTab = t.id;
          this.shopScroll = 0;
          this.callbacks.onPlaySfx?.('ui_tab');
        },
      });
    });

    // List viewport
    const listX = px + 7;
    const listY = py + 29;
    const listW = pw - 14;
    const listH = ph - 36;
    drawNineSlice(ctx, parchSkin, listX, listY, listW, listH, 8);

    // Architectural Exterior Facade Banner (`facade_t1..t4`) on Building tab (A4)
    let headerOffset = 0;
    if (this.activeTab === 'building') {
      const facadeImg = this.assets.tavern.get(sim.layout.facadeAsset);
      if (facadeImg) {
        headerOffset = 34;
        ctx.fillStyle = rgbaFromPalette(this.pal, 'OUTLINE_WARM', 0.16);
        ctx.fillRect(listX + 5, listY + 5, listW - 10, 30);
        ctx.drawImage(facadeImg, listX + 8, listY + 6, 48, 28);
        drawPixelText(ctx, `Exterior: Tier ${sim.layout.tavernTier}`, listX + 62, listY + 10, {
          color: this.pal.OUTLINE_WARM,
        });
        drawPixelText(ctx, `${sim.state.unlockedRooms.size}/6 Wings Built`, listX + 62, listY + 21, {
          color: this.pal.WOOD_SHADOW,
        });
      }
    }

    const items = this.buildShopItemsForTab(sim, this.activeTab);
    const cardH = headerOffset > 0 ? 55 : 64;
    const gap = headerOffset > 0 ? 4 : 5;
    const stepH = cardH + gap;
    const viewTop = listY + 4 + headerOffset;
    const viewH = listH - 8 - headerOffset;
    const totalContentH = Math.max(0, items.length * stepH - gap + 4);
    this.maxShopScroll = Math.max(0, totalContentH - viewH);
    this.shopScroll = Math.min(this.shopScroll, this.maxShopScroll);

    ctx.save();
    ctx.beginPath();
    ctx.rect(listX + 3, viewTop, listW - 6, viewH);
    ctx.clip();

    items.forEach((item, idx) => {
      const cy = Math.round(viewTop + 2 + idx * stepH - this.shopScroll);
      if (cy + cardH < viewTop || cy > viewTop + viewH) return;
      const cx = listX + 5;
      const cw = listW - (this.maxShopScroll > 0 ? 18 : 10);

      // Card background
      ctx.fillStyle = item.ownedMax
        ? rgbaFromPalette(this.pal, 'PARCHMENT_SHADOW', 0.45)
        : rgbaFromPalette(this.pal, 'CREAM_LIGHT', 0.65);
      ctx.fillRect(cx, cy, cw, cardH);
      ctx.strokeStyle = item.canBuy ? this.pal.GOLD_BASE : this.pal.WOOD_LIGHT;
      ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, cardH - 1);

      // Icon
      const iconImg = this.assets.tavern.get(item.icon);
      if (iconImg) {
        ctx.drawImage(iconImg, cx + 4, cy + 5);
      }

      // Title on top-left + Dedicated Level/Tier badge on top-right (A5: zero title truncation!)
      drawPixelText(ctx, item.title, cx + 23, cy + 4, {
        color: this.pal.OUTLINE_WARM,
      });
      if (item.levelBadge) {
        drawPixelText(ctx, item.levelBadge, cx + cw - 4, cy + 4, {
          color: this.pal.CLOTH_RED_BASE,
          align: 'right',
        });
      }

      // 2-line wrapped description (A5: complete sentences, zero mid-word clipping!)
      drawWrappedPixelText(ctx, item.subline, cx + 23, cy + 15, cw - 26, {
        color: this.pal.WOOD_SHADOW,
        lineHeight: 9,
        maxLines: 2,
      });

      const bottomRowY = cy + cardH - 16;
      if (item.ownedMax) {
        drawPixelText(ctx, item.doneBadge || 'OWNED', cx + cw - 6, bottomRowY, {
          color: this.pal.LEAF_SHADOW,
          align: 'right',
        });
      } else {
        if (item.reqNote) {
          drawPixelText(ctx, item.reqNote, cx + 5, bottomRowY, {
            color: this.pal.CLOTH_RED_BASE,
          });
        }
        const btnW = 62;
        this.drawButton(ctx, `buy_${item.id}`, cx + cw - btnW - 4, cy + cardH - 21, btnW, 17, `${item.cost}g`, {
          gold: item.canBuy,
          disabled: !item.canBuy,
          onClick: item.onBuy,
          tooltip: item.tooltip,
        });
      }

      // Hovering anywhere on card shows tooltip
      this.addHit(`hover_${item.id}`, cx, cy, cw - 68, cardH, null, item.tooltip);
    });

    ctx.restore();

    // Scroll buttons if needed
    if (this.maxShopScroll > 0) {
      const sbX = listX + listW - 13;
      this.drawButton(ctx, 'scroll_up', sbX, viewTop + 1, 10, 18, '^', {
        disabled: this.shopScroll <= 0,
        onClick: () => { this.shopScroll = Math.max(0, this.shopScroll - stepH); },
      });
      this.drawButton(ctx, 'scroll_dn', sbX, viewTop + viewH - 19, 10, 18, 'v', {
        disabled: this.shopScroll >= this.maxShopScroll,
        onClick: () => { this.shopScroll = Math.min(this.maxShopScroll, this.shopScroll + stepH); },
      });
    }
  }

  _shortReqLabel(sim, reqId, repReq) {
    const shortNames = {
      exp_kitchen: 'Kitchen Wing',
      exp_counter_shop: 'Supply Shop',
      exp_main_hall: 'Timber Hall',
      exp_upstairs: 'Upstairs Wing',
      exp_cellar: 'Wine Cellar',
      exp_stage: 'Bard Stage',
      exp_garden: 'Garden Patio',
      table_tier_2: 'Pine Tables',
      table_tier_3: 'Oak Tables',
      hire_maid_clover: 'Hire Clover',
      hire_maid_roxie: 'Hire Roxie',
      hire_maid_pippa: 'Hire Pippa',
      decor_candles: 'Candles',
      decor_hearth: 'Hearth Logs',
      decor_rug_red: 'Red Runner',
      decor_herbs: 'Herb Bundles',
      decor_plants: 'Potted Ferns',
      decor_banners: 'Guild Banners',
      decor_rug_accent: 'Oasis Carpet',
      decor_painting: 'Oil Painting',
      decor_armor: 'Plate Armor',
      decor_trophy: 'Wyvern Trophy',
    };
    if (reqId && !sim.isUpgradeOwned(reqId)) {
      return `Req: ${shortNames[reqId] || reqId}`;
    }
    if ((repReq || 0) > sim.reputation) {
      return `Req: ${repReq} Rep`;
    }
    return '';
  }

  _conciseUpgradeSubline(sim, u) {
    const eff = u.effect || {};
    switch (u.id) {
      case 'add_table':
        return `Add a 2-to-4 seat dining table (${sim.layout.tables.length}/${sim.layout.maxTableSlots} placed).`;
      case 'train_maids':
        return `Maid speed +5%/lv (Now ${Math.round(sim.maidSpeedMult * 100)}%).`;
      case 'train_chefs':
        return `Cooking speed +5%/lv (Now ${Math.round(sim.chefSpeedMult * 100)}%).`;
      case 'decor_polish':
        return `Beeswax shine: +1 Ambience/lv (Now ${sim.ambience}).`;
      case 'town_crier':
        return `Arrival rate +6%/lv (Now +${Math.round((sim.patronSpawnMult - 1) * 100)}%).`;
      case 'table_tier_2':
        return '3 seats/table +14% meal value.';
      case 'table_tier_3':
        return '4 seats/table +28% meal value.';
      case 'table_tier_4':
        return '4 royal seats +42% meal value.';
      case 'bed_tier_2':
        return 'Doubles overnight room rental fees.';
      default:
        break;
    }
    if (u.kind === 'expansion') {
      const expSummaries = {
        exp_kitchen: 'Unlocks commercial kitchen & Tier 2-4 dishes.',
        exp_counter_shop: 'Unlocks quest board, potions & Veteran guests.',
        exp_main_hall: 'Doubles main floor capacity & Merchant guests.',
        exp_upstairs: 'Adds 4 upstairs lodging beds & Noble guests.',
        exp_cellar: 'Adds underground vault & +20% drink value.',
        exp_stage: 'Unlocks performance stage for Lyra & Soleil.',
        exp_garden: 'Opens outdoor garden patio & +12 Ambience.',
      };
      return expSummaries[u.id] || 'Major tavern architectural expansion.';
    }
    if (u.kind === 'staff_hire') {
      const staffSummaries = {
        hire_maid_clover: 'Fast junior bunny maid (+5% tips).',
        hire_maid_roxie: 'Bold catgirl maid (+10% tips).',
        hire_chef_marcel: 'Sous-chef doubling kitchen output.',
        hire_bartender_garrett: 'Dedicated barkeep for all drink orders.',
        hire_maid_pippa: 'Cheerful fox maid (+16% tips).',
        hire_maid_velvet: 'Aristocratic elf maid (+25% tips).',
        hire_musician_lyra: 'Plays live harp stem & slows mood decay.',
        hire_dancer_soleil: 'Stage ribbon dancer (+20% patron tips).',
      };
      return staffSummaries[u.id] || 'Hire unique tavern staff member.';
    }
    if (eff.type === 'ambience_bonus') {
      return `Cozy tavern decor (+${eff.value} Ambience).`;
    }
    return u.desc;
  }

  buildShopItemsForTab(sim, tabId) {
    if (tabId === 'menu') {
      return sim.data.recipes.recipes.map((r) => {
        const unlocked = sim.state.unlockedRecipes.has(r.id);
        const reason = sim.getRecipeBlockReason(r);
        const canBuy = reason === null;
        const cardTitle =
          r.id === 'bread_cheese'
            ? 'Crusty Bread & Cheddar'
            : r.id === 'hunter_pie'
              ? "Hunter's Venison Pie"
              : r.name;
        return {
          id: r.id,
          icon: r.icon,
          title: cardTitle,
          levelBadge: `T${r.tier}`,
          subline: `${r.category.toUpperCase()} (${r.station}) | Sells ${r.price}g | Cook ${r.cookTime}s`,
          cost: r.unlockCost,
          canBuy,
          ownedMax: unlocked,
          doneBadge: 'SERVING',
          reqNote: !unlocked ? this._shortReqLabel(sim, r.requiredExpansion, r.repRequired) : '',
          onBuy: () => {
            if (sim.unlockRecipe(r.id)) {
              this.callbacks.onPlaySfx?.('upgrade');
              this.pushToast('Recipe Unlocked!', `${r.name} (${r.price}g) is now on the menu!`);
            }
          },
          tooltip: {
            title: `${r.name} (Tier ${r.tier})`,
            body: `${r.desc} Sells for ${r.price}g at ${r.station}.${reason && !unlocked ? ' [' + reason + ']' : ''}`,
          },
        };
      });
    }

    const upgrades = sim.data.upgrades.upgrades.filter((u) => u.tab === tabId);
    return upgrades.map((u) => {
      const lv = sim.getUpgradeLevel(u.id);
      const maxed = lv >= u.maxLevel;
      const cost = sim.getUpgradeCost(u);
      const reason = sim.getUpgradeBlockReason(u);
      const canBuy = reason === null;
      const lvBadge = u.maxLevel > 1 ? `${lv}/${u.maxLevel}` : '';
      let reqShort = '';
      if (!maxed) {
        if (u.effect?.type === 'add_table' && (2 + lv) >= sim.layout.maxTableSlots) {
          reqShort = 'Expand for space';
        } else {
          reqShort = this._shortReqLabel(sim, u.requires, u.repRequired);
        }
      }
      return {
        id: u.id,
        icon: u.icon,
        title: u.name,
        levelBadge: lvBadge,
        subline: this._conciseUpgradeSubline(sim, u),
        cost,
        canBuy,
        ownedMax: maxed,
        doneBadge: u.kind === 'staff_hire' ? 'HIRED' : 'BUILT',
        reqNote: reqShort,
        onBuy: () => {
          if (sim.buyUpgrade(u.id)) {
            if (u.kind === 'expansion') {
              this.callbacks.onPlaySfx?.('expansion_fanfare');
              const roomVal = u.effect?.value || 'center';
              this.callbacks.onFocusRoom?.(roomVal);
              this.pushToast(`NEW WING: ${u.name}!`, u.nyahComment || 'The tavern grows grander!');
            } else {
              this.callbacks.onPlaySfx?.('upgrade');
              if (u.nyahComment) {
                this.pushToast(`Nyah on ${u.name}:`, u.nyahComment);
              }
            }
          }
        },
        tooltip: {
          title: `${u.name}${lvBadge ? ' (' + lvBadge + ')' : ''}`,
          body: `${u.desc}${reason && !maxed ? ' [' + reason + ']' : ''}`,
          quote: u.nyahComment ? `Nyah: "${u.nyahComment}"` : null,
        },
      };
    });
  }

  renderInspectorPanel(ctx, sim, actor) {
    const snap = actor.getInspectorSnapshot(sim);
    const px = 4;
    const py = 31;
    const pw = 220;
    const ph = 325;

    const woodSkin = this.assets.tavern.get('ui_panel_wood');
    const parchSkin = this.assets.tavern.get('ui_panel_parchment');
    drawNineSlice(ctx, woodSkin, px, py, pw, ph, 8);
    drawNineSlice(ctx, parchSkin, px + 6, py + 6, pw - 12, ph - 12, 8);

    // Close Inspector button
    this.drawButton(ctx, 'close_inspector', px + pw - 24, py + 8, 16, 15, 'X', {
      onClick: () => { this.selectedActorId = null; },
    });

    // Bust / Portrait Frame (`56x56`)
    const bx = px + 10;
    const by = py + 10;
    ctx.fillStyle = this.pal.WOOD_DEEP;
    ctx.fillRect(bx, by, 56, 56);
    ctx.strokeStyle = this.pal.GOLD_BASE;
    ctx.strokeRect(bx + 0.5, by + 0.5, 55, 55);

    if (snap.isCanon) {
      const pImg = this.assets.chars.get(`${actor.id}_portrait`);
      if (pImg) {
        // Crop upper-center face/bust region cleanly
        ctx.drawImage(pImg, 44, 8, 192, 192, bx + 2, by + 2, 52, 52);
      }
    } else {
      const bustImg = this.assets.npcs.get(`${snap.spriteKey}_bust`);
      if (bustImg) {
        ctx.drawImage(bustImg, 6, 4, 52, 52, bx + 2, by + 2, 52, 52);
      }
    }

    // Header Bio Stats
    drawPixelText(ctx, snap.name.slice(0, 19), bx + 62, by + 2, {
      color: this.pal.OUTLINE_WARM,
    });
    drawPixelText(ctx, snap.role.slice(0, 22), bx + 62, by + 13, {
      color: this.pal.CLOTH_RED_BASE,
    });
    drawPixelText(ctx, `Lv.${snap.level} | ${snap.gold}g | ${snap.quirk}`, bx + 62, by + 24, {
      color: this.pal.WOOD_SHADOW,
    });

    // Mood Label + Pixel Bar
    drawPixelText(ctx, `Mood: ${snap.moodLabel} (${snap.mood}%)`, bx + 62, by + 36, {
      color: this.pal.OUTLINE_WARM,
    });
    const barW = 128;
    ctx.fillStyle = this.pal.OUTLINE_WARM;
    ctx.fillRect(bx + 62, by + 46, barW, 7);
    const fillW = Math.round((barW - 2) * Math.max(0, Math.min(100, snap.mood)) / 100);
    ctx.fillStyle =
      snap.mood >= 70 ? this.pal.LEAF_LIGHT : snap.mood >= 45 ? this.pal.GOLD_LIGHT : this.pal.POTION_RED;
    ctx.fillRect(bx + 63, by + 47, fillW, 5);

    let curY = by + 62;
    drawPixelText(ctx, `Now: ${snap.activity.slice(0, 28)}`, px + 11, curY, {
      color: this.pal.CLOTH_ACCENT_SHADOW,
    });
    curY += 11;
    drawPixelText(ctx, `Fav: ${snap.favoriteDish.slice(0, 28)}`, px + 11, curY, {
      color: this.pal.WOOD_DEEP,
    });
    curY += 13;

    // Live Thought Card
    ctx.fillStyle = rgbaFromPalette(this.pal, 'CREAM_LIGHT', 0.8);
    ctx.fillRect(px + 10, curY, pw - 20, 34);
    ctx.strokeStyle = this.pal.PARCHMENT_SHADOW;
    ctx.strokeRect(px + 10.5, curY + 0.5, pw - 21, 33);
    drawWrappedPixelText(ctx, `"${snap.liveThought}"`, px + 14, curY + 5, pw - 28, {
      color: this.pal.OUTLINE_WARM,
      lineHeight: 9,
      maxLines: 3,
    });
    curY += 39;

    // 5 Opinions (2-line wrapped so full thoughts are readable)
    drawPixelText(ctx, 'OPINIONS:', px + 11, curY, { color: this.pal.CLOTH_RED_SHADOW });
    curY += 10;
    const opRows = [
      ['Tavern', snap.opinions.tavern],
      ['Food', snap.opinions.food],
      ['Prices', snap.opinions.prices],
      ['Nyah', snap.opinions.nyah],
      ['Fifi', snap.opinions.fifi],
    ];
    for (const [topic, text] of opRows) {
      const used = drawWrappedPixelText(ctx, `${topic}: ${text}`, px + 11, curY, pw - 22, {
        color: this.pal.OUTLINE_WARM,
        lineHeight: 8,
        maxLines: 2,
      });
      curY += used + 3;
    }

    curY += 2;
    drawPixelText(ctx, 'RECENT EVENTS:', px + 11, curY, { color: this.pal.CLOTH_RED_SHADOW });
    curY += 9;
    for (const ev of snap.recentEvents.slice(0, 3)) {
      drawPixelText(ctx, `- ${ev.slice(0, 32)}`, px + 11, curY, {
        color: this.pal.WOOD_SHADOW,
      });
      curY += 9;
    }
  }

  renderBottomTickerAndToasts(ctx, sim) {
    const leftBound = this.selectedActorId ? 228 : 6;
    const rightBound = this.shopOpen ? 402 : INTERNAL_W - 6;
    const availW = rightBound - leftBound;
    if (availW < 120) return;

    const woodSkin = this.assets.tavern.get('ui_panel_wood');

    // Toast popup above ticker
    if (this.toasts.length > 0) {
      const t = this.toasts[0];
      const th = 30;
      const ty = INTERNAL_H - 60;
      drawNineSlice(ctx, woodSkin, leftBound, ty, availW, th, 6);
      drawPixelText(ctx, t.title.slice(0, 32), leftBound + 6, ty + 5, {
        color: this.pal.GOLD_LIGHT,
        shadow: this.pal.OUTLINE_WARM,
      });
      drawPixelText(ctx, t.text.slice(0, Math.floor((availW - 12) / 6)), leftBound + 6, ty + 16, {
        color: this.pal.CREAM_LIGHT,
        shadow: this.pal.OUTLINE_WARM,
      });
    }

    // Latest Banter Line Ticker
    const latest = sim.banter.currentBeat || sim.banter.history[0];
    if (latest) {
      const ty = INTERNAL_H - 26;
      drawNineSlice(ctx, woodSkin, leftBound, ty, availW, 22, 6);
      const spk = String(latest.speaker || 'nyah').toUpperCase();
      const maxChars = Math.max(12, Math.floor((availW - 14) / 6));
      const fullLine = `${spk}: ${latest.text}`;
      const clipped = fullLine.length > maxChars ? fullLine.slice(0, maxChars - 2) + '..' : fullLine;
      drawPixelText(ctx, clipped, leftBound + 7, ty + 8, {
        color: spk === 'NYAH' ? this.pal.GOLD_LIGHT : spk === 'FIFI' ? this.pal.CREAM_LIGHT : this.pal.PARCHMENT_LIGHT,
        shadow: this.pal.OUTLINE_WARM,
      });
    }
  }

  renderOfflineModal(ctx) {
    const m = this.offlineModal;
    if (!m) return;
    ctx.fillStyle = rgbaFromPalette(this.pal, 'OUTLINE_WARM', 0.65);
    ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);

    const woodSkin = this.assets.tavern.get('ui_panel_wood');
    const parchSkin = this.assets.tavern.get('ui_panel_parchment');
    const mw = 360;
    const mh = 216;
    const mx = Math.floor((INTERNAL_W - mw) / 2);
    const my = Math.floor((INTERNAL_H - mh) / 2);

    drawNineSlice(ctx, woodSkin, mx, my, mw, mh, 8);
    drawNineSlice(ctx, parchSkin, mx + 8, my + 8, mw - 16, mh - 16, 8);

    drawPixelText(ctx, 'WHILE YOU WERE AWAY', INTERNAL_W / 2, my + 18, {
      color: this.pal.CLOTH_RED_BASE,
      scale: 2,
      align: 'center',
    });
    drawPixelText(
      ctx,
      `Away ${m.minutes} min | Served ${m.customers} guests | Earned +${m.gold}g`,
      INTERNAL_W / 2,
      my + 42,
      { color: this.pal.WOOD_DEEP, align: 'center' }
    );

    drawPixelText(ctx, 'NYAH:', mx + 18, my + 60, { color: this.pal.CLOTH_RED_SHADOW });
    drawWrappedPixelText(ctx, `"${m.nyahText}"`, mx + 18, my + 71, mw - 36, {
      color: this.pal.OUTLINE_WARM,
      lineHeight: 10,
      maxLines: 4,
    });

    drawPixelText(ctx, 'FIFI:', mx + 18, my + 120, { color: this.pal.CLOTH_ACCENT_SHADOW });
    drawWrappedPixelText(ctx, `"${m.fifiText}"`, mx + 18, my + 131, mw - 36, {
      color: this.pal.OUTLINE_WARM,
      lineHeight: 10,
      maxLines: 4,
    });

    this.drawButton(ctx, 'btn_collect_offline', INTERNAL_W / 2 - 64, my + mh - 34, 128, 22, `Collect +${m.gold}g`, {
      gold: true,
      onClick: () => {
        this.callbacks.onPlaySfx?.('coin');
        this.offlineModal = null;
      },
    });
  }

  renderSettingsModal(ctx, sim, audioState) {
    ctx.fillStyle = rgbaFromPalette(this.pal, 'OUTLINE_WARM', 0.62);
    ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);

    const woodSkin = this.assets.tavern.get('ui_panel_wood');
    const parchSkin = this.assets.tavern.get('ui_panel_parchment');
    const mw = 336;
    const mh = 256;
    const mx = Math.floor((INTERNAL_W - mw) / 2);
    const my = Math.floor((INTERNAL_H - mh) / 2);

    drawNineSlice(ctx, woodSkin, mx, my, mw, mh, 8);
    drawNineSlice(ctx, parchSkin, mx + 8, my + 8, mw - 16, mh - 16, 8);

    drawPixelText(ctx, 'TAVERN SETTINGS & SAVE', INTERNAL_W / 2, my + 18, {
      color: this.pal.OUTLINE_WARM,
      align: 'center',
    });

    this.drawButton(ctx, 'close_settings', mx + mw - 28, my + 12, 18, 16, 'X', {
      onClick: () => { this.settingsOpen = false; },
    });

    const drawStepRow = (label, valPct, yPos, onDec, onInc) => {
      drawPixelText(ctx, `${label}: ${Math.round(valPct * 100)}%`, mx + 20, yPos + 5, {
        color: this.pal.OUTLINE_WARM,
      });
      this.drawButton(ctx, `dec_${label}`, mx + 190, yPos, 24, 17, '-', { onClick: onDec });
      // Bar
      ctx.fillStyle = this.pal.WOOD_DEEP;
      ctx.fillRect(mx + 218, yPos + 4, 68, 9);
      ctx.fillStyle = this.pal.GOLD_LIGHT;
      ctx.fillRect(mx + 219, yPos + 5, Math.round(66 * valPct), 7);
      this.drawButton(ctx, `inc_${label}`, mx + 290, yPos, 24, 17, '+', { onClick: onInc });
    };

    const masterV = audioState.masterVolume ?? 0.75;
    const musicV = audioState.musicVolume ?? 0.70;
    const sfxV = audioState.sfxVolume ?? 0.85;
    const muted = Boolean(audioState.muted);

    drawStepRow(
      'Master Vol',
      masterV,
      my + 38,
      () => this.callbacks.onSettingsChange?.({ masterVolume: Math.max(0, Math.round((masterV - 0.1) * 10) / 10) }),
      () => this.callbacks.onSettingsChange?.({ masterVolume: Math.min(1, Math.round((masterV + 0.1) * 10) / 10) })
    );
    drawStepRow(
      'Music Vol',
      musicV,
      my + 60,
      () => this.callbacks.onSettingsChange?.({ musicVolume: Math.max(0, Math.round((musicV - 0.1) * 10) / 10) }),
      () => this.callbacks.onSettingsChange?.({ musicVolume: Math.min(1, Math.round((musicV + 0.1) * 10) / 10) })
    );
    drawStepRow(
      'SFX Vol',
      sfxV,
      my + 82,
      () => this.callbacks.onSettingsChange?.({ sfxVolume: Math.max(0, Math.round((sfxV - 0.1) * 10) / 10) }),
      () => this.callbacks.onSettingsChange?.({ sfxVolume: Math.min(1, Math.round((sfxV + 0.1) * 10) / 10) })
    );

    // Toggle row: Mute, Atmosphere, FPS Cap
    this.drawButton(ctx, 'tog_mute', mx + 20, my + 108, 92, 20, muted ? 'Audio: MUTED' : 'Audio: ON', {
      active: !muted,
      onClick: () => this.callbacks.onSettingsChange?.({ muted: !muted }),
    });
    const atmo = Boolean(audioState.atmosphereEnabled ?? true);
    this.drawButton(ctx, 'tog_atmo', mx + 120, my + 108, 96, 20, atmo ? 'Atmo FX: ON' : 'Atmo FX: OFF', {
      active: atmo,
      onClick: () => this.callbacks.onSettingsChange?.({ atmosphereEnabled: !atmo }),
    });
    this.drawButton(ctx, 'tog_fps', mx + 224, my + 108, 90, 20, `Cap: ${this.fpsCap} FPS`, {
      active: this.fpsCap === 30,
      onClick: () => {
        this.fpsCap = this.fpsCap === 60 ? 30 : 60;
        this.callbacks.onSettingsChange?.({ fpsCap: this.fpsCap });
      },
    });

    // Camera Quick-Jumps
    drawPixelText(ctx, 'Camera Jump:', mx + 20, my + 140, { color: this.pal.WOOD_SHADOW });
    const jumps = [
      ['Hall', 'center'],
      ['Kitchen', 'kitchen'],
      ['Rooms', 'upstairs'],
      ['Stage', 'stage'],
    ];
    jumps.forEach(([lbl, key], i) => {
      this.drawButton(ctx, `jmp_${key}`, mx + 98 + i * 54, my + 135, 50, 18, lbl, {
        onClick: () => {
          this.callbacks.onFocusRoom?.(key);
          this.settingsOpen = false;
        },
      });
    });

    // Save Controls
    this.drawButton(ctx, 'btn_save_now', mx + 20, my + 166, 92, 22, 'Save Now', {
      gold: true,
      onClick: () => {
        this.callbacks.onSaveNow?.();
        this.pushToast('Autosave', 'Tavern progress saved locally!');
      },
    });
    this.drawButton(ctx, 'btn_exp_imp', mx + 120, my + 166, 102, 22, 'Export/Import', {
      onClick: () => {
        this.callbacks.onOpenSaveDialog?.();
      },
    });
    this.drawButton(ctx, 'btn_replay_intro', mx + 228, my + 166, 86, 22, 'Story Intro', {
      onClick: () => {
        this.settingsOpen = false;
        this.mode = 'playing';
        sim.banter.startIntro();
      },
    });

    this.drawButton(ctx, 'btn_reset_save', mx + 20, my + 196, 118, 20, 'Reset Save Data', {
      onClick: () => {
        this.callbacks.onResetSave?.();
        this.settingsOpen = false;
      },
    });

    drawPixelText(
      ctx,
      `Served: ${sim.stats.customersServed} | Rooms: ${sim.stats.roomsRented}`,
      mx + 148,
      my + 202,
      { color: this.pal.WOOD_SHADOW }
    );
  }

  renderTooltip(ctx, tip) {
    const woodSkin = this.assets.tavern.get('ui_panel_wood');
    const tw = 196;
    const bodyLines = Math.ceil((tip.body || '').length / 30);
    const quoteLines = tip.quote ? Math.ceil(tip.quote.length / 30) : 0;
    const th = 24 + bodyLines * 9 + (quoteLines > 0 ? quoteLines * 9 + 6 : 0);

    let tx = this.hoverX - tw - 8;
    if (tx < 6) tx = this.hoverX + 12;
    let ty = Math.min(INTERNAL_H - th - 6, Math.max(32, this.hoverY - 10));

    drawNineSlice(ctx, woodSkin, tx, ty, tw, th, 6);
    drawPixelText(ctx, (tip.title || '').slice(0, 30), tx + 7, ty + 6, {
      color: this.pal.GOLD_LIGHT,
      shadow: this.pal.OUTLINE_WARM,
    });
    const usedH = drawWrappedPixelText(ctx, tip.body || '', tx + 7, ty + 17, tw - 14, {
      color: this.pal.CREAM_LIGHT,
      shadow: this.pal.OUTLINE_WARM,
      lineHeight: 9,
      maxLines: 5,
    });
    if (tip.quote) {
      drawWrappedPixelText(ctx, tip.quote, tx + 7, ty + 20 + usedH, tw - 14, {
        color: this.pal.PARCHMENT_LIGHT,
        shadow: this.pal.OUTLINE_WARM,
        lineHeight: 9,
        maxLines: 3,
      });
    }
  }
}
