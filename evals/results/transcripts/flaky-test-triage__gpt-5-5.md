# flaky-test-triage — `gpt-5.5`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for FLAKY-TEST TRIAGE: investigate 18 flaky tests. One subagent per test finds the root cause and proposes a fix. Then synthesize a prioritized fix plan, clearly flagging any test whose root cause could not be determined.

---

## Baseline (no skill) — rubric 35%, patterns 31%

```js
export const meta = {
  name: 'flaky-test-triage',
  description: 'Investigate flaky tests with one subagent per test, then synthesize a prioritized fix plan with undetermined root causes flagged.',
  phases: [
    { title: 'Prepare flaky-test inventory' },
    { title: 'Investigate root causes' },
    { title: 'Synthesize prioritized fix plan' },
  ],
}

phase('Prepare flaky-test inventory')

const rawTests =
  Array.isArray(args) ? args :
  Array.isArray(args?.tests) ? args.tests :
  Array.isArray(args?.flakyTests) ? args.flakyTests :
  Array.isArray(args?.flaky_tests) ? args.flaky_tests :
  []

const sharedContext = {
  issue: args?.issue ?? args?.ticket ?? args?.task ?? null,
  ciRun: args?.ciRun ?? args?.ci_run ?? args?.ci ?? null,
  failureSummary: args?.failureSummary ?? args?.failure_summary ?? args?.summary ?? null,
  repositoryHints: args?.repositoryHints ?? args?.repository_hints ?? args?.hints ?? null,
  constraints: args?.constraints ?? null,
}

function normalizeTest(test, index) {
  if (typeof test === 'string') {
    return {
      index,
      id: `flaky-test-${index + 1}`,
      name: test,
      path: null,
      command: null,
      failureLog: null,
      notes: null,
      raw: test,
    }
  }

  const t = test && typeof test === 'object' ? test : {}
  const name =
    t.name ??
    t.testName ??
    t.test_name ??
    t.title ??
    t.fullName ??
    t.full_name ??
    t.id ??
    `flaky-test-${index + 1}`

  return {
    index,
    id: String(t.id ?? t.key ?? `flaky-test-${index + 1}`),
    name: String(name),
    path: t.path ?? t.file ?? t.filePath ?? t.file_path ?? null,
    command: t.command ?? t.reproCommand ?? t.repro_command ?? t.testCommand ?? t.test_command ?? null,
    failureLog: t.failureLog ?? t.failure_log ?? t.error ?? t.stderr ?? t.log ?? null,
    notes: t.notes ?? t.context ?? t.description ?? null,
    raw: t,
  }
}

const tests = rawTests.map(normalizeTest)

if (tests.length === 0) {
  log('No flaky tests were provided. Pass args.tests as an array of 18 test names or test descriptor objects.')
  return {
    ok: false,
    error: 'No flaky tests provided',
    expectedArgs: {
      tests: [
        {
          id: 'optional stable id',
          name: 'required test name',
          path: 'optional test file path',
          command: 'optional repro command',
          failureLog: 'optional CI failure log or error excerpt',
          notes: 'optional context',
        },
      ],
    },
  }
}

if (tests.length !== 18) {
  log(`Expected 18 flaky tests, but received ${tests.length}. Proceeding with the provided list.`)
} else {
  log('Received 18 flaky tests. Launching one investigation subagent per test.')
}

const investigationSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'testId',
    'testName',
    'rootCauseStatus',
    'rootCause',
    'confidence',
    'evidence',
    'reproduction',
    'fixProposal',
    'prioritySignals',
    'openQuestions',
    'summary',
  ],
  properties: {
    testId: { type: 'string' },
    testName: { type: 'string' },
    rootCauseStatus: {
      type: 'string',
      enum: ['determined', 'suspected', 'undetermined'],
      description: 'Use undetermined if the evidence is insufficient to identify a plausible root cause.',
    },
    rootCause: {
      type: ['string', 'null'],
      description: 'Concrete root cause when determined or suspected; null if undetermined.',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low', 'none'],
    },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'detail'],
        properties: {
          kind: {
            type: 'string',
            enum: ['code', 'test', 'log', 'reproduction', 'history', 'configuration', 'other'],
          },
          detail: { type: 'string' },
          file: { type: ['string', 'null'] },
        },
      },
    },
    reproduction: {
      type: 'object',
      additionalProperties: false,
      required: ['attempted', 'commands', 'outcome'],
      properties: {
        attempted: { type: 'boolean' },
        commands: { type: 'array', items: { type: 'string' } },
        outcome: { type: 'string' },
      },
    },
    fixProposal: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'steps', 'likelyFiles', 'risk', 'estimatedEffort'],
      properties: {
        summary: {
          type: ['string', 'null'],
          description: 'Concise fix proposal; null if no responsible root cause could be identified.',
        },
        steps: { type: 'array', items: { type: 'string' } },
        likelyFiles: { type: 'array', items: { type: 'string' } },
        risk: { type: 'string', enum: ['low', 'medium', 'high', 'unknown'] },
        estimatedEffort: { type: 'string', enum: ['small', 'medium', 'large', 'unknown'] },
      },
    },
    prioritySignals: {
      type: 'object',
      additionalProperties: false,
      required: ['userImpact', 'ciImpact', 'blastRadius', 'fixConfidence'],
      properties: {
        userImpact: { type: 'string', enum: ['none', 'low', 'medium', 'high', 'unknown'] },
        ciImpact: { type: 'string', enum: ['low', 'medium', 'high', 'unknown'] },
        blastRadius: { type: 'string', enum: ['narrow', 'moderate', 'wide', 'unknown'] },
        fixConfidence: { type: 'string', enum: ['high', 'medium', 'low', 'none'] },
      },
    },
    openQuestions: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

function investigationPrompt(test) {
  return `You are a senior engineer performing flaky-test triage in this repository.

Investigate exactly one flaky test. Do not edit files or create commits. You may inspect code, search history if available, read tests, reason from logs, and run targeted commands when useful and safe.

Shared triage context:
${JSON.stringify(sharedContext, null, 2)}

Test under investigation:
${JSON.stringify(test, null, 2)}

Your task:
1. Identify the most likely root cause of this test's flakiness.
2. Collect concrete evidence from code, test structure, logs, configuration, or reproduction attempts.
3. Propose a practical fix, including likely files and steps.
4. If the root cause cannot be determined, explicitly return rootCauseStatus="undetermined", rootCause=null, confidence="none", explain why in summary/openQuestions, and do not invent a fix.
5. If the cause is plausible but not proven, use rootCauseStatus="suspected" and confidence="low" or "medium".

Triage guidance:
- Look for timing/race assumptions, async waits, order dependence, shared global state, random data, clock/timezone sensitivity, network/filesystem dependence, resource leaks, test pollution, retries masking failures, environment-specific behavior, and insufficient cleanup.
- Prefer specific evidence over generic guesses.
- Keep the proposed fix minimal but robust.
- Return only the structured result requested by the schema.`
}

phase('Investigate root causes')

const investigationResults = await parallel(
  tests.map((test) => async () => {
    const result = await agent(investigationPrompt(test), {
      label: `triage:${test.id}`,
      phase: 'Investigate root causes',
      schema: investigationSchema,
      effort: 'high',
    })

    if (result === null) {
      return {
        testId: test.id,
        testName: test.name,
        rootCauseStatus: 'undetermined',
        rootCause: null,
        confidence: 'none',
        evidence: [],
        reproduction: {
          attempted: false,
          commands: [],
          outcome: 'Investigation subagent was skipped or failed with a terminal API error.',
        },
        fixProposal: {
          summary: null,
          steps: [],
          likelyFiles: [],
          risk: 'unknown',
          estimatedEffort: 'unknown',
        },
        prioritySignals: {
          userImpact: 'unknown',
          ciImpact: 'unknown',
          blastRadius: 'unknown',
          fixConfidence: 'none',
        },
        openQuestions: ['Rerun triage for this test; the investigation subagent did not complete.'],
        summary: 'Root cause could not be determined because the investigation subagent did not complete.',
      }
    }

    return result
  })
)

const completed = investigationResults.filter(Boolean)
const undeterminedCount = completed.filter((r) => r.rootCauseStatus === 'undetermined').length
const suspectedCount = completed.filter((r) => r.rootCauseStatus === 'suspected').length
const determinedCount = completed.filter((r) => r.rootCauseStatus === 'determined').length

log(`Investigations complete: ${determinedCount} determined, ${suspectedCount} suspected, ${undeterminedCount} undetermined.`)

phase('Synthesize prioritized fix plan')

const synthesisSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'executiveSummary',
    'prioritizedFixPlan',
    'undeterminedRootCauses',
    'crossCuttingPatterns',
    'recommendedExecutionOrder',
    'markdownReport',
  ],
  properties: {
    executiveSummary: { type: 'string' },
    prioritizedFixPlan: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'rank',
          'testIds',
          'testNames',
          'priority',
          'rootCauseStatus',
          'rootCause',
          'fix',
          'rationale',
          'likelyFiles',
          'risk',
          'estimatedEffort',
          'confidence',
        ],
        properties: {
          rank: { type: 'integer', minimum: 1 },
          testIds: { type: 'array', items: { type: 'string' } },
          testNames: { type: 'array', items: { type: 'string' } },
          priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          rootCauseStatus: { type: 'string', enum: ['determined', 'suspected', 'undetermined'] },
          rootCause: { type: ['string', 'null'] },
          fix: { type: ['string', 'null'] },
          rationale: { type: 'string' },
          likelyFiles: { type: 'array', items: { type: 'string' } },
          risk: { type: 'string', enum: ['low', 'medium', 'high', 'unknown'] },
          estimatedEffort: { type: 'string', enum: ['small', 'medium', 'large', 'unknown'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low', 'none'] },
        },
      },
    },
    undeterminedRootCauses: {
      type: 'array',
      description: 'Every test whose root cause could not be determined must appear here.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['testId', 'testName', 'whyUndetermined', 'nextDiagnosticSteps'],
        properties: {
          testId: { type: 'string' },
          testName: { type: 'string' },
          whyUndetermined: { type: 'string' },
          nextDiagnosticSteps: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    crossCuttingPatterns: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['pattern', 'affectedTestIds', 'recommendation'],
        properties: {
          pattern: { type: 'string' },
          affectedTestIds: { type: 'array', items: { type: 'string' } },
          recommendation: { type: 'string' },
        },
      },
    },
    recommendedExecutionOrder: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['step', 'action', 'testIds', 'reason'],
        properties: {
          step: { type: 'integer', minimum: 1 },
          action: { type: 'string' },
          testIds: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
      },
    },
    markdownReport: {
      type: 'string',
      description: 'Human-readable prioritized fix plan. Must clearly flag undetermined tests.',
    },
  },
}

const synthesisPrompt = `You are the triage lead. Synthesize the individual flaky-test investigations into a prioritized fix plan.

Original flaky-test inventory:
${JSON.stringify(tests, null, 2)}

Individual investigation results:
${JSON.stringify(completed, null, 2)}

Synthesis requirements:
1. Produce a prioritized fix plan across all provided tests.
2. Group tests only when they share the same root cause or can be fixed by the same change.
3. Prioritize by CI/user impact, blast radius, confidence, risk, and effort.
4. Clearly flag every test whose root cause could not be determined. These must appear in undeterminedRootCauses and in the markdown report.
5. Distinguish "suspected" from "determined" root causes; do not overstate confidence.
6. Include concrete next diagnostic steps for undetermined tests.
7. Make the markdown report suitable to paste into an issue or incident update.

Return only the structured result requested by the schema.`

const synthesis = await agent(synthesisPrompt, {
  label: 'synthesize-prioritized-fix-plan',
  phase: 'Synthesize prioritized fix plan',
  schema: synthesisSchema,
  effort: 'high',
})

if (synthesis === null) {
  const fallbackUndetermined = completed
    .filter((r) => r.rootCauseStatus === 'undetermined')
    .map((r) => ({
      testId: r.testId,
      testName: r.testName,
      whyUndetermined: r.summary || 'Root cause could not be determined.',
      nextDiagnosticSteps: r.openQuestions && r.openQuestions.length > 0
        ? r.openQuestions
        : ['Rerun targeted triage with more CI logs and local reproduction attempts.'],
    }))

  const fallbackPlan = completed.map((r, i) => ({
    rank: i + 1,
    testIds: [r.testId],
    testNames: [r.testName],
    priority: r.rootCauseStatus === 'determined' ? 'P1' : r.rootCauseStatus === 'suspected' ? 'P2' : 'P3',
    rootCauseStatus: r.rootCauseStatus,
    rootCause: r.rootCause,
    fix: r.fixProposal.summary,
    rationale: r.summary,
    likelyFiles: r.fixProposal.likelyFiles,
    risk: r.fixProposal.risk,
    estimatedEffort: r.fixProposal.estimatedEffort,
    confidence: r.confidence,
  }))

  return {
    ok: false,
    warning: 'Synthesis subagent did not complete; returning unsynthesized investigation results with a fallback ordering.',
    counts: {
      total: tests.length,
      determined: determinedCount,
      suspected: suspectedCount,
      undetermined: undeterminedCount,
    },
    investigations: completed,
    synthesis: {
      executiveSummary: 'Synthesis failed. Review individual investigations and rerun the synthesis phase.',
      prioritizedFixPlan: fallbackPlan,
      undeterminedRootCauses: fallbackUndetermined,
      crossCuttingPatterns: [],
      recommendedExecutionOrder: fallbackPlan.map((p) => ({
        step: p.rank,
        action: p.fix || `Diagnose ${p.testNames.join(', ')}`,
        testIds: p.testIds,
        reason: p.rationale,
      })),
      markdownReport:
        `# Flaky-test triage fallback report\n\n` +
        `Synthesis did not complete. Counts: ${determinedCount} determined, ${suspectedCount} suspected, ${undeterminedCount} undetermined.\n\n` +
        `## Undetermined root causes\n\n` +
        (fallbackUndetermined.length
          ? fallbackUndetermined.map((u) => `- **${u.testName}** (${u.testId}): ${u.whyUndetermined}`).join('\n')
          : '- None flagged by completed investigations.'),
    },
  }
}

log('Prioritized flaky-test fix plan synthesized.')

return {
  ok: true,
  counts: {
    total: tests.length,
    determined: determinedCount,
    suspected: suspectedCount,
    undetermined: undeterminedCount,
  },
  investigations: completed,
  synthesis,
  report: synthesis.markdownReport,
}
```

> **Claude judge:** The script handles null agent results gracefully and has solid schema/gap-flagging, but launches all 18 subagents in a single unbounded parallel() with no wave batching, no retry on failure (only stub replacement), no per-wave result commits, and no stall watchdog—leaving it vulnerable to both deadlock and silent work loss at scale.

## With skill — rubric 92%, patterns 100%

```js
export const meta = {
  name: 'flaky-test-triage',
  description: 'Investigate 18 flaky tests in bounded waves and synthesize a prioritized fix plan with explicit unresolved gaps.',
  phases: [
    { title: 'Validate inputs' },
    { title: 'Investigate' },
    { title: 'Retry failed investigations' },
    { title: 'Synthesize prioritized fix plan' },
  ],
}

// OPERATOR NOTE — arm this watchdog immediately after launching the workflow.
// ScheduleWakeup({
//   delaySeconds: 1200,
//   reason: "watchdog: flaky-test-triage wf_<id> may stall silently; check journal mtime",
//   prompt: "Watchdog for run wf_<id>: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
// })

const TEST_INVESTIGATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'key',
    'testName',
    'location',
    'rootCauseDetermined',
    'rootCause',
    'failureMode',
    'confidence',
    'evidence',
    'proposedFix',
    'fixFiles',
    'priority',
    'risk',
    'estimatedEffort',
    'validationPlan',
    'unresolvedQuestions',
  ],
  properties: {
    key: { type: 'string', minLength: 1 },
    testName: { type: 'string' },
    location: { type: 'string' },
    rootCauseDetermined: { type: 'boolean' },
    rootCause: {
      type: 'string',
      description: 'One concise paragraph. If undetermined, say what is known and why the cause remains unclear.',
    },
    failureMode: {
      type: 'string',
      description: 'Short description of how/when the test flakes.',
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low', 'unknown'] },
    evidence: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'reference', 'summary'],
        properties: {
          kind: {
            type: 'string',
            enum: ['code', 'test-log', 'ci-history', 'local-run', 'commit-history', 'documentation', 'inference'],
          },
          reference: {
            type: 'string',
            description: 'File path, command, CI URL, symbol name, or other compact reference. No long pasted logs.',
          },
          summary: {
            type: 'string',
            description: 'One-line evidence summary.',
          },
        },
      },
    },
    proposedFix: {
      type: 'string',
      description: 'Concrete fix proposal. If root cause undetermined, propose the next diagnostic step instead.',
    },
    fixFiles: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string' },
    },
    priority: {
      type: 'string',
      enum: ['P0', 'P1', 'P2', 'P3'],
      description: 'Priority to fix based on impact, confidence, and ease.',
    },
    risk: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'unknown'],
    },
    estimatedEffort: {
      type: 'string',
      enum: ['small', 'medium', 'large', 'unknown'],
    },
    validationPlan: {
      type: 'array',
      maxItems: 5,
      items: { type: 'string' },
    },
    unresolvedQuestions: {
      type: 'array',
      maxItems: 5,
      items: { type: 'string' },
    },
  },
}

const SYNTHESIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'coverage',
    'prioritizedFixPlan',
    'undeterminedRootCauses',
    'crossCuttingThemes',
    'recommendedExecutionOrder',
    'validationStrategy',
  ],
  properties: {
    summary: { type: 'string' },
    coverage: {
      type: 'object',
      additionalProperties: false,
      required: ['totalTests', 'investigated', 'missingOrFailed', 'determinedRootCauses', 'undeterminedRootCauses'],
      properties: {
        totalTests: { type: 'integer' },
        investigated: { type: 'integer' },
        missingOrFailed: { type: 'integer' },
        determinedRootCauses: { type: 'integer' },
        undeterminedRootCauses: { type: 'integer' },
      },
    },
    prioritizedFixPlan: {
      type: 'array',
      maxItems: 18,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'rank',
          'key',
          'testName',
          'priority',
          'rootCauseDetermined',
          'recommendedAction',
          'whyNow',
          'files',
          'risk',
          'estimatedEffort',
          'validation',
        ],
        properties: {
          rank: { type: 'integer' },
          key: { type: 'string' },
          testName: { type: 'string' },
          priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          rootCauseDetermined: { type: 'boolean' },
          recommendedAction: { type: 'string' },
          whyNow: { type: 'string' },
          files: {
            type: 'array',
            maxItems: 8,
            items: { type: 'string' },
          },
          risk: { type: 'string', enum: ['low', 'medium', 'high', 'unknown'] },
          estimatedEffort: { type: 'string', enum: ['small', 'medium', 'large', 'unknown'] },
          validation: {
            type: 'array',
            maxItems: 5,
            items: { type: 'string' },
          },
        },
      },
    },
    undeterminedRootCauses: {
      type: 'array',
      maxItems: 18,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'testName', 'status', 'nextDiagnosticStep'],
        properties: {
          key: { type: 'string' },
          testName: { type: 'string' },
          status: { type: 'string' },
          nextDiagnosticStep: { type: 'string' },
        },
      },
    },
    crossCuttingThemes: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string' },
    },
    recommendedExecutionOrder: {
      type: 'array',
      maxItems: 18,
      items: { type: 'string' },
    },
    validationStrategy: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string' },
    },
  },
}

function asArray(value) {
  if (Array.isArray(value)) return value
  if (value && Array.isArray(value.tests)) return value.tests
  return []
}

function stableString(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value, Object.keys(value).sort())
}

function normalizeTest(test, index) {
  if (typeof test === 'string') {
    const name = test.trim()
    return {
      key: `test-${String(index + 1).padStart(2, '0')}:${name}`,
      testName: name,
      location: '',
      raw: { name },
    }
  }

  const raw = test && typeof test === 'object' ? test : { value: stableString(test) }
  const explicitKey = raw.key || raw.id || raw.testId || raw.name || raw.testName || raw.fullName
  const filePart = raw.file || raw.path || raw.location || ''
  const namePart = raw.name || raw.testName || raw.fullName || raw.title || explicitKey || `test-${index + 1}`
  const key = raw.key || raw.id || raw.testId || `${filePart ? `${filePart}::` : ''}${namePart}` || `test-${String(index + 1).padStart(2, '0')}`

  return {
    key: String(key),
    testName: String(namePart),
    location: String(filePart || raw.location || ''),
    raw,
  }
}

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function sortByKey(items) {
  return [...items].sort((a, b) => {
    const ak = String(a.key || '')
    const bk = String(b.key || '')
    return ak > bk ? 1 : ak < bk ? -1 : 0
  })
}

function buildInvestigationPrompt(test, repoContext) {
  return [
    'You are a senior test-infrastructure engineer triaging one flaky test.',
    '',
    'Task: determine the most likely root cause of this flaky test and propose a concrete fix.',
    '',
    'Hard requirements:',
    '- Investigate only this test; do not modify files.',
    '- Inspect relevant source, test code, fixtures, async timing, shared state, mocks, CI/test logs if available, and nearby history if useful.',
    '- Prefer a specific root cause over generic “timing issue” language.',
    '- If the root cause cannot be determined from available evidence, set rootCauseDetermined=false and clearly state the remaining uncertainty.',
    '- Keep output lean: concise evidence references, no pasted log walls, no long quotes.',
    '- Return data matching the schema exactly.',
    '',
    `Stable test key: ${test.key}`,
    `Test name: ${test.testName}`,
    `Location hint: ${test.location || '(not provided)'}`,
    '',
    'Raw test descriptor:',
    JSON.stringify(test.raw, null, 2),
    '',
    'Repository / project context supplied by caller:',
    repoContext || '(none supplied)',
  ].join('\n')
}

function buildSynthesisPrompt(allTests, investigations, missing, backedOff, repoContext) {
  const investigationPayload = JSON.stringify(sortByKey(investigations))
  const missingPayload = JSON.stringify(sortByKey(missing))
  const plannedPayload = JSON.stringify(sortByKey(allTests).map(t => ({
    key: t.key,
    testName: t.testName,
    location: t.location,
  })))

  return [
    'You are the triage lead synthesizing a flaky-test remediation plan.',
    '',
    'Create a prioritized fix plan from the completed per-test investigations.',
    '',
    'Hard requirements:',
    '- Prioritize fixes by impact, confidence, effort, shared root causes, and de-flaking leverage.',
    '- Clearly flag every test whose root cause could not be determined.',
    '- Clearly flag every planned test that is missing because its investigation failed, was skipped due to instability backoff, or otherwise returned no result.',
    '- Do not pretend partial coverage is complete.',
    '- Keep the plan concise and actionable.',
    '- Return data matching the schema exactly.',
    '',
    `Instability backoff triggered: ${backedOff ? 'yes' : 'no'}`,
    '',
    'Repository / project context supplied by caller:',
    repoContext || '(none supplied)',
    '',
    `Planned tests (${allTests.length}):`,
    plannedPayload,
    '',
    `Completed investigations (${investigations.length}):`,
    investigationPayload,
    '',
    `Missing / failed investigations (${missing.length}):`,
    missingPayload,
  ].join('\n')
}

phase('Validate inputs')

const rawTests = asArray(args)
const repoContext = args && !Array.isArray(args) && args.repoContext ? String(args.repoContext) : ''
const requestedWaveSize = args && !Array.isArray(args) && Number.isInteger(args.waveSize) ? args.waveSize : 6
const WAVE_SIZE = Math.max(6, Math.min(8, requestedWaveSize))

const tests = rawTests.map(normalizeTest)

if (tests.length === 0) {
  return {
    ok: false,
    error: 'No tests provided. Pass args as { tests: [...] } or as an array of 18 flaky test descriptors.',
    expectedArgsShape: {
      tests: [
        {
          key: 'stable-id',
          name: 'test name',
          file: 'path/to/test_file',
          failureLog: 'optional short failure excerpt or CI link',
        },
      ],
      repoContext: 'optional project-specific notes',
      waveSize: 'optional integer 6..8',
    },
  }
}

if (tests.length !== 18) {
  log(`Warning: expected 18 flaky tests, received ${tests.length}. Continuing with provided set.`)
}

log(`Starting flaky-test triage for ${tests.length} tests in waves of ${WAVE_SIZE}.`)
log('After launch, arm the ScheduleWakeup watchdog shown in this script comment to catch silent stalls.')

function runInvestigation(test) {
  return agent(buildInvestigationPrompt(test, repoContext), {
    label: `triage:${test.key}`,
    phase: 'Investigate',
    schema: TEST_INVESTIGATION_SCHEMA,
    effort: 'high',
  })
}

phase('Investigate')

const waves = chunk(tests, WAVE_SIZE)
const done = []
let failed = []
let unlaunched = []
let backedOff = false
let completedPrimaryWaves = 0

for (let w = 0; w < waves.length; w++) {
  phase(`Investigate wave ${w + 1}/${waves.length}`)

  const wave = waves[w]
  const batch = await parallel(wave.map(test => () => runInvestigation(test)))

  let nulls = 0
  batch.forEach((result, i) => {
    if (result) {
      done.push(result)
    } else {
      nulls += 1
      failed.push(wave[i])
    }
  })

  completedPrimaryWaves += 1
  log(`Wave ${w + 1}/${waves.length}: ${batch.length - nulls}/${batch.length} succeeded; total complete ${done.length}/${tests.length}; failed pending ${failed.length}.`)

  if (nulls / batch.length > 0.4) {
    backedOff = true
    unlaunched = waves.slice(w + 1).flat()
    log(`Instability: ${nulls}/${batch.length} failed this wave — backing off. Remaining ${unlaunched.length} tests will be flagged missing and recover cheaply on resume.`)
    break
  }
}

if (failed.length && !backedOff) {
  phase('Retry failed investigations')
  log(`Retrying ${failed.length} failed investigations after natural backoff from primary waves.`)

  const retryTargets = failed
  const retried = await parallel(retryTargets.map(test => () => runInvestigation(test)))

  const stillFailed = []
  retried.forEach((result, i) => {
    if (result) {
      done.push(result)
    } else {
      stillFailed.push(retryTargets[i])
    }
  })

  failed = stillFailed
  log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failed.length}.`)
} else if (failed.length && backedOff) {
  log(`Skipping retry because instability backoff triggered; ${failed.length} failed tests will be flagged missing until resume.`)
}

const haveKeys = new Set(done.map(result => result.key))
const missingByCoverage = tests.filter(test => !haveKeys.has(test.key))
const missingMap = new Map()

for (const test of missingByCoverage) {
  missingMap.set(test.key, {
    key: test.key,
    testName: test.testName,
    location: test.location,
    reason: 'no investigation result',
  })
}

for (const test of failed) {
  missingMap.set(test.key, {
    key: test.key,
    testName: test.testName,
    location: test.location,
    reason: backedOff ? 'failed during instability window; retry deferred' : 'failed after retry',
  })
}

for (const test of unlaunched) {
  missingMap.set(test.key, {
    key: test.key,
    testName: test.testName,
    location: test.location,
    reason: 'not launched because instability backoff stopped new waves',
  })
}

const missing = sortByKey([...missingMap.values()])

if (missing.length) {
  log(`Partial coverage: missing ${missing.length}/${tests.length} tests: ${missing.map(t => t.key).join(', ')}`)
}

phase('Synthesize prioritized fix plan')

let synthesis = null
if (done.length > 0 || missing.length > 0) {
  synthesis = await agent(buildSynthesisPrompt(tests, done, missing, backedOff, repoContext), {
    label: 'synthesize:prioritized-fix-plan',
    phase: 'Synthesize prioritized fix plan',
    schema: SYNTHESIS_SCHEMA,
    effort: 'high',
  })
}

const determinedCount = done.filter(result => result.rootCauseDetermined).length
const undeterminedCount = done.filter(result => !result.rootCauseDetermined).length

if (!synthesis) {
  synthesis = {
    summary: 'Synthesis agent did not return a result. Use the investigations and missing list directly.',
    coverage: {
      totalTests: tests.length,
      investigated: done.length,
      missingOrFailed: missing.length,
      determinedRootCauses: determinedCount,
      undeterminedRootCauses: undeterminedCount + missing.length,
    },
    prioritizedFixPlan: sortByKey(done).map((result, index) => ({
      rank: index + 1,
      key: result.key,
      testName: result.testName,
      priority: result.priority,
      rootCauseDetermined: result.rootCauseDetermined,
      recommendedAction: result.proposedFix,
      whyNow: result.rootCauseDetermined ? result.rootCause : 'Root cause undetermined; prioritize diagnostic follow-up before code changes.',
      files: result.fixFiles,
      risk: result.risk,
      estimatedEffort: result.estimatedEffort,
      validation: result.validationPlan,
    })),
    undeterminedRootCauses: [
      ...sortByKey(done)
        .filter(result => !result.rootCauseDetermined)
        .map(result => ({
          key: result.key,
          testName: result.testName,
          status: result.rootCause || 'Root cause undetermined.',
          nextDiagnosticStep: result.proposedFix || 'Collect more targeted failure data and reproduce under stress.',
        })),
      ...missing.map(test => ({
        key: test.key,
        testName: test.testName,
        status: `No investigation result: ${test.reason}`,
        nextDiagnosticStep: 'Resume the workflow or run a focused investigation for this test.',
      })),
    ],
    crossCuttingThemes: [],
    recommendedExecutionOrder: sortByKey(done).map(result => result.key),
    validationStrategy: ['Re-run each fixed test repeatedly under the same CI/runtime conditions that exhibited flakiness.'],
  }
}

return {
  ok: true,
  totalTests: tests.length,
  completedPrimaryWaves,
  waveSize: WAVE_SIZE,
  instabilityBackoffTriggered: backedOff,
  coverage: {
    investigated: done.length,
    missing: missing.length,
    rootCauseDetermined: determinedCount,
    rootCauseUndeterminedFromCompletedInvestigations: undeterminedCount,
  },
  investigations: sortByKey(done),
  missing,
  prioritizedFixPlan: synthesis,
  resumeGuidance: backedOff || missing.length
    ? 'If this run stalled or backed off, stop the workflow task if still running, then resume with Workflow({ scriptPath, resumeFromRunId }). Completed investigations should be cached; null/missing agents can rerun.'
    : 'All provided tests produced investigation results.',
}
```

> **Claude judge:** The script demonstrates nearly all required safety properties: (1) bounded waves of 6-8 via chunk(); (2) per-agent null-tolerance with failed[] tracking and a retry wave; (3) results committed per wave into done[] before synthesis; (4) ScheduleWakeup watchdog present as a comment with instructions to arm immediately after launch; (5) no Date.now/Math.random, deterministic key generation; (6) lean capped schemas with maxItems constraints; (7) synthesis explicitly flags missing/partial coverage and tolerates partial input with a fallback synthesis object; (8) backoff triggers when >40% of a wave fails, stopping further waves. The only minor gap is the watchdog is a comment rather than an armed call, but the rubric explicitly allows this.

