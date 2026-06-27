// NAIVE arm of the v0.5.0 code-review execution demo.
// Same 43 axios files, SAME per-file review agent as safe-arm.workflow.js (keep it byte-identical) —
// the ONLY difference is the orchestration: one single barrier over all files, NO retry, NO waves,
// NO instability backoff, and synthesis over whatever survived with NO gap-flagging. This is the
// shape models tend to write WITHOUT the agentic-swarm skill (and what the promptfoo eval scores):
// a dropped agent's file is silently absent and the report reads as complete.
export const meta = {
  name: 'code-review-naive',
  description: 'NAIVE arm: single-barrier code review of axios lib (no retry, no waves, no gap-flagging) — silent coverage loss on any drop',
  phases: [{ title: 'Review', detail: 'one parallel() barrier over all 43 files' }, { title: 'Synthesize', detail: 'report over whatever survived (no gap list)' }],
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

// ---- SHARED review agent (KEEP BYTE-IDENTICAL to safe-arm.workflow.js) ----
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
  return agent(reviewPrompt(rel), { label: `review:${rel}`, phase: 'Review', schema: REVIEW_SCHEMA, effort: 'medium' })
}

// ---- NAIVE orchestration: ONE barrier over everything, drops silently filtered, no gap accounting ----
phase('Review')
const all = await parallel(FILES.map(rel => () => runItem(rel)))   // single hard barrier over all 43
const reviewed = all.filter(Boolean)                               // nulls (drops) silently disappear
log(`barrier returned ${reviewed.length}/${FILES.length} (dropped agents are silently gone)`)

phase('Synthesize')
const SYNTH = {
  type: 'object',
  properties: {
    report_markdown: { type: 'string', description: 'a prioritized cross-file code-review report in markdown: high-severity issues first (file + line + issue), then themes' },
    high_count: { type: 'number' },
    medium_count: { type: 'number' },
  },
  required: ['report_markdown'],
}
// Note: synthesis is told only about the survivors — it has no idea any file is missing, so the
// report presents partial coverage as complete (the silent-truncation failure mode).
const synthesis = await agent(
  `Synthesize a prioritized code-review report for the axios library from these ${reviewed.length} per-file reviews:\n${JSON.stringify(reviewed)}\n\nProduce report_markdown: lead with HIGH then MEDIUM findings (file + line + issue + fix), then cross-file themes. Output IS data.`,
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTH, effort: 'high' }
)

return { arm: 'naive', total: FILES.length, reviewed: reviewed.length, coverage: reviewed.length / FILES.length, results: reviewed, synthesis }
