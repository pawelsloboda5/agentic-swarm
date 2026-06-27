# code-review-swarm — `gpt-5.5`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a CODE-REVIEW SWARM: review 28 changed files across five dimensions (correctness bugs, security, performance, style, missing tests). Spawn agents to find issues, then verify each candidate finding before including it, and synthesize a single prioritized review with severity levels.

---

## Baseline (no skill) — rubric 20%, patterns 44%

```js
export const meta = {
  name: 'code-review-swarm',
  description: 'Swarm review of changed files across correctness, security, performance, style, and missing-test dimensions with verification before synthesis.',
  phases: [
    { title: 'Discover changed files' },
    { title: 'Find candidate issues' },
    { title: 'Verify candidates' },
    { title: 'Synthesize prioritized review' },
  ],
}

const DIMENSIONS = [
  {
    key: 'correctness',
    title: 'Correctness bugs',
    prompt:
      'Find functional correctness bugs: broken logic, regressions, edge cases, invalid assumptions, race conditions, bad error handling, data loss, API contract violations, or behavior that will fail in production.',
  },
  {
    key: 'security',
    title: 'Security',
    prompt:
      'Find security issues: injection, auth/authz bypass, secrets exposure, unsafe deserialization, SSRF, XSS, CSRF, path traversal, insecure crypto, permission mistakes, logging sensitive data, dependency or supply-chain risk introduced by the change.',
  },
  {
    key: 'performance',
    title: 'Performance',
    prompt:
      'Find performance issues: algorithmic regressions, unnecessary IO/network/database calls, N+1 queries, memory leaks, excessive allocations, blocking work, missed caching, inefficient concurrency, or scalability problems introduced by the change.',
  },
  {
    key: 'style',
    title: 'Style / maintainability',
    prompt:
      'Find maintainability issues that materially affect review quality: confusing structure, dead code, duplicated logic, poor naming that obscures behavior, inconsistent patterns, brittle abstractions, insufficient error messages, or code that will be hard to safely modify. Avoid trivial formatting nits.',
  },
  {
    key: 'tests',
    title: 'Missing tests',
    prompt:
      'Find missing or inadequate tests for the changed behavior: untested edge cases, missing regression tests, missing security/performance tests, weak assertions, test gaps around error paths, or changed code without meaningful coverage.',
  },
]

const SEVERITIES = ['critical', 'high', 'medium', 'low']
const DEFAULT_TARGET_FILE_COUNT = 28

const candidateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'dimension',
          'file',
          'line',
          'title',
          'potentialSeverity',
          'confidence',
          'description',
          'evidence',
          'recommendation',
        ],
        properties: {
          dimension: { type: 'string', enum: DIMENSIONS.map((d) => d.key) },
          file: { type: 'string', minLength: 1 },
          line: { type: 'integer', minimum: 1 },
          title: { type: 'string', minLength: 1 },
          potentialSeverity: { type: 'string', enum: SEVERITIES },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          description: { type: 'string', minLength: 1 },
          evidence: { type: 'string', minLength: 1 },
          recommendation: { type: 'string', minLength: 1 },
        },
      },
    },
  },
}

const discoverySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['files', 'basis'],
  properties: {
    files: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
    basis: { type: 'string' },
  },
}

const verificationSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'verified',
    'rejectionReason',
    'dimension',
    'file',
    'line',
    'title',
    'severity',
    'confidence',
    'impact',
    'evidence',
    'recommendation',
    'testRecommendation',
    'duplicateKey',
  ],
  properties: {
    verified: { type: 'boolean' },
    rejectionReason: { type: 'string' },
    dimension: { type: 'string', enum: [...DIMENSIONS.map((d) => d.key), 'none'] },
    file: { type: 'string' },
    line: { type: 'integer', minimum: 0 },
    title: { type: 'string' },
    severity: { type: 'string', enum: [...SEVERITIES, 'none'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    impact: { type: 'string' },
    evidence: { type: 'string' },
    recommendation: { type: 'string' },
    testRecommendation: { type: 'string' },
    duplicateKey: {
      type: 'string',
      description:
        'Stable key for deduplication, e.g. file:line:root-cause. Empty string if rejected.',
    },
  },
}

function normalizeFiles(value) {
  let raw = []
  if (Array.isArray(value)) {
    raw = value
  } else if (typeof value === 'string') {
    raw = value
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  const seen = new Set()
  const files = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    files.push(trimmed)
  }
  return files
}

function argString(name, fallback) {
  return args && typeof args[name] === 'string' && args[name].trim()
    ? args[name].trim()
    : fallback
}

function argEffort(name, fallback) {
  const value = args && typeof args[name] === 'string' ? args[name] : fallback
  return ['low', 'medium', 'high', 'xhigh', 'max'].includes(value) ? value : fallback
}

function argModel(name) {
  return args && typeof args[name] === 'string' && args[name].trim()
    ? args[name].trim()
    : undefined
}

function compactOpts(opts) {
  const out = {}
  for (const [key, value] of Object.entries(opts)) {
    if (value !== undefined) out[key] = value
  }
  return out
}

function severityRank(severity) {
  if (severity === 'critical') return 0
  if (severity === 'high') return 1
  if (severity === 'medium') return 2
  if (severity === 'low') return 3
  return 4
}

function fallbackReview(verifiedFindings, rejectedCount, files) {
  if (!verifiedFindings.length) {
    return [
      '# Code Review',
      '',
      `Reviewed ${files.length} changed file(s) across correctness, security, performance, style, and missing-test dimensions.`,
      '',
      'No verified findings were identified.',
      '',
      `Rejected candidate findings during verification: ${rejectedCount}.`,
    ].join('\n')
  }

  const sorted = [...verifiedFindings].sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity)
    if (bySeverity !== 0) return bySeverity
    const byFile = String(a.file).localeCompare(String(b.file))
    if (byFile !== 0) return byFile
    return Number(a.line || 0) - Number(b.line || 0)
  })

  const lines = [
    '# Code Review',
    '',
    `Reviewed ${files.length} changed file(s) across correctness, security, performance, style, and missing-test dimensions.`,
    '',
    '## Verified findings',
    '',
  ]

  for (const finding of sorted) {
    lines.push(
      `### ${finding.severity.toUpperCase()}: ${finding.title}`,
      '',
      `- **Dimension:** ${finding.dimension}`,
      `- **Location:** ${finding.file}:${finding.line}`,
      `- **Impact:** ${finding.impact}`,
      `- **Evidence:** ${finding.evidence}`,
      `- **Recommendation:** ${finding.recommendation}`,
      finding.testRecommendation
        ? `- **Test recommendation:** ${finding.testRecommendation}`
        : '- **Test recommendation:** Not specified.',
      ''
    )
  }

  lines.push(`Rejected candidate findings during verification: ${rejectedCount}.`)
  return lines.join('\n')
}

const baseRef = argString('baseRef', 'main')
const headRef = argString('headRef', 'HEAD')
const finderEffort = argEffort('finderEffort', 'medium')
const verifierEffort = argEffort('verifierEffort', 'high')
const synthesisEffort = argEffort('synthesisEffort', 'high')
const finderModel = argModel('finderModel')
const verifierModel = argModel('verifierModel')
const synthesisModel = argModel('synthesisModel')
const maxFiles =
  args && Number.isInteger(args.maxFiles) && args.maxFiles > 0
    ? args.maxFiles
    : DEFAULT_TARGET_FILE_COUNT

phase('Discover changed files')

let files = normalizeFiles(
  args && (args.changedFiles || args.files || args.fileList || (Array.isArray(args) ? args : null))
)

if (!files.length) {
  log(`No changed file list supplied; discovering up to ${maxFiles} changed files from git diff.`)
  const discovery = await agent(
    `Discover the changed files for this review.

Use repository inspection commands only; do not modify files.

Preferred comparison:
- Base ref: ${baseRef}
- Head ref: ${headRef}

Return the changed source/test/config files that should be code-reviewed. Exclude generated artifacts, lockfiles, vendored files, build outputs, images, and purely mechanical files unless they are the substance of the change.

Return at most ${maxFiles} files. If more files changed, choose the ${maxFiles} most review-relevant files and explain the basis briefly.`,
    compactOpts({
      label: 'discover-changed-files',
      phase: 'Discover changed files',
      schema: discoverySchema,
      model: finderModel,
      effort: 'low',
    })
  )
  files = normalizeFiles(discovery && discovery.files)
}

if (files.length > maxFiles) {
  log(`Received ${files.length} changed files; reviewing first ${maxFiles}.`)
  files = files.slice(0, maxFiles)
}

log(`Review target: ${files.length} changed file(s).`)

phase('Find candidate issues')

const reviewTargets = []
for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
  for (const dimension of DIMENSIONS) {
    reviewTargets.push({
      file: files[fileIndex],
      fileIndex,
      dimension,
    })
  }
}

const finderResults = await parallel(
  reviewTargets.map((target, targetIndex) => async () => {
    return await agent(
      `You are one member of a code-review swarm.

Assignment:
- File: ${target.file}
- Dimension: ${target.dimension.title}
- Dimension guidance: ${target.dimension.prompt}

Review scope:
- Compare ${baseRef}...${headRef}.
- Focus on issues introduced by or made materially worse by the changed code.
- Inspect the full file, surrounding context, call sites, relevant tests, and related types/configuration as needed.
- Do not modify files.
- Do not report speculative issues. Prefer zero findings over weak findings.
- Do not report purely pre-existing problems unless this change exposes or depends on them.
- Do not duplicate generic advice; findings must be actionable and tied to a specific location.
- For missing tests, point to the changed line or closest relevant production/test line that needs coverage.

Return up to 4 strongest candidate findings for this file and dimension. If there are no strong candidates, return an empty candidates array.`,
      compactOpts({
        label: `find-${target.dimension.key}-${target.fileIndex + 1}`,
        phase: 'Find candidate issues',
        schema: candidateSchema,
        model: finderModel,
        effort: finderEffort,
      })
    )
  })
)

const candidates = []
for (let i = 0; i < finderResults.length; i++) {
  const result = finderResults[i]
  const target = reviewTargets[i]
  if (!result || !Array.isArray(result.candidates)) continue

  for (const candidate of result.candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    candidates.push({
      id: `C${String(candidates.length + 1).padStart(4, '0')}`,
      sourceFile: target.file,
      sourceDimension: target.dimension.key,
      dimension: candidate.dimension || target.dimension.key,
      file: candidate.file || target.file,
      line: candidate.line || 1,
      title: candidate.title || 'Untitled candidate finding',
      potentialSeverity: candidate.potentialSeverity || 'low',
      confidence: typeof candidate.confidence === 'number' ? candidate.confidence : 0,
      description: candidate.description || '',
      evidence: candidate.evidence || '',
      recommendation: candidate.recommendation || '',
    })
  }
}

log(`Candidate findings discovered: ${candidates.length}.`)

phase('Verify candidates')

const verificationResults = await parallel(
  candidates.map((candidate) => async () => {
    return await agent(
      `You are an independent verifier for a code-review finding.

Candidate finding:
${JSON.stringify(candidate, null, 2)}

Verification task:
- Independently inspect the repository and diff for ${baseRef}...${headRef}.
- Do not assume the candidate is true.
- Confirm whether the issue is real, actionable, introduced by or materially worsened by the change, and located accurately.
- Reject if it is speculative, only a trivial nit, contradicted by surrounding code, already covered adequately, pre-existing without change impact, or not worth reviewer attention.
- If verified, refine the title, severity, impact, evidence, recommendation, and test recommendation.
- If rejected, set verified=false, severity="none", dimension="none", line=0, duplicateKey="", and explain the rejectionReason.
- Do not modify files.

Severity calibration:
- critical: likely exploitable security issue, data loss/corruption, outage, or severe correctness failure.
- high: important production bug/security/performance regression with clear user or operational impact.
- medium: real defect or maintainability/test gap likely to matter but with limited scope or workaround.
- low: minor but still actionable verified issue; avoid style-only nits unless they materially reduce maintainability.

Return one verification verdict for this candidate.`,
      compactOpts({
        label: `verify-${candidate.id}`,
        phase: 'Verify candidates',
        schema: verificationSchema,
        model: verifierModel,
        effort: verifierEffort,
      })
    )
  })
)

const verifiedFindings = []
let rejectedCount = 0

for (let i = 0; i < verificationResults.length; i++) {
  const verdict = verificationResults[i]
  const candidate = candidates[i]

  if (!verdict || verdict.verified !== true) {
    rejectedCount++
    continue
  }

  verifiedFindings.push({
    id: candidate.id,
    dimension: verdict.dimension,
    file: verdict.file,
    line: verdict.line,
    title: verdict.title,
    severity: verdict.severity,
    confidence: verdict.confidence,
    impact: verdict.impact,
    evidence: verdict.evidence,
    recommendation: verdict.recommendation,
    testRecommendation: verdict.testRecommendation,
    duplicateKey: verdict.duplicateKey,
    originalCandidate: {
      file: candidate.file,
      line: candidate.line,
      title: candidate.title,
      potentialSeverity: candidate.potentialSeverity,
    },
  })
}

log(`Verified findings: ${verifiedFindings.length}; rejected candidates: ${rejectedCount}.`)

phase('Synthesize prioritized review')

let finalReview

if (!files.length) {
  finalReview =
    '# Code Review\n\nNo changed files were available to review. Provide `args.changedFiles` / `args.files`, or configure `baseRef` and `headRef` so the workflow can discover the diff.'
} else {
  const synthesis = await agent(
    `Synthesize the final code review from verified findings only.

Context:
- Reviewed files (${files.length}):
${files.map((f) => `  - ${f}`).join('\n')}
- Dimensions reviewed: correctness, security, performance, style / maintainability, missing tests.
- Candidate findings discovered: ${candidates.length}
- Candidate findings rejected during verification: ${rejectedCount}

Verified findings JSON:
${JSON.stringify(verifiedFindings, null, 2)}

Requirements:
- Produce a single prioritized Markdown review.
- Include only verified findings from the JSON. Do not resurrect rejected or speculative issues.
- Deduplicate findings that share the same duplicateKey or root cause.
- Sort by severity: critical, high, medium, low. Within severity, put security/correctness before performance, tests, then style unless impact suggests otherwise.
- For each finding include:
  - severity
  - dimension
  - file:line
  - concise title
  - why it matters / impact
  - evidence from the code or diff
  - recommended fix
  - recommended test coverage when relevant
- If there are no verified findings, say so clearly and briefly.
- End with a short review summary containing counts by severity and dimension.`,
    compactOpts({
      label: 'synthesize-review',
      phase: 'Synthesize prioritized review',
      model: synthesisModel,
      effort: synthesisEffort,
    })
  )

  finalReview = synthesis || fallbackReview(verifiedFindings, rejectedCount, files)
}

log('Code-review swarm complete.')
finalReview
```

> **GPT-5.5 judge:** The workflow has some lean/capped schemas and a max file count, and it is somewhat null-tolerant when consuming completed finder/verifier results. However, it uses two large hard-barrier parallel() calls over all review targets and all candidates, with no bounded waves, no per-agent retry/catch handling, no ScheduleWakeup watchdog, no per-wave checkpoint/commit, no resume/cache mechanism, no high-failure-rate backoff, and synthesis does not explicitly flag partial gaps. A hung or failed subagent could deadlock or abort the whole run and lose completed work visibility.

## With skill — rubric 84%, patterns 94%

```js
export const meta = {
  name: 'code-review-swarm',
  description: 'Review changed files across correctness, security, performance, style, and missing-test dimensions; verify candidates; synthesize prioritized review.',
  phases: [
    { title: 'Discover changed files' },
    { title: 'Find candidate findings' },
    { title: 'Verify candidates' },
    { title: 'Synthesize prioritized review' },
  ],
}

/*
After launching this workflow, arm the external stall watchdog with the returned runId/scriptPath/taskId:

ScheduleWakeup({ delaySeconds: 1200, reason: "watchdog: swarm wf_<runId> may stall silently; check journal mtime",
  prompt: "Watchdog for run wf_<runId>: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel." })
*/

const input = args || {}

const WAVE_SIZE = Number.isInteger(input.waveSize) && input.waveSize >= 2 && input.waveSize <= 8
  ? input.waveSize
  : 6

const DIMENSIONS = [
  {
    key: 'correctness',
    title: 'Correctness bugs',
    priority: 1,
    instruction:
      'Find concrete functional bugs, broken edge cases, regressions, incorrect assumptions, race/order bugs, API misuse, and error-handling problems introduced or exposed by the change.',
  },
  {
    key: 'security',
    title: 'Security',
    priority: 0,
    instruction:
      'Find concrete vulnerabilities or hardening regressions: authz/authn bypass, injection, unsafe deserialization, secrets leakage, path traversal, SSRF, XSS/CSRF, crypto misuse, insecure defaults, unsafe logging, dependency/supply-chain risk.',
  },
  {
    key: 'performance',
    title: 'Performance',
    priority: 2,
    instruction:
      'Find material performance regressions: avoidable N+1 work, unbounded loops/memory, excessive I/O, inefficient queries, sync blocking in hot paths, cache invalidation mistakes, algorithmic regressions, and scalability limits.',
  },
  {
    key: 'style',
    title: 'Style / maintainability',
    priority: 4,
    instruction:
      'Find maintainability issues that are worth a review comment under this repository’s conventions: confusing structure, duplicated logic, naming/API clarity, inconsistent patterns, brittle abstractions, dead code, or formatting/lint issues only if non-trivial.',
  },
  {
    key: 'missing_tests',
    title: 'Missing tests',
    priority: 3,
    instruction:
      'Find meaningful missing or weakened tests for changed behavior, bug-prone branches, security-sensitive paths, migrations, public APIs, and regressions. Confirm whether relevant tests already exist before reporting.',
  },
]

const DIMENSION_KEYS = DIMENSIONS.map(d => d.key)

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['item_key', 'file', 'dimension', 'review_notes', 'candidates'],
  properties: {
    item_key: { type: 'string', maxLength: 400 },
    file: { type: 'string', maxLength: 500 },
    dimension: { type: 'string', enum: DIMENSION_KEYS },
    review_notes: { type: 'string', maxLength: 600 },
    candidates: {
      type: 'array',
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'severity_guess', 'line_range', 'evidence', 'rationale', 'recommendation'],
        properties: {
          title: { type: 'string', maxLength: 160 },
          severity_guess: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'nit'] },
          line_range: { type: 'string', maxLength: 80 },
          evidence: { type: 'string', maxLength: 700 },
          rationale: { type: 'string', maxLength: 900 },
          recommendation: { type: 'string', maxLength: 700 },
        },
      },
    },
  },
}

const DISCOVERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['base_ref', 'files'],
  properties: {
    base_ref: { type: 'string', maxLength: 200 },
    files: {
      type: 'array',
      maxItems: 28,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'status', 'diff_summary'],
        properties: {
          path: { type: 'string', maxLength: 500 },
          status: { type: 'string', maxLength: 80 },
          diff_summary: { type: 'string', maxLength: 500 },
        },
      },
    },
  },
}

const VERIFICATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'candidate_key',
    'file',
    'dimension',
    'verdict',
    'severity',
    'confidence',
    'line_range',
    'title',
    'evidence',
    'rationale',
    'recommendation',
  ],
  properties: {
    candidate_key: { type: 'string', maxLength: 500 },
    file: { type: 'string', maxLength: 500 },
    dimension: { type: 'string', enum: DIMENSION_KEYS },
    verdict: { type: 'string', enum: ['confirmed', 'false_positive', 'needs_more_info'] },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'nit'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    line_range: { type: 'string', maxLength: 80 },
    title: { type: 'string', maxLength: 180 },
    evidence: { type: 'string', maxLength: 900 },
    rationale: { type: 'string', maxLength: 1000 },
    recommendation: { type: 'string', maxLength: 900 },
  },
}

const SYNTHESIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['overall_risk', 'summary', 'counts', 'prioritized_findings', 'gaps', 'review_comment_markdown'],
  properties: {
    overall_risk: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'none'] },
    summary: { type: 'string', maxLength: 2000 },
    counts: {
      type: 'object',
      additionalProperties: false,
      required: ['critical', 'high', 'medium', 'low', 'nit', 'confirmed_total', 'not_included_total'],
      properties: {
        critical: { type: 'integer', minimum: 0 },
        high: { type: 'integer', minimum: 0 },
        medium: { type: 'integer', minimum: 0 },
        low: { type: 'integer', minimum: 0 },
        nit: { type: 'integer', minimum: 0 },
        confirmed_total: { type: 'integer', minimum: 0 },
        not_included_total: { type: 'integer', minimum: 0 },
      },
    },
    prioritized_findings: {
      type: 'array',
      maxItems: 60,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'dimension', 'file', 'line_range', 'title', 'evidence', 'recommendation'],
        properties: {
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'nit'] },
          dimension: { type: 'string', enum: DIMENSION_KEYS },
          file: { type: 'string', maxLength: 500 },
          line_range: { type: 'string', maxLength: 80 },
          title: { type: 'string', maxLength: 180 },
          evidence: { type: 'string', maxLength: 900 },
          recommendation: { type: 'string', maxLength: 900 },
        },
      },
    },
    gaps: {
      type: 'array',
      maxItems: 80,
      items: { type: 'string', maxLength: 300 },
    },
    review_comment_markdown: { type: 'string', maxLength: 30000 },
  },
}

function truncate(value, max) {
  const s = value == null ? '' : String(value)
  return s.length <= max ? s : s.slice(0, max) + '\n[TRUNCATED: inspect repository/diff directly if needed]'
}

function stablePathCompare(a, b) {
  return a.path === b.path ? 0 : a.path > b.path ? 1 : -1
}

function stableStringCompare(a, b) {
  return a === b ? 0 : a > b ? 1 : -1
}

function normalizeFileList(raw) {
  const source = Array.isArray(raw) ? raw : []
  const byPath = new Map()

  for (const entry of source) {
    let file
    if (typeof entry === 'string') {
      file = { path: entry, status: '', diff: '', diff_summary: '' }
    } else if (entry && typeof entry === 'object') {
      const path = String(entry.path || entry.file || entry.filename || entry.name || '')
      file = {
        path,
        status: String(entry.status || entry.changeType || entry.change_type || ''),
        diff: truncate(entry.diff || entry.patch || '', 12000),
        diff_summary: truncate(entry.diff_summary || entry.summary || '', 800),
      }
    } else {
      continue
    }

    file.path = file.path.trim()
    if (!file.path) continue
    if (!byPath.has(file.path)) byPath.set(file.path, file)
  }

  return Array.from(byPath.values()).sort(stablePathCompare)
}

function label(prefix, raw) {
  return `${prefix}:${String(raw).replace(/[^A-Za-z0-9_.:/-]+/g, '_').slice(0, 90)}`
}

function chunk(items, n) {
  const out = []
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n))
  return out
}

function severityRank(sev) {
  return ({ critical: 0, high: 1, medium: 2, low: 3, nit: 4 })[sev] ?? 5
}

function dimensionRank(dim) {
  const found = DIMENSIONS.find(d => d.key === dim)
  return found ? found.priority : 99
}

function sortVerified(a, b) {
  const sr = severityRank(a.severity) - severityRank(b.severity)
  if (sr) return sr
  const dr = dimensionRank(a.dimension) - dimensionRank(b.dimension)
  if (dr) return dr
  const fp = stableStringCompare(a.file, b.file)
  if (fp) return fp
  const lr = stableStringCompare(a.line_range || '', b.line_range || '')
  if (lr) return lr
  return stableStringCompare(a.title || '', b.title || '')
}

async function runInSafeWaves(items, runOne, phaseTitle, noun) {
  const done = []
  let failed = []
  let stoppedEarly = false
  let processed = 0
  const waves = chunk(items, WAVE_SIZE)

  for (let w = 0; w < waves.length; w++) {
    const wave = waves[w]
    phase(`${phaseTitle} wave ${w + 1}/${waves.length}`)
    log(`${phaseTitle}: launching ${noun} wave ${w + 1}/${waves.length} (${wave.length} agents)`)

    const batch = await parallel(wave.map(it => () => runOne(it)))
    const nulls = batch.filter(r => r === null).length

    batch.forEach((result, i) => {
      if (result) done.push(result)
      else failed.push(wave[i])
    })

    processed += wave.length
    log(`${phaseTitle}: wave ${w + 1} complete; ${done.length}/${items.length} ${noun} ok, ${failed.length} failed/unverified so far`)

    if (nulls / wave.length > 0.4) {
      log(`instability: ${nulls}/${wave.length} failed this wave — backing off; return partial, resume later`)
      stoppedEarly = true
      failed = failed.concat(items.slice(processed))
      break
    }
  }

  if (failed.length && !stoppedEarly) {
    phase(`${phaseTitle} retry`)
    const retryItems = failed
    failed = []
    const retryWaves = chunk(retryItems, WAVE_SIZE)

    for (let w = 0; w < retryWaves.length; w++) {
      const wave = retryWaves[w]
      log(`${phaseTitle}: retry wave ${w + 1}/${retryWaves.length} (${wave.length} agents)`)
      const batch = await parallel(wave.map(it => () => runOne(it)))
      const nulls = batch.filter(r => r === null).length

      batch.forEach((result, i) => {
        if (result) done.push(result)
        else failed.push(wave[i])
      })

      log(`${phaseTitle}: retry wave ${w + 1} recovered ${batch.filter(Boolean).length}; still missing ${failed.length}`)

      if (nulls / wave.length > 0.4) {
        log(`instability: ${nulls}/${wave.length} failed in retry wave — backing off; return partial, resume later`)
        stoppedEarly = true
        failed = failed.concat(retryItems.slice((w + 1) * WAVE_SIZE))
        break
      }
    }
  }

  return { done, failed, stoppedEarly }
}

async function discoverChangedFilesIfNeeded() {
  const provided = normalizeFileList(input.changedFiles || input.changed_files || input.files)
  if (provided.length) return provided

  phase('Discover changed files')
  const baseRef = String(input.baseRef || input.base_ref || input.base || 'the repository default comparison base')
  const discovery = await agent(
    `Discover the changed files for a code review swarm.

Use the repository state and git information available to you. Prefer the caller's base ref if meaningful: ${baseRef}

Return up to 28 changed source/config/test/documentation files that should be reviewed. Exclude generated artifacts, lockfiles, vendored dependencies, build outputs, and binary files unless the change itself is review-worthy.

For each file, provide:
- path
- status such as added/modified/deleted/renamed
- one short diff summary

Do not perform the review; only identify files.`,
    {
      label: 'discover:changed-files',
      phase: 'Discover changed files',
      schema: DISCOVERY_SCHEMA,
      effort: 'low',
    },
  )

  if (!discovery || !Array.isArray(discovery.files)) return []
  return normalizeFileList(discovery.files)
}

const files = await discoverChangedFilesIfNeeded()

if (!files.length) {
  log('No changed files were provided or discovered; returning empty review.')
  return {
    files_reviewed: [],
    dimensions: DIMENSION_KEYS,
    candidate_count: 0,
    verified_count: 0,
    included_findings: [],
    gaps: ['No changed files were provided or discoverable.'],
    synthesis: null,
    review_comment_markdown: 'No changed files were provided or discoverable.',
  }
}

if (files.length !== 28) {
  log(`Expected 28 changed files for this review swarm; proceeding with ${files.length} file(s).`)
} else {
  log('Review swarm will cover 28 changed files across 5 dimensions.')
}

const reviewItems = []
for (const file of files) {
  for (const dim of DIMENSIONS) {
    reviewItems.push({
      key: `${file.path}::${dim.key}`,
      file,
      dimension: dim,
    })
  }
}

const reviewItemByKey = new Map(reviewItems.map(it => [it.key, it]))

function buildFinderPrompt(item) {
  const fileInfo = {
    path: item.file.path,
    status: item.file.status || '',
    diff_summary: item.file.diff_summary || '',
    supplied_diff_excerpt: item.file.diff || '',
  }

  return `You are one focused code-review finder agent.

Review exactly this changed file for exactly one dimension.

FILE:
${JSON.stringify(fileInfo, null, 2)}

DIMENSION:
${item.dimension.title} (${item.dimension.key})

DIMENSION-SPECIFIC INSTRUCTIONS:
${item.dimension.instruction}

REVIEW RULES:
- Inspect the current repository and the relevant git diff for this file. If a supplied diff excerpt is truncated or absent, use repository tools/git diff directly.
- Report only issues that are introduced by, changed by, or made newly relevant by this change.
- Prefer concrete, actionable findings over speculative concerns.
- Do not include praise, summaries, or generic advice.
- Return at most 2 high-signal candidate findings for this file/dimension.
- Use short evidence: exact file/line/symbol plus one concise explanation. Do not paste long code blocks.
- If no worthwhile candidate exists, return an empty candidates array.
- These are only CANDIDATES. A separate verifier will try to disprove each one.

Set item_key exactly to: ${item.key}
Set file exactly to: ${item.file.path}
Set dimension exactly to: ${item.dimension.key}`
}

async function runFinder(item) {
  return agent(buildFinderPrompt(item), {
    label: label('find', item.key),
    phase: 'Find candidate findings',
    schema: FINDINGS_SCHEMA,
    effort: item.dimension.key === 'style' ? 'medium' : 'high',
  })
}

const findRun = await runInSafeWaves(reviewItems, runFinder, 'Find candidate findings', 'finder result')

const candidateItems = []
for (const result of findRun.done) {
  const item = reviewItemByKey.get(result.item_key) || {
    key: result.item_key || `${result.file}::${result.dimension}`,
    file: { path: result.file, status: '', diff: '', diff_summary: '' },
    dimension: DIMENSIONS.find(d => d.key === result.dimension) || { key: result.dimension, title: result.dimension, instruction: '' },
  }

  const candidates = Array.isArray(result.candidates) ? result.candidates : []
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    candidateItems.push({
      key: `${item.key}::candidate-${i + 1}`,
      file: result.file || item.file.path,
      file_status: item.file.status || '',
      dimension: result.dimension || item.dimension.key,
      title: c.title,
      severity_guess: c.severity_guess,
      line_range: c.line_range,
      evidence: c.evidence,
      rationale: c.rationale,
      recommendation: c.recommendation,
    })
  }
}

candidateItems.sort((a, b) => stableStringCompare(a.key, b.key))
log(`Find phase produced ${candidateItems.length} candidate finding(s) from ${findRun.done.length}/${reviewItems.length} completed file-dimension reviews.`)

function buildVerifierPrompt(candidate) {
  const payload = {
    candidate_key: candidate.key,
    file: candidate.file,
    file_status: candidate.file_status,
    dimension: candidate.dimension,
    title: candidate.title,
    severity_guess: candidate.severity_guess,
    line_range: candidate.line_range,
    evidence_claim: candidate.evidence,
    finder_rationale: candidate.rationale,
    proposed_recommendation: candidate.recommendation,
  }

  return `You are an independent verifier for a code-review swarm.

Your job is to verify or reject ONE candidate finding. Try to disprove it.

CANDIDATE:
${JSON.stringify(payload, null, 2)}

VERIFICATION RULES:
- Inspect the current repository, the changed file, related call sites, and relevant tests.
- Confirm only if the issue is concrete, actionable, and introduced/exposed by this change.
- Mark false_positive if the claim is wrong, already handled, not introduced by the change, too speculative, or not worth a review comment.
- Mark needs_more_info only when the claim may be real but cannot be verified from the available repository state.
- For missing_tests: confirm only if changed behavior or a risk path lacks meaningful test coverage after checking nearby tests.
- For style: confirm only if it materially harms maintainability or clearly violates local conventions.
- Reassess severity independently. Severity definitions:
  - critical: likely exploit/data loss/outage or severe correctness break
  - high: serious bug/security risk/perf regression with plausible production impact
  - medium: real issue with bounded impact or important missing test
  - low: minor but actionable issue
  - nit: trivial style-only issue
- Keep evidence short and specific. No long quotes.

Set candidate_key exactly to: ${candidate.key}
Set file exactly to: ${candidate.file}
Set dimension exactly to: ${candidate.dimension}`
}

async function runVerifier(candidate) {
  const effort =
    candidate.dimension === 'security' || candidate.dimension === 'correctness'
      ? 'high'
      : 'medium'

  return agent(buildVerifierPrompt(candidate), {
    label: label('verify', candidate.key),
    phase: 'Verify candidates',
    schema: VERIFICATION_SCHEMA,
    effort,
  })
}

let verifyRun = { done: [], failed: [], stoppedEarly: false }
if (candidateItems.length) {
  verifyRun = await runInSafeWaves(candidateItems, runVerifier, 'Verify candidates', 'verification result')
} else {
  log('No candidate findings to verify.')
}

const verifiedResults = verifyRun.done.slice().sort(sortVerified)
const includedFindings = verifiedResults
  .filter(v => v.verdict === 'confirmed')
  .sort(sortVerified)

const notIncluded = verifiedResults.filter(v => v.verdict !== 'confirmed')
const missingFindReviews = findRun.failed.map(it => `Finder did not complete: ${it.file.path} [${it.dimension.key}]`)
const missingVerifications = verifyRun.failed.map(c => `Verifier did not complete: ${c.file} [${c.dimension}] ${c.title}`)
const partialGaps = missingFindReviews.concat(missingVerifications)

if (partialGaps.length) {
  log(`Partial review: ${partialGaps.length} gap(s) will be reported explicitly.`)
}

function countSeverities(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, nit: 0 }
  for (const f of findings) {
    if (Object.prototype.hasOwnProperty.call(counts, f.severity)) counts[f.severity]++
  }
  return counts
}

function compactFindingForPrompt(f) {
  return {
    severity: f.severity,
    confidence: f.confidence,
    dimension: f.dimension,
    file: f.file,
    line_range: f.line_range,
    title: f.title,
    evidence: f.evidence,
    rationale: f.rationale,
    recommendation: f.recommendation,
  }
}

const sortedIncluded = includedFindings.sort(sortVerified)
const synthesisInputCap = Number.isInteger(input.synthesisInputCap) && input.synthesisInputCap > 0
  ? input.synthesisInputCap
  : 140
const synthesisFindings = sortedIncluded.slice(0, synthesisInputCap)
const omittedConfirmedForSynthesis = sortedIncluded.slice(synthesisInputCap)

function fallbackMarkdown(findings, gaps) {
  if (!findings.length) {
    const gapText = gaps.length ? `\n\nGaps / incomplete coverage:\n${gaps.map(g => `- ${g}`).join('\n')}` : ''
    return `## Code review summary\n\nNo verified findings were confirmed by the swarm.${gapText}`
  }

  const lines = ['## Code review summary', '', `Confirmed findings: ${findings.length}`, '']
  for (const f of findings.slice(0, 60)) {
    lines.push(`### ${f.severity.toUpperCase()} — ${f.title}`)
    lines.push(`- Dimension: ${f.dimension}`)
    lines.push(`- Location: ${f.file}${f.line_range ? `:${f.line_range}` : ''}`)
    lines.push(`- Evidence: ${f.evidence}`)
    lines.push(`- Recommendation: ${f.recommendation}`)
    lines.push('')
  }
  if (gaps.length) {
    lines.push('## Gaps / incomplete coverage')
    for (const g of gaps.slice(0, 80)) lines.push(`- ${g}`)
  }
  return lines.join('\n')
}

phase('Synthesize prioritized review')

const severityCounts = countSeverities(includedFindings)
const synthesisPayload = {
  files_reviewed: files.map(f => ({ path: f.path, status: f.status || '' })),
  dimensions: DIMENSION_KEYS,
  finder_results_completed: findRun.done.length,
  finder_results_expected: reviewItems.length,
  candidates_found: candidateItems.length,
  verification_results_completed: verifyRun.done.length,
  verification_results_expected: candidateItems.length,
  confirmed_count: includedFindings.length,
  not_included_count: notIncluded.length,
  severity_counts: severityCounts,
  confirmed_findings_for_synthesis: synthesisFindings.map(compactFindingForPrompt),
  omitted_confirmed_due_to_prompt_cap: omittedConfirmedForSynthesis.length,
  not_included_summary: notIncluded.slice(0, 80).map(v => ({
    verdict: v.verdict,
    severity: v.severity,
    dimension: v.dimension,
    file: v.file,
    line_range: v.line_range,
    title: v.title,
    rationale: v.rationale,
  })),
  gaps: partialGaps.slice(0, 120),
}

const synthesis = await agent(
  `Synthesize a single prioritized code review from VERIFIED findings only.

INPUT DATA:
${JSON.stringify(synthesisPayload, null, 2)}

REQUIREMENTS:
- Include only findings whose verifier verdict is confirmed.
- Do not include false_positive or needs_more_info items as findings; mention important uncertainty only in gaps.
- Prioritize by severity first, then security/correctness, then blast radius.
- Provide severity levels for every included finding.
- Produce a concise review suitable to paste into a pull request.
- Group or merge duplicates if they are truly the same issue, but do not hide distinct files/risks.
- Explicitly report coverage gaps from incomplete finder/verifier agents.
- If omitted_confirmed_due_to_prompt_cap > 0, say that lower-priority confirmed findings were omitted from the synthesized prompt and should be read from workflow results.
- Keep recommendations actionable and specific.`,
  {
    label: 'synthesize:prioritized-review',
    phase: 'Synthesize prioritized review',
    schema: SYNTHESIS_SCHEMA,
    effort: 'high',
  },
)

const fallback = fallbackMarkdown(includedFindings, partialGaps)

return {
  files_reviewed: files.map(f => ({ path: f.path, status: f.status || '', diff_summary: f.diff_summary || '' })),
  dimensions: DIMENSION_KEYS,
  finder_reviews_expected: reviewItems.length,
  finder_reviews_completed: findRun.done.length,
  finder_reviews_missing: findRun.failed.map(it => ({ file: it.file.path, dimension: it.dimension.key })),
  candidate_count: candidateItems.length,
  verification_expected: candidateItems.length,
  verification_completed: verifyRun.done.length,
  verification_missing: verifyRun.failed.map(c => ({ key: c.key, file: c.file, dimension: c.dimension, title: c.title })),
  confirmed_count: includedFindings.length,
  not_included_count: notIncluded.length,
  severity_counts: {
    ...severityCounts,
    confirmed_total: includedFindings.length,
    not_included_total: notIncluded.length,
  },
  included_findings: includedFindings,
  not_included_verified_candidates: notIncluded,
  gaps: partialGaps,
  partial: Boolean(findRun.stoppedEarly || verifyRun.stoppedEarly || partialGaps.length),
  synthesis,
  review_comment_markdown: synthesis ? synthesis.review_comment_markdown : fallback,
  watchdog_reminder:
    'If this workflow is still running after 20 minutes without journal growth, TaskStop it and resume with Workflow({scriptPath, resumeFromRunId}); re-arm the one-shot ScheduleWakeup watchdog after launch/resume.',
}
```

> **GPT-5.5 judge:** The script meets most of the safety bar: it uses bounded waves with a default size of 6 and max 8, retries failed/null agent results, accumulates completed work wave-by-wave, uses capped schemas and truncated payloads, synthesizes from partial verified results, explicitly reports finder/verifier gaps, and backs off when a wave has >40% failures. It also includes a clear ScheduleWakeup watchdog instruction and resume guidance. Remaining weaknesses: the watchdog is only documented/commented rather than actually armed by the workflow, a single hung agent can still block the current wave until the external watchdog intervenes, failures are treated as null only if the orchestration runtime returns null rather than throwing, and there is no explicit persistent checkpoint/cache beyond stable labels/prompts and normal workflow journaling. Overall it is substantially safe for large parallel fan-out but not fully self-contained against hangs.

