# flaky-test-triage — `gpt-5.5`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for FLAKY-TEST TRIAGE: investigate 18 flaky tests. One subagent per test finds the root cause and proposes a fix. Then synthesize a prioritized fix plan, clearly flagging any test whose root cause could not be determined.

---

## Baseline (no skill) — rubric 25%, patterns 38%

```js
export const meta = {
  name: 'flaky-test-triage',
  description:
    'Investigate 18 flaky tests with one subagent per test, then synthesize a prioritized fix plan with unknown root causes clearly flagged.',
  phases: [
    { title: 'Normalize flaky test list' },
    { title: 'Investigate root causes' },
    { title: 'Synthesize prioritized fix plan' },
  ],
}

const EXPECTED_TEST_COUNT = 18

phase('Normalize flaky test list')

const input = args ?? {}

const testDescriptorSchema = {
  type: 'object',
  required: ['id', 'name'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    file: { type: 'string' },
    failureLog: { type: 'string' },
    ciJobUrl: { type: 'string' },
    metadata: {
      type: 'object',
      additionalProperties: true,
    },
  },
}

const resolverSchema = {
  type: 'object',
  required: ['tests', 'notes'],
  additionalProperties: false,
  properties: {
    tests: {
      type: 'array',
      items: testDescriptorSchema,
    },
    notes: { type: 'string' },
  },
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value
  }
  return null
}

function parseTestListText(text) {
  if (typeof text !== 'string') return []
  return text
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/^[-*]\s+/, '')
        .replace(/^\d+[.)]\s+/, '')
        .trim(),
    )
    .filter(Boolean)
    .map((name, index) => ({
      id: `test-${String(index + 1).padStart(2, '0')}`,
      name,
    }))
}

function normalizeTestDescriptor(item, index) {
  if (typeof item === 'string') {
    return {
      id: `test-${String(index + 1).padStart(2, '0')}`,
      name: item,
    }
  }

  if (!item || typeof item !== 'object') {
    return null
  }

  const name =
    item.name ??
    item.testName ??
    item.test ??
    item.title ??
    item.fullName ??
    item.nodeid ??
    item.nodeId ??
    item.identifier ??
    item.id

  if (!name || typeof name !== 'string') {
    return null
  }

  const descriptor = {
    id:
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim()
        : `test-${String(index + 1).padStart(2, '0')}`,
    name: name.trim(),
  }

  const file = item.file ?? item.path ?? item.testFile ?? item.specFile
  if (typeof file === 'string' && file.trim()) descriptor.file = file.trim()

  const failureLog =
    item.failureLog ??
    item.log ??
    item.stderr ??
    item.output ??
    item.stackTrace ??
    item.stack
  if (typeof failureLog === 'string' && failureLog.trim()) {
    descriptor.failureLog = failureLog.trim()
  }

  const ciJobUrl = item.ciJobUrl ?? item.url ?? item.buildUrl ?? item.jobUrl
  if (typeof ciJobUrl === 'string' && ciJobUrl.trim()) {
    descriptor.ciJobUrl = ciJobUrl.trim()
  }

  descriptor.metadata = item
  return descriptor
}

function normalizeTestList(items) {
  return items
    .map((item, index) => normalizeTestDescriptor(item, index))
    .filter(Boolean)
}

const explicitArray = firstArray(
  Array.isArray(input) ? input : null,
  input.tests,
  input.flakyTests,
  input.flakes,
  input.testCases,
  input.test_list,
)

let tests = explicitArray
  ? normalizeTestList(explicitArray)
  : normalizeTestList(
      parseTestListText(
        input.testListText ??
          input.flakyTestList ??
          input.flakyTestsText ??
          input.testsText ??
          '',
      ),
    )

if (tests.length !== EXPECTED_TEST_COUNT) {
  log(
    `Input contained ${tests.length} normalized test descriptor(s); asking a resolver subagent to identify exactly ${EXPECTED_TEST_COUNT}.`,
  )

  const resolved = await agent(
    `Resolve the exact list of ${EXPECTED_TEST_COUNT} flaky tests to triage.

You are preparing input for a flaky-test triage workflow. Inspect the supplied workflow args and, if useful, the repository context available to you. Return exactly the flaky tests that should be investigated.

Rules:
- Prefer explicit lists from args.tests, args.flakyTests, issue text, CI summaries, or failure-log summaries.
- Preserve file paths, failure logs, CI URLs, and any other useful metadata when available.
- If more than ${EXPECTED_TEST_COUNT} candidate tests are present, choose the ${EXPECTED_TEST_COUNT} tests most clearly marked as flaky or most recently/frequently failing.
- If fewer than ${EXPECTED_TEST_COUNT} can be identified, return only the identifiable tests and explain what is missing in notes.
- Do not investigate root causes in this step.

Workflow args:
${JSON.stringify(input, null, 2)}

Already normalized candidates:
${JSON.stringify(tests, null, 2)}`,
    {
      label: 'resolve-flaky-test-list',
      phase: 'Normalize flaky test list',
      effort: 'medium',
      schema: resolverSchema,
    },
  )

  if (resolved && Array.isArray(resolved.tests)) {
    tests = normalizeTestList(resolved.tests)
    log(`Resolver returned ${tests.length} test descriptor(s). ${resolved.notes}`)
  }
}

if (tests.length !== EXPECTED_TEST_COUNT) {
  throw new Error(
    `Expected exactly ${EXPECTED_TEST_COUNT} flaky tests, but found ${tests.length}. Pass args.tests or args.flakyTests as an array of 18 test names/descriptors.`,
  )
}

log(`Starting one root-cause investigation subagent for each of ${EXPECTED_TEST_COUNT} flaky tests.`)

phase('Investigate root causes')

const investigationSchema = {
  type: 'object',
  required: [
    'test_id',
    'test_name',
    'root_cause_determined',
    'failure_mode',
    'root_cause',
    'evidence',
    'proposed_fix',
    'confidence',
    'priority_signals',
    'unknown_reason',
    'next_steps_if_unknown',
  ],
  additionalProperties: false,
  properties: {
    test_id: { type: 'string' },
    test_name: { type: 'string' },
    file: { type: 'string' },
    root_cause_determined: { type: 'boolean' },
    failure_mode: { type: 'string' },
    root_cause: { type: 'string' },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        required: ['source', 'detail'],
        additionalProperties: false,
        properties: {
          source: { type: 'string' },
          detail: { type: 'string' },
        },
      },
    },
    proposed_fix: {
      type: 'object',
      required: ['summary', 'files_to_change', 'change_details', 'risks'],
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        files_to_change: {
          type: 'array',
          items: { type: 'string' },
        },
        change_details: {
          type: 'array',
          items: { type: 'string' },
        },
        risks: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low', 'unknown'],
    },
    priority_signals: {
      type: 'object',
      required: [
        'severity',
        'frequency',
        'blast_radius',
        'fix_complexity',
        'blocks_ci',
        'shared_cause_likelihood',
      ],
      additionalProperties: false,
      properties: {
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'unknown'],
        },
        frequency: {
          type: 'string',
          enum: ['very_high', 'high', 'medium', 'low', 'unknown'],
        },
        blast_radius: {
          type: 'string',
          enum: ['broad', 'moderate', 'narrow', 'unknown'],
        },
        fix_complexity: {
          type: 'string',
          enum: ['small', 'medium', 'large', 'unknown'],
        },
        blocks_ci: {
          type: 'string',
          enum: ['yes', 'no', 'unknown'],
        },
        shared_cause_likelihood: {
          type: 'string',
          enum: ['high', 'medium', 'low', 'unknown'],
        },
      },
    },
    related_tests_or_components: {
      type: 'array',
      items: { type: 'string' },
    },
    reproduction_or_validation_steps: {
      type: 'array',
      items: { type: 'string' },
    },
    unknown_reason: { type: 'string' },
    next_steps_if_unknown: {
      type: 'array',
      items: { type: 'string' },
    },
  },
}

function labelForTest(test, index) {
  const compactName = String(test.name)
    .replace(/\s+/g, ' ')
    .replace(/[^\w./:#-]+/g, '-')
    .slice(0, 64)
  return `triage-${String(index + 1).padStart(2, '0')}-${compactName}`
}

const investigationResults = await parallel(
  tests.map((test, index) => async () => {
    return await agent(
      `Investigate this flaky test and determine its root cause if possible.

Test descriptor:
${JSON.stringify(test, null, 2)}

Overall workflow context:
${JSON.stringify(
  {
    repositoryContext: input.repositoryContext ?? input.context ?? '',
    ciContext: input.ciContext ?? input.ci ?? '',
    knownRecentChanges: input.knownRecentChanges ?? input.recentChanges ?? '',
    instructions: input.instructions ?? '',
  },
  null,
  2,
)}

Your task:
1. Inspect the test, the code under test, fixtures/helpers, mocks, shared state, and any relevant CI/failure-log context.
2. Identify the concrete root cause of flakiness, not just the visible symptom.
3. Consider common flake classes: async race, missing await, timing/sleep, polling, clock/timezone, randomness, test order dependence, leaked global state, leaked resources, network/external dependency, filesystem/temp-dir collision, parallelism, non-deterministic data, database isolation, retries masking failures, and environment assumptions.
4. Propose a minimal, production-quality fix. Do not edit files; report the proposed change only.
5. Include evidence with file paths, code references, log lines, commands tried, or observations.
6. If the root cause cannot be determined confidently, set root_cause_determined=false, root_cause="UNKNOWN", explain exactly why in unknown_reason, and provide concrete next steps to determine it.

Return only the structured result requested by the schema.`,
      {
        label: labelForTest(test, index),
        phase: 'Investigate root causes',
        effort: 'high',
        schema: investigationSchema,
      },
    )
  }),
)

const normalizedInvestigations = investigationResults.map((result, index) => {
  const test = tests[index]

  if (result) {
    return {
      ...result,
      test_id: result.test_id || test.id,
      test_name: result.test_name || test.name,
      file: result.file || test.file || '',
      triage_agent_completed: true,
    }
  }

  return {
    test_id: test.id,
    test_name: test.name,
    file: test.file || '',
    root_cause_determined: false,
    failure_mode: 'UNKNOWN - triage subagent did not complete successfully',
    root_cause: 'UNKNOWN',
    evidence: [],
    proposed_fix: {
      summary: 'No fix proposed because the triage subagent failed or was skipped.',
      files_to_change: [],
      change_details: [],
      risks: ['Requires manual investigation because automated triage did not complete.'],
    },
    confidence: 'unknown',
    priority_signals: {
      severity: 'unknown',
      frequency: 'unknown',
      blast_radius: 'unknown',
      fix_complexity: 'unknown',
      blocks_ci: 'unknown',
      shared_cause_likelihood: 'unknown',
    },
    related_tests_or_components: [],
    reproduction_or_validation_steps: [],
    unknown_reason:
      'The investigation subagent returned null, indicating it was skipped or died on a terminal API error.',
    next_steps_if_unknown: [
      'Manually inspect the test and recent CI failures.',
      'Re-run the workflow or the individual triage with more failure logs.',
    ],
    triage_agent_completed: false,
  }
})

const unknownCount = normalizedInvestigations.filter(
  (item) => !item.root_cause_determined,
).length

log(
  `Completed investigations. ${EXPECTED_TEST_COUNT - unknownCount} root cause(s) determined; ${unknownCount} unknown root cause(s) to flag.`,
)

phase('Synthesize prioritized fix plan')

const synthesisSchema = {
  type: 'object',
  required: [
    'executive_summary',
    'prioritized_fix_plan',
    'unknown_root_cause_tests',
    'shared_themes',
    'validation_strategy',
    'markdown_report',
  ],
  additionalProperties: false,
  properties: {
    executive_summary: { type: 'string' },
    prioritized_fix_plan: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'rank',
          'priority',
          'test_id',
          'test_name',
          'root_cause_determined',
          'root_cause_summary',
          'fix_summary',
          'rationale',
          'implementation_notes',
          'risk',
          'confidence',
        ],
        additionalProperties: false,
        properties: {
          rank: { type: 'integer' },
          priority: {
            type: 'string',
            enum: ['P0', 'P1', 'P2', 'P3'],
          },
          test_id: { type: 'string' },
          test_name: { type: 'string' },
          root_cause_determined: { type: 'boolean' },
          root_cause_summary: { type: 'string' },
          fix_summary: { type: 'string' },
          rationale: { type: 'string' },
          implementation_notes: {
            type: 'array',
            items: { type: 'string' },
          },
          risk: { type: 'string' },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low', 'unknown'],
          },
        },
      },
    },
    unknown_root_cause_tests: {
      type: 'array',
      items: {
        type: 'object',
        required: ['test_id', 'test_name', 'why_unknown', 'next_steps'],
        additionalProperties: false,
        properties: {
          test_id: { type: 'string' },
          test_name: { type: 'string' },
          why_unknown: { type: 'string' },
          next_steps: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    shared_themes: {
      type: 'array',
      items: { type: 'string' },
    },
    validation_strategy: {
      type: 'array',
      items: { type: 'string' },
    },
    markdown_report: { type: 'string' },
  },
}

const synthesis = await agent(
  `Synthesize a prioritized fix plan for these ${EXPECTED_TEST_COUNT} flaky-test investigations.

Investigation results:
${JSON.stringify(normalizedInvestigations, null, 2)}

Requirements:
- Produce a concise but complete prioritized plan.
- Prioritize fixes by CI/user impact, frequency, blast radius, confidence, shared root cause, and implementation complexity.
- Group or call out tests that likely share a root cause.
- Clearly flag every test whose root cause could not be determined.
- For unknowns, include why the root cause is unknown and the next diagnostic steps.
- Do not hide failed/skipped triage subagents; treat them as unknown root causes.
- The markdown_report must be directly readable by maintainers and include:
  1. Executive summary
  2. Prioritized fix plan
  3. Shared themes / batching opportunities
  4. Root cause not determined section
  5. Validation strategy`,
  {
    label: 'synthesize-fix-plan',
    phase: 'Synthesize prioritized fix plan',
    effort: 'high',
    schema: synthesisSchema,
  },
)

function buildFallbackReport(investigations) {
  const unknowns = investigations.filter((item) => !item.root_cause_determined)
  const knowns = investigations.filter((item) => item.root_cause_determined)

  const lines = []
  lines.push('# Flaky Test Triage: Prioritized Fix Plan')
  lines.push('')
  lines.push('## Executive summary')
  lines.push(
    `Investigated ${investigations.length} flaky tests. Root cause was determined for ${knowns.length}; ${unknowns.length} test(s) remain unknown and are explicitly flagged below.`,
  )
  lines.push('')
  lines.push('## Prioritized fix plan')
  investigations.forEach((item, index) => {
    const status = item.root_cause_determined
      ? item.root_cause
      : 'ROOT CAUSE NOT DETERMINED'
    lines.push(
      `${index + 1}. **${item.test_name}** (${item.test_id}) — ${status}`,
    )
    lines.push(`   - Proposed fix: ${item.proposed_fix.summary}`)
    lines.push(`   - Confidence: ${item.confidence}`)
    if (item.file) lines.push(`   - File: ${item.file}`)
  })
  lines.push('')
  lines.push('## Root cause not determined')
  if (unknowns.length === 0) {
    lines.push('None.')
  } else {
    unknowns.forEach((item) => {
      lines.push(`- **${item.test_name}** (${item.test_id})`)
      lines.push(`  - Why unknown: ${item.unknown_reason}`)
      if (item.next_steps_if_unknown.length) {
        lines.push(
          `  - Next steps: ${item.next_steps_if_unknown.join('; ')}`,
        )
      }
    })
  }
  lines.push('')
  lines.push('## Validation strategy')
  lines.push(
    '- After implementing each fix, run the affected test repeatedly and in parallel with neighboring suites.',
  )
  lines.push(
    '- Re-run the CI job or shard that historically exposed the flake.',
  )
  lines.push(
    '- Track post-merge failure rate for the touched tests before closing the flake issues.',
  )
  return lines.join('\n')
}

const finalReport = synthesis
  ? synthesis.markdown_report
  : buildFallbackReport(normalizedInvestigations)

log('Flaky-test triage synthesis complete.')
log(finalReport)

finalReport
```

> **GPT-5.5 judge:** The workflow uses a single hard-barrier `parallel()` fan-out across all 18 investigations, with no bounded waves, no armed stall watchdog/ScheduleWakeup, no per-agent retry wrapper, no timeout handling, no per-wave or incremental result commits, no resume/cache-stable prompts, and no high-failure-rate backoff. If one subagent hangs, the whole run can deadlock before synthesis and completed work remains only in memory, risking loss. It does get partial credit for structured/lean schemas, null-tolerant normalization after subagent completion, fallback synthesis, and explicit flagging of unknown root causes, but those only help if the parallel barrier returns.

## With skill — rubric 86%, patterns 100%

```js
export const meta = {
  name: 'flaky-test-triage',
  description: 'Investigate flaky tests in bounded waves and synthesize a prioritized fix plan with explicit gaps.',
  phases: [
    { title: 'Validate Inputs' },
    { title: 'Investigate' },
    { title: 'Retry' },
    { title: 'Synthesize' },
  ],
}

/*
Agent-level watchdog to arm immediately after launching this workflow
(replace wf_<id>, <taskId>, and <path> with the Workflow launch result values):

ScheduleWakeup({
  delaySeconds: 1200,
  reason: "watchdog: swarm wf_<id> may stall silently; check journal mtime",
  prompt: "Watchdog for swarm run wf_<id> (task <taskId>, journal at <path>): if the journal mtime is older than 20 min AND the workflow task is not 'completed', TaskStop the task then resume with Workflow({scriptPath, resumeFromRunId}). Otherwise re-arm another 1200s ScheduleWakeup. Do NOT use the autonomous-loop sentinel — this is a plain one-shot watchdog, not a /loop."
})
*/

const TRIAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'key',
    'testName',
    'status',
    'rootCauseDetermined',
    'confidence',
    'rootCauseSummary',
    'failureMode',
    'evidence',
    'proposedFix',
    'priorityHint',
    'risk',
    'validationPlan',
    'commandsRun',
    'filesInspected',
    'followUpNeeded',
  ],
  properties: {
    key: { type: 'string' },
    testName: { type: 'string' },
    status: { type: 'string', enum: ['determined', 'likely', 'undetermined'] },
    rootCauseDetermined: { type: 'boolean' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    rootCauseSummary: { type: 'string', maxLength: 900 },
    failureMode: {
      type: 'string',
      enum: [
        'async-timing',
        'shared-state',
        'test-order-dependency',
        'time-randomness',
        'external-service',
        'resource-leak',
        'fixture-cleanup',
        'environment-specific',
        'race-condition',
        'assertion-too-broad-or-too-strict',
        'product-bug',
        'unknown',
        'other',
      ],
    },
    evidence: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['source', 'observation'],
        properties: {
          source: { type: 'string', maxLength: 240 },
          observation: { type: 'string', maxLength: 500 },
        },
      },
    },
    proposedFix: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'filesToChange', 'patchSketch', 'ownerArea'],
      properties: {
        summary: { type: 'string', maxLength: 900 },
        filesToChange: {
          type: 'array',
          maxItems: 8,
          items: { type: 'string', maxLength: 220 },
        },
        patchSketch: { type: 'string', maxLength: 1400 },
        ownerArea: { type: 'string', maxLength: 160 },
      },
    },
    priorityHint: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
    risk: { type: 'string', enum: ['low', 'medium', 'high'] },
    validationPlan: {
      type: 'array',
      maxItems: 5,
      items: { type: 'string', maxLength: 300 },
    },
    commandsRun: {
      type: 'array',
      maxItems: 6,
      items: { type: 'string', maxLength: 260 },
    },
    filesInspected: {
      type: 'array',
      maxItems: 12,
      items: { type: 'string', maxLength: 220 },
    },
    followUpNeeded: {
      type: 'array',
      maxItems: 5,
      items: { type: 'string', maxLength: 300 },
    },
  },
}

const SYNTHESIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'executiveSummary',
    'prioritizedFixPlan',
    'clusters',
    'undeterminedTests',
    'missingInvestigations',
    'validationStrategy',
    'recommendedExecutionOrder',
  ],
  properties: {
    executiveSummary: { type: 'string', maxLength: 1800 },
    prioritizedFixPlan: {
      type: 'array',
      maxItems: 18,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'rank',
          'priority',
          'testsCovered',
          'rootCause',
          'fix',
          'rationale',
          'risk',
          'confidence',
          'validation',
        ],
        properties: {
          rank: { type: 'integer', minimum: 1 },
          priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          testsCovered: {
            type: 'array',
            maxItems: 18,
            items: { type: 'string' },
          },
          rootCause: { type: 'string', maxLength: 900 },
          fix: { type: 'string', maxLength: 1200 },
          rationale: { type: 'string', maxLength: 900 },
          risk: { type: 'string', enum: ['low', 'medium', 'high'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          validation: {
            type: 'array',
            maxItems: 6,
            items: { type: 'string', maxLength: 300 },
          },
        },
      },
    },
    clusters: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['theme', 'tests', 'sharedFixOpportunity'],
        properties: {
          theme: { type: 'string', maxLength: 240 },
          tests: {
            type: 'array',
            maxItems: 18,
            items: { type: 'string' },
          },
          sharedFixOpportunity: { type: 'string', maxLength: 800 },
        },
      },
    },
    undeterminedTests: {
      type: 'array',
      maxItems: 18,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'testName', 'whyUndetermined', 'recommendedNextSteps'],
        properties: {
          key: { type: 'string' },
          testName: { type: 'string' },
          whyUndetermined: { type: 'string', maxLength: 900 },
          recommendedNextSteps: {
            type: 'array',
            maxItems: 5,
            items: { type: 'string', maxLength: 300 },
          },
        },
      },
    },
    missingInvestigations: {
      type: 'array',
      maxItems: 18,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'testName', 'reason'],
        properties: {
          key: { type: 'string' },
          testName: { type: 'string' },
          reason: { type: 'string', maxLength: 500 },
        },
      },
    },
    validationStrategy: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string', maxLength: 400 },
    },
    recommendedExecutionOrder: {
      type: 'array',
      maxItems: 18,
      items: { type: 'string', maxLength: 300 },
    },
  },
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject)
  if (value && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value).sort()) out[key] = stableObject(value[key])
    return out
  }
  return value
}

function stableStringify(value) {
  return JSON.stringify(stableObject(value), null, 2)
}

function compactString(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function keyBaseFor(raw, index) {
  if (typeof raw === 'string') return compactString(raw) || `test-${String(index + 1).padStart(2, '0')}`
  return (
    compactString(raw.key) ||
    compactString(raw.id) ||
    compactString(raw.testName) ||
    compactString(raw.name) ||
    compactString(raw.title) ||
    compactString(raw.file) ||
    `test-${String(index + 1).padStart(2, '0')}`
  )
}

function normalizeRawTest(raw, index) {
  if (typeof raw === 'string') {
    return {
      keyBase: keyBaseFor(raw, index),
      testName: compactString(raw),
      file: '',
      command: '',
      failure: '',
      notes: '',
      raw,
    }
  }

  const testName =
    compactString(raw.testName) ||
    compactString(raw.name) ||
    compactString(raw.title) ||
    compactString(raw.id) ||
    compactString(raw.key) ||
    `test-${String(index + 1).padStart(2, '0')}`

  return {
    keyBase: keyBaseFor(raw, index),
    testName,
    file: compactString(raw.file || raw.path || raw.testFile),
    command: compactString(raw.command || raw.testCommand || raw.reproCommand),
    failure: compactString(raw.failure || raw.failureLog || raw.error || raw.symptom),
    notes: compactString(raw.notes || raw.context || raw.description),
    raw,
  }
}

function normalizeTests(input) {
  const seen = {}
  return input.map((raw, index) => {
    const normalized = normalizeRawTest(raw, index)
    const base = normalized.keyBase
    const count = seen[base] || 0
    seen[base] = count + 1
    return {
      key: count === 0 ? base : `${base}__${count + 1}`,
      testName: normalized.testName,
      file: normalized.file,
      command: normalized.command,
      failure: normalized.failure,
      notes: normalized.notes,
      ordinal: index + 1,
      raw: normalized.raw,
    }
  })
}

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function chooseWaveSize(value) {
  const n = Number(value || 6)
  if (!Number.isFinite(n)) return 6
  if (n < 6) return 6
  if (n > 8) return 8
  return Math.floor(n)
}

function labelFor(prefix, key) {
  const clean = String(key).replace(/\s+/g, ' ').slice(0, 80)
  return `${prefix}:${clean}`
}

const rawTests =
  Array.isArray(args?.tests) ? args.tests :
  Array.isArray(args?.flakyTests) ? args.flakyTests :
  Array.isArray(args) ? args :
  typeof args?.tests === 'string' ? args.tests.split('\n').map(s => s.trim()).filter(Boolean) :
  typeof args?.flakyTests === 'string' ? args.flakyTests.split('\n').map(s => s.trim()).filter(Boolean) :
  []

phase('Validate Inputs')

if (!rawTests.length) {
  log('No flaky tests were provided. Pass args.tests as an array of 18 test names/spec objects.')
  return {
    error: 'No tests provided',
    expectedArgsShape: {
      tests: [
        {
          key: 'stable-test-id',
          testName: 'name of flaky test',
          file: 'optional/path/to/test_file',
          command: 'optional command to reproduce',
          failure: 'optional failure excerpt',
          notes: 'optional context',
        },
      ],
    },
  }
}

const tests = normalizeTests(rawTests)
const expectedCount = Number(args?.expectedCount || 18)
if (tests.length !== expectedCount) {
  log(`Input contains ${tests.length} tests; expected ${expectedCount}. Proceeding with all provided tests.`)
}

const repoContext = compactString(args?.repoContext || args?.context || '')
const globalReproCommand = compactString(args?.reproCommand || args?.command || '')
const triageHints = compactString(args?.hints || args?.triageHints || '')
const waveSize = chooseWaveSize(args?.waveSize)
const waves = chunk(tests, waveSize)

function buildTriagePrompt(test) {
  const payload = {
    test: {
      key: test.key,
      ordinal: test.ordinal,
      testName: test.testName,
      file: test.file,
      command: test.command,
      failure: test.failure,
      notes: test.notes,
    },
    repositoryContext: repoContext,
    globalReproCommand,
    triageHints,
  }

  return `You are a senior test-infrastructure engineer triaging exactly one flaky test.

Goal:
Find the most likely root cause of this flaky test and propose a concrete, minimal fix.

Test specification:
${stableStringify(payload)}

Instructions:
- Work independently. Inspect the repository, relevant test code, fixtures, helpers, and implementation code.
- If practical, run the provided test command or a targeted equivalent. If a command is missing, infer a safe targeted command from the repo.
- Prefer evidence from code paths, fixtures, logs, assertions, timing, shared state, mocks, async handling, cleanup, and external dependencies.
- Do not edit files permanently. If a fix is clear, provide a concise patch sketch or exact change description.
- If you cannot determine the root cause, set status="undetermined", rootCauseDetermined=false, confidence="low", failureMode="unknown", and explain what evidence is missing.
- Keep output lean: at most 5 evidence items, no long logs, no pasted file dumps.

Return only data conforming to the schema. The key field must be exactly: ${JSON.stringify(test.key)}.`
}

function runTriage(test, phaseTitle, attemptName) {
  return agent(buildTriagePrompt(test), {
    label: labelFor(attemptName, test.key),
    phase: phaseTitle,
    schema: TRIAGE_SCHEMA,
    model: args?.workerModel || undefined,
    effort: args?.workerEffort || 'medium',
    isolation: 'worktree',
  })
}

const done = []
let failed = []
let instabilityBackoff = false
let backoffWave = null
const launchedKeys = new Set()

phase('Investigate')
log(`Triaging ${tests.length} flaky tests in ${waves.length} wave(s) of ${waveSize}.`)

for (let w = 0; w < waves.length; w++) {
  const wave = waves[w]
  const phaseTitle = `Investigate Wave ${w + 1}/${waves.length}`
  phase(phaseTitle)

  for (const test of wave) launchedKeys.add(test.key)

  const batch = await parallel(wave.map(test => () => runTriage(test, phaseTitle, 'triage')))
  let nulls = 0

  batch.forEach((result, i) => {
    if (result) {
      done.push(result)
    } else {
      nulls += 1
      failed.push(wave[i])
    }
  })

  log(`Wave ${w + 1}/${waves.length}: ${batch.length - nulls}/${batch.length} succeeded; ${done.length}/${tests.length} total complete; ${failed.length} queued for retry.`)

  if (nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} failed this wave — backing off; return partial, resume later`)
    instabilityBackoff = true
    backoffWave = w + 1
    break
  }
}

if (failed.length && !instabilityBackoff) {
  phase('Retry')
  const retryWave = failed.slice()
  failed = []

  log(`Retrying ${retryWave.length} failed flaky-test investigation(s) after natural backoff.`)
  const retried = await parallel(retryWave.map(test => () => runTriage(test, 'Retry', 'triage-retry')))

  let retryNulls = 0
  retried.forEach((result, i) => {
    if (result) {
      done.push(result)
    } else {
      retryNulls += 1
      failed.push(retryWave[i])
    }
  })

  log(`Retry recovered ${retried.length - retryNulls}/${retried.length}; still missing ${failed.length}.`)

  if (retried.length && retryNulls / retried.length > 0.4) {
    log(`instability: ${retryNulls}/${retried.length} failed in retry wave — returning partial results; resume later`)
    instabilityBackoff = true
    backoffWave = 'retry'
  }
}

const dedupedByKey = {}
for (const result of done) {
  if (result && result.key) dedupedByKey[result.key] = result
}
const orderedResults = Object.values(dedupedByKey).sort((a, b) => (a.key > b.key ? 1 : a.key < b.key ? -1 : 0))

const haveKeys = new Set(orderedResults.map(r => r.key))
const missingInvestigations = tests
  .filter(test => !haveKeys.has(test.key))
  .map(test => ({
    key: test.key,
    testName: test.testName,
    reason: launchedKeys.has(test.key)
      ? 'Subagent did not return a usable triage result.'
      : 'Investigation was not launched because instability backoff stopped later waves.',
  }))

const undeterminedFromResults = orderedResults
  .filter(r => !r.rootCauseDetermined || r.status === 'undetermined')
  .map(r => ({
    key: r.key,
    testName: r.testName,
    whyUndetermined: r.rootCauseSummary || 'Root cause was not determined by the triage subagent.',
    recommendedNextSteps: r.followUpNeeded || [],
  }))

if (missingInvestigations.length) {
  log(`partial: missing ${missingInvestigations.length}/${tests.length}: ${missingInvestigations.map(t => t.key).join(', ')}`)
}

if (undeterminedFromResults.length) {
  log(`undetermined root cause(s): ${undeterminedFromResults.map(t => t.key).join(', ')}`)
}

function buildSynthesisPrompt() {
  const payload = {
    totalTests: tests.length,
    investigatedCount: orderedResults.length,
    expectedCount,
    instabilityBackoff,
    backoffWave,
    results: orderedResults,
    missingInvestigations,
    undeterminedFromResults,
  }

  return `You are synthesizing a prioritized engineering fix plan from flaky-test triage results.

Use only the evidence in the payload. Do not invent root causes for missing or undetermined tests.

Requirements:
- Produce a prioritized fix plan, highest impact and highest confidence first.
- Group tests that share the same root cause or likely shared fix.
- Clearly flag every test whose root cause could not be determined.
- Clearly flag every test whose investigation is missing because a subagent failed, was skipped, or the workflow backed off.
- Include validation strategy: targeted tests, repeated runs, order-randomization if relevant, and CI signal to monitor.
- If results are partial, the plan must say it is partial and identify exactly what remains unknown.

Payload:
${stableStringify(payload)}`
}

phase('Synthesize')
const synthesis = await agent(buildSynthesisPrompt(), {
  label: 'synthesize-flaky-test-fix-plan',
  phase: 'Synthesize',
  schema: SYNTHESIS_SCHEMA,
  model: args?.synthesisModel || undefined,
  effort: args?.synthesisEffort || 'high',
})

const fallbackSynthesis = {
  executiveSummary: synthesis
    ? synthesis.executiveSummary
    : `Synthesis agent did not return a result. ${orderedResults.length}/${tests.length} tests have triage results; ${missingInvestigations.length} investigations are missing; ${undeterminedFromResults.length} returned undetermined root causes.`,
  prioritizedFixPlan: synthesis ? synthesis.prioritizedFixPlan : [],
  clusters: synthesis ? synthesis.clusters : [],
  undeterminedTests: synthesis ? synthesis.undeterminedTests : undeterminedFromResults,
  missingInvestigations: synthesis ? synthesis.missingInvestigations : missingInvestigations,
  validationStrategy: synthesis
    ? synthesis.validationStrategy
    : [
        'Re-run each fixed flaky test repeatedly in isolation.',
        'Run the affected test files as a group to detect order dependencies.',
        'Run the relevant CI shard multiple times before closing the triage.',
      ],
  recommendedExecutionOrder: synthesis ? synthesis.recommendedExecutionOrder : [],
}

return {
  workflow: 'flaky-test-triage',
  totalTests: tests.length,
  completedInvestigations: orderedResults.length,
  missingInvestigationCount: missingInvestigations.length,
  undeterminedRootCauseCount: undeterminedFromResults.length,
  instabilityBackoff,
  backoffWave,
  results: orderedResults,
  missingInvestigations,
  undeterminedFromResults,
  synthesis: fallbackSynthesis,
  resumeGuidance: instabilityBackoff || missingInvestigations.length
    ? 'Resume this workflow with Workflow({ scriptPath, resumeFromRunId }) after the API window clears; completed triage agents will be cached and missing/null agents will rerun.'
    : 'All provided tests received triage results.',
}
```

> **GPT-5.5 judge:** The script meets most of the safety bar: it uses bounded waves of 6-8 instead of one giant fan-out, tolerates null subagent results, retries failed/null investigations once, accumulates completed results wave by wave, backs off when a wave has >40% failures, uses lean capped schemas, stable labels/prompts keyed by test, synthesizes partial results, and explicitly reports missing/undetermined investigations with resume guidance. The main weakness is that the ScheduleWakeup watchdog is only provided as a comment/instruction to the caller rather than being armed by the workflow itself, so hung parallel calls still rely on external setup. Also, completed work is accumulated in memory rather than explicitly checkpointed to durable storage, though cached agent labels/resume guidance mitigate this. Overall it is strongly safe-by-construction but not perfect.

