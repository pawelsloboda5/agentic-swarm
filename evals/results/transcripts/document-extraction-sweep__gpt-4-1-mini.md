# document-extraction-sweep — `gpt-4.1-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a DOCUMENT EXTRACTION SWEEP: extract structured entities (people, organizations, dates, monetary amounts) from 200 contract documents and aggregate them into a single deduplicated dataset, with per-document provenance.

---

## Baseline (no skill) — rubric 18%, patterns 25%

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
      description: 'List of monetary amounts extracted from the document',
    },
  },
  required: ['people', 'organizations', 'dates', 'monetaryAmounts'],
  additionalProperties: false,
}

phase('Extraction')

log(`Starting extraction from ${args.documents.length} documents`)

// Extract entities from each document in parallel
// args.documents is expected to be an array of { id: string, text: string }
const extractionResults = await parallel(
  args.documents.map((doc) => async () => {
    // Prompt to extract structured entities from one contract document
    const prompt = `Extract the following entities from the contract text below:
- People (full names)
- Organizations (company names)
- Dates (contract dates, effective dates, deadlines)
- Monetary amounts (with currency if possible)

Return a JSON object with keys: people, organizations, dates, monetaryAmounts.
Each key maps to an array of strings.

Contract text:
"""
${doc.text}
"""`

    const entities = await agent(prompt, {
      schema: entitySchema,
      label: `Extract entities from doc ${doc.id}`,
      phase: 'Extraction',
      effort: 'high',
    })

    if (entities === null) {
      log(`Extraction failed or skipped for doc ${doc.id}`)
      return null
    }

    return {
      id: doc.id,
      entities,
    }
  })
)

phase('Aggregation')

log('Aggregating and deduplicating extracted entities with provenance')

// Filter out failed extractions
const validResults = extractionResults.filter((r) => r !== null)

// Aggregate entities with provenance: map entity value => set of document IDs
const aggregate = {
  people: new Map(),
  organizations: new Map(),
  dates: new Map(),
  monetaryAmounts: new Map(),
}

for (const { id, entities } of validResults) {
  for (const person of entities.people) {
    if (!aggregate.people.has(person)) aggregate.people.set(person, new Set())
    aggregate.people.get(person).add(id)
  }
  for (const org of entities.organizations) {
    if (!aggregate.organizations.has(org)) aggregate.organizations.set(org, new Set())
    aggregate.organizations.get(org).add(id)
  }
  for (const date of entities.dates) {
    if (!aggregate.dates.has(date)) aggregate.dates.set(date, new Set())
    aggregate.dates.get(date).add(id)
  }
  for (const amount of entities.monetaryAmounts) {
    if (!aggregate.monetaryAmounts.has(amount)) aggregate.monetaryAmounts.set(amount, new Set())
    aggregate.monetaryAmounts.get(amount).add(id)
  }
}

// Convert Maps with Sets to arrays for output
function mapToArrayWithProvenance(map) {
  return Array.from(map.entries()).map(([entity, docIdSet]) => ({
    entity,
    documents: Array.from(docIdSet),
  }))
}

const deduplicatedDataset = {
  people: mapToArrayWithProvenance(aggregate.people),
  organizations: mapToArrayWithProvenance(aggregate.organizations),
  dates: mapToArrayWithProvenance(aggregate.dates),
  monetaryAmounts: mapToArrayWithProvenance(aggregate.monetaryAmounts),
}

log('Aggregation complete, returning deduplicated dataset with provenance')

return {
  perDocumentExtractions: validResults,
  deduplicatedDataset,
}
```

> **GPT-5.5 judge:** The script uses a single unbounded `parallel()` over all documents, creating a hard barrier where one hung agent call can deadlock the entire run. It has no bounded waves, no ScheduleWakeup/watchdog, no per-wave commits, no resume/cache-stable prompts, and no failure-rate backoff. It does have a structured schema, some null-tolerance for individual extraction failures, and aggregation can proceed over successful results if `parallel()` returns, but it does not explicitly preserve/flag gaps beyond logs and would silently omit failed documents from the final dataset. Overall it meets only a small fraction of the safety-by-construction bar.

## With skill — rubric 30%, patterns 69%

````js
```js
export const meta = {
  name: 'contract-extraction-sweep',
  description: 'Extract structured entities from 200 contracts and aggregate with provenance',
  phases: [
    { title: 'Extract Entities' },
    { title: 'Retry Failed' },
    { title: 'Synthesize Aggregate' },
  ],
}

const WAVE_SIZE = 6

// Stable keys for documents: assume args.documents is an array of { id: string, text: string }
const DOCUMENTS = args.documents || []
if (!Array.isArray(DOCUMENTS) || DOCUMENTS.length === 0) {
  throw new Error('No documents provided in args.documents')
}

// JSON Schema for extraction result per document
const ENTITY_SCHEMA = {
  type: 'object',
  properties: {
    documentId: { type: 'string' },
    people: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 20,
    },
    organizations: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 20,
    },
    dates: {
      type: 'array',
      items: { type: 'string', format: 'date' },
      maxItems: 20,
    },
    monetaryAmounts: {
      type: 'array',
      items: { type: 'string' }, // e.g. "$1,000,000" or "USD 1 million"
      maxItems: 20,
    },
  },
  required: ['documentId', 'people', 'organizations', 'dates', 'monetaryAmounts'],
  additionalProperties: false,
}

// JSON Schema for synthesis output
const SYNTH_SCHEMA = {
  type: 'object',
  properties: {
    aggregatedEntities: {
      type: 'object',
      properties: {
        people: { type: 'array', items: { type: 'string' } },
        organizations: { type: 'array', items: { type: 'string' } },
        dates: { type: 'array', items: { type: 'string' } },
        monetaryAmounts: { type: 'array', items: { type: 'string' } },
      },
      required: ['people', 'organizations', 'dates', 'monetaryAmounts'],
      additionalProperties: false,
    },
    gaps: {
      type: 'array',
      items: { type: 'string' }, // documentIds missing extraction results
    },
  },
  required: ['aggregatedEntities', 'gaps'],
  additionalProperties: false,
}

// Chunk array into waves of size n
function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) {
    out.push(arr.slice(i, i + n))
  }
  return out
}

// Build a stable prompt for entity extraction from one document
function buildExtractionPrompt(doc) {
  return `You are a contract analysis assistant. Extract the following structured entities from the contract text below:

- People (names of individuals)
- Organizations (company or institution names)
- Dates (contract dates, effective dates, deadlines)
- Monetary amounts (contract values, penalties, fees)

Return JSON with keys: documentId, people (array of unique names), organizations (array), dates (ISO 8601 date strings), monetaryAmounts (array of strings).

Return at most 20 items per category. Provide only the data, no explanation.

Contract text:
"""${doc.text}"""

Your output MUST validate against this JSON schema:
${JSON.stringify(ENTITY_SCHEMA, null, 2)}

Return the JSON ONLY.`
}

// Run one extraction agent for a document, returns parsed object or null on failure
async function runExtraction(doc) {
  return await agent(buildExtractionPrompt(doc), {
    label: `extract:${doc.id}`,
    phase: 'Extract Entities',
    schema: ENTITY_SCHEMA,
    effort: 'medium',
  })
}

// Build synthesis prompt embedding all extraction results and missing docs
function buildSynthesisPrompt(results, missing) {
  // Sort results by documentId for stable prompt
  const sortedResults = [...results].sort((a, b) => (a.documentId > b.documentId ? 1 : -1))
  const payload = JSON.stringify(sortedResults, null, 2)
  return `You are an expert data aggregator.

You have extracted structured entities from a set of contract documents. Each extraction result includes people, organizations, dates, and monetary amounts, with provenance (documentId).

Your task is to aggregate these entities into a single deduplicated dataset per category.

- Merge all people into one deduplicated list.
- Merge all organizations into one deduplicated list.
- Merge all dates into one deduplicated list.
- Merge all monetary amounts into one deduplicated list.

Also, explicitly list any document IDs for which extraction results are missing.

Input extraction results:
${payload}

Documents missing
````

> **GPT-5.5 judge:** The script has some safety-oriented pieces: a small WAVE_SIZE of 6, chunking helper, capped JSON schemas, stable document IDs, lean extraction prompts, and a synthesis schema/prompt that intends to report missing document IDs. However, the shown workflow does not actually execute bounded waves, does not commit results per wave, has no try/catch retry or null-tolerant handling despite the comment, has no ScheduleWakeup/stall watchdog, no resume/cache-stable finder mechanism, and no high-failure-rate backoff. The code is also truncated before orchestration and synthesis completion, so most critical protections against hung agents or silently lost work are absent.

