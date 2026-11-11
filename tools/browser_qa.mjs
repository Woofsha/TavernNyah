// Deterministic Headless Chrome CDP Verification & Visual Screenshot Harness (`tools/browser_qa.mjs`).
// Launches local `python -m http.server`, drives Headless Chrome over native Node WebSocket CDP,
// asserts ZERO console errors / uncaught exceptions / failed HTTP loads / integer pixel scaling,
// and captures 6 runtime screenshots across all game milestones.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

function findBrowserBinary() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();

    this.readyPromise = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });

    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        const handlers = this.listeners.get(msg.method) || [];
        for (const h of handlers) h(msg.params);
      }
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evalJs(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`JS Eval Exception: ${JSON.stringify(res.exceptionDetails.exception?.description || res.exceptionDetails.text)}`);
    }
    return res.result?.value;
  }

  async capturePng(outFile) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, Buffer.from(res.data, 'base64'));
  }

  close() {
    try { this.ws.close(); } catch {}
  }
}

async function main() {
  const outDir = process.argv[2] || path.join(os.tmpdir(), 'tavern_nyah_qa');
  fs.mkdirSync(outDir, { recursive: true });

  const browserBin = findBrowserBinary();
  if (!browserBin) {
    console.error('No local Chrome/Edge binary found.');
    process.exit(1);
  }

  const httpPort = await getFreePort();
  const cdpPort = await getFreePort();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tavern_chrome_'));

  const httpProc = spawn('python', ['-m', 'http.server', String(httpPort), '--bind', '127.0.0.1'], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });

  let chromeProc = null;
  let cdp = null;

  const consoleErrors = [];
  const pageExceptions = [];
  const httpFailures = [];

  try {
    // Wait until HTTP server accepts connections
    const pageUrl = `http://127.0.0.1:${httpPort}/index.html`;
    for (let i = 0; i < 30; i++) {
      try {
        const r = await fetch(pageUrl);
        if (r.ok) break;
      } catch {}
      await sleep(100);
    }

    chromeProc = spawn(
      browserBin,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--autoplay-policy=no-user-gesture-required',
        '--window-size=1280,720',
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${profileDir}`,
        'about:blank',
      ],
      { stdio: 'ignore' }
    );

    let wsUrl = null;
    for (let i = 0; i < 50; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
        if (r.ok) {
          const targets = await r.json();
          const pageTarget = targets.find((t) => t.type === 'page');
          if (pageTarget?.webSocketDebuggerUrl) {
            wsUrl = pageTarget.webSocketDebuggerUrl;
            break;
          }
        }
      } catch {}
      await sleep(120);
    }
    if (!wsUrl) throw new Error('Timed out waiting for Chrome CDP WebSocket target');

    cdp = new CdpClient(wsUrl);
    await cdp.readyPromise;

    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });

    cdp.on('Runtime.consoleAPICalled', (p) => {
      if (p.type === 'error') {
        consoleErrors.push(p.args.map((a) => a.value || a.description || '').join(' '));
      }
    });
    cdp.on('Runtime.exceptionThrown', (p) => {
      pageExceptions.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || 'Unknown exception');
    });
    cdp.on('Log.entryAdded', (p) => {
      if (p.entry?.level === 'error') {
        consoleErrors.push(`${p.entry.source}: ${p.entry.text} (${p.entry.url || ''})`);
      }
    });
    cdp.on('Network.responseReceived', (p) => {
      if (p.response.status >= 400) {
        httpFailures.push(`${p.response.status} ${p.response.url}`);
      }
    });

    await cdp.send('Page.navigate', { url: pageUrl });

    // Wait for `window.__tavernGame` to finish loading all 180+ offline assets
    let booted = false;
    for (let i = 0; i < 60; i++) {
      booted = await cdp.evalJs('Boolean(window.__tavernGame && window.__tavernGame.sim)');
      if (booted) break;
      await sleep(150);
    }
    if (!booted) throw new Error('window.__tavernGame failed to initialize');

    await sleep(250);

    // 1. Verify integer scaling & pixel crispness
    const scaleStats = await cdp.evalJs(`(() => {
      const c = document.getElementById('game-canvas');
      const rect = c.getBoundingClientRect();
      const ctx = window.__tavernGame.renderer.ctx;
      return {
        internalW: c.width,
        internalH: c.height,
        cssW: rect.width,
        cssH: rect.height,
        scale: window.__tavernGame.renderer.scale,
        smoothing: ctx.imageSmoothingEnabled,
      };
    })()`);

    if (scaleStats.internalW !== 640 || scaleStats.internalH !== 360) {
      throw new Error(`Unexpected internal canvas size: ${JSON.stringify(scaleStats)}`);
    }
    if (scaleStats.cssW % 640 !== 0 || scaleStats.cssH % 360 !== 0) {
      throw new Error(`Non-integer scaled CSS size at 1280x720: ${JSON.stringify(scaleStats)}`);
    }
    if (scaleStats.smoothing !== false) {
      throw new Error('ctx.imageSmoothingEnabled must be false');
    }

    // Screenshot 1: Title Screen
    await cdp.capturePng(path.join(outDir, 'live_01_title.png'));

    // Screenshot 2: Skippable ~40s Story Intro (fast-forward into Fifi's panicked protest)
    await cdp.evalJs(`(() => {
      const g = window.__tavernGame;
      g.audio.unlock();
      g.ui.mode = 'playing';
      g.sim.banter.startIntro();
      for (let i = 0; i < 150; i++) g.sim.banter.updateIntro(0.1);
    })()`);
    await sleep(120);
    await cdp.capturePng(path.join(outDir, 'live_02_intro.png'));

    // Screenshot 3: Starter Tavern Vertical Slice (autonomous loop running, guests seated & eating)
    const starterCheck = await cdp.evalJs(`(() => {
      const g = window.__tavernGame;
      g.sim.banter.skipIntro();
      for (let i = 0; i < 650; i++) g.sim.step(0.1);
      g.ui.shopOpen = true;
      g.ui.activeTab = 'tables';
      return {
        gold: g.sim.gold,
        served: g.sim.stats.customersServed,
        activeCustomers: g.sim.customers.length,
      };
    })()`);
    await sleep(120);
    await cdp.capturePng(path.join(outDir, 'live_03_starter_tavern.png'));

    // Screenshot 4: Live NPC Inspector + Menu Tab
    await cdp.evalJs(`(() => {
      const g = window.__tavernGame;
      const target = g.sim.customers[0] || g.sim.staff[0];
      g.ui.selectedActorId = target.id;
      g.ui.activeTab = 'menu';
    })()`);
    await sleep(120);
    await cdp.capturePng(path.join(outDir, 'live_04_inspector.png'));

    // Screenshot 4b: Building Tab with Exterior Facade Banner
    await cdp.evalJs(`(() => {
      const g = window.__tavernGame;
      g.ui.activeTab = 'building';
      g.ui.shopScroll = 0;
    })()`);
    await sleep(120);
    await cdp.capturePng(path.join(outDir, 'live_09_building_tab.png'));

    // Screenshot 5: Grand Expanded Tavern (Evening, Stage Musician + Dancer, Hearth, Chandelier, Tier 4 Tables)
    await cdp.evalJs(`(() => {
      const g = window.__tavernGame;
      g.ui.selectedActorId = null;
      g.sim.gold = 999999;
      g.sim.reputation = 999;
      for (const u of g.sim.data.upgrades.upgrades) {
        if (u.kind !== 'repeatable') g.sim.buyUpgrade(u.id);
      }
      for (let k = 0; k < 5; k++) g.sim.buyUpgrade('add_table');
      for (const r of g.sim.data.recipes.recipes) g.sim.unlockRecipe(r.id);
      g.sim.state.dayTimeSec = 310; // cozy evening
      for (let i = 0; i < 180; i++) g.sim.step(0.1);
      g.ui.shopOpen = false;
      g.renderer.centerCameraOn(11.5 * 32, 8.5 * 32, g.sim.layout.bounds);
    })()`);
    await sleep(150);
    await cdp.capturePng(path.join(outDir, 'live_05_grand_tavern.png'));

    // Screenshot 6: "While You Were Away" Dual-Voice Offline Summary Modal
    await cdp.evalJs(`(() => {
      const g = window.__tavernGame;
      const saved = g.sim.serializeSave(Date.now() - 3 * 3600 * 1000);
      g.ui.offlineModal = g.sim.loadSave(saved, Date.now());
    })()`);
    await sleep(120);
    await cdp.capturePng(path.join(outDir, 'live_06_offline_modal.png'));

    // Screenshot 7: Upstairs Lodging Wing at Night (beds & sleeping travelers)
    await cdp.evalJs(`(() => {
      const g = window.__tavernGame;
      g.ui.offlineModal = null;
      g.sim.state.dayTimeSec = 410; // deep night
      for (let i = 0; i < 240; i++) g.sim.step(0.1);
      g.renderer.centerCameraOn(12.5 * 32, 3.0 * 32, g.sim.layout.bounds);
    })()`);
    await sleep(120);
    await cdp.capturePng(path.join(outDir, 'live_07_upstairs_night.png'));

    // Screenshot 8: Settings & Save Modal
    await cdp.evalJs(`(() => {
      const g = window.__tavernGame;
      g.ui.settingsOpen = true;
    })()`);
    await sleep(120);
    await cdp.capturePng(path.join(outDir, 'live_08_settings_modal.png'));

    console.log('=== Headless Chrome Browser QA Report ===');
    console.log(`Viewport Scaling: ${scaleStats.internalW}x${scaleStats.internalH} -> ${scaleStats.cssW}x${scaleStats.cssH} (${scaleStats.scale}x integer, smoothing=${scaleStats.smoothing})`);
    console.log(`Starter Slice (65s sim): gold=${starterCheck.gold}g, served=${starterCheck.served}, activePatrons=${starterCheck.activeCustomers}`);
    console.log(`Console Errors: ${consoleErrors.length}`);
    console.log(`Page Exceptions: ${pageExceptions.length}`);
    console.log(`HTTP Failures: ${httpFailures.length}`);
    console.log(`Screenshots saved to: ${outDir}`);

    if (consoleErrors.length > 0 || pageExceptions.length > 0 || httpFailures.length > 0) {
      for (const e of consoleErrors) console.error('  [CONSOLE ERROR]', e);
      for (const e of pageExceptions) console.error('  [EXCEPTION]', e);
      for (const e of httpFailures) console.error('  [HTTP FAIL]', e);
      process.exitCode = 1;
    }
  } finally {
    if (cdp) cdp.close();
    if (chromeProc) {
      try { chromeProc.kill(); } catch {}
    }
    try { httpProc.kill(); } catch {}
    await sleep(150);
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((err) => {
  console.error('Browser QA fatal error:', err);
  process.exit(1);
});
