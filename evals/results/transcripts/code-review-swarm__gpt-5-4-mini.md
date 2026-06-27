# code-review-swarm — `gpt-5.4-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a CODE-REVIEW SWARM: review 28 changed files across five dimensions (correctness bugs, security, performance, style, missing tests). Spawn agents to find issues, then verify each candidate finding before including it, and synthesize a single prioritized review with severity levels.

---

## Baseline (no skill) — rubric 30%, patterns 56%

```js
export const meta = {
  name: 'code-review-swarm',
  description:
    'Review up to 28 changed files across correctness, security, performance, style, and missing tests, then verify and synthesize prioritized findings.',
  phases: [
    { title: 'Inventory' },
    { title: 'Findings Sweep' },
    { title: 'Verification' },
    { title: 'Synthesis' },
  ],
}

// ------------------------------
// Helpers
// ------------------------------

const DIMENSIONS = [
  'correctness bugs',
  'security',
  'performance',
  'style',
  'missing tests',
]

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info']

function normalizeSeverity(s) {
  const v = String(s || '').trim().toLowerCase()
  if (['critical', 'blocker', 'sev0'].includes(v)) return 'critical'
  if (['high', 'sev1'].includes(v)) return 'high'
  if (['medium', 'moderate', 'sev2'].includes(v)) return 'medium'
  if (['low', 'minor', 'sev3'].includes(v)) return 'low'
  return 'info'
}

function severityRank(s) {
  return SEVERITY_ORDER.indexOf(normalizeSeverity(s))
}

function safeArray(x) {
  return Array.isArray(x) ? x : []
}

function dedupeFindings(findings) {
  const seen = new Set()
  const out = []
  for (const f of safeArray(findings)) {
    if (!f || typeof f !== 'object') continue
    const key = [
      String(f.filePath || f.file || '').toLowerCase(),
      String(f.issue || f.title || f.summary || '').toLowerCase(),
      String(f.dimension || '').toLowerCase(),
      String(f.location || '').toLowerCase(),
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  return out
}

function pickFiles(args) {
  const raw =
    args?.changedFiles ||
    args?.files ||
    args?.diffFiles ||
    args?.paths ||
    args?.inputFiles ||
    []
  const arr = safeArray(raw)
    .map((x) => {
      if (typeof x === 'string') return { path: x }
      if (x && typeof x === 'object') return { ...x, path: x.path || x.filePath || x.name }
      return null
    })
    .filter((x) => x && x.path)
    .slice(0, 28)
  return arr
}

function summarizeFiles(files) {
  return files.map((f, i) => `${i + 1}. ${f.path}`).join('\n')
}

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function reviewPromptForChunk(chunkFiles, dimensions) {
  return `
You are one reviewer in a code-review swarm.

Goal:
Review the following changed files for the dimensions listed below, and propose only candidate findings that are plausibly real and actionable.

Dimensions:
${dimensions.map((d) => `- ${d}`).join('\n')}

Instructions:
- Focus on concrete issues introduced or exposed by these changes.
- Prefer precise findings over broad commentary.
- For each candidate finding, include:
  - filePath
  - line or region if known
  - dimension
  - severity (critical/high/medium/low/info)
  - concise issue summary
  - why it matters
  - suggested fix
  - confidence from 0 to 1
- Include missing tests where a specific test is warranted.
- Avoid duplicate or near-duplicate findings.
- If a file looks clean, do not force a finding.

Changed files:
${chunkFiles.map((f) => `- ${f.path}`).join('\n')}

Return structured JSON with shape:
{
  "findings": [
    {
      "filePath": "string",
      "line": "string|number|null",
      "dimension": "string",
      "severity": "critical|high|medium|low|info",
      "issue": "string",
      "whyItMatters": "string",
      "suggestedFix": "string",
      "confidence": 0.0
    }
  ]
}
`
}

function verificationPrompt(finding, surroundingContext) {
  return `
You are a strict verifier for code-review findings.

Task:
Verify whether the candidate finding is supported by the provided evidence.
Do not be generous: reject anything speculative, vague, or ungrounded.

Candidate finding:
${JSON.stringify(finding, null, 2)}

Available context:
${surroundingContext || '(none provided)'}

Return structured JSON:
{
  "verdict": "accept" | "reject" | "uncertain",
  "severity": "critical|high|medium|low|info",
  "reason": "short explanation",
  "refinedFinding": {
    "filePath": "string",
    "line": "string|number|null",
    "dimension": "string",
    "severity": "critical|high|medium|low|info",
    "issue": "string",
    "whyItMatters": "string",
    "suggestedFix": "string",
    "confidence": 0.0
  }
}
`
}

function synthesisPrompt(verifiedFindings, files) {
  return `
You are synthesizing a final code review from verified findings only.

Requirements:
- Produce a single prioritized review.
- Group findings by severity from critical to info.
- Keep the review concise but actionable.
- Exclude rejected or uncertain items unless they are clearly framed as lower-confidence notes; default to excluding them.
- If there are no verified findings, say so plainly and mention that no material issues were confirmed.
- Include file paths and brief rationale for each finding.

Changed files reviewed:
${files.map((f) => `- ${f.path}`).join('\n')}

Verified findings:
${JSON.stringify(verifiedFindings, null, 2)}

Return a polished markdown review with sections:
1. Summary
2. Prioritized Findings
3. Test Gaps
4. Notes
`
}

// ------------------------------
// Workflow
// ------------------------------

phase('Inventory')

const files = pickFiles(args)
log(`Reviewing ${files.length} changed file(s) across ${DIMENSIONS.length} dimensions.`)

if (files.length === 0) {
  const emptyReview = `## Summary

No changed files were provided, so no review could be performed.

## Prioritized Findings

None.

## Test Gaps

None identified.

## Notes

Provide the list of changed files or a diff for analysis.
`
  export default emptyReview
}

log(`Files:\n${summarizeFiles(files)}`)

phase('Findings Sweep')

const fileChunks = chunk(files, 7)

const candidateGroups = await parallel(
  fileChunks.map((fileChunk, idx) => async () => {
    const prompt = reviewPromptForChunk(fileChunk, DIMENSIONS)
    const result = await agent(prompt, {
      label: `sweep-${idx + 1}`,
      phase: 'Findings Sweep',
      effort: 'high',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          findings: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true,
              properties: {
                filePath: { type: 'string' },
                line: {},
                dimension: { type: 'string' },
                severity: { type: 'string' },
                issue: { type: 'string' },
                whyItMatters: { type: 'string' },
                suggestedFix: { type: 'string' },
                confidence: { type: 'number' },
              },
              required: ['filePath', 'dimension', 'severity', 'issue'],
            },
          },
        },
        required: ['findings'],
      },
    })
    return safeArray(result?.findings)
  })
)

let candidates = dedupeFindings(candidateGroups.flat())
candidates = candidates
  .map((f) => ({
    ...f,
    severity: normalizeSeverity(f.severity),
    confidence: typeof f.confidence === 'number' ? f.confidence : 0.5,
  }))
  .filter((f) => f.filePath && f.issue)

log(`Candidate findings identified: ${candidates.length}`)

phase('Verification')

const verified = await parallel(
  candidates.map((finding, idx) => async () => {
    const context = files.find((f) => f.path === finding.filePath)?.content || files.find((f) => f.path === finding.filePath)?.diff || ''
    const result = await agent(verificationPrompt(finding, context), {
      label: `verify-${idx + 1}`,
      phase: 'Verification',
      effort: 'high',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          verdict: { type: 'string' },
          severity: { type: 'string' },
          reason: { type: 'string' },
          refinedFinding: {
            type: 'object',
            additionalProperties: true,
            properties: {
              filePath: { type: 'string' },
              line: {},
              dimension: { type: 'string' },
              severity: { type: 'string' },
              issue: { type: 'string' },
              whyItMatters: { type: 'string' },
              suggestedFix: { type: 'string' },
              confidence: { type: 'number' },
            },
            required: ['filePath', 'dimension', 'severity', 'issue'],
          },
        },
        required: ['verdict', 'severity', 'reason'],
      },
    })

    if (!result) return null
    const verdict = String(result.verdict || '').toLowerCase()
    if (verdict !== 'accept') return null

    const refined = result.refinedFinding || finding
    return {
      ...refined,
      severity: normalizeSeverity(result.severity || refined.severity || finding.severity),
      confidence:
        typeof refined.confidence === 'number'
          ? refined.confidence
          : typeof finding.confidence === 'number'
            ? finding.confidence
            : 0.5,
      verificationReason: result.reason || '',
    }
  })
)

const accepted = verified
  .filter(Boolean)
  .map((f) => ({
    ...f,
    severity: normalizeSeverity(f.severity),
  }))
  .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || (b.confidence || 0) - (a.confidence || 0))

phase('Synthesis')

const finalReview = await agent(synthesisPrompt(accepted, files), {
  label: 'final-synthesis',
  phase: 'Synthesis',
  effort: 'high',
})

export default finalReview || `## Summary

No material issues were confirmed after verification.

## Prioritized Findings

None.

## Test Gaps

No specific gaps were confirmed.

## Notes

All candidate findings were reviewed and either rejected or not substantiated with sufficient confidence.
`
```

> **GPT-5.5 judge:** The workflow has some safety-conscious elements: it caps changed files at 28, chunks the initial findings sweep into groups of 7, uses structured schemas, normalizes/null-filters some results, and has a fallback final review. However, it still awaits hard parallel barriers, has no per-agent retry/catch handling, no per-wave committed results, no ScheduleWakeup or stall watchdog, no resume/cache-stable persistence, no high-failure-rate backoff, and verification runs a parallel() over all candidates without bounding. A hung agent call in either sweep or verification can deadlock the run with no notification, and failures can prevent completed work from being synthesized. Partial input is not explicitly flagged as partial.

## With skill — rubric 62%, patterns 69%

```js
export const meta = {
  name: 'code-review-swarm',
  description: 'Review changed files across five dimensions, verify findings, and synthesize a prioritized review.',
  phases: [{ title: 'Plan' }, { title: 'Find' }, { title: 'Verify' }, { title: 'Synthesize' }],
}

const CHANGED_FILES = [
  // Replace with the 28 changed files for the review.
  'src/file1.js',
  'src/file2.js',
  'src/file3.js',
  'src/file4.js',
  'src/file5.js',
  'src/file6.js',
  'src/file7.js',
  'src/file8.js',
  'src/file9.js',
  'src/file10.js',
  'src/file11.js',
  'src/file12.js',
  'src/file13.js',
  'src/file14.js',
  'src/file15.js',
  'src/file16.js',
  'src/file17.js',
  'src/file18.js',
  'src/file19.js',
  'src/file20.js',
  'src/file21.js',
  'src/file22.js',
  'src/file23.js',
  'src/file24.js',
  'src/file25.js',
  'src/file26.js',
  'src/file27.js',
  'src/file28.js',
]

const DIMENSIONS = ['correctness bugs', 'security', 'performance', 'style', 'missing tests']
const WAVE_SIZE = 6

const ISSUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    file: { type: 'string' },
    dimension: { type: 'string', enum: DIMENSIONS },
    title: { type: 'string' },
    description: { type: 'string' },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    evidence: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    recommendation: { type: 'string' },
  },
  required: ['file', 'dimension', 'title', 'description', 'severity', 'confidence', 'evidence', 'recommendation'],
}

const VERIFIED_ISSUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    file: { type: 'string' },
    dimension: { type: 'string', enum: DIMENSIONS },
    title: { type: 'string' },
    description: { type: 'string' },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    evidence: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    recommendation: { type: 'string' },
    verified: { type: 'boolean' },
    verificationNotes: { type: 'string' },
  },
  required: ['file', 'dimension', 'title', 'description', 'severity', 'confidence', 'evidence', 'recommendation', 'verified', 'verificationNotes'],
}

const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const stableFilesText = JSON.stringify([...CHANGED_FILES].sort())

function reviewPrompt(file) {
  return [
    `You are a meticulous code reviewer.`,
    `Review the changed file below across these dimensions: correctness bugs, security, performance, style, missing tests.`,
    `Only report concrete, actionable issues that are plausibly introduced or exposed by this change.`,
    `Do not report nitpicks unless they materially affect maintainability or clarity.`,
    `Return at most 5 findings total for this file, and at most 1 finding per dimension.`,
    `Prefer high-signal issues with specific evidence from the diff/content.`,
    `For evidence, cite short phrases or line-level references from the file content; keep it concise.`,
    ``,
    `FILE: ${file}`,
  ].join('\n')
}

function verifyPrompt(issue) {
  return [
    `You are verifying a code-review finding.`,
    `Check whether the following finding is supported by the changed code and whether the severity is appropriate.`,
    `Reject speculative or weakly supported issues.`,
    `If the issue is valid, confirm it and keep the recommendation concise.`,
    `If it is not valid, explain why in verificationNotes and set verified to false.`,
    ``,
    `Finding JSON:`,
    JSON.stringify(issue),
  ].join('\n')
}

function synthPrompt(verifiedIssues, missingFiles) {
  const sorted = [...verifiedIssues].sort((a, b) => {
    const sa = severityRank(a.severity) - severityRank(b.severity)
    if (sa !== 0) return sa
    if (a.file !== b.file) return a.file < b.file ? -1 : 1
    if (a.dimension !== b.dimension) return a.dimension < b.dimension ? -1 : 1
    return a.title < b.title ? -1 : a.title > b.title ? 1 : 0
  })
  return [
    `Synthesize a single prioritized code review from the verified findings.`,
    `Prioritize by severity, then confidence, then breadth of impact.`,
    `Group related findings when appropriate, but do not lose important distinct issues.`,
    `Include explicit severity levels: critical, high, medium, low, info.`,
    `Flag any gaps, uncertainty, or missing-file coverage in a separate section.`,
    `If there are no verified findings, say so clearly and summarize the overall risk posture.`,
    ``,
    `Changed files (${CHANGED_FILES.length}): ${stableFilesText}`,
    `Missing files not fully reviewed in this run: ${JSON.stringify(missingFiles)}`,
    `Verified findings payload (${sorted.length}): ${JSON.stringify(sorted)}`,
  ].join('\n')
}

function severityRank(sev) {
  return ({ critical: 0, high: 1, medium: 2, low: 3, info: 4 })[sev] ?? 99
}

phase('Plan')
log(`Reviewing ${CHANGED_FILES.length} files across ${DIMENSIONS.length} dimensions.`)

const waves = chunk(CHANGED_FILES, WAVE_SIZE)
const found = []
let unreviewed = []

async function reviewFile(file) {
  return agent(reviewPrompt(file), {
    label: `review:${file}`,
    phase: 'Find',
    schema: { type: 'array', items: ISSUE_SCHEMA, maxItems: 5 },
    model: 'claude-3-5-sonnet',
    effort: 'high',
  })
}

async function verifyFinding(issue) {
  return agent(verifyPrompt(issue), {
    label: `verify:${issue.file}:${issue.dimension}:${issue.title}`,
    phase: 'Verify',
    schema: VERIFIED_ISSUE_SCHEMA,
    model: 'claude-3-5-sonnet',
    effort: 'high',
  })
}

for (let w = 0; w < waves.length; w++) {
  phase(`Find wave ${w + 1}/${waves.length}`)
  const batch = await parallel(waves[w].map(file => () => reviewFile(file)))

  const nulls = batch.filter(r => r === null).length
  batch.forEach((r, i) => {
    const file = waves[w][i]
    if (!r) {
      unreviewed.push(file)
      return
    }
    for (const issue of r) {
      found.push(issue)
    }
  })

  log(`Wave ${w + 1}: ${found.length} candidate findings from ${waves[w].length} files, ${nulls} review calls returned null.`)

  if (nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} review calls failed this wave — backing off; returning partial review and resuming later`)
    break
  }
}

const deduped = []
const seen = new Set()
for (const issue of found) {
  const key = `${issue.file}::${issue.dimension}::${issue.title}`.toLowerCase()
  if (seen.has(key)) continue
  seen.add(key)
  deduped.push(issue)
}

phase('Verify')
const verified = []
let rejected = []

const verifyWaves = chunk(deduped, WAVE_SIZE)
for (let w = 0; w < verifyWaves.length; w++) {
  const batch = await parallel(verifyWaves[w].map(issue => () => verifyFinding(issue)))

  const nulls = batch.filter(r => r === null).length
  batch.forEach((r, i) => {
    const original = verifyWaves[w][i]
    if (!r) {
      rejected.push({ ...original, verified: false, verificationNotes: 'Verification agent returned null; treat as unverified.' })
      return
    }
    if (r.verified) verified.push(r)
    else rejected.push(r)
  })

  log(`Verify wave ${w + 1}: ${verified.length} verified, ${rejected.length} rejected/unverified, ${nulls} null verification calls.`)

  if (nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} verification calls failed this wave — backing off; returning partial review and resuming later`)
    break
  }
}

const verifiedIssues = verified
  .filter(v => v.verified)
  .sort((a, b) => {
    const sr = severityRank(a.severity) - severityRank(b.severity)
    if (sr !== 0) return sr
    const cr = ({ high: 0, medium: 1, low: 2 })[b.confidence] - ({ high: 0, medium: 1, low: 2 })[a.confidence]
    if (cr !== 0) return cr
    if (a.file !== b.file) return a.file < b.file ? -1 : 1
    return a.title < b.title ? -1 : a.title > b.title ? 1 : 0
  })

const reviewedFiles = new Set([...verifiedIssues, ...rejected].map(x => x.file))
const missingFiles = CHANGED_FILES.filter(f => !reviewedFiles.has(f)).concat(unreviewed.filter(f => !reviewedFiles.has(f)))

if (missingFiles.length) {
  log(`⚠ partial coverage: ${missingFiles.length}/${CHANGED_FILES.length} files may need another pass.`)
}

phase('Synthesize')
const synthesis = await agent(
  synthPrompt(verifiedIssues, [...new Set(missingFiles)]),
  {
    label: 'synthesize-review',
    phase: 'Synthesize',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        prioritizedFindings: {
          type: 'array',
          items: VERIFIED_ISSUE_SCHEMA,
        },
        gaps: { type: 'array', items: { type: 'string' } },
        overallAssessment: { type: 'string' },
      },
      required: ['summary', 'prioritizedFindings', 'gaps', 'overallAssessment'],
    },
    model: 'claude-3-5-sonnet',
    effort: 'high',
  }
)

return {
  reviewedFiles: CHANGED_FILES.length - new Set(missingFiles).size,
  missingFiles: [...new Set(missingFiles)],
  candidateFindings: deduped.length,
  verifiedFindings: verifiedIssues.length,
  rejectedFindings: rejected.length,
  synthesis,
}
```

> **GPT-5.5 judge:** The script uses bounded waves of 6, capped schemas/outputs, null-tolerant handling, partial synthesis with explicit gaps, and backs off on high null rates. However, it has no armed ScheduleWakeup/timeout watchdog, so one hung agent call inside a wave can still deadlock the whole run with no notification. It also has no explicit per-agent retry, no durable per-wave checkpointing, and completed no-finding reviews are not tracked correctly, causing clean files to be reported as missing. Overall it avoids the worst unbounded fan-out pattern but misses key safe-by-construction protections against hangs and loss of completed work.

