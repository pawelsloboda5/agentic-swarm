# multi-source-qa — `gpt-4.1`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for MULTI-SOURCE QA: answer "how did our authentication system change over the last year?" by reading 33 design docs and pull requests. Each source is read by an agent that returns the relevant changes; dedupe across sources; synthesize a cited timeline.

---

## Baseline (no skill) — rubric 18%, patterns 31%

```js
export const meta = {
  name: 'multi-source-auth-system-change-qa',
  description: 'Answers "how did our authentication system change over the last year?" by reading 33 design docs and PRs, deduping, and synthesizing a cited timeline.',
  phases: [
    { title: 'Extract Changes from Sources' },
    { title: 'Deduplicate Changes' },
    { title: 'Synthesize Cited Timeline' }
  ],
}

// args: { sources: Array<{ id: string, title: string, content: string, type: 'doc'|'pr', url?: string }> }

phase('Extract Changes from Sources')
log(`Reading ${args.sources.length} sources for authentication system changes...`)

// Step 1: Extract relevant changes from each source
const extracted = await parallel(
  args.sources.map((source, idx) => async () => {
    const prompt = `
You are reviewing the following ${source.type === 'pr' ? 'pull request' : 'design document'} about our authentication system.

Title: ${source.title}
${source.url ? `URL: ${source.url}` : ''}
Content:
${source.content}

Task:
- Identify and summarize all changes to the authentication system described in this source that occurred in the last year.
- For each change, include:
  - A concise summary (1-2 sentences)
  - The approximate date or date range (if available)
  - Why or how the change was made (if described)
  - The source title and URL (for citation)
- If no relevant changes are described, return an empty array.

Respond as a JSON array of objects with:
  - summary: string
  - date: string (or null)
  - rationale: string (or null)
  - source_title: string
  - source_url: string (or null)
`
    return await agent(prompt, {
      label: `Extract changes from "${source.title}"`,
      phase: 'Extract Changes from Sources',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            date: { type: ['string', 'null'] },
            rationale: { type: ['string', 'null'] },
            source_title: { type: 'string' },
            source_url: { type: ['string', 'null'] }
          },
          required: ['summary', 'date', 'rationale', 'source_title', 'source_url']
        }
      },
      effort: 'medium'
    })
  })
)

// Flatten and filter out nulls/empties
const allChanges = (extracted || [])
  .filter(Boolean)
  .flat()
  .filter(Boolean)
  .flat()
  .filter(change => change && change.summary && change.summary.trim().length > 0)

if (allChanges.length === 0) {
  log('No relevant authentication system changes found in any source.')
  return []
}

phase('Deduplicate Changes')
log(`Deduplicating ${allChanges.length} extracted changes...`)

// Step 2: Deduplicate changes across sources
const deduped = await agent(`
You are given a list of changes to the authentication system, each with a summary, date, rationale, and citation.

Task:
- Group together changes that refer to the same or highly similar underlying change (even if worded differently or cited from different sources).
- For each deduplicated change, produce:
  - A merged summary (combine the best details from all grouped summaries, 1-3 sentences)
  - The most precise date or date range available
  - A merged rationale (combine the best details from all grouped rationales)
  - An array of all source titles and URLs that cited this change

Input (JSON array):
${JSON.stringify(allChanges, null, 2)}

Respond as a JSON array of objects with:
  - summary: string
  - date: string (or null)
  - rationale: string (or null)
  - citations: array of { source_title: string, source_url: string|null }
`, {
  label: 'Deduplicate changes',
  phase: 'Deduplicate Changes',
  schema: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        date: { type: ['string', 'null'] },
        rationale: { type: ['string', 'null'] },
        citations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source_title: { type: 'string' },
              source_url: { type: ['string', 'null'] }
            },
            required: ['source_title', 'source_url']
          }
        }
      },
      required: ['summary', 'date', 'rationale', 'citations']
    }
  },
  effort: 'high'
})

if (!deduped || deduped.length === 0) {
  log('No deduplicated changes found.')
  return []
}

phase('Synthesize Cited Timeline')
log(`Synthesizing a cited timeline from ${deduped.length} deduplicated changes...`)

// Step 3: Synthesize a cited timeline
const timeline = await agent(`
You are to synthesize a clear, chronological timeline of how our authentication system changed over the last year, based on the deduplicated changes below.

For each change:
- Place it in order by date (earliest to latest; if date is missing, place at the end).
- For each, write a concise entry:
  - What changed (summary)
  - When (date or "date unknown")
  - Why/how (rationale, if available)
  - Cite all relevant sources in parentheses, e.g., (Source: "Doc Title" [URL], "PR Title" [URL])

Input (JSON array):
${JSON.stringify(deduped, null, 2)}

Output:
A markdown-formatted, cited timeline. Each entry should be a bullet point, in chronological order, with clear citations.
`, {
  label: 'Synthesize cited timeline',
  phase: 'Synthesize Cited Timeline',
  model: 'claude-3-opus-20240229',
  effort: 'high'
})

return timeline
```

> **Claude judge:** The script fans out all 33 sources in a single unbounded `parallel()` call (no bounded waves of 6-8), has no per-agent retry logic, no ScheduleWakeup watchdog, no per-wave result commits (single hard barrier before dedup), no backoff on high failure rates, and no explicit gap-flagging in synthesis. It does have null-tolerance filtering and uses deterministic prompts (no Date.now/Math.random), and schemas are reasonably lean. Overall it scores very low on the safety-by-construction criteria.

## With skill — rubric 88%, patterns 100%

```js
export const meta = {
  name: 'multi-source-auth-change-qa',
  description: 'Answers "how did our authentication system change over the last year?" by reading 33 design docs and PRs, deduping, and synthesizing a cited timeline.',
  phases: [
    { title: 'Extract Changes' },
    { title: 'Deduplicate' },
    { title: 'Synthesize Timeline' }
  ]
}

// --- CONFIGURATION ---

// List of 33 sources: each { key, title, url, type } (type: 'design doc' | 'pull request')
const SOURCES = [
  // Example entries; fill in with real data
  { key: 'PR-123', title: 'Refactor Auth Flow', url: 'https://github.com/org/repo/pull/123', type: 'pull request' },
  { key: 'DOC-2023-01', title: 'Authentication System 2023 Design', url: 'https://docs.company.com/designs/auth-2023', type: 'design doc' },
  // ... 31 more ...
]

// Schema for per-source extraction: array of changes, each with date, summary, detail, and citation
const CHANGE_SCHEMA = {
  type: 'object',
  properties: {
    sourceKey: { type: 'string' },
    changes: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD or month if only approximate' },
          summary: { type: 'string', description: 'One-line summary of the change' },
          detail: { type: 'string', description: '1-2 sentence detail of what changed and why' },
          citation: { type: 'string', description: 'URL of the source (PR or doc)' }
        },
        required: ['date', 'summary', 'citation']
      }
    }
  },
  required: ['sourceKey', 'changes']
}

// --- UTILS ---

const WAVE_SIZE = 6
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }

// Stable prompt builder for extraction
function buildExtractPrompt(source) {
  return `
You are reviewing the following ${source.type} to answer: "How did our authentication system change over the last year?"

Source title: ${source.title}
Source URL: ${source.url}

Instructions:
- Read the source and extract up to 8 distinct, relevant changes to the authentication system described or implemented in this document/PR.
- For each change, provide:
  - The date (YYYY-MM-DD or month, as precise as possible, from the doc/PR metadata or content)
  - A one-line summary
  - 1-2 sentences of detail (what changed, why, context)
  - The citation (the source URL above)
- Only include changes that occurred or were planned/implemented in the last year.
- If the source is not relevant, return an empty array for "changes".
- Your output must fill the provided schema exactly.
`
}

// --- MAIN SCRIPT ---

phase('Extract Changes')

const waves = chunk(SOURCES, WAVE_SIZE)
const extracted = []
let failed = []

// Per-source extraction agent
async function runExtract(source) {
  return agent(
    buildExtractPrompt(source),
    {
      label: `extract:${source.key}`,
      phase: 'Extract Changes',
      schema: CHANGE_SCHEMA,
      effort: 'medium'
    }
  )
}

// Wave loop with safe-swarm patterns
for (let w = 0; w < waves.length; w++) {
  phase(`Wave ${w + 1}/${waves.length}`)
  const batch = await parallel(waves[w].map(src => () => runExtract(src)))
  batch.forEach((r, i) => (r ? extracted.push(r) : failed.push(waves[w][i])))
  log(`Wave ${w + 1}: ${extracted.length}/${SOURCES.length} sources extracted, ${failed.length} to retry`)
  // Instability backoff (Pattern 8)
  const nulls = batch.filter(r => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`⚠ instability: ${nulls}/${batch.length} failed this wave — backing off. Returning partial; resume later.`)
    break
  }
}

// Retry wave for failed sources
if (failed.length) {
  phase('Retry')
  const retried = await parallel(failed.map(src => () => runExtract(src)))
  const stillFailed = []
  retried.forEach((r, i) => (r ? extracted.push(r) : stillFailed.push(failed[i])))
  failed = stillFailed
  log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

// --- DEDUPLICATION ---

phase('Deduplicate')

// Flatten all changes, tag with sourceKey
const allChanges = []
for (const result of extracted) {
  if (result && Array.isArray(result.changes)) {
    for (const ch of result.changes) {
      allChanges.push({
        ...ch,
        sourceKey: result.sourceKey
      })
    }
  }
}

// Deduplication agent prompt
function buildDedupePrompt(changes) {
  return `
You are given a list of authentication system changes extracted from multiple sources (design docs and pull requests).
Some changes may be duplicated across sources or described with different wording.

Instructions:
- Deduplicate the list: group together changes that refer to the same underlying event or modification, even if described differently.
- For each unique change, provide:
  - The earliest date among the grouped changes
  - A merged one-line summary
  - A merged 1-2 sentence detail (combine context from all sources)
  - An array of citations (URLs) from all grouped sources
- Return an array of unique changes, sorted by date ascending.
- Do not drop any unique change; if unsure, keep as separate.
- Your output must fill the provided schema exactly.

Input changes:
${JSON.stringify(changes.slice(0, 48), null, 2)}${changes.length > 48 ? `\n...and ${changes.length - 48} more omitted for brevity` : ''}
`
}

// Deduped change schema
const DEDUPED_SCHEMA = {
  type: 'array',
  maxItems: 48,
  items: {
    type: 'object',
    properties: {
      date: { type: 'string' },
      summary: { type: 'string' },
      detail: { type: 'string' },
      citations: {
        type: 'array',
        maxItems: 6,
        items: { type: 'string' }
      }
    },
    required: ['date', 'summary', 'citations']
  }
}

const deduped = await agent(
  buildDedupePrompt(allChanges),
  {
    label: 'deduplicate',
    phase: 'Deduplicate',
    schema: DEDUPED_SCHEMA,
    effort: 'high'
  }
)

// --- SYNTHESIS ---

phase('Synthesize Timeline')

const missingKeys = SOURCES.filter(src =>
  !extracted.some(r => r && r.sourceKey === src.key)
).map(src => src.key)

const synthPrompt = `
You are to synthesize a cited timeline answering:

"How did our authentication system change over the last year?"

Instructions:
- Use the deduplicated list of changes below.
- Write a clear, chronological timeline of the key changes, with dates.
- For each change, cite the relevant sources (URLs) in parentheses.
- If any sources could not be read, explicitly list them at the end as "unread sources".
- If any gaps or uncertainties remain, flag them in a "Gaps or Uncertainties" section.
- Your output must fill the provided schema exactly.

Deduplicated changes:
${JSON.stringify(deduped, null, 2)}

Unread sources: ${missingKeys.length ? missingKeys.join(', ') : 'None'}
`

const SYNTHESIS_SCHEMA = {
  type: 'object',
  properties: {
    timeline: { type: 'string', description: 'Chronological, cited timeline of changes' },
    gaps: { type: 'string', description: 'Explicitly list any gaps, unread sources, or uncertainties' }
  },
  required: ['timeline', 'gaps']
}

const synthesis = await agent(
  synthPrompt,
  {
    label: 'synthesize-timeline',
    phase: 'Synthesize Timeline',
    schema: SYNTHESIS_SCHEMA,
    effort: 'high'
  }
)

// --- RETURN ---

return {
  deduplicated: deduped,
  synthesis,
  missingSources: missingKeys
}

// --- ARM WATCHDOG (Pattern 4) ---
// (This is NOT part of the script body, but must be armed at the agent level after launch!)
// ScheduleWakeup({
//   delaySeconds: 1200,
//   reason: "watchdog: swarm wf_<id> may stall silently; check journal mtime",
//   prompt: "Watchdog for run wf_<id>: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
// })
```

> **Claude judge:** All eight safety properties are present: bounded 6-item waves, per-agent null-tolerance with a retry wave, incremental per-wave result accumulation, a detailed ScheduleWakeup watchdog comment, deterministic prompts, capped schemas, gap-flagging synthesis, and a >40% failure-rate backoff break. Minor gaps are that the watchdog is a comment rather than live code and per-wave commits are in-memory only, but these are within the rubric's allowances.

