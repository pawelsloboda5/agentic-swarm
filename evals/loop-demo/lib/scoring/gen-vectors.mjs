// Generate the frozen held-out vector set from the CORRECT reference + the authored edge inputs.
//   node gen-vectors.mjs        -> writes vectors.json
// Expected EDGE outputs are computed from reference/lib.mjs; they are then independently confirmed by
// a blind SPEC-only ambiguity scrubber (see SCRUB.md). Pre-lock invariant enforced here: no held-out
// edge input may coincide with a DISCLOSED happy example (else the edge leaks).
import { CFG } from './config.mjs';
import * as ref from './reference/lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const out = {};
let problems = 0;

for (const [name, cfg] of Object.entries(CFG)) {
  const fn = ref[name];
  if (typeof fn !== 'function') { console.error('REF MISSING:', name); problems++; continue; }
  // verify disclosed happy examples reproduce from the reference (sanity: SPEC examples are correct)
  const happy = [];
  for (const [args, expected] of cfg.happy) {
    const got = fn(...args);
    if (got !== expected) { console.error('HAPPY MISMATCH', name, JSON.stringify(args), 'ref=', JSON.stringify(got), 'spec=', JSON.stringify(expected)); problems++; }
    happy.push([args, expected]);
  }
  // pre-lock check: edge inputs must not coincide with any disclosed happy input
  const happyKeys = new Set(cfg.happy.map(([a]) => JSON.stringify(a)));
  const edges = [];
  for (const args of cfg.edgeInputs) {
    if (happyKeys.has(JSON.stringify(args))) { console.error('EDGE==HAPPY LEAK', name, JSON.stringify(args)); problems++; }
    const got = fn(...args);
    edges.push([args, got]);
  }
  out[name] = { kind: cfg.kind, happy, edges };
}

if (problems) { console.error('\n' + problems + ' problem(s) -- NOT writing vectors.json until clean'); process.exit(1); }
fs.writeFileSync(path.join(HERE, 'vectors.json'), JSON.stringify(out, null, 1));
console.log('wrote vectors.json:', Object.keys(out).length, 'exports,',
  Object.values(out).reduce((s, v) => s + v.edges.length, 0), 'edge vectors');
