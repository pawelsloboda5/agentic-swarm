# multi-source-qa — `gpt-4.1`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for MULTI-SOURCE QA: answer "how did our authentication system change over the last year?" by reading 33 design docs and pull requests. Each source is read by an agent that returns the relevant changes; dedupe across sources; synthesize a cited timeline.

---

## Baseline (no skill) — rubric 12%, patterns 13%

````js
```js
export const meta = {
  name: 'multi-source-auth-system-change-qa',
  description: 'Answers how the authentication system changed over the last year by reading 33 design docs and PRs, deduping, and synthesizing a cited timeline.',
  phases: [
    { title: 'Extract Relevant Changes' },
    { title: 'Deduplicate Changes' },
    { title: 'Synthesize Cited Timeline' }
  ]
}

// Helper: schema for extracted changes from each source
const changeSchema = {
  type: 'object',
  properties: {
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Concise summary of the change' },
          date: { type: 'string', description: 'Date of the change (YYYY-MM-DD or best guess)' },
          citation: { type: 'string', description: 'How to cite this source (e.g. doc/pr title or URL)' }
        },
        required: ['summary', 'date', 'citation']
      }
    }
  },
  required: ['changes']
}

// 1. Extract relevant changes from each source
phase('Extract Relevant Changes')
log('Reading all 33 sources for authentication system changes...')

// args.sources: array of { title, content, url, type } for each doc/PR
if (!Array.isArray(args.sources) || args.sources.length !== 33) {
  throw new Error('Expected args.sources to be an array of 33 sources')
}

const extractPrompt = (source) => `
You are reading a ${source.type} titled "${source.title}".
Extract all relevant changes to the authentication system described in this document, focusing on changes made in the last year.
For each change, provide:
- A concise summary (1-2 sentences)
- The date of the change (YYYY-MM-DD if available, or best estimate)
- A citation string (e.g. "${source.title}" or its URL)
Return an array of changes as described.
If there are no relevant changes, return an empty array.
Document content:
---
${source.content}
`

const extractionThunks = args.sources.map((source, i) => () =>
  agent(
    extractPrompt(source),
    {
      label: `Extract changes from source #${i + 1}: ${source.title}`,
      phase: 'Extract Relevant Changes',
      schema: changeSchema,
      effort: 'medium'
    }
  )
)

const extractionResults = await parallel(extractionThunks)

// Flatten all extracted changes, tagging with their citation
const allChanges = []
for (const result of extractionResults) {
  if (result && Array.isArray(result.changes)) {
    for (const change of result.changes) {
      // Attach a source index for later traceability
      allChanges.push({ ...change })
    }
  }
}

if (allChanges.length === 0) {
  log('No relevant authentication system changes found in any source.')
  return { timeline: [], note: 'No changes found.' }
}

// 2. Deduplicate changes across sources
phase('Deduplicate Changes')
log(`Deduplicating ${allChanges.length} extracted changes...`)

// We'll use an agent to cluster/merge similar changes, preserving all citations
const dedupePrompt = (changes) => `
You are given a list of changes to the authentication system, each with a summary, date, and citation.
Some changes may be duplicates or describe the same event in different words or from different sources.
Cluster and merge similar/identical changes into single entries, combining their citations (as an array).
For each deduplicated change, provide:
- summary: a clear, merged summary
- date: the most precise date (or best estimate) from the group
- citations: array of all unique citations for this change
Return an array of deduplicated changes, sorted by date ascending.
Input changes:
${JSON.stringify(changes, null, 2)}
`

const deduped = await agent(
  dedupePrompt(allChanges),
  {
    label: 'Deduplicate changes',
    phase: 'Deduplicate Changes',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          date: { type: 'string' },
          citations: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['summary', 'date', 'citations']
      }
    },
    effort: 'high'
  }
)

if (!Array.isArray(deduped) || deduped.length === 0) {
  log('No deduplicated changes found.')
  return { timeline: [], note: 'No deduplicated changes.' }
}

// 3. Synthesize a cited timeline
phase('Synthesize Cited Timeline')
log('
````

> **GPT-5.5 judge:** The workflow launches all 33 extraction agents in a single unbounded parallel() call, creating a hard barrier where one hung connection can deadlock the whole run. It has no ScheduleWakeup watchdog, no bounded waves, no per-agent retry handling, no per-wave commits, no resume/cache-stable prompts, no high-failure-rate backoff, and synthesis depends on all extraction work completing. It has some minimal schema use and slight null/malformed-result tolerance after parallel returns, but this does not protect against hangs or preserve partial progress robustly. The script is also truncated before synthesis is completed.

## With skill — rubric 30%, patterns 63%

````js
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

// === CONFIGURATION ===

// List of 33 sources: each { key, title, url, type }
const SOURCES = [
  // Fill in your actual sources here. Example:
  { key: 'PR-1021', title: 'Add OAuth2 support', url: 'https://github.com/org/repo/pull/1021', type: 'pull_request' },
  { key: 'DESIGN-2023-01', title: 'Authentication Refactor Design', url: 'https://docs.company.com/designs/auth-refactor', type: 'design_doc' },
  // ... 31 more ...
]

// Schema for per-source extraction: array of change objects
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
          summary: { type: 'string', description: 'One-sentence summary of the change.' },
          date: { type: 'string', description: 'Date of the change or doc/PR (YYYY-MM-DD if possible).' },
          detail: { type: 'string', description: '1-2 sentence detail of what changed and why.' },
          evidence: { type: 'string', description: 'Short quote or pointer to the relevant section.' },
          url: { type: 'string', description: 'URL of the source.' }
        },
        required: ['summary', 'date', 'detail', 'url']
      }
    }
  },
  required: ['sourceKey', 'changes']
}

// Schema for the final timeline synthesis
const TIMELINE_SCHEMA = {
  type: 'object',
  properties: {
    timeline: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          summary: { type: 'string' },
          details: { type: 'string' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                url: { type: 'string' }
              },
              required: ['key', 'url']
            }
          }
        },
        required: ['date', 'summary', 'details', 'sources']
      }
    },
    gaps: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['timeline', 'gaps']
}

// === UTILS ===

const WAVE_SIZE = 7
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }

// === MAIN SCRIPT ===

phase('Extract Changes')
log(`Launching extraction agents for ${SOURCES.length} sources in waves of ${WAVE_SIZE}...`)

function buildExtractPrompt(source) {
  return `
You are reading the following ${source.type.replace('_', ' ')} about our authentication system:

Title: ${source.title}
URL: ${source.url}

Task: Extract all relevant changes to the authentication system described in this document or PR, focusing on the last year. For each change, provide:
- A one-sentence summary
- The date (YYYY-MM-DD if available; otherwise, best estimate)
- 1-2 sentence detail of what changed and why
- A short quote or pointer to the relevant section as evidence
- The source URL

Return at most 8 changes per source. If there are no relevant changes, return an empty array.

Your output must fill this schema:
${JSON.stringify(CHANGE_SCHEMA, null, 2)}
`.trim()
}

async function runExtractAgent(source) {
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

// === SAFE SWARM WAVE LOOP ===

const waves = chunk(SOURCES, WAVE_SIZE)
const extracted = []
let failed = []

for (let w = 0; w < waves.length; w++) {
  phase(`Extract Wave ${w + 1}/${waves.length}`)
  const batch = await parallel(waves[w].map(src => () => runExtractAgent(src)))
  batch.forEach((result, i
````

> **GPT-5.5 judge:** The script uses bounded waves of 7 sources and capped extraction schemas, which are good safety measures for fan-out. However, the shown workflow lacks an armed ScheduleWakeup/stall watchdog, per-agent retry or timeout/null-tolerance handling, resume/cache-stable prompts, demonstrated per-wave durable committing of completed results, high-failure-rate backoff, and a completed synthesis phase that tolerates partial input and explicitly flags gaps. The code is also truncated before result handling is shown, so it cannot be credited for avoiding silent loss of completed work beyond the wave structure itself.

