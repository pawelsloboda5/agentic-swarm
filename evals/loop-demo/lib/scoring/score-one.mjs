// Score ONE export of an arm, in its OWN process (per-export isolation: a hang/crash here costs
// exactly 1/40 because aggregate.py runs this once per export with a per-export timeout).
//   node score-one.mjs <armDir-or-lib.mjs> <exportName>
// Emits ONE JSON line. Held-out: this file + config.mjs + vectors.json must NOT be reachable in any
// build sandbox.
import { CFG, GENERATORS, mkRng } from './config.mjs';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const VECTORS = JSON.parse(fs.readFileSync(path.join(HERE, 'vectors.json'), 'utf8'));
const ENCODERS = new Set(['hexEncode', 'base64Encode', 'base32Encode', 'toRadix', 'percentEncode', 'escapeHtml', 'csvEscape', 'caesarEncode', 'runLengthEncode', 'toRoman', 'zigzagEncode', 'grayEncode']);

function emit(o) { process.stdout.write(JSON.stringify(o) + '\n'); }

async function main() {
  const armArg = process.argv[2];
  const name = process.argv[3];
  const cfg = CFG[name];
  const vec = VECTORS[name];
  if (!cfg || !vec) { emit({ export: name, error: 'unknown export' }); return; }

  let armPath = armArg;
  if (!armPath.endsWith('.mjs')) armPath = path.join(armPath, 'lib.mjs');
  let lib;
  try { lib = await import(url.pathToFileURL(armPath).href); }
  catch (e) { emit({ export: name, present: false, happy_ok: false, happy_pass: 0, happy_total: vec.happy.length, edge_pass: 0, edge_total: vec.edges.length, edge_ok: false, prop_ok: null, threw: true, import_error: String(e && e.message).slice(0, 120) }); return; }

  const fn = lib[name];
  const present = typeof fn === 'function';
  let threw = false;
  const call = (args) => { try { return { v: fn(...args) }; } catch (e) { threw = true; return { err: true }; } };
  const callP = (f, args) => { try { return { v: f(...args) }; } catch (e) { threw = true; return { err: true }; } };

  if (!present) { emit({ export: name, present: false, happy_ok: false, happy_pass: 0, happy_total: vec.happy.length, edge_pass: 0, edge_total: vec.edges.length, edge_ok: false, prop_ok: null, threw: true }); return; }

  // ---- disclosed happy (omission axis) ----
  let happy_pass = 0;
  for (const [args, expected] of vec.happy) { const r = call(args); if (!r.err && r.v === expected) happy_pass++; }
  const happy_ok = happy_pass === vec.happy.length;

  // ---- held-out edge forward vectors (edge axis) ----
  let edge_pass = 0;
  for (const [args, expected] of vec.edges) { const r = call(args); if (!r.err && r.v === expected) edge_pass++; }
  const edge_ok = edge_pass === vec.edges.length;

  // ---- property axis (A1, reference-free) ----
  let prop_ok = null; // null = not applicable to this kind/direction
  const gen = GENERATORS[cfg.gen] ? GENERATORS[cfg.gen](mkRng(20260628)) : { core: [], edge: [] };
  const corpusArgs = [...gen.core, ...gen.edge, ...cfg.happy.map(([a]) => a), ...cfg.edgeInputs];
  if (cfg.kind === 'involution') {
    prop_ok = true;
    for (const args of corpusArgs) { const r1 = call(args); if (r1.err) { prop_ok = false; break; } const r2 = call([r1.v]); if (r2.err || r2.v !== args[0]) { prop_ok = false; break; } }
  } else if (cfg.kind === 'canon') {
    prop_ok = true;
    for (const args of corpusArgs) { const r1 = call(args); if (r1.err) { prop_ok = false; break; } const r2 = call([r1.v]); if (r2.err || r2.v !== r1.v) { prop_ok = false; break; } }
  } else if (cfg.kind === 'pair' && ENCODERS.has(name)) {
    const partner = lib[cfg.partner];
    if (typeof partner !== 'function') prop_ok = false;
    else { prop_ok = true; for (const args of corpusArgs) { const r1 = call(args); if (r1.err) { prop_ok = false; break; } const back = callP(partner, [r1.v, ...args.slice(1)]); if (back.err || back.v !== args[0]) { prop_ok = false; break; } } }
  }

  emit({ export: name, ws: cfg.ws, kind: cfg.kind, present, happy_ok, happy_pass, happy_total: vec.happy.length, edge_pass, edge_total: vec.edges.length, edge_ok, prop_ok, threw });
}
main().catch((e) => { emit({ export: process.argv[3], error: 'fatal: ' + String(e && e.message).slice(0, 120) }); });
