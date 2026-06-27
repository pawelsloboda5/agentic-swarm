# code-review-swarm — `gpt-4.1-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a CODE-REVIEW SWARM: review 28 changed files across five dimensions (correctness bugs, security, performance, style, missing tests). Spawn agents to find issues, then verify each candidate finding before including it, and synthesize a single prioritized review with severity levels.

---

## Baseline (no skill) — rubric 15%, patterns 38%

````js
```js
export const meta = {
  name: 'code-review-swarm',
  description: 'Review 28 changed files across 5 dimensions, verify findings, and synthesize a prioritized review',
  phases: [
    { title: 'Find Issues' },
    { title: 'Verify Findings' },
    { title: 'Synthesize Review' },
  ],
}

const REVIEW_DIMENSIONS = [
  { key: 'correctness', label: 'Correctness Bugs' },
  { key: 'security', label: 'Security' },
  { key: 'performance', label: 'Performance' },
  { key: 'style', label: 'Style' },
  { key: 'missingTests', label: 'Missing Tests' },
]

const FINDING_SCHEMA = {
  type: 'object',
  properties: {
    dimension: { type: 'string' },
    file: { type: 'string' },
    line: { type: ['number', 'null'] },
    snippet: { type: 'string' },
    description: { type: 'string' },
    severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
  },
  required: ['dimension', 'file', 'description', 'severity', 'snippet'],
  additionalProperties: false,
}

const VERIFIED_FINDING_SCHEMA = {
  type: 'object',
  properties: {
    dimension: { type: 'string' },
    file: { type: 'string' },
    line: { type: ['number', 'null'] },
    snippet: { type: 'string' },
    description: { type: 'string' },
    severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    verified: { type: 'boolean' },
  },
  required: ['dimension', 'file', 'description', 'severity', 'snippet', 'verified'],
  additionalProperties: false,
}

phase('Find Issues')
log(`Starting issue detection on ${args.files.length} files across ${REVIEW_DIMENSIONS.length} dimensions.`)

// For each file and dimension, spawn an agent to find candidate issues.
// We run these in parallel but capped by runtime concurrency limits.
const findIssueThunks = []
for (const file of args.files) {
  for (const dim of REVIEW_DIMENSIONS) {
    findIssueThunks.push(async () => {
      // Prompt to find issues of this dimension in this file.
      // Provide file content and dimension label.
      const prompt = `You are a code review assistant specialized in ${dim.label}.
Given the following file content, identify any issues related to ${dim.label}.
Return an array of findings, each with:
- dimension (string)
- file (string)
- line number if possible (or null)
- a short snippet illustrating the issue
- a clear description of the issue
- severity (one of low, medium, high, critical)

File path: ${file.path}
File content:
\`\`\`
${file.content}
\`\`\`

Return the findings as a JSON array. If none, return an empty array.`
      const findings = await agent(prompt, {
        label: `Find ${dim.key} issues in ${file.path}`,
        phase: 'Find Issues',
        schema: {
          type: 'array',
          items: FINDING_SCHEMA,
        },
        effort: 'medium',
      })
      // findings may be null if agent failed, treat as empty array
      return findings || []
    })
  }
}
const rawFindingsArrays = await parallel(findIssueThunks)
// Flatten all findings into one array
const rawFindings = rawFindingsArrays.flat()

phase('Verify Findings')
log(`Verifying ${rawFindings.length} candidate findings.`)

// Verification stage: for each candidate finding, spawn an agent to verify it.
// Verification prompt asks to confirm if the finding is valid and important.
// Return the finding with verified: true or false.
const verifyFindingThunks = rawFindings.map((finding, i) => async () => {
  const prompt = `You are a senior code reviewer verifying a candidate issue found in a code review.
Here is the candidate issue:

Dimension: ${finding.dimension}
File: ${finding.file}
Line: ${finding.line === null ? 'N/A' : finding.line}
Severity: ${finding.severity}
Description: ${finding.description}
Snippet:
\`\`\`
${finding.snippet}
\`\`\`

Based on the snippet and description, is this a valid and important issue that should be included in the final review? Answer with a JSON object:
{
  "verified": true or false
}

Only answer with the JSON object.`
  const verification = await agent(prompt, {
    label: `Verify finding #${i + 1} in ${finding.file}`,
    phase: 'Verify Findings',
    schema: {
      type: 'object',
      properties: {
        verified: { type: '
````

> **GPT-5.5 judge:** The script uses one large parallel() fan-out for all file/dimension finder tasks and appears to do the same for verification, creating hard barriers where one hung agent can deadlock the whole run. It has no ScheduleWakeup watchdog, no bounded waves, no per-wave commits/checkpointing, no retry/backoff logic, and no high-failure-rate circuit breaker. It does use schemas and treats null finder results as empty arrays, but that can silently lose work rather than preserve/flag partial failures. Output schemas are reasonably lean, but there is no evidence of partial-input-tolerant synthesis or explicit gap reporting. Overall it meets only a small portion of the safety-by-construction bar.

## With skill — rubric 25%, patterns 31%

````js
```js
export const meta = {
  name: 'code-review-swarm',
  description: 'Review 28 changed files across 5 dimensions with find, verify, and synthesize phases',
  phases: [
    { title: 'Find Issues' },
    { title: 'Verify Findings' },
    { title: 'Synthesize Review' },
  ],
}

const WAVE_SIZE = 6

// The 28 changed files to review, each with a stable key and path
// (In real use, pass as args or load externally; here hardcoded for example)
const FILES = [
  { key: 'file01', path: 'src/app/main.js' },
  { key: 'file02', path: 'src/app/utils.js' },
  { key: 'file03', path: 'src/lib/api.js' },
  { key: 'file04', path: 'src/lib/db.js' },
  { key: 'file05', path: 'src/components/button.jsx' },
  { key: 'file06', path: 'src/components/modal.jsx' },
  { key: 'file07', path: 'src/styles/theme.css' },
  { key: 'file08', path: 'src/styles/layout.css' },
  { key: 'file09', path: 'tests/app.test.js' },
  { key: 'file10', path: 'tests/utils.test.js' },
  { key: 'file11', path: 'src/hooks/useAuth.js' },
  { key: 'file12', path: 'src/hooks/useData.js' },
  { key: 'file13', path: 'src/config/config.json' },
  { key: 'file14', path: 'src/config/routes.json' },
  { key: 'file15', path: 'src/server/server.js' },
  { key: 'file16', path: 'src/server/middleware.js' },
  { key: 'file17', path: 'src/server/logger.js' },
  { key: 'file18', path: 'src/server/errors.js' },
  { key: 'file19', path: 'src/utils/format.js' },
  { key: 'file20', path: 'src/utils/parse.js' },
  { key: 'file21', path: 'src/utils/validate.js' },
  { key: 'file22', path: 'src/assets/logo.svg' },
  { key: 'file23', path: 'src/assets/icons.svg' },
  { key: 'file24', path: 'docs/README.md' },
  { key: 'file25', path: 'docs/CONTRIBUTING.md' },
  { key: 'file26', path: 'scripts/deploy.sh' },
  { key: 'file27', path: 'scripts/build.sh' },
  { key: 'file28', path: 'scripts/test.sh' },
]

// Dimensions to review per file
const DIMENSIONS = [
  'correctness bugs',
  'security issues',
  'performance problems',
  'style violations',
  'missing tests',
]

// Schema for candidate findings returned by find agents
const FINDING_SCHEMA = {
  type: 'object',
  properties: {
    fileKey: { type: 'string' },
    dimension: { type: 'string' },
    findings: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' }, // stable short id per finding
          description: { type: 'string' }, // one-line description of issue
          location: { type: 'string' }, // file location snippet or line number
          evidenceUrls: {
            type: 'array',
            maxItems: 3,
            items: { type: 'string', format: 'uri' },
          },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        },
        required: ['id', 'description', 'location', 'severity'],
        additionalProperties: false,
      },
    },
  },
  required: ['fileKey', 'dimension', 'findings'],
  additionalProperties: false,
}

// Schema for verification results per candidate finding
const VERIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    fileKey: { type: 'string' },
    dimension: { type: 'string' },
    verifiedFindings: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          verified: { type: 'boolean' },
          rationale: { type: 'string' }, // one-line rationale for verification
        },
        required: ['id', 'verified', 'rationale'],
        additionalProperties: false,
      },
    },
````

> **GPT-5.5 judge:** The snippet shows some safety-oriented structure: a bounded WAVE_SIZE of 6, stable file keys, phased find/verify/synthesize metadata, and lean capped schemas with maxItems. However, the actual orchestration is not shown, so there is no evidence of per-agent retry/null-tolerance, committing results per wave, an armed ScheduleWakeup watchdog, resume/cache behavior, partial-input synthesis that flags gaps, or backoff on high failure rates. It also does not demonstrate avoiding a hard barrier or hung connection in practice. Overall it meets only a small fraction of the safety bar.

