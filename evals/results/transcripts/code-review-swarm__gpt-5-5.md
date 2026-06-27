# code-review-swarm — `gpt-5.5`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a CODE-REVIEW SWARM: review 28 changed files across five dimensions (correctness bugs, security, performance, style, missing tests). Spawn agents to find issues, then verify each candidate finding before including it, and synthesize a single prioritized review with severity levels.

---

## Baseline (no skill) — rubric 25%, patterns 56%

```js
export const meta = {
  name: 'code-review-swarm',
  description: 'Swarm-review changed files across correctness, security, performance, style, and missing-tests dimensions; verify every candidate before synthesizing a prioritized review.',
  phases: [
    { title: 'Scope changed files' },
    { title: 'Discover candidate findings' },
    { title: 'Verify candidate findings' },
    { title: 'Synthesize prioritized review' },
  ],
}

const DIMENSIONS = [
  {
    key: 'correctness',
    title: 'Correctness bugs',
    guidance:
      'Look for logic errors, edge cases, regressions, data-loss risks, incorrect API usage, broken control flow, race conditions, and behavior that contradicts the apparent intent.',
  },
  {
    key: 'security',
    title: 'Security',
    guidance:
      'Look for auth/authz bypasses, injection, XSS/CSRF/SSRF, unsafe deserialization, secret leakage, path traversal, insecure crypto, permission mistakes, and privacy issues.',
  },
  {
    key: 'performance',
    title: 'Performance',
    guidance:
      'Look for algorithmic regressions, avoidable N+1 work, excessive I/O, memory leaks, unbounded loops/allocations, cache misuse, blocking operations, and scalability risks.',
  },
  {
    key: 'style',
    title: 'Style / maintainability',
    guidance:
      'Look for maintainability issues that materially affect readability, consistency, API ergonomics, error handling clarity, dead code, confusing naming, or long-term maintainability. Avoid pure nitpicks.',
  },
  {
    key: 'missing-tests',
    title: 'Missing tests',
    guidance:
      'Look for changed behavior, edge cases, bug fixes, security-sensitive paths, migrations, public APIs, and regressions that should have automated tests but do not.',
  },
]

const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key)

const changedFileSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['files'],
  properties: {
    files: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'status', 'summary'],
        properties: {
          path: { type: 'string' },
          status: { type: 'string' },
          summary: { type: 'string' },
        },
      },
    },
  },
}

const discoverySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'dimension',
          'severity',
          'file',
          'lineStart',
          'lineEnd',
          'title',
          'description',
          'evidence',
          'recommendation',
          'confidence',
        ],
        properties: {
          dimension: { type: 'string', enum: DIMENSION_KEYS },
          severity: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'] },
          file: { type: 'string' },
          lineStart: { type: ['integer', 'null'] },
          lineEnd: { type: ['integer', 'null'] },
          title: { type: 'string' },
          description: { type: 'string' },
          evidence: { type: 'string' },
          recommendation: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
}

const verificationSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'valid',
    'severity',
    'file',
    'lineStart',
    'lineEnd',
    'title',
    'verifiedFinding',
    'evidence',
    'recommendedFix',
    'verificationNotes',
  ],
  properties: {
    valid: { type: 'boolean' },
    severity: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'] },
    file: { type: 'string' },
    lineStart: { type: ['integer', 'null'] },
    lineEnd: { type: ['integer', 'null'] },
    title: { type: 'string' },
    verifiedFinding: { type: 'string' },
    evidence: { type: 'string' },
    recommendedFix: { type: 'string' },
    verificationNotes: { type: 'string' },
  },
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeFileEntry(entry) {
  if (typeof entry === 'string') {
    return { path: entry, status: 'changed', summary: '' }
  }

  if (entry && typeof entry === 'object') {
    const path = String(entry.path || entry.file || entry.filename || entry.name || '').trim()
    if (!path) return null

    return {
      path,
      status: String(entry.status || entry.changeType || entry.type || 'changed'),
      summary: String(entry.summary || entry.description || ''),
    }
  }

  return null
}

function uniqueFiles(files) {
  const seen = new Set()
  const out = []

  for (const file of files) {
    const normalized = normalizeFileEntry(file)
    if (!normalized) continue

    if (!seen.has(normalized.path)) {
      seen.add(normalized.path)
      out.push(normalized)
    }
  }

  return out
}

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

function json(value) {
  return JSON.stringify(value, null, 2)
}

phase('Scope changed files')

let changedFiles = uniqueFiles(
  asArray(args && (args.changedFiles || args.files || args.paths || args.changed_files))
)

if (changedFiles.length === 0) {
  log('No changed-file list was provided; asking a scoping agent to discover changed files from the repository diff.')

  const scoped = await agent(
    `Identify the changed files that should be reviewed for this code-review swarm.

Use the local repository context. Prefer the current pull request / branch diff if available; otherwise use git diff against the likely base branch. Return the changed files only, with a short summary of what changed in each file.

Target scope: the task is to review 28 changed files. If exactly 28 files are changed, return all 28. If the repository reports a different number, return the actual changed files and do not invent paths.`,
    {
      label: 'scope-changed-files',
      phase: 'Scope changed files',
      schema: changedFileSchema,
      effort: 'medium',
    }
  )

  changedFiles = uniqueFiles(scoped && scoped.files)
}

const targetFilesNote =
  changedFiles.length > 0
    ? `Scoped ${changedFiles.length} changed file(s) for review.`
    : 'Changed-file discovery returned no explicit paths; review agents will discover the diff themselves.'

log(targetFilesNote)

const requestedChunkSize =
  args && Number.isInteger(args.chunkSize) && args.chunkSize > 0 ? args.chunkSize : 4

const fileGroups =
  changedFiles.length > 0
    ? chunk(changedFiles, requestedChunkSize).map((files, index) => ({
        index: index + 1,
        files,
      }))
    : [
        {
          index: 1,
          files: [],
          discoverAllChangedFiles: true,
        },
      ]

phase('Discover candidate findings')

const discoveryTasks = []
for (const dimension of DIMENSIONS) {
  for (const group of fileGroups) {
    discoveryTasks.push({ dimension, group })
  }
}

log(
  `Launching ${discoveryTasks.length} discovery agent(s): ${DIMENSIONS.length} review dimensions across ${fileGroups.length} file shard(s).`
)

const discoveryResults = await parallel(
  discoveryTasks.map((task) => async () => {
    const fileScope =
      task.group.files.length > 0
        ? `Review this shard of changed files only, while considering cross-file context when needed:\n${json(
            task.group.files
          )}`
        : `No explicit file list is available. Discover the changed files from the repository diff and review all changed files for this dimension.`

    return agent(
      `You are one reviewer in a code-review swarm.

Review dimension: ${task.dimension.title}
Dimension key: ${task.dimension.key}

Guidance:
${task.dimension.guidance}

Scope:
${fileScope}

Instructions:
- Inspect the actual diff and surrounding code; do not rely only on filenames.
- Focus on concrete, actionable findings introduced or exposed by the change.
- Report only findings for the assigned dimension.
- Prefer high-signal issues over volume.
- Include exact file and line information when possible.
- For missing-tests findings, cite the behavior or edge case that lacks coverage and the test location/type that should cover it.
- For style findings, include only maintainability concerns worth mentioning in a real review.
- Do not include praise, summaries, or duplicate variants of the same issue.
- Return at most 8 candidate findings. Return an empty findings array if there are no credible issues.`,
      {
        label: `${task.dimension.key}-discover-shard-${task.group.index}`,
        phase: 'Discover candidate findings',
        schema: discoverySchema,
        effort: task.dimension.key === 'security' || task.dimension.key === 'correctness' ? 'high' : 'medium',
      }
    )
  })
)

let rawCandidates = []
for (let i = 0; i < discoveryResults.length; i++) {
  const result = discoveryResults[i]
  const task = discoveryTasks[i]

  if (!result || !Array.isArray(result.findings)) continue

  for (const finding of result.findings) {
    rawCandidates.push({
      candidateId: `C${String(rawCandidates.length + 1).padStart(3, '0')}`,
      sourceReviewer: `${task.dimension.key}-discover-shard-${task.group.index}`,
      dimension: task.dimension.key,
      dimensionTitle: task.dimension.title,
      severity: finding.severity,
      file: finding.file,
      lineStart: finding.lineStart,
      lineEnd: finding.lineEnd,
      title: finding.title,
      description: finding.description,
      evidence: finding.evidence,
      recommendation: finding.recommendation,
      confidence: finding.confidence,
    })
  }
}

log(`Discovery produced ${rawCandidates.length} candidate finding(s).`)

phase('Verify candidate findings')

let verifiedFindings = []
let verificationResults = []

if (rawCandidates.length > 0) {
  log(`Launching ${rawCandidates.length} independent verifier agent(s), one per candidate finding.`)

  verificationResults = await parallel(
    rawCandidates.map((candidate) => async () => {
      return agent(
        `You are an independent verifier for a code-review swarm.

Your job is to verify exactly one candidate finding. Be skeptical. Do not rubber-stamp the discovery agent.

Candidate:
${json(candidate)}

Changed-file scope:
${changedFiles.length > 0 ? json(changedFiles) : 'No explicit file list was provided; discover the current diff from the repository.'}

Verification instructions:
- Inspect the actual changed code, surrounding implementation, call sites, configuration, and tests as needed.
- Determine whether the claim is real, actionable, and introduced or exposed by the change.
- Mark valid=false if the issue is speculative, already handled elsewhere, not in changed code, not reproducible from the code, merely a preference, or duplicated by an equivalent safer implementation.
- For missing-tests claims, verify that relevant tests are actually absent or insufficient.
- You may adjust severity, title, line numbers, evidence, and fix recommendation.
- Keep the verifiedFinding concise but specific.
- If invalid, still fill all fields, using the candidate's best-known file/title and explain why in verificationNotes.`,
        {
          label: `verify-${candidate.candidateId}`,
          phase: 'Verify candidate findings',
          schema: verificationSchema,
          effort: candidate.severity === 'Critical' || candidate.severity === 'High' ? 'high' : 'medium',
        }
      )
    })
  )

  for (let i = 0; i < verificationResults.length; i++) {
    const verification = verificationResults[i]
    const candidate = rawCandidates[i]

    if (!verification || verification.valid !== true) continue

    verifiedFindings.push({
      candidateId: candidate.candidateId,
      sourceReviewer: candidate.sourceReviewer,
      dimension: candidate.dimension,
      dimensionTitle: candidate.dimensionTitle,
      originalSeverity: candidate.severity,
      severity: verification.severity,
      file: verification.file || candidate.file,
      lineStart: verification.lineStart,
      lineEnd: verification.lineEnd,
      title: verification.title,
      verifiedFinding: verification.verifiedFinding,
      evidence: verification.evidence,
      recommendedFix: verification.recommendedFix,
      verificationNotes: verification.verificationNotes,
    })
  }
}

const invalidOrUnverifiedCount = rawCandidates.length - verifiedFindings.length
log(
  `Verification accepted ${verifiedFindings.length} finding(s) and rejected or lost ${invalidOrUnverifiedCount} candidate(s).`
)

phase('Synthesize prioritized review')

const finalReport = await agent(
  `Synthesize the final code-review response from verified findings only.

Review scope:
${changedFiles.length > 0 ? json(changedFiles) : 'The review agents discovered the changed files from the repository diff.'}

Discovery/verification counts:
- Candidate findings discovered: ${rawCandidates.length}
- Verified findings accepted: ${verifiedFindings.length}
- Candidates rejected, invalid, duplicate-at-verification, skipped, or unavailable: ${invalidOrUnverifiedCount}

Verified findings:
${json(verifiedFindings)}

Output requirements:
- Produce a single prioritized code-review report.
- Include severity levels: Critical, High, Medium, Low.
- Deduplicate findings that have the same root cause. If multiple verified candidates describe the same issue, merge them and keep the highest justified severity.
- Sort by severity first, then by practical impact.
- For each included finding, provide:
  1. Severity
  2. Dimension(s)
  3. File and line/range when available
  4. Short title
  5. Why it matters
  6. Evidence from the code/change
  7. Suggested fix
- Include missing-test findings as review comments with concrete test recommendations.
- Do not include unverified or rejected candidate findings.
- If there are no verified findings, say that no verified issues were found and briefly describe the review coverage.
- Keep the report concise enough for a pull-request review, but do not omit important verified findings.`,
  {
    label: 'synthesize-prioritized-review',
    phase: 'Synthesize prioritized review',
    effort: 'high',
  }
)

finalReport ||
  `# Code Review Swarm Result

No final synthesis was produced.

- Candidate findings discovered: ${rawCandidates.length}
- Verified findings accepted: ${verifiedFindings.length}
- Candidates rejected, skipped, or unavailable: ${invalidOrUnverifiedCount}

${
  verifiedFindings.length === 0
    ? 'No verified findings are available.'
    : `Verified findings:\n\n${json(verifiedFindings)}`
}`
```

> **Claude judge:** The script uses two unbounded parallel() barriers (all discovery, then all verification) with no wave-size capping, no stall watchdog, no per-agent retry, and no backoff on high failure rates; null-checking is present but insufficient to recover lost work, and there is no incremental result commitment before synthesis.

## With skill — rubric 97%, patterns 94%

```js
export const meta = {
  name: 'code-review-swarm',
  description: 'Safely review changed files across correctness, security, performance, style, and missing-tests dimensions; verify candidates before synthesis.',
  phases: [
    { title: 'Plan' },
    { title: 'Discover' },
    { title: 'Verify' },
    { title: 'Retry' },
    { title: 'Synthesize' },
  ],
}

/*
After launching this workflow, arm the agent-level watchdog outside the script body:

ScheduleWakeup({
  delaySeconds: 1200,
  reason: "watchdog: code-review-swarm wf_<id> may stall silently; check journal mtime",
  prompt: "Watchdog for code-review-swarm run wf_<id>: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
})
*/

const DIMENSIONS = [
  'correctness bugs',
  'security',
  'performance',
  'style',
  'missing tests',
]

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'nit']
const WAVE_SIZE = 7
const MAX_CANDIDATES_PER_FILE = 8
const MAX_VERIFIED_FINDINGS_PER_FILE = 8

const FILE_LIST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['files'],
  properties: {
    files: {
      type: 'array',
      maxItems: 80,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path'],
        properties: {
          path: { type: 'string' },
          status: { type: 'string' },
          reasonIncluded: { type: 'string' },
        },
      },
    },
  },
}

const DISCOVERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['filePath', 'candidates', 'coverageNotes'],
  properties: {
    filePath: { type: 'string' },
    candidates: {
      type: 'array',
      maxItems: MAX_CANDIDATES_PER_FILE,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'candidateId',
          'dimension',
          'title',
          'suspectedSeverity',
          'location',
          'evidence',
          'whyItMayMatter',
          'recommendedFix',
          'testGap',
        ],
        properties: {
          candidateId: { type: 'string' },
          dimension: { enum: DIMENSIONS },
          title: { type: 'string' },
          suspectedSeverity: { enum: SEVERITIES },
          location: {
            type: 'object',
            additionalProperties: false,
            required: ['file', 'lineHint'],
            properties: {
              file: { type: 'string' },
              lineHint: { type: 'string' },
              symbol: { type: 'string' },
            },
          },
          evidence: {
            type: 'array',
            maxItems: 3,
            items: { type: 'string' },
          },
          whyItMayMatter: { type: 'string' },
          recommendedFix: { type: 'string' },
          testGap: { type: 'string' },
        },
      },
    },
    coverageNotes: {
      type: 'object',
      additionalProperties: false,
      required: ['correctness', 'security', 'performance', 'style', 'missingTests'],
      properties: {
        correctness: { type: 'string' },
        security: { type: 'string' },
        performance: { type: 'string' },
        style: { type: 'string' },
        missingTests: { type: 'string' },
      },
    },
  },
}

const VERIFICATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['filePath', 'verifiedFindings', 'rejectedCandidateIds', 'verificationNotes'],
  properties: {
    filePath: { type: 'string' },
    verifiedFindings: {
      type: 'array',
      maxItems: MAX_VERIFIED_FINDINGS_PER_FILE,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'candidateId',
          'dimension',
          'title',
          'severity',
          'confidence',
          'location',
          'evidence',
          'impact',
          'recommendation',
          'testRecommendation',
        ],
        properties: {
          candidateId: { type: 'string' },
          dimension: { enum: DIMENSIONS },
          title: { type: 'string' },
          severity: { enum: SEVERITIES },
          confidence: { enum: ['high', 'medium', 'low'] },
          location: {
            type: 'object',
            additionalProperties: false,
            required: ['file', 'lineHint'],
            properties: {
              file: { type: 'string' },
              lineHint: { type: 'string' },
              symbol: { type: 'string' },
            },
          },
          evidence: {
            type: 'array',
            maxItems: 3,
            items: { type: 'string' },
          },
          impact: { type: 'string' },
          recommendation: { type: 'string' },
          testRecommendation: { type: 'string' },
        },
      },
    },
    rejectedCandidateIds: {
      type: 'array',
      maxItems: MAX_CANDIDATES_PER_FILE,
      items: { type: 'string' },
    },
    verificationNotes: { type: 'string' },
  },
}

const SYNTHESIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'markdownReview',
    'summary',
    'prioritizedFindings',
    'missingOrPartialCoverage',
    'reviewStats',
  ],
  properties: {
    markdownReview: { type: 'string' },
    summary: { type: 'string' },
    prioritizedFindings: {
      type: 'array',
      maxItems: 80,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'rank',
          'severity',
          'dimension',
          'file',
          'lineHint',
          'title',
          'impact',
          'recommendation',
          'testRecommendation',
        ],
        properties: {
          rank: { type: 'integer' },
          severity: { enum: SEVERITIES },
          dimension: { enum: DIMENSIONS },
          file: { type: 'string' },
          lineHint: { type: 'string' },
          title: { type: 'string' },
          impact: { type: 'string' },
          recommendation: { type: 'string' },
          testRecommendation: { type: 'string' },
        },
      },
    },
    missingOrPartialCoverage: {
      type: 'array',
      maxItems: 80,
      items: { type: 'string' },
    },
    reviewStats: {
      type: 'object',
      additionalProperties: false,
      required: [
        'filesPlanned',
        'filesReviewed',
        'filesMissing',
        'verifiedFindingCount',
        'criticalCount',
        'highCount',
        'mediumCount',
        'lowCount',
        'nitCount',
      ],
      properties: {
        filesPlanned: { type: 'integer' },
        filesReviewed: { type: 'integer' },
        filesMissing: { type: 'integer' },
        verifiedFindingCount: { type: 'integer' },
        criticalCount: { type: 'integer' },
        highCount: { type: 'integer' },
        mediumCount: { type: 'integer' },
        lowCount: { type: 'integer' },
        nitCount: { type: 'integer' },
      },
    },
  },
}

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function normalizeFileEntry(entry) {
  if (typeof entry === 'string') return { path: entry, status: '', reasonIncluded: '' }
  if (entry && typeof entry === 'object') {
    return {
      path: String(entry.path || entry.file || entry.filename || ''),
      status: String(entry.status || entry.changeType || ''),
      reasonIncluded: String(entry.reasonIncluded || entry.reason || ''),
    }
  }
  return { path: '', status: '', reasonIncluded: '' }
}

function dedupeAndSortFiles(files) {
  const byPath = new Map()
  for (const raw of files || []) {
    const f = normalizeFileEntry(raw)
    if (!f.path) continue
    if (!byPath.has(f.path)) byPath.set(f.path, f)
  }
  return [...byPath.values()].sort((a, b) => (a.path > b.path ? 1 : a.path < b.path ? -1 : 0))
}

function labelFor(prefix, path) {
  const raw = `${prefix}:${path}`
  return raw.length <= 96 ? raw : raw.slice(0, 96)
}

function stableFilePayload(file) {
  return JSON.stringify({
    path: file.path,
    status: file.status || '',
    reasonIncluded: file.reasonIncluded || '',
  })
}

const baseRef = String(args && (args.baseRef || args.base || args.targetRef || args.mergeBase) || 'HEAD~1')
const headRef = String(args && (args.headRef || args.head || args.sourceRef) || 'HEAD')
const reviewInstructions = String(args && (args.reviewInstructions || args.instructions || '') || '')
const repositoryContext = String(args && (args.repositoryContext || args.context || '') || '')

phase('Plan')

let files = dedupeAndSortFiles(
  args && (args.changedFiles || args.files || args.paths || args.changed_files)
)

if (!files.length) {
  log(`No changedFiles were provided in args; asking a planning agent to discover changed files between ${baseRef} and ${headRef}.`)
  const discovered = await agent(
    `Identify the changed source files to review for a code review.

Base ref: ${baseRef}
Head ref: ${headRef}

Use repository tools to inspect the diff. Return the changed files that warrant code review.
Prefer source, config, test, migration, and build files. Exclude generated/vendor/lock files unless they are directly meaningful.

Expected task size: 28 changed files if present.

Return lean structured data only.`,
    {
      label: 'plan:changed-files',
      phase: 'Plan',
      schema: FILE_LIST_SCHEMA,
      effort: 'low',
    }
  )
  files = dedupeAndSortFiles(discovered ? discovered.files : [])
}

if (!files.length) {
  log('No files available to review. Returning empty review.')
  return {
    files: [],
    missing: [],
    synthesis: {
      markdownReview: 'No changed files were provided or discoverable, so no code review was performed.',
      summary: 'No changed files available.',
      prioritizedFindings: [],
      missingOrPartialCoverage: ['No changed files were provided or discoverable.'],
      reviewStats: {
        filesPlanned: 0,
        filesReviewed: 0,
        filesMissing: 0,
        verifiedFindingCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
      },
    },
  }
}

log(`Planned code review for ${files.length} changed file(s). Wave size=${WAVE_SIZE}.`)

function discoverPrompt(file) {
  return `You are a senior code-review discovery agent.

Review exactly this changed file across five dimensions:
1. correctness bugs
2. security
3. performance
4. style
5. missing tests

File payload:
${stableFilePayload(file)}

Diff range:
Base ref: ${baseRef}
Head ref: ${headRef}

Repository context:
${repositoryContext || '(none provided)'}

Additional review instructions:
${reviewInstructions || '(none provided)'}

Tasks:
- Inspect the changed file and relevant nearby code/tests using repository tools.
- Focus on issues introduced by or made relevant by the current diff.
- Produce candidate findings only; a separate verifier will decide whether to include them.
- Include missing-test findings when changed behavior lacks adequate tests.
- Do not pad. If there are no plausible issues, return an empty candidates array.
- Return at most ${MAX_CANDIDATES_PER_FILE} candidates.
- Keep evidence lean: line hints, symbols, or short snippets only; no long quotes.
- Use candidate IDs stable within this file: C1, C2, ...

Severity calibration:
- critical: likely exploitable security issue, data loss, severe outage, or build/runtime break in common path
- high: serious correctness/security/performance issue likely to affect users
- medium: real bug or maintainability issue with bounded impact
- low: minor but worthwhile issue
- nit: style/readability issue only

Return structured data only.`
}

function verifyPrompt(file, discovery) {
  const candidates = JSON.stringify({
    file,
    candidates: discovery.candidates || [],
  })

  return `You are an independent code-review verification agent.

Verify each candidate finding for this changed file. Include only findings that survive scrutiny.

Diff range:
Base ref: ${baseRef}
Head ref: ${headRef}

Repository context:
${repositoryContext || '(none provided)'}

Additional review instructions:
${reviewInstructions || '(none provided)'}

Candidate payload:
${candidates}

Verification rules:
- Inspect the repository/diff independently using tools.
- Try to falsify each candidate.
- Include a candidate only if it is concrete, actionable, and supported by evidence.
- Prefer findings tied to changed lines or changed behavior.
- Exclude speculative concerns, already-handled cases, pre-existing unrelated issues, and style preferences not supported by project conventions.
- For missing-test findings, verify that behavior changed and existing tests do not cover the relevant path.
- Calibrate severity conservatively.
- Keep evidence lean: at most 3 short evidence strings per finding.
- Return rejectedCandidateIds for candidates that should not be included.

Return structured data only.`
}

function emptyVerification(file, discovery) {
  return {
    filePath: file.path,
    verifiedFindings: [],
    rejectedCandidateIds: (discovery && discovery.candidates ? discovery.candidates : []).map(c => c.candidateId).filter(Boolean),
    verificationNotes: 'Discovery returned no candidates; no verifier agent needed.',
  }
}

function discoverFile(file) {
  return agent(discoverPrompt(file), {
    label: labelFor('discover', file.path),
    phase: 'Discover',
    schema: DISCOVERY_SCHEMA,
    effort: 'medium',
  })
}

function verifyFile(file, discovery) {
  if (!discovery) return null
  if (!discovery.candidates || discovery.candidates.length === 0) return emptyVerification(file, discovery)
  return agent(verifyPrompt(file, discovery), {
    label: labelFor('verify', file.path),
    phase: 'Verify',
    schema: VERIFICATION_SCHEMA,
    effort: 'medium',
  })
}

const waves = chunk(files, WAVE_SIZE)
const done = []
let failed = []
let instabilityDetected = false
let stoppedAfterWave = null

for (let w = 0; w < waves.length; w++) {
  phase(`Review wave ${w + 1}/${waves.length}`)
  const wave = waves[w]
  log(`Starting review wave ${w + 1}/${waves.length} with ${wave.length} file(s).`)

  const batch = await pipeline(
    wave,
    (file) => discoverFile(file),
    (discovery, file) => verifyFile(file, discovery)
  )

  let nulls = 0
  batch.forEach((result, i) => {
    if (result) {
      const filePath = result.filePath || wave[i].path
      done.push({
        filePath,
        verifiedFindings: result.verifiedFindings || [],
        rejectedCandidateIds: result.rejectedCandidateIds || [],
        verificationNotes: result.verificationNotes || '',
      })
    } else {
      nulls += 1
      failed.push(wave[i])
    }
  })

  log(`Wave ${w + 1}: ${wave.length - nulls}/${wave.length} file(s) verified; cumulative reviewed=${done.length}/${files.length}; retry candidates=${failed.length}.`)

  if (nulls / wave.length > 0.4) {
    instabilityDetected = true
    stoppedAfterWave = w + 1
    log(`instability: ${nulls}/${wave.length} failed this wave — backing off; returning partial review. Resume later with Workflow({ scriptPath, resumeFromRunId }) so cached successes are reused.`)
    break
  }
}

if (failed.length && !instabilityDetected) {
  phase('Retry')
  const retryFiles = failed
  failed = []
  log(`Starting retry wave for ${retryFiles.length} file(s) that returned null earlier.`)

  const retried = await pipeline(
    retryFiles,
    (file) => discoverFile(file),
    (discovery, file) => verifyFile(file, discovery)
  )

  let recovered = 0
  retried.forEach((result, i) => {
    if (result) {
      recovered += 1
      done.push({
        filePath: result.filePath || retryFiles[i].path,
        verifiedFindings: result.verifiedFindings || [],
        rejectedCandidateIds: result.rejectedCandidateIds || [],
        verificationNotes: result.verificationNotes || '',
      })
    } else {
      failed.push(retryFiles[i])
    }
  })

  log(`Retry wave recovered ${recovered}/${retryFiles.length}; still missing ${failed.length}.`)
}

const reviewedFilePaths = new Set(done.map(r => r.filePath))
const missing = files.filter(f => !reviewedFilePaths.has(f.path)).map(f => f.path)

if (missing.length) {
  log(`partial: missing ${missing.length}/${files.length} file(s): ${missing.join(', ')}`)
}

const verifiedPayload = done
  .map(fileResult => ({
    filePath: fileResult.filePath,
    verifiedFindings: (fileResult.verifiedFindings || []).map(f => ({
      candidateId: f.candidateId,
      dimension: f.dimension,
      title: f.title,
      severity: f.severity,
      confidence: f.confidence,
      location: f.location,
      evidence: f.evidence,
      impact: f.impact,
      recommendation: f.recommendation,
      testRecommendation: f.testRecommendation,
    })),
    verificationNotes: fileResult.verificationNotes || '',
  }))
  .sort((a, b) => (a.filePath > b.filePath ? 1 : a.filePath < b.filePath ? -1 : 0))

const verifiedFindingCount = verifiedPayload.reduce((sum, r) => sum + r.verifiedFindings.length, 0)

phase('Synthesize')
log(`Synthesizing prioritized review from ${verifiedFindingCount} verified finding(s) across ${done.length}/${files.length} reviewed file(s).`)

const synthesisInput = JSON.stringify({
  reviewScope: {
    baseRef,
    headRef,
    dimensions: DIMENSIONS,
    filesPlanned: files.map(f => f.path),
    filesReviewed: verifiedPayload.map(r => r.filePath),
    missingFiles: missing,
    instabilityDetected,
    stoppedAfterWave,
  },
  verifiedResults: verifiedPayload,
})

const synthesis = await agent(
  `You are the final code-review synthesis agent.

Create a single prioritized code review from ONLY the verified findings below.
Do not include unverified discovery candidates.
Deduplicate overlapping findings.
Prioritize by severity, confidence, user impact, exploitability, and likelihood.
Flag partial coverage explicitly.

Severity order:
critical > high > medium > low > nit

Required markdownReview format:
1. Brief summary
2. Prioritized findings grouped or ordered by severity
3. Missing tests section if any verified missing-test findings exist
4. Partial coverage / gaps section if any files are missing or evidence is thin
5. If there are no verified findings, say that no verified findings were found and still mention coverage gaps if any

For each finding include:
- Severity
- Dimension
- File and line hint
- Problem
- Impact
- Recommendation
- Test recommendation

Verified review payload:
${synthesisInput}

Return structured data only.`,
  {
    label: 'synthesize:prioritized-review',
    phase: 'Synthesize',
    schema: SYNTHESIS_SCHEMA,
    effort: 'high',
  }
)

return {
  filesPlanned: files,
  filesReviewed: verifiedPayload.map(r => r.filePath),
  missing,
  instabilityDetected,
  stoppedAfterWave,
  verifiedResults: verifiedPayload,
  synthesis,
}
```

> **Claude judge:** All eight safety properties are present: WAVE_SIZE=7 bounded waves, per-wave null tracking with a dedicated retry pass, incremental done[] accumulation per wave, a detailed ScheduleWakeup watchdog comment, deterministic cache-stable prompts via stableFilePayload(), tightly capped schemas with additionalProperties:false, synthesis that explicitly flags missing files and partial coverage, and a >40% failure-rate backoff that halts further waves and recommends resumeFromRunId.

