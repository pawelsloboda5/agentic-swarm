# multi-source-qa — `gpt-5.5`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for MULTI-SOURCE QA: answer "how did our authentication system change over the last year?" by reading 33 design docs and pull requests. Each source is read by an agent that returns the relevant changes; dedupe across sources; synthesize a cited timeline.

---

## Baseline (no skill) — rubric 32%, patterns 69%

```js
export const meta = {
  name: 'multi-source-auth-qa',
  description: 'Read 33 design docs and pull requests, dedupe authentication-system changes, and synthesize a cited timeline.',
  phases: [
    { title: 'Discover sources' },
    { title: 'Read sources' },
    { title: 'Dedupe changes' },
    { title: 'Synthesize timeline' },
    { title: 'Verify answer' },
  ],
}

const QUESTION =
  args?.question || 'How did our authentication system change over the last year?'

const TIME_WINDOW =
  args?.timeWindow ||
  'the last year / last 12 months; if exact current date is unavailable, infer the covered one-year period from source dates and state that inference'

const EXPECTED_SOURCE_COUNT = args?.expectedSourceCount || 33
const USE_ALL_PROVIDED_SOURCES = args?.useAllSources === true

function slug(value) {
  return String(value || 'source')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'source'
}

function normalizeSource(raw, index) {
  if (typeof raw === 'string') {
    return {
      id: `S${String(index + 1).padStart(2, '0')}-${slug(raw)}`,
      type: 'unknown',
      title: raw,
      locator: raw,
    }
  }

  const type = raw?.type || raw?.kind || (raw?.prNumber || raw?.pullRequest ? 'pull_request' : 'design_doc')
  const title =
    raw?.title ||
    raw?.name ||
    raw?.path ||
    raw?.url ||
    raw?.locator ||
    raw?.prNumber ||
    `source ${index + 1}`

  return {
    id: raw?.id || `S${String(index + 1).padStart(2, '0')}-${slug(title)}`,
    type,
    title,
    locator: raw?.locator || raw?.path || raw?.url || raw?.ref || raw?.prNumber || title,
    path: raw?.path || null,
    url: raw?.url || null,
    ref: raw?.ref || null,
    prNumber: raw?.prNumber || raw?.number || null,
    date: raw?.date || raw?.publishedDate || raw?.mergedDate || raw?.createdAt || null,
    notes: raw?.notes || raw?.whyIncluded || null,
  }
}

function normalizeProvidedSources(inputArgs) {
  const direct = Array.isArray(inputArgs?.sources) ? inputArgs.sources : []
  const docs = Array.isArray(inputArgs?.designDocs) ? inputArgs.designDocs : []
  const prs = Array.isArray(inputArgs?.pullRequests) ? inputArgs.pullRequests : []
  const combined = direct.length ? direct : [...docs, ...prs]

  let normalized = combined.map(normalizeSource)

  if (!USE_ALL_PROVIDED_SOURCES && normalized.length > EXPECTED_SOURCE_COUNT) {
    normalized = normalized.slice(0, EXPECTED_SOURCE_COUNT)
  }

  return normalized
}

function chunk(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function compactJson(value) {
  return JSON.stringify(value, null, 2)
}

const discoverySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['sources', 'searchSummary', 'timeWindowUsed'],
  properties: {
    timeWindowUsed: { type: 'string' },
    searchSummary: { type: 'string' },
    sources: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'type', 'title', 'locator', 'whyIncluded'],
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['design_doc', 'pull_request', 'unknown'] },
          title: { type: 'string' },
          locator: { type: 'string' },
          path: { type: ['string', 'null'] },
          url: { type: ['string', 'null'] },
          ref: { type: ['string', 'null'] },
          prNumber: { type: ['string', 'number', 'null'] },
          date: { type: ['string', 'null'] },
          whyIncluded: { type: 'string' },
        },
      },
    },
  },
}

const sourceExtractionSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'sourceId',
    'sourceTitle',
    'sourceType',
    'sourceLocator',
    'readStatus',
    'sourceDate',
    'overallSummary',
    'changes',
    'notRelevantReason',
    'warnings',
  ],
  properties: {
    sourceId: { type: 'string' },
    sourceTitle: { type: 'string' },
    sourceType: { type: 'string' },
    sourceLocator: { type: 'string' },
    readStatus: { type: 'string', enum: ['read', 'partially_read', 'not_found', 'inaccessible'] },
    sourceDate: { type: ['string', 'null'] },
    overallSummary: { type: 'string' },
    notRelevantReason: { type: ['string', 'null'] },
    warnings: { type: 'array', items: { type: 'string' } },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'localChangeId',
          'date',
          'title',
          'category',
          'components',
          'before',
          'after',
          'rationale',
          'userOrSystemImpact',
          'implementationStatus',
          'evidence',
          'citations',
          'confidence',
        ],
        properties: {
          localChangeId: { type: 'string' },
          date: { type: ['string', 'null'] },
          title: { type: 'string' },
          category: {
            type: 'string',
            enum: [
              'login',
              'session',
              'token',
              'oauth_oidc_saml',
              'mfa',
              'password',
              'authorization',
              'identity_model',
              'service_to_service_auth',
              'account_recovery',
              'audit_logging',
              'migration_deprecation',
              'security_hardening',
              'developer_platform',
              'other',
            ],
          },
          components: { type: 'array', items: { type: 'string' } },
          before: { type: 'string' },
          after: { type: 'string' },
          rationale: { type: 'string' },
          userOrSystemImpact: { type: 'string' },
          implementationStatus: {
            type: 'string',
            enum: ['proposed', 'accepted', 'implemented', 'partially_implemented', 'reverted', 'unknown'],
          },
          evidence: { type: 'string' },
          citations: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['sourceId', 'locator', 'quote'],
              properties: {
                sourceId: { type: 'string' },
                locator: { type: 'string' },
                quote: { type: 'string' },
              },
            },
          },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
  },
}

const dedupeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['canonicalChanges', 'duplicateGroups', 'conflicts', 'dedupeSummary'],
  properties: {
    dedupeSummary: { type: 'string' },
    canonicalChanges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'canonicalId',
          'date',
          'title',
          'category',
          'components',
          'before',
          'after',
          'rationale',
          'impact',
          'implementationStatus',
          'sourceChangeRefs',
          'citations',
          'confidence',
          'dedupeNotes',
        ],
        properties: {
          canonicalId: { type: 'string' },
          date: { type: ['string', 'null'] },
          title: { type: 'string' },
          category: { type: 'string' },
          components: { type: 'array', items: { type: 'string' } },
          before: { type: 'string' },
          after: { type: 'string' },
          rationale: { type: 'string' },
          impact: { type: 'string' },
          implementationStatus: { type: 'string' },
          sourceChangeRefs: { type: 'array', items: { type: 'string' } },
          citations: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['sourceId', 'locator', 'quote'],
              properties: {
                sourceId: { type: 'string' },
                locator: { type: 'string' },
                quote: { type: 'string' },
              },
            },
          },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          dedupeNotes: { type: 'string' },
        },
      },
    },
    duplicateGroups: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['canonicalId', 'mergedSourceChangeRefs', 'reason'],
        properties: {
          canonicalId: { type: 'string' },
          mergedSourceChangeRefs: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
      },
    },
    conflicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'sourceChangeRefs', 'description', 'recommendedTreatment'],
        properties: {
          topic: { type: 'string' },
          sourceChangeRefs: { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
          recommendedTreatment: { type: 'string' },
        },
      },
    },
  },
}

const synthesisSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['markdown', 'timeline', 'caveats', 'coverageSummary'],
  properties: {
    markdown: { type: 'string' },
    coverageSummary: { type: 'string' },
    caveats: { type: 'array', items: { type: 'string' } },
    timeline: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'title', 'summary', 'citations'],
        properties: {
          date: { type: ['string', 'null'] },
          title: { type: 'string' },
          summary: { type: 'string' },
          citations: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

const verificationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'issues', 'correctedMarkdown', 'verificationSummary'],
  properties: {
    verdict: { type: 'string', enum: ['approved', 'approved_with_caveats', 'needs_corrections'] },
    verificationSummary: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'claim', 'problem', 'fix'],
        properties: {
          severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
          claim: { type: 'string' },
          problem: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
    correctedMarkdown: { type: 'string' },
  },
}

let sources = normalizeProvidedSources(args || {})

if (!sources.length) {
  phase('Discover sources')
  log(`No source manifest supplied; asking an agent to discover ${EXPECTED_SOURCE_COUNT} authentication-related design docs and pull requests.`)

  const discovered = await agent(
    `You are preparing evidence for a multi-source QA answer.

Question: ${QUESTION}
Time window: ${TIME_WINDOW}
Target source count: ${EXPECTED_SOURCE_COUNT}

Find the ${EXPECTED_SOURCE_COUNT} most relevant source artifacts about how the authentication system changed in this period. Prefer a balanced mix of design docs and pull requests. Use repository search, available PR metadata, changelog references, design-doc directories, and local tooling as available.

Return only sources that a later agent can read directly. For each source, provide a stable id, type, title, locator, optional path/url/ref/PR number/date, and why it matters.

If you cannot find exactly ${EXPECTED_SOURCE_COUNT}, return the best available set and explain in searchSummary.`,
    {
      label: 'discover auth design docs and PRs',
      phase: 'Discover sources',
      schema: discoverySchema,
      effort: 'high',
      isolation: 'worktree',
    },
  )

  sources = (discovered?.sources || []).map(normalizeSource)

  if (!USE_ALL_PROVIDED_SOURCES && sources.length > EXPECTED_SOURCE_COUNT) {
    sources = sources.slice(0, EXPECTED_SOURCE_COUNT)
  }
}

const sourceWarnings = []
if (sources.length !== EXPECTED_SOURCE_COUNT) {
  sourceWarnings.push(
    `Expected ${EXPECTED_SOURCE_COUNT} sources but will process ${sources.length}.`,
  )
}
log(`Processing ${sources.length} source(s) for: ${QUESTION}`)

let finalResult

if (!sources.length) {
  finalResult = {
    question: QUESTION,
    timeWindow: TIME_WINDOW,
    sourceCount: 0,
    answer:
      `# Authentication-system changes\n\nI could not answer because no design docs or pull requests were provided or discovered for the requested analysis.`,
    warnings: sourceWarnings,
  }
} else {
  phase('Read sources')

  const readResults = await parallel(
    sources.map((source, index) => async () => {
      return agent(
        `You are one reader in a multi-source QA workflow.

Question to support: ${QUESTION}
Time window: ${TIME_WINDOW}

Read exactly this source and extract only authentication-system changes relevant to the question.

Source ${index + 1} of ${sources.length}:
${compactJson(source)}

Instructions:
- Inspect the actual source content, not just the title.
- For pull requests, inspect the description, merged/closed date if available, relevant diff, migration notes, tests, and discussion that clarify auth behavior.
- For design docs, inspect decision records, status, alternatives, rollout/migration sections, and dates.
- Extract concrete changes to authentication, identity, sessions, tokens, MFA, OAuth/OIDC/SAML, service-to-service auth, authorization boundaries only where they affect authn/auth system design, security hardening, recovery, audit logging, or migrations/deprecations.
- Do not include unrelated authorization/product changes unless they directly changed authentication behavior or architecture.
- For every change, include at least one citation with a precise locator and a short exact quote.
- If the source is not relevant or cannot be read, return an empty changes array and explain why.
- Use sourceId exactly as provided: ${source.id}.`,
        {
          label: `read ${source.id}`,
          phase: 'Read sources',
          schema: sourceExtractionSchema,
          effort: 'medium',
          isolation: 'worktree',
        },
      )
    }),
  )

  const failedReads = []
  const extractions = []

  for (let i = 0; i < readResults.length; i += 1) {
    const result = readResults[i]
    if (!result) {
      failedReads.push({
        sourceId: sources[i].id,
        title: sources[i].title,
        locator: sources[i].locator,
        reason: 'Reader agent returned null.',
      })
    } else {
      extractions.push(result)
      if (result.readStatus !== 'read') {
        failedReads.push({
          sourceId: result.sourceId,
          title: result.sourceTitle,
          locator: result.sourceLocator,
          reason: result.readStatus,
        })
      }
    }
  }

  const changeRecords = []
  for (const extraction of extractions) {
    for (const change of extraction.changes || []) {
      const ref = `${extraction.sourceId}:${change.localChangeId}`
      changeRecords.push({
        ref,
        sourceId: extraction.sourceId,
        sourceTitle: extraction.sourceTitle,
        sourceType: extraction.sourceType,
        sourceLocator: extraction.sourceLocator,
        sourceDate: extraction.sourceDate,
        localChangeId: change.localChangeId,
        date: change.date,
        title: change.title,
        category: change.category,
        components: change.components,
        before: change.before,
        after: change.after,
        rationale: change.rationale,
        impact: change.userOrSystemImpact,
        implementationStatus: change.implementationStatus,
        evidence: change.evidence,
        citations: change.citations,
        confidence: change.confidence,
      })
    }
  }

  log(`Read ${extractions.length}/${sources.length} source(s); extracted ${changeRecords.length} candidate auth change(s).`)

  phase('Dedupe changes')

  let deduped

  if (!changeRecords.length) {
    deduped = {
      canonicalChanges: [],
      duplicateGroups: [],
      conflicts: [],
      dedupeSummary: 'No relevant authentication changes were extracted from the readable sources.',
    }
  } else {
    const dedupeChunks = chunk(changeRecords, 45)

    const chunkDedupeResults = await parallel(
      dedupeChunks.map((records, chunkIndex) => async () => {
        return agent(
          `You are deduplicating extracted authentication changes.

Question: ${QUESTION}
Time window: ${TIME_WINDOW}
Chunk ${chunkIndex + 1} of ${dedupeChunks.length}

Candidate changes:
${compactJson(records)}

Task:
- Merge records that describe the same underlying authentication-system change, even if one is from a design doc and another from the implementing PR.
- Do not merge changes that are merely related but happened at different times, affected different mechanisms, or represent proposal vs implementation unless the evidence clearly shows they are the same change.
- Preserve the strongest concrete before/after description.
- Keep citations from multiple sources when they support the same canonical change.
- Record conflicts where sources disagree about behavior, dates, status, or scope.
- Use canonical ids like C${String(chunkIndex + 1).padStart(2, '0')}-001, C${String(chunkIndex + 1).padStart(2, '0')}-002, etc.`,
          {
            label: `dedupe chunk ${chunkIndex + 1}`,
            phase: 'Dedupe changes',
            schema: dedupeSchema,
            effort: 'high',
          },
        )
      }),
    )

    const canonicalSeed = []
    const duplicateGroups = []
    const conflicts = []
    const missingDedupeChunks = []

    for (let i = 0; i < chunkDedupeResults.length; i += 1) {
      const result = chunkDedupeResults[i]
      if (!result) {
        missingDedupeChunks.push(i + 1)
      } else {
        canonicalSeed.push(...(result.canonicalChanges || []))
        duplicateGroups.push(...(result.duplicateGroups || []))
        conflicts.push(...(result.conflicts || []))
      }
    }

    if (canonicalSeed.length <= 45) {
      const global = await agent(
        `You are performing final global deduplication for a multi-source authentication timeline.

Question: ${QUESTION}
Time window: ${TIME_WINDOW}

Previously deduplicated canonical candidates:
${compactJson(canonicalSeed)}

Previously identified duplicate groups:
${compactJson(duplicateGroups)}

Previously identified conflicts:
${compactJson(conflicts)}

Missing dedupe chunks, if any:
${compactJson(missingDedupeChunks)}

Task:
- Deduplicate across chunks into one final canonical list.
- Preserve all useful citations.
- Sort canonical changes chronologically where dates are available; keep undated but relevant changes near their best inferred period.
- Keep conflicts that matter to the final answer.
- Use final canonical ids AUTH-001, AUTH-002, etc.`,
        {
          label: 'global dedupe',
          phase: 'Dedupe changes',
          schema: dedupeSchema,
          effort: 'high',
        },
      )

      deduped =
        global || {
          canonicalChanges: canonicalSeed,
          duplicateGroups,
          conflicts,
          dedupeSummary:
            'Global dedupe agent failed; using chunk-level deduplicated results.',
        }
    } else {
      const secondPassChunks = chunk(canonicalSeed, 45)
      const secondPassResults = await parallel(
        secondPassChunks.map((records, chunkIndex) => async () => {
          return agent(
            `Second-pass dedupe for authentication changes.

Question: ${QUESTION}
Time window: ${TIME_WINDOW}
Second-pass chunk ${chunkIndex + 1} of ${secondPassChunks.length}

Canonical candidates:
${compactJson(records)}

Merge duplicates across prior chunks. Preserve citations and conflicts. Use ids P${String(chunkIndex + 1).padStart(2, '0')}-001, P${String(chunkIndex + 1).padStart(2, '0')}-002, etc.`,
            {
              label: `second-pass dedupe ${chunkIndex + 1}`,
              phase: 'Dedupe changes',
              schema: dedupeSchema,
              effort: 'high',
            },
          )
        }),
      )

      const secondSeed = []
      const secondDuplicates = [...duplicateGroups]
      const secondConflicts = [...conflicts]

      for (const result of secondPassResults) {
        if (result) {
          secondSeed.push(...(result.canonicalChanges || []))
          secondDuplicates.push(...(result.duplicateGroups || []))
          secondConflicts.push(...(result.conflicts || []))
        }
      }

      const global = await agent(
        `Final global dedupe for a large multi-source authentication timeline.

Question: ${QUESTION}
Time window: ${TIME_WINDOW}

Canonical candidates after second pass:
${compactJson(secondSeed)}

Duplicate evidence:
${compactJson(secondDuplicates)}

Conflict evidence:
${compactJson(secondConflicts)}

Produce the final deduplicated canonical change list with ids AUTH-001, AUTH-002, etc. Preserve citations and meaningful conflicts.`,
        {
          label: 'final global dedupe',
          phase: 'Dedupe changes',
          schema: dedupeSchema,
          effort: 'high',
        },
      )

      deduped =
        global || {
          canonicalChanges: secondSeed,
          duplicateGroups: secondDuplicates,
          conflicts: secondConflicts,
          dedupeSummary:
            'Final global dedupe agent failed; using second-pass deduplicated results.',
        }
    }
  }

  log(`Deduped to ${deduped.canonicalChanges.length} canonical authentication change(s).`)

  phase('Synthesize timeline')

  const synthesis = await agent(
    `You are writing the final answer to a multi-source QA question.

Question: ${QUESTION}
Time window: ${TIME_WINDOW}

Final deduplicated authentication changes:
${compactJson(deduped.canonicalChanges)}

Conflicts to handle carefully:
${compactJson(deduped.conflicts)}

Source coverage:
${compactJson({
  requestedSourceCount: EXPECTED_SOURCE_COUNT,
  processedSourceCount: sources.length,
  readableExtractionCount: extractions.length,
  failedReads,
  sourceWarnings,
})}

Write a clear, cited answer in Markdown.

Requirements:
- Start with a direct 2-4 sentence answer summarizing how the authentication system changed.
- Then provide a chronological timeline.
- Each timeline bullet must include date/period, the change, before/after, impact, status if known, and citations.
- Use citation format like [S01-auth-doc §Migration Plan] or [S14-login-pr diff: auth/session.ts].
- Cite every material claim using the provided citation locators and quotes.
- Do not invent facts beyond the deduplicated changes.
- Explicitly mention caveats: unreadable sources, missing dates, conflicts, proposal-vs-implementation uncertainty.
- End with cross-cutting themes: e.g. centralization, token/session hardening, MFA changes, migration/deprecation, service-to-service auth, etc., but only if supported by evidence.`,
    {
      label: 'synthesize cited timeline',
      phase: 'Synthesize timeline',
      schema: synthesisSchema,
      effort: 'high',
    },
  )

  phase('Verify answer')

  let verified = null
  if (synthesis?.markdown) {
    verified = await agent(
      `You are the verification pass for a cited multi-source QA answer.

Question: ${QUESTION}

Draft answer:
${synthesis.markdown}

Allowed evidence: final deduplicated authentication changes:
${compactJson(deduped.canonicalChanges)}

Known conflicts:
${compactJson(deduped.conflicts)}

Coverage limitations:
${compactJson({
  requestedSourceCount: EXPECTED_SOURCE_COUNT,
  processedSourceCount: sources.length,
  failedReads,
  sourceWarnings,
})}

Check whether every material claim in the draft is supported by the allowed evidence and citations.

Return:
- approved if no substantive problems.
- approved_with_caveats if only caveats/wording limitations remain.
- needs_corrections if claims are unsupported, overbroad, missing caveats, or citations do not support them.

If corrections are needed, provide correctedMarkdown that fixes the answer while preserving the requested structure and citations. If approved, correctedMarkdown should equal the draft.`,
      {
        label: 'verify citations and claims',
        phase: 'Verify answer',
        schema: verificationSchema,
        effort: 'medium',
      },
    )
  }

  const answerMarkdown =
    verified?.correctedMarkdown ||
    synthesis?.markdown ||
    `# Authentication-system changes\n\nNo final synthesis could be produced. ${deduped.dedupeSummary}`

  finalResult = {
    question: QUESTION,
    timeWindow: TIME_WINDOW,
    requestedSourceCount: EXPECTED_SOURCE_COUNT,
    processedSourceCount: sources.length,
    readFailureCount: failedReads.length,
    extractedCandidateChangeCount: changeRecords.length,
    canonicalChangeCount: deduped.canonicalChanges.length,
    answer: answerMarkdown,
    qa: verified || {
      verdict: 'needs_corrections',
      verificationSummary: 'Verification did not run or returned null.',
      issues: [],
    },
    caveats: [
      ...sourceWarnings,
      ...(synthesis?.caveats || []),
      ...(failedReads.length
        ? [`${failedReads.length} source(s) were not fully read; see readFailures.`]
        : []),
    ],
    readFailures: failedReads,
    canonicalChanges: deduped.canonicalChanges,
    conflicts: deduped.conflicts,
  }
}

finalResult
```

> **Claude judge:** The script fans out all 33 source reads in a single unbounded parallel() call with no wave-size cap, no stall watchdog, and no per-wave commit before synthesis, meaning one hung agent can stall the entire pipeline indefinitely with no notification. Null-tolerance is present but there is no retry or backoff, and the single hard barrier before deduplication means all completed work waits on the slowest/hung agent.

## With skill — rubric 92%, patterns 94%

```js
export const meta = {
  name: 'multi-source-auth-qa',
  description: 'Read 33 design docs/PRs with per-source agents, dedupe authentication changes, and synthesize a cited timeline.',
  phases: [
    { title: 'Prepare' },
    { title: 'Read sources' },
    { title: 'Retry reads' },
    { title: 'Dedupe' },
    { title: 'Synthesize cited timeline' },
  ],
}

const WAVE_SIZE = 6
const READ_EFFORT = args.readEffort || 'medium'
const DEDUPE_EFFORT = args.dedupeEffort || 'high'
const SYNTH_EFFORT = args.synthEffort || 'high'

const WATCHDOG_TO_ARM_AFTER_LAUNCH = `ScheduleWakeup({
  delaySeconds: 1200,
  reason: "watchdog: auth QA swarm <runId> may stall silently; check journal mtime",
  prompt: "Watchdog for auth QA workflow run <runId> (task <taskId>, scriptPath <scriptPath>): if the workflow task is not completed and the journal mtime is older than 20 min, TaskStop the task then resume with Workflow({ scriptPath: \\"<scriptPath>\\", resumeFromRunId: \\"<runId>\\" }); otherwise re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog -- NOT a /loop sentinel."
})`

phase('Prepare')
log('After launching this workflow, arm this one-shot stall watchdog from the surrounding agent:')
log(WATCHDOG_TO_ARM_AFTER_LAUNCH)

if (!args || !Array.isArray(args.sources)) {
  throw new Error(
    'Expected args.sources to be an array of 33 source descriptors. Each descriptor should include a stable key/id and enough information for a subagent to read it: path, url, prNumber, title, repo, and/or content.'
  )
}

if (args.sources.length !== 33) {
  log(`Warning: expected 33 sources, received ${args.sources.length}. Continuing with provided sources.`)
}

const QUESTION =
  args.question ||
  'How did our authentication system change over the last year?'

const TIME_WINDOW =
  args.timeWindow ||
  (args.windowStart && args.windowEnd
    ? `${args.windowStart} through ${args.windowEnd}`
    : 'the last year relative to the project/current launch context; if the exact anchor date is unavailable, infer the anchor from source dates and state that explicitly')

const AUTH_SCOPE =
  args.authScope ||
  'Authentication only: login/sign-in, account creation, identity providers, SSO/SAML/OIDC/OAuth, MFA/passkeys/WebAuthn, passwords, sessions, cookies, refresh/access tokens, API keys when used for authentication, service-to-service authentication, device trust, risk-based or step-up authentication, auth-related migrations, and security hardening. Mention authorization only when it is coupled to an authentication change.'

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function str(v, fallback = '') {
  return v === undefined || v === null ? fallback : String(v)
}

function keyBaseForSource(source, index) {
  return str(
    source.key ||
      source.id ||
      source.sourceKey ||
      source.prNumber ||
      source.pr ||
      source.path ||
      source.url ||
      source.title ||
      `source-${String(index + 1).padStart(2, '0')}`
  )
}

function labelSafe(s) {
  return str(s)
    .replace(/[^A-Za-z0-9_.:/#-]+/g, '-')
    .slice(0, 80)
}

function compareKey(a, b) {
  return a.key > b.key ? 1 : a.key < b.key ? -1 : 0
}

function normalizeSources(inputSources) {
  const seen = {}
  const normalized = inputSources.map((source, index) => {
    const base = keyBaseForSource(source, index)
    seen[base] = (seen[base] || 0) + 1
    const key = seen[base] === 1 ? base : `${base}#${seen[base]}`
    return {
      key,
      ordinal: index + 1,
      title: str(source.title || source.name || source.subject || key),
      kind: str(source.kind || source.type || (source.prNumber || source.pr ? 'pull_request' : 'design_doc')),
      locator: str(source.path || source.url || source.prNumber || source.pr || source.id || key),
      original: source,
    }
  })
  return normalized.sort(compareKey)
}

const SOURCES = normalizeSources(args.sources)
const ALL_SOURCE_KEYS = SOURCES.map(s => s.key)

const CITATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sourceKey', 'locator', 'url', 'quote'],
  properties: {
    sourceKey: { type: 'string' },
    locator: {
      type: 'string',
      description: 'Precise location: doc heading, section, PR number, file path, line range, commit, or comment locator.',
    },
    url: { type: 'string', description: 'URL if available; otherwise empty string.' },
    quote: {
      type: 'string',
      maxLength: 280,
      description: 'Short supporting quote or paraphrase from the source; no long excerpts.',
    },
  },
}

const SOURCE_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'sourceKey',
    'sourceTitle',
    'sourceKind',
    'readStatus',
    'relevance',
    'sourceSummary',
    'changes',
    'confidence',
    'warnings',
  ],
  properties: {
    sourceKey: { type: 'string' },
    sourceTitle: { type: 'string' },
    sourceKind: { type: 'string' },
    readStatus: {
      type: 'string',
      enum: ['read', 'partially-read', 'not-accessible'],
    },
    relevance: {
      type: 'string',
      enum: ['has-auth-changes', 'mentions-auth-no-change', 'not-auth-related', 'unclear'],
    },
    sourceSummary: {
      type: 'string',
      maxLength: 700,
      description: 'Brief source-specific summary focused only on authentication relevance.',
    },
    changes: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'localChangeId',
          'date',
          'datePrecision',
          'title',
          'changeType',
          'authAreas',
          'description',
          'impact',
          'dedupeHints',
          'citations',
          'confidence',
        ],
        properties: {
          localChangeId: {
            type: 'string',
            description: 'Stable ID unique within this source, e.g. SRC-1.',
          },
          date: {
            type: 'string',
            description: 'Best known date for the change, decision, merge, rollout, or design milestone. Use ISO date if possible.',
          },
          datePrecision: {
            type: 'string',
            enum: ['day', 'month', 'quarter', 'year', 'unknown'],
          },
          title: { type: 'string', maxLength: 160 },
          changeType: {
            type: 'string',
            enum: [
              'added',
              'removed',
              'modified',
              'deprecated',
              'migrated',
              'hardened',
              'documented',
              'rolled-back',
              'unknown',
            ],
          },
          authAreas: {
            type: 'array',
            maxItems: 6,
            items: { type: 'string' },
          },
          description: {
            type: 'string',
            maxLength: 900,
            description: 'What changed, before/after if known, and the auth behavior affected.',
          },
          impact: {
            type: 'string',
            maxLength: 500,
            description: 'User/developer/security/operational impact.',
          },
          dedupeHints: {
            type: 'array',
            maxItems: 6,
            items: {
              type: 'string',
              maxLength: 120,
              description: 'Names, feature flags, PR numbers, systems, endpoints, migrations, or terms that help merge duplicate mentions.',
            },
          },
          citations: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: CITATION_SCHEMA,
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
        },
      },
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
    },
    warnings: {
      type: 'array',
      maxItems: 5,
      items: { type: 'string', maxLength: 180 },
    },
  },
}

const DEDUPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['scope', 'sourceKeysCovered', 'canonicalChanges', 'dedupeNotes'],
  properties: {
    scope: { type: 'string' },
    sourceKeysCovered: {
      type: 'array',
      items: { type: 'string' },
    },
    canonicalChanges: {
      type: 'array',
      maxItems: 80,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'canonicalId',
          'date',
          'datePrecision',
          'title',
          'changeType',
          'authAreas',
          'summary',
          'impact',
          'sourceKeys',
          'mergedLocalChangeIds',
          'citations',
          'confidence',
        ],
        properties: {
          canonicalId: {
            type: 'string',
            description: 'Stable human-readable canonical ID, e.g. AUTH-2025-03-PASSKEYS.',
          },
          date: { type: 'string' },
          datePrecision: {
            type: 'string',
            enum: ['day', 'month', 'quarter', 'year', 'unknown'],
          },
          title: { type: 'string', maxLength: 180 },
          changeType: {
            type: 'string',
            enum: [
              'added',
              'removed',
              'modified',
              'deprecated',
              'migrated',
              'hardened',
              'documented',
              'rolled-back',
              'unknown',
            ],
          },
          authAreas: {
            type: 'array',
            maxItems: 8,
            items: { type: 'string' },
          },
          summary: {
            type: 'string',
            maxLength: 900,
            description: 'Deduped before/after summary.',
          },
          impact: {
            type: 'string',
            maxLength: 600,
          },
          sourceKeys: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
          },
          mergedLocalChangeIds: {
            type: 'array',
            items: { type: 'string' },
          },
          citations: {
            type: 'array',
            minItems: 1,
            maxItems: 8,
            items: CITATION_SCHEMA,
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
        },
      },
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
  required: [
    'question',
    'timeWindow',
    'executiveAnswer',
    'timeline',
    'themes',
    'deduplicationSummary',
    'sourceCoverage',
    'caveats',
    'openQuestions',
  ],
  properties: {
    question: { type: 'string' },
    timeWindow: { type: 'string' },
    executiveAnswer: {
      type: 'string',
      maxLength: 1800,
      description: 'Direct answer to how authentication changed over the last year.',
    },
    timeline: {
      type: 'array',
      maxItems: 60,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'date',
          'datePrecision',
          'title',
          'whatChanged',
          'whyItMatters',
          'authAreas',
          'changeType',
          'citations',
          'confidence',
        ],
        properties: {
          date: { type: 'string' },
          datePrecision: {
            type: 'string',
            enum: ['day', 'month', 'quarter', 'year', 'unknown'],
          },
          title: { type: 'string', maxLength: 180 },
          whatChanged: { type: 'string', maxLength: 1000 },
          whyItMatters: { type: 'string', maxLength: 650 },
          authAreas: {
            type: 'array',
            maxItems: 8,
            items: { type: 'string' },
          },
          changeType: {
            type: 'string',
            enum: [
              'added',
              'removed',
              'modified',
              'deprecated',
              'migrated',
              'hardened',
              'documented',
              'rolled-back',
              'unknown',
            ],
          },
          citations: {
            type: 'array',
            minItems: 1,
            maxItems: 8,
            items: CITATION_SCHEMA,
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
        },
      },
    },
    themes: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['theme', 'summary', 'supportingChangeIds'],
        properties: {
          theme: { type: 'string', maxLength: 140 },
          summary: { type: 'string', maxLength: 700 },
          supportingChangeIds: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    deduplicationSummary: {
      type: 'string',
      maxLength: 900,
    },
    sourceCoverage: {
      type: 'object',
      additionalProperties: false,
      required: [
        'totalSourcesPlanned',
        'sourcesAnalyzed',
        'sourcesWithAuthChanges',
        'sourcesWithoutAuthChanges',
        'missingSourceKeys',
        'partial',
      ],
      properties: {
        totalSourcesPlanned: { type: 'number' },
        sourcesAnalyzed: { type: 'number' },
        sourcesWithAuthChanges: { type: 'number' },
        sourcesWithoutAuthChanges: { type: 'number' },
        missingSourceKeys: {
          type: 'array',
          items: { type: 'string' },
        },
        partial: { type: 'boolean' },
      },
    },
    caveats: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string', maxLength: 300 },
    },
    openQuestions: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string', maxLength: 300 },
    },
  },
}

async function safeAgent(prompt, opts) {
  try {
    return await agent(prompt, opts)
  } catch (err) {
    log(`Agent threw in ${opts && opts.label ? opts.label : 'unlabeled-agent'}; treating as null.`)
    return null
  }
}

function sourceReadPrompt(src) {
  return `You are one source-reading QA agent in a multi-source authentication history workflow.

Question to answer later:
${QUESTION}

Time window:
${TIME_WINDOW}

Authentication scope:
${AUTH_SCOPE}

Your assignment:
Read exactly this one source descriptor and extract only authentication-system changes relevant to the question. Use available repository tools, PR tools, local files, and/or embedded source content as appropriate. If this is a pull request, inspect the PR description and relevant changed files/comments when available. If this is a design doc, inspect the decision sections, timelines, status, and linked PRs only when needed to understand this source.

Source descriptor JSON:
${JSON.stringify(src)}

Rules:
- Return data only in the schema.
- Do not invent changes. If the source is inaccessible, say readStatus="not-accessible" and return no changes.
- If the source mentions authentication but records no actual change, use relevance="mentions-auth-no-change".
- Prefer changes within the stated time window. Include a boundary item only if it is needed to explain the year-over-year change, and make the date uncertainty explicit.
- Deduplication happens later, but include dedupeHints such as PR numbers, feature flags, migration names, service names, endpoints, protocols, and identity-provider names.
- Each change must include at least one precise citation with sourceKey="${src.key}". Use short quotes/paraphrases only.
- Return at most 6 changes; pick the most consequential/auth-relevant ones.`
}

function readSource(src) {
  return safeAgent(sourceReadPrompt(src), {
    label: `read:${labelSafe(src.key)}`,
    phase: 'Read sources',
    schema: SOURCE_READ_SCHEMA,
    effort: READ_EFFORT,
  })
}

const sourceResults = []
let failedSources = []
let deferredSources = []
let instabilityBackoff = false

const sourceWaves = chunk(SOURCES, WAVE_SIZE)

for (let w = 0; w < sourceWaves.length; w++) {
  phase(`Read sources wave ${w + 1}/${sourceWaves.length}`)
  const wave = sourceWaves[w]
  const batch = await parallel(wave.map(src => () => readSource(src)))

  let nulls = 0
  batch.forEach((result, i) => {
    if (result) sourceResults.push(result)
    else {
      nulls += 1
      failedSources.push(wave[i])
    }
  })

  log(
    `Read wave ${w + 1}/${sourceWaves.length}: ${batch.length - nulls}/${batch.length} returned; ` +
      `${sourceResults.length}/${SOURCES.length} sources analyzed so far.`
  )

  if (nulls / batch.length > 0.4) {
    const remaining = sourceWaves.slice(w + 1).flat()
    deferredSources = deferredSources.concat(remaining)
    instabilityBackoff = true
    log(
      `instability: ${nulls}/${batch.length} failed this wave -- backing off; ` +
        `deferring ${remaining.length} unread sources and continuing with partial synthesis.`
    )
    break
  }
}

if (failedSources.length && !instabilityBackoff) {
  phase('Retry reads')
  const retryWaves = chunk(failedSources, WAVE_SIZE)
  const stillFailed = []

  for (let w = 0; w < retryWaves.length; w++) {
    const wave = retryWaves[w]
    const batch = await parallel(wave.map(src => () => readSource(src)))

    let nulls = 0
    batch.forEach((result, i) => {
      if (result) sourceResults.push(result)
      else {
        nulls += 1
        stillFailed.push(wave[i])
      }
    })

    log(
      `Retry wave ${w + 1}/${retryWaves.length}: recovered ${batch.length - nulls}/${batch.length}; ` +
        `${sourceResults.length}/${SOURCES.length} sources analyzed total.`
    )

    if (nulls / batch.length > 0.4) {
      const remainingRetry = retryWaves.slice(w + 1).flat()
      deferredSources = deferredSources.concat(remainingRetry)
      instabilityBackoff = true
      log(
        `instability: ${nulls}/${batch.length} failed in retry wave -- backing off; ` +
          `deferring ${remainingRetry.length} retry sources.`
      )
      break
    }
  }

  failedSources = stillFailed
}

const haveSourceKeys = new Set(sourceResults.map(r => r.sourceKey))
const missingSourceKeys = ALL_SOURCE_KEYS.filter(key => !haveSourceKeys.has(key))
if (missingSourceKeys.length) {
  log(`partial: missing ${missingSourceKeys.length}/${SOURCES.length} source reads: ${missingSourceKeys.join(', ')}`)
}

const sortedSourceResults = sourceResults
  .slice()
  .sort((a, b) => (a.sourceKey > b.sourceKey ? 1 : a.sourceKey < b.sourceKey ? -1 : 0))

function sourceResultLean(result) {
  return {
    sourceKey: result.sourceKey,
    sourceTitle: result.sourceTitle,
    sourceKind: result.sourceKind,
    readStatus: result.readStatus,
    relevance: result.relevance,
    sourceSummary: result.sourceSummary,
    changes: (result.changes || []).map(change => ({
      localChangeId: `${result.sourceKey}:${change.localChangeId}`,
      date: change.date,
      datePrecision: change.datePrecision,
      title: change.title,
      changeType: change.changeType,
      authAreas: change.authAreas || [],
      description: change.description,
      impact: change.impact,
      dedupeHints: change.dedupeHints || [],
      citations: change.citations || [],
      confidence: change.confidence,
    })),
    confidence: result.confidence,
    warnings: result.warnings || [],
  }
}

function dedupeShardPrompt(shardId, shardResults) {
  return `You are a deduplication agent for a multi-source authentication QA workflow.

Question:
${QUESTION}

Time window:
${TIME_WINDOW}

Task:
Deduplicate authentication changes within this shard of source-read results. Merge mentions of the same underlying change across docs/PRs. Preserve citations from all supporting sources. Do not over-merge separate changes just because they touch the same auth area.

Shard ID: ${shardId}

Shard source-read results JSON:
${JSON.stringify(shardResults.map(sourceResultLean))}

Rules:
- Return canonicalChanges only for actual authentication-system changes.
- Multiple sources may cite the same canonical change; merge them.
- Keep citations concise and useful.
- sourceKeysCovered must list every sourceKey in this shard.
- canonicalId should be stable and descriptive, based on date/title/system, not on array position.`
}

phase('Dedupe')
const dedupeInputShards = chunk(sortedSourceResults, 8)
let shardDedupeResults = []

if (dedupeInputShards.length) {
  const shardBatch = await parallel(
    dedupeInputShards.map((shard, i) => () =>
      safeAgent(dedupeShardPrompt(`shard-${i + 1}`, shard), {
        label: `dedupe:shard-${i + 1}`,
        phase: 'Dedupe',
        schema: DEDUPE_SCHEMA,
        effort: DEDUPE_EFFORT,
      })
    )
  )
  shardDedupeResults = shardBatch.filter(Boolean)
  const shardNulls = shardBatch.filter(r => r === null).length
  if (shardNulls) {
    log(`Dedupe shard warning: ${shardNulls}/${shardBatch.length} shard dedupe agents returned null; global dedupe will use remaining shard data plus raw reads.`)
  }
} else {
  log('No source reads returned; skipping shard dedupe and producing partial empty synthesis.')
}

function globalDedupePrompt(shardResults, rawResults) {
  return `You are the global deduplication agent for the authentication QA workflow.

Question:
${QUESTION}

Time window:
${TIME_WINDOW}

Authentication scope:
${AUTH_SCOPE}

Task:
Merge all shard-level canonical changes into one deduplicated set of authentication-system changes. Use raw source-read results as a fallback/check, especially if any shard dedupe was missing. Preserve high-value citations and source coverage.

Missing source reads:
${JSON.stringify(missingSourceKeys)}

Shard dedupe results JSON:
${JSON.stringify(shardResults)}

Raw source-read results JSON:
${JSON.stringify(rawResults.map(sourceResultLean))}

Rules:
- Deduplicate aggressively but correctly: same feature/flag/migration/PR/system behavior should be one canonical change; separate phases or rollbacks should remain separate timeline entries if materially different.
- Keep all canonical changes relevant to "${QUESTION}" and "${TIME_WINDOW}".
- Sort canonicalChanges chronologically when possible; unknown dates last.
- Every canonical change needs at least one citation.
- If evidence is weak or conflicting, lower confidence and explain in dedupeNotes.`
}

const globalDedupe =
  sortedSourceResults.length === 0
    ? {
        scope: 'global-empty',
        sourceKeysCovered: [],
        canonicalChanges: [],
        dedupeNotes: ['No source-read agents returned results; no deduplication was possible.'],
      }
    : await safeAgent(globalDedupePrompt(shardDedupeResults, sortedSourceResults), {
        label: 'dedupe:global',
        phase: 'Dedupe',
        schema: DEDUPE_SCHEMA,
        effort: DEDUPE_EFFORT,
      })

const dedupedChanges = globalDedupe && Array.isArray(globalDedupe.canonicalChanges)
  ? globalDedupe.canonicalChanges
  : []

if (!globalDedupe) {
  log('Global dedupe returned null; final synthesis will dedupe directly from raw source-read results.')
}

function timelinePrompt() {
  const coverage = {
    totalSourcesPlanned: SOURCES.length,
    sourceKeysPlanned: ALL_SOURCE_KEYS,
    sourcesAnalyzed: sortedSourceResults.length,
    missingSourceKeys,
    instabilityBackoff,
    readStatuses: sortedSourceResults.map(r => ({
      sourceKey: r.sourceKey,
      readStatus: r.readStatus,
      relevance: r.relevance,
      changeCount: Array.isArray(r.changes) ? r.changes.length : 0,
    })),
  }

  return `You are the final synthesis agent for a multi-source QA task.

Question:
${QUESTION}

Time window:
${TIME_WINDOW}

Authentication scope:
${AUTH_SCOPE}

Your task:
Produce a deduplicated, cited timeline answering how the authentication system changed over the last year.

Coverage / partial-input status JSON:
${JSON.stringify(coverage)}

Global deduped canonical changes JSON:
${JSON.stringify(globalDedupe || { canonicalChanges: [], dedupeNotes: ['Global dedupe unavailable; dedupe from raw reads.'] })}

Raw source-read results JSON:
${JSON.stringify(sortedSourceResults.map(sourceResultLean))}

Instructions:
- Answer the question directly in executiveAnswer.
- Build timeline entries from deduplicated changes, chronological where possible.
- Each timeline entry must include citations. Cite sourceKey plus locator/url/short quote.
- Do not silently hide missing source reads. If any are missing, mark sourceCoverage.partial=true and list them in caveats.
- Explain deduplication at a high level: what kinds of duplicates were merged, especially design-doc vs PR mentions of the same change.
- If the source evidence is thin/conflicting, say so.
- Prefer concise, decision-ready language over exhaustive prose.
- Return only the schema object.`
}

phase('Synthesize cited timeline')
const timeline = await safeAgent(timelinePrompt(), {
  label: 'synthesize:cited-auth-timeline',
  phase: 'Synthesize cited timeline',
  schema: TIMELINE_SCHEMA,
  effort: SYNTH_EFFORT,
})

const sourcesWithAuthChanges = sortedSourceResults.filter(r => r.relevance === 'has-auth-changes').length
const sourcesWithoutAuthChanges = sortedSourceResults.filter(r => r.relevance !== 'has-auth-changes').length

return {
  question: QUESTION,
  timeWindow: TIME_WINDOW,
  watchdogToArmAfterLaunch: WATCHDOG_TO_ARM_AFTER_LAUNCH,
  counts: {
    sourcesPlanned: SOURCES.length,
    sourcesAnalyzed: sortedSourceResults.length,
    missingSourceReads: missingSourceKeys.length,
    sourcesWithAuthChanges,
    sourcesWithoutAuthChanges,
    shardDedupeResults: shardDedupeResults.length,
    dedupedChanges: dedupedChanges.length,
    instabilityBackoff,
  },
  missingSourceKeys,
  analyzedSourceKeys: sortedSourceResults.map(r => r.sourceKey),
  sourceFindings: sortedSourceResults,
  dedupe: globalDedupe,
  citedTimeline: timeline || {
    question: QUESTION,
    timeWindow: TIME_WINDOW,
    executiveAnswer:
      'Final synthesis agent returned null. Use sourceFindings and dedupe outputs from this workflow result or resume the workflow using the same scriptPath and runId.',
    timeline: [],
    themes: [],
    deduplicationSummary: globalDedupe
      ? 'Global dedupe completed, but final timeline synthesis failed.'
      : 'Global dedupe and final timeline synthesis did not complete.',
    sourceCoverage: {
      totalSourcesPlanned: SOURCES.length,
      sourcesAnalyzed: sortedSourceResults.length,
      sourcesWithAuthChanges,
      sourcesWithoutAuthChanges,
      missingSourceKeys,
      partial: true,
    },
    caveats: [
      'Final synthesis agent returned null; resume the workflow to regenerate the cited timeline.',
      missingSourceKeys.length
        ? `Missing source reads: ${missingSourceKeys.join(', ')}`
        : 'All source-read agents returned, but synthesis failed.',
    ],
    openQuestions: [],
  },
}
```

> **Claude judge:** The script demonstrates nearly all required safety properties: (1) bounded WAVE_SIZE=6 waves with chunk(); (2) safeAgent() null-tolerance plus a dedicated retry phase for failed sources; (3) results committed per wave into sourceResults before synthesis; (4) ScheduleWakeup watchdog is generated and logged (though it must be armed externally by the surrounding agent, which is noted explicitly); (5) no Date.now/Math.random in prompts—keys are deterministic; (6) lean schemas with maxLength/maxItems caps throughout; (7) synthesis tolerates partial input, flags missing sources, marks partial=true, and provides a fallback citedTimeline if synthesis returns null; (8) explicit instabilityBackoff when >40% of a wave fails, deferring remaining sources and breaking out of the loop. The only minor gap is that the watchdog is instructional/logged rather than directly called, but the script correctly acknowledges this is an agent-level concern and provides the exact call string.

