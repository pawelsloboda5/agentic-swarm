# flaky-test-triage — `gpt-4.1-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for FLAKY-TEST TRIAGE: investigate 18 flaky tests. One subagent per test finds the root cause and proposes a fix. Then synthesize a prioritized fix plan, clearly flagging any test whose root cause could not be determined.

---

## Baseline (no skill) — rubric 20%, patterns 31%

````js
```js
export const meta = {
  name: 'flaky-test-triage',
  description: 'Investigate 18 flaky tests to find root causes and propose fixes, then synthesize a prioritized fix plan',
  phases: [
    { title: 'Investigate Tests' },
    { title: 'Synthesize Fix Plan' },
  ],
}

const flakyTests = [
  // Example test identifiers or names; in real usage these would come from args or be passed in
  'test-login-flaky',
  'test-payment-timeout',
  'test-ui-race-condition',
  'test-api-rate-limit',
  'test-db-connection-leak',
  'test-cache-invalidation',
  'test-file-upload',
  'test-email-notification',
  'test-session-expiry',
  'test-multi-threading',
  'test-config-loading',
  'test-async-callback',
  'test-memory-leak',
  'test-logging-flush',
  'test-data-migration',
  'test-auth-token-refresh',
  'test-queue-processing',
  'test-feature-flag',
]

phase('Investigate Tests')

/**
 * Schema for investigation result:
 * {
 *   rootCause: string, // description or "unknown"
 *   proposedFix: string, // fix proposal or "N/A"
 *   confidence: 'high'|'medium'|'low'|'unknown'
 * }
 */
const investigationSchema = {
  type: 'object',
  properties: {
    rootCause: { type: 'string' },
    proposedFix: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low', 'unknown'] },
  },
  required: ['rootCause', 'proposedFix', 'confidence'],
  additionalProperties: false,
}

async function investigateTest(testName) {
  const prompt = `You are a software engineer investigating a flaky test named "${testName}". 
Analyze possible root causes of flakiness for this test, considering common flaky test issues such as timing, race conditions, environment instability, dependencies, or test code problems. 
Provide a concise root cause explanation or state "unknown" if you cannot determine it. 
Then propose a fix or mitigation strategy for the flaky test, or "N/A" if none can be proposed. 
Finally, rate your confidence in this diagnosis as one of: high, medium, low, or unknown. 
Respond in JSON with keys: rootCause, proposedFix, confidence.`
  const result = await agent(prompt, { schema: investigationSchema, label: `Investigate ${testName}`, phase: 'Investigate Tests', effort: 'high' })
  return result
}

const investigations = await parallel(flakyTests.map(testName => () => investigateTest(testName)))

phase('Synthesize Fix Plan')

/**
 * Schema for fix plan item:
 * {
 *   testName: string,
 *   rootCause: string,
 *   proposedFix: string,
 *   confidence: 'high'|'medium'|'low'|'unknown',
 *   flagged: boolean
 * }
 */
const fixPlanItemSchema = {
  type: 'object',
  properties: {
    testName: { type: 'string' },
    rootCause: { type: 'string' },
    proposedFix: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low', 'unknown'] },
    flagged: { type: 'boolean' },
  },
  required: ['testName', 'rootCause', 'proposedFix', 'confidence', 'flagged'],
  additionalProperties: false,
}

const fixPlanItems = flakyTests.map((testName, i) => {
  const inv = investigations[i]
  if (!inv) {
    // Agent failed or skipped, treat as unknown
    return {
      testName,
      rootCause: 'unknown',
      proposedFix: 'N/A',
      confidence: 'unknown',
      flagged: true,
    }
  }
  const flagged = inv.rootCause.toLowerCase() === 'unknown' || inv.confidence === 'unknown'
  return {
    testName,
    rootCause: inv.rootCause,
    proposedFix: inv.proposedFix,
    confidence: inv.confidence,
    flagged,
  }
})

/**
 * Prioritize fix plan items:
 * 1. Flagged tests first (unknown root cause)
 * 2. Then by confidence descending: high > medium > low > unknown
 * 3. Then alphabetically by testName
 */
function confidenceRank(c) {
  switch (c) {
    case 'high': return 3
    case 'medium': return 2
    case 'low': return 1
    default: return 0
  }
}

fixPlanItems.sort((a, b) => {
  if (a.flagged !== b.flagged) return a.flagged ?
````

> **GPT-5.5 judge:** The script uses a single giant parallel() fan-out over all 18 tests, with no bounded waves, no ScheduleWakeup/stall watchdog, no per-agent retry or timeout handling, no per-wave persistence/commit, no resume/cache-stable prompts, and no high-failure-rate backoff. It does use lean JSON schemas and has some partial-input tolerance/flagging for missing investigation results, but because the parallel() call is a hard barrier and errors/hangs are not handled, one hung or failed agent could deadlock or lose completed work. The output is also truncated before completing the sort, further reducing safety.

## With skill — rubric 30%, patterns 75%

````js
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
  { key: 'test9', name: 'API rate limit test intermittent' },
  { key: 'test10', name: 'Cache invalidation flaky' },
  { key: 'test11', name: 'Email sending test fails randomly' },
  { key: 'test12', name: 'User profile update test flaky' },
  { key: 'test13', name: 'Background job test unstable' },
  { key: 'test14', name: 'Localization test intermittent' },
  { key: 'test15', name: 'Payment refund test flaky' },
  { key: 'test16', name: 'Load balancer test unstable' },
  { key: 'test17', name: 'Analytics event test flaky' },
  { key: 'test18', name: 'Security auth test intermittent' },
]

// Schema for investigation result per test
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
    prioritizedFixPlan: { type: 'string' },
    flaggedTests: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['prioritizedFixPlan', 'flaggedTests'],
  additionalProperties: false,
}

const WAVE_SIZE = 6
const chunk = (arr, n) => {
  const o = []
  for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n))
  return o
}

// Stable prompt builder for investigation per test
function buildInvestigationPrompt(test) {
  return `You are a software reliability engineer investigating a flaky test.

Test key: ${test.key}
Test name: ${test.name}

Task:
- Analyze the flaky test to identify the most likely root cause of its flakiness.
- Propose a concrete fix or mitigation for the root cause.
- Provide a confidence level in your diagnosis: one of high, medium, low, or unknown.
- If you cannot determine the root cause, set rootCause to "Unknown" and confidence to "unknown".

Return a JSON object with these fields:
- key: the test key
- testName: the test name
- rootCause: concise explanation of the root cause or "Unknown"
- fixProposal: concise description of the proposed fix or mitigation
- confidence: one of "high", "medium", "low", or "unknown"

Output ONLY the JSON object, no extra text.`
}

// Retry wrapper for one test investigation agent call
async function runInvestigation(test) {
  return await agent(buildInvestigationPrompt(test), {
    label: `investigate:${test.key}`,
    phase: 'Investigate',
    schema: INVESTIGATION_SCHEMA,
    effort: 'medium',
  })
}

phase('Investigate flaky tests')

const waves = chunk(TESTS, WAVE_SIZE)
const done = []
let failed = []

// Run investigation waves with retry backoff and instability backoff
for (let w = 0; w < waves.length; w++) {
  phase(`Wave ${w + 1}/${waves.length}`)
  const batch = await parallel(waves[w].map((test) => () => runInvestigation(test)))
  batch.forEach((r, i) => {
    if (r)
````

> **GPT-5.5 judge:** The script does use bounded waves of 6 and defines lean JSON schemas/prompts, which helps avoid one giant fan-out and caps outputs. However, the visible implementation lacks an armed ScheduleWakeup/stall watchdog, has no actual per-agent retry or timeout handling despite comments, awaits each wave as a hard barrier so one hung connection can deadlock the run, shows no durable per-wave commit/resume/cache mechanism, and the synthesis/partial-input gap-flagging logic is not present in the provided output. It is also truncated mid-loop, so completed work handling is unclear and potentially unsafe.

