# multi-source-qa — `gpt-5.4-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for MULTI-SOURCE QA: answer "how did our authentication system change over the last year?" by reading 33 design docs and pull requests. Each source is read by an agent that returns the relevant changes; dedupe across sources; synthesize a cited timeline.

---

## Baseline (no skill) — rubric 18%, patterns 19%

```js
export const meta = {
  name: 'multi-source-auth-change-qa',
  description:
    'Read 33 design docs and pull requests, dedupe the extracted authentication changes, and synthesize a cited timeline for the last year.',
  phases: [{ title: 'Extract' }, { title: 'Dedupe' }, { title: 'Synthesize' }],
}

const sources = [
  { id: 'src-01', kind: 'design doc', title: 'Design Doc 01' },
  { id: 'src-02', kind: 'design doc', title: 'Design Doc 02' },
  { id: 'src-03', kind: 'design doc', title: 'Design Doc 03' },
  { id: 'src-04', kind: 'design doc', title: 'Design Doc 04' },
  { id: 'src-05', kind: 'design doc', title: 'Design Doc 05' },
  { id: 'src-06', kind: 'design doc', title: 'Design Doc 06' },
  { id: 'src-07', kind: 'design doc', title: 'Design Doc 07' },
  { id: 'src-08', kind: 'design doc', title: 'Design Doc 08' },
  { id: 'src-09', kind: 'design doc', title: 'Design Doc 09' },
  { id: 'src-10', kind: 'design doc', title: 'Design Doc 10' },
  { id: 'src-11', kind: 'design doc', title: 'Design Doc 11' },
  { id: 'src-12', kind: 'design doc', title: 'Design Doc 12' },
  { id: 'src-13', kind: 'design doc', title: 'Design Doc 13' },
  { id: 'src-14', kind: 'design doc', title: 'Design Doc 14' },
  { id: 'src-15', kind: 'design doc', title: 'Design Doc 15' },
  { id: 'src-16', kind: 'design doc', title: 'Design Doc 16' },
  { id: 'src-17', kind: 'design doc', title: 'Design Doc 17' },
  { id: 'src-18', kind: 'design doc', title: 'Design Doc 18' },
  { id: 'src-19', kind: 'design doc', title: 'Design Doc 19' },
  { id: 'src-20', kind: 'design doc', title: 'Design Doc 20' },
  { id: 'src-21', kind: 'pull request', title: 'PR 21' },
  { id: 'src-22', kind: 'pull request', title: 'PR 22' },
  { id: 'src-23', kind: 'pull request', title: 'PR 23' },
  { id: 'src-24', kind: 'pull request', title: 'PR 24' },
  { id: 'src-25', kind: 'pull request', title: 'PR 25' },
  { id: 'src-26', kind: 'pull request', title: 'PR 26' },
  { id: 'src-27', kind: 'pull request', title: 'PR 27' },
  { id: 'src-28', kind: 'pull request', title: 'PR 28' },
  { id: 'src-29', kind: 'pull request', title: 'PR 29' },
  { id: 'src-30', kind: 'pull request', title: 'PR 30' },
  { id: 'src-31', kind: 'pull request', title: 'PR 31' },
  { id: 'src-32', kind: 'pull request', title: 'PR 32' },
  { id: 'src-33', kind: 'pull request', title: 'PR 33' },
]

phase('Extract')

const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sourceId: { type: 'string' },
    sourceTitle: { type: 'string' },
    sourceKind: { type: 'string' },
    date: {
      type: ['string', 'null'],
      description: 'ISO date if available, otherwise null',
    },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          summary: { type: 'string' },
          category: { type: 'string' },
          impact: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['summary', 'category', 'impact', 'evidence'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['sourceId', 'sourceTitle', 'sourceKind', 'date', 'changes', 'notes'],
}

const extracted = await parallel(
  sources.map((src, index) => async () => {
    const prompt = `
You are reading ONE source for a multi-source QA task.

Question: "How did our authentication system change over the last year?"

Source:
- Source ID: ${src.id}
- Source type: ${src.kind}
- Source title: ${src.title}

Instructions:
- Read the source carefully and extract only authentication-related changes.
- Focus on what changed, when it changed if the source states a date, and why it matters.
- Return only concrete changes with evidence grounded in the source.
- If the source contains no auth-related changes, return an empty changes array.
- Include concise evidence snippets or specific references from the source text/sections/PR details.
- Do not speculate.
- Preserve the source identity exactly.
`.trim()

    return agent(prompt, {
      label: `${src.kind} ${index + 1}`,
      phase: 'Extract',
      schema: extractionSchema,
      effort: 'high',
    })
  })
)

const usable = extracted.filter(Boolean)

phase('Dedupe')

function normalizeKey(change) {
  return [
    (change.category || '').trim().toLowerCase(),
    (change.summary || '').trim().toLowerCase().replace(/\s+/g, ' '),
    (change.impact || '').trim().toLowerCase().replace(/\s+/g, ' '),
  ].join(' | ')
}

const dedupeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    canonicalChanges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          canonicalId: { type: 'string' },
          date: { type: ['string', 'null'] },
          category: { type: 'string' },
          summary: { type: 'string' },
          impact: { type: 'string' },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                sourceId: { type: 'string' },
                sourceTitle: { type: 'string' },
                sourceKind: { type: 'string' },
                evidence: { type: 'string' },
              },
              required: ['sourceId', 'sourceTitle', 'sourceKind', 'evidence'],
            },
          },
        },
        required: ['canonicalId', 'date', 'category', 'summary', 'impact', 'evidence'],
      },
    },
    coverage: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sourcesRead: { type: 'number' },
        sourcesWithAuthChanges: { type: 'number' },
        totalExtractedChanges: { type: 'number' },
      },
      required: ['sourcesRead', 'sourcesWithAuthChanges', 'totalExtractedChanges'],
    },
  },
  required: ['canonicalChanges', 'coverage'],
}

const deduped = await agent(
  `
You are deduplicating authenticated-system change evidence from multiple source extractions.

Task:
- Merge semantically duplicate auth changes across sources.
- Prefer the most specific wording supported by multiple sources.
- Preserve all unique evidence links/snippets under each canonical change.
- Organize changes into a timeline-ready list.
- Do not invent dates. If exact dates are absent, keep date as null.
- If two items are the same change described differently, merge them.
- If they are related but distinct, keep them separate.

Input JSON:
${JSON.stringify(usable, null, 2)}
`.trim(),
  {
    label: 'Dedupe auth changes',
    phase: 'Dedupe',
    schema: dedupeSchema,
    effort: 'high',
  }
)

phase('Synthesize')

const finalAnswer = await agent(
  `
You are writing the final answer to: "How did our authentication system change over the last year?"

Use only the deduped evidence below. Produce a concise, cited timeline with these constraints:
- Start with a one-paragraph executive summary.
- Then provide a chronological timeline with bullets.
- Each bullet should include:
  - approximate date or exact date if available
  - change summary
  - why it mattered / impact
  - citations in the form [sourceId: sourceTitle]
- Clearly distinguish design-doc-driven plans from PR-delivered implementation where evidence supports that.
- If exact chronology is incomplete, use relative ordering and say so.
- End with a short "Net effect" section summarizing the overall evolution of auth.
- Do not mention uncited claims.
- If there were no auth changes, say so plainly.

Deduped evidence JSON:
${JSON.stringify(deduped, null, 2)}
`.trim(),
  {
    label: 'Synthesize timeline',
    phase: 'Synthesize',
    effort: 'high',
  }
)

finalAnswer
```

> **Claude judge:** The script fans out all 33 agents in a single `parallel()` call (no bounded waves of 6-8), has no per-agent retry or null-tolerance beyond a simple `.filter(Boolean)`, no per-wave result commits, no ScheduleWakeup/stall watchdog, no backoff on high failure rates, and no explicit gap-flagging in synthesis. It does have resume-stable prompts (no Date.now/Math.random) and reasonably lean schemas, but the core safety properties for large fan-out are mostly absent.

## With skill — rubric 75%, patterns 81%

```js
export const meta = {
  name: 'multi-source-auth-change-qa',
  description: 'Read 33 design docs and pull requests about authentication changes, dedupe findings, and synthesize a cited timeline.',
  phases: [{ title: 'Discover' }, { title: 'Deduplicate' }, { title: 'Synthesize' }],
}

const SOURCES = Array.isArray(args?.sources) ? args.sources : []
const QUESTION = 'how did our authentication system change over the last year?'

const WAVE_SIZE = 6
const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const SOURCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sourceId', 'kind', 'title', 'dateHint', 'changes', 'evidence'],
  properties: {
    sourceId: { type: 'string' },
    kind: { type: 'string' },
    title: { type: 'string' },
    dateHint: { type: 'string' },
    changes: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['changeKey', 'summary', 'impact', 'evidence'],
        properties: {
          changeKey: { type: 'string' },
          summary: { type: 'string' },
          impact: { type: 'string' },
          evidence: {
            type: 'array',
            maxItems: 3,
            items: { type: 'string' },
          },
        },
      },
    },
    evidence: {
      type: 'array',
      maxItems: 3,
      items: { type: 'string' },
    },
  },
}

function buildSourcePrompt(source) {
  return [
    `Question: ${QUESTION}`,
    `Source type: ${source.kind || 'unknown'}`,
    `Source title: ${source.title || source.id || 'untitled'}`,
    `Source id: ${source.id || source.sourceId || 'unknown'}`,
    '',
    'Read this source and extract only authentication-related changes, decisions, migrations, fixes, and behavior changes.',
    'Return concise structured data only. Prefer exact dates/versions when present; otherwise keep dateHint conservative.',
    'For each change, provide a stable changeKey derived from the same underlying change (e.g. "passwordless-login-rollout", "sso-session-cookie-hardening").',
    'Keep each summary to one sentence. Keep evidence short: URLs, PR numbers, section headings, or short identifiers only.',
    'Do not invent details. If the source is weakly related, return an empty changes array and explain in the top-level evidence.',
    '',
    'Output must fit the schema.',
  ].join('\n')
}

function runSource(source) {
  return agent(buildSourcePrompt(source), {
    label: `source:${source.id || source.sourceId || source.title}`,
    phase: 'Discover',
    schema: SOURCE_SCHEMA,
    effort: 'medium',
  })
}

function keyForChange(change) {
  return String(change?.changeKey || change?.summary || '').trim().toLowerCase()
}

function mergeEvidence(a = [], b = []) {
  const seen = new Set()
  const out = []
  for (const item of [...a, ...b]) {
    const s = String(item || '').trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
    if (out.length >= 6) break
  }
  return out
}

const waves = chunk(SOURCES, WAVE_SIZE)
const perSource = []
let failedSources = []

for (let w = 0; w < waves.length; w++) {
  phase(`Discover wave ${w + 1}/${waves.length}`)
  const batch = await parallel(waves[w].map((source) => () => runSource(source)))
  batch.forEach((result, i) => {
    const source = waves[w][i]
    if (result) {
      perSource.push(result)
    } else {
      failedSources.push(source)
    }
  })

  const nulls = batch.filter((r) => r === null).length
  log(`Wave ${w + 1}: ${batch.length - nulls}/${batch.length} sources returned; ${failedSources.length} queued for retry`)
  if (batch.length && nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} failed this wave — backing off; returning partial results for resume`)
    break
  }
}

if (failedSources.length) {
  phase('Retry')
  const retried = await parallel(failedSources.map((source) => () => runSource(source)))
  const stillFailed = []
  retried.forEach((result, i) => {
    if (result) perSource.push(result)
    else stillFailed.push(failedSources[i])
  })
  failedSources = stillFailed
  log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failedSources.length}`)
}

phase('Deduplicate')
const deduped = new Map()

for (const src of perSource) {
  for (const change of src.changes || []) {
    const k = keyForChange(change)
    if (!k) continue
    const existing = deduped.get(k)
    const normalized = {
      changeKey: k,
      summary: String(change.summary || '').trim(),
      impact: String(change.impact || '').trim(),
      evidence: Array.isArray(change.evidence) ? change.evidence.map((x) => String(x).trim()).filter(Boolean).slice(0, 6) : [],
      sources: [src.sourceId || src.title || 'unknown'],
      dateHint: String(src.dateHint || '').trim(),
    }
    if (!existing) {
      deduped.set(k, normalized)
    } else {
      existing.sources = Array.from(new Set([...existing.sources, normalized.sources[0]])).slice(0, 12)
      existing.evidence = mergeEvidence(existing.evidence, normalized.evidence)
      if (!existing.dateHint && normalized.dateHint) existing.dateHint = normalized.dateHint
      if (normalized.summary && normalized.summary.length > existing.summary.length) existing.summary = normalized.summary
      if (normalized.impact && normalized.impact.length > existing.impact.length) existing.impact = normalized.impact
    }
  }
}

const dedupedChanges = Array.from(deduped.values()).sort((a, b) => {
  const ad = String(a.dateHint || '')
  const bd = String(b.dateHint || '')
  if (ad !== bd) return ad < bd ? -1 : 1
  return a.changeKey < b.changeKey ? -1 : 1
})

const haveKeys = new Set(perSource.map((r) => r.sourceId || r.title || '').filter(Boolean))
const missingSources = SOURCES.filter((s) => !haveKeys.has(s.id || s.sourceId || s.title || '')).map(
  (s) => s.id || s.sourceId || s.title || 'unknown'
)
if (missingSources.length) {
  log(`⚠ partial: missing ${missingSources.length}/${SOURCES.length} sources: ${missingSources.join(', ')}`)
}

phase('Synthesize')
const synthesisInput = JSON.stringify(
  {
    question: QUESTION,
    sourceCount: SOURCES.length,
    parsedSourceCount: perSource.length,
    missingSources,
    changes: dedupedChanges,
  },
  null,
  2
)

const synthesisPrompt = [
  `Answer the question: "${QUESTION}"`,
  '',
  'You are given deduplicated change records extracted from 33 design docs and pull requests.',
  'Write a cited timeline of how authentication changed over the last year.',
  'Rules:',
  '- Be faithful to the evidence. Do not invent missing dates or causal links.',
  '- Organize chronologically when possible.',
  '- Explicitly call out gaps, uncertainty, and conflicting evidence.',
  '- Cite each bullet with source ids/titles from the provided data.',
  '- Prefer concise, decision-oriented phrasing.',
  '',
  `DATA:\n${synthesisInput}`,
].join('\n')

const synthesisSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'timeline', 'gaps'],
  properties: {
    answer: { type: 'string' },
    timeline: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['when', 'whatChanged', 'whyItMattered', 'citations'],
        properties: {
          when: { type: 'string' },
          whatChanged: { type: 'string' },
          whyItMattered: { type: 'string' },
          citations: {
            type: 'array',
            maxItems: 6,
            items: { type: 'string' },
          },
        },
      },
    },
    gaps: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string' },
    },
  },
}

const synthesis = await agent(synthesisPrompt, {
  label: 'synthesis',
  phase: 'Synthesize',
  schema: synthesisSchema,
  effort: 'high',
})

return {
  question: QUESTION,
  sourceCount: SOURCES.length,
  parsedSourceCount: perSource.length,
  missingSources,
  dedupedChanges,
  synthesis,
}
```

> **Claude judge:** The script implements bounded waves (size 6), per-agent null-tolerance with a retry wave, per-wave result accumulation, deterministic prompts, capped schemas, gap-flagging synthesis, and a high-failure-rate backoff — covering 7 of 8 safety properties. The sole missing element is an armed ScheduleWakeup stall watchdog, meaning a single hung agent connection could block the run indefinitely without notification, which keeps the score below 0.8.

