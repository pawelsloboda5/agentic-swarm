#!/usr/bin/env node
// score_runtime.mjs -- deterministic RUNTIME scorecard for one Three.js-game index.html.
//
// Node ESM. Uses the repo-local playwright + @axe-core/playwright. Prints ONE JSON object
// to stdout, ASCII-only (cp1252-safe console: no non-ASCII characters in output).
//
//   node score_runtime.mjs <path/to/index.html>
//
// What it does: serves the file's directory over a throwaway localhost HTTP server (file://
// breaks importmap/module CORS), launches headless chromium, collects pageerror +
// console-error events, loads the page, waits ~2s for init, plays ~13s (clicking near the
// canvas center), then (a) counts uncaught + console errors, (b) screenshots the CANVAS
// element and checks the decoded pixels have luminance variance above a small threshold
// (i.e. the scene is NOT a single flat color), and (c) runs axe-core with the WCAG 2.0/2.1
// A+AA tag set. Everything is timeboxed to ~40s; on overrun it prints the partial result.
//
// === HONESTY / SCOPE (read before trusting a number) ===
//   * render_nonblank is a HEURISTIC: a compositor screenshot of the <canvas> decoded back
//     to pixels, "non-blank" iff luminance variance OR (max-min) clears a small threshold.
//     It proves the canvas is not one flat color at the sampled instant -- NOT that the
//     game is fully correct or that every frame renders. A static textured background could
//     pass with no gameplay. Applied identically to every arm.
//   * This requires NETWORK access (three.js loads from a CDN via importmap). Offline, the
//     game cannot boot -- that surfaces honestly as console/uncaught errors + render_nonblank
//     = false, which is a real result, not a scorer bug.
//   * axe_violations_total counts distinct violated rules (not node instances) under
//     wcag2a/wcag2aa/wcag21a/wcag21aa. Automated axe catches a fraction of real a11y issues;
//     a low count is a floor, not a clean bill of health.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const HARD_TIMEOUT_MS = 40000;
const INIT_WAIT_MS = 2000;
const PLAY_MS = 13000;
// "non-blank" thresholds on 0..255 luminance: variance OR dynamic range.
const VAR_THRESHOLD = 8;
const RANGE_THRESHOLD = 16;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wasm': 'application/wasm',
};

function emit(obj) {
  // ASCII-only guarantee: strip any non-ASCII that might sneak into notes/ids.
  const json = JSON.stringify(obj).replace(/[^\x00-\x7F]/g, '?');
  process.stdout.write(json + '\n');
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    emit({ error: 'usage: node score_runtime.mjs <index.html>', loaded: false });
    process.exit(0);
  }
  const indexPath = path.resolve(target);
  if (!fs.existsSync(indexPath)) {
    emit({ error: 'file not found: ' + indexPath, loaded: false });
    process.exit(0);
  }
  const rootDir = path.dirname(indexPath);
  const indexName = path.basename(indexPath);

  // ---- chromium presence check (do NOT hang if it's missing) -----------------
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch (e) {
    emit({ error: 'playwright not installed: ' + e.message, loaded: false });
    process.exit(0);
  }
  let exe = null;
  try { exe = chromium.executablePath(); } catch { exe = null; }
  if (!exe || !fs.existsSync(exe)) {
    emit({ error: 'chromium not installed', loaded: false });
    process.exit(0);
  }

  const result = {
    loaded: false,
    uncaught_errors: 0,
    console_errors: 0,
    render_nonblank: false,
    axe_violations_total: 0,
    axe_violation_ids: [],
    notes: '',
  };
  const noteParts = [];

  let server = null;
  let browser = null;
  let timedOut = false;

  // ---- static file server (free port) ---------------------------------------
  server = http.createServer((req, res) => {
    try {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/' || urlPath === '') urlPath = '/' + indexName;
      const filePath = path.normalize(path.join(rootDir, urlPath));
      if (!filePath.startsWith(rootDir)) { res.writeHead(403).end(); return; } // no traversal
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404).end(); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } catch (e) {
      res.writeHead(500).end(String(e && e.message));
    }
  });

  const guard = new Promise((resolve) =>
    setTimeout(() => { timedOut = true; resolve('TIMEOUT'); }, HARD_TIMEOUT_MS));

  async function run() {
    const port = await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    });
    const url = `http://127.0.0.1:${port}/${indexName}`;

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    page.on('pageerror', (err) => {
      result.uncaught_errors += 1;
      if (result.axe_violation_ids.length < 99 && noteParts.length < 6) {
        noteParts.push('pageerror:' + String(err && err.message).slice(0, 80));
      }
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') result.console_errors += 1;
    });

    // ---- load -------------------------------------------------------------
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      result.loaded = true;
    } catch (e) {
      noteParts.push('goto-failed:' + String(e && e.message).slice(0, 80));
      return; // nothing more to measure
    }

    await page.waitForTimeout(INIT_WAIT_MS); // let three.js boot + first frames render

    // ---- play: click near canvas center, let the sim run -------------------
    // Poll for the canvas before giving up: some arms create it via an async dynamic import()
    // that resolves AFTER INIT_WAIT_MS, so a single check would race and false-report
    // "no-canvas-element" on a perfectly working game. Polling is fairness-preserving (it changes
    // no arm whose canvas was already present; it only stops penalizing late-but-correct boots).
    let canvas = await page.$('canvas');
    if (!canvas) {
      try { await page.waitForSelector('canvas', { timeout: 12000 }); } catch (e) {}
      canvas = await page.$('canvas');
    }
    if (canvas) {
      try {
        const box = await canvas.boundingBox();
        if (box) {
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          await page.mouse.click(cx, cy);
          await page.waitForTimeout(PLAY_MS / 2);
          // a second interaction a little off-center (e.g. place/select)
          await page.mouse.click(cx + Math.min(120, box.width * 0.15), cy + 40);
          await page.waitForTimeout(PLAY_MS / 2);
        } else {
          await page.waitForTimeout(PLAY_MS);
        }
      } catch (e) {
        noteParts.push('interact-warn:' + String(e && e.message).slice(0, 60));
        await page.waitForTimeout(PLAY_MS);
      }
    } else {
      noteParts.push('no-canvas-element');
      await page.waitForTimeout(PLAY_MS);
    }

    // ---- non-blank render check (compositor screenshot -> decoded pixels) ---
    if (canvas) {
      try {
        const shot = await canvas.screenshot({ type: 'png' }); // captures composited WebGL frame
        const dataUrl = 'data:image/png;base64,' + shot.toString('base64');
        const stats = await page.evaluate(async (durl) => {
          const img = new Image();
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = durl; });
          const w = img.naturalWidth, h = img.naturalHeight;
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const { data } = ctx.getImageData(0, 0, w, h);
          let n = 0, sum = 0, sumSq = 0, mn = 255, mx = 0;
          const stride = 4 * 53; // sparse sample to stay light
          for (let i = 0; i + 2 < data.length; i += stride) {
            const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            sum += l; sumSq += l * l; n += 1;
            if (l < mn) mn = l; if (l > mx) mx = l;
          }
          const mean = n ? sum / n : 0;
          const variance = n ? Math.max(0, sumSq / n - mean * mean) : 0;
          return { n, variance, range: mx - mn };
        }, dataUrl);
        result.render_nonblank = (stats.variance > VAR_THRESHOLD) || (stats.range > RANGE_THRESHOLD);
        noteParts.push('pixvar=' + stats.variance.toFixed(1) + ',range=' + stats.range.toFixed(0));
      } catch (e) {
        noteParts.push('render-check-failed:' + String(e && e.message).slice(0, 60));
      }
    }

    // ---- axe-core WCAG A+AA ------------------------------------------------
    try {
      const { AxeBuilder } = await import('@axe-core/playwright');
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      result.axe_violations_total = axe.violations.length;
      result.axe_violation_ids = axe.violations.map((v) => v.id);
    } catch (e) {
      noteParts.push('axe-failed:' + String(e && e.message).slice(0, 80));
    }
  }

  try {
    await Promise.race([run(), guard]);
  } catch (e) {
    noteParts.push('run-error:' + String(e && e.message).slice(0, 100));
  } finally {
    try { if (browser) await browser.close(); } catch { /* ignore */ }
    try { if (server) server.close(); } catch { /* ignore */ }
  }

  if (timedOut) noteParts.push('timeboxed-at-40s');
  result.notes = noteParts.join('; ');
  emit(result);
  // Force exit so any lingering server/browser handles can't hang the process.
  process.exit(0);
}

main().catch((e) => {
  emit({ error: 'fatal: ' + String(e && e.message), loaded: false });
  process.exit(0);
});
