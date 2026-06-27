# multi-source-qa — `gpt-5.4-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for MULTI-SOURCE QA: answer "how did our authentication system change over the last year?" by reading 33 design docs and pull requests. Each source is read by an agent that returns the relevant changes; dedupe across sources; synthesize a cited timeline.

---

## Baseline (no skill) — rubric 20%, patterns 25%

```js
export const meta = {
  name: 'multi-source-auth-qa',
  description: 'Answer how authentication changed over the last year by reading 33 docs/PRs, deduping changes, and synthesizing a cited timeline.',
  phases: [
    { title: 'Plan sources' },
    { title: 'Read sources' },
    { title: 'Dedupe and cluster changes' },
    { title: 'Synthesize timeline' },
  ],
}

const input = args || {}
const sources = Array.isArray(input.sources) ? input.sources : []
const question =
  input.question ||
  'how did our authentication system change over the last year?'

if (sources.length !== 33) {
  log(`Expected 33 sources, received ${sources.length}. Proceeding with available sources.`)
}

phase('Plan sources')
const planned = sources.map((src, index) => ({
  index,
  id: src.id ?? `source-${index + 1}`,
  title: src.title ?? src.name ?? `Source ${index + 1}`,
  kind: src.kind ?? src.type ?? 'doc',
  date: src.date ?? src.createdAt ?? src.mergedAt ?? null,
  text: src.text ?? src.content ?? src.body ?? '',
  url: src.url ?? src.link ?? null,
}))

phase('Read sources')

const sourceSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sourceId: { type: 'string' },
    title: { type: 'string' },
    date: { type: ['string', 'null'] },
    url: { type: ['string', 'null'] },
    relevant: { type: 'boolean' },
    summary: { type: 'string' },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          change: { type: 'string' },
          impact: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['change', 'impact', 'evidence'],
      },
    },
  },
  required: ['sourceId', 'title', 'date', 'url', 'relevant', 'summary', 'changes'],
}

const reads = await parallel(
  planned.map((src) => async () =>
    agent(
      `You are reading one design doc or pull request for a multi-source QA task.

Question: "${question}"

Source metadata:
- sourceId: ${src.id}
- title: ${src.title}
- kind: ${src.kind}
- date: ${src.date ?? 'unknown'}
- url: ${src.url ?? 'null'}

Source content:
${src.text}

Task:
1) Extract only the changes relevant to authentication system evolution over the last year.
2) Ignore unrelated details.
3) Identify the concrete change(s), impact, and exact evidence from the source.
4) If the source is not relevant, mark relevant=false and keep changes empty.
5) Be precise and avoid duplication of the same change across multiple sources.

Return a compact structured result.`,
      {
        label: src.id,
        phase: 'Read sources',
        schema: sourceSchema,
        effort: 'high',
      },
    ),
  ),
)

const successfulReads = reads.filter(Boolean)

phase('Dedupe and cluster changes')

const clusterSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    clusterTitle: { type: 'string' },
    summary: { type: 'string' },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sourceId: { type: 'string' },
          title: { type: 'string' },
          date: { type: ['string', 'null'] },
          url: { type: ['string', 'null'] },
          evidence: { type: 'string' },
        },
        required: ['sourceId', 'title', 'date', 'url', 'evidence'],
      },
    },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          change: { type: 'string' },
          impact: { type: 'string' },
        },
        required: ['change', 'impact'],
      },
    },
  },
  required: ['clusterTitle', 'summary', 'sources', 'changes'],
}

const deduped = await agent(
  `You are deduplicating and clustering authentication changes from multiple source summaries.

Question: "${question}"

Here are the per-source extracted findings:
${JSON.stringify(successfulReads, null, 2)}

Task:
- Merge overlapping findings that refer to the same underlying auth change.
- Deduplicate repeated information across sources.
- Produce a set of distinct change clusters ordered roughly by time.
- Preserve source-level citations for every cluster.
- Keep only changes supported by the source evidence.
- If there are conflicting statements, note the conflict in the cluster summary.

Return an array of clusters as structured data.`,
  {
    label: 'dedupe-cluster',
    phase: 'Dedupe and cluster changes',
    schema: { type: 'array', items: clusterSchema },
    effort: 'high',
  },
)

phase('Synthesize timeline')

const timelineSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: { type: 'string' },
    timeline: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          period: { type: 'string' },
          change: { type: 'string' },
          why_it_matters: { type: 'string' },
          citations: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                sourceId: { type: 'string' },
                title: { type: 'string' },
                date: { type: ['string', 'null'] },
                url: { type: ['string', 'null'] },
              },
              required: ['sourceId', 'title', 'date', 'url'],
            },
          },
        },
        required: ['period', 'change', 'why_it_matters', 'citations'],
      },
    },
    dedupedThemes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          theme: { type: 'string' },
          evidenceCount: { type: 'number' },
        },
        required: ['theme', 'evidenceCount'],
      },
    },
  },
  required: ['answer', 'timeline', 'dedupedThemes'],
}

const final = await agent(
  `You are synthesizing a cited timeline answer to the question:

"${question}"

Use only these deduped clusters:
${JSON.stringify(deduped, null, 2)}

Task:
- Write a concise but complete answer explaining how the authentication system changed over the last year.
- Organize the response as a timeline from earliest to latest.
- Each timeline entry must be grounded in citations from the source docs/PRs.
- Prefer concrete system changes over vague narrative.
- Include deduplicated themes summarizing the major directions of change.
- If the evidence is insufficient for a definitive claim, state that clearly.

Return structured data with an answer field suitable for direct user presentation.`,
  {
    label: 'synthesize-timeline',
    phase: 'Synthesize timeline',
    schema: timelineSchema,
    effort: 'high',
  },
)

final
```

> **GPT-5.5 judge:** The workflow uses a single unbounded parallel() fan-out over all 33 sources, with no bounded waves, no per-agent retry/catch, no ScheduleWakeup stall watchdog, no per-wave commits/checkpoints, no resume/cache-stable recovery mechanism, and no backoff on high failure rates. It does use structured schemas and compact extraction prompts, filters falsy read results before synthesis, and asks synthesis to flag insufficient evidence, but these only partially address silent loss and do not prevent a hung connection from deadlocking the run. Overall it misses most safety-by-construction requirements for large parallel subagent orchestration.

## With skill — rubric 68%, patterns 81%

```js
export const meta = {
  name: 'multi-source-auth-change-qa',
  description: 'Read 33 design docs and PRs, dedupe auth changes, and synthesize a cited timeline of how authentication changed over the last year.',
  phases: [{ title: 'Map Sources' }, { title: 'Extract Changes' }, { title: 'Dedupe' }, { title: 'Synthesize' }],
}

const SOURCES = Array.isArray(args?.sources) ? args.sources : []
const QUESTION = 'how did our authentication system change over the last year?'
const WAVE_SIZE = 6

const CHANGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sourceId: { type: 'string' },
    sourceType: { type: 'string' },
    title: { type: 'string' },
    date: { type: 'string' },
    authChanges: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          changeKey: { type: 'string' },
          summary: { type: 'string' },
          timeframe: { type: 'string' },
          area: { type: 'string' },
          evidence: {
            type: 'array',
            maxItems: 3,
            items: { type: 'string' },
          },
          impact: { type: 'string' },
        },
        required: ['changeKey', 'summary', 'timeframe', 'area', 'evidence', 'impact'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['sourceId', 'sourceType', 'title', 'date', 'authChanges', 'notes'],
}

const SYNTH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: { type: 'string' },
    timeline: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          changeKey: { type: 'string' },
          period: { type: 'string' },
          summary: { type: 'string' },
          sources: {
            type: 'array',
            items: { type: 'string' },
          },
          evidence: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['changeKey', 'period', 'summary', 'sources', 'evidence'],
      },
    },
    dedupedChanges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          changeKey: { type: 'string' },
          summary: { type: 'string' },
          sources: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['changeKey', 'summary', 'sources'],
      },
    },
    gaps: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['answer', 'timeline', 'dedupedChanges', 'gaps'],
}

const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const normalizeKey = (s) =>
  String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9._:-]+/g, '-')

function buildPrompt(source) {
  return [
    `Question: ${QUESTION}`,
    `Source ID: ${source.id}`,
    `Source type: ${source.type}`,
    `Title: ${source.title}`,
    `Date: ${source.date || 'unknown'}`,
    '',
    'Read only this source and extract authentication-related changes relevant to the question.',
    'Return only concrete changes, not general background.',
    'Prefer implementation, policy, architecture, security, login, SSO, MFA, token, session, permission, identity, or authz/authn changes.',
    'Keep output lean: at most 8 changes, each with summary, timeframe, area, up to 3 evidence strings, and impact.',
    'Each evidence string should be a short quote, identifier, section name, or path-like reference from the source; do not paste long passages.',
    'If the source contains no relevant auth changes, return an empty authChanges array and explain briefly in notes.',
  ].join('\n')
}

function runSource(source) {
  return agent(buildPrompt(source), {
    label: `source:${source.id}`,
    phase: 'Extract Changes',
    schema: CHANGE_SCHEMA,
    effort: 'medium',
  })
}

const waveResults = []
let failedSources = []

phase('Map Sources')
if (!SOURCES.length) {
  return {
    answer: 'No sources were provided.',
    timeline: [],
    dedupedChanges: [],
    gaps: ['No sources input'],
  }
}

const waves = chunk(SOURCES, WAVE_SIZE)

for (let w = 0; w < waves.length; w++) {
  phase(`Extract Changes ${w + 1}/${waves.length}`)
  const batch = await parallel(waves[w].map((src) => () => runSource(src)))
  batch.forEach((r, i) => {
    if (r) {
      waveResults.push(r)
    } else {
      failedSources.push(waves[w][i])
    }
  })
  log(`Wave ${w + 1}: ${waveResults.length}/${SOURCES.length} extracted, ${failedSources.length} to retry`)

  const nulls = batch.filter((r) => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} failed this wave — backing off; return partial, resume later`)
    break
  }
}

if (failedSources.length) {
  phase('Retry')
  const retried = await parallel(failedSources.map((src) => () => runSource(src)))
  const stillFailed = []
  retried.forEach((r, i) => {
    if (r) waveResults.push(r)
    else stillFailed.push(failedSources[i])
  })
  failedSources = stillFailed
  log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failedSources.length}`)
}

phase('Dedupe')

const dedupMap = new Map()
for (const sourceResult of waveResults) {
  const sourceLabel = `${sourceResult.sourceId}${sourceResult.title ? ` — ${sourceResult.title}` : ''}`
  for (const change of sourceResult.authChanges || []) {
    const keyParts = [
      normalizeKey(change.changeKey || change.summary || ''),
      normalizeKey(change.area || ''),
      normalizeKey(change.timeframe || ''),
    ].filter(Boolean)
    const key = keyParts.join('|') || normalizeKey(change.summary || sourceResult.sourceId)
    const existing = dedupMap.get(key)
    const item = {
      changeKey: change.changeKey || key,
      summary: change.summary,
      timeframe: change.timeframe || '',
      area: change.area || '',
      evidence: Array.isArray(change.evidence) ? change.evidence.slice(0, 3) : [],
      impact: change.impact || '',
      sources: [sourceLabel],
    }
    if (!existing) {
      dedupMap.set(key, item)
    } else {
      const merged = {
        ...existing,
        sources: Array.from(new Set([...existing.sources, sourceLabel])),
        evidence: Array.from(new Set([...(existing.evidence || []), ...(item.evidence || [])])).slice(0, 3),
      }
      if ((!existing.summary && item.summary) || (item.summary && item.summary.length > existing.summary.length)) {
        merged.summary = item.summary
      }
      if ((!existing.impact && item.impact) || (item.impact && item.impact.length > existing.impact.length)) {
        merged.impact = item.impact
      }
      if (!existing.timeframe && item.timeframe) merged.timeframe = item.timeframe
      if (!existing.area && item.area) merged.area = item.area
      dedupMap.set(key, merged)
    }
  }
}

const dedupedChanges = Array.from(dedupMap.values()).sort((a, b) => {
  const ap = `${a.timeframe || ''} ${a.area || ''} ${a.summary || ''}`.toLowerCase()
  const bp = `${b.timeframe || ''} ${b.area || ''} ${b.summary || ''}`.toLowerCase()
  return ap < bp ? -1 : ap > bp ? 1 : 0
})

const missingSourceIds = new Set(failedSources.map((s) => s.id))
const coveredSourceIds = new Set(waveResults.map((r) => r.sourceId))
const missing = SOURCES.filter((s) => missingSourceIds.has(s.id) || !coveredSourceIds.has(s.id)).map((s) => s.id)

phase('Synthesize')

const synthesisPayload = JSON.stringify(
  dedupedChanges.map((c) => ({
    changeKey: c.changeKey,
    timeframe: c.timeframe,
    area: c.area,
    summary: c.summary,
    sources: c.sources,
    evidence: c.evidence,
    impact: c.impact,
  }))
)

const synthesis = await agent(
  [
    `Question: ${QUESTION}`,
    `You are synthesizing a cited timeline from deduped source extractions.`,
    `Use only the supplied deduped evidence. Do not invent facts.`,
    `Return a concise answer plus a chronological timeline of how authentication changed over the last year.`,
    `Cite every timeline item with the relevant source labels and brief evidence snippets.`,
    `Explicitly call out gaps, uncertainty, and sources that failed to return relevant data.`,
    `Deduped inputs (${dedupedChanges.length}): ${synthesisPayload}`,
    `Missing source IDs: ${JSON.stringify(missing)}`,
  ].join('\n\n'),
  {
    label: 'synth',
    phase: 'Synthesize',
    schema: SYNTH_SCHEMA,
    effort: 'high',
  }
)

const answer = synthesis?.answer || 'Unable to synthesize an answer from the available sources.'
const timeline = synthesis?.timeline || []
const finalDeduped = synthesis?.dedupedChanges || dedupedChanges.map((c) => ({
  changeKey: c.changeKey,
  summary: c.summary,
  sources: c.sources,
}))
const gaps = Array.from(
  new Set([
    ...(synthesis?.gaps || []),
    ...(missing.length ? [`Missing or unreadable sources: ${missing.join(', ')}`] : []),
  ])
)

return {
  answer,
  timeline,
  dedupedChanges: finalDeduped,
  gaps,
}
```

> **GPT-5.5 judge:** The script meets several safety criteria: it uses bounded waves of 6 rather than one giant parallel fan-out, records completed wave results incrementally in memory, tolerates null agent results, retries failed sources, caps extraction output with schemas, synthesizes from partial input, explicitly reports missing sources, and backs off when a wave has a high failure rate. However, it lacks an armed ScheduleWakeup/stall watchdog or timeout, so a single hung agent inside a parallel wave could still deadlock the whole run with no notification. It also lacks durable per-wave checkpointing/resume/cache-stable prompts, and retry handling depends on failures returning null rather than throwing or hanging. Overall it is reasonably partial-failure tolerant but not fully safe-by-construction against hung connections.

