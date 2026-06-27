# document-extraction-sweep — `gpt-4.1-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a DOCUMENT EXTRACTION SWEEP: extract structured entities (people, organizations, dates, monetary amounts) from 200 contract documents and aggregate them into a single deduplicated dataset, with per-document provenance.

---

## Baseline (no skill) — rubric 22%, patterns 25%

```js
export const meta = {
  name: 'document-extraction-sweep',
  description: 'Extract structured entities from 200 contracts and aggregate with provenance',
  phases: [
    { title: 'Extraction' },
    { title: 'Aggregation' },
  ],
}

const entitySchema = {
  type: 'object',
  properties: {
    people: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of person names extracted from the document',
    },
    organizations: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of organization names extracted from the document',
    },
    dates: {
      type: 'array',
      items: { type: 'string', format: 'date' },
      description: 'List of ISO 8601 dates extracted from the document',
    },
    monetaryAmounts: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of monetary amounts extracted from the document, as strings with currency',
    },
  },
  required: ['people', 'organizations', 'dates', 'monetaryAmounts'],
  additionalProperties: false,
}

phase('Extraction')

// args.documents is expected to be an array of 200 contract document texts
if (!Array.isArray(args.documents) || args.documents.length === 0) {
  throw new Error('Input argument "documents" must be a non-empty array of contract texts')
}

log(`Starting extraction from ${args.documents.length} documents`)

// For each document, spawn an agent to extract structured entities with provenance
// We run in parallel but capped by runtime concurrency limits automatically
const extractionThunks = args.documents.map((docText, i) => async () => {
  // Prompt to extract structured entities from one contract document
  // We ask for JSON output matching entitySchema
  const prompt = `
You are an expert information extraction agent.

Extract the following structured entities from the contract text below:
- People (full names)
- Organizations (full names)
- Dates (contract dates, deadlines, effective dates, etc.)
- Monetary amounts (with currency symbols or codes)

Return a JSON object with keys: people, organizations, dates, monetaryAmounts.
Each key maps to an array of strings. Dates should be ISO 8601 format if possible.

Contract text:
"""
${docText}
"""
Only output the JSON object, no extra text.
`

  const entities = await agent(prompt, { schema: entitySchema, label: `extract-doc-${i}`, phase: 'Extraction', effort: 'high' })
  if (entities === null) {
    log(`Extraction failed or skipped for document #${i}`)
    return null
  }
  return { docIndex: i, entities }
})

const extractionResults = await parallel(extractionThunks)

phase('Aggregation')

log('Aggregating extracted entities with provenance')

// Filter out failed extractions
const successfulExtractions = extractionResults.filter(r => r !== null)

// Aggregate entities into a single deduplicated dataset with provenance
// Structure:
// {
//   people: { [name]: Set of docIndices },
//   organizations: { [name]: Set of docIndices },
//   dates: { [date]: Set of docIndices },
//   monetaryAmounts: { [amount]: Set of docIndices },
// }
const aggregate = {
  people: new Map(),
  organizations: new Map(),
  dates: new Map(),
  monetaryAmounts: new Map(),
}

for (const { docIndex, entities } of successfulExtractions) {
  for (const person of entities.people) {
    if (!aggregate.people.has(person)) aggregate.people.set(person, new Set())
    aggregate.people.get(person).add(docIndex)
  }
  for (const org of entities.organizations) {
    if (!aggregate.organizations.has(org)) aggregate.organizations.set(org, new Set())
    aggregate.organizations.get(org).add(docIndex)
  }
  for (const date of entities.dates) {
    if (!aggregate.dates.has(date)) aggregate.dates.set(date, new Set())
    aggregate.dates.get(date).add(docIndex)
  }
  for (const amount of entities.monetaryAmounts) {
    if (!aggregate.monetaryAmounts.has(amount)) aggregate.monetaryAmounts.set(amount, new Set())
    aggregate.monetaryAmounts.get(amount).add(docIndex)
  }
}

// Convert Maps with Sets to plain objects with arrays for output
function mapToObjWithArrays(map) {
  const obj = {}
  for (const [key, docSet] of map.entries()) {
    obj[key] = Array.from(docSet).sort((a,b) => a - b)
  }
  return obj
}

const deduplicatedDataset = {
  people: mapToObjWithArrays(aggregate.people),
  organizations: mapToObjWithArrays(aggregate.organizations),
  dates: mapToObjWithArrays(aggregate.dates),
  monetaryAmounts: mapToObjWithArrays(aggregate.monetaryAmounts),
}

log(`Aggregation complete: ${Object.keys(deduplicatedDataset.people).length} unique people, ` +
  `${Object.keys(deduplicatedDataset.organizations).length} unique organizations, ` +
  `${Object.keys(deduplicatedDataset.dates).length} unique dates, ` +
  `${Object.keys(deduplicatedDataset.monetaryAmounts).length} unique monetary amounts.`)

// Return the aggregated dataset with provenance
return deduplicatedDataset
```

> **Claude judge:** The script fans out all 200 documents in a single `parallel()` call (no bounded waves of ~6-8), has no ScheduleWakeup watchdog, no per-agent retry (just null-tolerance logging), no per-wave result commits (single hard barrier before aggregation), no backoff on high failure rates, and no explicit gap-flagging in synthesis beyond a count log. It does have null-tolerance, cache-stable prompts (no Date.now/Math.random), a lean capped schema, and partial-input-tolerant aggregation, but the critical safety properties for large fan-out are mostly absent.

## With skill — rubric 100%, patterns 100%

```js
export const meta = {
  name: 'document-extraction-sweep',
  description: 'Extract structured entities from 200 contracts and aggregate with provenance',
  phases: [
    { title: 'Extract Entities' },
    { title: 'Retry Failed' },
    { title: 'Synthesize Aggregate' },
  ],
}

const WAVE_SIZE = 6

// Stable keys for documents: assume args.documents is an array of { id: string, text: string }
const DOCUMENTS = args.documents ?? []
if (!Array.isArray(DOCUMENTS) || DOCUMENTS.length === 0) {
  throw new Error('No documents provided in args.documents')
}

// Chunk helper
function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// Prompt builder for entity extraction per document
function buildExtractionPrompt(doc) {
  return `You are an expert information extraction assistant. Extract the following structured entities from the contract text below:

- People (full names)
- Organizations (legal entity names)
- Dates (contract dates, effective dates, expiration dates)
- Monetary amounts (with currency if available)

Return a JSON object with keys: people, organizations, dates, monetary_amounts.
Each key maps to an array of unique strings found in the text.

Include the document id in the output as "document_id".

Contract text:
"""${doc.text}"""

Output JSON ONLY, no extra commentary. Return at most 8 items per entity type, each item a short string. Do NOT include full contract text or long quotes.`
}

// JSON Schema for extraction result
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    document_id: { type: 'string' },
    people: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8,
    },
    organizations: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8,
    },
    dates: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8,
    },
    monetary_amounts: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8,
    },
  },
  required: ['document_id', 'people', 'organizations', 'dates', 'monetary_amounts'],
  additionalProperties: false,
}

// Run one extraction agent for one document, stable prompt keyed by document id
async function runExtraction(doc) {
  return await agent(buildExtractionPrompt(doc), {
    label: `extract:${doc.id}`,
    phase: 'Extract Entities',
    schema: EXTRACTION_SCHEMA,
    effort: 'medium',
  })
}

// ScheduleWakeup watchdog to detect silent stalls (Pattern 4)
ScheduleWakeup({
  delaySeconds: 1200,
  reason: `watchdog: document-extraction-sweep wf_${meta.name} may stall silently; check journal mtime`,
  prompt: `Watchdog for document-extraction-sweep run wf_${meta.name}: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel.`,
})

const waves = chunk(DOCUMENTS, WAVE_SIZE)
const done = [] // successful extraction results
let failed = [] // documents that failed extraction (null result)

phase('Extract Entities Waves')
for (let w = 0; w < waves.length; w++) {
  phase(`Wave ${w + 1}/${waves.length}`)
  const batchDocs = waves[w]

  // Run extraction agents in parallel for this wave
  const batchResults = await parallel(
    batchDocs.map((doc) => () => runExtraction(doc))
  )

  // Accumulate results and track failures
  batchResults.forEach((res, i) => {
    if (res) done.push(res)
    else failed.push(batchDocs[i])
  })

  log(`Wave ${w + 1}: ${done.length}/${DOCUMENTS.length} documents extracted, ${failed.length} failed`)

  // Instability backoff (Pattern 8)
  const nullCount = batchResults.filter((r) => r === null).length
  if (nullCount / batchResults.length > 0.4) {
    log(`⚠ instability: ${nullCount}/${batchResults.length} failed this wave — backing off; returning partial results and will resume later.`)
    break
  }
}

// Retry wave for failed documents (Pattern 2)
if (failed.length > 0) {
  phase('Retry Failed Documents')
  const retryResults = await parallel(
    failed.map((doc) => () => runExtraction(doc))
  )
  const stillFailed = []
  retryResults.forEach((res, i) => {
    if (res) done.push(res)
    else stillFailed.push(failed[i])
  })
  failed = stillFailed
  log(`Retry wave recovered ${retryResults.filter(Boolean).length} documents; still missing ${failed.length}`)
}

// Synthesis phase: aggregate all extracted entities with provenance and deduplicate
phase('Synthesize Aggregate')

// Build a map keyed by entity type and normalized entity string to track provenance
// Normalize by lowercasing and trimming for deduplication
function normalizeEntity(e) {
  return e.trim().toLowerCase()
}

// Aggregate structure:
// {
//   people: { normalized_entity: { original: string, documents: Set<docId> } },
//   organizations: {...},
//   dates: {...},
//   monetary_amounts: {...}
// }
const aggregate = {
  people: new Map(),
  organizations: new Map(),
  dates: new Map(),
  monetary_amounts: new Map(),
}

// Populate aggregate from done results
for (const res of done) {
  const docId = res.document_id
  for (const [etype, arr] of Object.entries({
    people: res.people,
    organizations: res.organizations,
    dates: res.dates,
    monetary_amounts: res.monetary_amounts,
  })) {
    if (!Array.isArray(arr)) continue
    for (const ent of arr) {
      const norm = normalizeEntity(ent)
      if (!aggregate[etype].has(norm)) {
        aggregate[etype].set(norm, { original: ent, documents: new Set() })
      }
      aggregate[etype].get(norm).documents.add(docId)
    }
  }
}

// Convert aggregate maps to arrays with provenance arrays
function mapToArrayWithProvenance(map) {
  return [...map.values()].map(({ original, documents }) => ({
    entity: original,
    documents: [...documents].sort(),
  }))
}

const aggregatedData = {
  people: mapToArrayWithProvenance(aggregate.people),
  organizations: mapToArrayWithProvenance(aggregate.organizations),
  dates: mapToArrayWithProvenance(aggregate.dates),
  monetary_amounts: mapToArrayWithProvenance(aggregate.monetary_amounts),
}

// Identify missing documents (no extraction result)
const extractedDocIds = new Set(done.map((r) => r.document_id))
const missingDocs = DOCUMENTS.filter((d) => !extractedDocIds.has(d.id)).map((d) => d.id)
if (missingDocs.length > 0) {
  log(`⚠ partial extraction: missing ${missingDocs.length}/${DOCUMENTS.length} documents: ${missingDocs.join(', ')}`)
}

// Synthesis prompt embeds the aggregated data and missing docs for final summary
const synthesisPrompt = `You are an expert data synthesizer. Given the extracted entities from ${done.length} contract documents, produce a concise JSON summary with these keys:

- people: array of { entity: string, documents: [document_id] }
- organizations: same structure
- dates: same structure
- monetary_amounts: same structure
- missing_documents: array of document ids with no extraction result

The input data is:

${JSON.stringify(aggregatedData, null, 2)}

Missing documents:

${JSON.stringify(missingDocs)}

Return JSON ONLY, no commentary.`

// Synthesis schema
const SYNTHESIS_SCHEMA = {
  type: 'object',
  properties: {
    people: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          entity: { type: 'string' },
          documents: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['entity', 'documents'],
        additionalProperties: false,
      },
    },
    organizations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          entity: { type: 'string' },
          documents: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['entity', 'documents'],
        additionalProperties: false,
      },
    },
    dates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          entity: { type: 'string' },
          documents: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['entity', 'documents'],
        additionalProperties: false,
      },
    },
    monetary_amounts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          entity: { type: 'string' },
          documents: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['entity', 'documents'],
        additionalProperties: false,
      },
    },
    missing_documents: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['people', 'organizations', 'dates', 'monetary_amounts', 'missing_documents'],
  additionalProperties: false,
}

const synthesis = await agent(synthesisPrompt, {
  label: 'synthesize-aggregate',
  phase: 'Synthesize Aggregate',
  schema: SYNTHESIS_SCHEMA,
  effort: 'high',
})

// Return final deliverable with partial results and missing docs
return {
  results: done,
  missing_documents: missingDocs,
  synthesis,
}
```

> **Claude judge:** Grading passed

