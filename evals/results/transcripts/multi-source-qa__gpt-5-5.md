# multi-source-qa — `gpt-5.5`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for MULTI-SOURCE QA: answer "how did our authentication system change over the last year?" by reading 33 design docs and pull requests. Each source is read by an agent that returns the relevant changes; dedupe across sources; synthesize a cited timeline.

---

## Baseline (no skill) — rubric 25%, patterns 38%

```js
export const meta = {
  name: 'multi-source-auth-qa',
  description: 'Read 33 authentication design docs and pull requests, dedupe changes, and synthesize a cited timeline.',
  phases: [
    { title: 'Collect sources' },
    { title: 'Read sources' },
    { title: 'Dedupe changes' },
    { title: 'Synthesize timeline' },
    { title: 'Audit answer' },
  ],
}

const question =
  args?.question ||
  'How did our authentication system change over the last year?'

const timeframe =
  args?.timeframe ||
  args?.timeWindow ||
  'the last year'

const asOf =
  args?.asOfDate ||
  args?.asOf ||
  'the current conversation date'

const expectedSourceCount =
  Number.isInteger(args?.expectedSourceCount) && args.expectedSourceCount > 0
    ? args.expectedSourceCount
    : 33

function pad2(n) {
  return String(n).padStart(2, '0')
}

function inferKind(value) {
  const s = String(value || '').toLowerCase()
  if (s.includes('pull') || s.includes('/pull/') || s.includes('pr') || /^#?\d+$/.test(s)) {
    return 'pull_request'
  }
  if (s.includes('rfc') || s.includes('design') || s.includes('doc') || s.endsWith('.md')) {
    return 'design_doc'
  }
  return 'unknown'
}

function sourceLocator(raw) {
  if (typeof raw === 'string') return raw
  return (
    raw?.locator ||
    raw?.location ||
    raw?.path ||
    raw?.url ||
    raw?.href ||
    raw?.pr ||
    raw?.pullRequest ||
    raw?.number ||
    raw?.id ||
    ''
  )
}

function normalizeSource(raw, index) {
  const locator = sourceLocator(raw)
  const title =
    typeof raw === 'string'
      ? raw
      : raw?.title || raw?.name || raw?.summary || String(locator || `Source ${index + 1}`)

  return {
    id:
      typeof raw === 'object' && raw?.id
        ? String(raw.id)
        : `S${pad2(index + 1)}`,
    kind:
      typeof raw === 'object' && (raw?.kind || raw?.type)
        ? String(raw.kind || raw.type)
        : inferKind(locator || title),
    title: String(title || `Source ${index + 1}`),
    locator: String(locator || title || ''),
    notes:
      typeof raw === 'object' && raw?.notes
        ? String(raw.notes)
        : '',
  }
}

function coerceProvidedSources(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.map(normalizeSource)
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map(normalizeSource)
  }
  return []
}

const sourceDescriptorSchema = {
  type: 'object',
  required: ['id', 'kind', 'title', 'locator'],
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    kind: {
      type: 'string',
      enum: ['design_doc', 'pull_request', 'unknown'],
    },
    title: { type: 'string' },
    locator: { type: 'string' },
    notes: { type: 'string' },
  },
}

const discoverySchema = {
  type: 'object',
  required: ['sources', 'selectionRationale'],
  additionalProperties: false,
  properties: {
    selectionRationale: { type: 'string' },
    sources: {
      type: 'array',
      minItems: args?.requireExactly33 === false ? 1 : expectedSourceCount,
      maxItems: expectedSourceCount,
      items: sourceDescriptorSchema,
    },
  },
}

phase('Collect sources')

let sources = coerceProvidedSources(args?.sources)

if (sources.length === 0) {
  log(`No source list was provided; discovering ${expectedSourceCount} authentication design docs and pull requests.`)

  const discovered = await agent(
    `You are preparing evidence for a multi-source QA workflow.

Question: ${question}
Timeframe to investigate: ${timeframe}
As-of reference: ${asOf}

Find the ${expectedSourceCount} most relevant source documents and pull requests that should be read to answer how the authentication system changed over the requested timeframe.

Source selection rules:
- Prefer primary sources: design docs, RFCs, architecture decision records, pull requests, release PRs, and migration PRs.
- Include both design intent and implementation changes where possible.
- Focus on authentication: login, session management, tokens, OAuth/OIDC/SAML, MFA, passwordless/passkeys, identity providers, RBAC/authorization only where it directly changed auth flows, account recovery, service-to-service auth, secrets/credential handling, and auth observability/security controls.
- If more than ${expectedSourceCount} candidates exist, choose the ${expectedSourceCount} with the strongest evidence value.
- Return stable locators: file paths for docs; PR numbers/URLs/titles for pull requests.
- Do not summarize the contents yet. Only return the source list.

Return exactly ${expectedSourceCount} sources unless impossible.`,
    {
      label: 'discover-auth-sources',
      phase: 'Collect sources',
      effort: 'high',
      schema: discoverySchema,
    },
  )

  sources = (discovered?.sources || []).map(normalizeSource)
} else {
  log(`Using ${sources.length} source(s) supplied in args.sources.`)
}

if (sources.length !== expectedSourceCount) {
  log(`Expected ${expectedSourceCount} sources, but proceeding with ${sources.length}. The final answer will disclose this coverage.`)
}

const readSchema = {
  type: 'object',
  required: [
    'sourceId',
    'sourceTitle',
    'sourceKind',
    'sourceLocator',
    'readStatus',
    'sourceDate',
    'changes',
    'readerNotes',
  ],
  additionalProperties: false,
  properties: {
    sourceId: { type: 'string' },
    sourceTitle: { type: 'string' },
    sourceKind: { type: 'string' },
    sourceLocator: { type: 'string' },
    readStatus: {
      type: 'string',
      enum: ['read', 'not_found', 'not_relevant', 'ambiguous', 'error'],
    },
    sourceDate: {
      type: 'string',
      description: 'Best available date for the source, such as doc date, PR created/merged date, or unknown.',
    },
    authorsOrOwners: {
      type: 'array',
      items: { type: 'string' },
    },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'localChangeId',
          'changeTitle',
          'changeSummary',
          'changeType',
          'authArea',
          'effectiveDate',
          'status',
          'evidence',
          'dedupeHint',
          'confidence',
        ],
        additionalProperties: false,
        properties: {
          localChangeId: { type: 'string' },
          changeTitle: { type: 'string' },
          changeSummary: { type: 'string' },
          changeType: {
            type: 'string',
            enum: [
              'new_capability',
              'behavior_change',
              'migration',
              'deprecation',
              'security_hardening',
              'operational_change',
              'bugfix_or_regression_fix',
              'documentation_only',
              'unknown',
            ],
          },
          authArea: {
            type: 'string',
            description: 'Subsystem, e.g. sessions, MFA, OIDC, login UI, token service, account recovery.',
          },
          effectiveDate: {
            type: 'string',
            description: 'Best available date or range. Use unknown if not present.',
          },
          status: {
            type: 'string',
            enum: ['proposed', 'approved', 'implemented', 'rolled_out', 'reverted', 'superseded', 'unknown'],
          },
          evidence: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['citation', 'quoteOrParaphrase'],
              additionalProperties: false,
              properties: {
                citation: {
                  type: 'string',
                  description: 'Precise citation, including source id and locator where possible, e.g. S04: docs/auth/rfc.md#session-rotation or S18: PR #1234.',
                },
                quoteOrParaphrase: { type: 'string' },
              },
            },
          },
          dedupeHint: {
            type: 'string',
            description: 'Canonical wording useful for merging this with the same change from another source.',
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
        },
      },
    },
    readerNotes: { type: 'string' },
  },
}

phase('Read sources')
log(`Spawning one reader agent per source (${sources.length} total).`)

const readResults = await parallel(
  sources.map((source, index) => async () => {
    return await agent(
      `You are source reader ${source.id}. Read this one source directly and extract only authentication-system changes relevant to the question.

Question: ${question}
Timeframe: ${timeframe}
As-of reference: ${asOf}

Assigned source:
${JSON.stringify(source, null, 2)}

Instructions:
- Read the assigned design doc or pull request as the primary source.
- If the locator is a PR number/title/URL, inspect PR metadata, description, changed files, review discussion if available, and merge/close status if available.
- If the locator is a design doc path/title, inspect the document and any immediately linked design appendix only when needed to interpret the source.
- Do not use unrelated sources as evidence. If contextual lookup is necessary, mention it in readerNotes, not as evidence.
- Extract concrete changes to the authentication system, not generic project management notes.
- Include changes that were proposed, approved, implemented, rolled out, deprecated, reverted, or superseded.
- Prefer exact dates; otherwise use month/quarter/range; otherwise "unknown".
- Every extracted change must include at least one citation anchored to this source.
- If the source has no auth-relevant changes, return readStatus "not_relevant" with an empty changes array.
- If the source cannot be located, return readStatus "not_found" with an empty changes array.
- Keep each change summary concise but specific enough for cross-source deduplication.
- Return at most 12 changes from this source, prioritizing the most consequential.`,
      {
        label: `read-${source.id}`,
        phase: 'Read sources',
        effort: 'medium',
        schema: readSchema,
      },
    )
  }),
)

const normalizedReadResults = readResults.map((result, index) => {
  if (result) return result
  const source = sources[index]
  return {
    sourceId: source.id,
    sourceTitle: source.title,
    sourceKind: source.kind,
    sourceLocator: source.locator,
    readStatus: 'error',
    sourceDate: 'unknown',
    authorsOrOwners: [],
    changes: [],
    readerNotes: 'Reader agent returned null or failed after runtime retries.',
  }
})

const relevantChangeCount = normalizedReadResults.reduce(
  (sum, result) => sum + (Array.isArray(result.changes) ? result.changes.length : 0),
  0,
)

const readFailures = normalizedReadResults.filter((result) =>
  ['not_found', 'ambiguous', 'error'].includes(result.readStatus),
)

log(`Readers returned ${relevantChangeCount} candidate auth change(s). ${readFailures.length} source(s) had read issues.`)

const dedupeSchema = {
  type: 'object',
  required: ['canonicalChanges', 'droppedAsNotAuthRelevant', 'dedupeNotes'],
  additionalProperties: false,
  properties: {
    canonicalChanges: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'changeId',
          'title',
          'timelineDate',
          'sortKey',
          'summary',
          'authAreas',
          'changeTypes',
          'status',
          'impact',
          'sourceEvidence',
          'mergedLocalChanges',
          'confidence',
        ],
        additionalProperties: false,
        properties: {
          changeId: { type: 'string' },
          title: { type: 'string' },
          timelineDate: {
            type: 'string',
            description: 'Human-facing date/range for the timeline.',
          },
          sortKey: {
            type: 'string',
            description: 'Sortable approximate key such as YYYY-MM-DD, YYYY-MM, YYYY-QN, or unknown-late. Use stable lexical ordering.',
          },
          summary: { type: 'string' },
          authAreas: {
            type: 'array',
            items: { type: 'string' },
          },
          changeTypes: {
            type: 'array',
            items: { type: 'string' },
          },
          status: {
            type: 'string',
            enum: ['proposed', 'approved', 'implemented', 'rolled_out', 'reverted', 'superseded', 'mixed', 'unknown'],
          },
          impact: {
            type: 'string',
            enum: ['high', 'medium', 'low', 'unknown'],
          },
          sourceEvidence: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['sourceId', 'citations', 'evidenceSummary'],
              additionalProperties: false,
              properties: {
                sourceId: { type: 'string' },
                citations: {
                  type: 'array',
                  minItems: 1,
                  items: { type: 'string' },
                },
                evidenceSummary: { type: 'string' },
              },
            },
          },
          mergedLocalChanges: {
            type: 'array',
            items: {
              type: 'object',
              required: ['sourceId', 'localChangeId'],
              additionalProperties: false,
              properties: {
                sourceId: { type: 'string' },
                localChangeId: { type: 'string' },
              },
            },
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
        },
      },
    },
    droppedAsNotAuthRelevant: {
      type: 'array',
      items: {
        type: 'object',
        required: ['sourceId', 'localChangeId', 'reason'],
        additionalProperties: false,
        properties: {
          sourceId: { type: 'string' },
          localChangeId: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    dedupeNotes: { type: 'string' },
  },
}

phase('Dedupe changes')
log('Deduplicating semantically overlapping changes across sources.')

const deduped = await agent(
  `You are the deduplication lead for a multi-source authentication history QA task.

Question: ${question}
Timeframe: ${timeframe}
As-of reference: ${asOf}

You will receive per-source extracted changes. Merge duplicates across design docs and PRs into canonical timeline events.

Deduplication rules:
- Merge changes that describe the same underlying auth-system change, even if one source is a design proposal and another is the implementation PR.
- Do not merge merely related changes if they happened at different times or changed different behavior.
- Preserve all source evidence on the canonical change.
- Prefer implementation/rollout dates over proposal dates for timelineDate when answering "how did the system change"; mention proposal-to-rollout progression in the summary if important.
- If a proposal was superseded, reverted, or only partially implemented, keep that nuance.
- Drop items that are clearly not authentication changes, but record why.
- Assign stable IDs C01, C02, ... in approximate chronological order using sortKey.
- Keep sourceEvidence citations exactly traceable to the source readers' citations.

Per-source extracted changes:
${JSON.stringify(normalizedReadResults, null, 2)}`,
  {
    label: 'dedupe-auth-changes',
    phase: 'Dedupe changes',
    effort: 'high',
    schema: dedupeSchema,
  },
)

const canonicalChanges = deduped?.canonicalChanges || []
log(`Dedupe produced ${canonicalChanges.length} canonical auth change(s).`)

phase('Synthesize timeline')

const sourceCoverage = normalizedReadResults.map((result) => ({
  sourceId: result.sourceId,
  title: result.sourceTitle,
  kind: result.sourceKind,
  locator: result.sourceLocator,
  status: result.readStatus,
  sourceDate: result.sourceDate,
  changeCount: Array.isArray(result.changes) ? result.changes.length : 0,
  notes: result.readerNotes,
}))

const draftAnswer = await agent(
  `You are writing the final answer to this multi-source QA question:

"${question}"

Timeframe: ${timeframe}
As-of reference: ${asOf}

Use only the canonical deduplicated changes and source coverage below. Produce a concise, cited timeline explaining how the authentication system changed.

Canonical deduplicated changes:
${JSON.stringify(canonicalChanges, null, 2)}

Source coverage:
${JSON.stringify(sourceCoverage, null, 2)}

Writing requirements:
- Start with a direct 2-4 sentence answer summarizing the overall evolution.
- Then provide a chronological timeline. Each timeline item must include:
  - date or date range,
  - what changed,
  - why it mattered,
  - status if not fully rolled out or if superseded/reverted,
  - citations in square brackets using source IDs and locators from sourceEvidence.
- After the timeline, add a short "Themes" section grouping the changes into 3-6 larger shifts.
- Add a short "Coverage and caveats" section that states how many sources were read, how many had read issues, and any important uncertainty.
- Do not invent citations. Every factual claim about a change must be supported by canonical sourceEvidence.
- If dates are uncertain, say so rather than guessing.
- Prefer readable Markdown.`,
  {
    label: 'synthesize-cited-auth-timeline',
    phase: 'Synthesize timeline',
    effort: 'high',
  },
)

const auditSchema = {
  type: 'object',
  required: ['pass', 'majorIssues', 'minorIssues', 'requiredFixes'],
  additionalProperties: false,
  properties: {
    pass: { type: 'boolean' },
    majorIssues: {
      type: 'array',
      items: { type: 'string' },
    },
    minorIssues: {
      type: 'array',
      items: { type: 'string' },
    },
    requiredFixes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
}

phase('Audit answer')
log('Auditing draft for citation coverage, dedupe fidelity, and unsupported claims.')

const audit = await agent(
  `You are auditing a final QA answer for citation fidelity and evidence consistency.

Question: ${question}

Draft answer:
${draftAnswer || ''}

Canonical deduplicated changes:
${JSON.stringify(canonicalChanges, null, 2)}

Source coverage:
${JSON.stringify(sourceCoverage, null, 2)}

Audit criteria:
- Every timeline item must be supported by citations present in canonical sourceEvidence.
- The answer must not introduce auth changes absent from canonicalChanges.
- The answer must not hide important caveats, source read failures, reversions, supersessions, or uncertainty.
- Dedupe fidelity: merged changes should not be split into duplicate timeline entries, and distinct changes should not be conflated.
- The answer should directly answer how the authentication system changed over the requested timeframe.

Set pass=false if any major issue requires rewriting.`,
  {
    label: 'audit-cited-auth-timeline',
    phase: 'Audit answer',
    effort: 'medium',
    schema: auditSchema,
  },
)

let finalAnswer = draftAnswer || ''

if (audit && audit.pass === false && audit.requiredFixes.length > 0) {
  log(`Audit requested ${audit.requiredFixes.length} fix(es); revising final answer.`)

  finalAnswer = await agent(
    `Revise the draft answer to fix the audit findings. Use only the canonical deduplicated changes and source coverage.

Question: ${question}
Timeframe: ${timeframe}
As-of reference: ${asOf}

Draft answer:
${draftAnswer || ''}

Audit findings:
${JSON.stringify(audit, null, 2)}

Canonical deduplicated changes:
${JSON.stringify(canonicalChanges, null, 2)}

Source coverage:
${JSON.stringify(sourceCoverage, null, 2)}

Revision requirements:
- Fix every required audit issue.
- Preserve a clear cited chronological timeline.
- Do not add unsupported claims.
- Keep citations traceable to sourceEvidence.
- Include source coverage/caveats.`,
    {
      label: 'revise-audited-auth-timeline',
      phase: 'Audit answer',
      effort: 'high',
    },
  )
}

log('Multi-source authentication QA workflow complete.')

const workflowResult = {
  answer: finalAnswer,
  sourceCountExpected: expectedSourceCount,
  sourceCountRead: sources.length,
  candidateChangeCount: relevantChangeCount,
  canonicalChangeCount: canonicalChanges.length,
  readIssues: readFailures.map((result) => ({
    sourceId: result.sourceId,
    title: result.sourceTitle,
    status: result.readStatus,
    notes: result.readerNotes,
  })),
  audit: audit || null,
  sources: sourceCoverage,
  canonicalChanges,
}

workflowResult
```

> **GPT-5.5 judge:** The script has some safety features: structured/capped schemas, per-source null/error normalization after parallel completes, and final synthesis/coverage caveats that can disclose read issues. However, it uses one large unbounded parallel() over all sources, has no bounded waves, no per-wave commits, no armed ScheduleWakeup/stall watchdog, no timeout or explicit retry strategy around individual agents, no resume/cache-stable execution beyond stable source locators, and no backoff when failures spike. A hung reader could deadlock the whole read phase with no notification, and completed work is not committed until the single hard barrier returns. This misses most of the safety-by-construction bar for large fan-out orchestration.

## With skill — rubric 84%, patterns 100%

```js
export const meta = {
  name: 'multi-source-auth-qa',
  description: 'Read 33 design docs and PRs to answer how authentication changed over the last year, dedupe changes, and synthesize a cited timeline.',
  phases: [
    { title: 'Initialize' },
    { title: 'Read sources' },
    { title: 'Retry source reads' },
    { title: 'Dedupe changes' },
    { title: 'Synthesize timeline' },
  ],
}

// After launching this workflow, arm an external stall watchdog from the surrounding agent:
// ScheduleWakeup({ delaySeconds: 1200, reason: "watchdog: swarm wf_<id> may stall silently; check journal mtime",
//   prompt: "Watchdog for run wf_<id>: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel." })

phase('Initialize')

const WAVE_SIZE = Number.isInteger(args?.waveSize) && args.waveSize >= 3 && args.waveSize <= 8 ? args.waveSize : 6
const FAILURE_BACKOFF_THRESHOLD = 0.4
const MAX_CHANGES_PER_SOURCE = Number.isInteger(args?.maxChangesPerSource) && args.maxChangesPerSource > 0
  ? Math.min(args.maxChangesPerSource, 8)
  : 6
const DEDUPE_BATCH_SIZE = Number.isInteger(args?.dedupeBatchSize) && args.dedupeBatchSize >= 25
  ? Math.min(args.dedupeBatchSize, 80)
  : 60

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'source'
}

function inferSourceType(ref) {
  const s = String(ref || '').trim()
  if (/^https?:\/\//i.test(s)) return 'url'
  if (/^(pr[:#-]?)?\d+$/i.test(s) || /^#\d+$/.test(s)) return 'pull_request'
  if (/\bpull\s*request\b|\bpr\b/i.test(s)) return 'pull_request'
  return 'design_doc'
}

function normalizeOneSource(raw, index) {
  if (typeof raw === 'string') {
    const ref = raw.trim()
    return {
      key: slugify(ref),
      type: inferSourceType(ref),
      ref,
      title: ref,
      notes: '',
      ordinal: index + 1,
    }
  }

  const ref = raw?.ref ?? raw?.url ?? raw?.path ?? raw?.file ?? raw?.pr ?? raw?.number ?? raw?.id ?? raw?.title ?? `source-${index + 1}`
  const title = raw?.title ?? raw?.name ?? String(ref)
  return {
    key: slugify(raw?.key ?? raw?.id ?? raw?.sourceKey ?? title ?? ref),
    type: raw?.type ?? inferSourceType(ref),
    ref: String(ref),
    title: String(title),
    notes: raw?.notes ? String(raw.notes) : '',
    ordinal: index + 1,
  }
}

function normalizeSources(inputArgs) {
  const raw = []
  if (Array.isArray(inputArgs?.sources)) raw.push(...inputArgs.sources)
  if (Array.isArray(inputArgs?.designDocs)) raw.push(...inputArgs.designDocs)
  if (Array.isArray(inputArgs?.docs)) raw.push(...inputArgs.docs)
  if (Array.isArray(inputArgs?.pullRequests)) raw.push(...inputArgs.pullRequests)
  if (Array.isArray(inputArgs?.prs)) raw.push(...inputArgs.prs)

  const seen = new Map()
  const out = []
  raw.forEach((item, index) => {
    const src = normalizeOneSource(item, index)
    const base = src.key
    const count = seen.get(base) || 0
    seen.set(base, count + 1)
    if (count > 0) src.key = `${base}-${count + 1}`
    out.push(src)
  })
  return out
}

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function compactSourceForPrompt(src) {
  return {
    key: src.key,
    type: src.type,
    ref: src.ref,
    title: src.title,
    notes: src.notes,
    ordinal: src.ordinal,
  }
}

function sortByKey(arr, keyFn) {
  return [...arr].sort((a, b) => {
    const ak = keyFn(a)
    const bk = keyFn(b)
    return ak > bk ? 1 : ak < bk ? -1 : 0
  })
}

const CITATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sourceKey', 'locator', 'quote'],
  properties: {
    sourceKey: { type: 'string' },
    locator: {
      type: 'string',
      maxLength: 220,
      description: 'Stable locator such as section heading, PR number, file path, commit, or comment reference.',
    },
    quote: {
      type: 'string',
      maxLength: 320,
      description: 'Short supporting quote or paraphrased evidence snippet. Do not include long excerpts.',
    },
  },
}

const SOURCE_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sourceKey', 'sourceType', 'sourceTitle', 'coverage', 'changes'],
  properties: {
    sourceKey: { type: 'string' },
    sourceType: { type: 'string', enum: ['design_doc', 'pull_request', 'url', 'other'] },
    sourceTitle: { type: 'string', maxLength: 180 },
    coverage: {
      type: 'object',
      additionalProperties: false,
      required: ['readStatus', 'summary', 'assumptions'],
      properties: {
        readStatus: { type: 'string', enum: ['read', 'partially_read', 'not_found', 'not_accessible', 'not_relevant'] },
        summary: { type: 'string', maxLength: 500 },
        assumptions: {
          type: 'array',
          maxItems: 5,
          items: { type: 'string', maxLength: 180 },
        },
      },
    },
    changes: {
      type: 'array',
      maxItems: MAX_CHANGES_PER_SOURCE,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'localChangeId',
          'date',
          'component',
          'changeType',
          'title',
          'before',
          'after',
          'impact',
          'citations',
          'confidence',
          'duplicateHints',
        ],
        properties: {
          localChangeId: {
            type: 'string',
            maxLength: 120,
            description: 'Stable id scoped to this source, e.g. sourceKey:c01.',
          },
          date: {
            type: 'string',
            maxLength: 32,
            description: 'Best date for the change, ideally YYYY-MM-DD; YYYY-MM is acceptable if day is unknown.',
          },
          component: {
            type: 'string',
            maxLength: 100,
            description: 'Authentication subsystem/component affected.',
          },
          changeType: {
            type: 'string',
            enum: [
              'architecture',
              'login_flow',
              'mfa',
              'sessions',
              'tokens',
              'oauth_oidc_saml',
              'passwords',
              'identity_proofing',
              'service_auth',
              'secrets_keys',
              'risk_detection',
              'migration_deprecation',
              'policy',
              'observability',
              'other',
            ],
          },
          title: { type: 'string', maxLength: 160 },
          before: { type: 'string', maxLength: 360 },
          after: { type: 'string', maxLength: 360 },
          impact: { type: 'string', maxLength: 360 },
          citations: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: CITATION_SCHEMA,
          },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          duplicateHints: {
            type: 'array',
            maxItems: 4,
            items: {
              type: 'string',
              maxLength: 140,
              description: 'Names of PRs/docs/features/flags/endpoints likely referring to the same change.',
            },
          },
        },
      },
    },
  },
}

const CANONICAL_CHANGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'canonicalId',
    'date',
    'sortDate',
    'component',
    'changeType',
    'title',
    'summary',
    'before',
    'after',
    'impact',
    'sourceKeys',
    'localChangeIds',
    'citations',
    'confidence',
  ],
  properties: {
    canonicalId: { type: 'string', maxLength: 140 },
    date: { type: 'string', maxLength: 48 },
    sortDate: {
      type: 'string',
      maxLength: 32,
      description: 'Sortable date string, preferably YYYY-MM-DD; use YYYY-MM-00 or YYYY-00-00 for partial dates.',
    },
    component: { type: 'string', maxLength: 100 },
    changeType: {
      type: 'string',
      enum: [
        'architecture',
        'login_flow',
        'mfa',
        'sessions',
        'tokens',
        'oauth_oidc_saml',
        'passwords',
        'identity_proofing',
        'service_auth',
        'secrets_keys',
        'risk_detection',
        'migration_deprecation',
        'policy',
        'observability',
        'other',
      ],
    },
    title: { type: 'string', maxLength: 180 },
    summary: { type: 'string', maxLength: 520 },
    before: { type: 'string', maxLength: 420 },
    after: { type: 'string', maxLength: 420 },
    impact: { type: 'string', maxLength: 420 },
    sourceKeys: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: { type: 'string' },
    },
    localChangeIds: {
      type: 'array',
      minItems: 1,
      maxItems: 30,
      items: { type: 'string' },
    },
    citations: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: CITATION_SCHEMA,
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
}

const DEDUPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['canonicalChanges', 'dedupeNotes'],
  properties: {
    canonicalChanges: {
      type: 'array',
      maxItems: 140,
      items: CANONICAL_CHANGE_SCHEMA,
    },
    dedupeNotes: {
      type: 'array',
      maxItems: 12,
      items: { type: 'string', maxLength: 240 },
    },
  },
}

const TIMELINE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answerMarkdown', 'assumptions', 'timeline', 'themes', 'sourceCoverage', 'gaps', 'confidence'],
  properties: {
    answerMarkdown: {
      type: 'string',
      maxLength: 7000,
      description: 'Concise final answer with cited timeline and interpretation.',
    },
    assumptions: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string', maxLength: 240 },
    },
    timeline: {
      type: 'array',
      maxItems: 80,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'title', 'whatChanged', 'citations'],
        properties: {
          date: { type: 'string', maxLength: 48 },
          title: { type: 'string', maxLength: 180 },
          whatChanged: { type: 'string', maxLength: 700 },
          citations: {
            type: 'array',
            minItems: 1,
            maxItems: 6,
            items: CITATION_SCHEMA,
          },
        },
      },
    },
    themes: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['theme', 'summary', 'supportingChangeIds'],
        properties: {
          theme: { type: 'string', maxLength: 120 },
          summary: { type: 'string', maxLength: 520 },
          supportingChangeIds: {
            type: 'array',
            maxItems: 12,
            items: { type: 'string' },
          },
        },
      },
    },
    sourceCoverage: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['sourceKey', 'status', 'notes'],
        properties: {
          sourceKey: { type: 'string' },
          status: { type: 'string', enum: ['used', 'read_no_relevant_changes', 'missing_or_failed'] },
          notes: { type: 'string', maxLength: 260 },
        },
      },
    },
    gaps: {
      type: 'array',
      maxItems: 12,
      items: { type: 'string', maxLength: 320 },
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
}

const sources = normalizeSources(args)
if (!sources.length) {
  throw new Error(
    'No sources provided. Pass args.sources, args.designDocs/docs, and/or args.pullRequests/prs as 33 design doc / PR references.'
  )
}

if (sources.length !== 33) {
  log(`Expected 33 sources; received ${sources.length}. Continuing with provided source set.`)
}

const timeWindow = args?.timeWindow
  ? String(args.timeWindow)
  : 'the last year covered by the provided design docs and PR timestamps; state the inferred bounds explicitly if needed'

log(`Preparing to read ${sources.length} sources in waves of ${WAVE_SIZE}.`)

function buildSourcePrompt(src) {
  return `You are one worker in a multi-source QA swarm.

Question: "How did our authentication system change over the last year?"

Read exactly this source and extract only changes relevant to authentication.

Source:
${JSON.stringify(compactSourceForPrompt(src), null, 2)}

Time window:
${timeWindow}

Instructions:
- Use available repository / PR / document tools to inspect the referenced source.
- If this is a design doc, read the document and any directly referenced sections needed to understand auth changes.
- If this is a pull request, inspect the PR description, diff, linked issue/docs when available, and relevant comments.
- Focus on authentication: login, MFA, sessions, token issuance/validation, OAuth/OIDC/SAML, password flows, service-to-service auth, auth-related secrets/keys, risk checks, auth observability, migrations/deprecations, and policy that affects authentication behavior.
- Exclude pure authorization/RBAC changes unless they directly alter authentication behavior or identity/session establishment.
- Return at most ${MAX_CHANGES_PER_SOURCE} relevant changes.
- Keep outputs lean. Do not paste long document excerpts. Provide short evidence snippets and stable locators.
- Every change needs at least one citation from this source.
- If the source is inaccessible or has no relevant authentication changes, return an empty changes array and explain in coverage.
- The returned sourceKey MUST be exactly "${src.key}".
- Make localChangeId stable and scoped to the source, e.g. "${src.key}:c01".

Return only data matching the schema.`
}

async function runSource(src) {
  const result = await agent(buildSourcePrompt(src), {
    label: `read:${src.key}`,
    phase: 'Read sources',
    schema: SOURCE_READ_SCHEMA,
    effort: 'medium',
  })

  if (!result) return null

  return {
    ...result,
    sourceKey: src.key,
    sourceType: result.sourceType || src.type,
    sourceTitle: result.sourceTitle || src.title,
  }
}

const done = []
let failed = []
let deferred = []
let instabilityDetected = false

const waves = chunk(sources, WAVE_SIZE)

phase('Read sources')
for (let w = 0; w < waves.length; w++) {
  const wave = waves[w]
  log(`Read wave ${w + 1}/${waves.length}: ${wave.map(s => s.key).join(', ')}`)

  const batch = await parallel(wave.map(src => () => runSource(src)))

  let nulls = 0
  batch.forEach((result, i) => {
    if (result) {
      done.push(result)
    } else {
      nulls += 1
      failed.push(wave[i])
    }
  })

  log(`Read wave ${w + 1}: ${batch.length - nulls}/${batch.length} ok; ${failed.length} source(s) queued for retry.`)

  if (nulls / batch.length > FAILURE_BACKOFF_THRESHOLD) {
    const remaining = waves.slice(w + 1).flat()
    deferred.push(...remaining)
    instabilityDetected = true
    log(`instability: ${nulls}/${batch.length} failed this wave — backing off; return partial, resume later`)
    break
  }
}

if (failed.length && !instabilityDetected) {
  phase('Retry source reads')
  const retryWaves = chunk(failed, WAVE_SIZE)
  failed = []

  for (let rw = 0; rw < retryWaves.length; rw++) {
    const wave = retryWaves[rw]
    log(`Retry wave ${rw + 1}/${retryWaves.length}: ${wave.map(s => s.key).join(', ')}`)

    const batch = await parallel(wave.map(src => () => runSource(src)))

    let nulls = 0
    batch.forEach((result, i) => {
      if (result) {
        done.push(result)
      } else {
        nulls += 1
        failed.push(wave[i])
      }
    })

    log(`Retry wave ${rw + 1}: recovered ${batch.length - nulls}/${batch.length}; still missing ${failed.length}.`)

    if (nulls / batch.length > FAILURE_BACKOFF_THRESHOLD) {
      const untriedRetrySources = retryWaves.slice(rw + 1).flat()
      failed.push(...untriedRetrySources)
      instabilityDetected = true
      log(`instability: ${nulls}/${batch.length} failed this retry wave — backing off; return partial, resume later`)
      break
    }
  }
}

const bestResultBySource = new Map()
for (const result of done) {
  if (!bestResultBySource.has(result.sourceKey)) bestResultBySource.set(result.sourceKey, result)
}
const sourceResults = sortByKey([...bestResultBySource.values()], r => r.sourceKey)

const readSourceKeys = new Set(sourceResults.map(r => r.sourceKey))
const missingSources = sources
  .filter(src => !readSourceKeys.has(src.key))
  .map(src => ({
    key: src.key,
    type: src.type,
    ref: src.ref,
    title: src.title,
    reason: deferred.some(d => d.key === src.key) ? 'deferred_after_instability_backoff' : 'read_failed',
  }))

if (missingSources.length) {
  log(`partial: missing ${missingSources.length}/${sources.length} sources: ${missingSources.map(s => s.key).join(', ')}`)
}

const rawChanges = []
for (const result of sourceResults) {
  const changes = Array.isArray(result.changes) ? result.changes : []
  changes.forEach((change, index) => {
    const localChangeId = change.localChangeId || `${result.sourceKey}:c${String(index + 1).padStart(2, '0')}`
    rawChanges.push({
      ...change,
      localChangeId,
      sourceKey: result.sourceKey,
      sourceTitle: result.sourceTitle,
      citations: (change.citations || []).slice(0, 3).map(c => ({
        sourceKey: result.sourceKey,
        locator: c.locator || result.sourceTitle || result.sourceKey,
        quote: c.quote || '',
      })),
    })
  })
}

rawChanges.sort((a, b) => {
  const ak = `${a.date || ''}|${a.component || ''}|${a.title || ''}|${a.sourceKey || ''}|${a.localChangeId || ''}`
  const bk = `${b.date || ''}|${b.component || ''}|${b.title || ''}|${b.sourceKey || ''}|${b.localChangeId || ''}`
  return ak > bk ? 1 : ak < bk ? -1 : 0
})

log(`Extracted ${rawChanges.length} raw authentication change mention(s) from ${sourceResults.length} readable source(s).`)

function fallbackCanonicalFromRaw(change) {
  const canonicalId = slugify(`${change.date || 'unknown'}-${change.component || 'auth'}-${change.title || change.localChangeId}`)
  return {
    canonicalId,
    date: change.date || 'unknown',
    sortDate: normalizeSortDate(change.date || ''),
    component: change.component || 'authentication',
    changeType: change.changeType || 'other',
    title: change.title || 'Authentication change',
    summary: change.impact || change.after || change.before || 'Authentication-related change extracted from source.',
    before: change.before || 'Not specified in source.',
    after: change.after || 'Not specified in source.',
    impact: change.impact || 'Impact not specified in source.',
    sourceKeys: [change.sourceKey],
    localChangeIds: [change.localChangeId],
    citations: change.citations && change.citations.length
      ? change.citations.slice(0, 3)
      : [{ sourceKey: change.sourceKey, locator: change.sourceTitle || change.sourceKey, quote: 'Source referenced this authentication change.' }],
    confidence: change.confidence || 'low',
  }
}

function normalizeSortDate(date) {
  const s = String(date || '').trim()
  const mDay = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (mDay) return `${mDay[1]}-${mDay[2]}-${mDay[3]}`
  const mMonth = s.match(/^(\d{4})-(\d{2})/)
  if (mMonth) return `${mMonth[1]}-${mMonth[2]}-00`
  const mYear = s.match(/^(\d{4})/)
  if (mYear) return `${mYear[1]}-00-00`
  return '9999-99-99'
}

function buildDedupePrompt(changes, scopeLabel) {
  return `Dedupe authentication change mentions for the multi-source QA answer.

Question: "How did our authentication system change over the last year?"
Scope: ${scopeLabel}
Time window: ${timeWindow}

Input change mentions:
${JSON.stringify(changes, null, 2)}

Instructions:
- Merge duplicate and near-duplicate mentions of the same actual authentication change across design docs and PRs.
- Common duplicate pattern: design doc proposes a change, PR implements it, follow-up PR migrates or cleans up the same change.
- Do NOT merge merely related changes if they changed different authentication behavior or happened at meaningfully different stages.
- Preserve citations from all supporting sources, capped to the strongest 6.
- Preserve localChangeIds from all merged mentions.
- Prefer specific shipped PR dates over vague design-doc dates when describing implementation; mention design/proposal dates in summary if useful.
- canonicalId must be stable and human-readable.
- sortDate must be sortable: YYYY-MM-DD, or YYYY-MM-00 / YYYY-00-00 for partial dates.
- Keep summaries concise; output only schema data.`
}

let dedupeNotes = []
let canonicalChanges = []

phase('Dedupe changes')

if (rawChanges.length === 0) {
  canonicalChanges = []
  dedupeNotes.push('No relevant authentication changes were extracted from readable sources.')
} else {
  const dedupeBatches = chunk(rawChanges, DEDUPE_BATCH_SIZE)
  log(`Dedupe pass 1: ${dedupeBatches.length} batch(es).`)

  const batchDedupeResults = await parallel(dedupeBatches.map((changes, i) => () =>
    agent(buildDedupePrompt(changes, `batch ${i + 1}/${dedupeBatches.length}`), {
      label: `dedupe:batch-${i + 1}`,
      phase: 'Dedupe changes',
      schema: DEDUPE_SCHEMA,
      effort: 'high',
    })
  ))

  let interim = []
  batchDedupeResults.forEach((result, i) => {
    if (result) {
      interim.push(...(result.canonicalChanges || []))
      dedupeNotes.push(...(result.dedupeNotes || []))
    } else {
      dedupeNotes.push(`Dedupe batch ${i + 1} failed; used one-canonical-change-per-raw-change fallback for that batch.`)
      interim.push(...dedupeBatches[i].map(fallbackCanonicalFromRaw))
    }
  })

  interim = sortByKey(interim, c => `${normalizeSortDate(c.sortDate || c.date)}|${c.canonicalId || c.title}`)

  if (dedupeBatches.length > 1 || interim.length !== rawChanges.length) {
    log(`Dedupe pass 2: final cross-batch merge over ${interim.length} canonical candidate(s).`)
    const finalDedupe = await agent(buildDedupePrompt(interim, 'final cross-batch canonical merge'), {
      label: 'dedupe:final',
      phase: 'Dedupe changes',
      schema: DEDUPE_SCHEMA,
      effort: 'high',
    })

    if (finalDedupe) {
      canonicalChanges = finalDedupe.canonicalChanges || []
      dedupeNotes.push(...(finalDedupe.dedupeNotes || []))
    } else {
      canonicalChanges = interim
      dedupeNotes.push('Final cross-batch dedupe failed; using pass-1 canonical candidates.')
    }
  } else {
    canonicalChanges = interim
  }
}

canonicalChanges = sortByKey(canonicalChanges, c => `${normalizeSortDate(c.sortDate || c.date)}|${c.canonicalId || c.title}`)

const coverageForPrompt = sources.map(src => {
  const result = bestResultBySource.get(src.key)
  if (!result) {
    const missing = missingSources.find(m => m.key === src.key)
    return {
      sourceKey: src.key,
      title: src.title,
      status: 'missing_or_failed',
      notes: missing?.reason || 'not read',
    }
  }
  const changeCount = Array.isArray(result.changes) ? result.changes.length : 0
  return {
    sourceKey: src.key,
    title: src.title,
    status: changeCount > 0 ? 'used' : 'read_no_relevant_changes',
    notes: result.coverage?.summary || `${changeCount} relevant change(s) extracted`,
  }
})

function buildSynthesisPrompt() {
  return `Synthesize the final answer for the user.

Question: "How did our authentication system change over the last year?"

Time window:
${timeWindow}

Canonical deduped authentication changes, sorted for stability:
${JSON.stringify(canonicalChanges, null, 2)}

Source coverage:
${JSON.stringify(coverageForPrompt, null, 2)}

Missing or failed sources:
${JSON.stringify(missingSources, null, 2)}

Dedupe notes:
${JSON.stringify(dedupeNotes.slice(0, 20), null, 2)}

Instructions:
- Produce a cited, chronological timeline explaining how the authentication system changed over the last year.
- Start with a direct summary answer, then timeline.
- Use citations from the canonical changes. Cite with sourceKey plus locator; do not invent citations.
- Explain major themes, such as migration from one auth mechanism to another, MFA/session/token changes, identity-provider changes, deprecations, or security hardening.
- If some sources are missing, explicitly flag the gap and avoid claiming the review is complete.
- If dates are partial or inferred, state that assumption.
- Distinguish design/proposal from shipped implementation when the evidence supports it.
- Keep output concise and evidence-driven.`
}

phase('Synthesize timeline')
const synthesized = await agent(buildSynthesisPrompt(), {
  label: 'synthesize:cited-auth-timeline',
  phase: 'Synthesize timeline',
  schema: TIMELINE_SCHEMA,
  effort: 'high',
})

function fallbackTimeline() {
  const timeline = canonicalChanges.slice(0, 80).map(c => ({
    date: c.date,
    title: c.title,
    whatChanged: `${c.summary} Before: ${c.before} After: ${c.after} Impact: ${c.impact}`,
    citations: (c.citations || []).slice(0, 6),
  }))

  const gaps = []
  if (missingSources.length) {
    gaps.push(`Partial result: ${missingSources.length}/${sources.length} sources were missing, failed, or deferred after instability backoff.`)
  }
  if (!canonicalChanges.length) {
    gaps.push('No relevant authentication changes were extracted from readable sources.')
  }

  return {
    answerMarkdown:
      canonicalChanges.length === 0
        ? `No relevant authentication-system changes were extracted from the readable sources. ${gaps.join(' ')}`
        : `Authentication changed through ${canonicalChanges.length} deduped change(s) across ${sourceResults.length} readable source(s). The structured timeline contains the cited details. ${gaps.join(' ')}`,
    assumptions: [timeWindow],
    timeline,
    themes: [],
    sourceCoverage: coverageForPrompt.map(c => ({
      sourceKey: c.sourceKey,
      status: c.status,
      notes: c.notes,
    })),
    gaps,
    confidence: missingSources.length ? 'medium' : 'low',
  }
}

const timeline = synthesized || fallbackTimeline()

return {
  question: 'how did our authentication system change over the last year?',
  sourceCountExpected: 33,
  sourceCountProvided: sources.length,
  sourceCountRead: sourceResults.length,
  missingSources,
  instabilityDetected,
  rawChangeMentionCount: rawChanges.length,
  canonicalChangeCount: canonicalChanges.length,
  timeline,
  canonicalChanges,
  sourceCoverage: coverageForPrompt,
  dedupeNotes: dedupeNotes.slice(0, 40),
}
```

> **GPT-5.5 judge:** The workflow meets most of the safety bar: it uses bounded waves with a default size of 6, tolerates null agent results, retries failed source reads, dedupes with fallbacks, uses capped schemas/lean outputs, synthesizes partial results while explicitly flagging missing sources, and backs off when a wave has a high failure rate. It also includes a ScheduleWakeup watchdog instruction with TaskStop/resume guidance. However, the watchdog is only documented as an external action rather than actually armed in the script, each wave still has a hard parallel() barrier so one hung agent can stall the wave until the external watchdog intervenes, and completed work is accumulated in memory rather than explicitly persisted after each wave, relying on workflow journaling/resume behavior. Overall it is substantially safe-by-construction but not perfect.

