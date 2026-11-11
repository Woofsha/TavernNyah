// Integer-scaled 640x360 2.5D Pixel-Art Diorama Renderer.
// Nearest-neighbor only, whole-pixel camera & draw coords, Y-sorting by footY,
// dynamic contact shadows, canon sprite fallbacks, and toggleable cozy atmosphere.

import { drawPixelText, drawWrappedPixelText, wrapPixelText } from './font.js';

export const INTERNAL_W = 640;
export const INTERNAL_H = 360;

export function hexToRgb(hexStr) {
  const clean = String(hexStr || '').replace(/[^0-9a-fA-F]/g, '');
  if (clean.length !== 6) return [43, 26, 18];
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbaFromPalette(paletteColors, key, alpha = 1.0) {
  const [r, g, b] = hexToRgb(paletteColors[key]);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function drawNineSlice(ctx, img, x, y, w, h, corner = 8) {
  if (!img) return;
  const dx = Math.round(x);
  const dy = Math.round(y);
  const dw = Math.max(corner * 2, Math.round(w));
  const dh = Math.max(corner * 2, Math.round(h));
  const sw = img.width;
  const sh = img.height;
  const c = corner;
  const scw = sw - c * 2;
  const sch = sh - c * 2;
  const dcw = dw - c * 2;
  const dch = dh - c * 2;

  // Corners
  ctx.drawImage(img, 0, 0, c, c, dx, dy, c, c);
  ctx.drawImage(img, sw - c, 0, c, c, dx + dw - c, dy, c, c);
  ctx.drawImage(img, 0, sh - c, c, c, dx, dy + dh - c, c, c);
  ctx.drawImage(img, sw - c, sh - c, c, c, dx + dw - c, dy + dh - c, c, c);

  // Edges
  if (dcw > 0) {
    ctx.drawImage(img, c, 0, scw, c, dx + c, dy, dcw, c);
    ctx.drawImage(img, c, sh - c, scw, c, dx + c, dy + dh - c, dcw, c);
  }
  if (dch > 0) {
    ctx.drawImage(img, 0, c, c, sch, dx, dy + c, c, dch);
    ctx.drawImage(img, sw - c, c, c, sch, dx + dw - c, dy + c, c, dch);
  }
  // Center
  if (dcw > 0 && dch > 0) {
    ctx.drawImage(img, c, c, scw, sch, dx + c, dy + c, dcw, dch);
  }
}

export class TavernRenderer {
  constructor(canvas, assets, paletteData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.assets = assets; // { tavern: Map, npcs: Map, chars: Map, uiSheet: Image }
    this.pal = paletteData.colors;

    this.scale = 1;
    this.camX = 84;
    this.camY = 92;
    this.atmosphereEnabled = true;
    this.animClock = 0;

    // Pre-assemble multi-slice rugs onto offscreen canvases
    this.assembledRugs = new Map();
    this._assembleRug('rug_red');
    this._assembleRug('rug_accent');

    // Pre-bake stepped pixel contact shadow & warm light-pool stamps for zero-GC crispness
    this.shadowCache = new Map();
    this.lightStampSmall = this._createLightStamp(44);
    this.lightStampLarge = this._createLightStamp(78);

    // Reusable atmosphere particle pools (zero allocations per frame!)
    this.dustMotes = Array.from({ length: 28 }, (_, i) => ({
      x: (i * 73) % INTERNAL_W,
      y: (i * 47) % INTERNAL_H,
      vx: 2.5 + (i % 4) * 0.8,
      vy: -1.2 + (i % 3) * 0.9,
      phase: i * 0.6,
      size: i % 5 === 0 ? 2 : 1,
    }));

    this.particles = Array.from({ length: 40 }, () => ({
      active: false,
      kind: 'ember', // 'ember' | 'steam'
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
    }));
    this.particleCursor = 0;
    this.emitAccum = 0;
  }

  _assembleRug(prefix) {
    const tl = this.assets.tavern.get(`${prefix}_tl`);
    const tr = this.assets.tavern.get(`${prefix}_tr`);
    const bl = this.assets.tavern.get(`${prefix}_bl`);
    const br = this.assets.tavern.get(`${prefix}_br`);
    if (!tl || !tr || !bl || !br || typeof document === 'undefined') return;
    const c = document.createElement('canvas');
    c.width = tl.width + tr.width;
    c.height = tl.height + br.height;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(tl, 0, 0);
    g.drawImage(tr, tl.width, 0);
    g.drawImage(bl, 0, tl.height);
    g.drawImage(br, tl.width, tl.height);
    this.assembledRugs.set(prefix, c);
  }

  _getShadowStamp(rx, ry) {
    const key = `${rx}x${ry}`;
    let stamp = this.shadowCache.get(key);
    if (stamp || typeof document === 'undefined') return stamp;
    stamp = document.createElement('canvas');
    stamp.width = rx * 2 + 2;
    stamp.height = ry * 2 + 2;
    const g = stamp.getContext('2d');
    g.fillStyle = rgbaFromPalette(this.pal, 'OUTLINE_WARM', 0.42);
    for (let py = -ry; py <= ry; py++) {
      for (let px = -rx; px <= rx; px++) {
        const nx = px / Math.max(1, rx);
        const ny = py / Math.max(1, ry);
        if (nx * nx + ny * ny <= 1.0) {
          g.fillRect(px + rx + 1, py + ry + 1, 1, 1);
        }
      }
    }
    this.shadowCache.set(key, stamp);
    return stamp;
  }

  _createLightStamp(radius) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    const size = radius * 2;
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    // Stepped concentric pixel rings (no smooth browser anti-aliased gradient artifacts)
    const rings = [
      { r: 1.0, col: rgbaFromPalette(this.pal, 'FLAME_ORANGE', 0.05) },
      { r: 0.72, col: rgbaFromPalette(this.pal, 'FLAME_ORANGE', 0.07) },
      { r: 0.46, col: rgbaFromPalette(this.pal, 'FLAME_YELLOW', 0.09) },
      { r: 0.22, col: rgbaFromPalette(this.pal, 'CREAM_LIGHT', 0.08) },
    ];
    for (const ring of rings) {
      const rr = Math.round(radius * ring.r);
      g.fillStyle = ring.col;
      for (let py = -rr; py <= rr; py += 2) {
        const span = Math.floor(Math.sqrt(Math.max(0, rr * rr - py * py)));
        g.fillRect(radius - span, radius + py, span * 2, 2);
      }
    }
    return c;
  }

  resizeToWindow(winW, winH) {
    const scale = Math.max(1, Math.floor(Math.min(winW / INTERNAL_W, winH / INTERNAL_H)));
    this.scale = scale;
    if (this.canvas.width !== INTERNAL_W || this.canvas.height !== INTERNAL_H) {
      this.canvas.width = INTERNAL_W;
      this.canvas.height = INTERNAL_H;
    }
    this.canvas.style.width = `${INTERNAL_W * scale}px`;
    this.canvas.style.height = `${INTERNAL_H * scale}px`;
    this.ctx.imageSmoothingEnabled = false;
  }

  screenToCanvas(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = Math.floor((clientX - rect.left) / this.scale);
    const cy = Math.floor((clientY - rect.top) / this.scale);
    return { cx, cy };
  }

  canvasToWorld(cx, cy) {
    return {
      wx: cx + Math.round(this.camX),
      wy: cy + Math.round(this.camY),
    };
  }

  clampCamera(bounds) {
    if (!bounds) return;
    const minCamX = bounds.minX - 24;
    const maxCamX = Math.max(minCamX, bounds.maxX - INTERNAL_W + 24);
    const minCamY = bounds.minY - 24;
    const maxCamY = Math.max(minCamY, bounds.maxY - INTERNAL_H + 36);
    this.camX = Math.round(Math.max(minCamX, Math.min(maxCamX, this.camX)));
    this.camY = Math.round(Math.max(minCamY, Math.min(maxCamY, this.camY)));
  }

  centerCameraOn(wx, wy, bounds) {
    this.camX = Math.round(wx - INTERNAL_W / 2);
    this.camY = Math.round(wy - INTERNAL_H / 2);
    this.clampCamera(bounds);
  }

  spawnParticle(kind, wx, wy) {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % this.particles.length;
    p.active = true;
    p.kind = kind;
    p.x = wx + (((this.particleCursor * 7) % 9) - 4);
    p.y = wy;
    p.vx = (((this.particleCursor * 13) % 11) - 5) * 1.4;
    p.vy = kind === 'ember' ? -14 - (this.particleCursor % 8) : -9 - (this.particleCursor % 5);
    p.life = 0;
    p.maxLife = kind === 'ember' ? 1.1 + (this.particleCursor % 4) * 0.25 : 1.5;
  }

  updateAtmosphere(dt, sim) {
    this.animClock += dt;
    if (!this.atmosphereEnabled) return;

    for (const m of this.dustMotes) {
      m.x = (m.x + m.vx * dt + INTERNAL_W) % INTERNAL_W;
      m.y = (m.y + m.vy * dt + Math.sin(this.animClock * 1.3 + m.phase) * 2.5 * dt + INTERNAL_H) % INTERNAL_H;
    }

    this.emitAccum += dt;
    if (this.emitAccum >= 0.22) {
      this.emitAccum = 0;
      // Fireplace embers
      for (const prop of sim.layout.props) {
        if (prop.emitsEmbers) {
          this.spawnParticle('ember', prop.x, prop.y - 16);
        }
        if (prop.asset === 'stove_cauldron') {
          this.spawnParticle('steam', prop.x - 4, prop.y - 36);
        }
      }
      // Steam over hot meals
      for (const tbl of sim.layout.tables) {
        if (tbl.hasHotFood) {
          this.spawnParticle('steam', tbl.x, tbl.y - 38);
        }
      }
    }

    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life >= p.maxLife) p.active = false;
    }
  }

  drawContactShadow(sx, sy, rx, ry) {
    const stamp = this._getShadowStamp(rx, ry);
    if (!stamp) return;
    this.ctx.drawImage(stamp, Math.round(sx - rx - 1), Math.round(sy - ry));
  }

  drawCanonCharacter(actor, sx, sy) {
    const sheet = this.assets.chars.get(actor.id);
    if (!sheet) return;
    const cellW = 48;
    const cellH = 48;

    let row = 0;
    let flipX = false;
    if (actor.dir === 'down') row = 0;
    else if (actor.dir === 'up') row = 1;
    else if (actor.dir === 'left') row = 2;
    else if (actor.dir === 'right') {
      row = 2;
      flipX = true;
    }

    const isWalking = actor.anim === 'walk' || (actor.anim === 'carry' && actor.state !== 'SERVING');
    const walkCycle = [0, 1, 2, 1];
    const col = isWalking ? walkCycle[Math.floor(actor.animTime * 6.5) % 4] : 1;
    const bobY = !isWalking ? (Math.floor(actor.animTime * 2.2) % 2 === 0 ? 0 : -1) : 0;
    const isSitting = actor.anim === 'sit' || actor.anim === 'eat';
    const sitOffsetY = isSitting ? -8 : 0;

    const drawX = Math.round(sx);
    const drawY = Math.round(sy - cellH + bobY + sitOffsetY);

    if (flipX) {
      this.ctx.save();
      this.ctx.translate(drawX + cellW / 2, drawY);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(sheet, col * cellW, row * cellH, cellW, cellH, 0, 0, cellW, cellH);
      this.ctx.restore();
    } else {
      this.ctx.drawImage(sheet, col * cellW, row * cellH, cellW, cellH, drawX - cellW / 2, drawY, cellW, cellH);
    }

    // Carry prop overlay (canon PNG untouched!)
    if (actor.carryingProp) {
      const propImg = this.assets.tavern.get(actor.carryingProp) || this.assets.tavern.get('ale_tray_three');
      if (propImg) {
        const ox = actor.dir === 'left' ? -8 : actor.dir === 'right' ? 8 : 0;
        this.ctx.drawImage(
          propImg,
          Math.round(drawX - propImg.width / 2 + ox),
          Math.round(sy - 26 + bobY)
        );
      }
    }
  }

  drawGeneratedNpc(actor, sx, sy) {
    const sheet = this.assets.npcs.get(actor.spriteKey);
    if (!sheet) return;
    const cellW = 48;
    const cellH = 48;

    let row = 0;
    let col = 1;
    let flipX = false;
    let bobY = 0;

    const setDirRow = () => {
      if (actor.dir === 'down') { row = 0; flipX = false; }
      else if (actor.dir === 'up') { row = 1; flipX = false; }
      else if (actor.dir === 'left') { row = 2; flipX = false; }
      else { row = 2; flipX = true; }
    };

    switch (actor.anim) {
      case 'walk': {
        setDirRow();
        const cycle = [0, 1, 2, 1];
        col = cycle[Math.floor(actor.animTime * 6.2) % 4];
        break;
      }
      case 'sit': {
        setDirRow();
        col = 3;
        break;
      }
      case 'eat': {
        row = 3;
        col = Math.floor(actor.animTime * 2.5) % 2;
        break;
      }
      case 'carry': {
        row = 3;
        if (actor.dir === 'left') { col = 3; flipX = false; }
        else if (actor.dir === 'right') { col = 3; flipX = true; }
        else { col = 2; flipX = false; }
        bobY = Math.floor(actor.animTime * 6.0) % 2 === 0 ? 0 : -1;
        break;
      }
      case 'cook': {
        row = 4;
        col = Math.floor(actor.animTime * 3.2) % 2;
        break;
      }
      case 'play': {
        row = 4;
        col = 2 + (Math.floor(actor.animTime * 4.0) % 2);
        break;
      }
      case 'dance': {
        row = 5;
        col = Math.floor(actor.animTime * 5.0) % 4;
        break;
      }
      default: {
        setDirRow();
        col = 1;
        bobY = Math.floor(actor.animTime * 2.0) % 2 === 0 ? 0 : -1;
      }
    }

    const isSitting = actor.anim === 'sit' || actor.anim === 'eat';
    const sitOffsetY = isSitting ? -8 : 0;

    const drawX = Math.round(sx);
    const drawY = Math.round(sy - cellH + bobY + sitOffsetY);

    if (flipX) {
      this.ctx.save();
      this.ctx.translate(drawX + cellW / 2, drawY);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(sheet, col * cellW, row * cellH, cellW, cellH, 0, 0, cellW, cellH);
      this.ctx.restore();
    } else {
      this.ctx.drawImage(sheet, col * cellW, row * cellH, cellW, cellH, drawX - cellW / 2, drawY, cellW, cellH);
    }

    if (actor.carryingProp) {
      const propImg = this.assets.tavern.get(actor.carryingProp);
      if (propImg) {
        const ox = actor.dir === 'left' ? -8 : actor.dir === 'right' ? 8 : 0;
        this.ctx.drawImage(
          propImg,
          Math.round(drawX - propImg.width / 2 + ox),
          Math.round(sy - 26 + bobY)
        );
      }
    }
  }

  render(sim, selectedActorId = null, suppressWorldBubbles = false) {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    this.clampCamera(sim.layout.bounds);

    const camX = Math.round(this.camX);
    const camY = Math.round(this.camY);

    // 0. Clear background in deep warm outline tone
    ctx.fillStyle = this.pal.OUTLINE_WARM;
    ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);

    // 1. Floor Tiles (frustum-culled to viewport)
    for (const f of sim.layout.floors) {
      const sx = f.x - camX;
      const sy = f.y - camY;
      if (sx < -32 || sx > INTERNAL_W || sy < -32 || sy > INTERNAL_H) continue;
      const img = this.assets.tavern.get(f.asset);
      if (img) ctx.drawImage(img, sx, sy);
    }

    // 2. Cutaway Back Walls
    for (const w of sim.layout.walls) {
      const sx = w.x - camX;
      const sy = w.y - camY;
      if (sx < -64 || sx > INTERNAL_W || sy < -64 || sy > INTERNAL_H) continue;
      const img = this.assets.tavern.get(w.asset);
      if (img) ctx.drawImage(img, sx, sy);
    }

    // 3. Assembled Rugs on Floor Layer
    for (const r of sim.layout.rugs) {
      const rugCanvas = this.assembledRugs.get(r.group);
      if (rugCanvas) {
        ctx.drawImage(rugCanvas, Math.round(r.x - camX), Math.round(r.y - camY));
      }
    }

    // 4. Wall-Mounted Decor (non-foreground) + Swaying Tavern Sign
    const lightSources = [];
    for (const wm of sim.layout.wallMounts) {
      if (wm.foreground) continue;
      const img = this.assets.tavern.get(wm.asset);
      if (!img) continue;
      let swayX = 0;
      if (wm.sways && this.atmosphereEnabled) {
        swayX = Math.round(Math.sin(this.animClock * 2.1) * 1.4);
      }
      const sx = Math.round(wm.x - camX + swayX);
      const sy = Math.round(wm.y - camY);
      ctx.drawImage(img, sx, sy);
      if (wm.lightPool) {
        lightSources.push({ sx: sx + Math.floor(img.width / 2), sy: sy + Math.floor(img.height / 2), large: false });
      }
    }

    // 5. Build Y-sorted Render List (Props + Staff + Customers) sorted by footY (`anchor: [0.5, 1.0]`)
    const renderables = [];

    for (const p of sim.layout.props) {
      const img = this.assets.tavern.get(p.asset);
      if (!img) continue;
      renderables.push({
        footY: p.sortY ?? p.y,
        kind: 'prop',
        prop: p,
        img,
      });
    }

    for (const s of sim.staff) {
      renderables.push({
        footY: s.y,
        kind: 'actor',
        actor: s,
      });
    }

    for (const c of sim.customers) {
      renderables.push({
        footY: c.y,
        kind: 'actor',
        actor: c,
      });
    }

    renderables.sort((a, b) => a.footY - b.footY);

    // 6. Render Y-sorted Entities with Contact Shadows
    for (const item of renderables) {
      if (item.kind === 'prop') {
        const p = item.prop;
        const img = item.img;
        const sx = Math.round(p.x - camX);
        const sy = Math.round(p.y - camY);
        if (sx < -96 || sx > INTERNAL_W + 96 || sy < -16 || sy > INTERNAL_H + 128) continue;

        if (p.shadow !== false) {
          const rx = Math.max(8, Math.floor(img.width * 0.42));
          const ry = Math.max(4, Math.floor(img.height * 0.12));
          this.drawContactShadow(sx, sy - 1, rx, ry);
        }

        // Flickering hearth sprite swap (`fireplace_1` <-> `fireplace_2`)
        let drawImg = img;
        if (p.asset === 'fireplace_1' && this.atmosphereEnabled) {
          if (Math.floor(this.animClock * 5.5) % 2 === 1) {
            drawImg = this.assets.tavern.get('fireplace_2') || img;
          }
        } else if (p.asset === 'door_front' || p.id === 'front_door') {
          if (sim.isDoorOpen) {
            drawImg = this.assets.tavern.get('door_front_open') || img;
          }
        }

        ctx.drawImage(drawImg, Math.round(sx - drawImg.width / 2), Math.round(sy - drawImg.height));

        if (p.lightPool || p.asset === 'lamppost' || p.asset === 'spit_roast') {
          lightSources.push({ sx, sy: sy - Math.floor(drawImg.height * 0.5), large: p.asset === 'fireplace_1' });
        }

        // Tabletop overlays (candles, active dishes, dirty crumb indicator)
        if (p.tableIndex !== undefined) {
          const tbl = sim.layout.tables[p.tableIndex];
          if (p.hasCandles) {
            const cand = this.assets.tavern.get('candles_cluster');
            if (cand) {
              ctx.drawImage(cand, Math.round(sx - cand.width / 2 + 10), Math.round(sy - 38));
              lightSources.push({ sx: sx + 10, sy: sy - 32, large: false });
            }
          }
          if (tbl && tbl.activeDishProp) {
            const dish = this.assets.tavern.get(tbl.activeDishProp);
            if (dish) {
              ctx.drawImage(dish, Math.round(sx - dish.width / 2 - 4), Math.round(sy - 36));
            }
          } else if (tbl && tbl.dirty) {
            const mug = this.assets.tavern.get('icon_ale');
            if (mug) {
              ctx.drawImage(mug, Math.round(sx - 8), Math.round(sy - 34));
            }
          }
        }
      } else {
        const actor = item.actor;
        const sx = Math.round(actor.x - camX);
        const sy = Math.round(actor.y - camY);
        if (sx < -48 || sx > INTERNAL_W + 48 || sy < -16 || sy > INTERNAL_H + 64) continue;

        this.drawContactShadow(sx, sy - 1, 10, 4);

        if (selectedActorId && actor.id === selectedActorId) {
          ctx.strokeStyle = this.pal.GOLD_LIGHT;
          ctx.lineWidth = 1;
          ctx.strokeRect(sx - 12, sy - 6, 24, 8);
        }

        if (actor.isCanon) {
          this.drawCanonCharacter(actor, sx, sy);
        } else {
          this.drawGeneratedNpc(actor, sx, sy);
        }

        // Overhead pixel emote bubble
        if (actor.emote) {
          const emImg = this.assets.tavern.get(actor.emote);
          if (emImg) {
            const floatY = Math.round(Math.sin(this.animClock * 5.0 + (actor.seed || 0)) * 2);
            ctx.drawImage(emImg, Math.round(sx - emImg.width / 2), Math.round(sy - 58 + floatY));
          }
        }
      }
    }

    // 7. Foreground Hanging Ceiling Props (e.g. Chandelier)
    for (const wm of sim.layout.wallMounts) {
      if (!wm.foreground) continue;
      const img = this.assets.tavern.get(wm.asset);
      if (!img) continue;
      const sx = Math.round(wm.x - camX);
      const sy = Math.round(wm.y - camY);
      ctx.drawImage(img, sx, sy);
      if (wm.lightPool) {
        lightSources.push({ sx: sx + Math.floor(img.width / 2), sy: sy + Math.floor(img.height / 2), large: true });
      }
    }

    // 8. Atmosphere Layer (Embers, Steam, Dust Motes, Day/Night Tint, Warm Light Pools, Soft Vignette)
    if (this.atmosphereEnabled) {
      // Embers & Steam
      for (const p of this.particles) {
        if (!p.active) continue;
        const sx = Math.round(p.x - camX);
        const sy = Math.round(p.y - camY);
        if (sx < 0 || sx >= INTERNAL_W || sy < 0 || sy >= INTERNAL_H) continue;
        const t = p.life / p.maxLife;
        if (p.kind === 'ember') {
          ctx.fillStyle = t < 0.35 ? this.pal.FLAME_YELLOW : t < 0.7 ? this.pal.FLAME_ORANGE : this.pal.FLAME_EMBER;
          ctx.fillRect(sx, sy, t < 0.5 ? 2 : 1, t < 0.5 ? 2 : 1);
        } else {
          ctx.fillStyle = rgbaFromPalette(this.pal, 'CREAM_LIGHT', Math.max(0.08, 0.42 * (1 - t)));
          ctx.fillRect(sx, sy, 2, 2);
        }
      }

      // Ambient Dust Motes
      for (const m of this.dustMotes) {
        const twinkle = 0.16 + 0.12 * Math.sin(this.animClock * 1.8 + m.phase);
        ctx.fillStyle = rgbaFromPalette(this.pal, 'CREAM_LIGHT', twinkle);
        ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
      }

      // Day/Night Tint Overlay
      const tint = sim.dayPhaseSpec?.ambientTint;
      if (tint && tint[3] > 0) {
        ctx.fillStyle = `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${tint[3]})`;
        ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);
      }

      // Warm Flickering Light Pools (additive blend)
      const nightBoost = sim.dayPhase === 'night' ? 1.35 : sim.dayPhase === 'evening' ? 1.15 : 0.65;
      const flicker = 0.92 + 0.08 * Math.sin(this.animClock * 9.3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, nightBoost * flicker);
      for (const ls of lightSources) {
        const stamp = ls.large ? this.lightStampLarge : this.lightStampSmall;
        if (stamp) {
          ctx.drawImage(stamp, Math.round(ls.sx - stamp.width / 2), Math.round(ls.sy - stamp.height / 2));
        }
      }
      ctx.restore();

      // Soft Pixel-Stepped Vignette around viewport frame
      const vigBands = [
        { inset: 0, thick: 6, alpha: 0.24 },
        { inset: 6, thick: 8, alpha: 0.13 },
        { inset: 14, thick: 10, alpha: 0.06 },
      ];
      for (const b of vigBands) {
        ctx.fillStyle = rgbaFromPalette(this.pal, 'OUTLINE_WARM', b.alpha);
        ctx.fillRect(b.inset, b.inset, INTERNAL_W - b.inset * 2, b.thick);
        ctx.fillRect(b.inset, INTERNAL_H - b.inset - b.thick, INTERNAL_W - b.inset * 2, b.thick);
        ctx.fillRect(b.inset, b.inset + b.thick, b.thick, INTERNAL_H - (b.inset + b.thick) * 2);
        ctx.fillRect(INTERNAL_W - b.inset - b.thick, b.inset + b.thick, b.thick, INTERNAL_H - (b.inset + b.thick) * 2);
      }
    }

    // 9. World-Space Floating Gold Popups & Active Speech Bubble over Speaker
    for (const ft of sim.floatingTexts) {
      const sx = Math.round(ft.x - camX);
      const sy = Math.round(ft.y - camY);
      if (sx < 0 || sx > INTERNAL_W || sy < 0 || sy > INTERNAL_H) continue;
      drawPixelText(ctx, ft.text, sx, sy, {
        color: this.pal.GOLD_LIGHT,
        shadow: this.pal.OUTLINE_WARM,
        scale: 1,
        align: 'center',
      });
    }

    const beat = !suppressWorldBubbles ? sim.banter.currentBeat : null;
    if (beat) {
      const speakerActor = sim.getActorById(beat.speaker);
      const parchSkin = this.assets.tavern.get('ui_panel_parchment');
      if (speakerActor && parchSkin) {
        const sx = Math.round(speakerActor.x - camX);
        const sy = Math.round(speakerActor.y - camY - 52);
        if (sx >= 36 && sx <= INTERNAL_W - 36 && sy >= 30 && sy <= INTERNAL_H - 20) {
          const bw = 186;
          const wrapped = wrapPixelText(beat.text, bw - 14, 1).slice(0, 6);
          const bh = Math.max(24, wrapped.length * 9 + 11);
          const bx = Math.max(6, Math.min(INTERNAL_W - bw - 6, Math.round(sx - bw / 2)));
          const by = Math.max(30, sy - bh);
          drawNineSlice(ctx, parchSkin, bx, by, bw, bh, 8);
          drawWrappedPixelText(ctx, beat.text, bx + 7, by + 6, bw - 14, {
            color: this.pal.OUTLINE_WARM,
            scale: 1,
            lineHeight: 9,
            maxLines: 6,
          });
        }
      }
    }
  }
}
