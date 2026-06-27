# flaky-test-triage — `gpt-5.4-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for FLAKY-TEST TRIAGE: investigate 18 flaky tests. One subagent per test finds the root cause and proposes a fix. Then synthesize a prioritized fix plan, clearly flagging any test whose root cause could not be determined.

---

## Baseline (no skill) — rubric 15%, patterns 13%

```js
export const meta = {
  name: 'flaky-test-triage',
  description: 'Investigate flaky tests, identify root causes, and synthesize a prioritized fix plan.',
  phases: [
    { title: 'Analyze flaky tests' },
    { title: 'Synthesize fix plan' },
  ],
}

const tests = Array.isArray(args?.tests) ? args.tests : []

if (tests.length !== 18) {
  log(`Expected 18 flaky tests, received ${tests.length}. Proceeding with the provided list.`)
}

phase('Analyze flaky tests')

const analyses = await parallel(
  tests.map((test, index) => async () => {
    const testLabel =
      typeof test === 'string'
        ? test
        : test?.name || test?.id || `test-${index + 1}`

    const prompt = `
You are investigating one flaky test as part of a larger triage effort.

Test identifier:
${JSON.stringify(test, null, 2)}

Your task:
1. Determine the most likely root cause of the flakiness.
2. Propose a concrete fix or mitigation.
3. State your confidence.
4. If the root cause cannot be determined from the available information, explicitly say so and explain what is missing.

Return a concise but complete investigation summary with these fields:
- test
- rootCause
- proposedFix
- confidence
- evidence
- unknowns

Be specific and actionable. Do not speculate beyond the evidence.
`
    const result = await agent(prompt, {
      label: testLabel,
      phase: 'Analyze flaky tests',
      effort: 'high',
    })

    return {
      test: testLabel,
      raw: result,
    }
  })
)

phase('Synthesize fix plan')

const synthesisInput = analyses.map((entry, index) => ({
  index: index + 1,
  test: entry?.test,
  analysis: entry?.raw ?? null,
}))

const synthesisPrompt = `
You are synthesizing a prioritized fix plan for 18 flaky tests.

Input analyses:
${JSON.stringify(synthesisInput, null, 2)}

Your goals:
1. Produce a prioritized fix plan across all tests.
2. Group related tests by shared root cause or shared remediation when helpful.
3. Clearly flag any test whose root cause could not be determined.
4. Separate immediate fixes from longer-term stabilizations.
5. Call out risks, dependencies, and suggested ownership if inferable.
6. If multiple tests appear to share the same underlying issue, deduplicate them into one remediation item and reference all affected tests.

Output format:
- Executive summary
- Prioritized fix plan
  - Each item should include: priority, affected tests, root cause, fix, rationale, confidence, and whether root cause is undetermined
- Undetermined cases
- Recommended sequencing
- Open questions / follow-ups

Be concise, but ensure the plan is specific enough to hand to an engineer.
`

const plan = await agent(synthesisPrompt, {
  label: 'Prioritize fix plan',
  phase: 'Synthesize fix plan',
  effort: 'high',
})

export default {
  analyzedTests: analyses,
  fixPlan: plan,
}
```

> **GPT-5.5 judge:** The script uses a single parallel() fan-out over all 18 tests with no bounded waves, no per-agent retry or timeout/null-tolerance, no per-wave result commits, no ScheduleWakeup watchdog, no resume/cache-stable prompts, and no backoff on high failure rates. A hung or failed agent could block or fail the whole run, and completed work is only retained after the hard parallel barrier. It does ask agents for concise structured summaries and the synthesis prompt explicitly flags undetermined cases/partial nulls, but the orchestration itself is not safe-by-construction for large fan-out.

## With skill — rubric 55%, patterns 81%

```js
export const meta = {
  name: 'flaky-test-triage',
  description: 'Investigate 18 flaky tests with per-test root cause analysis and synthesize a prioritized fix plan',
  phases: [
    { title: 'Investigate' },
    { title: 'Retry' },
    { title: 'Synthesize' },
  ],
}

const INPUT_TESTS = Array.isArray(args?.tests) ? args.tests : []
const DEFAULT_TESTS = Array.from({ length: 18 }, (_, i) => ({
  id: `test-${String(i + 1).padStart(2, '0')}`,
  name: `flaky test ${i + 1}`,
}))
const TESTS = INPUT_TESTS.length ? INPUT_TESTS : DEFAULT_TESTS

const WAVE_SIZE = 6
const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const TEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'rootCauseKnown', 'rootCause', 'proposedFix', 'priority', 'evidence', 'confidence'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    rootCauseKnown: { type: 'boolean' },
    rootCause: { type: 'string' },
    proposedFix: { type: 'string' },
    priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
    evidence: {
      type: 'array',
      maxItems: 5,
      items: { type: 'string' },
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
}

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'prioritizedPlan', 'undeterminedTests', 'crossCuttingThemes'],
  properties: {
    summary: { type: 'string' },
    prioritizedPlan: {
      type: 'array',
      maxItems: 30,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['priority', 'testId', 'testName', 'rootCauseKnown', 'rootCause', 'proposedFix', 'nextSteps'],
        properties: {
          priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          testId: { type: 'string' },
          testName: { type: 'string' },
          rootCauseKnown: { type: 'boolean' },
          rootCause: { type: 'string' },
          proposedFix: { type: 'string' },
          nextSteps: { type: 'array', maxItems: 5, items: { type: 'string' } },
        },
      },
    },
    undeterminedTests: {
      type: 'array',
      maxItems: 18,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['testId', 'testName', 'whatWasMissing', 'recommendedFollowUp'],
        properties: {
          testId: { type: 'string' },
          testName: { type: 'string' },
          whatWasMissing: { type: 'string' },
          recommendedFollowUp: { type: 'string' },
        },
      },
    },
    crossCuttingThemes: {
      type: 'array',
      maxItems: 12,
      items: { type: 'string' },
    },
  },
}

function buildInvestigationPrompt(test) {
  return [
    `You are triaging one flaky test. Investigate the most likely root cause and propose a concrete fix.`,
    `Be concise and evidence-driven. If the root cause cannot be determined from available context, say so explicitly.`,
    ``,
    `Test ID: ${test.id}`,
    `Test name: ${test.name}`,
    test.description ? `Test description: ${test.description}` : null,
    test.failureSignature ? `Failure signature: ${test.failureSignature}` : null,
    test.stackTrace ? `Stack trace: ${test.stackTrace}` : null,
    test.logExcerpt ? `Log excerpt: ${test.logExcerpt}` : null,
    test.recentChanges ? `Recent changes: ${test.recentChanges}` : null,
    ``,
    `Return a JSON object matching the schema.`,
    `Guidance:`,
    `- Identify the root cause if possible, not just symptoms.`,
    `- Include only short evidence bullets; prefer filenames, error strings, or log phrases.`,
    `- Propose one primary fix, not a brainstorming list.`,
    `- Use priority P0 for severe/broad/regression-prone issues, P1 for likely fixes with meaningful impact, P2 for narrower issues, P3 for low-impact or cleanup items.`,
    `- If uncertain, set rootCauseKnown=false and explain what's missing in the rootCause field.`,
  ].filter(Boolean).join('\n')
}

function buildRetryPrompt(test) {
  return [
    `Retry a flaky-test investigation for better determination of root cause.`,
    `Focus on missing evidence, inconsistent failure modes, or overlooked shared causes.`,
    ``,
    `Test ID: ${test.id}`,
    `Test name: ${test.name}`,
    test.description ? `Test description: ${test.description}` : null,
    test.failureSignature ? `Failure signature: ${test.failureSignature}` : null,
    test.stackTrace ? `Stack trace: ${test.stackTrace}` : null,
    test.logExcerpt ? `Log excerpt: ${test.logExcerpt}` : null,
    test.recentChanges ? `Recent changes: ${test.recentChanges}` : null,
    ``,
    `Return the same JSON schema as before.`,
    `If the root cause still cannot be determined, keep rootCauseKnown=false and be explicit about the blocker.`,
  ].filter(Boolean).join('\n')
}

function normalizeResult(test, result) {
  if (!result || typeof result !== 'object') {
    return {
      id: test.id,
      name: test.name,
      rootCauseKnown: false,
      rootCause: 'Investigation did not return a usable result.',
      proposedFix: 'Re-run with more context from failing logs, code paths, and recent diffs.',
      priority: 'P2',
      evidence: [],
      confidence: 'low',
    }
  }
  return result
}

async function runTestInvestigation(test, phaseName) {
  const result = await agent(buildInvestigationPrompt(test), {
    label: `investigate:${test.id}`,
    phase: phaseName,
    schema: TEST_SCHEMA,
    effort: 'high',
  })
  return normalizeResult(test, result)
}

async function runRetryInvestigation(test) {
  const result = await agent(buildRetryPrompt(test), {
    label: `retry:${test.id}`,
    phase: 'Retry',
    schema: TEST_SCHEMA,
    effort: 'high',
  })
  return normalizeResult(test, result)
}

const waves = chunk(TESTS, WAVE_SIZE)
const done = []
let failed = []

phase('Investigate')
for (let w = 0; w < waves.length; w++) {
  const wave = waves[w]
  log(`Investigating wave ${w + 1}/${waves.length} (${wave.length} tests)`)
  const batch = await parallel(wave.map(test => () => runTestInvestigation(test, 'Investigate')))
  batch.forEach((r, i) => {
    if (r) done.push(r)
    else failed.push(wave[i])
  })
  const nulls = batch.filter(r => r === null).length
  log(`Wave ${w + 1}: ${done.length}/${TESTS.length} investigated, ${failed.length} pending retry`)
  if (nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} failed this wave — backing off; return partial, resume later`)
    break
  }
}

if (failed.length) {
  phase('Retry')
  log(`Retrying ${failed.length} tests with refined prompts`)
  const retried = await parallel(failed.map(test => () => runRetryInvestigation(test)))
  const stillFailed = []
  retried.forEach((r, i) => {
    if (r) done.push(r)
    else stillFailed.push(failed[i])
  })
  failed = stillFailed
  log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

const have = new Set(done.map(r => r.id).filter(Boolean))
const missing = TESTS.filter(test => !have.has(test.id)).map(test => test.id)
if (missing.length) log(`partial: missing ${missing.length}/${TESTS.length}: ${missing.join(', ')}`)

phase('Synthesize')
const synthesisPayload = {
  tests: done.slice().sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0)),
  missing,
}
const synthesisPrompt = [
  `Synthesize a prioritized fix plan for 18 flaky tests from the investigation results below.`,
  `You must clearly flag any test whose root cause could not be determined.`,
  `Prioritize fixes by severity, breadth of impact, and likelihood of reducing flakiness.`,
  `Do not silently omit gaps.`,
  ``,
  `Investigation results JSON:`,
  JSON.stringify(synthesisPayload),
  ``,
  `Return a JSON object matching the schema.`,
  `Requirements:`,
  `- Include a prioritizedPlan ordered from highest to lowest priority.`,
  `- Include undeterminedTests for every test where rootCauseKnown is false or the result is missing.`,
  `- Mention cross-cutting themes that affect multiple tests.`,
  `- Keep next steps concrete and short.`,
].join('\n')

const synthesis = await agent(synthesisPrompt, {
  label: 'synthesize:fix-plan',
  phase: 'Synthesize',
  schema: PLAN_SCHEMA,
  effort: 'high',
})

const undeterminedTests = []
const prioritizedPlan = []
for (const test of TESTS) {
  const res = done.find(r => r.id === test.id)
  if (!res) {
    undeterminedTests.push({
      testId: test.id,
      testName: test.name,
      whatWasMissing: 'No agent result was available for this test.',
      recommendedFollowUp: 'Re-run the investigation with the failing logs, stack trace, and recent code changes for this test.',
    })
    continue
  }
  prioritizedPlan.push({
    priority: res.priority,
    testId: res.id,
    testName: res.name,
    rootCauseKnown: !!res.rootCauseKnown,
    rootCause: res.rootCause,
    proposedFix: res.proposedFix,
    nextSteps: [
      res.rootCauseKnown ? 'Validate the suspected root cause against source and recent diffs.' : 'Collect more evidence for root-cause determination.',
      'Implement the proposed fix in a small, reviewable change.',
      'Add or tighten regression coverage for this flaky scenario.',
    ],
  })
  if (!res.rootCauseKnown) {
    undeterminedTests.push({
      testId: res.id,
      testName: res.name,
      whatWasMissing: res.rootCause,
      recommendedFollowUp: 'Obtain more targeted logs, deterministic repro steps, or a narrower failure signature.',
    })
  }
}

prioritizedPlan.sort((a, b) => {
  const order = { P0: 0, P1: 1, P2: 2, P3: 3 }
  if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority]
  return a.testId.localeCompare(b.testId)
})

const crossCuttingThemes = []
const themeCounts = new Map()
for (const r of done) {
  const text = `${r.rootCause} ${r.proposedFix}`.toLowerCase()
  const themes = [
    text.includes('timing') || text.includes('race') || text.includes('async') ? 'Timing/race-condition sensitivity' : null,
    text.includes('environment') || text.includes('platform') || text.includes('os ') ? 'Environment-specific assumptions' : null,
    text.includes('shared state') || text.includes('global') || text.includes('cache') ? 'Shared-state leakage between tests' : null,
    text.includes('order') || text.includes('test isolation') ? 'Order-dependence / isolation issues' : null,
    text.includes('mock') || text.includes('stub') ? 'Fragile mocks or stubs' : null,
  ].filter(Boolean)
  for (const t of themes) themeCounts.set(t, (themeCounts.get(t) || 0) + 1)
}
for (const [theme, count] of [...themeCounts.entries()].sort((a, b) => b[1] - a[1])) {
  crossCuttingThemes.push(`${theme} (${count} tests)`)
}

const finalPlan = {
  summary: synthesis?.summary || `Investigated ${done.length}/${TESTS.length} tests. ${missing.length ? `${missing.length} tests lack a result.` : 'All tests produced results.'}`,
  prioritizedPlan: (synthesis?.prioritizedPlan && Array.isArray(synthesis.prioritizedPlan) ? synthesis.prioritizedPlan : prioritizedPlan).slice(0, 30),
  undeterminedTests: (synthesis?.undeterminedTests && Array.isArray(synthesis.undeterminedTests) ? synthesis.undeterminedTests : undeterminedTests),
  crossCuttingThemes: (synthesis?.crossCuttingThemes && Array.isArray(synthesis.crossCuttingThemes) ? synthesis.crossCuttingThemes : crossCuttingThemes),
}

return {
  results: done,
  missing,
  synthesis: finalPlan,
}
```

> **GPT-5.5 judge:** The script uses bounded waves of 6, capped schemas, partial-input synthesis, explicit missing-test handling, retry logic, and backs off on high null rates. However, it has no ScheduleWakeup/timeout watchdog, so one hung agent call inside a wave can deadlock the whole run with no notification. Results are only accumulated after each parallel wave resolves, so completed work inside a hung wave is not committed. Resume/cache-stable behavior is absent. The retry/null handling is also imperfect because normalizeResult turns null/non-object results into fallback objects, making the failed/null retry path less meaningful. Synthesis can tolerate partial inputs, but if the synthesis agent returns an incomplete prioritizedPlan array, the script accepts it without verifying coverage, which risks silently omitting completed work. Overall it meets several safety practices but misses the most important hung-connection protection.

