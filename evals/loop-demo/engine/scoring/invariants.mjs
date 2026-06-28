#!/usr/bin/env node
// invariants.mjs -- the held-out invariant scorer for the v0.9.0 discriminating showcase.
//
// Drives an arm's index.html (which exposes window.ENGINE per SPEC.md) in headless Chromium
// over K deterministic, seeded ADVERSARIAL scenarios the builders never see, and scores each
// build on SELF-CONSISTENCY families. No external oracle: every check compares the build to
// ITSELF (its own hashState / snapshot / restore / report / events), so there is nothing to
// "match an answer key" to. Integer-only state means the only values crossing the
// page.evaluate boundary are strings (hashState), ints (event seq), and small int arrays --
// NO float/NaN/Infinity marshaling.
//
//   node invariants.mjs <path/to/index.html> [seedCount]
//
// PRIMARY -- the pilot-confirmed discriminating family (graded pass-rate, real headroom):
//   F_FID   STATE FIDELITY UNDER CONTINUATION. A snapshot is only correct if restoring it
//           reproduces the same FUTURE, not just the same instant. Three sub-checks per
//           checkpoint: (a) restore@k then replay to end == run-straight-to-end; (b) a double
//           round-trip (restore->snapshot->restore) then continue == ground truth; (c) two
//           independent restores evolve identically. Fails iff the snapshot omits any state
//           that drives future evolution (e.g. the PRNG state, cooldowns) -- a real, common,
//           SELF-UNDETECTABLE save/load bug (a build's own restore-IDENTITY self-test passes
//           while restore-CONTINUE diverges).
//
// CONFORMANCE FLOOR -- expected ~1.0 for any competent build; a regression here disqualifies a
// "win" (you cannot win the primary while breaking the basics), but these do not separate arms:
//   F_DET   replay determinism (no restore): same seed+script twice -> identical hashState + seqs
//   F_SNAP  snapshot IDENTITY: restore@k hashes equal to state@k (the visible-state check)
//   F_IDEM  command idempotence: re-applying a seen command id is a no-op
//   F_CONS  conservation: report.totalResources == sum(mint amount) - sum(burn amount) over events
//                         AND == report.minted - report.burned (state vs ledger vs accounting)
//   F_MONO  monotonic event ids: event seqs strictly increasing, unique
// HARD FLOOR (disqualifiers, NOT in any fraction):
//   no_hang   battery completes < per-seed timeout (a cyclic/finite input must not hang)
//   no_throw  no uncaught throw / ENGINE exception on the adversarial script
//
// Applied IDENTICALLY to every arm; re-runs bit-identically over a fixed artifact + fixed seeds.
// Emits ONE JSON object (ASCII only).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PER_SEED_TIMEOUT_MS = 20000;
const N_OPS = 360;          // ops per scenario (steps + commands)
const CHECKPOINTS = 9;      // snapshot/hash checkpoints across the run
const DEFAULT_SEEDS = 5;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json' };

function emit(o) { process.stdout.write(JSON.stringify(o).replace(/[^\x00-\x7F]/g, '?') + '\n'); }

// ---- held-out scenario generator (independent LCG; mirrors no build internals) ----------
function genScenario(seed, nOps) {
  let s = (seed | 0) || 1;
  const rnd = (n) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return n > 0 ? s % n : 0; };
  const ops = [];
  const usedIds = [];
  let cid = 0;
  for (let i = 0; i < nOps; i++) {
    const roll = rnd(100);
    if (roll < 55) {
      ops.push({ op: 'step' });
    } else {
      // a command; ~12% of the time REUSE a prior id (idempotence stress in-stream)
      let id;
      if (usedIds.length && rnd(100) < 12) { id = usedIds[rnd(usedIds.length)]; }
      else { id = 'c' + (cid++); usedIds.push(id); }
      const k = rnd(100);
      let cmd;
      if (k < 35) cmd = { id, type: 'setProd', station: rnd(8) - 1, value: rnd(14) - 2 };      // incl out-of-range
      else if (k < 70) cmd = { id, type: 'inject', station: rnd(8) - 1, amt: rnd(40) - 5 };     // incl overflow + negative
      else if (k < 92) cmd = { id, type: 'kill', unit: rnd(12) };                                // incl nonexistent
      else cmd = { id, type: 'bogus' + rnd(3), payload: rnd(99) };                               // unknown types
      ops.push({ op: 'cmd', cmd });
    }
  }
  return ops;
}

// ---- the in-browser battery (stringified; runs against window.ENGINE) -------------------
// Returns { graded:{fam:{pass,total}}, throws:int, detail:[...] }. A thrown ENGINE call is
// caught + counted (throws>0 => hard-floor no_throw fails) but never aborts the battery.
// Passed directly to page.evaluate (Playwright serializes the function source); single
// serializable arg, no eval. Runs in-page against window.ENGINE.
const BATTERY_FN = function (args) {
  const scenario = args.scenario, checkpointCount = args.checkpointCount;
  const E = window.ENGINE;
  const out = { graded: { F_DET: z(), F_SNAP: z(), F_FID: z(), F_IDEM: z(), F_CONS: z(), F_MONO: z() }, throws: 0, detail: [] };
  function z() { return { pass: 0, total: 0 }; }
  function ok(f, cond, tag) { out.graded[f].total++; if (cond) out.graded[f].pass++; else out.detail.push(f + ':' + tag); }
  function guard(fn, tag) { try { return fn(); } catch (e) { out.throws++; out.detail.push('THROW@' + tag + ':' + String(e && e.message).slice(0, 60)); return undefined; } }

  const N = scenario.length;
  const cpIdx = [];
  for (let c = 1; c <= checkpointCount; c++) cpIdx.push(Math.floor((c * N) / (checkpointCount + 1)));

  // ---- helper: run a fresh world through the whole scenario, capturing a trace ----------
  // idemCheck: when applying each command, apply twice and verify hash stable (F_IDEM).
  function runTrace(seed, opts) {
    opts = opts || {};
    const w = guard(() => E.createWorld(seed, {}), 'createWorld');
    if (!w) return null;
    const hashes = [];     // hashState at each checkpoint
    const snaps = [];      // snapshot at each checkpoint
    const eseqs = [];      // every event seq, in order
    let net = 0;           // sum(mint) - sum(burn) from events
    const consPairs = [];  // [reportTotal, net] at checkpoints
    let cpc = 0;
    function drain() {
      const evs = guard(() => E.drainEventLog(w), 'drain') || [];
      for (let i = 0; i < evs.length; i++) {
        const ev = evs[i];
        if (ev && typeof ev.seq === 'number') eseqs.push(ev.seq);
        if (ev && ev.type === 'mint') net += (ev.amount | 0);
        else if (ev && ev.type === 'burn') net -= (ev.amount | 0);
      }
    }
    for (let i = 0; i < N; i++) {
      const o = scenario[i];
      if (o.op === 'step') { guard(() => E.step(w), 'step'); }
      else {
        if (opts.idem) {
          guard(() => E.applyCommand(w, o.cmd), 'applyCommand');
          const hb = guard(() => E.hashState(w), 'hash');
          guard(() => E.applyCommand(w, o.cmd), 'applyCommand2');   // same id -> must be no-op
          const ha = guard(() => E.hashState(w), 'hash');
          ok('F_IDEM', hb !== undefined && hb === ha, 'i' + i);
        } else {
          guard(() => E.applyCommand(w, o.cmd), 'applyCommand');
        }
      }
      drain();
      if (cpc < cpIdx.length && i === cpIdx[cpc]) {
        const h = guard(() => E.hashState(w), 'hash');
        hashes.push(h);
        if (opts.snap) snaps.push(guard(() => E.snapshot(w), 'snapshot'));
        if (opts.cons) {
          const rep = guard(() => E.report(w), 'report') || {};
          const tot = typeof rep.totalResources === 'number' ? rep.totalResources : null;
          const mb = (typeof rep.minted === 'number' && typeof rep.burned === 'number') ? (rep.minted - rep.burned) : null;
          consPairs.push([tot, net, mb]);
        }
        cpc++;
      }
    }
    const finalHash = guard(() => E.hashState(w), 'hashFinal');
    return { hashes, snaps, eseqs, consPairs, finalHash };
  }

  // ---- F_DET: two identical runs must match hash + event-seq traces ---------------------
  const a = runTrace(12345, { idem: false });
  const b = runTrace(12345, { idem: false });
  if (a && b) {
    for (let i = 0; i < a.hashes.length; i++) ok('F_DET', a.hashes[i] !== undefined && a.hashes[i] === b.hashes[i], 'h' + i);
    ok('F_DET', a.finalHash !== undefined && a.finalHash === b.finalHash, 'final');
    ok('F_DET', JSON.stringify(a.eseqs) === JSON.stringify(b.eseqs), 'eventseq');
  } else { ok('F_DET', false, 'noworld'); }

  // ---- F_IDEM + F_CONS + F_MONO come from one instrumented run -------------------------
  const r = runTrace(777, { idem: true, cons: true });
  if (r) {
    // F_CONS: totalResources must equal the event ledger (net mint-burn) AND report's own
    // minted-burned accounting, at every checkpoint (independent state-vs-ledger check).
    for (let i = 0; i < r.consPairs.length; i++) {
      const c = r.consPairs[i], tot = c[0], net = c[1], mb = c[2];
      ok('F_CONS', tot !== null && tot === net, 'led' + i);
      ok('F_CONS', tot !== null && mb !== null && tot === mb, 'rep' + i);
    }
    // F_MONO: event seqs strictly increasing + unique
    let mono = true; const seen = {};
    for (let i = 0; i < r.eseqs.length; i++) { const s = r.eseqs[i]; if (seen[s]) { mono = false; break; } seen[s] = 1; if (i > 0 && s <= r.eseqs[i - 1]) { mono = false; break; } }
    ok('F_MONO', mono && r.eseqs.length > 0, 'seq');
  } else { ok('F_CONS', false, 'noworld'); ok('F_MONO', false, 'noworld'); }

  // ---- F_SNAP (immediate restore identity, near-ceiling FLOOR) + F_FID (state fidelity under
  //      CONTINUATION, the discriminator: a complete snapshot must reproduce the same FUTURE) ----
  function replayToEnd(w, fromIdx) {
    for (let i = fromIdx; i < N; i++) {
      const o = scenario[i];
      if (o.op === 'step') guard(() => E.step(w), 'rstep');
      else guard(() => E.applyCommand(w, o.cmd), 'rcmd');
    }
  }
  const g = runTrace(20260628, { snap: true });
  if (g && g.snaps.length) {
    for (let c = 0; c < cpIdx.length; c++) {
      const snap = g.snaps[c];
      // F_SNAP: immediate identity -- restore(snap@k) hashes equal to state@k (visible state ok)
      const wid = guard(() => E.restore(snap), 'restore');
      const hid = wid ? guard(() => E.hashState(wid), 'rehash') : undefined;
      ok('F_SNAP', hid !== undefined && hid === g.hashes[c], 'id' + c);
      // F_FID (a) restore-continue: restore@k then replay (k+1..end) must reach the SAME final hash
      // (fails iff snapshot omits any state that drives future evolution, e.g. PRNG/cooldowns)
      const wA = guard(() => E.restore(snap), 'restoreA');
      if (wA) { replayToEnd(wA, cpIdx[c] + 1); const hA = guard(() => E.hashState(wA), 'fA'); ok('F_FID', hA !== undefined && hA === g.finalHash, 'cont' + c); }
      else ok('F_FID', false, 'norestoreA' + c);
      // F_FID (b) double round-trip: restore -> snapshot -> restore, then continue == ground truth
      const wB0 = guard(() => E.restore(snap), 'restoreB0');
      const sB = wB0 ? guard(() => E.snapshot(wB0), 'snapB') : undefined;
      const wB = (typeof sB === 'string') ? guard(() => E.restore(sB), 'restoreB') : undefined;
      if (wB) { replayToEnd(wB, cpIdx[c] + 1); const hB = guard(() => E.hashState(wB), 'fB'); ok('F_FID', hB !== undefined && hB === g.finalHash, 'cyc' + c); }
      else ok('F_FID', false, 'nocycle' + c);
      // F_FID (c) cross-restore determinism: two independent restores must evolve identically
      const wX = guard(() => E.restore(snap), 'restoreX'); const wY = guard(() => E.restore(snap), 'restoreY');
      if (wX && wY) { replayToEnd(wX, cpIdx[c] + 1); replayToEnd(wY, cpIdx[c] + 1); const hX = guard(() => E.hashState(wX), 'fX'); const hY = guard(() => E.hashState(wY), 'fY'); ok('F_FID', hX !== undefined && hX === hY, 'xdet' + c); }
      else ok('F_FID', false, 'noxdet' + c);
    }
  } else { ok('F_SNAP', false, 'nosnap'); ok('F_FID', false, 'nosnap'); }

  return out;
};

async function main() {
  const target = process.argv[2];
  const seedCount = parseInt(process.argv[3] || DEFAULT_SEEDS, 10);
  if (!target || !fs.existsSync(path.resolve(target))) { emit({ error: 'usage: node _pf_invariants.mjs <index.html> [seeds]', loaded: false }); process.exit(0); }
  const indexPath = path.resolve(target);
  const rootDir = path.dirname(indexPath);
  const indexName = path.basename(indexPath);

  let chromium;
  try { ({ chromium } = await import('playwright')); } catch (e) { emit({ error: 'playwright missing: ' + e.message, loaded: false }); process.exit(0); }

  const server = http.createServer((req, res) => {
    try {
      let u = decodeURIComponent((req.url || '/').split('?')[0]); if (u === '/' || u === '') u = '/' + indexName;
      const fp = path.normalize(path.join(rootDir, u));
      if (!fp.startsWith(rootDir) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    } catch (e) { res.writeHead(500).end(); }
  });
  const port = await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server.address().port)); });
  const url = `http://127.0.0.1:${port}/${indexName}`;

  const fam = ['F_DET', 'F_SNAP', 'F_FID', 'F_IDEM', 'F_CONS', 'F_MONO'];
  const agg = { loaded: false, has_engine: false, seeds: seedCount, per_family: {}, hard_floor: { no_hang: true, no_throw: true }, hangs: [], throw_seeds: [], notes: [] };
  fam.forEach(f => agg.per_family[f] = { pass: 0, total: 0 });
  let totalPass = 0, totalTotal = 0;

  for (let si = 0; si < seedCount; si++) {
    const seed = 100 + si * 1000;
    const scenario = genScenario(seed, N_OPS);
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    let threw = false;
    page.on('pageerror', () => { threw = true; });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      agg.loaded = true;
      const hasEngine = await page.evaluate(() => !!(window.ENGINE && typeof window.ENGINE.createWorld === 'function' && typeof window.ENGINE.step === 'function'));
      agg.has_engine = agg.has_engine || hasEngine;
      if (!hasEngine) { agg.notes.push('seed' + seed + ':no-engine'); await browser.close(); continue; }

      const res = await Promise.race([
        page.evaluate(BATTERY_FN, { scenario, checkpointCount: CHECKPOINTS }),
        new Promise((resolve) => setTimeout(() => resolve('__HANG__'), PER_SEED_TIMEOUT_MS)),
      ]);
      if (res === '__HANG__') { agg.hard_floor.no_hang = false; agg.hangs.push(seed); agg.notes.push('seed' + seed + ':HANG'); }
      else {
        for (const f of fam) { agg.per_family[f].pass += res.graded[f].pass; agg.per_family[f].total += res.graded[f].total; totalPass += res.graded[f].pass; totalTotal += res.graded[f].total; }
        if (res.throws > 0 || threw) { agg.hard_floor.no_throw = false; agg.throw_seeds.push(seed); }
        if (res.detail && res.detail.length) agg.notes.push('seed' + seed + ':' + res.detail.slice(0, 6).join(','));
      }
    } catch (e) {
      agg.hard_floor.no_throw = false; agg.throw_seeds.push(seed); agg.notes.push('seed' + seed + ':evalerr:' + String(e && e.message).slice(0, 60));
    } finally { try { await browser.close(); } catch {} }
  }

  server.close();
  agg.pass_rate = totalTotal ? +(totalPass / totalTotal).toFixed(4) : 0;
  agg.graded_pass = totalPass; agg.graded_total = totalTotal;
  agg.per_family_rate = {};
  for (const f of fam) { const pf = agg.per_family[f]; agg.per_family_rate[f] = pf.total ? +(pf.pass / pf.total).toFixed(3) : null; }
  emit(agg);
  process.exit(0);
}
main().catch((e) => { emit({ error: 'fatal: ' + String(e && e.message), loaded: false }); process.exit(0); });
