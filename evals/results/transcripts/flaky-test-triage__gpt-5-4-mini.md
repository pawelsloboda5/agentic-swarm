# flaky-test-triage — `gpt-5.4-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for FLAKY-TEST TRIAGE: investigate 18 flaky tests. One subagent per test finds the root cause and proposes a fix. Then synthesize a prioritized fix plan, clearly flagging any test whose root cause could not be determined.

---

## Baseline (no skill) — rubric 25%, patterns 25%

```js
export const meta = {
  name: 'flaky-test-triage',
  description: 'Investigate flaky tests in parallel, identify root causes, and synthesize a prioritized fix plan.',
  phases: [
    { title: 'Triage' },
    { title: 'Synthesize' },
  ],
}

const tests = Array.from({ length: 18 }, (_, i) => `flaky-test-${i + 1}`)

phase('Triage')
log(`Starting flaky-test triage for ${tests.length} tests.`)

const triageResults = await parallel(
  tests.map((testName, index) => async () => {
    return await agent(
      [
        `You are investigating one flaky test for root cause analysis and fix proposal.`,
        ``,
        `Test identifier: ${testName}`,
        `Test number: ${index + 1} of ${tests.length}`,
        ``,
        `Your job:`,
        `1) Determine the most likely root cause of flakiness.`,
        `2) Propose a concrete fix.`,
        `3) If you cannot determine the root cause with reasonable confidence, clearly say so and explain what evidence is missing.`,
        `4) Keep the answer concise but actionable.`,
        ``,
        `Return in this exact structure:`,
        `- Test: <test identifier>`,
        `- Root cause: <description or "Undetermined">`,
        `- Confidence: <high/medium/low>`,
        `- Proposed fix: <specific fix or next step>`,
        `- Evidence: <brief supporting points>`,
      ].join('\n'),
      {
        label: testName,
        phase: 'Triage',
        effort: 'high',
      }
    )
  })
)

const parsed = triageResults.map((result, index) => {
  const testName = tests[index]
  if (!result) {
    return {
      test: testName,
      rootCause: 'Undetermined',
      confidence: 'low',
      proposedFix: 'Undetermined due to missing subagent result; rerun targeted investigation.',
      evidence: ['Subagent failed or was skipped.'],
      undetermined: true,
      raw: null,
    }
  }

  const text = String(result).trim()
  const getField = (label) => {
    const re = new RegExp(`^\\-\\s*${label}:\\s*(.*)$`, 'mi')
    const match = text.match(re)
    return match ? match[1].trim() : ''
  }

  const rootCause = getField('Root cause') || 'Undetermined'
  const confidence = (getField('Confidence') || 'low').toLowerCase()
  const proposedFix = getField('Proposed fix') || 'Undetermined; needs follow-up.'
  const evidenceLine = getField('Evidence')
  const evidence = evidenceLine ? [evidenceLine] : []

  return {
    test: getField('Test') || testName,
    rootCause,
    confidence,
    proposedFix,
    evidence,
    undetermined: /undetermined/i.test(rootCause) || /could not determine/i.test(text),
    raw: text,
  }
})

phase('Synthesize')
log('Synthesizing prioritized fix plan.')

const synth = await agent(
  [
    `You are synthesizing flaky-test triage results into a prioritized fix plan.`,
    ``,
    `Inputs:`,
    JSON.stringify(parsed, null, 2),
    ``,
    `Requirements:`,
    `- Prioritize fixes by impact and likelihood of resolving multiple flakes.`,
    `- Clearly flag any test whose root cause could not be determined.`,
    `- Group related tests that appear to share the same underlying issue.`,
    `- Include concrete next steps, owners/categories if inferable, and a recommended order of execution.`,
    `- Call out any tests needing additional instrumentation or reproduction data.`,
    ``,
    `Produce a concise but complete plan with these sections:`,
    `1) Executive summary`,
    `2) Prioritized fix plan`,
    `3) Tests with undetermined root cause`,
    `4) Cross-cutting themes / shared causes`,
    `5) Recommended follow-up if fixes don't stabilize tests`,
  ].join('\n'),
  {
    label: 'synthesis',
    phase: 'Synthesize',
    effort: 'high',
  }
)

const undetermined = parsed.filter((r) => r.undetermined)

log(`Triage complete: ${parsed.length - undetermined.length} determined, ${undetermined.length} undetermined.`)

const final = [
  `# Flaky Test Triage`,
  ``,
  `## Per-test findings`,
  ...parsed.map((r, i) => [
    `### ${i + 1}. ${r.test}`,
    `- Root cause: ${r.rootCause}`,
    `- Confidence: ${r.confidence}`,
    `- Proposed fix: ${r.proposedFix}`,
    r.evidence.length ? `- Evidence: ${r.evidence.join('; ')}` : `- Evidence: none recorded`,
    r.undetermined ? `- Status: ROOT CAUSE UNDETERMINED` : `- Status: determined`,
  ].join('\n')),
  ``,
  `## Synthesized prioritized fix plan`,
  synth ? String(synth).trim() : `Synthesis unavailable due to subagent failure.`,
].join('\n\n')

final
```

> **Claude judge:** The script launches all 18 agents in a single unbounded parallel() call with no wave batching, no stall watchdog, no retry logic, and no per-wave result commitment, meaning a single hung connection can deadlock the entire run silently; it partially redeems itself with null-tolerance in parsing, gap-flagging in synthesis, and cache-stable prompts, but the core safety-by-construction properties are absent.

## With skill — rubric 72%, patterns 75%

```js
export const meta = {
  name: 'flaky-test-triage',
  description: 'Investigate 18 flaky tests, identify root causes, and synthesize a prioritized fix plan with gaps flagged.',
  phases: [{ title: 'Investigate' }, { title: 'Retry' }, { title: 'Synthesize' }],
}

const TESTS = [
  'test_01', 'test_02', 'test_03', 'test_04', 'test_05', 'test_06',
  'test_07', 'test_08', 'test_09', 'test_10', 'test_11', 'test_12',
  'test_13', 'test_14', 'test_15', 'test_16', 'test_17', 'test_18',
]

const WAVE_SIZE = 6

const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const TEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    testId: { type: 'string' },
    rootCause: { type: ['string', 'null'] },
    evidence: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5,
    },
    proposedFix: { type: ['string', 'null'] },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
    notes: { type: 'string' },
  },
  required: ['testId', 'rootCause', 'evidence', 'proposedFix', 'confidence', 'priority', 'notes'],
}

const itemPrompt = (testId) => `
You are investigating one flaky test: ${testId}.

Find the most likely root cause of the flakiness and propose a concrete fix.
Use only concise evidence. Do not write a long essay.

Return JSON matching the schema:
- testId: "${testId}"
- rootCause: short description, or null if you cannot determine it
- evidence: up to 5 short bullets or references
- proposedFix: concrete fix, or null if root cause is unknown
- confidence: low|medium|high
- priority: P0|P1|P2|P3 based on user impact and recurrence likelihood
- notes: short note, especially if root cause is uncertain

Rules:
- If the root cause cannot be determined, set rootCause and proposedFix to null and explain why in notes.
- Prefer actionable fixes over vague suggestions.
- Keep outputs lean.
`.trim()

const runTest = (testId) =>
  agent(itemPrompt(testId), {
    label: `flaky:${testId}`,
    phase: 'Investigate',
    schema: TEST_SCHEMA,
    effort: 'medium',
  })

const results = []
let failed = []

phase('Investigate')

const waves = chunk(TESTS, WAVE_SIZE)
for (let w = 0; w < waves.length; w++) {
  const wave = waves[w]
  log(`Investigating wave ${w + 1}/${waves.length}: ${wave.join(', ')}`)
  const batch = await parallel(wave.map((testId) => () => runTest(testId)))

  batch.forEach((r, i) => {
    if (r) results.push(r)
    else failed.push(wave[i])
  })

  const nulls = batch.filter((r) => r === null).length
  log(`Wave ${w + 1} complete: ${results.length}/${TESTS.length} analyzed, ${failed.length} queued for retry`)
  if (nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} failed this wave — backing off; return partial, resume later`)
    break
  }
}

if (failed.length) {
  phase('Retry')
  log(`Retrying ${failed.length} unresolved tests`)
  const retried = await parallel(failed.map((testId) => () => runTest(testId)))
  const stillFailed = []

  retried.forEach((r, i) => {
    if (r) results.push(r)
    else stillFailed.push(failed[i])
  })

  failed = stillFailed
  log(`Retry complete: recovered ${retried.filter(Boolean).length}, still missing ${failed.length}`)
}

const have = new Set(results.map((r) => r.testId))
const missing = TESTS.filter((t) => !have.has(t))
if (missing.length) log(`⚠ partial: missing ${missing.length}/${TESTS.length}: ${missing.join(', ')}`)

const sortedResults = [...results].sort((a, b) => a.testId.localeCompare(b.testId))
const synthesisInput = JSON.stringify(sortedResults)

const synthesis = await agent(
  `Synthesize a prioritized fix plan for these flaky tests.

You must:
- prioritize the fixes by impact, recurrence, and implementation effort
- clearly flag any tests whose root cause could not be determined
- call out common patterns/shared root causes across tests
- recommend the first 3 fixes to land
- include a concise gap section for missing or undetermined tests

Input results (${sortedResults.length}):
${synthesisInput}

Missing tests: ${JSON.stringify(missing)}

Do not silently omit any unresolved or missing test. Be explicit about uncertainty.`,
  {
    label: 'flaky-synthesis',
    phase: 'Synthesize',
    effort: 'high',
  }
)

return {
  results: sortedResults,
  missing,
  synthesis,
}
```

> **Claude judge:** The script implements bounded waves (6 per wave), per-wave result commits, null-tolerance with a retry phase, high-failure-rate backoff, deterministic prompts, capped schemas, and gap-flagging synthesis — covering 7 of 8 safety properties. The sole missing element is an armed stall watchdog (ScheduleWakeup or equivalent), meaning a single hung agent connection in any parallel() call could deadlock that wave indefinitely with no notification.

