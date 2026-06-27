# code-review-swarm — `gpt-4.1`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a CODE-REVIEW SWARM: review 28 changed files across five dimensions (correctness bugs, security, performance, style, missing tests). Spawn agents to find issues, then verify each candidate finding before including it, and synthesize a single prioritized review with severity levels.

---

## Baseline (no skill) — rubric 15%, patterns 31%

````js
```js
export const meta = {
  name: 'code-review-swarm',
  description: 'Performs a multi-dimensional code review swarm across 28 changed files, verifying and prioritizing findings.',
  phases: [
    { title: 'Issue Discovery' },
    { title: 'Finding Verification' },
    { title: 'Synthesis & Prioritization' }
  ]
}

// --- Helper definitions ---
const REVIEW_DIMENSIONS = [
  { key: 'correctness', label: 'Correctness Bugs' },
  { key: 'security', label: 'Security Issues' },
  { key: 'performance', label: 'Performance Problems' },
  { key: 'style', label: 'Style/Readability' },
  { key: 'tests', label: 'Missing/Insufficient Tests' }
];

const FINDING_SCHEMA = {
  type: 'object',
  required: ['dimension', 'description', 'location', 'severity', 'recommendation'],
  properties: {
    dimension: { type: 'string', enum: REVIEW_DIMENSIONS.map(d => d.key) },
    description: { type: 'string', minLength: 10 },
    location: { type: 'string', minLength: 1 }, // e.g., filename:line or function name
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
    recommendation: { type: 'string', minLength: 5 }
  }
};

const VERIFICATION_SCHEMA = {
  type: 'object',
  required: ['verdict', 'justification'],
  properties: {
    verdict: { type: 'string', enum: ['confirmed', 'rejected', 'uncertain'] },
    justification: { type: 'string', minLength: 5 }
  }
};

// --- Main workflow body ---

// Expect args: { changedFiles: Array<{filename: string, diff: string, fullText: string}> }
if (!args || !Array.isArray(args.changedFiles) || args.changedFiles.length !== 28) {
  throw new Error('Expected args.changedFiles to be an array of 28 changed files.');
}

phase('Issue Discovery');
log('Spawning review agents for each file and dimension...');

// For each file and dimension, spawn an agent to find issues
const findingsByFile = await parallel(
  args.changedFiles.map(file => async () => {
    // For each dimension, spawn an agent in parallel
    const findingsByDimension = await parallel(
      REVIEW_DIMENSIONS.map(dim => async () => {
        const prompt = `
You are a code review expert. Review the following changed file for **${dim.label}** issues.

File: ${file.filename}
Diff:
${file.diff}

Full file context:
${file.fullText}

List up to 3 distinct findings for this dimension. For each, provide:
- dimension: "${dim.key}"
- description: What is the issue? (concise, specific)
- location: Where is it? (filename:line or function name)
- severity: critical, high, medium, low, or info
- recommendation: How to address it

If no issues, return an empty array.

Respond as a JSON array of findings.
        `.trim();

        const findings = await agent(prompt, {
          label: `Find ${dim.label} in ${file.filename}`,
          phase: 'Issue Discovery',
          schema: {
            type: 'array',
            items: FINDING_SCHEMA,
            maxItems: 3
          },
          effort: 'medium'
        });
        return findings || [];
      })
    );
    // Flatten findings for this file
    return findingsByDimension.flat();
  })
);

// Flatten all findings across all files
const allCandidateFindings = findingsByFile.flat().filter(Boolean);

// Remove duplicate findings (by dimension, location, and description)
function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter(f => {
    const key = `${f.dimension}|${f.location}|${f.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
const dedupedFindings = dedupeFindings(allCandidateFindings);

phase('Finding Verification');
log(`Verifying ${dedupedFindings.length} candidate findings...`);

// For each finding, spawn a verification agent
const verifiedFindings = await parallel(
  dedupedFindings.map(finding => async () => {
    const file = args.changedFiles.find(f => finding.location.startsWith(f.filename));
    const context = file
      ? `File: ${file.filename}\nDiff:\n${file.diff}\nFull file context:\n${file.fullText}`
      : '';

    const prompt = `
You are a senior reviewer. Verify the following candidate code review finding.

Finding:
${JSON.stringify(finding, null, 2)}

Relevant code context:
${context}

Is this finding valid
````

> **GPT-5.5 judge:** The workflow uses a large nested parallel fan-out across 28 files × 5 dimensions, plus another unbounded parallel verification pass, with no bounded waves, no per-agent retry/timeout handling, no try/catch around agent failures, no per-wave result committing, no ScheduleWakeup/stall watchdog, no resume/cache-stable prompting, and no demonstrated partial-input synthesis or high-failure-rate backoff. It does get limited credit for capped finder outputs via schema/maxItems, basic schemas, deduplication, and a weak `findings || []` null fallback, but that would not protect against thrown/hung agents or preserve completed work across a hard barrier.

## With skill — rubric 20%, patterns 25%

````js
```js
export const meta = {
  name: 'code-review-swarm',
  description: 'Agentic swarm code review: review 28 files across correctness, security, performance, style, and tests; verify findings; synthesize prioritized review.',
  phases: [
    { title: 'Find Issues' },
    { title: 'Verify Findings' },
    { title: 'Synthesize Review' }
  ]
}

// === CONFIGURATION ===

// List of changed files (replace with actual file paths or objects as needed)
const FILES = [
  // Example file list; replace with real file paths or objects as needed
  "src/utils/math.js",
  "src/utils/string.js",
  "src/api/user.js",
  "src/api/order.js",
  "src/api/payment.js",
  "src/components/Button.jsx",
  "src/components/Modal.jsx",
  "src/components/Table.jsx",
  "src/components/Form.jsx",
  "src/hooks/useAuth.js",
  "src/hooks/useFetch.js",
  "src/store/userStore.js",
  "src/store/orderStore.js",
  "src/store/cartStore.js",
  "src/pages/Home.jsx",
  "src/pages/Login.jsx",
  "src/pages/Checkout.jsx",
  "src/pages/Profile.jsx",
  "src/tests/math.test.js",
  "src/tests/user.test.js",
  "src/tests/order.test.js",
  "src/tests/payment.test.js",
  "src/tests/Button.test.jsx",
  "src/tests/Modal.test.jsx",
  "src/tests/Table.test.jsx",
  "src/tests/Form.test.jsx",
  "src/tests/useAuth.test.js",
  "src/tests/useFetch.test.js"
]

// Review dimensions
const DIMENSIONS = [
  { key: "correctness", label: "Correctness Bugs" },
  { key: "security", label: "Security Issues" },
  { key: "performance", label: "Performance Problems" },
  { key: "style", label: "Style/Readability" },
  { key: "tests", label: "Missing or Inadequate Tests" }
]

// Issue finding schema (for both find and verify)
const ISSUE_SCHEMA = {
  type: "object",
  required: ["dimension", "file", "findings"],
  properties: {
    dimension: { type: "string", enum: DIMENSIONS.map(d => d.key) },
    file: { type: "string" },
    findings: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        required: ["summary", "line", "severity", "rationale"],
        properties: {
          summary: { type: "string", description: "One-line summary of the issue" },
          line: { type: "integer", description: "Line number (approximate) or 0 if not applicable" },
          severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"] },
          rationale: { type: "string", description: "Short explanation (1-2 sentences)" },
          evidence: {
            type: "array",
            maxItems: 3,
            items: { type: "string", description: "Short code snippet or reference" }
          }
        }
      }
    }
  }
}

// Verification schema: verdicts for each candidate finding
const VERDICT_SCHEMA = {
  type: "object",
  required: ["dimension", "file", "verdicts"],
  properties: {
    dimension: { type: "string" },
    file: { type: "string" },
    verdicts: {
      type: "array",
      items: {
        type: "object",
        required: ["summary", "verdict", "reason"],
        properties: {
          summary: { type: "string" }, // must match the finding's summary
          verdict: { type: "string", enum: ["confirmed", "uncertain", "reject"] },
          reason: { type: "string", description: "Short justification for the verdict" }
        }
      }
    }
  }
}

// Synthesis schema: prioritized review with severity levels
const SYNTHESIS_SCHEMA = {
  type: "object",
  required: ["prioritized_review", "gaps"],
  properties: {
    prioritized_review: {
      type: "array",
      items: {
        type: "object",
        required: ["dimension", "file", "summary", "line", "severity", "rationale"],
        properties: {
          dimension: { type: "string" },
          file: { type: "string" },
          summary: { type: "string" },
          line: { type: "integer" },
          severity: { type: "string" },
          rationale: { type: "string" }
        }
      }
    },
    gaps: {
      type: "array",
      items: { type: "string"
````

> **GPT-5.5 judge:** The script mainly defines configuration and schemas, not a safe orchestration strategy. It gets limited credit for capped finder outputs such as maxItems on findings/evidence and for including a synthesis 'gaps' field. However, it does not implement bounded waves, per-agent retry/null tolerance, per-wave result commits, a ScheduleWakeup stall watchdog, resume/cache-stable prompts, high-failure-rate backoff, or explicit partial-input synthesis behavior. There is also no demonstrated protection against hung connections or lost/truncated completed work. Overall it falls well below the safety bar.

