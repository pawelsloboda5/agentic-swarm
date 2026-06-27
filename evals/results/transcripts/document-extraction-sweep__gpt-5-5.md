# document-extraction-sweep — `gpt-5.5`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a DOCUMENT EXTRACTION SWEEP: extract structured entities (people, organizations, dates, monetary amounts) from 200 contract documents and aggregate them into a single deduplicated dataset, with per-document provenance.

---

## Baseline (no skill) — rubric 35%, patterns 63%

```js
export const meta = {
  name: 'document-extraction-sweep',
  description: 'Extract people, organizations, dates, and monetary amounts from 200 contract documents and aggregate a deduplicated dataset with per-document provenance.',
  phases: [
    { title: 'Prepare document set' },
    { title: 'Extract per-document entities' },
    { title: 'Normalize and exact-coalesce candidates' },
    { title: 'Semantic deduplication' },
    { title: 'Aggregate dataset and QA' },
  ],
}

const input = args || {}
const TARGET_DOCUMENTS = Math.min(
  Number.isFinite(input.maxDocuments) ? input.maxDocuments : 200,
  200
)

const DEFAULT_DEDUPE_CHUNK_SIZE = Math.max(
  25,
  Math.min(Number.isFinite(input.dedupeChunkSize) ? input.dedupeChunkSize : 160, 350)
)

const GLOBAL_DEDUPE_LIMIT = Math.max(
  DEFAULT_DEDUPE_CHUNK_SIZE,
  Math.min(Number.isFinite(input.globalDedupeLimit) ? input.globalDedupeLimit : 350, 600)
)

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeWhitespace(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
}

function clip(value, max = 240) {
  const s = normalizeWhitespace(value)
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

function slugLike(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeName(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[.,;:'"“”‘’]/g, '')
    .replace(/\b(the|incorporated|inc|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|plc)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeGeneric(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[.,;:'"“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniq(values, max = 1000) {
  const seen = new Set()
  const out = []
  for (const value of values || []) {
    const s = normalizeWhitespace(value)
    if (!s || seen.has(s.toLowerCase())) continue
    seen.add(s.toLowerCase())
    out.push(s)
    if (out.length >= max) break
  }
  return out
}

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function stableDocId(doc, index) {
  if (doc && doc.id != null && normalizeWhitespace(doc.id)) return normalizeWhitespace(doc.id)
  if (doc && doc.documentId != null && normalizeWhitespace(doc.documentId)) return normalizeWhitespace(doc.documentId)
  if (doc && doc.path) {
    const base = String(doc.path).split('/').pop() || String(doc.path)
    const slug = slugLike(base)
    if (slug) return slug
  }
  return `contract-${String(index + 1).padStart(3, '0')}`
}

function toDocumentDescriptor(raw, index) {
  if (typeof raw === 'string') {
    return {
      id: stableDocId({ path: raw }, index),
      title: String(raw).split('/').pop() || `Contract ${index + 1}`,
      path: raw,
      text: null,
      metadata: {},
    }
  }

  const doc = raw || {}
  return {
    id: stableDocId(doc, index),
    title: normalizeWhitespace(doc.title || doc.name || doc.filename || doc.path || `Contract ${index + 1}`),
    path: doc.path || doc.file || doc.filePath || null,
    text: doc.text || doc.content || null,
    metadata: doc.metadata || {},
  }
}

const discoverySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['documents', 'warnings'],
  properties: {
    documents: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'path'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          path: { type: 'string' },
        },
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
}

const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'status', 'people', 'organizations', 'dates', 'monetaryAmounts', 'warnings'],
  properties: {
    documentId: { type: 'string' },
    status: { type: 'string', enum: ['complete', 'partial', 'failed'] },
    people: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'surfaceName',
          'normalizedName',
          'roleOrTitle',
          'relationship',
          'location',
          'quote',
          'confidence',
        ],
        properties: {
          surfaceName: { type: 'string' },
          normalizedName: { type: 'string' },
          roleOrTitle: { type: 'string' },
          relationship: { type: 'string' },
          location: { type: 'string' },
          quote: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
    organizations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'surfaceName',
          'normalizedName',
          'orgType',
          'role',
          'location',
          'quote',
          'confidence',
        ],
        properties: {
          surfaceName: { type: 'string' },
          normalizedName: { type: 'string' },
          orgType: { type: 'string' },
          role: { type: 'string' },
          location: { type: 'string' },
          quote: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
    dates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'surfaceText',
          'normalizedDate',
          'dateType',
          'location',
          'quote',
          'confidence',
        ],
        properties: {
          surfaceText: { type: 'string' },
          normalizedDate: { type: 'string' },
          dateType: { type: 'string' },
          location: { type: 'string' },
          quote: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
    monetaryAmounts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'surfaceText',
          'amount',
          'currency',
          'normalizedAmountText',
          'monetaryType',
          'location',
          'quote',
          'confidence',
        ],
        properties: {
          surfaceText: { type: 'string' },
          amount: { type: ['number', 'null'] },
          currency: { type: 'string' },
          normalizedAmountText: { type: 'string' },
          monetaryType: { type: 'string' },
          location: { type: 'string' },
          quote: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
}

const dedupeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['canonicalRecords', 'warnings'],
  properties: {
    canonicalRecords: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'canonicalLabel',
          'normalizedValue',
          'aliases',
          'sourceRecordIds',
          'confidence',
          'mergeRationale',
        ],
        properties: {
          canonicalLabel: { type: 'string' },
          normalizedValue: { type: 'string' },
          aliases: { type: 'array', items: { type: 'string' } },
          sourceRecordIds: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
          mergeRationale: { type: 'string' },
        },
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
}

const qaSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['passed', 'issues', 'recommendations'],
  properties: {
    passed: { type: 'boolean' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'message', 'entityIds'],
        properties: {
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          message: { type: 'string' },
          entityIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    recommendations: { type: 'array', items: { type: 'string' } },
  },
}

phase('Prepare document set')

let rawDocs = []
let discoveryWarnings = []

if (Array.isArray(input.documents)) {
  rawDocs = input.documents
} else if (Array.isArray(input.documentPaths)) {
  rawDocs = input.documentPaths
} else if (Array.isArray(input.paths)) {
  rawDocs = input.paths
} else if (input.contractDirectory || input.contractGlob || input.discoveryInstructions) {
  log('No explicit document array supplied; asking a discovery agent to identify contract files.')

  const discovered = await agent(
    `You are preparing a document extraction sweep.

Find up to ${TARGET_DOCUMENTS} contract documents in the repository/workspace using the following user-supplied discovery inputs.

Discovery inputs:
${JSON.stringify(
  {
    contractDirectory: input.contractDirectory || null,
    contractGlob: input.contractGlob || null,
    discoveryInstructions: input.discoveryInstructions || null,
  },
  null,
  2
)}

Return only contract-like documents. Do not modify files. Assign stable IDs. Prefer paths relative to the repository root when possible.`,
    {
      label: 'discover-contract-documents',
      phase: 'Prepare document set',
      schema: discoverySchema,
      effort: 'medium',
    }
  )

  if (!discovered) {
    throw new Error('Document discovery failed. Provide args.documents, args.documentPaths, args.contractDirectory, or args.contractGlob.')
  }

  rawDocs = discovered.documents || []
  discoveryWarnings = discovered.warnings || []
}

let documents = rawDocs.slice(0, TARGET_DOCUMENTS).map(toDocumentDescriptor)

const seenDocIds = new Map()
documents = documents.map((doc, index) => {
  let id = doc.id
  const prior = seenDocIds.get(id) || 0
  seenDocIds.set(id, prior + 1)
  if (prior > 0) id = `${id}-${prior + 1}`
  return { ...doc, id }
})

if (documents.length === 0) {
  throw new Error('No contract documents were supplied or discovered.')
}

log(`Prepared ${documents.length} contract document(s) for extraction.`)
if (documents.length < TARGET_DOCUMENTS) {
  log(`Warning: expected up to ${TARGET_DOCUMENTS} documents, but only ${documents.length} were available.`)
}

phase('Extract per-document entities')

function extractionPrompt(doc, retry = false) {
  return `You are a careful contract-document information extraction agent.

Task:
Extract all structured entities of these four types from ONE contract document:
1. people
2. organizations
3. dates
4. monetary amounts

Rules:
- Preserve per-mention provenance.
- Use the exact documentId supplied below.
- If a file path is supplied, inspect/read that file. If inline text is supplied, use it as the document text. If both are supplied, use both only to resolve ambiguity.
- Do not modify files.
- Extract entities appearing in signature blocks, notices, parties, recitals, payment terms, term/termination sections, effective-date clauses, schedules, exhibits, and amendments.
- Prefer meaningful legal/contract roles, such as "seller", "buyer", "licensor", "licensee", "service provider", "customer", "guarantor", "notice contact", "signatory", "effective date", "termination date", "payment amount", "cap", "fee", "deposit", etc.
- normalizedDate must be ISO-8601 YYYY-MM-DD when a full date is inferable; use YYYY-MM or YYYY if only partial; otherwise use an empty string.
- amount should be numeric when possible, without currency symbols or thousands separators; otherwise null.
- currency should be ISO code if inferable, e.g. USD, EUR, GBP; otherwise empty string.
- quote must be a short supporting snippet, ideally <= 160 characters.
- location should identify page/section/heading/paragraph when available; otherwise a concise description.
- Use confidence between 0 and 1.
- If extraction is incomplete, set status to "partial" and explain in warnings.
- If the document cannot be read or is not a contract, set status to "failed" and explain in warnings.

${retry ? 'This is a retry after the first extraction attempt failed; be concise but thorough.\n' : ''}
Document descriptor:
${JSON.stringify(doc, null, 2)}`
}

let extractionResults = await parallel(
  documents.map((doc) => async () =>
    agent(extractionPrompt(doc, false), {
      label: `extract-${doc.id}`,
      phase: 'Extract per-document entities',
      schema: extractionSchema,
      effort: input.extractionEffort || 'high',
      agentType: input.agentType || undefined,
    })
  )
)

let failedExtractionIndexes = extractionResults
  .map((result, index) => (!result ? index : -1))
  .filter((index) => index >= 0)

if (failedExtractionIndexes.length > 0) {
  log(`Retrying ${failedExtractionIndexes.length} document extraction(s) that returned no result.`)

  const retryResults = await parallel(
    failedExtractionIndexes.map((index) => async () =>
      agent(extractionPrompt(documents[index], true), {
        label: `retry-extract-${documents[index].id}`,
        phase: 'Extract per-document entities',
        schema: extractionSchema,
        effort: 'high',
        agentType: input.agentType || undefined,
      })
    )
  )

  for (let i = 0; i < failedExtractionIndexes.length; i += 1) {
    if (retryResults[i]) extractionResults[failedExtractionIndexes[i]] = retryResults[i]
  }
}

const extractionsByDocId = new Map()
const extractionFailures = []
const extractionWarnings = [...discoveryWarnings]

for (let i = 0; i < documents.length; i += 1) {
  const doc = documents[i]
  const result = extractionResults[i]

  if (!result) {
    extractionFailures.push({
      documentId: doc.id,
      title: doc.title,
      path: doc.path,
      reason: 'agent returned null after retry',
    })
    continue
  }

  if (result.documentId !== doc.id) {
    extractionWarnings.push(
      `Extractor returned documentId "${result.documentId}" for expected document "${doc.id}"; using expected ID.`
    )
    result.documentId = doc.id
  }

  if (result.status === 'failed') {
    extractionFailures.push({
      documentId: doc.id,
      title: doc.title,
      path: doc.path,
      reason: (result.warnings || []).join('; ') || 'extractor marked document failed',
    })
  }

  for (const warning of result.warnings || []) {
    extractionWarnings.push(`${doc.id}: ${warning}`)
  }

  extractionsByDocId.set(doc.id, result)
}

log(`Extraction complete: ${extractionsByDocId.size}/${documents.length} document(s) returned structured results.`)

phase('Normalize and exact-coalesce candidates')

function provenanceBase(doc, candidateId, mention, surface, normalized, categorySpecific) {
  return {
    documentId: doc.id,
    documentTitle: doc.title,
    documentPath: doc.path,
    candidateId,
    surface: clip(surface, 200),
    normalized: clip(normalized, 200),
    location: clip(mention.location || '', 160),
    quote: clip(mention.quote || '', 260),
    confidence: Number.isFinite(mention.confidence) ? mention.confidence : 0,
    ...categorySpecific,
  }
}

const candidates = []

for (const doc of documents) {
  const extraction = extractionsByDocId.get(doc.id)
  if (!extraction || extraction.status === 'failed') continue

  for (const [index, person] of asArray(extraction.people).entries()) {
    const candidateId = `${doc.id}:person:${index + 1}`
    const surface = person.surfaceName || person.normalizedName
    const normalized = person.normalizedName || person.surfaceName
    if (!normalizeWhitespace(surface)) continue
    candidates.push({
      id: candidateId,
      type: 'person',
      label: normalizeWhitespace(normalized || surface),
      normalizedValue: normalizeName(normalized || surface),
      aliases: uniq([person.surfaceName, person.normalizedName]),
      provenance: [
        provenanceBase(doc, candidateId, person, surface, normalized, {
          roleOrTitle: clip(person.roleOrTitle || '', 120),
          relationship: clip(person.relationship || '', 160),
        }),
      ],
      confidence: Number.isFinite(person.confidence) ? person.confidence : 0,
    })
  }

  for (const [index, org] of asArray(extraction.organizations).entries()) {
    const candidateId = `${doc.id}:organization:${index + 1}`
    const surface = org.surfaceName || org.normalizedName
    const normalized = org.normalizedName || org.surfaceName
    if (!normalizeWhitespace(surface)) continue
    candidates.push({
      id: candidateId,
      type: 'organization',
      label: normalizeWhitespace(normalized || surface),
      normalizedValue: normalizeName(normalized || surface),
      aliases: uniq([org.surfaceName, org.normalizedName]),
      provenance: [
        provenanceBase(doc, candidateId, org, surface, normalized, {
          orgType: clip(org.orgType || '', 80),
          role: clip(org.role || '', 160),
        }),
      ],
      confidence: Number.isFinite(org.confidence) ? org.confidence : 0,
    })
  }

  for (const [index, date] of asArray(extraction.dates).entries()) {
    const candidateId = `${doc.id}:date:${index + 1}`
    const surface = date.surfaceText || date.normalizedDate
    const normalized = date.normalizedDate || date.surfaceText
    if (!normalizeWhitespace(surface)) continue
    candidates.push({
      id: candidateId,
      type: 'date',
      label: normalizeWhitespace(normalized || surface),
      normalizedValue: normalizeGeneric(normalized || surface),
      aliases: uniq([date.surfaceText, date.normalizedDate]),
      provenance: [
        provenanceBase(doc, candidateId, date, surface, normalized, {
          dateType: clip(date.dateType || '', 160),
        }),
      ],
      confidence: Number.isFinite(date.confidence) ? date.confidence : 0,
    })
  }

  for (const [index, money] of asArray(extraction.monetaryAmounts).entries()) {
    const candidateId = `${doc.id}:monetaryAmount:${index + 1}`
    const surface = money.surfaceText || money.normalizedAmountText
    const numeric =
      money.amount != null && Number.isFinite(money.amount) ? String(money.amount) : ''
    const currency = normalizeWhitespace(money.currency).toUpperCase()
    const normalized =
      currency && numeric
        ? `${currency} ${numeric}`
        : money.normalizedAmountText || money.surfaceText
    if (!normalizeWhitespace(surface)) continue
    candidates.push({
      id: candidateId,
      type: 'monetaryAmount',
      label: normalizeWhitespace(normalized || surface),
      normalizedValue: normalizeGeneric(normalized || surface),
      aliases: uniq([money.surfaceText, money.normalizedAmountText, normalized]),
      provenance: [
        provenanceBase(doc, candidateId, money, surface, normalized, {
          amount: money.amount == null || !Number.isFinite(money.amount) ? null : money.amount,
          currency,
          monetaryType: clip(money.monetaryType || '', 160),
        }),
      ],
      confidence: Number.isFinite(money.confidence) ? money.confidence : 0,
    })
  }
}

function exactCoalesce(records) {
  const byKey = new Map()

  for (const record of records) {
    const key =
      record.normalizedValue && record.normalizedValue.length > 0
        ? `${record.type}|${record.normalizedValue}`
        : `${record.type}|${record.id}`

    if (!byKey.has(key)) {
      byKey.set(key, {
        id: `exact:${key}`,
        type: record.type,
        canonicalLabel: record.label,
        normalizedValue: record.normalizedValue,
        aliases: [...record.aliases],
        sourceRecordIds: [record.id],
        provenance: [...record.provenance],
        confidence: record.confidence,
        notes: 'Exact normalized coalescence.',
      })
    } else {
      const existing = byKey.get(key)
      existing.aliases = uniq([...existing.aliases, ...record.aliases])
      existing.sourceRecordIds.push(record.id)
      existing.provenance.push(...record.provenance)
      existing.confidence = Math.max(existing.confidence, record.confidence)
    }
  }

  return [...byKey.values()]
}

const exactRecords = exactCoalesce(candidates)

log(
  `Flattened ${candidates.length} extracted mention candidate(s) into ${exactRecords.length} exact-normalized record(s).`
)

phase('Semantic deduplication')

function compactRecord(record) {
  const docIds = uniq(record.provenance.map((p) => p.documentId), 40)
  const sampleContexts = record.provenance.slice(0, 6).map((p) => ({
    documentId: p.documentId,
    surface: p.surface,
    location: p.location,
    quote: p.quote,
    role:
      p.role ||
      p.roleOrTitle ||
      p.relationship ||
      p.dateType ||
      p.monetaryType ||
      p.orgType ||
      '',
  }))

  return {
    recordId: record.id,
    type: record.type,
    canonicalLabel: record.canonicalLabel,
    normalizedValue: record.normalizedValue,
    aliases: record.aliases.slice(0, 12),
    mentionCount: record.provenance.length,
    documentIds: docIds,
    sampleContexts,
  }
}

function dedupeInstructions(type) {
  if (type === 'person') {
    return 'Merge only records that refer to the same real human person. Do not merge different people sharing a surname or title. Use aliases, roles, and document context.'
  }
  if (type === 'organization') {
    return 'Merge records that refer to the same legal or commercial organization, including obvious abbreviation/full-name variants. Do not merge parent/subsidiary/counterparty entities unless the context shows they are the same entity.'
  }
  if (type === 'date') {
    return 'Merge date records that represent the same calendar date/value. Different contractual meanings on the same date should still share the canonical date entity; provenance preserves the dateType.'
  }
  return 'Merge monetary records that represent the same currency and amount/value. Different contractual meanings on the same amount should still share the canonical monetary-value entity; provenance preserves the monetaryType.'
}

async function dedupeChunk(type, records, level, chunkIndex, totalChunks) {
  if (records.length <= 1) return records

  const prompt = `You are deduplicating extracted contract entities.

Entity type: ${type}
Deduplication level: ${level}
Chunk: ${chunkIndex + 1} of ${totalChunks}

Instructions:
${dedupeInstructions(type)}

Input records are already exact-normalized/coalesced. Your job is semantic deduplication:
- Return canonicalRecords.
- Every input recordId must appear in exactly one sourceRecordIds array.
- Do not invent sourceRecordIds.
- Merge conservatively when uncertain.
- canonicalLabel should be the best display label.
- normalizedValue should be stable and concise.
- aliases should include useful variants from the input.
- confidence is your confidence in the cluster correctness, 0 to 1.
- mergeRationale should be concise.

Input records:
${JSON.stringify(records.map(compactRecord), null, 2)}`

  const result = await agent(prompt, {
    label: `dedupe-${type}-L${level}-${chunkIndex + 1}`,
    phase: 'Semantic deduplication',
    schema: dedupeSchema,
    effort: input.dedupeEffort || 'medium',
    agentType: input.agentType || undefined,
  })

  if (!result) return records

  const byId = new Map(records.map((record) => [record.id, record]))
  const used = new Set()
  const out = []

  for (const [canonicalIndex, canonical] of asArray(result.canonicalRecords).entries()) {
    const validSourceIds = uniq(canonical.sourceRecordIds || [], records.length).filter((id) =>
      byId.has(id)
    )

    if (validSourceIds.length === 0) continue

    const mergedInputs = []
    for (const id of validSourceIds) {
      if (used.has(id)) continue
      used.add(id)
      mergedInputs.push(byId.get(id))
    }

    if (mergedInputs.length === 0) continue

    out.push({
      id: `${type}:L${level}:C${chunkIndex + 1}:R${canonicalIndex + 1}`,
      type,
      canonicalLabel:
        normalizeWhitespace(canonical.canonicalLabel) ||
        mergedInputs[0].canonicalLabel ||
        mergedInputs[0].label,
      normalizedValue:
        normalizeWhitespace(canonical.normalizedValue) ||
        mergedInputs[0].normalizedValue ||
        normalizeGeneric(canonical.canonicalLabel),
      aliases: uniq([
        ...(canonical.aliases || []),
        ...mergedInputs.flatMap((record) => record.aliases || []),
        ...mergedInputs.map((record) => record.canonicalLabel),
      ]),
      sourceRecordIds: mergedInputs.flatMap((record) => record.sourceRecordIds || [record.id]),
      provenance: mergedInputs.flatMap((record) => record.provenance || []),
      confidence: Math.min(
        1,
        Math.max(
          0,
          Number.isFinite(canonical.confidence)
            ? canonical.confidence
            : Math.max(...mergedInputs.map((record) => record.confidence || 0))
        )
      ),
      notes: clip(canonical.mergeRationale || '', 300),
    })
  }

  for (const record of records) {
    if (!used.has(record.id)) out.push(record)
  }

  return out
}

async function dedupeType(type, records) {
  let current = [...records].sort((a, b) => {
    const ak = `${a.normalizedValue || ''}|${a.canonicalLabel || ''}|${a.id}`
    const bk = `${b.normalizedValue || ''}|${b.canonicalLabel || ''}|${b.id}`
    return ak < bk ? -1 : ak > bk ? 1 : 0
  })

  if (current.length <= 1) return current

  let level = 1

  while (current.length > GLOBAL_DEDUPE_LIMIT && level <= 4) {
    const chunks = chunk(current, DEFAULT_DEDUPE_CHUNK_SIZE)
    log(`Deduplicating ${type}: level ${level}, ${current.length} record(s), ${chunks.length} chunk(s).`)

    const chunkResults = await parallel(
      chunks.map((recordsForChunk, chunkIndex) => async () =>
        dedupeChunk(type, recordsForChunk, level, chunkIndex, chunks.length)
      )
    )

    const next = chunkResults.flatMap((result, index) => result || chunks[index])
    if (next.length >= current.length) {
      current = next
      break
    }

    current = next.sort((a, b) => {
      const ak = `${a.normalizedValue || ''}|${a.canonicalLabel || ''}|${a.id}`
      const bk = `${b.normalizedValue || ''}|${b.canonicalLabel || ''}|${b.id}`
      return ak < bk ? -1 : ak > bk ? 1 : 0
    })
    level += 1
  }

  if (current.length > 1 && current.length <= GLOBAL_DEDUPE_LIMIT) {
    log(`Running final global dedupe for ${type} over ${current.length} record(s).`)
    current = await dedupeChunk(type, current, level, 0, 1)
  } else if (current.length > GLOBAL_DEDUPE_LIMIT) {
    log(
      `Skipping final global dedupe for ${type}: ${current.length} compact records exceed limit ${GLOBAL_DEDUPE_LIMIT}. Chunk-level dedupe retained.`
    )
  }

  return current
}

const recordsByType = {
  person: exactRecords.filter((record) => record.type === 'person'),
  organization: exactRecords.filter((record) => record.type === 'organization'),
  date: exactRecords.filter((record) => record.type === 'date'),
  monetaryAmount: exactRecords.filter((record) => record.type === 'monetaryAmount'),
}

const dedupedByTypeResults = await parallel([
  async () => dedupeType('person', recordsByType.person),
  async () => dedupeType('organization', recordsByType.organization),
  async () => dedupeType('date', recordsByType.date),
  async () => dedupeType('monetaryAmount', recordsByType.monetaryAmount),
])

const dedupedByType = {
  person: dedupedByTypeResults[0] || recordsByType.person,
  organization: dedupedByTypeResults[1] || recordsByType.organization,
  date: dedupedByTypeResults[2] || recordsByType.date,
  monetaryAmount: dedupedByTypeResults[3] || recordsByType.monetaryAmount,
}

phase('Aggregate dataset and QA')

function finalizeEntities(type, records, prefix) {
  const sorted = [...records].sort((a, b) => {
    const ak = `${a.canonicalLabel || ''}|${a.normalizedValue || ''}|${a.id}`
    const bk = `${b.canonicalLabel || ''}|${b.normalizedValue || ''}|${b.id}`
    return ak < bk ? -1 : ak > bk ? 1 : 0
  })

  return sorted.map((record, index) => {
    const entityId = `${prefix}-${String(index + 1).padStart(5, '0')}`
    const provenanceSeen = new Set()
    const provenance = []

    for (const p of record.provenance || []) {
      const key = p.candidateId || `${p.documentId}|${p.surface}|${p.location}|${p.quote}`
      if (provenanceSeen.has(key)) continue
      provenanceSeen.add(key)
      provenance.push(p)
    }

    const documentIds = uniq(provenance.map((p) => p.documentId), 10000)

    return {
      entityId,
      type,
      canonicalLabel: record.canonicalLabel,
      normalizedValue: record.normalizedValue,
      aliases: uniq(record.aliases || [], 200),
      mentionCount: provenance.length,
      documentCount: documentIds.length,
      documentIds,
      provenance,
      confidence: Number.isFinite(record.confidence) ? record.confidence : 0,
      notes: record.notes || '',
    }
  })
}

const entities = {
  people: finalizeEntities('person', dedupedByType.person, 'PERSON'),
  organizations: finalizeEntities('organization', dedupedByType.organization, 'ORG'),
  dates: finalizeEntities('date', dedupedByType.date, 'DATE'),
  monetaryAmounts: finalizeEntities('monetaryAmount', dedupedByType.monetaryAmount, 'MONEY'),
}

const documentSummaries = documents.map((doc) => {
  const extraction = extractionsByDocId.get(doc.id)
  return {
    documentId: doc.id,
    title: doc.title,
    path: doc.path,
    status: extraction ? extraction.status : 'failed',
    extractedCounts: extraction
      ? {
          people: asArray(extraction.people).length,
          organizations: asArray(extraction.organizations).length,
          dates: asArray(extraction.dates).length,
          monetaryAmounts: asArray(extraction.monetaryAmounts).length,
        }
      : {
          people: 0,
          organizations: 0,
          dates: 0,
          monetaryAmounts: 0,
        },
  }
})

const qaInput = {
  summary: {
    documentsRequested: TARGET_DOCUMENTS,
    documentsPrepared: documents.length,
    documentsWithExtractionResults: extractionsByDocId.size,
    failedDocuments: extractionFailures.length,
    candidateMentions: candidates.length,
    exactRecords: exactRecords.length,
    finalEntityCounts: {
      people: entities.people.length,
      organizations: entities.organizations.length,
      dates: entities.dates.length,
      monetaryAmounts: entities.monetaryAmounts.length,
    },
  },
  sampleEntities: {
    people: entities.people.slice(0, 40).map((e) => ({
      entityId: e.entityId,
      canonicalLabel: e.canonicalLabel,
      aliases: e.aliases.slice(0, 8),
      documentCount: e.documentCount,
      mentionCount: e.mentionCount,
    })),
    organizations: entities.organizations.slice(0, 40).map((e) => ({
      entityId: e.entityId,
      canonicalLabel: e.canonicalLabel,
      aliases: e.aliases.slice(0, 8),
      documentCount: e.documentCount,
      mentionCount: e.mentionCount,
    })),
    dates: entities.dates.slice(0, 40).map((e) => ({
      entityId: e.entityId,
      canonicalLabel: e.canonicalLabel,
      aliases: e.aliases.slice(0, 8),
      documentCount: e.documentCount,
      mentionCount: e.mentionCount,
    })),
    monetaryAmounts: entities.monetaryAmounts.slice(0, 40).map((e) => ({
      entityId: e.entityId,
      canonicalLabel: e.canonicalLabel,
      aliases: e.aliases.slice(0, 8),
      documentCount: e.documentCount,
      mentionCount: e.mentionCount,
    })),
  },
  warnings: extractionWarnings.slice(0, 200),
  failures: extractionFailures.slice(0, 200),
}

const qa = await agent(
  `You are a QA reviewer for a contract entity extraction sweep.

Review this aggregate summary for obvious quality risks:
- missing document coverage
- suspiciously low/high entity counts
- likely duplicate canonical entities in the sample
- provenance or normalization concerns
- failures requiring manual follow-up

Return concise structured QA findings. Do not ask for more information.

Aggregate summary:
${JSON.stringify(qaInput, null, 2)}`,
  {
    label: 'aggregate-qa-review',
    phase: 'Aggregate dataset and QA',
    schema: qaSchema,
    effort: 'medium',
  }
)

const output = {
  datasetType: 'contract_entity_extraction_sweep',
  summary: {
    documentsRequested: TARGET_DOCUMENTS,
    documentsPrepared: documents.length,
    documentsWithExtractionResults: extractionsByDocId.size,
    failedDocuments: extractionFailures.length,
    extractedMentionCandidates: candidates.length,
    exactCoalescedRecords: exactRecords.length,
    finalEntityCounts: {
      people: entities.people.length,
      organizations: entities.organizations.length,
      dates: entities.dates.length,
      monetaryAmounts: entities.monetaryAmounts.length,
      total:
        entities.people.length +
        entities.organizations.length +
        entities.dates.length +
        entities.monetaryAmounts.length,
    },
  },
  entities,
  documents: documentSummaries,
  failures: extractionFailures,
  warnings: extractionWarnings,
  qa: qa || {
    passed: false,
    issues: [
      {
        severity: 'medium',
        message: 'QA agent did not return a result.',
        entityIds: [],
      },
    ],
    recommendations: ['Manually review extraction summary and deduplication output.'],
  },
}

log(
  `Completed extraction sweep: ${output.summary.finalEntityCounts.total} deduplicated entities across ${documents.length} document(s).`
)

output
```

> **GPT-5.5 judge:** The workflow has good structured schemas, capped/compact fields, stable document IDs, null-tolerant fallbacks in places, extraction retry handling, and final aggregation that records failures/warnings and tolerates partial inputs. However, it performs a single large parallel() fan-out over up to 200 document extraction agents, has no bounded 6-8 sized waves, no per-wave checkpoint/commit, no ScheduleWakeup or stall watchdog, no durable resume/cache mechanism, and no high-failure-rate backoff. A hung agent connection could therefore block the main extraction barrier with no notification, and completed in-memory work is not safely committed before later barriers. Deduplication also uses parallel chunk fan-out without an explicit concurrency bound or watchdog. Overall it meets only a minority of the safe-by-construction bar.

## With skill — rubric 78%, patterns 88%

```js
export const meta = {
  name: 'document-extraction-sweep',
  description: 'Extract people, organizations, dates, and monetary amounts from contract documents and aggregate a deduplicated provenance dataset.',
  phases: [
    { title: 'Discover documents' },
    { title: 'Extract entities' },
    { title: 'Retry failures' },
    { title: 'Aggregate dataset' },
  ],
}

/*
Agent-level watchdog to arm immediately after launching this workflow:

ScheduleWakeup({
  delaySeconds: 1200,
  reason: "watchdog: document extraction sweep wf_<id> may stall silently; check journal mtime",
  prompt: "Watchdog for document extraction sweep run wf_<id> (task <taskId>, journal at <path>): if the journal mtime is older than 20 min AND the workflow task is not 'completed', TaskStop the task then resume with Workflow({scriptPath, resumeFromRunId}); otherwise re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog only; do NOT use an autonomous-loop sentinel."
})
*/

const DISCOVERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['documents'],
  properties: {
    documents: {
      type: 'array',
      maxItems: 250,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'ref', 'title'],
        properties: {
          key: { type: 'string' },
          ref: { type: 'string', description: 'Stable path, URI, or other locator.' },
          title: { type: 'string' },
        },
      },
    },
  },
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['docKey', 'docTitle', 'docRef', 'people', 'organizations', 'dates', 'monetaryAmounts', 'extractionNotes'],
  properties: {
    docKey: { type: 'string' },
    docTitle: { type: 'string' },
    docRef: { type: 'string' },
    extractionNotes: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string' },
    },
    people: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['surface', 'normalizedName', 'role', 'evidence', 'confidence'],
        properties: {
          surface: { type: 'string' },
          normalizedName: { type: 'string' },
          role: { type: 'string' },
          evidence: { type: 'string', description: 'Short quote or pinpoint context, <=240 chars.' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    organizations: {
      type: 'array',
      maxItems: 60,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['surface', 'normalizedName', 'orgType', 'role', 'evidence', 'confidence'],
        properties: {
          surface: { type: 'string' },
          normalizedName: { type: 'string' },
          orgType: { type: 'string' },
          role: { type: 'string' },
          evidence: { type: 'string', description: 'Short quote or pinpoint context, <=240 chars.' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    dates: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['surface', 'isoDate', 'dateType', 'evidence', 'confidence'],
        properties: {
          surface: { type: 'string' },
          isoDate: {
            type: 'string',
            description: 'YYYY-MM-DD if exact; YYYY-MM or YYYY if partial; empty string if not normalizable.',
          },
          dateType: { type: 'string', description: 'Effective date, execution date, termination date, notice date, etc.' },
          evidence: { type: 'string', description: 'Short quote or pinpoint context, <=240 chars.' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    monetaryAmounts: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['surface', 'amount', 'currency', 'amountType', 'evidence', 'confidence'],
        properties: {
          surface: { type: 'string' },
          amount: {
            type: 'string',
            description: 'Normalized decimal string without thousands separators if exact; otherwise concise normalized text.',
          },
          currency: { type: 'string', description: 'ISO 4217 code if known, otherwise the currency symbol/name as written.' },
          amountType: { type: 'string', description: 'Fee, cap, penalty, rent, purchase price, indemnity limit, etc.' },
          evidence: { type: 'string', description: 'Short quote or pinpoint context, <=240 chars.' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
}

const rawArgs = args || {}
const EXPECTED_COUNT = Number(rawArgs.expectedCount || 200) || 200
const WAVE_SIZE = Math.max(1, Math.min(8, Number(rawArgs.waveSize || 6) || 6))
const RETRY_WAVE_SIZE = Math.max(1, Math.min(8, Number(rawArgs.retryWaveSize || WAVE_SIZE) || WAVE_SIZE))
const SOFT_TIMEOUT_MS = Math.max(60_000, Number(rawArgs.softTimeoutMs || 480_000) || 480_000)
const ENABLE_SOFT_TIMEOUT = rawArgs.enableSoftTimeout === true && typeof setTimeout === 'function'

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function asString(v) {
  return v === undefined || v === null ? '' : String(v)
}

function truncate(s, max) {
  const t = asString(s).replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : t.slice(0, max - 1) + '…'
}

function stableDoc(raw, index) {
  const ref = asString(raw.ref || raw.path || raw.uri || raw.url || raw.file || raw.filename)
  const title = asString(raw.title || raw.name || ref || `Contract document ${index + 1}`)
  const key = asString(raw.key || raw.id || ref || `doc-${String(index + 1).padStart(3, '0')}`)
  return {
    key,
    title,
    ref,
    text: raw.text === undefined || raw.text === null ? '' : String(raw.text),
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
  }
}

function normalizeInputDocuments(input) {
  const docs = Array.isArray(input) ? input.map(stableDoc) : []
  const seen = new Set()
  const out = []
  for (const d of docs) {
    let k = d.key || d.ref || d.title
    if (!k) k = `doc-${String(out.length + 1).padStart(3, '0')}`
    let unique = k
    let suffix = 2
    while (seen.has(unique)) {
      unique = `${k}#${suffix}`
      suffix += 1
    }
    seen.add(unique)
    out.push({ ...d, key: unique })
  }
  return out
}

function withSoftTimeout(promise) {
  if (!ENABLE_SOFT_TIMEOUT) return promise
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(null), SOFT_TIMEOUT_MS)),
  ])
}

function buildAgentOpts(schema, label, phaseName, effort) {
  const opts = {
    label,
    phase: phaseName,
    schema,
    effort: effort || rawArgs.effort || 'medium',
  }
  if (rawArgs.model) opts.model = rawArgs.model
  if (rawArgs.agentType) opts.agentType = rawArgs.agentType
  if (rawArgs.isolation === 'worktree') opts.isolation = 'worktree'
  return opts
}

function buildExtractionPrompt(doc) {
  const sourceBlock = doc.text
    ? `The full document text is provided below. Use it as the source of truth.\n\n<DOCUMENT_TEXT>\n${doc.text}\n</DOCUMENT_TEXT>`
    : `The document text is not embedded. Read the document from this stable locator/path if available: ${doc.ref || '(no ref provided)'}. Do not modify files.`

  return `You are extracting structured contract entities for a document extraction sweep.

Document identity:
- docKey: ${doc.key}
- docTitle: ${doc.title}
- docRef: ${doc.ref || '(embedded or unknown)'}

Task:
Extract contract-relevant entities from this single document:
1. People: signatories, named representatives, officers, contacts, notices recipients, authors, witnesses, guarantors, individual parties.
2. Organizations: parties, affiliates, counterparties, vendors, customers, guarantors, government bodies, law firms, banks, notice recipients.
3. Dates: effective dates, execution dates, start/end/renewal/termination dates, deadlines, notice dates, payment due dates, amendment dates.
4. Monetary amounts: fees, prices, caps, penalties, rent, limits of liability, indemnity caps, deposits, interest, discounts, thresholds.

Rules:
- Return ONLY entities supported by this document.
- Deduplicate within this document: one row per unique entity/value per materially distinct role or context.
- Keep output lean. Evidence must be a short quote or pinpoint context, not a long excerpt.
- Normalize names and values aggressively but do not invent missing facts.
- For organizations, normalizedName should remove obvious punctuation/capitalization noise but keep the legal name recognizable.
- For dates, isoDate must be YYYY-MM-DD if exact; YYYY-MM or YYYY if only partial; empty string if not normalizable.
- For monetary amounts, amount should be a normalized decimal string when exact, without thousands separators; currency should be ISO 4217 when clear.
- Confidence is 0..1. Omit low-confidence guesses instead of returning them.
- Your output is data for aggregation; fill every schema field.

${sourceBlock}`
}

function sanitizeExtraction(result, doc) {
  if (!result) return null
  const clean = {
    docKey: doc.key,
    docTitle: doc.title,
    docRef: doc.ref,
    people: Array.isArray(result.people) ? result.people : [],
    organizations: Array.isArray(result.organizations) ? result.organizations : [],
    dates: Array.isArray(result.dates) ? result.dates : [],
    monetaryAmounts: Array.isArray(result.monetaryAmounts) ? result.monetaryAmounts : [],
    extractionNotes: Array.isArray(result.extractionNotes) ? result.extractionNotes.map(n => truncate(n, 240)).slice(0, 8) : [],
  }
  return clean
}

async function runDocument(doc) {
  const prompt = buildExtractionPrompt(doc)
  const result = await withSoftTimeout(agent(
    prompt,
    buildAgentOpts(EXTRACTION_SCHEMA, `extract:${doc.key}`, 'Extract entities', rawArgs.extractionEffort || 'medium'),
  ))
  return sanitizeExtraction(result, doc)
}

function simpleKey(s) {
  return asString(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const ORG_SUFFIXES = new Set([
  'inc', 'incorporated', 'llc', 'ltd', 'limited', 'corp', 'corporation', 'company', 'co',
  'plc', 'lp', 'llp', 'gmbh', 'sarl', 'sa', 'sas', 'ag', 'bv', 'nv', 'pte', 'pty',
])

const PERSON_PREFIXES = new Set([
  'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'sir', 'madam',
])

function personKey(e) {
  const words = simpleKey(e.normalizedName || e.surface).split(' ').filter(Boolean)
  while (words.length && PERSON_PREFIXES.has(words[0])) words.shift()
  return words.join(' ')
}

function orgKey(e) {
  const words = simpleKey(e.normalizedName || e.surface).split(' ').filter(Boolean)
  while (words.length && ORG_SUFFIXES.has(words[words.length - 1])) words.pop()
  return words.join(' ')
}

function dateKey(e) {
  return simpleKey(e.isoDate || e.surface)
}

function moneyKey(e) {
  const currency = simpleKey(e.currency || '')
  const amount = simpleKey(e.amount || e.surface)
  return `${currency}:${amount}`
}

function makeRecord(kind, key, e) {
  const canonical =
    kind === 'person' ? asString(e.normalizedName || e.surface).trim() :
    kind === 'organization' ? asString(e.normalizedName || e.surface).trim() :
    kind === 'date' ? asString(e.isoDate || e.surface).trim() :
    asString([e.currency, e.amount].filter(Boolean).join(' ') || e.surface).trim()

  const record = {
    key,
    kind,
    canonical,
    surfaceForms: [],
    contexts: [],
    provenance: [],
    _surfaceSet: new Set(),
    _contextSet: new Set(),
    _provenanceSet: new Set(),
  }

  if (kind === 'date') record.isoDate = asString(e.isoDate || '')
  if (kind === 'monetaryAmount') {
    record.currency = asString(e.currency || '')
    record.amount = asString(e.amount || '')
  }

  return record
}

function addUniqueArrayValue(record, field, setField, value, maxLen) {
  const v = truncate(value, maxLen || 160)
  if (!v) return
  if (record[setField].has(v)) return
  record[setField].add(v)
  record[field].push(v)
}

function addEntity(bucket, kind, rawEntity, extraction) {
  if (!rawEntity || typeof rawEntity !== 'object') return

  const key =
    kind === 'person' ? personKey(rawEntity) :
    kind === 'organization' ? orgKey(rawEntity) :
    kind === 'date' ? dateKey(rawEntity) :
    moneyKey(rawEntity)

  if (!key) return

  let record = bucket.get(key)
  if (!record) {
    record = makeRecord(kind, key, rawEntity)
    bucket.set(key, record)
  }

  addUniqueArrayValue(record, 'surfaceForms', '_surfaceSet', rawEntity.surface || rawEntity.normalizedName || rawEntity.isoDate || rawEntity.amount, 160)

  const context =
    kind === 'person' ? rawEntity.role :
    kind === 'organization' ? [rawEntity.orgType, rawEntity.role].filter(Boolean).join(': ') :
    kind === 'date' ? rawEntity.dateType :
    rawEntity.amountType

  addUniqueArrayValue(record, 'contexts', '_contextSet', context, 160)

  const provenance = {
    docKey: extraction.docKey,
    docTitle: extraction.docTitle,
    docRef: extraction.docRef,
    surface: truncate(rawEntity.surface || '', 160),
    context: truncate(context || '', 160),
    evidence: truncate(rawEntity.evidence || '', 240),
    confidence: typeof rawEntity.confidence === 'number' ? rawEntity.confidence : null,
  }

  const provenanceKey = [
    provenance.docKey,
    provenance.surface,
    provenance.context,
    provenance.evidence,
  ].join('|')

  if (!record._provenanceSet.has(provenanceKey)) {
    record._provenanceSet.add(provenanceKey)
    record.provenance.push(provenance)
  }
}

function finalizeBucket(bucket) {
  return [...bucket.values()]
    .map(record => {
      const out = { ...record }
      delete out._surfaceSet
      delete out._contextSet
      delete out._provenanceSet
      out.surfaceForms.sort()
      out.contexts.sort()
      out.provenance.sort((a, b) => {
        const ak = `${a.docKey}|${a.context}|${a.surface}`
        const bk = `${b.docKey}|${b.context}|${b.surface}`
        return ak > bk ? 1 : ak < bk ? -1 : 0
      })
      out.documentCount = new Set(out.provenance.map(p => p.docKey)).size
      out.occurrenceCount = out.provenance.length
      return out
    })
    .sort((a, b) => {
      const ak = `${a.canonical}|${a.key}`
      const bk = `${b.canonical}|${b.key}`
      return ak > bk ? 1 : ak < bk ? -1 : 0
    })
}

function aggregateExtractions(extractions) {
  const people = new Map()
  const organizations = new Map()
  const dates = new Map()
  const monetaryAmounts = new Map()

  for (const extraction of extractions) {
    for (const e of extraction.people || []) addEntity(people, 'person', e, extraction)
    for (const e of extraction.organizations || []) addEntity(organizations, 'organization', e, extraction)
    for (const e of extraction.dates || []) addEntity(dates, 'date', e, extraction)
    for (const e of extraction.monetaryAmounts || []) addEntity(monetaryAmounts, 'monetaryAmount', e, extraction)
  }

  const dataset = {
    people: finalizeBucket(people),
    organizations: finalizeBucket(organizations),
    dates: finalizeBucket(dates),
    monetaryAmounts: finalizeBucket(monetaryAmounts),
  }

  dataset.counts = {
    people: dataset.people.length,
    organizations: dataset.organizations.length,
    dates: dataset.dates.length,
    monetaryAmounts: dataset.monetaryAmounts.length,
    provenanceRows:
      dataset.people.reduce((n, e) => n + e.provenance.length, 0) +
      dataset.organizations.reduce((n, e) => n + e.provenance.length, 0) +
      dataset.dates.reduce((n, e) => n + e.provenance.length, 0) +
      dataset.monetaryAmounts.reduce((n, e) => n + e.provenance.length, 0),
  }

  return dataset
}

phase('Discover documents')

let documents = normalizeInputDocuments(rawArgs.documents || rawArgs.docs || rawArgs.contracts)

if (!documents.length) {
  const discoveryPrompt = `Discover the contract documents for a document extraction sweep.

Expected document count: ${EXPECTED_COUNT}
Search scope/root: ${asString(rawArgs.root || rawArgs.contractsRoot || rawArgs.directory || '.')}
Optional glob/pattern hint: ${asString(rawArgs.pattern || rawArgs.glob || rawArgs.documentPattern || '')}

Return a lean list of documents. Each item needs:
- key: stable unique id derived from path/name
- ref: path/URI/locator
- title: human-readable title

Do not extract entities yet. Do not modify files.`

  const discovered = await agent(
    discoveryPrompt,
    buildAgentOpts(DISCOVERY_SCHEMA, 'discover:contracts', 'Discover documents', rawArgs.discoveryEffort || 'low'),
  )

  documents = normalizeInputDocuments(discovered && discovered.documents ? discovered.documents : [])
}

if (!documents.length) {
  return {
    ok: false,
    error: 'No contract documents were provided or discovered. Pass args.documents with {key, title, ref/path, text?} entries or provide a root/pattern for discovery.',
    expectedCount: EXPECTED_COUNT,
  }
}

if (documents.length !== EXPECTED_COUNT) {
  log(`Document count notice: expected ${EXPECTED_COUNT}, will process ${documents.length}.`)
} else {
  log(`Document count confirmed: ${documents.length}.`)
}

const waves = chunk(documents, WAVE_SIZE)
const completedByKey = new Map()
let failed = []
let instabilityBreak = false
let stoppedBeforeWave = -1

for (let w = 0; w < waves.length; w++) {
  phase(`Extract wave ${w + 1}/${waves.length}`)
  const waveDocs = waves[w]
  log(`Starting extraction wave ${w + 1}/${waves.length} with ${waveDocs.length} documents.`)

  const batch = await parallel(waveDocs.map(doc => () => runDocument(doc)))

  let ok = 0
  let nulls = 0

  batch.forEach((result, i) => {
    const doc = waveDocs[i]
    if (result) {
      completedByKey.set(doc.key, result)
      ok += 1
    } else {
      failed.push(doc)
      nulls += 1
    }
  })

  log(`Wave ${w + 1}: ${ok}/${waveDocs.length} succeeded; cumulative ${completedByKey.size}/${documents.length}; ${failed.length} queued for retry.`)

  if (nulls / waveDocs.length > 0.4) {
    instabilityBreak = true
    stoppedBeforeWave = w + 1
    log(`instability: ${nulls}/${waveDocs.length} failed this wave — backing off; returning partial dataset for resume later.`)
    break
  }
}

if (!instabilityBreak && failed.length) {
  phase('Retry failures')
  const retryDocs = failed
  failed = []
  const retryWaves = chunk(retryDocs, RETRY_WAVE_SIZE)

  for (let w = 0; w < retryWaves.length; w++) {
    const waveDocs = retryWaves[w]
    log(`Starting retry wave ${w + 1}/${retryWaves.length} with ${waveDocs.length} documents.`)

    const batch = await parallel(waveDocs.map(doc => () => runDocument(doc)))

    let ok = 0
    let nulls = 0

    batch.forEach((result, i) => {
      const doc = waveDocs[i]
      if (result) {
        completedByKey.set(doc.key, result)
        ok += 1
      } else {
        failed.push(doc)
        nulls += 1
      }
    })

    log(`Retry wave ${w + 1}: recovered ${ok}/${waveDocs.length}; cumulative ${completedByKey.size}/${documents.length}; still missing ${failed.length}.`)

    if (nulls / waveDocs.length > 0.4) {
      instabilityBreak = true
      log(`instability: ${nulls}/${waveDocs.length} failed this retry wave — backing off; returning partial dataset for resume later.`)
      break
    }
  }
}

phase('Aggregate dataset')

const completed = [...completedByKey.values()].sort((a, b) => a.docKey > b.docKey ? 1 : a.docKey < b.docKey ? -1 : 0)
const haveKeys = new Set(completed.map(r => r.docKey))
const missingDocuments = documents
  .filter(d => !haveKeys.has(d.key))
  .map(d => ({ key: d.key, title: d.title, ref: d.ref }))

if (missingDocuments.length) {
  log(`partial: missing ${missingDocuments.length}/${documents.length} documents: ${missingDocuments.map(d => d.key).join(', ')}`)
}

const dataset = aggregateExtractions(completed)

const extractionCountsByDocument = completed.map(r => ({
  docKey: r.docKey,
  docTitle: r.docTitle,
  docRef: r.docRef,
  people: (r.people || []).length,
  organizations: (r.organizations || []).length,
  dates: (r.dates || []).length,
  monetaryAmounts: (r.monetaryAmounts || []).length,
  notes: r.extractionNotes || [],
}))

return {
  ok: true,
  partial: missingDocuments.length > 0,
  instabilityBreak,
  stoppedBeforeWave,
  expectedDocuments: EXPECTED_COUNT,
  inputDocuments: documents.length,
  extractedDocuments: completed.length,
  missingDocuments,
  extractionCountsByDocument,
  dataset,
  notes: [
    'Dataset entities are deduplicated by deterministic normalized keys produced from extracted canonical names/values.',
    'Each deduplicated entity contains provenance rows identifying the source document, surface form, context, evidence, and confidence.',
    'If the workflow output is truncated by the UI/output cap, parse the workflow journal.jsonl for the full agent extraction results.',
    'On stall or instability, stop the task and resume with Workflow({scriptPath, resumeFromRunId}); stable prompts preserve completed extraction cache hits.',
  ],
}
```

> **GPT-5.5 judge:** The script meets most of the safety bar: it uses bounded waves with a capped wave size, processes results wave-by-wave, tolerates null failures, retries failed documents, backs off on high per-wave failure rates, uses capped schemas and lean evidence fields, aggregates partial results, explicitly reports missing documents, and includes resume/cache-stability guidance. It also includes a ScheduleWakeup watchdog snippet and resume instructions, but the watchdog is only in a comment rather than actually armed by the workflow, and the soft timeout is opt-in rather than enabled by default. It also keeps completed results primarily in memory until final return, relying on workflow journals rather than explicitly checkpointing per wave. Overall it is substantially safe-by-construction but not perfect against hangs or lost work.

