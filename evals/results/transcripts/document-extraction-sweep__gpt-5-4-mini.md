# document-extraction-sweep — `gpt-5.4-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a DOCUMENT EXTRACTION SWEEP: extract structured entities (people, organizations, dates, monetary amounts) from 200 contract documents and aggregate them into a single deduplicated dataset, with per-document provenance.

---

## Baseline (no skill) — rubric 20%, patterns 31%

```js
export const meta = {
  name: 'document-extraction-sweep',
  description:
    'Extract people, organizations, dates, and monetary amounts from contract documents and aggregate into a deduplicated dataset with per-document provenance.',
  phases: [
    { title: 'Plan' },
    { title: 'Extract Documents' },
    { title: 'Normalize and Deduplicate' },
    { title: 'Assemble Provenance Dataset' },
  ],
}

const input = args || {}
const documents = Array.isArray(input.documents) ? input.documents : []
const maxDocs = Math.min(documents.length, 200)

if (maxDocs === 0) {
  log('No documents provided. Returning empty extraction dataset.')
  return {
    documents: [],
    entities: {
      people: [],
      organizations: [],
      dates: [],
      monetaryAmounts: [],
    },
  }
}

phase('Plan')
log(`Preparing extraction sweep for ${maxDocs} document(s).`)

const plan = await agent(
  `You are planning an information extraction sweep across up to 200 contract documents.
Task:
1) Inspect the provided document list and define a robust extraction strategy for four entity types: people, organizations, dates, monetary amounts.
2) Prefer conservative extraction: only include entities clearly evidenced in the text.
3) Preserve per-document provenance for every extracted entity occurrence.
4) Normalize dates to ISO-8601 where possible, and monetary amounts to a structured representation with currency when present.
5) Deduplicate entities globally by normalized value, while retaining all source-document occurrences.
6) Return a concise extraction plan with any edge cases to watch for.

Documents are provided as an array of objects in args.documents, each with at least id and text/content fields.`,
  {
    label: 'plan-extraction',
    phase: 'Plan',
    effort: 'medium',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        strategy: { type: 'array', items: { type: 'string' } },
        edgeCases: { type: 'array', items: { type: 'string' } },
      },
      required: ['strategy', 'edgeCases'],
    },
  },
)

const normalizedDocuments = documents.slice(0, maxDocs).map((doc, index) => {
  const id =
    doc && typeof doc.id === 'string' && doc.id.trim()
      ? doc.id.trim()
      : `doc-${String(index + 1).padStart(4, '0')}`
  const text =
    doc && typeof doc.text === 'string'
      ? doc.text
      : doc && typeof doc.content === 'string'
        ? doc.content
        : doc && typeof doc.body === 'string'
          ? doc.body
          : ''
  return {
    id,
    text,
    index,
  }
})

phase('Extract Documents')
log('Launching per-document extraction agents.')

const extracted = await parallel(
  normalizedDocuments.map((doc) => async () => {
    const result = await agent(
      `Extract structured entities from this contract document.

Return only entities that are explicitly supported by the text.

Document ID: ${doc.id}

Extraction rules:
- people: individual human names, excluding organizations and roles unless clearly a person's name.
- organizations: company names, agencies, institutions, law firms, etc.
- dates: any explicit date/time reference relevant to the contract; normalize if possible.
- monetaryAmounts: any explicit money values, fees, payments, penalties, consideration, totals.
- Preserve provenance for each occurrence using the document ID and a short source quote/snippet.
- If a field is absent, return an empty array.
- Be careful not to duplicate the same occurrence within the same document.

Return a structured object with arrays for each entity type. For dates, include originalText and normalizedValue when possible. For monetary amounts, include originalText, normalizedValue, and currency when possible.`,
      {
        label: `extract-${doc.id}`,
        phase: 'Extract Documents',
        effort: 'medium',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            people: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  provenance: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      documentId: { type: 'string' },
                      quote: { type: 'string' },
                    },
                    required: ['documentId', 'quote'],
                  },
                },
                required: ['name', 'provenance'],
              },
            },
            organizations: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  provenance: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      documentId: { type: 'string' },
                      quote: { type: 'string' },
                    },
                    required: ['documentId', 'quote'],
                  },
                },
                required: ['name', 'provenance'],
              },
            },
            dates: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  originalText: { type: 'string' },
                  normalizedValue: { type: ['string', 'null'] },
                  provenance: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      documentId: { type: 'string' },
                      quote: { type: 'string' },
                    },
                    required: ['documentId', 'quote'],
                  },
                },
                required: ['originalText', 'normalizedValue', 'provenance'],
              },
            },
            monetaryAmounts: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  originalText: { type: 'string' },
                  normalizedValue: { type: ['string', 'null'] },
                  currency: { type: ['string', 'null'] },
                  provenance: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      documentId: { type: 'string' },
                      quote: { type: 'string' },
                    },
                    required: ['documentId', 'quote'],
                  },
                },
                required: ['originalText', 'normalizedValue', 'currency', 'provenance'],
              },
            },
          },
          required: ['people', 'organizations', 'dates', 'monetaryAmounts'],
        },
      },
    )
    return { doc, result }
  }),
)

phase('Normalize and Deduplicate')
log('Normalizing extracted values and building global deduplication keys.')

const peopleMap = new Map()
const organizationsMap = new Map()
const datesMap = new Map()
const moneyMap = new Map()

function normText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function keyForPeople(name) {
  return normText(name).toLowerCase()
}

function keyForOrgs(name) {
  return normText(name).toLowerCase()
}

function keyForDate(item) {
  const normalized = normText(item.normalizedValue || item.originalText)
  return normalized.toLowerCase()
}

function keyForMoney(item) {
  const amount = normText(item.normalizedValue || item.originalText)
  const currency = normText(item.currency || '').toUpperCase()
  return `${currency}|${amount}`.toLowerCase()
}

function addOccurrence(map, key, record, provenance) {
  if (!key) return
  if (!map.has(key)) {
    map.set(key, { record, occurrences: [] })
  }
  map.get(key).occurrences.push(provenance)
}

for (const item of extracted) {
  if (!item || !item.result || !item.doc) continue
  const documentId = item.doc.id

  for (const p of item.result.people || []) {
    const name = normText(p.name)
    if (!name) continue
    addOccurrence(
      peopleMap,
      keyForPeople(name),
      { name },
      { documentId, quote: normText(p.provenance && p.provenance.quote) },
    )
  }

  for (const o of item.result.organizations || []) {
    const name = normText(o.name)
    if (!name) continue
    addOccurrence(
      organizationsMap,
      keyForOrgs(name),
      { name },
      { documentId, quote: normText(o.provenance && o.provenance.quote) },
    )
  }

  for (const d of item.result.dates || []) {
    const originalText = normText(d.originalText)
    if (!originalText) continue
    const normalizedValue = d.normalizedValue == null ? null : normText(d.normalizedValue)
    addOccurrence(
      datesMap,
      keyForDate({ originalText, normalizedValue }),
      { originalText, normalizedValue },
      { documentId, quote: normText(d.provenance && d.provenance.quote) },
    )
  }

  for (const m of item.result.monetaryAmounts || []) {
    const originalText = normText(m.originalText)
    if (!originalText) continue
    const normalizedValue = m.normalizedValue == null ? null : normText(m.normalizedValue)
    const currency = m.currency == null ? null : normText(m.currency).toUpperCase()
    addOccurrence(
      moneyMap,
      keyForMoney({ originalText, normalizedValue, currency }),
      { originalText, normalizedValue, currency },
      { documentId, quote: normText(m.provenance && m.provenance.quote) },
    )
  }
}

phase('Assemble Provenance Dataset')
log('Assembling final deduplicated entity dataset with provenance across documents.')

function mapToArray(map) {
  return Array.from(map.values()).map((entry) => ({
    ...entry.record,
    occurrences: entry.occurrences,
    sourceDocuments: Array.from(
      new Set(entry.occurrences.map((occ) => occ.documentId).filter(Boolean)),
    ),
  }))
}

const finalDataset = {
  summary: {
    documentsProcessed: maxDocs,
    extractionPlan: plan,
    counts: {
      people: peopleMap.size,
      organizations: organizationsMap.size,
      dates: datesMap.size,
      monetaryAmounts: moneyMap.size,
    },
  },
  documents: normalizedDocuments.map((d) => ({ id: d.id })),
  entities: {
    people: mapToArray(peopleMap),
    organizations: mapToArray(organizationsMap),
    dates: mapToArray(datesMap),
    monetaryAmounts: mapToArray(moneyMap),
  },
}

return finalDataset
```

> **Claude judge:** The script fans out all 200 documents in a single unbounded parallel() call with no wave batching, no stall watchdog, and no per-agent retry, meaning one hung connection deadlocks the entire run and no partial results are committed until all agents complete. Only minor mitigations are present: null-tolerance in the aggregation loop and deterministic prompts.

## With skill — rubric 82%, patterns 75%

```js
export const meta = {
  name: 'document-extraction-sweep',
  description: 'Extract structured entities from 200 contract documents and aggregate a deduplicated provenance-rich dataset',
  phases: [
    { title: 'Plan' },
    { title: 'Extract' },
    { title: 'Retry' },
    { title: 'Deduplicate' },
    { title: 'Synthesize' },
  ],
}

const docs = Array.isArray(args?.documents) ? args.documents : []
if (!docs.length) {
  throw new Error('args.documents must be a non-empty array of 200 contract document descriptors')
}

const ENTITY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['document_id', 'entities'],
  properties: {
    document_id: { type: 'string' },
    entities: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'value', 'normalized', 'provenance'],
        properties: {
          type: { type: 'string', enum: ['person', 'organization', 'date', 'money'] },
          value: { type: 'string' },
          normalized: { type: 'string' },
          provenance: {
            type: 'object',
            additionalProperties: false,
            required: ['document_id', 'source_ref', 'evidence'],
            properties: {
              document_id: { type: 'string' },
              source_ref: { type: 'string' },
              evidence: { type: 'string' },
            },
          },
        },
      },
    },
  },
}

const DEDUP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['dataset', 'statistics'],
  properties: {
    dataset: {
      type: 'array',
      maxItems: 5000,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'canonical', 'variants', 'documents'],
        properties: {
          type: { type: 'string', enum: ['person', 'organization', 'date', 'money'] },
          canonical: { type: 'string' },
          variants: { type: 'array', maxItems: 20, items: { type: 'string' } },
          documents: {
            type: 'array',
            maxItems: 200,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['document_id', 'provenances'],
              properties: {
                document_id: { type: 'string' },
                provenances: {
                  type: 'array',
                  maxItems: 20,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['source_ref', 'evidence'],
                    properties: {
                      source_ref: { type: 'string' },
                      evidence: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    statistics: {
      type: 'object',
      additionalProperties: false,
      required: ['documents_processed', 'documents_missing', 'raw_entities', 'deduplicated_entities'],
      properties: {
        documents_processed: { type: 'integer' },
        documents_missing: { type: 'array', items: { type: 'string' } },
        raw_entities: { type: 'integer' },
        deduplicated_entities: { type: 'integer' },
      },
    },
  },
}

const WAVE_SIZE = 7
const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const stableDocId = (doc) => String(doc.id ?? doc.document_id ?? doc.key ?? doc.name ?? doc.path)
const docRef = (doc) => String(doc.path ?? doc.url ?? doc.source ?? doc.name ?? stableDocId(doc))

function extractPrompt(doc) {
  const id = stableDocId(doc)
  const ref = docRef(doc)
  return [
    `Extract structured entities from this contract document.`,
    `Return only entities of type person, organization, date, or money.`,
    `Provide per-entity provenance with a short evidence snippet and a source reference.`,
    `Be precise and conservative: extract only entities explicitly supported by the text.`,
    `Deduplicate repeated mentions within the same document where safe, but keep one provenance entry per unique mention.`,
    `Document ID: ${id}`,
    `Source reference: ${ref}`,
    `If the document is unreadable or missing, return an empty entities array and note the issue in evidence.`,
    `Output must match the schema exactly.`,
    `Document content:`,
    String(doc.text ?? doc.content ?? doc.body ?? ''),
  ].join('\n')
}

function dedupPrompt(rawResults, missingDocs) {
  const payload = {
    raw_results: rawResults,
    missing_documents: missingDocs,
  }
  return [
    `Deduplicate entity extractions across all documents into one consolidated dataset.`,
    `Canonicalize obvious variants only when strongly justified by the evidence.`,
    `Preserve per-document provenance for every grouped entity.`,
    `Do not invent entities not present in the raw results.`,
    `Explicitly include any missing documents in statistics.documents_missing.`,
    `Return the dataset and summary statistics only.`,
    `Input JSON:`,
    JSON.stringify(payload),
  ].join('\n')
}

function docKey(doc) {
  return stableDocId(doc)
}

phase('Extract')

const waves = chunk(docs, WAVE_SIZE)
const done = []
let failed = []

for (let w = 0; w < waves.length; w++) {
  phase(`Extract wave ${w + 1}/${waves.length}`)
  const batch = await parallel(
    waves[w].map((doc) => () =>
      agent(extractPrompt(doc), {
        label: `extract:${docKey(doc)}`,
        phase: 'Extract',
        schema: ENTITY_SCHEMA,
        model: 'claude-4.1',
        effort: 'medium',
      })
    )
  )

  batch.forEach((r, i) => {
    if (r) done.push(r)
    else failed.push(waves[w][i])
  })

  log(`wave ${w + 1}: ${done.length}/${docs.length} documents extracted, ${failed.length} pending retry`)

  const nulls = batch.filter((r) => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} failed this wave — backing off; returning partial, resume later`)
    break
  }
}

if (failed.length) {
  phase('Retry')
  const retried = await parallel(
    failed.map((doc) => () =>
      agent(extractPrompt(doc), {
        label: `extract:${docKey(doc)}`,
        phase: 'Retry',
        schema: ENTITY_SCHEMA,
        model: 'claude-4.1',
        effort: 'medium',
      })
    )
  )

  const stillFailed = []
  retried.forEach((r, i) => {
    if (r) done.push(r)
    else stillFailed.push(failed[i])
  })
  failed = stillFailed
  log(`retry recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

const haveDocs = new Set(done.map((r) => r.document_id))
const missing = docs.map(docKey).filter((id) => !haveDocs.has(id))
if (missing.length) log(`partial extraction: missing ${missing.length}/${docs.length} documents`)

phase('Deduplicate')

const dedup = await agent(dedupPrompt(done, missing), {
  label: 'dedup',
  phase: 'Deduplicate',
  schema: DEDUP_SCHEMA,
  model: 'claude-4.1',
  effort: 'high',
})

phase('Synthesize')

const synthesisPayload = JSON.stringify({
  documents: docs.map((doc) => ({
    document_id: docKey(doc),
    source_ref: docRef(doc),
  })),
  extracted_documents: done.map((r) => r.document_id).sort(),
  missing_documents: missing.slice().sort(),
  raw_result_count: done.reduce((n, r) => n + (Array.isArray(r.entities) ? r.entities.length : 0), 0),
  deduplicated_count: dedup?.statistics?.deduplicated_entities ?? null,
})

const summary = await agent(
  [
    `Produce a concise completion summary for this contract-document extraction sweep.`,
    `State how many documents were processed, how many were missing or failed, and how many deduplicated entities were produced.`,
    `Flag that missing documents imply partial coverage if any are absent.`,
    `Input JSON:`,
    synthesisPayload,
  ].join('\n'),
  { label: 'summary', phase: 'Synthesize', model: 'claude-4.1', effort: 'low' }
)

return {
  raw_results: done,
  missing_documents: missing,
  deduplicated_dataset: dedup,
  summary,
}
```

> **Claude judge:** The script implements bounded waves (size 7), per-agent null-tolerance with a dedicated retry phase, incremental per-wave result commits, deterministic prompts, capped schemas, explicit gap-flagging in synthesis, and a >40% failure-rate backoff break. The only missing safety property is an armed stall watchdog (ScheduleWakeup or timeout), meaning a single hung agent connection could deadlock an entire wave indefinitely without notification.

