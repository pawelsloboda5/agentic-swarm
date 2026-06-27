# code-review-swarm — `gpt-5.4-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a CODE-REVIEW SWARM: review 28 changed files across five dimensions (correctness bugs, security, performance, style, missing tests). Spawn agents to find issues, then verify each candidate finding before including it, and synthesize a single prioritized review with severity levels.

---

## Baseline (no skill) — rubric 25%, patterns 50%

```js
export const meta = {
  name: 'code-review-swarm',
  description:
    'Review 28 changed files across correctness, security, performance, style, and missing tests; verify findings and synthesize a prioritized review.',
  phases: [
    { title: 'Ingest' },
    { title: 'Find Candidates' },
    { title: 'Verify Findings' },
    { title: 'Synthesize Review' },
  ],
}

const input = args ?? {}
const changedFiles = Array.isArray(input.changedFiles) ? input.changedFiles : []
const diffContext = input.diffContext ?? ''
const repoContext = input.repoContext ?? ''
const reviewScope = input.reviewScope ?? 'changed files only'

function chunk(array, size) {
  const out = []
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size))
  return out
}

function normalizeFinding(f) {
  if (!f) return null
  const severity = String(f.severity ?? 'medium').toLowerCase()
  return {
    file: f.file ?? f.path ?? null,
    title: f.title ?? f.summary ?? null,
    description: f.description ?? f.details ?? null,
    dimension: f.dimension ?? f.category ?? null,
    severity,
    rationale: f.rationale ?? null,
    evidence: f.evidence ?? null,
    recommendation: f.recommendation ?? null,
  }
}

function severityRank(sev) {
  const s = String(sev ?? '').toLowerCase()
  if (s === 'critical') return 0
  if (s === 'high') return 1
  if (s === 'medium') return 2
  if (s === 'low') return 3
  return 4
}

phase('Ingest')
log(`Reviewing ${changedFiles.length} changed files with scope: ${reviewScope}`)

const fileBatches = chunk(changedFiles.length ? changedFiles : ['<no files provided>'], 7)

phase('Find Candidates')
const candidateBatches = await parallel(
  fileBatches.map((batch, batchIndex) => async () => {
    const prompt = `
You are a code-review specialist in a swarm. Review the following changed files and identify ONLY candidate issues.
Focus on five dimensions:
1) correctness bugs
2) security vulnerabilities
3) performance regressions
4) style / maintainability problems
5) missing tests / weak test coverage

Instructions:
- Be concrete and file-specific.
- Prefer fewer, high-signal findings over many speculative ones.
- For each candidate, include: file, dimension, severity, title, description, rationale, and evidence from the diff/context.
- Severity should be one of: critical, high, medium, low.
- Do not include duplicates.
- Do not invent issues without support from the provided context.
- If a file is clearly fine, say nothing about it.

Repository context:
${repoContext}

Diff/context:
${diffContext}

Files in this batch:
${batch.map((f, i) => `${batchIndex * 7 + i + 1}. ${typeof f === 'string' ? f : JSON.stringify(f)}`).join('\n')}

Return a JSON array of candidate findings.
`
    const res = await agent(prompt, {
      label: `candidate-batch-${batchIndex + 1}`,
      phase: 'Find Candidates',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true,
          properties: {
            file: { type: 'string' },
            dimension: { type: 'string' },
            severity: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            rationale: { type: 'string' },
            evidence: { type: 'string' },
            recommendation: { type: 'string' },
          },
          required: ['title', 'dimension', 'severity'],
        },
      },
      effort: 'high',
    })
    return Array.isArray(res) ? res.map(normalizeFinding).filter(Boolean) : []
  })
)

const candidates = candidateBatches.flat()

phase('Verify Findings')
const verified = await parallel(
  candidates.map((finding, idx) => async () => {
    const prompt = `
You are a strict verifier for code-review findings.

Goal:
Determine whether the candidate finding is supported by the provided repository context and diff, and whether it should be included in the final review.

Rules:
- Verify conservatively: if evidence is weak, mark as rejected.
- Require direct support in the diff/context for the claimed issue.
- Reject duplicates or overly vague findings.
- If the issue depends on unseen code, reject unless the provided context is enough to confirm.
- If accepted, preserve file, dimension, severity, title, description, evidence, and recommendation.
- If rejected, return accepted=false and a brief reason.

Candidate finding:
${JSON.stringify(finding, null, 2)}

Repository context:
${repoContext}

Diff/context:
${diffContext}

Return JSON with:
{
  "accepted": boolean,
  "reason": string,
  "finding"?: { ...approved finding fields... }
}
`
    const res = await agent(prompt, {
      label: `verify-${idx + 1}`,
      phase: 'Verify Findings',
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          accepted: { type: 'boolean' },
          reason: { type: 'string' },
          finding: {
            type: 'object',
            additionalProperties: true,
          },
        },
        required: ['accepted', 'reason'],
      },
      effort: 'high',
    })

    if (!res || !res.accepted || !res.finding) return null
    return normalizeFinding(res.finding)
  })
)

const approved = verified.filter(Boolean)
approved.sort((a, b) => severityRank(a.severity) - severityRank(b.severity))

phase('Synthesize Review')
const synthesis = await agent(
  `
You are the final code-review synthesizer for a swarm review.

Task:
Produce a single prioritized review from the verified findings below.
Requirements:
- Group findings by severity: critical, high, medium, low.
- Prioritize by severity, then by user impact and confidence.
- Keep the review concise but actionable.
- Mention the affected file for each finding.
- Include a short overall assessment at the top.
- If there are no verified findings, say so clearly and note that no blocking issues were found.
- Do not add new findings.
- Include missing tests as findings if verified.
- Output in Markdown.

Verified findings:
${JSON.stringify(approved, null, 2)}
`,
  {
    label: 'final-synthesis',
    phase: 'Synthesize Review',
    effort: 'high',
  }
)

return {
  summary: {
    changedFiles: changedFiles.length,
    candidateCount: candidates.length,
    verifiedCount: approved.length,
  },
  findings: approved,
  review: synthesis,
}
```

> **Claude judge:** The script has deterministic prompts and basic null-tolerance, but the verification phase fans out over all candidates with no bounding, there is no retry logic, no stall watchdog, no per-wave result commits, and no backoff on high failure rates—leaving it vulnerable to both silent work loss and hung-connection deadlock with no recovery path.

## With skill — rubric 78%, patterns 81%

```js
export const meta = {
  name: 'code-review-swarm',
  description: 'Review 28 changed files across five dimensions, verify candidate findings, and synthesize a prioritized review.',
  phases: [{ title: 'Find' }, { title: 'Verify' }, { title: 'Synthesize' }],
}

// Args shape expected:
// {
//   changedFiles: [{ path: string, diff?: string, summary?: string }],
//   repoContext?: string,
//   reviewFocus?: string,
//   maxFindingsPerFile?: number
// }

const WAVE_SIZE = 7
const DIMENSIONS = [
  'correctness bugs',
  'security issues',
  'performance problems',
  'style / maintainability issues',
  'missing tests',
]

const FINDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    file: { type: 'string' },
    dimension: { type: 'string' },
    title: { type: 'string' },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    location: { type: 'string' },
    evidence: { type: 'string' },
    rationale: { type: 'string' },
    suggestedFix: { type: 'string' },
  },
  required: ['file', 'dimension', 'title', 'severity', 'confidence', 'location', 'evidence', 'rationale', 'suggestedFix'],
}

const VERIFIED_FINDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    file: { type: 'string' },
    dimension: { type: 'string' },
    title: { type: 'string' },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    location: { type: 'string' },
    evidence: { type: 'string' },
    rationale: { type: 'string' },
    suggestedFix: { type: 'string' },
    verification: {
      type: 'string',
      enum: ['confirmed', 'rejected', 'needs-more-context'],
    },
    verificationNotes: { type: 'string' },
  },
  required: [
    'file',
    'dimension',
    'title',
    'severity',
    'confidence',
    'location',
    'evidence',
    'rationale',
    'suggestedFix',
    'verification',
    'verificationNotes',
  ],
}

const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const changedFiles = Array.isArray(args?.changedFiles) ? args.changedFiles : []
const repoContext = args?.repoContext ? String(args.repoContext) : ''
const reviewFocus = args?.reviewFocus ? String(args.reviewFocus) : ''
const maxFindingsPerFile = Number.isFinite(args?.maxFindingsPerFile) ? args.maxFindingsPerFile : 3

function buildFindPrompt(file) {
  return [
    `You are reviewing one changed file in a code review swarm.`,
    `Find candidate issues across exactly these dimensions:`,
    ...DIMENSIONS.map(d => `- ${d}`),
    ``,
    `File path: ${file.path}`,
    file.summary ? `File summary: ${file.summary}` : '',
    file.diff ? `Diff:\n${file.diff}` : '',
    repoContext ? `Repo context:\n${repoContext}` : '',
    reviewFocus ? `Review focus:\n${reviewFocus}` : '',
    ``,
    `Task: identify at most ${maxFindingsPerFile} candidate findings total for this file.`,
    `Prefer concrete, actionable issues with precise evidence from the diff or context.`,
    `Keep each candidate short and specific.`,
    `Return only findings that look plausible enough to verify.`,
  ].filter(Boolean).join('\n')
}

function buildVerifyPrompt(candidate) {
  return [
    `You are verifying one candidate code review finding.`,
    `Decide whether it is truly present and report only what is supported.`,
    ``,
    `Candidate finding:`,
    JSON.stringify(candidate, null, 2),
    ``,
    `Verification rules:`,
    `- confirmed: the issue is clearly supported by the code/context`,
    `- rejected: the issue is not supported or is speculative`,
    `- needs-more-context: plausibly real but cannot be confirmed from provided context`,
    ``,
    `If confirmed, keep severity only if justified; otherwise lower it.`,
    `Return a concise verification note with the strongest supporting evidence or the reason it fails.`,
  ].join('\n')
}

function buildSynthesisPrompt(verifiedFindings, missingFiles) {
  const payload = {
    totalFiles: changedFiles.length,
    reviewedFiles: [...new Set(verifiedFindings.map(f => f.file))].sort(),
    missingFiles: missingFiles.slice().sort(),
    findings: verifiedFindings.slice().sort((a, b) => {
      const sevRank = { critical: 0, high: 1, medium: 2, low: 3 }
      if (sevRank[a.severity] !== sevRank[b.severity]) return sevRank[a.severity] - sevRank[b.severity]
      if (a.file !== b.file) return a.file.localeCompare(b.file)
      return a.title.localeCompare(b.title)
    }),
  }

  return [
    `You are synthesizing a single prioritized code review from verified findings.`,
    `Include severity levels and a concise summary of risk.`,
    `Flag gaps explicitly: any missing files, thin evidence, or areas that need follow-up.`,
    `Do not invent issues. Only use the verified findings provided.`,
    ``,
    `Structured input:`,
    JSON.stringify(payload, null, 2),
    ``,
    `Output format:`,
    `1. Executive summary`,
    `2. Prioritized findings grouped by severity`,
    `3. File coverage / gaps`,
    `4. Recommended next actions`,
  ].join('\n')
}

function normalizeFinding(f) {
  if (!f) return null
  return {
    file: f.file,
    dimension: f.dimension,
    title: f.title,
    severity: f.severity,
    confidence: f.confidence,
    location: f.location,
    evidence: f.evidence,
    rationale: f.rationale,
    suggestedFix: f.suggestedFix,
  }
}

function keyOfFinding(f) {
  return `${f.file}::${f.dimension}::${f.title}`.toLowerCase()
}

function severityRank(sev) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[sev] ?? 4
}

const files = changedFiles.slice(0, 28)
const waves = chunk(files, WAVE_SIZE)

const discovered = []
let failedFiles = []

phase('Find')
for (let w = 0; w < waves.length; w++) {
  const wave = waves[w]
  log(`Find wave ${w + 1}/${waves.length}: ${wave.length} files`)
  const batch = await parallel(
    wave.map(file => () =>
      agent(buildFindPrompt(file), {
        label: `find:${file.path}`,
        phase: 'Find',
        schema: {
          type: 'array',
          maxItems: maxFindingsPerFile,
          items: FINDING_SCHEMA,
        },
        effort: 'medium',
      })
    )
  )

  let nulls = 0
  batch.forEach((res, i) => {
    if (res === null) {
      nulls += 1
      failedFiles.push(wave[i])
      return
    }
    if (Array.isArray(res)) {
      res.map(normalizeFinding).filter(Boolean).forEach(f => discovered.push(f))
    }
  })

  log(`Find wave ${w + 1}: ${discovered.length} candidate findings so far; ${failedFiles.length} files to retry`)

  if (batch.length && nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} failed this wave — backing off; return partial, resume later`)
    break
  }
}

if (failedFiles.length) {
  phase('Retry Find')
  log(`Retrying ${failedFiles.length} files from failed find wave(s)`)
  const retried = await parallel(
    failedFiles.map(file => () =>
      agent(buildFindPrompt(file), {
        label: `find-retry:${file.path}`,
        phase: 'Find',
        schema: {
          type: 'array',
          maxItems: maxFindingsPerFile,
          items: FINDING_SCHEMA,
        },
        effort: 'medium',
      })
    )
  )

  const stillFailed = []
  retried.forEach((res, i) => {
    if (res === null) {
      stillFailed.push(failedFiles[i])
      return
    }
    if (Array.isArray(res)) {
      res.map(normalizeFinding).filter(Boolean).forEach(f => discovered.push(f))
    }
  })
  failedFiles = stillFailed
  log(`Retry Find recovered ${retried.filter(Boolean).length}; still missing ${failedFiles.length}`)
}

const uniqueCandidatesMap = new Map()
for (const f of discovered) {
  if (!f) continue
  if (!uniqueCandidatesMap.has(keyOfFinding(f))) uniqueCandidatesMap.set(keyOfFinding(f), f)
}
const uniqueCandidates = [...uniqueCandidatesMap.values()]

phase('Verify')
const verified = []
let verifyFailed = []
const verifyWaves = chunk(uniqueCandidates, WAVE_SIZE)

for (let w = 0; w < verifyWaves.length; w++) {
  const wave = verifyWaves[w]
  log(`Verify wave ${w + 1}/${verifyWaves.length}: ${wave.length} candidates`)
  const batch = await parallel(
    wave.map(candidate => () =>
      agent(buildVerifyPrompt(candidate), {
        label: `verify:${candidate.file}:${candidate.title}`,
        phase: 'Verify',
        schema: VERIFIED_FINDING_SCHEMA,
        effort: 'high',
      })
    )
  )

  let nulls = 0
  batch.forEach((res, i) => {
    if (res === null) {
      nulls += 1
      verifyFailed.push(wave[i])
      return
    }
    if (res.verification === 'confirmed') {
      verified.push({
        ...normalizeFinding(res),
        verification: res.verification,
        verificationNotes: res.verificationNotes,
      })
    }
  })

  log(`Verify wave ${w + 1}: ${verified.length} confirmed findings so far; ${verifyFailed.length} candidates to retry`)

  if (batch.length && nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} failed this wave — backing off; return partial, resume later`)
    break
  }
}

if (verifyFailed.length) {
  phase('Retry Verify')
  log(`Retrying ${verifyFailed.length} verification candidates`)
  const retried = await parallel(
    verifyFailed.map(candidate => () =>
      agent(buildVerifyPrompt(candidate), {
        label: `verify-retry:${candidate.file}:${candidate.title}`,
        phase: 'Verify',
        schema: VERIFIED_FINDING_SCHEMA,
        effort: 'high',
      })
    )
  )

  const stillFailed = []
  retried.forEach((res, i) => {
    if (res === null) {
      stillFailed.push(verifyFailed[i])
      return
    }
    if (res.verification === 'confirmed') {
      verified.push({
        ...normalizeFinding(res),
        verification: res.verification,
        verificationNotes: res.verificationNotes,
      })
    }
  })
  verifyFailed = stillFailed
  log(`Retry Verify recovered ${retried.filter(Boolean).length}; still missing ${verifyFailed.length}`)
}

const dedupedVerifiedMap = new Map()
for (const f of verified) {
  if (!f) continue
  const k = keyOfFinding(f)
  const existing = dedupedVerifiedMap.get(k)
  if (!existing || severityRank(f.severity) < severityRank(existing.severity)) {
    dedupedVerifiedMap.set(k, f)
  }
}
const dedupedVerified = [...dedupedVerifiedMap.values()].sort((a, b) => {
  const s = severityRank(a.severity) - severityRank(b.severity)
  if (s !== 0) return s
  if (a.file !== b.file) return a.file.localeCompare(b.file)
  return a.title.localeCompare(b.title)
})

const reviewedFiles = new Set(dedupedVerified.map(f => f.file))
const missingFiles = files.filter(f => !reviewedFiles.has(f.path)).map(f => f.path)

phase('Synthesize')
const synthesis = await agent(buildSynthesisPrompt(dedupedVerified, missingFiles), {
  label: 'synthesize-review',
  phase: 'Synthesize',
  effort: 'high',
})

return {
  totalFiles: files.length,
  reviewedFiles: [...reviewedFiles].sort(),
  missingFiles,
  verifiedFindings: dedupedVerified,
  synthesis,
}
```

> **Claude judge:** The script implements bounded waves (size 7), per-agent null-tolerance with retry phases, incremental per-wave result accumulation, deterministic prompts, capped schemas, explicit gap-flagging in synthesis, and high-failure-rate backoff — covering 7 of 8 safety properties well. The sole missing element is an armed ScheduleWakeup stall watchdog, meaning a hung agent connection could deadlock a wave indefinitely with no notification, which prevents a higher score.

