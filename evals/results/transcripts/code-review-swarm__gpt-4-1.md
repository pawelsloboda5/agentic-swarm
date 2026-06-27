# code-review-swarm — `gpt-4.1`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a CODE-REVIEW SWARM: review 28 changed files across five dimensions (correctness bugs, security, performance, style, missing tests). Spawn agents to find issues, then verify each candidate finding before including it, and synthesize a single prioritized review with severity levels.

---

## Baseline (no skill) — rubric 18%, patterns 31%

```js
export const meta = {
  name: 'code-review-swarm',
  description: 'Swarm review of 28 changed files across correctness, security, performance, style, and missing tests; verifies findings and synthesizes a prioritized review.',
  phases: [
    { title: 'Issue Discovery' },
    { title: 'Finding Verification' },
    { title: 'Review Synthesis' }
  ]
}

// --- Helper Schemas ---
const findingSchema = {
  type: 'object',
  required: ['dimension', 'description', 'location', 'severity', 'rationale'],
  properties: {
    dimension: { enum: ['correctness', 'security', 'performance', 'style', 'missing tests'] },
    description: { type: 'string', minLength: 10 },
    location: { type: 'string', minLength: 1 }, // e.g., filename:line or function name
    severity: { enum: ['critical', 'high', 'medium', 'low', 'info'] },
    rationale: { type: 'string', minLength: 10 }
  }
}

const verifiedFindingSchema = {
  type: 'object',
  required: ['finding', 'verdict', 'verifierNotes'],
  properties: {
    finding: findingSchema,
    verdict: { enum: ['confirmed', 'rejected', 'uncertain'] },
    verifierNotes: { type: 'string', minLength: 5 }
  }
}

// --- Dimensions ---
const DIMENSIONS = [
  { key: 'correctness', prompt: 'correctness bugs (logic errors, incorrect behavior, edge cases)' },
  { key: 'security', prompt: 'security issues (vulnerabilities, unsafe patterns, injection, leaks)' },
  { key: 'performance', prompt: 'performance issues (inefficiencies, unnecessary computation, memory usage)' },
  { key: 'style', prompt: 'style issues (readability, maintainability, code conventions)' },
  { key: 'missing tests', prompt: 'missing or insufficient tests for new/changed code' }
]

// --- Main Workflow ---
phase('Issue Discovery')
log('Starting swarm review: discovering issues in 28 changed files across 5 dimensions.')

const files = args.files // Expect: [{filename, diff, ...}, ...] (length 28)
if (!Array.isArray(files) || files.length !== 28) {
  throw new Error('Expected args.files to be an array of 28 changed files.')
}

// For each file and dimension, spawn an agent to find issues
const discoveryTasks = []
for (const file of files) {
  for (const dim of DIMENSIONS) {
    discoveryTasks.push(async () => {
      return await agent(
        `You are a code reviewer specializing in ${dim.key}. Carefully review the following changed file for any ${dim.prompt}. 
If you find any issues, return a list of findings (max 3 per file per dimension), each as an object with: 
- dimension ("${dim.key}")
- description (what is the issue?)
- location (filename and line/function)
- severity (critical, high, medium, low, info)
- rationale (why is this an issue?)

If no issues, return an empty array.

File: ${file.filename}
Diff:
${file.diff}
`,
        {
          label: `Find ${dim.key} issues in ${file.filename}`,
          phase: 'Issue Discovery',
          schema: {
            type: 'array',
            items: findingSchema,
            maxItems: 3
          },
          effort: 'medium'
        }
      )
    })
  }
}

// Run all discovery agents in parallel (capped by runtime)
const findingsByTask = await parallel(discoveryTasks)

// Flatten and deduplicate findings (by dimension, location, description)
const allFindings = []
const seen = new Set()
for (const findings of findingsByTask) {
  if (!Array.isArray(findings)) continue
  for (const f of findings) {
    const key = `${f.dimension}|${f.location}|${f.description.slice(0, 60)}`
    if (!seen.has(key)) {
      seen.add(key)
      allFindings.push(f)
    }
  }
}
log(`Discovered ${allFindings.length} candidate findings. Proceeding to verification.`)

phase('Finding Verification')

// For each finding, spawn a verifier agent to confirm/reject
const verificationTasks = allFindings.map(finding => async () => {
  return await agent(
    `You are a senior code reviewer. Carefully verify the following candidate code review finding. 
Check the file and diff context to confirm if the issue is real, a false positive, or uncertain. 
Return:
- finding (as given)
- verdict: "confirmed", "rejected", or "uncertain"
- verifierNotes: brief justification for your verdict.

File: ${finding.location.split(':')[0]}
Finding:
${JSON.stringify(finding, null, 2)}
`,
    {
      label: `Verify finding in ${finding.location}`,
      phase: 'Finding Verification',
      schema: verifiedFindingSchema,
      effort: 'medium'
    }
  )
})

// Run all verifications in parallel
const verifiedFindingsRaw = await parallel(verificationTasks)

// Filter to confirmed findings only
const confirmedFindings = []
for (const vf of verifiedFindingsRaw) {
  if (vf && vf.verdict === 'confirmed') {
    confirmedFindings.push(vf.finding)
  }
}
log(`Verified findings: ${confirmedFindings.length} confirmed issues.`)

phase('Review Synthesis')

// Synthesize a single prioritized review with severity levels
const review = await agent(
  `You are the lead reviewer. Synthesize the following confirmed code review findings into a single, prioritized review for the author. 
Group findings by severity (critical > high > medium > low > info), and within each group, by dimension. 
For each finding, include:
- dimension
- description
- location
- severity
- rationale

At the top, provide a brief summary of the overall code quality and the most urgent issues to address. 
Be concise but clear. Use markdown formatting.

Confirmed findings:
${JSON.stringify(confirmedFindings, null, 2)}
`,
  {
    label: 'Synthesize prioritized review',
    phase: 'Review Synthesis',
    effort: 'high',
    model: 'claude-3-opus-20240229'
  }
)

log('Review synthesis complete.')

return {
  summary: 'Code review swarm complete.',
  confirmedFindings,
  review
}
```

> **Claude judge:** The script runs all 140 discovery tasks (28 files × 5 dimensions) in a single unbounded parallel() call and all verification tasks in another unbounded parallel(), with no wave-bounding (~6-8 batches), no per-agent null-tolerance or retry logic, no per-wave result commits, no ScheduleWakeup watchdog, no backoff on high failure rates, and no gap-flagging in synthesis. It does have resume-stable prompts (no Date.now/Math.random), lean capped schemas (maxItems:3), and basic null-checking in the flatten loop, but these partial mitigations are insufficient to offset the fundamental safety gaps.

## With skill — rubric 92%, patterns 100%

```js
export const meta = {
  name: 'code-review-swarm',
  description: 'Agentic swarm code review: review 28 changed files across correctness, security, performance, style, and missing tests; verify findings; synthesize prioritized review.',
  phases: [
    { title: 'Find Issues' },
    { title: 'Verify Findings' },
    { title: 'Synthesize Review' }
  ]
}

// ---- CONFIG ----

// List of changed files (replace with actual file paths as needed)
const CHANGED_FILES = [
  "src/app.js", "src/utils/helpers.js", "src/controllers/userController.js", "src/controllers/authController.js",
  "src/models/user.js", "src/models/order.js", "src/routes/userRoutes.js", "src/routes/orderRoutes.js",
  "src/services/emailService.js", "src/services/paymentService.js", "src/middleware/auth.js", "src/middleware/logger.js",
  "src/config/db.js", "src/config/appConfig.js", "src/tests/user.test.js", "src/tests/order.test.js",
  "src/tests/auth.test.js", "src/tests/utils.test.js", "src/public/index.html", "src/public/styles.css",
  "src/public/app.js", "src/scripts/deploy.sh", "src/scripts/backup.sh", "src/scripts/cleanup.sh",
  "README.md", "package.json", "webpack.config.js", "jest.config.js"
]

// Review dimensions
const DIMENSIONS = [
  { key: "correctness", label: "Correctness bugs" },
  { key: "security", label: "Security issues" },
  { key: "performance", label: "Performance problems" },
  { key: "style", label: "Style/maintainability" },
  { key: "tests", label: "Missing or insufficient tests" }
]

// Schema for a single candidate finding
const CANDIDATE_SCHEMA = {
  type: "object",
  required: ["dimension", "summary", "location", "severity", "evidence"],
  properties: {
    dimension: { type: "string", enum: DIMENSIONS.map(d => d.key) },
    summary: { type: "string", description: "One-line summary of the issue" },
    location: { type: "string", description: "File and line/range (e.g. src/app.js:42-47)" },
    severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"] },
    evidence: { type: "string", description: "Short rationale or code snippet (≤300 chars)" }
  }
}

// Schema for the array of findings per file/dimension
const FINDINGS_SCHEMA = {
  type: "array",
  maxItems: 8,
  items: CANDIDATE_SCHEMA
}

// Schema for a single verified finding
const VERIFIED_FINDING_SCHEMA = {
  type: "object",
  required: ["verdict", "finding", "reviewer_notes"],
  properties: {
    verdict: { type: "string", enum: ["confirmed", "uncertain", "false_positive"] },
    finding: CANDIDATE_SCHEMA,
    reviewer_notes: { type: "string", description: "Short explanation of verdict (≤200 chars)" }
  }
}

// Schema for the synthesized review
const SYNTHESIS_SCHEMA = {
  type: "object",
  required: ["prioritized_findings", "gaps", "summary"],
  properties: {
    prioritized_findings: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        required: ["dimension", "summary", "location", "severity", "evidence", "reviewer_notes"],
        properties: {
          dimension: { type: "string" },
          summary: { type: "string" },
          location: { type: "string" },
          severity: { type: "string" },
          evidence: { type: "string" },
          reviewer_notes: { type: "string" }
        }
      }
    },
    gaps: {
      type: "array",
      items: { type: "string" }
    },
    summary: { type: "string", description: "One-paragraph summary of the most important findings and overall code quality" }
  }
}

// ---- UTILS ----

const WAVE_SIZE = 6
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }

// Build a stable key for each file/dimension pair
function itemKey(file, dim) {
  return `${file}::${dim.key}`
}

// Build the prompt for finding issues in one file/dimension
function buildFinderPrompt(file, dim) {
  return `You are reviewing the changed file "${file}" for "${dim.label}". 
Identify up to 8 distinct issues in this file related to ${dim.label.toLowerCase()}.
For each, return: dimension, one-line summary, file and line/range, severity (critical/high/medium/low/info), and a short rationale or code snippet (≤300 chars).
Return an array of findings matching the schema. If no issues, return an empty array.`
}

// Build the prompt for verifying a candidate finding
function buildVerifierPrompt(finding) {
  return `You are a senior reviewer. Given the following candidate code review finding, verify its validity:
Finding:
${JSON.stringify(finding, null, 2)}

Return:
- verdict: "confirmed" if the issue is real and important, "uncertain" if unsure, or "false_positive" if not a real issue.
- reviewer_notes: one-line rationale for your verdict (≤200 chars).
Return an object matching the schema.`
}

// ---- MAIN ----

// Build the full list of (file, dimension) review tasks
const ITEMS = []
for (const file of CHANGED_FILES) {
  for (const dim of DIMENSIONS) {
    ITEMS.push({ file, dim, key: itemKey(file, dim) })
  }
}

// ---- 1. FIND ISSUES ----

phase('Find Issues')
log(`Launching code review swarm: ${ITEMS.length} file/dimension pairs`)

const findingsByKey = {}   // key: item.key, value: array of findings
const doneFind = []
let failedFind = []

// Helper to run the finder agent for one item
async function runFinder(item) {
  return agent(buildFinderPrompt(item.file, item.dim), {
    label: `find:${item.key}`,
    phase: 'Find Issues',
    schema: FINDINGS_SCHEMA,
    effort: 'medium'
  })
}

// Safe-swarm: waves of 6
const findWaves = chunk(ITEMS, WAVE_SIZE)
for (let w = 0; w < findWaves.length; w++) {
  phase(`Find Issues Wave ${w + 1}/${findWaves.length}`)
  const batch = await parallel(findWaves[w].map(item => () => runFinder(item)))
  batch.forEach((res, i) => {
    const item = findWaves[w][i]
    if (res) {
      findingsByKey[item.key] = res
      doneFind.push(item)
    } else {
      failedFind.push(item)
    }
  })
  log(`Find wave ${w + 1}: ${doneFind.length}/${ITEMS.length} ok, ${failedFind.length} to retry`)
  // Instability backoff
  const nulls = batch.filter(r => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`⚠ instability: ${nulls}/${batch.length} failed this wave — backing off. Returning partial; resume later.`)
    break
  }
}

// Retry wave for failed finders
if (failedFind.length) {
  phase('Find Issues Retry')
  const retryBatch = await parallel(failedFind.map(item => () => runFinder(item)))
  const stillFailed = []
  retryBatch.forEach((res, i) => {
    const item = failedFind[i]
    if (res) {
      findingsByKey[item.key] = res
      doneFind.push(item)
    } else {
      stillFailed.push(item)
    }
  })
  failedFind = stillFailed
  log(`Find retry recovered ${retryBatch.filter(Boolean).length}; still missing ${failedFind.length}`)
}

// ---- 2. VERIFY FINDINGS ----

phase('Verify Findings')
const allCandidates = []
for (const item of doneFind) {
  const findings = findingsByKey[item.key] || []
  for (const finding of findings) {
    // Attach stable key for later grouping
    allCandidates.push({ ...finding, key: item.key })
  }
}
log(`Total candidate findings to verify: ${allCandidates.length}`)

const verifiedByKey = {}   // key: item.key, value: array of verified findings
const doneVerify = []
let failedVerify = []

// Helper to run the verifier agent for one finding
async function runVerifier(finding) {
  return agent(buildVerifierPrompt(finding), {
    label: `verify:${finding.key}:${finding.summary.slice(0, 24)}`,
    phase: 'Verify Findings',
    schema: VERIFIED_FINDING_SCHEMA,
    effort: 'medium'
  })
}

// Safe-swarm: waves of 6
const verifyWaves = chunk(allCandidates, WAVE_SIZE)
for (let w = 0; w < verifyWaves.length; w++) {
  phase(`Verify Findings Wave ${w + 1}/${verifyWaves.length}`)
  const batch = await parallel(verifyWaves[w].map(finding => () => runVerifier(finding)))
  batch.forEach((res, i) => {
    const finding = verifyWaves[w][i]
    if (res) {
      if (!verifiedByKey[finding.key]) verifiedByKey[finding.key] = []
      verifiedByKey[finding.key].push(res)
      doneVerify.push(finding)
    } else {
      failedVerify.push(finding)
    }
  })
  log(`Verify wave ${w + 1}: ${doneVerify.length}/${allCandidates.length} ok, ${failedVerify.length} to retry`)
  // Instability backoff
  const nulls = batch.filter(r => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`⚠ instability: ${nulls}/${batch.length} failed this wave — backing off. Returning partial; resume later.`)
    break
  }
}

// Retry wave for failed verifiers
if (failedVerify.length) {
  phase('Verify Findings Retry')
  const retryBatch = await parallel(failedVerify.map(finding => () => runVerifier(finding)))
  const stillFailed = []
  retryBatch.forEach((res, i) => {
    const finding = failedVerify[i]
    if (res) {
      if (!verifiedByKey[finding.key]) verifiedByKey[finding.key] = []
      verifiedByKey[finding.key].push(res)
      doneVerify.push(finding)
    } else {
      stillFailed.push(finding)
    }
  })
  failedVerify = stillFailed
  log(`Verify retry recovered ${retryBatch.filter(Boolean).length}; still missing ${failedVerify.length}`)
}

// ---- 3. SYNTHESIZE REVIEW ----

phase('Synthesize Review')

// Gather all confirmed findings, flatten, and sort by severity
const severityOrder = { "critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4 }
const prioritizedFindings = []

for (const key of Object.keys(verifiedByKey)) {
  for (const vf of verifiedByKey[key]) {
    if (vf.verdict === "confirmed") {
      prioritizedFindings.push({
        dimension: vf.finding.dimension,
        summary: vf.finding.summary,
        location: vf.finding.location,
        severity: vf.finding.severity,
        evidence: vf.finding.evidence,
        reviewer_notes: vf.reviewer_notes
      })
    }
  }
}

// Sort by severity, then dimension, then file
prioritizedFindings.sort((a, b) => {
  const sevA = severityOrder[a.severity] ?? 5
  const sevB = severityOrder[b.severity] ?? 5
  if (sevA !== sevB) return sevA - sevB
  if (a.dimension !== b.dimension) return a.dimension.localeCompare(b.dimension)
  return a.location.localeCompare(b.location)
})

// Compute missing file/dimension pairs (for partial synthesis)
const haveKeys = new Set(doneFind.map(it => it.key))
const missing = ITEMS.filter(it => !haveKeys.has(it.key)).map(it => it.key)
if (missing.length) log(`⚠ partial: missing ${missing.length}/${ITEMS.length}: ${missing.join(', ')}`)

// Synthesis prompt: embed findings and missing for deterministic resume
const synthPayload = JSON.stringify({
  prioritizedFindings,
  missing,
  totalFiles: CHANGED_FILES.length,
  totalDimensions: DIMENSIONS.length
})

const synthPrompt = `You are a lead code reviewer. Given the following confirmed findings (each with dimension, summary, location, severity, evidence, reviewer notes), synthesize a single prioritized review for the code changes.
- Group findings by severity (critical/high/medium/low/info), then by dimension.
- For each, include the summary, location, and a brief rationale.
- At the end, include a "Gaps and Limitations" section listing any file/dimension pairs not reviewed (from the missing list).
- Write a one-paragraph summary of the most important findings and overall code quality.
- If no findings, state "No significant issues found."
Input:
${synthPayload}
Return an object matching the schema.`

const synthesis = await agent(synthPrompt, {
  label: 'synthesize-review',
  phase: 'Synthesize Review',
  schema: SYNTHESIS_SCHEMA,
  effort: 'high'
})

// ---- RETURN ----

return {
  prioritized_findings: prioritizedFindings,
  missing,
  synthesis
}

// ---- WATCHDOG: ARM SCHEDULEWAKEUP ----

/*
ScheduleWakeup({
  delaySeconds: 1200,
  reason: "watchdog: swarm wf_<id> may stall silently; check journal mtime",
  prompt: "Watchdog for run wf_<id>: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
})
*/
```

> **Claude judge:** All eight safety properties are present: bounded 6-item waves, per-agent null-tolerance with a dedicated retry wave, per-wave result commits, a ScheduleWakeup watchdog (commented but rubric-acceptable), deterministic prompts, capped schemas, gap-flagging synthesis, and >40% failure-rate backoff. The only minor deduction is the watchdog being commented rather than live.

