# document-extraction-sweep — `gpt-5.4-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a DOCUMENT EXTRACTION SWEEP: extract structured entities (people, organizations, dates, monetary amounts) from 200 contract documents and aggregate them into a single deduplicated dataset, with per-document provenance.

---

## Baseline (no skill) — rubric 22%, patterns 25%

```js
export const meta = {
  name: 'document-extraction-sweep',
  description: 'Extract structured entities from many contract documents and aggregate them into a deduplicated provenance-rich dataset.',
  phases: [
    { title: 'Plan' },
    { title: 'Extract' },
    { title: 'Normalize' },
    { title: 'Deduplicate' },
    { title: 'Assemble' },
  ],
}

const input = args ?? {}
const documents = Array.isArray(input.documents) ? input.documents : []
const entityTypes = input.entityTypes ?? ['people', 'organizations', 'dates', 'monetary_amounts']

if (documents.length === 0) {
  log('No documents provided. Returning an empty extraction result.')
}

phase('Plan')

const docSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    documentId: { type: 'string' },
    sourceName: { type: 'string' },
    entities: {
      type: 'object',
      additionalProperties: false,
      properties: {
        people: { type: 'array', items: { $ref: '#/$defs/entity' } },
        organizations: { type: 'array', items: { $ref: '#/$defs/entity' } },
        dates: { type: 'array', items: { $ref: '#/$defs/dateEntity' } },
        monetary_amounts: { type: 'array', items: { $ref: '#/$defs/moneyEntity' } },
      },
      required: ['people', 'organizations', 'dates', 'monetary_amounts'],
    },
    extractionNotes: { type: 'array', items: { type: 'string' } },
  },
  required: ['documentId', 'sourceName', 'entities', 'extractionNotes'],
  $defs: {
    entity: {
      type: 'object',
      additionalProperties: false,
      properties: {
        value: { type: 'string' },
        normalizedValue: { type: 'string' },
        confidence: { type: 'number' },
        evidence: { type: 'array', items: { type: 'string' } },
      },
      required: ['value', 'normalizedValue', 'confidence', 'evidence'],
    },
    dateEntity: {
      type: 'object',
      additionalProperties: false,
      properties: {
        value: { type: 'string' },
        normalizedValue: { type: 'string' },
        confidence: { type: 'number' },
        evidence: { type: 'array', items: { type: 'string' } },
      },
      required: ['value', 'normalizedValue', 'confidence', 'evidence'],
    },
    moneyEntity: {
      type: 'object',
      additionalProperties: false,
      properties: {
        value: { type: 'string' },
        normalizedValue: { type: 'string' },
        currency: { type: 'string' },
        confidence: { type: 'number' },
        evidence: { type: 'array', items: { type: 'string' } },
      },
      required: ['value', 'normalizedValue', 'currency', 'confidence', 'evidence'],
    },
  },
}

const globalSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    deduplicatedEntities: {
      type: 'object',
      additionalProperties: false,
      properties: {
        people: { type: 'array', items: { type: 'object' } },
        organizations: { type: 'array', items: { type: 'object' } },
        dates: { type: 'array', items: { type: 'object' } },
        monetary_amounts: { type: 'array', items: { type: 'object' } },
      },
      required: ['people', 'organizations', 'dates', 'monetary_amounts'],
    },
    provenanceIndex: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          documentId: { type: 'string' },
          sourceName: { type: 'string' },
          entityType: { type: 'string' },
          canonicalValue: { type: 'string' },
          mentions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                rawValue: { type: 'string' },
                normalizedValue: { type: 'string' },
                confidence: { type: 'number' },
                evidence: { type: 'array', items: { type: 'string' } },
              },
              required: ['rawValue', 'normalizedValue', 'confidence', 'evidence'],
            },
          },
        },
        required: ['documentId', 'sourceName', 'entityType', 'canonicalValue', 'mentions'],
      },
    },
    summary: {
      type: 'object',
      additionalProperties: false,
      properties: {
        documentsProcessed: { type: 'number' },
        documentsSucceeded: { type: 'number' },
        documentsFailed: { type: 'number' },
        entityCounts: {
          type: 'object',
          additionalProperties: { type: 'number' },
        },
      },
      required: ['documentsProcessed', 'documentsSucceeded', 'documentsFailed', 'entityCounts'],
    },
  },
  required: ['deduplicatedEntities', 'provenanceIndex', 'summary'],
}

phase('Extract')

const extractionResults = await pipeline(
  documents,
  async (doc) => {
    const prompt = `Extract structured entities from this contract document.

Return JSON matching the schema exactly.

Document metadata:
- documentId: ${doc.documentId}
- sourceName: ${doc.sourceName ?? ''}
- entityTypes: ${entityTypes.join(', ')}

Instructions:
- Extract all person names, organization names, dates, and monetary amounts.
- For each entity, provide:
  - value: the exact text span as found in the document
  - normalizedValue: a canonical normalized form
  - confidence: a number from 0 to 1
  - evidence: short quotes or pointers from the document text that justify the extraction
- For monetary amounts, include currency when inferable.
- If a type has no entities, return an empty array.
- Prefer conservative extraction; do not invent entities.
- Preserve provenance to this document only.`;

    const result = await agent(prompt, {
      label: `extract:${doc.documentId}`,
      phase: 'Extract',
      schema: docSchema,
      effort: 'high',
    })

    if (!result) return null
    return result
  },
  async (prev, originalDoc) => {
    if (!prev) return null

    const normalizeText = (s) => String(s ?? '').trim().replace(/\s+/g, ' ')
    const canonicalizeDate = (s) => normalizeText(s).toLowerCase()
    const canonicalizeMoney = (s, currency) => `${normalizeText(currency).toUpperCase()}:${normalizeText(s).toLowerCase()}`
    const canonicalizeName = (s) => normalizeText(s).toLowerCase()
    const canonicalizeOrg = (s) => normalizeText(s).toLowerCase()

    const entities = prev.entities ?? {}
    const normalized = {
      documentId: prev.documentId ?? originalDoc.documentId,
      sourceName: prev.sourceName ?? originalDoc.sourceName ?? '',
      entities: {
        people: (entities.people ?? []).map((e) => ({
          rawValue: e.value,
          canonicalValue: canonicalizeName(e.normalizedValue || e.value),
          normalizedValue: normalizeText(e.normalizedValue || e.value),
          confidence: e.confidence,
          evidence: e.evidence ?? [],
        })),
        organizations: (entities.organizations ?? []).map((e) => ({
          rawValue: e.value,
          canonicalValue: canonicalizeOrg(e.normalizedValue || e.value),
          normalizedValue: normalizeText(e.normalizedValue || e.value),
          confidence: e.confidence,
          evidence: e.evidence ?? [],
        })),
        dates: (entities.dates ?? []).map((e) => ({
          rawValue: e.value,
          canonicalValue: canonicalizeDate(e.normalizedValue || e.value),
          normalizedValue: normalizeText(e.normalizedValue || e.value),
          confidence: e.confidence,
          evidence: e.evidence ?? [],
        })),
        monetary_amounts: (entities.monetary_amounts ?? []).map((e) => ({
          rawValue: e.value,
          canonicalValue: canonicalizeMoney(e.normalizedValue || e.value, e.currency ?? ''),
          normalizedValue: normalizeText(e.normalizedValue || e.value),
          currency: normalizeText(e.currency ?? '').toUpperCase(),
          confidence: e.confidence,
          evidence: e.evidence ?? [],
        })),
      },
      extractionNotes: prev.extractionNotes ?? [],
    }

    return normalized
  }
)

phase('Normalize')

const successfulDocs = extractionResults.filter(Boolean)
const failedDocs = documents.length - successfulDocs.length

const allMentions = []
for (const doc of successfulDocs) {
  for (const mention of doc.entities.people ?? []) {
    allMentions.push({
      documentId: doc.documentId,
      sourceName: doc.sourceName,
      entityType: 'people',
      canonicalValue: mention.canonicalValue,
      rawValue: mention.rawValue,
      normalizedValue: mention.normalizedValue,
      confidence: mention.confidence,
      evidence: mention.evidence,
    })
  }
  for (const mention of doc.entities.organizations ?? []) {
    allMentions.push({
      documentId: doc.documentId,
      sourceName: doc.sourceName,
      entityType: 'organizations',
      canonicalValue: mention.canonicalValue,
      rawValue: mention.rawValue,
      normalizedValue: mention.normalizedValue,
      confidence: mention.confidence,
      evidence: mention.evidence,
    })
  }
  for (const mention of doc.entities.dates ?? []) {
    allMentions.push({
      documentId: doc.documentId,
      sourceName: doc.sourceName,
      entityType: 'dates',
      canonicalValue: mention.canonicalValue,
      rawValue: mention.rawValue,
      normalizedValue: mention.normalizedValue,
      confidence: mention.confidence,
      evidence: mention.evidence,
    })
  }
  for (const mention of doc.entities.monetary_amounts ?? []) {
    allMentions.push({
      documentId: doc.documentId,
      sourceName: doc.sourceName,
      entityType: 'monetary_amounts',
      canonicalValue: mention.canonicalValue,
      rawValue: mention.rawValue,
      normalizedValue: mention.normalizedValue,
      confidence: mention.confidence,
      evidence: mention.evidence,
    })
  }
}

phase('Deduplicate')

const dedupePrompt = `Deduplicate and consolidate entity mentions from contract documents into canonical entities.

Rules:
- Merge only when values clearly refer to the same real-world entity.
- Preserve all source mentions for provenance.
- Keep confidence values and evidence arrays.
- Output JSON matching the schema exactly.
- Do not omit any provenance mention.
- Separate entity types strictly: people, organizations, dates, monetary_amounts.

Input mentions:
${JSON.stringify(allMentions)}`

const deduped = await agent(dedupePrompt, {
  label: 'dedupe:global',
  phase: 'Deduplicate',
  schema: globalSchema,
  effort: 'high',
})

phase('Assemble')

const result = deduped ?? {
  deduplicatedEntities: {
    people: [],
    organizations: [],
    dates: [],
    monetary_amounts: [],
  },
  provenanceIndex: [],
  summary: {
    documentsProcessed: documents.length,
    documentsSucceeded: successfulDocs.length,
    documentsFailed: failedDocs,
    entityCounts: {
      people: 0,
      organizations: 0,
      dates: 0,
      monetary_amounts: 0,
    },
  },
}

if (deduped) {
  const counts = {
    people: Array.isArray(deduped.deduplicatedEntities?.people) ? deduped.deduplicatedEntities.people.length : 0,
    organizations: Array.isArray(deduped.deduplicatedEntities?.organizations) ? deduped.deduplicatedEntities.organizations.length : 0,
    dates: Array.isArray(deduped.deduplicatedEntities?.dates) ? deduped.deduplicatedEntities.dates.length : 0,
    monetary_amounts: Array.isArray(deduped.deduplicatedEntities?.monetary_amounts) ? deduped.deduplicatedEntities.monetary_amounts.length : 0,
  }

  result.summary = {
    documentsProcessed: documents.length,
    documentsSucceeded: successfulDocs.length,
    documentsFailed: failedDocs,
    entityCounts: counts,
  }
}

log(`Processed ${documents.length} documents; succeeded ${successfulDocs.length}; failed ${failedDocs}.`)

return result
```

> **GPT-5.5 judge:** The script uses a single pipeline over all documents with no bounded waves, no ScheduleWakeup/watchdog, no per-agent retry or try/catch around agent failures, no per-wave durable commits, no resume/cache-stable prompts, and no high-failure-rate backoff. It has some partial-result awareness via null filtering, failed-doc counts, strict schemas, and a fallback if global dedupe returns null, but a hung extraction or thrown error could still stall or abort the whole run, and completed work is only assembled after the global barrier. Overall it meets only a small fraction of the safe-by-construction bar.

## With skill — rubric 65%, patterns 75%

```js
export const meta = {
  name: 'document-extraction-sweep',
  description: 'Extract structured entities from contract documents and aggregate a deduplicated dataset with provenance.',
  phases: [
    { title: 'Plan' },
    { title: 'Extract' },
    { title: 'Retry' },
    { title: 'Deduplicate' },
    { title: 'Synthesize' },
  ],
}

const WAVE_SIZE = 8

const DOCUMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['document_id', 'people', 'organizations', 'dates', 'monetary_amounts'],
  properties: {
    document_id: { type: 'string' },
    people: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'provenance'],
        properties: {
          name: { type: 'string' },
          title: { type: 'string' },
          provenance: {
            type: 'object',
            additionalProperties: false,
            required: ['quote', 'location'],
            properties: {
              quote: { type: 'string' },
              location: { type: 'string' },
            },
          },
        },
      },
    },
    organizations: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'provenance'],
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          provenance: {
            type: 'object',
            additionalProperties: false,
            required: ['quote', 'location'],
            properties: {
              quote: { type: 'string' },
              location: { type: 'string' },
            },
          },
        },
      },
    },
    dates: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['value', 'provenance'],
        properties: {
          value: { type: 'string' },
          label: { type: 'string' },
          provenance: {
            type: 'object',
            additionalProperties: false,
            required: ['quote', 'location'],
            properties: {
              quote: { type: 'string' },
              location: { type: 'string' },
            },
          },
        },
      },
    },
    monetary_amounts: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['value', 'provenance'],
        properties: {
          value: { type: 'string' },
          currency: { type: 'string' },
          context: { type: 'string' },
          provenance: {
            type: 'object',
            additionalProperties: false,
            required: ['quote', 'location'],
            properties: {
              quote: { type: 'string' },
              location: { type: 'string' },
            },
          },
        },
      },
    },
  },
}

const AGGREGATED_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['documents_processed', 'people', 'organizations', 'dates', 'monetary_amounts', 'missing_documents', 'notes'],
  properties: {
    documents_processed: { type: 'integer' },
    people: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'sources'],
        properties: {
          name: { type: 'string' },
          normalized_name: { type: 'string' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['document_id', 'quote', 'location'],
              properties: {
                document_id: { type: 'string' },
                quote: { type: 'string' },
                location: { type: 'string' },
              },
            },
          },
        },
      },
    },
    organizations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'sources'],
        properties: {
          name: { type: 'string' },
          normalized_name: { type: 'string' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['document_id', 'quote', 'location'],
              properties: {
                document_id: { type: 'string' },
                quote: { type: 'string' },
                location: { type: 'string' },
              },
            },
          },
        },
      },
    },
    dates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['value', 'sources'],
        properties: {
          value: { type: 'string' },
          label: { type: 'string' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['document_id', 'quote', 'location'],
              properties: {
                document_id: { type: 'string' },
                quote: { type: 'string' },
                location: { type: 'string' },
              },
            },
          },
        },
      },
    },
    monetary_amounts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['value', 'sources'],
        properties: {
          value: { type: 'string' },
          currency: { type: 'string' },
          context: { type: 'string' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['document_id', 'quote', 'location'],
              properties: {
                document_id: { type: 'string' },
                quote: { type: 'string' },
                location: { type: 'string' },
              },
            },
          },
        },
      },
    },
    missing_documents: { type: 'array', items: { type: 'string' } },
    notes: { type: 'array', items: { type: 'string' } },
  },
}

const ITEMS = Array.isArray(args?.documents) ? args.documents : Array.isArray(args) ? args : []
const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const normalize = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

function buildPrompt(doc) {
  const text = doc.text ?? doc.content ?? ''
  const id = doc.document_id ?? doc.id ?? doc.key ?? doc.path ?? doc.name ?? String(doc)
  return [
    `Extract structured entities from this contract document.`,
    `Document ID: ${id}`,
    `Return ONLY JSON matching the schema.`,
    `Rules:`,
    `- Extract people, organizations, dates, and monetary amounts.`,
    `- Preserve per-document provenance for every extracted item.`,
    `- Provenance must include a short supporting quote and a location string (page/section/clause if available).`,
    `- Prefer exact surface forms from the source.`,
    `- Keep outputs lean: no long explanations, no duplicate mentions, no invented entities.`,
    `- If none found for a category, return an empty array.`,
    `Document text:`,
    text,
  ].join('\n\n')
}

function buildAggregationPrompt(extracted, missingDocs) {
  const payload = JSON.stringify(
    extracted
      .slice()
      .sort((a, b) => String(a.document_id).localeCompare(String(b.document_id)))
  )
  const missing = JSON.stringify(missingDocs.slice().sort())
  return [
    `Deduplicate and aggregate the extracted entities into a single dataset.`,
    `You are given per-document extraction objects with provenance already attached.`,
    `Merge exact and near-exact duplicates conservatively.`,
    `Keep provenance from all contributing documents.`,
    `If the same entity appears in multiple documents, include multiple source records.`,
    `Normalize obvious casing/spacing variants, but do not over-merge ambiguous names.`,
    `Return ONLY JSON matching the schema.`,
    `Missing documents: ${missing}`,
    `Extracted dataset: ${payload}`,
  ].join('\n\n')
}

function mergeDedup(results) {
  const people = new Map()
  const orgs = new Map()
  const dates = new Map()
  const amounts = new Map()

  const pushSource = (map, key, item, source) => {
    if (!map.has(key)) map.set(key, { item, sources: [] })
    map.get(key).sources.push(source)
  }

  for (const doc of results) {
    if (!doc) continue
    const docId = doc.document_id
    for (const p of doc.people ?? []) {
      const key = normalize(p.name)
      pushSource(people, key, { name: p.name, normalized_name: p.name.trim() }, { document_id: docId, quote: p.provenance?.quote ?? '', location: p.provenance?.location ?? '' })
    }
    for (const o of doc.organizations ?? []) {
      const key = normalize(o.name)
      pushSource(orgs, key, { name: o.name, normalized_name: o.name.trim() }, { document_id: docId, quote: o.provenance?.quote ?? '', location: o.provenance?.location ?? '' })
    }
    for (const d of doc.dates ?? []) {
      const key = normalize(d.value)
      pushSource(dates, key, { value: d.value, label: d.label ?? '' }, { document_id: docId, quote: d.provenance?.quote ?? '', location: d.provenance?.location ?? '' })
    }
    for (const m of doc.monetary_amounts ?? []) {
      const key = normalize(`${m.value}|${m.currency ?? ''}`)
      pushSource(amounts, key, { value: m.value, currency: m.currency ?? '', context: m.context ?? '' }, { document_id: docId, quote: m.provenance?.quote ?? '', location: m.provenance?.location ?? '' })
    }
  }

  const materialize = (map) =>
    [...map.values()]
      .map(({ item, sources }) => ({ ...item, sources }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))

  return {
    documents_processed: results.filter(Boolean).length,
    people: materialize(people),
    organizations: materialize(orgs),
    dates: materialize(dates),
    monetary_amounts: materialize(amounts),
  }
}

phase('Extract')

const waves = chunk(ITEMS, WAVE_SIZE)
const extracted = []
let failed = []

function runDocument(doc) {
  const id = doc.document_id ?? doc.id ?? doc.key ?? doc.path ?? doc.name ?? String(doc)
  return agent(buildPrompt(doc), {
    label: `doc:${id}`,
    phase: 'Extract',
    schema: DOCUMENT_SCHEMA,
    effort: 'medium',
  })
}

for (let w = 0; w < waves.length; w++) {
  phase(`Wave ${w + 1}/${waves.length}`)
  const batch = await parallel(waves[w].map((doc) => () => runDocument(doc)))
  batch.forEach((r, i) => {
    if (r) extracted.push(r)
    else failed.push(waves[w][i])
  })
  log(`Wave ${w + 1}: ${extracted.length}/${ITEMS.length} extracted, ${failed.length} to retry`)
  const nulls = batch.filter((r) => r === null).length
  if (batch.length && nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} failed this wave — backing off; return partial, resume later`)
    break
  }
}

if (failed.length) {
  phase('Retry')
  const retried = await parallel(failed.map((doc) => () => runDocument(doc)))
  const stillFailed = []
  retried.forEach((r, i) => {
    if (r) extracted.push(r)
    else stillFailed.push(failed[i])
  })
  failed = stillFailed
  log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

const haveIds = new Set(extracted.map((r) => String(r.document_id)))
const missingDocuments = ITEMS
  .map((doc) => String(doc.document_id ?? doc.id ?? doc.key ?? doc.path ?? doc.name ?? doc))
  .filter((id) => !haveIds.has(id))

if (missingDocuments.length) log(`partial: missing ${missingDocuments.length}/${ITEMS.length} documents`)

phase('Deduplicate')
const locallyDeduped = mergeDedup(extracted)

phase('Synthesize')
const synthesis = await agent(
  buildAggregationPrompt(extracted, missingDocuments),
  { label: 'aggregate', phase: 'Synthesize', schema: AGGREGATED_SCHEMA, effort: 'high' }
)

return {
  results: extracted,
  deduplicated: synthesis ?? {
    ...locallyDeduped,
    missing_documents: missingDocuments,
    notes: [
      synthesis === null
        ? 'Aggregation synthesis failed; returning locally deduplicated dataset.'
        : 'Aggregation synthesized successfully.',
    ],
  },
  missing_documents: missingDocuments,
}
```

> **GPT-5.5 judge:** The script uses bounded waves of 8, handles null results, retries failed documents, caps per-document schema outputs, backs off on high wave failure rates, and the final synthesis/fallback explicitly reports missing documents. However, it lacks an armed ScheduleWakeup/stall watchdog, so one hung agent/connection inside a wave can still block the awaited parallel() forever with no notification. It also does not durably commit per-wave results or provide resume/cache-stable prompts, so completed work in a hung wave or crashed run can be lost or trapped behind the wave barrier. Overall it avoids the worst unbounded fan-out pattern but misses key safe-by-construction protections for hangs and resumability.

