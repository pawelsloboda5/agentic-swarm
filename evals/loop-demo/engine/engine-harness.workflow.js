export const meta = {
  name: 'v0.9.0-harness-arm',
  description: 'Build K=3 deterministic sim engines THROUGH the architect harness: contract -> gated workstreams -> gated integration with bounded repair. Briefs derive ONLY from SPEC.md (no held-out F_FID leak).',
  phases: [
    { title: 'Contract' },
    { title: 'Workstreams' },
    { title: 'Integrate' },
  ],
}

// HELD-OUT INTEGRITY: run this in an ISOLATED COPY of evals/loop-demo/engine that does NOT contain
// scoring/ (the held-out scorer) -- otherwise builder agents discover and tune to it (observed live:
// two in-repo control builds read scoring/invariants.mjs before we isolated). The published v0.9.0 run
// used a sandbox outside the repo holding only SPEC.md + arms/. Set ROOT to your isolated copy's engine
// dir; finished engines are copied into the repo's arms/ for scoring only. ROOT must NOT contain
// scoring/invariants.mjs.
const ROOT = '/ABSOLUTE/PATH/TO/ISOLATED-COPY/evals/loop-demo/engine' // e.g. a tmp sandbox with only SPEC.md + arms/
const SPEC = ROOT + '/SPEC.md'
const ISOLATE = ' Build PURELY from the SPEC: read ONLY the SPEC + the contract, work ONLY within your assigned directory, and do NOT search the wider filesystem or look for any test/scorer/verification harness -- there is none to consult; implement and verify from first principles.'
const BUILDS = ['harness-1', 'harness-2', 'harness-3']

const CONTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    contract_path: { type: 'string' },
    state_fields: { type: 'array', items: { type: 'string' }, description: 'every world-state field snapshot must capture' },
    modules: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['ok', 'summary'],
}

const WS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    workstream: { type: 'string' },
    file: { type: 'string' },
    implemented: { type: 'array', items: { type: 'string' } },
    selfcheck: { type: 'string' },
    issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['workstream', 'file', 'selfcheck'],
}

const INTEGRATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    lines: { type: 'number' },
    requirements_verified: {
      type: 'object',
      additionalProperties: false,
      properties: {
        determinism: { type: 'boolean' },
        exact_save_load: { type: 'boolean' },
        idempotent_commands: { type: 'boolean' },
        conservation: { type: 'boolean' },
        monotonic_events: { type: 'boolean' },
      },
    },
    repairs_done: { type: 'number' },
    known_issues: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['ok', 'summary'],
}

// Workstreams reference ONLY the disclosed SPEC. NO held-out specifics (no restore-continue vectors,
// no adversarial scenario, no mention of the scorer) -- the symmetric requirement is in SPEC.md itself.
const WORKSTREAMS = [
  { key: 'commands', mission: 'Command handling: applyCommand(world,cmd) for setProd / inject / kill with the spec validation + clamping, idempotent by command id (a previously-applied id is a no-op), and graceful handling of out-of-range / negative / nonexistent / unknown commands (never throw).' },
  { key: 'systems', mission: 'The per-tick simulation: the six step systems in the fixed documented order (spawn, produce, move, transfer, interact, cleanup), all integer, all randomness via the documented LCG only, with the event emissions (spawn/mint/burn/hit/dead) carrying a strictly-increasing unique seq, and the resource accounting (mint on create, burn on destroy) kept exact.' },
  { key: 'persistence', mission: 'State serialization: snapshot(world) -> string, restore(string) -> world, and hashState(world) -> string. Per SPEC requirement #2 the snapshot MUST capture the ENTIRE world state so a restored world behaves identically going forward; enumerate every state field from the contract and make sure each is serialized AND included in hashState. drainEventLog(world) returns + clears pending events.' },
  { key: 'model', mission: 'The world data model + report(): createWorld(seed,config) building the full integer world (stations, units, counters, PRNG state), and report(world) -> {tick, unitCount, totalResources, minted, burned} where totalResources is the actual sum of every stockpile + every unit cargo and equals minted-burned.' },
]

function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

async function buildOne(b) {
  const dir = ROOT + '/arms/' + b
  // ---- Phase 0: contract ----
  phase('Contract')
  const contractPrompt =
    'You are the ARCHITECT (Phase 0) building a deterministic integer simulation engine.\n' +
    'Read the FULL spec at ' + SPEC + ' and conform to it exactly.\n' +
    'Write a tight SHARED CONTRACT to ' + dir + '/.contract.md so four parallel workstreams (commands, ' +
    'systems, persistence, model) build coherent pieces that integrate into ONE self-contained, offline ' +
    'index.html exposing window.ENGINE exactly as the spec requires. The contract MUST specify: (1) the full ' +
    'integer world-state object shape -- EVERY field, so nothing is forgotten; (2) the internal module ' +
    'boundaries + the exact functions each exposes and how they compose; (3) for persistence, an explicit ' +
    'CHECKLIST of every state field snapshot must serialize and hashState must include so the engine behaves ' +
    'identically after a restore (spec requirement #2); (4) the event helper + the {seq,type,amount} schema; ' +
    '(5) the mint/burn conservation discipline. Keep it concrete and implementable. Then return the schema ' +
    '(state_fields = the full field checklist; modules = the module names).' + ISOLATE
  let contract = await agent(contractPrompt, { label: b + ':contract', phase: 'Contract', schema: CONTRACT_SCHEMA, effort: 'high' })
  if (!contract) { log(b + ' contract dropped; retry'); contract = await agent(contractPrompt, { label: b + ':contract:retry', phase: 'Contract', schema: CONTRACT_SCHEMA, effort: 'high' }) }
  if (!contract || !contract.ok) { log(b + ' contract failed; skipping build'); return { build: b, ok: false, stage: 'contract' } }
  log(b + ' contract: ' + ((contract.state_fields || []).length) + ' state fields; modules=' + ((contract.modules || []).join(',')))

  // ---- Phase 2: workstreams (one wave of 4; retry the drops) ----
  phase('Workstreams')
  function runWs(w) {
    const p =
      'You are a WORKER (Phase 2) on the "' + w.key + '" workstream of a deterministic integer simulation engine.\n' +
      'FIRST read the shared contract at ' + dir + '/.contract.md AND the spec at ' + SPEC + '; conform to both EXACTLY ' +
      '(world-state shape, module function names, event schema, the persistence field checklist).\n\n' +
      'MISSION: ' + w.mission + '\n\n' +
      'Write clean self-contained JavaScript for your section to ' + dir + '/.workstreams/' + w.key + '.js with a short ' +
      'header listing the contract functions you implement. Integer-only; randomness only via the documented LCG; no ' +
      'external deps. Self-verify your section against the relevant spec correctness requirements before returning. ' +
      'Return the schema (file = path written; implemented = contract functions provided; selfcheck = how you verified; issues = anything unresolved).' + ISOLATE
    return agent(p, { label: b + ':ws:' + w.key, phase: 'Workstreams', schema: WS_SCHEMA, effort: 'high' })
  }
  let ws = await parallel(WORKSTREAMS.map(w => () => runWs(w)))
  const failed = []
  ws.forEach((r, i) => { if (!r) failed.push(i) })
  if (failed.length) {
    log(b + ' workstream retry wave: ' + failed.length + ' dropped')
    const retried = await parallel(failed.map(i => () => runWs(WORKSTREAMS[i])))
    retried.forEach((r, j) => { if (r) ws[failed[j]] = r })
  }
  const wsDone = ws.filter(Boolean)
  log(b + ' workstreams: ' + wsDone.length + '/' + WORKSTREAMS.length)

  // ---- Phase 3: gated integration (verify against the SPEC requirements; <=2 repairs) ----
  phase('Integrate')
  const integratePrompt =
    'You are the INTEGRATOR (Phase 3, gated integration) for the deterministic integer simulation engine.\n' +
    'Inputs on disk: the contract ' + dir + '/.contract.md and the four workstream drafts in ' + dir + '/.workstreams/ ' +
    '(commands.js, systems.js, persistence.js, model.js; some may be partial -- be robust and fill gaps yourself).\n\n' +
    'TASK: assemble ONE complete, self-contained, offline ' + dir + '/index.html (the entry file) exposing the full ' +
    'window.ENGINE API exactly per the spec at ' + SPEC + '. Reconcile the drafts against the contract into a coherent engine.\n\n' +
    'GATED INTEGRATION (do real verification work, up to 2 repair passes): after writing index.html, VERIFY that each of the ' +
    'five SPEC correctness requirements actually holds and FIX any that fail -- (1) determinism, (2) exact save/load per SPEC ' +
    'requirement #2, (3) idempotent commands, (4) resource conservation, (5) strictly-increasing unique event seqs. Design ' +
    'and run your own verification, then repair what breaks and write the final file. Return the schema HONESTLY: set ' +
    'requirements_verified to what is ACTUALLY true ' +
    'in the file you wrote (do not claim a requirement you did not check), lines = final line count, repairs_done = how many ' +
    'repair passes you ran.' + ISOLATE
  let integ = await agent(integratePrompt, { label: b + ':integrate', phase: 'Integrate', schema: INTEGRATE_SCHEMA, effort: 'high' })
  if (!integ) { log(b + ' integrate dropped; retry'); integ = await agent(integratePrompt, { label: b + ':integrate:retry', phase: 'Integrate', schema: INTEGRATE_SCHEMA, effort: 'high' }) }
  log(b + ' integrate: ok=' + (integ && integ.ok) + ' lines=' + (integ && integ.lines) + ' repairs=' + (integ && integ.repairs_done))
  return { build: b, ok: !!(integ && integ.ok), contract, workstreams: wsDone, integrated: integ }
}

const results = []
for (const b of BUILDS) {
  log('=== building ' + b + ' ===')
  results.push(await buildOne(b))
}
return { results, builds: BUILDS }
