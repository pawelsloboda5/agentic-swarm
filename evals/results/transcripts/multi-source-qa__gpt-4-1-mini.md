# multi-source-qa — `gpt-4.1-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for MULTI-SOURCE QA: answer "how did our authentication system change over the last year?" by reading 33 design docs and pull requests. Each source is read by an agent that returns the relevant changes; dedupe across sources; synthesize a cited timeline.

---

## Baseline (no skill) — rubric 20%, patterns 38%

```js
export const meta = {
  name: 'multi-source-auth-changes-qa',
  description: 'Answer how the authentication system changed over the last year by reading 33 design docs and PRs, deduping, and synthesizing a cited timeline.',
  phases: [
    { title: 'Extract Changes' },
    { title: 'Deduplicate Changes' },
    { title: 'Synthesize Timeline' },
  ],
}

const SOURCES = [
  // Example source objects with minimal info; in real use, these would be passed in args or loaded.
  // Here we simulate 33 sources named "Doc 1" to "Doc 20" and "PR 1" to "PR 13".
  ...Array.from({ length: 20 }, (_, i) => ({ id: `doc-${i+1}`, type: 'design doc', title: `Design Doc ${i+1}` })),
  ...Array.from({ length: 13 }, (_, i) => ({ id: `pr-${i+1}`, type: 'pull request', title: `Pull Request ${i+1}` })),
]

phase('Extract Changes')

// Step 1: Extract relevant changes from each source in parallel.
// Prompt each agent with the source content and ask for relevant changes to the authentication system over the last year.
// We assume the source content is accessible via args.sources or similar; here we simulate minimal info.

async function extractChangesFromSource(source) {
  // Compose prompt to extract relevant changes from this source.
  // We want structured output: array of { date, changeSummary, details, sourceId, sourceTitle }
  // date: ISO string or approximate date
  // changeSummary: short summary of the change
  // details: optional longer explanation
  // sourceId and sourceTitle for citation

  const prompt = `
You are an expert software engineer and technical writer.

You are given a ${source.type} titled "${source.title}" describing changes related to the authentication system over the last year.

Extract all relevant changes to the authentication system described in this source.

For each change, provide:
- date (ISO 8601 format or approximate, e.g. "2023-07" or "2023-07-15")
- a concise summary of the change (1-2 sentences)
- optional detailed explanation (1-3 sentences)
- cite this source by its id and title

Output a JSON array of objects with these fields:
{
  "date": string,
  "changeSummary": string,
  "details": string|null,
  "sourceId": string,
  "sourceTitle": string
}

If no relevant changes are found, output an empty array [].

Respond ONLY with the JSON array.

Source ID: ${source.id}
Source Title: ${source.title}
  `.trim()

  // Use a schema to validate the output structure.
  const schema = {
    type: 'array',
    items: {
      type: 'object',
      required: ['date', 'changeSummary', 'details', 'sourceId', 'sourceTitle'],
      properties: {
        date: { type: 'string' },
        changeSummary: { type: 'string' },
        details: { type: ['string', 'null'] },
        sourceId: { type: 'string' },
        sourceTitle: { type: 'string' },
      },
      additionalProperties: false,
    },
  }

  // Run the agent with medium effort for accuracy.
  const changes = await agent(prompt, { schema, label: `Extract changes from ${source.id}`, phase: 'Extract Changes', effort: 'medium' })
  // If agent failed or returned null, treat as empty array.
  return changes ?? []
}

// Extract changes from all sources in parallel.
const allChangesArrays = await parallel(SOURCES.map(source => () => extractChangesFromSource(source)))

// Flatten the array of arrays into one array.
const allChanges = allChangesArrays.flat()

phase('Deduplicate Changes')

// Step 2: Deduplicate changes across sources.
// We consider changes duplicates if their summaries are very similar and dates close.
// We will cluster changes by normalized summary text and date proximity.

// Normalize text helper: lowercase, remove punctuation, trim.
function normalizeText(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '').trim()
}

// Group changes by normalized summary and date proximity (within 30 days).
// We'll build clusters incrementally.

function clusterChanges(changes) {
  const clusters = []

  // Parse date strings to Date objects for comparison.
  function parseDate(d) {
    // Try to parse ISO or partial ISO (YYYY-MM or YYYY-MM-DD)
    // If partial, parse as first day of month or year.
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d)
    if (/^\d{4}-\d{2}$/.test(d)) return new Date(d + '-01')
    if (/^\d{4}$/.test(d)) return new Date(d + '-01-01')
    // fallback: invalid date far in past
    return new Date('1900-01-01')
  }

  for (const change of changes) {
    const normSummary = normalizeText(change.changeSummary)
    const changeDate = parseDate(change.date)

    // Try to find a cluster this change fits into.
    let foundCluster = null
    for (const cluster of clusters) {
      // Check if summaries are similar enough (exact normalized match)
      // and dates within 30 days.
      const clusterNormSummary = cluster.normSummary
      const clusterDate = cluster.representativeDate

      const dateDiffDays = Math.abs((changeDate - clusterDate) / (1000 * 60 * 60 * 24))
      if (normSummary === clusterNormSummary && dateDiffDays <= 30) {
        foundCluster = cluster
        break
      }
    }

    if (foundCluster) {
      foundCluster.changes.push(change)
    } else {
      clusters.push({
        normSummary,
        representativeDate: changeDate,
        changes: [change],
      })
    }
  }

  return clusters
}

const clusters = clusterChanges(allChanges)

phase('Synthesize Timeline')

// Step 3: Synthesize a cited timeline from deduplicated clusters.
// For each cluster, produce a timeline entry with:
// - date (use representativeDate formatted as YYYY-MM-DD)
// - combined summary (use the first changeSummary)
// - combined details (concatenate unique details from all changes)
// - citations (list unique sourceId and sourceTitle pairs)

// Compose prompt to synthesize timeline from clusters.

function formatDateISO(date) {
  // Format Date object as YYYY-MM-DD
  const y = date.getUTCFullYear()
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const d = date.getUTCDate().toString().padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Prepare timeline items for prompt.
const timelineItemsForPrompt = clusters.map(cluster => {
  const dateStr = formatDateISO(cluster.representativeDate)
  const firstChange = cluster.changes[0]
  const summaries = cluster.changes.map(c => c.changeSummary)
  const detailsSet = new Set(cluster.changes.map(c => c.details).filter(d => d && d.trim().length > 0))
  const citationsSet = new Map()
  for (const c of cluster.changes) {
    citationsSet.set(c.sourceId, c.sourceTitle)
  }
  return {
    date: dateStr,
    changeSummary: firstChange.changeSummary,
    details: Array.from(detailsSet).join(' '),
    citations: Array.from(citationsSet.entries()).map(([id, title]) => ({ id, title })),
  }
})

// Compose prompt to synthesize timeline with citations.
const synthPrompt = `
You are an expert technical writer.

Given the following deduplicated timeline items describing changes to the authentication system over the last year, synthesize a clear, chronological timeline narrative.

Each item has:
- date (YYYY-MM-DD)
- a concise change summary
- optional detailed explanation
- citations (list of source IDs and titles)

Produce a timeline as a markdown list, ordered by date ascending.

For each entry:
- start with the date in bold (e.g. **2023-07-15**)
- then the change summary
- then the details if present
- then a citation line listing sources in parentheses, e.g. (Sources: Doc 3, PR 7)

Example:

**2023-07-15**: Added support for multi-factor authentication. This included integrating TOTP and SMS codes. (Sources: Design Doc 3, Pull Request 7)

Timeline items (JSON):
${JSON.stringify(timelineItemsForPrompt, null, 2)}

Respond ONLY with the markdown timeline.
`.trim()

const timelineMarkdown = await agent(synthPrompt, { label: 'Synthesize timeline', phase: 'Synthesize Timeline', effort: 'high' })

// Return the final answer as the synthesized timeline markdown.
return timelineMarkdown
```

> **Claude judge:** The script fans out all 33 sources in a single `parallel()` call (no bounded waves of 6-8), has no ScheduleWakeup watchdog, no per-wave result commits (single hard barrier before synthesis), no retry/backoff logic for failed agents (only null-coalescing to empty array), and the synthesis prompt does not explicitly flag gaps in partial input. Positives include null-tolerance via `?? []`, a lean JSON schema with capped fields, and deterministic (cache-stable) prompts with no Date.now/Math.random. Overall, the script is missing most of the safety-by-construction properties required for large parallel fan-out.

## With skill — rubric 88%, patterns 100%

```js
export const meta = {
  name: 'multi-source-auth-changes-q-a',
  description: 'Answer how the authentication system changed over the last year by reading 33 design docs and PRs',
  phases: [
    { title: 'Extract Changes' },
    { title: 'Retry Failed' },
    { title: 'Synthesize Timeline' },
  ],
}

const WAVE_SIZE = 6

// Stable list of 33 sources: design docs and PRs with stable keys and URLs
// For demo, keys are "doc1".."doc33", URLs are placeholders
const SOURCES = [
  // Example entries; replace with real keys and URLs
  { key: 'doc1', title: 'Auth Design Doc Jan 2023', url: 'https://example.com/design-doc-1' },
  { key: 'doc2', title: 'Auth PR #101', url: 'https://github.com/org/repo/pull/101' },
  { key: 'doc3', title: 'Auth Design Doc Feb 2023', url: 'https://example.com/design-doc-2' },
  { key: 'doc4', title: 'Auth PR #102', url: 'https://github.com/org/repo/pull/102' },
  { key: 'doc5', title: 'Auth Design Doc Mar 2023', url: 'https://example.com/design-doc-3' },
  { key: 'doc6', title: 'Auth PR #103', url: 'https://github.com/org/repo/pull/103' },
  { key: 'doc7', title: 'Auth Design Doc Apr 2023', url: 'https://example.com/design-doc-4' },
  { key: 'doc8', title: 'Auth PR #104', url: 'https://github.com/org/repo/pull/104' },
  { key: 'doc9', title: 'Auth Design Doc May 2023', url: 'https://example.com/design-doc-5' },
  { key: 'doc10', title: 'Auth PR #105', url: 'https://github.com/org/repo/pull/105' },
  { key: 'doc11', title: 'Auth Design Doc Jun 2023', url: 'https://example.com/design-doc-6' },
  { key: 'doc12', title: 'Auth PR #106', url: 'https://github.com/org/repo/pull/106' },
  { key: 'doc13', title: 'Auth Design Doc Jul 2023', url: 'https://example.com/design-doc-7' },
  { key: 'doc14', title: 'Auth PR #107', url: 'https://github.com/org/repo/pull/107' },
  { key: 'doc15', title: 'Auth Design Doc Aug 2023', url: 'https://example.com/design-doc-8' },
  { key: 'doc16', title: 'Auth PR #108', url: 'https://github.com/org/repo/pull/108' },
  { key: 'doc17', title: 'Auth Design Doc Sep 2023', url: 'https://example.com/design-doc-9' },
  { key: 'doc18', title: 'Auth PR #109', url: 'https://github.com/org/repo/pull/109' },
  { key: 'doc19', title: 'Auth Design Doc Oct 2023', url: 'https://example.com/design-doc-10' },
  { key: 'doc20', title: 'Auth PR #110', url: 'https://github.com/org/repo/pull/110' },
  { key: 'doc21', title: 'Auth Design Doc Nov 2023', url: 'https://example.com/design-doc-11' },
  { key: 'doc22', title: 'Auth PR #111', url: 'https://github.com/org/repo/pull/111' },
  { key: 'doc23', title: 'Auth Design Doc Dec 2023', url: 'https://example.com/design-doc-12' },
  { key: 'doc24', title: 'Auth PR #112', url: 'https://github.com/org/repo/pull/112' },
  { key: 'doc25', title: 'Auth Design Doc Jan 2024', url: 'https://example.com/design-doc-13' },
  { key: 'doc26', title: 'Auth PR #113', url: 'https://github.com/org/repo/pull/113' },
  { key: 'doc27', title: 'Auth Design Doc Feb 2024', url: 'https://example.com/design-doc-14' },
  { key: 'doc28', title: 'Auth PR #114', url: 'https://github.com/org/repo/pull/114' },
  { key: 'doc29', title: 'Auth Design Doc Mar 2024', url: 'https://example.com/design-doc-15' },
  { key: 'doc30', title: 'Auth PR #115', url: 'https://github.com/org/repo/pull/115' },
  { key: 'doc31', title: 'Auth Design Doc Apr 2024', url: 'https://example.com/design-doc-16' },
  { key: 'doc32', title: 'Auth PR #116', url: 'https://github.com/org/repo/pull/116' },
  { key: 'doc33', title: 'Auth Design Doc May 2024', url: 'https://example.com/design-doc-17' },
]

// JSON Schema for each source's extracted changes
const CHANGE_SCHEMA = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    title: { type: 'string' },
    url: { type: 'string', format: 'uri' },
    changes: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date of change, ISO 8601 or YYYY-MM-DD' },
          summary: { type: 'string', description: 'One-line summary of the change' },
          detailsUrl: { type: 'string', format: 'uri', description: 'URL for more details (optional)' },
          rationale: { type: 'string', description: 'One-line rationale or why this change was made' },
        },
        required: ['date', 'summary'],
        additionalProperties: false,
      },
    },
  },
  required: ['key', 'title', 'url', 'changes'],
  additionalProperties: false,
}

// JSON Schema for the final synthesis timeline
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
          sources: {
            type: 'array',
            items: { type: 'string' }, // source keys or URLs cited
            maxItems: 5,
          },
          rationale: { type: 'string' },
        },
        required: ['date', 'summary', 'sources'],
        additionalProperties: false,
      },
    },
    gaps: {
      type: 'array',
      items: { type: 'string' },
      description: 'Keys of sources missing results',
    },
  },
  required: ['timeline', 'gaps'],
  additionalProperties: false,
}

// Build a stable prompt for extracting changes from one source
function buildExtractPrompt(source) {
  return `You are a knowledgeable assistant tasked with extracting relevant changes to our authentication system from a single source document or pull request.

Source title: ${source.title}
Source URL: ${source.url}

Please read the source carefully and return a JSON object with:
- key: the stable source key
- title: the source title
- url: the source URL
- changes: an array of up to 8 changes relevant to authentication system changes over the last year.
  Each change should have:
    - date (ISO 8601 or YYYY-MM-DD)
    - summary (one-line summary of the change)
    - rationale (one-line why this change was made)
    - detailsUrl (optional URL for more details, if any)

Return ONLY the JSON object matching this schema. Do NOT include any extra text or explanation.

Your output MUST validate against this JSON schema:
${JSON.stringify(CHANGE_SCHEMA, null, 2)}
`
}

// Build a stable prompt for synthesis from all extracted changes
function buildSynthesisPrompt(results, missingKeys) {
  // Sort results by key for stable prompt
  const sorted = [...results].sort((a, b) => (a.key > b.key ? 1 : -1))
  // Embed the JSON payload of all extracted changes
  const payload = JSON.stringify(sorted, null, 2)
  return `You are an expert technical writer tasked with synthesizing a cited timeline of how our authentication system changed over the last year.

You have extracted relevant changes from ${sorted.length} source documents and pull requests. Some sources are missing: ${JSON.stringify(missingKeys)}.

Here are the extracted changes (array of objects with key, title, url, and changes array):
${payload}

Please produce a JSON object with:
- timeline: an array of changes sorted chronologically by date, each with:
    - date
    - summary
    - sources: array of source keys or URLs cited for this change (max 5)
    - rationale
- gaps: array of source keys missing results

The timeline should deduplicate overlapping or duplicate changes across sources, merging citations.

Return ONLY the JSON object matching this JSON schema:
${JSON.stringify(TIMELINE_SCHEMA, null, 2)}

Flag any gaps explicitly; do NOT silently drop missing sources.

Your output MUST validate against the schema above.`
}

// Wrap agent call for one source extraction with stable prompt and schema
async function runExtract(source) {
  return await agent(buildExtractPrompt(source), {
    label: `extract:${source.key}`,
    phase: 'Extract Changes',
    schema: CHANGE_SCHEMA,
    effort: 'medium',
  })
}

// Main script body starts here — await allowed at top level

// Utility: chunk array into waves of size n
function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const waves = chunk(SOURCES, WAVE_SIZE)
const done = [] // collected successful results
let failed = [] // sources that failed extraction this run

// Pattern 2: run one source extraction with retry tolerance
async function runSource(source) {
  const res = await runExtract(source)
  return res // null if failed after internal retries
}

for (let w = 0; w < waves.length; w++) {
  phase(`Wave ${w + 1}/${waves.length}`)
  const batch = await parallel(waves[w].map((source) => () => runSource(source)))
  batch.forEach((r, i) => {
    if (r) done.push(r)
    else failed.push(waves[w][i])
  })
  log(`Wave ${w + 1}: ${done.length}/${SOURCES.length} extracted, ${failed.length} failed`)

  // Pattern 8: instability backoff
  const nulls = batch.filter((r) => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`⚠ instability: ${nulls}/${batch.length} failed this wave — backing off. Returning partial; resume later.`)
    break
  }
}

// Retry wave for failed sources (natural backoff)
if (failed.length) {
  phase('Retry Failed')
  const retried = await parallel(failed.map((source) => () => runSource(source)))
  const stillFailed = []
  retried.forEach((r, i) => {
    if (r) done.push(r)
    else stillFailed.push(failed[i])
  })
  failed = stillFailed
  log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

// Pattern 7: compute missing keys explicitly
const haveKeys = new Set(done.map((r) => r.key))
const missing = SOURCES.filter((s) => !haveKeys.has(s.key)).map((s) => s.key)
if (missing.length) log(`⚠ partial: missing ${missing.length}/${SOURCES.length}: ${missing.join(', ')}`)

// Pattern 5: synthesis prompt embeds inputs for stable resume and re-run on input growth
const synthesisPrompt = buildSynthesisPrompt(done, missing)
phase('Synthesize Timeline')
const synthesis = await agent(synthesisPrompt, {
  label: 'synth',
  phase: 'Synthesize',
  schema: TIMELINE_SCHEMA,
  effort: 'high',
})

// Return final deliverable with partial results, missing keys, and synthesis
return { results: done, missing, synthesis }

/*
Pattern 4: ScheduleWakeup watchdog (agent-level, not inside script body)
Emit this exact call alongside your script to catch silent stalls:

ScheduleWakeup({
  delaySeconds: 1200,
  reason: "watchdog: swarm multi-source-auth-changes-q-a may stall silently; check journal mtime",
  prompt: "Watchdog for swarm run multi-source-auth-changes-q-a: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
})
*/
```

> **Claude judge:** All eight safety properties are present: bounded waves of 6, per-agent null-tolerance with a dedicated retry wave, per-wave result accumulation, a ScheduleWakeup watchdog (as a comment, which the rubric permits), deterministic cache-stable prompts, capped schemas with additionalProperties:false, synthesis that explicitly flags gaps via a 'gaps' field, and a >40% failure-rate backoff that breaks the wave loop. Minor deductions for the watchdog being a comment rather than an armed call and for lack of durable per-wave checkpointing.

