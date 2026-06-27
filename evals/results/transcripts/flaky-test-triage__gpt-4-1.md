# flaky-test-triage — `gpt-4.1`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for FLAKY-TEST TRIAGE: investigate 18 flaky tests. One subagent per test finds the root cause and proposes a fix. Then synthesize a prioritized fix plan, clearly flagging any test whose root cause could not be determined.

---

## Baseline (no skill) — rubric 20%, patterns 38%

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

// Helper: schema for each test investigation result
const investigationSchema = {
  type: 'object',
  required: ['testName', 'rootCauseFound', 'rootCause', 'proposedFix', 'notes'],
  properties: {
    testName: { type: 'string', description: 'Name or identifier of the flaky test.' },
    rootCauseFound: { type: 'boolean', description: 'Was the root cause determined?' },
    rootCause: { type: 'string', description: 'Description of the root cause, or "Unknown" if not found.' },
    proposedFix: { type: 'string', description: 'Proposed fix, or "N/A" if root cause not found.' },
    notes: { type: 'string', description: 'Any additional notes or context.' }
  }
}

// 1. Get the list of flaky tests from args
const flakyTests = Array.isArray(args?.flakyTests) && args.flakyTests.length === 18
  ? args.flakyTests
  : (() => { throw new Error('args.flakyTests must be an array of 18 test names/IDs'); })();

phase('Investigate Flaky Tests');
log(`Investigating ${flakyTests.length} flaky tests in parallel...`);

// 2. Investigate each flaky test in parallel
const investigations = await parallel(
  flakyTests.map((testName, idx) => async () =>
    await agent(
      `You are a test reliability expert. Investigate the flaky test "${testName}". 
      - Analyze logs, code, and recent changes (assume you have access).
      - Determine the most likely root cause of the flakiness.
      - If you cannot determine the root cause, state so clearly.
      - Propose a concrete fix if possible.
      - Summarize your findings in the following JSON format:
      {
        "testName": "<test name>",
        "rootCauseFound": <true|false>,
        "rootCause": "<root cause or 'Unknown'>",
        "proposedFix": "<proposed fix or 'N/A'>",
        "notes": "<any additional notes>"
      }`,
      {
        label: `Investigate: ${testName}`,
        phase: 'Investigate Flaky Tests',
        schema: investigationSchema,
        effort: 'medium'
      }
    )
  )
);

// 3. Filter out nulls (failed/skipped agents)
const validInvestigations = investigations.filter(Boolean);

// 4. Synthesize a prioritized fix plan
phase('Synthesize Fix Plan');
log('Synthesizing prioritized fix plan...');

const fixPlan = await agent(
  `You are a senior engineering lead. Given the following investigation results for 18 flaky tests, synthesize a prioritized fix plan.
- For each test, include: test name, root cause (or "Unknown"), proposed fix (or "N/A"), and priority (High/Medium/Low).
- Clearly flag any test whose root cause could not be determined.
- Prioritize fixes that unblock critical workflows, affect many users, or are easy wins.
- Present the plan as a markdown table with columns: Test Name | Root Cause | Proposed Fix | Priority | Notes | Flagged (if root cause unknown).
- After the table, summarize key themes and next steps.

Investigation results:
${JSON.stringify(validInvestigations, null, 2)}
`,
  {
    label: 'Synthesize Fix Plan',
    phase: 'Synthesize Fix Plan',
    effort: 'high',
    model: 'claude-3-opus-20240229'
  }
);

return {
  investigations: validInvestigations,
  fixPlan
};
```

> **GPT-5.5 judge:** The script uses one giant parallel() fan-out over all 18 tests with a single hard barrier before synthesis. It has no bounded waves, no per-agent try/catch or retry, no timeout/stall watchdog such as ScheduleWakeup, no per-wave commits/checkpointing, no resume/cache-stable prompts, and no backoff when failures are high. Filtering Boolean results gives only weak null tolerance and may not help if parallel() rejects on one hung or failed agent. It does use a lean JSON schema for investigation outputs and the synthesis prompt can flag unknown root causes for completed investigations, but it may silently omit failed/missing investigations from validInvestigations. Overall it fails the safe-by-construction bar for large parallel subagent fan-out.

## With skill — rubric 30%, patterns 50%

````js
```js
export const meta = {
  name: 'flaky-test-triage',
  description: 'Investigate 18 flaky tests, find root causes and propose fixes, then synthesize a prioritized fix plan with explicit flags for undiagnosed tests.',
  phases: [
    { title: 'Investigate Flaky Tests' },
    { title: 'Synthesize Fix Plan' }
  ]
}

// --- CONFIGURATION ---

// List of 18 flaky tests to triage. Each test has a stable key and a short description.
// Replace with your actual test identifiers and summaries.
const TESTS = [
  { key: 'test-login-redirect', description: 'Login redirects to dashboard intermittently fails' },
  { key: 'test-payment-timeout', description: 'Payment flow times out sporadically' },
  { key: 'test-user-profile-update', description: 'Profile update test fails on CI only' },
  { key: 'test-email-notification', description: 'Email notification not sent in some runs' },
  { key: 'test-cart-add-item', description: 'Adding item to cart fails randomly' },
  { key: 'test-logout', description: 'Logout test fails under load' },
  { key: 'test-search-autocomplete', description: 'Autocomplete returns empty results occasionally' },
  { key: 'test-order-history', description: 'Order history test fails on Mondays' },
  { key: 'test-reset-password', description: 'Reset password email not received sometimes' },
  { key: 'test-mobile-signup', description: 'Mobile signup test fails on Android' },
  { key: 'test-api-rate-limit', description: 'API rate limit test is flaky' },
  { key: 'test-image-upload', description: 'Image upload test fails with 500 error' },
  { key: 'test-session-expiry', description: 'Session expiry test fails after midnight' },
  { key: 'test-multi-factor-auth', description: 'MFA test fails on first attempt' },
  { key: 'test-coupon-apply', description: 'Coupon apply test fails for expired coupons' },
  { key: 'test-inventory-sync', description: 'Inventory sync test fails on staging' },
  { key: 'test-shipping-calculation', description: 'Shipping calculation test fails for international addresses' },
  { key: 'test-wishlist-add', description: 'Adding to wishlist fails intermittently' }
]

// Schema for each investigation result
const INVESTIGATION_SCHEMA = {
  type: 'object',
  required: ['testKey', 'rootCauseFound', 'rootCause', 'proposedFix', 'confidence', 'notes'],
  properties: {
    testKey: { type: 'string', description: 'Stable key for the test' },
    rootCauseFound: { type: 'boolean', description: 'Was a root cause determined?' },
    rootCause: { type: 'string', description: 'If found, a concise summary of the root cause. If not, state "Unknown".' },
    proposedFix: { type: 'string', description: 'If root cause found, a concrete fix proposal. If not, state "N/A".' },
    confidence: { type: 'string', description: 'Confidence level in the diagnosis (High/Medium/Low)' },
    notes: { type: 'string', description: 'Any additional notes, evidence, or uncertainty. If root cause not found, explain what was tried.' }
  }
}

// Schema for the synthesized fix plan
const FIX_PLAN_SCHEMA = {
  type: 'object',
  required: ['prioritizedPlan', 'undeterminedTests', 'summary'],
  properties: {
    prioritizedPlan: {
      type: 'array',
      description: 'Ordered list of fix actions, most urgent first. Each includes testKey, summary, and fix.',
      items: {
        type: 'object',
        required: ['testKey', 'summary', 'proposedFix', 'confidence'],
        properties: {
          testKey: { type: 'string' },
          summary: { type: 'string' },
          proposedFix: { type: 'string' },
          confidence: { type: 'string' }
        }
      }
    },
    undeterminedTests: {
      type: 'array',
      description: 'List of testKeys where root cause could not be determined.',
      items: { type: 'string' }
    },
    summary: {
      type: 'string',
      description: 'A brief summary of the overall triage, including any patterns, blockers, or next steps for undiagnosed tests.'
    }
  }
}

// --- UTILS ---

const WAVE_SIZE = 6
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }

// Stable prompt for each
````

> **GPT-5.5 judge:** The script defines stable test keys, a wave size of 6, and schemas that include rootCauseFound/undeterminedTests, which are good partial-safety ingredients. However, the actual orchestration is missing/truncated: there is no demonstrated per-agent retry or null-tolerance, no per-wave result persistence/commit, no ScheduleWakeup stall watchdog, no resume/cache-stable finder prompt implementation, no partial-input synthesis logic beyond schema fields, and no backoff when a wave failure rate is high. It also does not show how parallel fan-out is invoked, so it cannot be considered safe-by-construction against hung connections or silent result loss.

