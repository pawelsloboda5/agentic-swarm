// ============================================================================
// safe-swarm-template.js  —  a Workflow() script that is safe by construction.
//
// Implements all 8 patterns from the agentic-swarm skill:
//   1 waves of 6-8 (not one mega-pipeline)   5 stable finder prompts + re-running synthesis
//   2 retry wrapper + retry wave             6 lean outputs
//   3 per-wave commit (no global barrier)    7 graceful partial-synthesis + gap flagging
//   4 watchdog (armed OUTSIDE — see below)   8 instability backoff
//
// HOW TO USE
//   1. Copy this file's body into a Workflow({ script: ... }) call (or save and pass
//      scriptPath). Fill in ITEMS, the *_SCHEMA objects, and the *Prompt() builders.
//   2. The Workflow tool result gives you a `runId` (wf_...), a `scriptPath`, and a launch
//      <task-notification> with the task id.
//   3. IMMEDIATELY arm the watchdog from your MAIN session (NOT from this script — ScheduleWakeup
//      is a main-loop tool, not a workflow hook). See reference/watchdog.md for the exact call.
//
// SANDBOX CONSTRAINTS this file respects (do not violate them):
//   - Date.now() / Math.random() / argless new Date() THROW. So: timer-free backoff, and item
//     identity comes from a stable `key`, never randomness.
//   - meta MUST be a pure literal (no variables/among/spreads/function calls).
//   - Concurrency is capped at min(16, cores-2) per workflow; a 6-8 wave runs truly parallel.
// ============================================================================

export const meta = {
  name: 'safe-swarm',
  description: 'Bounded-wave swarm: retry waves, per-wave commit, instability backoff, partial-synthesis',
  phases: [
    { title: 'Waves',      detail: 'Fan out items in waves of 6-8, commit results per wave' },
    { title: 'Retry',      detail: 'One retry wave over agents that returned null' },
    { title: 'Synthesize', detail: 'Synthesize over whatever completed; flag missing items' },
  ],
}

// ---------------------------------------------------------------------------
// 1. INPUTS — replace with your real work-list. `key` MUST be stable (drives the resume cache).
// ---------------------------------------------------------------------------
const ITEMS = [
  { key: 'a1', title: '…', scope: '…' },
  { key: 'a2', title: '…', scope: '…' },
  // … as many as you need (single parallel/pipeline call accepts ≤4096; total agents ≤1000)
]

// Tuning knobs.
const WAVE_SIZE = 6           // 6-8: exposure window per await + reaction granularity (Pattern 1)
const INSTABILITY = 0.4       // if > 40% of a wave returns null, back off (Pattern 8)

// ---------------------------------------------------------------------------
// 2. SCHEMAS — keep fields short/scalar so streams stay short and .output stays < ~192 KB (Pattern 6).
// ---------------------------------------------------------------------------
const ITEM_SCHEMA = {
  type: 'object',
  properties: {
    key:      { type: 'string' },                                   // echo the item key back -> self-identifying result
    findings: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, url: { type: 'string' }, why: { type: 'string' },
      evidence: { type: 'array', items: { type: 'string' }, description: 'AT MOST 3 source URLs — no long quotes' },
    }, required: ['name', 'url', 'why'] } },
    notes: { type: 'string', description: 'gaps / surprises, one or two lines' },
  },
  required: ['key', 'findings'],
}
const SYNTH_SCHEMA = {
  type: 'object',
  properties: {
    deliverable: { type: 'string' },
    gaps:        { type: 'array', items: { type: 'string' }, description: 'missing items + thin-evidence items — NEVER omit' },
  },
  required: ['deliverable', 'gaps'],
}

// ---------------------------------------------------------------------------
// 3. PROMPTS — keep finder prompts STABLE across resumes (Pattern 5). Embed only the item's own
//    fields (stable), nothing run-varying. Ask for LEAN output (Pattern 6).
// ---------------------------------------------------------------------------
function buildPrompt(it) {
  return `ROLE: research one item for a swarm. ITEM key="${it.key}": ${it.title}\nSCOPE: ${it.scope}\n` +
    `Return AT MOST 8 findings. Each: name, url, one-line why, <=3 evidence URLs (no long quotes — link the source).\n` +
    `Echo "key":"${it.key}" in your output. Your output IS data (not a message); fill the schema.`
}

// ---------------------------------------------------------------------------
// 4. RETRY WRAPPER (Pattern 2). agent() already retries internally and returns null on terminal
//    failure, so the wrapper's job is just to be the single, stable spawn point for one item.
//    (Optional soft timeout via Promise.race is shown commented — ONLY enable if a probe proves
//    setTimeout exists in the sandbox; the watchdog is the authoritative timeout regardless.)
// ---------------------------------------------------------------------------
function runItem(it) {
  return agent(buildPrompt(it), { label: `item:${it.key}`, phase: 'Waves', schema: ITEM_SCHEMA, effort: 'medium' })
  // const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))])
  // return withTimeout(agent(buildPrompt(it), {...}), 240_000)   // best-effort only — see Pattern 2
}

const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }

// ===========================================================================
// ORCHESTRATION
// ===========================================================================
const waves = chunk(ITEMS, WAVE_SIZE)
const done = []        // results collected so far — committed per wave (Pattern 3), survives a later stall
let failed = []        // items whose agent returned null (retry later, Pattern 2)
let backedOff = false

for (let w = 0; w < waves.length; w++) {
  phase('Waves')
  log(`Wave ${w + 1}/${waves.length} (${waves[w].length} agents)`)
  // Wave-sized barrier ONLY. A hung item blocks at most this wave, not the whole run (Pattern 1).
  const batch = await parallel(waves[w].map(it => () => runItem(it)))
  batch.forEach((r, i) => (r ? done.push(r) : failed.push(waves[w][i])))
  log(`  -> ${done.length}/${ITEMS.length} ok, ${failed.length} queued for retry`)

  // Pattern 8 — instability backoff: a wave full of nulls means a connection-error spike.
  const nulls = batch.filter(r => r === null).length
  if (batch.length && nulls / batch.length > INSTABILITY) {
    log(`Instability: ${nulls}/${batch.length} failed — backing off. Returning partial; RESUME later (cache keeps the rest).`)
    backedOff = true
    break
  }
}

// Pattern 2 — one retry wave over the nulls. Backoff = the time the other waves already took (timer-free).
if (!backedOff && failed.length) {
  phase('Retry')
  log(`Retry wave over ${failed.length} failed items`)
  const retried = await parallel(failed.map(it => () => runItem(it)))
  const stillFailed = []
  retried.forEach((r, i) => (r ? done.push(r) : stillFailed.push(failed[i])))
  failed = stillFailed
  log(`  -> recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

// Pattern 7 — compute the missing set explicitly; never silently drop.
// (If your schema self-identifies by a different field than `key` — e.g. results carry
//  `subarea` — swap `r.key` for that field, or use `r.key ?? r.subarea` as a fallback.)
const haveKeys = new Set(done.map(r => r.key))
const missing = ITEMS.filter(it => !haveKeys.has(it.key)).map(it => it.key)
if (missing.length) log(`PARTIAL: missing ${missing.length}/${ITEMS.length}: ${missing.join(', ')}`)

// Pattern 5 + 7 — synthesis EMBEDS its inputs (sorted, deterministic) so that on resume, when
// `done` grows, the prompt string changes -> cache miss -> synthesis RE-RUNS over the fuller set
// (a static synthesis prompt would serve a stale partial from cache). It is told to flag gaps.
phase('Synthesize')
const payload = JSON.stringify([...done].sort((a, b) => (a.key > b.key ? 1 : -1)))
const synthesis = await agent(
  `Synthesize the final deliverable from these ${done.length} results:\n${payload}\n\n` +
  `MISSING items (no result this run): ${JSON.stringify(missing)}.\n` +
  `Produce the deliverable from what IS present, and list every gap / thin-evidence item in "gaps". ` +
  `Never present partial coverage as complete. Output IS data.`,
  { label: 'synth', phase: 'Synthesize', schema: SYNTH_SCHEMA, effort: 'high' }
)

// Return the data AND the coverage truth, so the caller (and any resume) knows exactly what's missing.
return { results: done, missing, backedOff, synthesis }
