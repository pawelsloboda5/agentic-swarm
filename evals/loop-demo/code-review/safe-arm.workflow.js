// SAFE-SWARM arm of the v0.5.0 code-review execution demo.
// Reviews the 43 axios lib/**/*.js files (>=25 lines) pinned in manifest.json, ONE agent per file.
// The per-file review agent below is BYTE-IDENTICAL to naive-arm.workflow.js — the ONLY difference
// between the two arms is the orchestration shape, so any coverage/robustness gap is attributable to
// it alone. Safe-swarm shape: bounded waves of 7 + retry wave + instability backoff + partial-
// synthesis that explicitly FLAGS any uncovered file (never silently drops a drop).
export const meta = {
  name: 'code-review-safe-swarm',
  description: 'SAFE-SWARM arm: bounded-wave code review of axios lib (retry wave + instability backoff + partial-synthesis that flags gaps)',
  phases: [{ title: 'Waves', detail: 'review files in waves of 7, commit per wave' }, { title: 'Retry', detail: 'one retry wave over dropped files' }, { title: 'Synthesize', detail: 'prioritized report; flag any uncovered file' }],
}

const ROOT = 'C:/Users/Pawel Sloboda/Desktop/loop-demo-corpus'
const FILES = [
  'lib/adapters/adapters.js', 'lib/adapters/fetch.js', 'lib/adapters/http.js', 'lib/adapters/xhr.js',
  'lib/axios.js', 'lib/cancel/CancelToken.js', 'lib/core/Axios.js', 'lib/core/AxiosError.js',
  'lib/core/AxiosHeaders.js', 'lib/core/InterceptorManager.js', 'lib/core/buildFullPath.js',
  'lib/core/dispatchRequest.js', 'lib/core/mergeConfig.js', 'lib/core/settle.js', 'lib/core/transformData.js',
  'lib/defaults/index.js', 'lib/helpers/AxiosTransformStream.js', 'lib/helpers/AxiosURLSearchParams.js',
  'lib/helpers/Http2Sessions.js', 'lib/helpers/HttpStatusCode.js', 'lib/helpers/ZlibHeaderTransformStream.js',
  'lib/helpers/buildURL.js', 'lib/helpers/composeSignals.js', 'lib/helpers/cookies.js',
  'lib/helpers/deprecatedMethod.js', 'lib/helpers/estimateDataURLDecodedBytes.js', 'lib/helpers/formDataToJSON.js',
  'lib/helpers/formDataToStream.js', 'lib/helpers/fromDataURI.js', 'lib/helpers/parseHeaders.js',
  'lib/helpers/progressEventReducer.js', 'lib/helpers/resolveConfig.js', 'lib/helpers/sanitizeHeaderValue.js',
  'lib/helpers/shouldBypassProxy.js', 'lib/helpers/speedometer.js', 'lib/helpers/spread.js',
  'lib/helpers/throttle.js', 'lib/helpers/toFormData.js', 'lib/helpers/trackStream.js', 'lib/helpers/validator.js',
  'lib/platform/common/utils.js', 'lib/platform/node/index.js', 'lib/utils.js',
]

// ---- SHARED review agent (KEEP BYTE-IDENTICAL to naive-arm.workflow.js) ----
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    purpose: { type: 'string', description: 'one line: what this module does' },
    findings: {
      type: 'array',
      items: { type: 'object', properties: {
        severity: { type: 'string', enum: ['high', 'medium', 'low', 'info'] },
        line: { type: 'string', description: 'line number(s) or "n/a"' },
        issue: { type: 'string' },
        suggestion: { type: 'string' },
      }, required: ['severity', 'issue'] },
      description: 'at most 6 findings, most severe first; if clean, a single info note',
    },
  },
  required: ['file', 'findings'],
}
function reviewPrompt(rel) {
  return `You are reviewing ONE source file from the axios HTTP library. Use the Read tool to read the file at:\n${ROOT}/${rel}\nThen report concrete code-review findings: correctness bugs, edge cases, security issues, resource leaks, and notable quality concerns. Be specific and cite line numbers. At most 6 findings, most severe first. If the file is clean, return a single 'info' finding saying so. Echo "file":"${rel}". Your output IS data; fill the schema.`
}
function runItem(rel) {
  return agent(reviewPrompt(rel), { label: `review:${rel}`, phase: 'Waves', schema: REVIEW_SCHEMA, effort: 'medium' })
}

// ---- SAFE-SWARM orchestration (the variable under test) ----
const WAVE_SIZE = 7, INSTABILITY = 0.4
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }
const waves = chunk(FILES, WAVE_SIZE)
const done = []
let failed = []
let backedOff = false

for (let w = 0; w < waves.length; w++) {
  phase('Waves')
  const batch = await parallel(waves[w].map(rel => () => runItem(rel).then(r => ({ rel, r }))))
  batch.forEach(x => (x && x.r ? done.push(x.r) : failed.push(x ? x.rel : null)))
  failed = failed.filter(Boolean)
  log(`Wave ${w + 1}/${waves.length}: ${done.length}/${FILES.length} reviewed, ${failed.length} to retry`)
  const nulls = batch.filter(x => !x || !x.r).length
  if (batch.length && nulls / batch.length > INSTABILITY) {
    log(`instability: ${nulls}/${batch.length} dropped this wave — backing off (return partial; resume recovers the rest)`)
    backedOff = true
    break
  }
}

if (!backedOff && failed.length) {
  phase('Retry')
  const retried = await parallel(failed.map(rel => () => runItem(rel).then(r => ({ rel, r }))))
  const still = []
  retried.forEach(x => (x && x.r ? done.push(x.r) : still.push(x ? x.rel : null)))
  failed = still.filter(Boolean)
  log(`Retry recovered ${retried.filter(x => x && x.r).length}; still missing ${failed.length}`)
}

const haveKeys = new Set(done.map(r => r.file))
const missing = FILES.filter(f => !haveKeys.has(f))
log(`coverage ${done.length}/${FILES.length}; missing: ${missing.join(', ') || 'none'}`)

phase('Synthesize')
const SYNTH = {
  type: 'object',
  properties: {
    report_markdown: { type: 'string', description: 'a prioritized cross-file code-review report in markdown: high-severity issues first (file + line + issue), then themes' },
    high_count: { type: 'number' },
    medium_count: { type: 'number' },
    gaps: { type: 'array', items: { type: 'string' }, description: 'files with NO review result this run — never omit' },
  },
  required: ['report_markdown', 'gaps'],
}
const payload = JSON.stringify([...done].sort((a, b) => (a.file > b.file ? 1 : -1)))
const synthesis = await agent(
  `Synthesize a prioritized code-review report for the axios library from these ${done.length} per-file reviews:\n${payload}\n\nUNREVIEWED files (no result this run): ${JSON.stringify(missing)}.\nProduce report_markdown: lead with HIGH then MEDIUM findings (file + line + issue + fix), then cross-file themes. List every unreviewed file in "gaps" — never present partial coverage as complete. Output IS data.`,
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTH, effort: 'high' }
)

return { arm: 'safe-swarm', total: FILES.length, reviewed: done.length, coverage: done.length / FILES.length, missing, backedOff, results: done, synthesis }
