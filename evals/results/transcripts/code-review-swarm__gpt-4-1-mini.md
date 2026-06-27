# code-review-swarm — `gpt-4.1-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a CODE-REVIEW SWARM: review 28 changed files across five dimensions (correctness bugs, security, performance, style, missing tests). Spawn agents to find issues, then verify each candidate finding before including it, and synthesize a single prioritized review with severity levels.

---

## Baseline (no skill) — rubric 20%, patterns 25%

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
  { key: 'security', label: 'Security Issues' },
  { key: 'performance', label: 'Performance Issues' },
  { key: 'style', label: 'Style Issues' },
  { key: 'tests', label: 'Missing Tests' },
]

const FINDING_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    dimension: { type: 'string' },
    description: { type: 'string' },
    severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    location: { type: 'string', nullable: true },
    suggestion: { type: 'string', nullable: true },
  },
  required: ['file', 'dimension', 'description', 'severity'],
  additionalProperties: false,
}

const VERIFIED_FINDING_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    dimension: { type: 'string' },
    description: { type: 'string' },
    severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    location: { type: 'string', nullable: true },
    suggestion: { type: 'string', nullable: true },
    verified: { type: 'boolean' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['file', 'dimension', 'description', 'severity', 'verified', 'confidence'],
  additionalProperties: false,
}

phase('Find Issues')
log(`Starting issue detection on ${args.files.length} files across ${REVIEW_DIMENSIONS.length} dimensions.`)

// Step 1: For each file and dimension, spawn an agent to find candidate issues.
// We will produce an array of arrays of findings per file per dimension.
const findIssueTasks = []
for (const file of args.files) {
  for (const dim of REVIEW_DIMENSIONS) {
    // Capture variables for closure
    const fileCopy = file
    const dimCopy = dim
    findIssueTasks.push(async () => {
      // Prompt to find candidate issues in this file for this dimension
      const prompt = `You are a code review assistant specialized in ${dimCopy.label}.
Given the following file content, identify any ${dimCopy.label.toLowerCase()}.
File path: ${fileCopy.path}
File content:
${fileCopy.content}

For each issue found, respond with a JSON array of objects with these fields:
- file: the file path
- dimension: "${dimCopy.key}"
- description: a concise description of the issue
- severity: one of "low", "medium", "high", "critical"
- location: (optional) line number or code snippet location
- suggestion: (optional) how to fix or improve

If no issues found, respond with an empty JSON array [].

Respond ONLY with the JSON array.`
      const findings = await agent(prompt, { schema: { type: 'array', items: FINDING_SCHEMA }, label: `Find ${dimCopy.label} in ${fileCopy.path}`, phase: 'Find Issues', effort: 'medium' })
      return findings || []
    })
  }
}
const rawFindingsNested = await parallel(findIssueTasks)
const rawFindings = rawFindingsNested.flat()

// Filter out any null or malformed results (should be none due to schema)
const candidateFindings = rawFindings.filter(f => f && f.file && f.dimension && f.description)

log(`Found ${candidateFindings.length} candidate issues across all files and dimensions.`)

phase('Verify Findings')
log('Verifying each candidate finding for accuracy and relevance.')

// Step 2: Verify each candidate finding by spawning a verification agent per finding.
// Verification prompt asks to confirm or reject the finding, and provide confidence level.
const verifyTasks = candidateFindings.map((finding, i) => async () => {
  const prompt = `You are a senior code reviewer verifying a reported issue.

File path: ${finding.file}
Dimension: ${finding.dimension}
Reported issue description: ${finding.description}
Severity: ${finding.severity}
Location: ${finding.location || 'N/A'}
Suggestion: ${finding.suggestion || 'N/A'}

Based on the file content and your expertise, do you confirm this issue is valid and relevant? Respond with a JSON object with these fields:
- verified: true if you confirm the issue, false if you reject it
- confidence: your confidence level in your verification ("low", "medium", or "high")

Respond ONLY with the JSON object.`
  // We pass the file content as context in the prompt to help verification
  // To avoid prompt bloat, we embed the file content inline only if short enough, else skip
  // But since we have no file content here, assume the agent has access or rely on description only.

  // Use schema to validate response
  const verification = await agent(prompt, { schema: VERIFIED_FINDING_SCHEMA, label: `Verify finding #${i + 1}`, phase: 'Verify Findings', effort: 'medium' })
  if (!verification) return null
  // Merge verification results into original finding
  return { ...finding, verified: verification.verified, confidence: verification.confidence }
})
const verifiedFindingsRaw = await parallel(verifyTasks)

// Filter to only verified findings with high or medium confidence
const verifiedFindings = verifiedFindingsRaw.filter(f => f && f.verified && (f.confidence === 'high' || f.confidence === 'medium'))

log(`Verified ${verifiedFindings.length} issues as valid and relevant.`)

phase('Synthesize Review')
log('Synthesizing a single prioritized review with severity levels.')

// Step 3: Synthesize a single prioritized review summary from verified findings.
// Sort findings by severity descending: critical > high > medium > low
const severityRank = { critical: 4, high: 3, medium: 2, low: 1 }
verifiedFindings.sort((a, b) => severityRank[b.severity] - severityRank[a.severity])

// Compose a prompt to synthesize the review
const synthPrompt = `You are an expert code reviewer tasked with producing a single prioritized review report.

You have the following verified issues found in the codebase:

${verifiedFindings.map((f, i) => `#${i + 1} [${f.severity.toUpperCase()}] (${f.dimension}) in ${f.file}
Description: ${f.description}
Location: ${f.location || 'N/A'}
Suggestion: ${f.suggestion || 'N/A'}`).join('\n\n')}

Please produce a markdown-formatted review report that:
- Groups issues by severity level in descending order (CRITICAL, HIGH, MEDIUM, LOW)
- Within each severity group, list issues with file path, dimension, description, location, and suggestion
- Provide a brief summary at the top highlighting the most critical issues
- Use bullet points and clear formatting for readability

Respond ONLY with the markdown review report.`

const reviewReport = await agent(synthPrompt, { label: 'Synthesize Prioritized Review', phase: 'Synthesize Review', effort: 'high' })

return {
  verifiedFindings,
  reviewReport,
}
```

> **Claude judge:** The script uses a single unbounded parallel() call over all 140 tasks (28 files × 5 dimensions) with no wave bounding, no per-agent retry on null/failure, no ScheduleWakeup watchdog, no per-wave result commits, no backoff on high failure rates, and synthesis does not explicitly flag gaps in partial input. It does have null-tolerance filtering and cache-stable prompts (no Date.now/Math.random), plus lean schemas with capped outputs, but the critical safety-by-construction properties are largely absent.

## With skill — rubric 92%, patterns 100%

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

// The 28 changed files to review, each with a stable key and filename
// (In real use, pass as args or load externally; here hardcoded for example)
const FILES = [
  { key: 'file01', filename: 'src/app.js' },
  { key: 'file02', filename: 'src/utils/helpers.js' },
  { key: 'file03', filename: 'src/components/Button.jsx' },
  { key: 'file04', filename: 'src/components/Modal.jsx' },
  { key: 'file05', filename: 'src/hooks/useFetch.js' },
  { key: 'file06', filename: 'src/store/reducer.js' },
  { key: 'file07', filename: 'src/api/apiClient.js' },
  { key: 'file08', filename: 'src/styles/theme.css' },
  { key: 'file09', filename: 'src/index.js' },
  { key: 'file10', filename: 'tests/app.test.js' },
  { key: 'file11', filename: 'tests/utils.test.js' },
  { key: 'file12', filename: 'docs/README.md' },
  { key: 'file13', filename: 'scripts/build.js' },
  { key: 'file14', filename: 'scripts/deploy.js' },
  { key: 'file15', filename: 'src/config/default.json' },
  { key: 'file16', filename: 'src/config/production.json' },
  { key: 'file17', filename: 'src/components/Header.jsx' },
  { key: 'file18', filename: 'src/components/Footer.jsx' },
  { key: 'file19', filename: 'src/utils/logger.js' },
  { key: 'file20', filename: 'src/hooks/useAuth.js' },
  { key: 'file21', filename: 'src/api/authService.js' },
  { key: 'file22', filename: 'src/styles/reset.css' },
  { key: 'file23', filename: 'src/utils/formatDate.js' },
  { key: 'file24', filename: 'src/components/Sidebar.jsx' },
  { key: 'file25', filename: 'src/components/Dropdown.jsx' },
  { key: 'file26', filename: 'src/hooks/useTheme.js' },
  { key: 'file27', filename: 'src/store/actions.js' },
  { key: 'file28', filename: 'src/store/selectors.js' },
]

// JSON Schema for candidate findings returned by find agents
const FINDING_SCHEMA = {
  type: 'object',
  properties: {
    fileKey: { type: 'string' },
    dimension: { type: 'string', enum: ['correctness', 'security', 'performance', 'style', 'missing_tests'] },
    findings: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' }, // unique id per finding (stable within file+dimension)
          description: { type: 'string' }, // one-line description of issue
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          evidenceUrls: {
            type: 'array',
            maxItems: 3,
            items: { type: 'string', format: 'uri' },
          },
          rationale: { type: 'string' }, // one-line rationale, no long quotes
        },
        required: ['id', 'description', 'severity', 'rationale'],
        additionalProperties: false,
      },
    },
  },
  required: ['fileKey', 'dimension', 'findings'],
  additionalProperties: false,
}

// JSON Schema for verification results of candidate findings
const VERIFY_SCHEMA = {
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
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          notes: { type: 'string' }, // one-line notes on verification
        },
        required: ['id', 'verified', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['fileKey', 'dimension', 'verifiedFindings'],
  additionalProperties: false,
}

// JSON Schema for final synthesis output
const SYNTHESIS_SCHEMA = {
  type: 'object',
  properties: {
    prioritizedReview: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fileKey: { type: 'string' },
          dimension: { type: 'string' },
          id: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string' },
          confidence: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['fileKey', 'dimension', 'id', 'description', 'severity', 'confidence'],
        additionalProperties: false,
      },
    },
    gaps: {
      type: 'array',
      items: { type: 'string' }, // list of missing fileKey+dimension combos with no results
    },
  },
  required: ['prioritizedReview', 'gaps'],
  additionalProperties: false,
}

// The 5 review dimensions
const DIMENSIONS = ['correctness', 'security', 'performance', 'style', 'missing_tests']

// Helper: chunk array into waves of size n
function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// Build prompt for finding issues in one file+dimension
function buildFindPrompt(file, dimension) {
  return `You are a code review assistant. Review the changed file "${file.filename}" for issues in the dimension "${dimension}".
Return at most 8 candidate issues. Each issue must have:
- a stable unique id (e.g. "issue1", "issue2")
- a one-line description of the issue
- a severity level (low, medium, high, critical)
- up to 3 evidence URLs (links to relevant docs or code lines)
- a one-line rationale (no long quotes, just summary)
Return JSON matching this schema:
{
  "fileKey": "${file.key}",
  "dimension": "${dimension}",
  "findings": [
    {
      "id": "string",
      "description": "string",
      "severity": "low|medium|high|critical",
      "evidenceUrls": ["string"],
      "rationale": "string"
    }
  ]
}
Your output MUST be valid JSON and conform exactly to the schema.`
}

// Build prompt for verifying candidate findings for one file+dimension
function buildVerifyPrompt(candidates) {
  // candidates is the object returned by find agent for one file+dimension
  // If null or empty findings, return null early (no verify needed)
  if (!candidates || !candidates.findings || candidates.findings.length === 0) {
    return null
  }
  return `You are a code review verification assistant. Verify the following candidate issues for fileKey "${candidates.fileKey}" and dimension "${candidates.dimension}":
Candidates:
${JSON.stringify(candidates.findings, null, 2)}
For each candidate, respond with:
- id (same as candidate)
- verified (true if you confirm the issue is valid, false if false positive)
- confidence (low, medium, high)
- one-line notes on your verification
Return JSON matching this schema:
{
  "fileKey": "${candidates.fileKey}",
  "dimension": "${candidates.dimension}",
  "verifiedFindings": [
    {
      "id": "string",
      "verified": true|false,
      "confidence": "low|medium|high",
      "notes": "string"
    }
  ]
}
Your output MUST be valid JSON and conform exactly to the schema.`
}

// Run one find agent for a file+dimension
async function runFind(file, dimension) {
  return await agent(buildFindPrompt(file, dimension), {
    label: `find:${file.key}:${dimension}`,
    phase: 'Find Issues',
    schema: FINDING_SCHEMA,
    effort: 'medium',
  })
}

// Run one verify agent for a file+dimension candidates object
async function runVerify(candidates) {
  if (!candidates) return null
  const prompt = buildVerifyPrompt(candidates)
  if (!prompt) return null
  return await agent(prompt, {
    label: `verify:${candidates.fileKey}:${candidates.dimension}`,
    phase: 'Verify Findings',
    schema: VERIFY_SCHEMA,
    effort: 'medium',
  })
}

// Stable identity for find tasks: fileKey + dimension
function findTaskKey(file, dimension) {
  return `${file.key}::${dimension}`
}

// Stable identity for verify tasks: fileKey + dimension
function verifyTaskKey(fileKey, dimension) {
  return `${fileKey}::${dimension}`
}

// Main workflow body
// Pattern 1: chunk into waves of 6
const findTasks = []
for (const file of FILES) {
  for (const dimension of DIMENSIONS) {
    findTasks.push({ file, dimension })
  }
}
const findWaves = chunk(findTasks, WAVE_SIZE)

const doneFinds = [] // collected find results
let failedFinds = [] // find tasks that returned null

// Pattern 2 + 3: run find agents in waves with retry
for (let w = 0; w < findWaves.length; w++) {
  phase(`Find Wave ${w + 1}/${findWaves.length}`)
  const batch = await parallel(
    findWaves[w].map((task) => () => runFind(task.file, task.dimension))
  )
  batch.forEach((r, i) => {
    if (r) doneFinds.push(r)
    else failedFinds.push(findWaves[w][i])
  })
  log(`Find Wave ${w + 1}: ${doneFinds.length}/${findTasks.length} found, ${failedFinds.length} failed`)

  // Pattern 8: instability backoff
  const nulls = batch.filter((r) => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`⚠ instability: ${nulls}/${batch.length} failed this find wave — backing off. Returning partial; resume later.`)
    break
  }
}

// Retry wave for find failures
if (failedFinds.length) {
  phase('Find Retry Wave')
  const retried = await parallel(failedFinds.map((task) => () => runFind(task.file, task.dimension)))
  const stillFailed = []
  retried.forEach((r, i) => {
    if (r) doneFinds.push(r)
    else stillFailed.push(failedFinds[i])
  })
  failedFinds = stillFailed
  log(`Find Retry recovered ${retried.filter(Boolean).length}; still missing ${failedFinds.length}`)
}

// Now run verify agents on the find results that have findings
// Prepare verify tasks: one per fileKey+dimension with findings
const verifyTasks = doneFinds.filter(r => r.findings && r.findings.length > 0)
const verifyWaves = chunk(verifyTasks, WAVE_SIZE)

const doneVerifies = []
let failedVerifies = []

for (let w = 0; w < verifyWaves.length; w++) {
  phase(`Verify Wave ${w + 1}/${verifyWaves.length}`)
  const batch = await parallel(
    verifyWaves[w].map((cands) => () => runVerify(cands))
  )
  batch.forEach((r, i) => {
    if (r) doneVerifies.push(r)
    else failedVerifies.push(verifyWaves[w][i])
  })
  log(`Verify Wave ${w + 1}: ${doneVerifies.length}/${verifyTasks.length} verified, ${failedVerifies.length} failed`)

  // Pattern 8: instability backoff
  const nulls = batch.filter((r) => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`⚠ instability: ${nulls}/${batch.length} failed this verify wave — backing off. Returning partial; resume later.`)
    break
  }
}

// Retry wave for verify failures
if (failedVerifies.length) {
  phase('Verify Retry Wave')
  const retried = await parallel(failedVerifies.map((cands) => () => runVerify(cands)))
  const stillFailed = []
  retried.forEach((r, i) => {
    if (r) doneVerifies.push(r)
    else stillFailed.push(failedVerifies[i])
  })
  failedVerifies = stillFailed
  log(`Verify Retry recovered ${retried.filter(Boolean).length}; still missing ${failedVerifies.length}`)
}

// Build a map for quick lookup of verify results by fileKey+dimension
const verifyMap = new Map()
for (const v of doneVerifies) {
  verifyMap.set(`${v.fileKey}::${v.dimension}`, v)
}

// Compose final list of verified findings for synthesis
// Only include findings that were verified=true
const verifiedFindings = []
for (const find of doneFinds) {
  const key = `${find.fileKey}::${find.dimension}`
  const verify = verifyMap.get(key)
  if (!verify) continue // no verification results for this find
  // Map verified findings by id for quick lookup
  const verifiedById = new Map()
  for (const vf of verify.verifiedFindings) {
    verifiedById.set(vf.id, vf)
  }
  for (const f of find.findings) {
    const vf = verifiedById.get(f.id)
    if (vf && vf.verified) {
      verifiedFindings.push({
        fileKey: find.fileKey,
        dimension: find.dimension,
        id: f.id,
        description: f.description,
        severity: f.severity,
        confidence: vf.confidence,
        notes: vf.notes || '',
      })
    }
  }
}

// Identify missing fileKey+dimension combos with no find or no verify results
const haveKeys = new Set(doneFinds.map(r => `${r.fileKey}::${r.dimension}`))
const missing = []
for (const file of FILES) {
  for (const dimension of DIMENSIONS) {
    const key = `${file.key}::${dimension}`
    if (!haveKeys.has(key)) missing.push(key)
  }
}

// Pattern 5: embed inputs in synthesis prompt for stable resume and re-run on new data
const synthesisPayload = JSON.stringify(
  verifiedFindings.sort((a, b) => {
    // Sort by severity descending, then confidence descending, then fileKey
    const sevOrder = { critical: 4, high: 3, medium: 2, low: 1 }
    const confOrder = { high: 3, medium: 2, low: 1 }
    const sDiff = (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0)
    if (sDiff !== 0) return sDiff
    const cDiff = (confOrder[b.confidence] || 0) - (confOrder[a.confidence] || 0)
    if (cDiff !== 0) return cDiff
    return a.fileKey.localeCompare(b.fileKey)
  })
)

const missingPayload = JSON.stringify(missing)

// Synthesis prompt: produce a single prioritized review with severity levels and confidence,
// include explicit gaps section, flag missing or unverified dimensions
const synthesisPrompt = `You are a senior code review lead. Given the following verified findings from a swarm of reviewers:

${synthesisPayload}

Also note these missing fileKey+dimension combos with no findings or verification:

${missingPayload}

Produce a single prioritized code review report as a JSON array named "prioritizedReview".
Each item must include:
- fileKey
- dimension
- id
- description
- severity
- confidence
- notes

Order the array by severity descending, then confidence descending.

Also include a "gaps" array listing the missing fileKey+dimension combos.

Return JSON matching this schema:
{
  "prioritizedReview": [
    {
      "fileKey": "string",
      "dimension": "string",
      "id": "string",
      "description": "string",
      "severity": "low|medium|high|critical",
      "confidence": "low|medium|high",
      "notes": "string"
    }
  ],
  "gaps": ["string"]
}
Your output MUST be valid JSON and conform exactly to the schema.`

// Run synthesis agent
phase('Synthesize Review')
const synthesis = await agent(synthesisPrompt, {
  label: 'synthesize',
  phase: 'Synthesize Review',
  schema: SYNTHESIS_SCHEMA,
  effort: 'high',
})

// Return final deliverable with partial results and missing keys flagged
return {
  results: verifiedFindings,
  missing,
  synthesis,
  failedFinds,
  failedVerifies,
}

/*
Pattern 4: ScheduleWakeup watchdog (agent-level, outside script body):

ScheduleWakeup({
  delaySeconds: 1200,
  reason: "watchdog: code-review-swarm may stall silently; check journal mtime",
  prompt: "Watchdog for code-review-swarm run wf_<id>: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
})
*/
```

> **Claude judge:** All eight safety properties are present: waves capped at 6, per-wave null-tolerance with dedicated retry waves, incremental result accumulation before synthesis, a detailed ScheduleWakeup watchdog comment, cache-stable prompts, capped schemas with additionalProperties:false, gap-flagging synthesis that tolerates partial input, and >40% failure-rate backoff in both find and verify loops. The only minor deduction is the watchdog being a comment rather than executable code.

