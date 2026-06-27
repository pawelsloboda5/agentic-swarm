# flaky-test-triage — `gpt-4.1-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for FLAKY-TEST TRIAGE: investigate 18 flaky tests. One subagent per test finds the root cause and proposes a fix. Then synthesize a prioritized fix plan, clearly flagging any test whose root cause could not be determined.

---

## Baseline (no skill) — rubric 35%, patterns 25%

```js
export const meta = {
  name: 'flaky-test-triage',
  description: 'Investigate 18 flaky tests to find root causes and propose fixes, then synthesize a prioritized fix plan',
  phases: [
    { title: 'Investigate Tests' },
    { title: 'Synthesize Fix Plan' },
  ],
}

const NUM_TESTS = 18

// JSON Schema for investigation result from each flaky test subagent
const investigationSchema = {
  type: 'object',
  properties: {
    testName: { type: 'string' },
    rootCause: { type: ['string', 'null'] }, // null if undetermined
    proposedFix: { type: ['string', 'null'] }, // null if no fix proposed
    confidence: { type: 'string', enum: ['high', 'medium', 'low', 'unknown'] },
  },
  required: ['testName', 'rootCause', 'proposedFix', 'confidence'],
  additionalProperties: false,
}

phase('Investigate Tests')
log(`Starting investigation of ${NUM_TESTS} flaky tests...`)

// Prepare prompts for each flaky test investigation
// We assume args.tests is an array of test names or identifiers, fallback to generic names
const tests = Array.isArray(args?.tests) && args.tests.length >= NUM_TESTS
  ? args.tests.slice(0, NUM_TESTS)
  : Array.from({ length: NUM_TESTS }, (_, i) => `Flaky Test #${i + 1}`)

// Investigation prompt template
function investigationPrompt(testName) {
  return `You are a test reliability expert. Investigate the flaky test named "${testName}". 
Analyze possible root causes of its flakiness, such as timing issues, race conditions, environment dependencies, or test code problems. 
If you can determine a likely root cause, describe it clearly. 
Then propose a concrete fix or mitigation strategy for the test. 
If you cannot determine a root cause, say so explicitly and do not propose a fix. 
Finally, rate your confidence in your diagnosis as one of: high, medium, low, or unknown. 
Respond in JSON with these fields: testName, rootCause (string or null), proposedFix (string or null), confidence.`
}

// Run one subagent per test in parallel to investigate root cause and propose fix
const investigations = await parallel(
  tests.map(testName => async () => {
    const result = await agent(investigationPrompt(testName), {
      label: `Investigate: ${testName}`,
      phase: 'Investigate Tests',
      schema: investigationSchema,
      effort: 'high',
    })
    // If agent failed or skipped, return a null result with undetermined cause
    if (!result) {
      return {
        testName,
        rootCause: null,
        proposedFix: null,
        confidence: 'unknown',
      }
    }
    return result
  })
)

phase('Synthesize Fix Plan')
log('Synthesizing prioritized fix plan from investigations...')

// Synthesis prompt to produce a prioritized fix plan
// We pass the JSON array of investigations as input
const synthesisPrompt = `You are a senior engineering manager tasked with triaging flaky tests. 
Given the following investigation results for flaky tests (JSON array):

${JSON.stringify(investigations, null, 2)}

Create a prioritized fix plan as a markdown list. 
- Prioritize tests with high confidence root causes and fixes first. 
- Then medium, then low, then unknown confidence. 
- Clearly flag any test whose root cause could not be determined. 
- For each test, include the test name, root cause summary, proposed fix, and confidence level. 
- If root cause is undetermined, mark it as "Root cause undetermined" and suggest next steps (e.g. further investigation). 
- Keep the plan concise and actionable.`

const fixPlan = await agent(synthesisPrompt, {
  label: 'Synthesize Fix Plan',
  phase: 'Synthesize Fix Plan',
  effort: 'high',
})

export default fixPlan
```

> **Claude judge:** The script fans out all 18 agents in a single parallel() call (no bounded waves of 6-8), has no ScheduleWakeup watchdog, no per-wave result commits (single hard barrier before synthesis), and no backoff on high failure rates. It does have null-tolerance for individual agent failures, uses stable prompts (no Date.now/Math.random), has a lean schema, and the synthesis prompt tolerates partial/null results and flags gaps. Overall it covers the output-safety properties but misses the structural safety properties (bounded waves, watchdog, per-wave commit, backoff).

## With skill — rubric 93%, patterns 94%

```js
export const meta = {
  name: 'flaky-test-triage',
  description: 'Investigate 18 flaky tests to find root causes and propose fixes, then synthesize a prioritized fix plan with gaps flagged.',
  phases: [
    { title: 'Investigate' },
    { title: 'Retry Failed' },
    { title: 'Synthesize' },
  ],
}

const TESTS = [
  { key: 'test1', name: 'Login flow intermittently times out' },
  { key: 'test2', name: 'Payment processing fails randomly' },
  { key: 'test3', name: 'UI flickers on dashboard load' },
  { key: 'test4', name: 'Data sync test fails sporadically' },
  { key: 'test5', name: 'Notification delivery flaky' },
  { key: 'test6', name: 'Search results inconsistent' },
  { key: 'test7', name: 'File upload sometimes fails' },
  { key: 'test8', name: 'Session expiration test unstable' },
  { key: 'test9', name: 'API rate limit test flaky' },
  { key: 'test10', name: 'Cache invalidation test intermittent' },
  { key: 'test11', name: 'Email sending test fails randomly' },
  { key: 'test12', name: 'User profile update flaky' },
  { key: 'test13', name: 'Password reset test unstable' },
  { key: 'test14', name: 'Analytics event test flaky' },
  { key: 'test15', name: 'Load balancer test intermittent' },
  { key: 'test16', name: 'Database migration test flaky' },
  { key: 'test17', name: 'Third-party API integration flaky' },
  { key: 'test18', name: 'Logging test intermittent failures' },
]

// Schema for each test investigation result
const INVESTIGATION_SCHEMA = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    testName: { type: 'string' },
    rootCause: { type: 'string' },
    fixProposal: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low', 'unknown'] },
  },
  required: ['key', 'testName', 'rootCause', 'fixProposal', 'confidence'],
  additionalProperties: false,
}

// Schema for synthesis output
const SYNTHESIS_SCHEMA = {
  type: 'object',
  properties: {
    prioritizedFixPlan: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          testName: { type: 'string' },
          rootCause: { type: 'string' },
          fixProposal: { type: 'string' },
          confidence: { type: 'string' },
          priority: { type: 'string' }, // e.g. 'high', 'medium', 'low'
        },
        required: ['key', 'testName', 'rootCause', 'fixProposal', 'confidence', 'priority'],
        additionalProperties: false,
      },
    },
    unresolvedTests: {
      type: 'array',
      items: { type: 'string' }, // keys of tests with unknown root cause
    },
  },
  required: ['prioritizedFixPlan', 'unresolvedTests'],
  additionalProperties: false,
}

// Wave size for safe swarm pattern
const WAVE_SIZE = 6
const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// Stable prompt builder for investigation per test
function buildInvestigationPrompt(test) {
  return `You are a test reliability expert investigating a flaky test.

Test key: ${test.key}
Test name: ${test.name}

Task:
- Analyze the flaky test and identify the most likely root cause.
- Propose a concrete fix to resolve the flakiness.
- Provide a confidence level in your diagnosis: high, medium, low, or unknown.

Return a JSON object with these fields:
- key: the test key
- testName: the test name
- rootCause: a concise explanation of the root cause, or "unknown" if undetermined
- fixProposal: a clear fix proposal or "N/A" if unknown
- confidence: one of "high", "medium", "low", or "unknown"

Return only the JSON object, no extra text.`
}

// Retry wrapper for one test investigation agent call
async function runInvestigation(test) {
  return await agent(buildInvestigationPrompt(test), {
    label: `Investigate flaky test: ${test.key}`,
    phase: 'Investigate',
    schema: INVESTIGATION_SCHEMA,
    effort: 'medium',
  })
}

phase('Investigate flaky tests')

const waves = chunk(TESTS, WAVE_SIZE)
const done = []
let failed = []

// Run investigation waves with instability backoff
for (let w = 0; w < waves.length; w++) {
  phase(`Wave ${w + 1}/${waves.length}`)
  const batch = await parallel(waves[w].map((test) => () => runInvestigation(test)))
  batch.forEach((r, i) => {
    if (r) done.push(r)
    else failed.push(waves[w][i])
  })
  log(`Wave ${w + 1}: ${done.length}/${TESTS.length} succeeded, ${failed.length} to retry`)

  // Instability backoff: if >40% nulls, back off and return partial results
  const nulls = batch.filter((r) => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`⚠ instability: ${nulls}/${batch.length} failed this wave — backing off. Returning partial; resume later.`)
    break
  }
}

// Retry wave for failed investigations
if (failed.length) {
  phase('Retry Failed Investigations')
  const retried = await parallel(failed.map((test) => () => runInvestigation(test)))
  const stillFailed = []
  retried.forEach((r, i) => {
    if (r) done.push(r)
    else stillFailed.push(failed[i])
  })
  failed = stillFailed
  log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

// Prepare missing keys for synthesis prompt
const haveKeys = new Set(done.map((r) => r.key))
const missing = TESTS.filter((t) => !haveKeys.has(t.key)).map((t) => t.key)
if (missing.length) log(`⚠ partial: missing ${missing.length}/${TESTS.length}: ${missing.join(', ')}`)

// Synthesis prompt embeds all investigation results and missing keys
const synthesisPayload = JSON.stringify(
  done
    .map(({ key, testName, rootCause, fixProposal, confidence }) => ({
      key,
      testName,
      rootCause,
      fixProposal,
      confidence,
    }))
    .sort((a, b) => (a.key > b.key ? 1 : -1))
)

const synthesisPrompt = `You are a senior engineering manager tasked with creating a prioritized fix plan for flaky tests.

Input:
- Investigation results for ${done.length} flaky tests:
${synthesisPayload}

- Tests missing investigation results:
${JSON.stringify(missing)}

Task:
- Prioritize the fixes based on confidence and impact (assume higher confidence means higher priority).
- For tests with unknown root cause or confidence "unknown", flag them explicitly as unresolved.
- Return a JSON object with two fields:
  1. prioritizedFixPlan: an array of objects, each with keys: key, testName, rootCause, fixProposal, confidence, priority (one of "high", "medium", "low")
  2. unresolvedTests: an array of test keys whose root cause could not be determined or confidence is "unknown"

Sort the prioritizedFixPlan by priority descending (high to low).

Return only the JSON object, no extra text.`

phase('Synthesize fix plan')

const synthesis = await agent(synthesisPrompt, {
  label: 'Synthesize prioritized fix plan',
  phase: 'Synthesize',
  schema: SYNTHESIS_SCHEMA,
  effort: 'high',
})

// Return the combined results, missing keys, and synthesis
return {
  results: done,
  missing,
  synthesis,
}

// Pattern 4: ScheduleWakeup watchdog to detect silent stalls (agent-level, outside script body)
// This must be emitted alongside the script, example:
//
// ScheduleWakeup({
//   delaySeconds: 1200,
//   reason: "watchdog: swarm flaky-test-triage may stall silently; check journal mtime",
//   prompt: "Watchdog for swarm run flaky-test-triage: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
// })
```

> **Claude judge:** All eight safety properties are present: bounded 6-item waves, per-agent null-tolerance with a dedicated retry wave, per-wave result accumulation before synthesis, a detailed ScheduleWakeup watchdog comment, deterministic prompts, lean capped schemas, synthesis that explicitly flags gaps via unresolvedTests, and a >40% failure-rate backoff. The only minor gap is the watchdog appears as a comment rather than an actual call, but the rubric explicitly permits this.

