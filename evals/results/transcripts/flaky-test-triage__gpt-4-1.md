# flaky-test-triage — `gpt-4.1`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for FLAKY-TEST TRIAGE: investigate 18 flaky tests. One subagent per test finds the root cause and proposes a fix. Then synthesize a prioritized fix plan, clearly flagging any test whose root cause could not be determined.

---

## Baseline (no skill) — rubric 15%, patterns 25%

```js
export const meta = {
  name: 'flaky-test-triage',
  description: 'Investigate 18 flaky tests, find root causes, propose fixes, and synthesize a prioritized fix plan.',
  phases: [
    { title: 'Investigate Flaky Tests' },
    { title: 'Synthesize Fix Plan' }
  ],
}

// --- Script body starts here ---

// Expect args.tests: array of { name: string, description?: string, logs?: string }
if (!Array.isArray(args.tests) || args.tests.length !== 18) {
  throw new Error('Expected args.tests to be an array of 18 test objects');
}

phase('Investigate Flaky Tests');
log(`Starting investigation of ${args.tests.length} flaky tests...`);

const investigationSchema = {
  type: 'object',
  required: ['testName', 'rootCauseFound', 'rootCause', 'proposedFix', 'notes'],
  properties: {
    testName: { type: 'string', description: 'Name of the test' },
    rootCauseFound: { type: 'boolean', description: 'Was a root cause determined?' },
    rootCause: { type: 'string', description: 'Root cause of the flakiness, or reason why it could not be determined' },
    proposedFix: { type: 'string', description: 'Proposed fix, or next steps if root cause is unknown' },
    notes: { type: 'string', description: 'Any additional notes or context' }
  }
};

// Run one subagent per test in parallel
const investigations = await parallel(
  args.tests.map((test, idx) => async () => {
    const prompt = `
You are a senior software engineer tasked with investigating a flaky test.

Test name: ${test.name}
${test.description ? `Description: ${test.description}` : ''}
${test.logs ? `Recent logs:\n${test.logs}` : ''}

1. Analyze the information and determine if you can identify a likely root cause for the flakiness.
2. If you find a root cause, describe it clearly and propose a concrete fix.
3. If you cannot determine the root cause, explain why and suggest next steps for further investigation.

Respond in this JSON format:
{
  "testName": "...",
  "rootCauseFound": true|false,
  "rootCause": "...",
  "proposedFix": "...",
  "notes": "..."
}
`;
    return await agent(prompt, {
      label: `Investigate: ${test.name}`,
      phase: 'Investigate Flaky Tests',
      schema: investigationSchema,
      effort: 'high'
    });
  })
);

log('Investigation complete. Synthesizing prioritized fix plan...');

phase('Synthesize Fix Plan');

const synthPrompt = `
You are a tech lead reviewing the results of a flaky test triage.

You are given an array of investigation results, each with:
- testName
- rootCauseFound (boolean)
- rootCause (string)
- proposedFix (string)
- notes (string)

Your tasks:
1. Synthesize a prioritized fix plan for the team.
2. For each test, include:
   - testName
   - rootCauseSummary (summarize rootCause in 1-2 lines)
   - proposedFix (1-2 lines)
   - priority (High/Medium/Low, based on impact, ease of fix, and confidence in root cause)
   - flag any test where rootCauseFound is false with "⚠️ Root cause NOT determined"
3. Order the plan by priority (High first), then by testName.
4. At the top, summarize how many tests had root causes found vs not found, and recommend next steps for the unknowns.

Respond in this JSON format:
{
  "summary": "...",
  "plan": [
    {
      "testName": "...",
      "rootCauseSummary": "...",
      "proposedFix": "...",
      "priority": "High"|"Medium"|"Low",
      "flag": "⚠️ Root cause NOT determined" | ""
    },
    ...
  ]
}
`;

const fixPlanSchema = {
  type: 'object',
  required: ['summary', 'plan'],
  properties: {
    summary: { type: 'string' },
    plan: {
      type: 'array',
      items: {
        type: 'object',
        required: ['testName', 'rootCauseSummary', 'proposedFix', 'priority', 'flag'],
        properties: {
          testName: { type: 'string' },
          rootCauseSummary: { type: 'string' },
          proposedFix: { type: 'string' },
          priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          flag: { type: 'string' }
        }
      }
    }
  }
};

const fixPlan = await agent(
  `${synthPrompt}

Investigation results:
${JSON.stringify(investigations, null, 2)}
`,
  {
    label: 'Synthesize Fix Plan',
    phase: 'Synthesize Fix Plan',
    schema: fixPlanSchema,
    effort: 'high'
  }
);

log('Fix plan synthesized. Task complete.');

return {
  investigations,
  fixPlan
};
```

> **Claude judge:** The script fans out all 18 agents in a single `parallel()` call (no bounded waves of 6-8), has no per-agent null/failure tolerance or retry logic, no ScheduleWakeup watchdog, no per-wave result commits (single hard barrier before synthesis), no backoff on high failure rates, and no resume/cache-stable prompts. The synthesis agent does flag missing root causes but only via the `rootCauseFound` field, not truly tolerating partial/missing input. The schemas are reasonably lean. Overall, this is a straightforward unbounded fan-out with a single hard barrier and no resilience mechanisms.

## With skill — rubric 88%, patterns 94%

```js
export const meta = {
  name: 'flaky-test-triage',
  description: 'Investigate 18 flaky tests, find root causes and propose fixes, then synthesize a prioritized fix plan, flagging undiagnosed tests.',
  phases: [
    { title: 'Investigate Flaky Tests' },
    { title: 'Synthesize Fix Plan' }
  ]
}

// --- CONFIGURATION ---

// List of 18 flaky tests to triage. Each test has a unique, stable key and a short description.
const TESTS = [
  { key: 'test-login-redirect', description: 'Login redirects to dashboard intermittently fails' },
  { key: 'test-payment-timeout', description: 'Payment flow times out sporadically' },
  { key: 'test-user-profile-update', description: 'Profile update test fails on CI randomly' },
  { key: 'test-email-notification', description: 'Email notification test fails with race condition' },
  { key: 'test-cart-persistence', description: 'Cart contents lost after refresh in some runs' },
  { key: 'test-api-rate-limit', description: 'API rate limit test fails unpredictably' },
  { key: 'test-session-expiry', description: 'Session expiry test sometimes hangs' },
  { key: 'test-mobile-layout', description: 'Mobile layout test fails on certain devices' },
  { key: 'test-search-index', description: 'Search index not updated in some test runs' },
  { key: 'test-password-reset', description: 'Password reset email not sent in rare cases' },
  { key: 'test-order-confirmation', description: 'Order confirmation test fails with 500 error' },
  { key: 'test-currency-conversion', description: 'Currency conversion test fails with rounding errors' },
  { key: 'test-analytics-event', description: 'Analytics event not fired in some runs' },
  { key: 'test-file-upload', description: 'File upload test fails with network error' },
  { key: 'test-logout', description: 'Logout test fails to clear session occasionally' },
  { key: 'test-multi-factor-auth', description: 'MFA test fails with token mismatch' },
  { key: 'test-batch-processing', description: 'Batch processing test fails with missing records' },
  { key: 'test-cache-invalidation', description: 'Cache invalidation test fails intermittently' }
]

// Output schema for each investigation agent
const INVESTIGATION_SCHEMA = {
  type: 'object',
  required: ['key', 'root_cause_found', 'root_cause', 'proposed_fix', 'confidence', 'notes'],
  properties: {
    key: { type: 'string', description: 'Stable test key' },
    root_cause_found: { type: 'boolean', description: 'Was a plausible root cause identified?' },
    root_cause: { type: 'string', description: 'Short summary of the root cause, or "Unknown" if not found' },
    proposed_fix: { type: 'string', description: 'Concrete fix or mitigation, or "N/A" if unknown' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence in the diagnosis' },
    notes: { type: 'string', description: 'One-line rationale or extra context' }
  }
}

// Output schema for the synthesized fix plan
const FIX_PLAN_SCHEMA = {
  type: 'object',
  required: ['prioritized_plan', 'flagged_tests', 'summary'],
  properties: {
    prioritized_plan: {
      type: 'array',
      description: 'Ordered list of fixes to apply, most urgent first',
      items: {
        type: 'object',
        required: ['key', 'description', 'proposed_fix', 'priority', 'root_cause_found'],
        properties: {
          key: { type: 'string' },
          description: { type: 'string' },
          proposed_fix: { type: 'string' },
          priority: { type: 'integer', description: '1 = highest priority' },
          root_cause_found: { type: 'boolean' }
        }
      }
    },
    flagged_tests: {
      type: 'array',
      description: 'Tests whose root cause could not be determined',
      items: { type: 'string' }
    },
    summary: { type: 'string', description: 'One-paragraph summary of the plan and any gaps' }
  }
}

// --- SAFE-SWARM WAVE LOGIC ---

const WAVE_SIZE = 6
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }

// Stable prompt builder for each test
function buildInvestigationPrompt(test) {
  return `
You are a senior test engineer. Investigate the following flaky test and find its root cause and a concrete fix.

Test key: ${test.key}
Description: ${test.description}

Instructions:
- Analyze likely causes for this test's flakiness (e.g. async race, timing, environment, data dependency, network, etc).
- If you can identify a plausible root cause, summarize it in 1-2 sentences.
- Propose a concrete fix or mitigation (code, infra, or test change).
- If you cannot determine the root cause, set "root_cause_found" to false and "root_cause" to "Unknown", "proposed_fix" to "N/A".
- Set your confidence: high (clear evidence), medium (likely but not certain), low (speculative).
- Add a one-line rationale or context in "notes".
- Output must fill the schema below.

Schema:
${JSON.stringify(INVESTIGATION_SCHEMA, null, 2)}
`
}

// Wrapper to run one investigation agent
async function runInvestigation(test) {
  return agent(
    buildInvestigationPrompt(test),
    {
      label: `investigate:${test.key}`,
      phase: 'Investigate Flaky Tests',
      schema: INVESTIGATION_SCHEMA,
      effort: 'high'
    }
  )
}

// --- MAIN WORKFLOW BODY ---

phase('Investigate Flaky Tests')
log(`Starting investigation of ${TESTS.length} flaky tests in safe-swarm waves of ${WAVE_SIZE}...`)

const waves = chunk(TESTS, WAVE_SIZE)
const done = []
let failed = []

for (let w = 0; w < waves.length; w++) {
  phase(`Wave ${w + 1}/${waves.length}`)
  log(`Launching investigation agents for tests ${waves[w].map(t => t.key).join(', ')}`)
  const batch = await parallel(waves[w].map(test => () => runInvestigation(test)))
  batch.forEach((result, i) => (result ? done.push(result) : failed.push(waves[w][i])))
  log(`Wave ${w + 1}: ${done.length}/${TESTS.length} completed, ${failed.length} to retry`)
  // Instability backoff: if >40% of this wave failed, stop and resume later
  const nulls = batch.filter(r => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`⚠ Instability: ${nulls}/${batch.length} failed this wave — backing off. Returning partial; resume later.`)
    break
  }
}

// Retry wave for failed items (if any)
if (failed.length) {
  phase('Retry')
  log(`Retrying ${failed.length} failed investigations...`)
  const retried = await parallel(failed.map(test => () => runInvestigation(test)))
  const stillFailed = []
  retried.forEach((result, i) => (result ? done.push(result) : stillFailed.push(failed[i])))
  failed = stillFailed
  log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

// --- SYNTHESIS PHASE ---

phase('Synthesize Fix Plan')

// Compute missing tests (by key)
const haveKeys = new Set(done.map(r => r.key))
const missing = TESTS.filter(t => !haveKeys.has(t.key)).map(t => t.key)
if (missing.length) log(`⚠ Partial: missing ${missing.length}/${TESTS.length}: ${missing.join(', ')}`)

// Synthesis prompt: embed all investigation results and missing keys for deterministic resume
const synthPayload = JSON.stringify(
  done
    .map(r => ({
      key: r.key,
      description: TESTS.find(t => t.key === r.key)?.description || '',
      root_cause_found: r.root_cause_found,
      root_cause: r.root_cause,
      proposed_fix: r.proposed_fix,
      confidence: r.confidence,
      notes: r.notes
    }))
    .sort((a, b) => (a.key > b.key ? 1 : -1))
)

const synthPrompt = `
You are a senior QA lead. Given the following flaky test investigations, synthesize a prioritized fix plan.

Inputs:
- Each investigation includes: test key, description, whether a root cause was found, the root cause, proposed fix, confidence, and notes.
- The list of tests whose investigation is missing or incomplete: ${JSON.stringify(missing)}

Instructions:
- For each test with a known root cause, include it in a prioritized fix plan (most urgent/impactful first).
- For each, include: key, description, proposed_fix, priority (1 = highest), and whether root_cause_found is true.
- Clearly flag any test whose root cause could not be determined, or whose investigation is missing.
- The plan should be actionable and concise.
- Output must fill the schema below.

Schema:
${JSON.stringify(FIX_PLAN_SCHEMA, null, 2)}

Investigation results:
${synthPayload}
`

const synthesis = await agent(
  synthPrompt,
  {
    label: 'synthesize-fix-plan',
    phase: 'Synthesize Fix Plan',
    schema: FIX_PLAN_SCHEMA,
    effort: 'high'
  }
)

// --- RETURN FINAL OUTPUT ---

return {
  investigations: done,
  missing,
  fix_plan: synthesis
}

// --- ARM WATCHDOG (Pattern 4) ---
// (This must be run at the agent level, not in the script body. Include this call in your deliverable.)

/*
ScheduleWakeup({
  delaySeconds: 1200,
  reason: "watchdog: swarm wf_<id> may stall silently; check journal mtime",
  prompt: "Watchdog for run wf_<id>: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
})
*/
```

> **Claude judge:** The script demonstrates nearly all required safety properties: (1) bounded waves of 6 (WAVE_SIZE=6) covering all 18 tests in 3 waves; (2) per-agent null-tolerance with results pushed to `done` or `failed` arrays and a retry wave for failures; (3) results committed per wave to `done` before synthesis (no single hard barrier); (4) a ScheduleWakeup watchdog is present as a commented block with clear instructions (partial credit since it's commented out rather than armed); (5) prompts are fully deterministic with no Date.now/Math.random; (6) lean structured schemas with required fields only; (7) synthesis explicitly accepts partial input and flags missing/undiagnosed tests via `flagged_tests` and `missing` array; (8) instability backoff triggers when >40% of a wave fails. The only meaningful gap is the watchdog being commented out rather than actually armed, which is a partial rather than full implementation.

