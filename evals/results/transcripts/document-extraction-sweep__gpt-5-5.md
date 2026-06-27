# document-extraction-sweep — `gpt-5.5`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a DOCUMENT EXTRACTION SWEEP: extract structured entities (people, organizations, dates, monetary amounts) from 200 contract documents and aggregate them into a single deduplicated dataset, with per-document provenance.

---

## Baseline (no skill) — rubric 35%, patterns 31%

```js
export const meta = {
  name: 'document-extraction-sweep',
  description: 'Extract people, organizations, dates, and monetary amounts from contract documents and aggregate a deduplicated dataset with per-document provenance.',
  phases: [
    { title: 'Validate inputs' },
    { title: 'Extract entities' },
    { title: 'Deduplicate and aggregate' },
    { title: 'Quality review' },
  ],
}

phase('Validate inputs')

const inputDocuments = Array.isArray(args?.documents)
  ? args.documents
  : Array.isArray(args?.docs)
    ? args.docs
    : []

if (inputDocuments.length === 0) {
  throw new Error(
    'Expected args.documents or args.docs to be a non-empty array of contract documents. Each document should include at least { id?, title?, path? | sourcePath?, text? }.'
  )
}

if (inputDocuments.length > 200) {
  throw new Error(
    `This sweep is configured for up to 200 contract documents; received ${inputDocuments.length}. Split the corpus or adjust the workflow.`
  )
}

const documents = inputDocuments.map((doc, index) => {
  const ordinal = String(index + 1).padStart(3, '0')
  const id =
    typeof doc?.id === 'string' && doc.id.trim()
      ? doc.id.trim()
      : typeof doc?.documentId === 'string' && doc.documentId.trim()
        ? doc.documentId.trim()
        : `doc-${ordinal}`

  const title =
    typeof doc?.title === 'string' && doc.title.trim()
      ? doc.title.trim()
      : typeof doc?.name === 'string' && doc.name.trim()
        ? doc.name.trim()
        : id

  const sourcePath =
    typeof doc?.path === 'string' && doc.path.trim()
      ? doc.path.trim()
      : typeof doc?.sourcePath === 'string' && doc.sourcePath.trim()
        ? doc.sourcePath.trim()
        : typeof doc?.file === 'string' && doc.file.trim()
          ? doc.file.trim()
          : null

  const text =
    typeof doc?.text === 'string'
      ? doc.text
      : typeof doc?.content === 'string'
        ? doc.content
        : null

  return {
    id,
    index,
    ordinal,
    title,
    sourcePath,
    text,
    metadata:
      doc && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
        ? doc.metadata
        : {},
  }
})

log(`Starting extraction sweep for ${documents.length} contract document(s).`)

const locationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    page: { type: ['integer', 'null'], description: 'Page number if available.' },
    section: { type: ['string', 'null'], description: 'Section heading if available.' },
    clause: { type: ['string', 'null'], description: 'Clause number/name if available.' },
    charStart: {
      type: ['integer', 'null'],
      description: 'Approximate character start offset if extracting from supplied text.',
    },
    charEnd: {
      type: ['integer', 'null'],
      description: 'Approximate character end offset if extracting from supplied text.',
    },
  },
  required: ['page', 'section', 'clause', 'charStart', 'charEnd'],
}

const commonMentionProperties = {
  mentionText: {
    type: 'string',
    description: 'Exact entity text as it appears in the document.',
  },
  context: {
    type: ['string', 'null'],
    description: 'Short explanation of why this mention matters in the contract.',
  },
  quote: {
    type: ['string', 'null'],
    description: 'Brief supporting quote containing the mention.',
  },
  location: locationSchema,
  confidence: {
    type: 'number',
    minimum: 0,
    maximum: 1,
    description: 'Confidence that this is a correctly extracted contract entity.',
  },
}

const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    documentId: { type: 'string' },
    documentTitle: { type: 'string' },
    people: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...commonMentionProperties,
          normalizedName: {
            type: ['string', 'null'],
            description: 'Canonical full person name when inferable.',
          },
          role: {
            type: ['string', 'null'],
            description: 'Signer, notice recipient, officer, attorney, guarantor, contact, etc.',
          },
          affiliatedOrganization: {
            type: ['string', 'null'],
            description: 'Organization connected to this person if stated.',
          },
        },
        required: [
          'mentionText',
          'normalizedName',
          'role',
          'affiliatedOrganization',
          'context',
          'quote',
          'location',
          'confidence',
        ],
      },
    },
    organizations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...commonMentionProperties,
          normalizedName: {
            type: ['string', 'null'],
            description: 'Canonical legal or business name when inferable.',
          },
          role: {
            type: ['string', 'null'],
            description: 'Party, counterparty, affiliate, guarantor, lender, vendor, customer, regulator, etc.',
          },
          organizationType: {
            type: ['string', 'null'],
            description: 'LLC, corporation, partnership, government agency, individual proprietor, etc.',
          },
          jurisdiction: {
            type: ['string', 'null'],
            description: 'State/country of formation or relevant jurisdiction if stated.',
          },
        },
        required: [
          'mentionText',
          'normalizedName',
          'role',
          'organizationType',
          'jurisdiction',
          'context',
          'quote',
          'location',
          'confidence',
        ],
      },
    },
    dates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...commonMentionProperties,
          normalizedDate: {
            type: ['string', 'null'],
            description:
              'ISO 8601 date, month, year, or interval when inferable, e.g. 2024-03-15 or 2024-01-01/2024-12-31.',
          },
          dateType: {
            type: ['string', 'null'],
            description:
              'Effective date, execution date, expiration date, renewal deadline, notice deadline, payment due date, etc.',
          },
          isApproximate: {
            type: 'boolean',
            description: 'True if the normalized date is inferred or approximate.',
          },
        },
        required: [
          'mentionText',
          'normalizedDate',
          'dateType',
          'isApproximate',
          'context',
          'quote',
          'location',
          'confidence',
        ],
      },
    },
    monetaryAmounts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...commonMentionProperties,
          amountText: {
            type: ['string', 'null'],
            description: 'Exact amount phrase if different from mentionText.',
          },
          normalizedAmount: {
            type: 'object',
            additionalProperties: false,
            properties: {
              value: {
                type: ['number', 'null'],
                description: 'Numeric amount without commas or currency symbols when inferable.',
              },
              currency: {
                type: ['string', 'null'],
                description: 'ISO 4217 currency code when inferable, e.g. USD.',
              },
              unit: {
                type: ['string', 'null'],
                description: 'Per month, per annum, per share, aggregate, one-time, etc.',
              },
            },
            required: ['value', 'currency', 'unit'],
          },
          amountType: {
            type: ['string', 'null'],
            description:
              'Purchase price, rent, fee, cap, liability limit, penalty, deposit, reimbursement, interest rate amount, etc.',
          },
        },
        required: [
          'mentionText',
          'amountText',
          'normalizedAmount',
          'amountType',
          'context',
          'quote',
          'location',
          'confidence',
        ],
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Extraction caveats, OCR problems, ambiguous references, or missing sections.',
    },
  },
  required: [
    'documentId',
    'documentTitle',
    'people',
    'organizations',
    'dates',
    'monetaryAmounts',
    'warnings',
  ],
}

function truncate(value, maxLength) {
  const s = value == null ? '' : String(value)
  if (s.length <= maxLength) return s
  return `${s.slice(0, maxLength)}…[truncated ${s.length - maxLength} chars]`
}

function extractionPrompt(doc) {
  const hasText = typeof doc.text === 'string' && doc.text.trim().length > 0
  const sourceDescriptor = hasText
    ? `The contract text is supplied below.`
    : doc.sourcePath
      ? `Read and inspect the contract at this repository/workspace path: ${doc.sourcePath}`
      : `No text or source path was supplied; report a warning and extract nothing.`

  const textBlock = hasText
    ? `\n\n<contract_text document_id="${doc.id}" title="${doc.title}">\n${doc.text}\n</contract_text>`
    : ''

  return `
You are performing a high-recall legal document extraction pass over one contract.

Document:
- documentId: ${doc.id}
- documentTitle: ${doc.title}
- sourcePath: ${doc.sourcePath || '(none)'}

${sourceDescriptor}

Extract structured entities in these four categories only:
1. people
2. organizations
3. dates
4. monetaryAmounts

Rules:
- Prefer recall, but do not include generic terms that are not concrete entities.
- Keep every materially distinct mention if it gives useful provenance, even when normalized to the same entity.
- Use exact mentionText from the document.
- Provide a concise supporting quote for every entity whenever possible.
- Provide page/section/clause/char offsets when available; otherwise null.
- Normalize names, ISO dates, currencies, and numeric amounts where possible.
- For organizations, include contract role and jurisdiction/type if stated.
- For people, include role and affiliated organization if stated.
- For dates, include dateType and mark isApproximate when inferred.
- For money, include amountType, numeric value, currency code, and unit when inferable.
- If the document is unreadable or inaccessible, return empty arrays and put the reason in warnings.
- Return only data matching the requested schema.

${textBlock}
`.trim()
}

phase('Extract entities')

const extractionEffort =
  args?.extractionEffort === 'low' ||
  args?.extractionEffort === 'medium' ||
  args?.extractionEffort === 'high' ||
  args?.extractionEffort === 'xhigh' ||
  args?.extractionEffort === 'max'
    ? args.extractionEffort
    : 'high'

const extractionResults = await pipeline(documents, async (doc) => {
  log(`Extracting entities from ${doc.ordinal}/${String(documents.length).padStart(3, '0')}: ${doc.id}`)

  const extraction = await agent(extractionPrompt(doc), {
    label: `extract:${doc.id}`,
    phase: 'Extract entities',
    schema: extractionSchema,
    effort: extractionEffort,
  })

  if (extraction === null) {
    return {
      status: 'failed',
      document: doc,
      extraction: null,
      error: 'Extraction agent returned null or failed after internal retries.',
    }
  }

  return {
    status: 'ok',
    document: doc,
    extraction,
    error: null,
  }
})

phase('Deduplicate and aggregate')

function cleanString(value) {
  return value == null ? '' : String(value).replace(/\s+/g, ' ').trim()
}

function canonicalText(value) {
  return cleanString(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[“”"'`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9.$/% -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function personKey(entity) {
  let s = canonicalText(entity?.normalizedName || entity?.mentionText)
  s = s
    .replace(/\b(mr|mrs|ms|miss|dr|prof|esq|jr|sr|ii|iii|iv)\b\.?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s || canonicalText(entity?.mentionText) || 'unknown-person'
}

function organizationKey(entity) {
  let s = canonicalText(entity?.normalizedName || entity?.mentionText)
  s = s
    .replace(
      /\b(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|l\.l\.c|pllc|lp|l\.p|llp|l\.l\.p|plc|gmbh|s\.a\.|sa|ag|bv|pte|pty)\b\.?/g,
      ' '
    )
    .replace(/\bthe\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s || canonicalText(entity?.mentionText) || 'unknown-organization'
}

function dateKey(entity) {
  const normalized = cleanString(entity?.normalizedDate)
  if (normalized) return normalized.toUpperCase()
  return canonicalText(entity?.mentionText) || 'unknown-date'
}

function moneyKey(entity) {
  const amount = entity?.normalizedAmount || {}
  const value =
    typeof amount.value === 'number' && Number.isFinite(amount.value)
      ? amount.value.toFixed(2)
      : cleanString(amount.value)
  const currency = cleanString(amount.currency || '').toUpperCase()
  const unit = canonicalText(amount.unit || '')
  if (value || currency) return `${currency || 'UNK'}:${value || 'UNK'}:${unit || 'unit-unknown'}`
  return canonicalText(entity?.amountText || entity?.mentionText) || 'unknown-money'
}

function typedKey(type, entity) {
  if (type === 'people') return `person:${personKey(entity)}`
  if (type === 'organizations') return `organization:${organizationKey(entity)}`
  if (type === 'dates') return `date:${dateKey(entity)}`
  if (type === 'monetaryAmounts') return `money:${moneyKey(entity)}`
  return `${type}:${canonicalText(entity?.mentionText)}`
}

function displayName(type, entity) {
  if (type === 'people' || type === 'organizations') {
    return cleanString(entity?.normalizedName || entity?.mentionText)
  }
  if (type === 'dates') {
    return cleanString(entity?.normalizedDate || entity?.mentionText)
  }
  if (type === 'monetaryAmounts') {
    const amount = entity?.normalizedAmount || {}
    const value =
      typeof amount.value === 'number' && Number.isFinite(amount.value)
        ? String(amount.value)
        : cleanString(amount.value)
    const currency = cleanString(amount.currency || '').toUpperCase()
    const unit = cleanString(amount.unit || '')
    const composed = cleanString(`${currency} ${value}${unit ? ` ${unit}` : ''}`)
    return composed || cleanString(entity?.amountText || entity?.mentionText)
  }
  return cleanString(entity?.mentionText)
}

function idPrefix(type) {
  if (type === 'people') return 'person'
  if (type === 'organizations') return 'org'
  if (type === 'dates') return 'date'
  if (type === 'monetaryAmounts') return 'money'
  return 'entity'
}

function uniquePush(array, value) {
  const v = cleanString(value)
  if (!v) return
  if (!array.includes(v)) array.push(v)
}

function uniquePushObject(array, object, keyFn) {
  const key = keyFn(object)
  if (!array.some((existing) => keyFn(existing) === key)) array.push(object)
}

function makeProvenance(type, entity, doc, extraction) {
  return {
    documentId: doc.id,
    documentTitle: doc.title,
    documentIndex: doc.index,
    sourcePath: doc.sourcePath,
    mentionText: cleanString(entity?.mentionText),
    normalizedValue:
      type === 'dates'
        ? cleanString(entity?.normalizedDate)
        : type === 'monetaryAmounts'
          ? cleanString(displayName(type, entity))
          : cleanString(entity?.normalizedName),
    roleOrType:
      type === 'people' || type === 'organizations'
        ? cleanString(entity?.role)
        : type === 'dates'
          ? cleanString(entity?.dateType)
          : cleanString(entity?.amountType),
    context: truncate(cleanString(entity?.context), 800),
    quote: truncate(cleanString(entity?.quote), 1200),
    location: entity?.location || {
      page: null,
      section: null,
      clause: null,
      charStart: null,
      charEnd: null,
    },
    confidence:
      typeof entity?.confidence === 'number' && Number.isFinite(entity.confidence)
        ? entity.confidence
        : null,
    extractorDocumentId: cleanString(extraction?.documentId),
  }
}

function makeEntity(type, entity, id) {
  const base = {
    id,
    type,
    canonical: displayName(type, entity),
    variants: [],
    provenanceCount: 0,
    documentIds: [],
    provenance: [],
  }

  uniquePush(base.variants, entity?.mentionText)
  uniquePush(base.variants, entity?.normalizedName)
  uniquePush(base.variants, entity?.normalizedDate)
  uniquePush(base.variants, entity?.amountText)

  if (type === 'people') {
    return {
      ...base,
      canonicalName: displayName(type, entity),
      roles: [],
      affiliatedOrganizations: [],
    }
  }

  if (type === 'organizations') {
    return {
      ...base,
      canonicalName: displayName(type, entity),
      roles: [],
      organizationTypes: [],
      jurisdictions: [],
    }
  }

  if (type === 'dates') {
    return {
      ...base,
      canonicalDate: cleanString(entity?.normalizedDate),
      dateTypes: [],
      approximate: Boolean(entity?.isApproximate),
    }
  }

  if (type === 'monetaryAmounts') {
    return {
      ...base,
      amount: {
        value:
          typeof entity?.normalizedAmount?.value === 'number' &&
          Number.isFinite(entity.normalizedAmount.value)
            ? entity.normalizedAmount.value
            : null,
        currency: cleanString(entity?.normalizedAmount?.currency).toUpperCase() || null,
        unit: cleanString(entity?.normalizedAmount?.unit) || null,
      },
      amountTypes: [],
    }
  }

  return base
}

function mergeEntity(target, type, entity, doc, extraction) {
  uniquePush(target.variants, entity?.mentionText)
  uniquePush(target.variants, entity?.normalizedName)
  uniquePush(target.variants, entity?.normalizedDate)
  uniquePush(target.variants, entity?.amountText)

  uniquePush(target.documentIds, doc.id)

  if (type === 'people') {
    uniquePush(target.roles, entity?.role)
    uniquePush(target.affiliatedOrganizations, entity?.affiliatedOrganization)
  } else if (type === 'organizations') {
    uniquePush(target.roles, entity?.role)
    uniquePush(target.organizationTypes, entity?.organizationType)
    uniquePush(target.jurisdictions, entity?.jurisdiction)
  } else if (type === 'dates') {
    uniquePush(target.dateTypes, entity?.dateType)
    target.approximate = target.approximate || Boolean(entity?.isApproximate)
    if (!target.canonicalDate && cleanString(entity?.normalizedDate)) {
      target.canonicalDate = cleanString(entity.normalizedDate)
      target.canonical = target.canonicalDate
    }
  } else if (type === 'monetaryAmounts') {
    uniquePush(target.amountTypes, entity?.amountType)
    if (target.amount.value == null && typeof entity?.normalizedAmount?.value === 'number') {
      target.amount.value = entity.normalizedAmount.value
    }
    if (!target.amount.currency && cleanString(entity?.normalizedAmount?.currency)) {
      target.amount.currency = cleanString(entity.normalizedAmount.currency).toUpperCase()
    }
    if (!target.amount.unit && cleanString(entity?.normalizedAmount?.unit)) {
      target.amount.unit = cleanString(entity.normalizedAmount.unit)
    }
  }

  const provenance = makeProvenance(type, entity, doc, extraction)
  uniquePushObject(
    target.provenance,
    provenance,
    (p) =>
      [
        p.documentId,
        p.mentionText,
        p.roleOrType,
        p.quote,
        p.location?.page,
        p.location?.section,
        p.location?.clause,
        p.location?.charStart,
        p.location?.charEnd,
      ].join('|')
  )
  target.provenanceCount = target.provenance.length
}

const maps = {
  people: new Map(),
  organizations: new Map(),
  dates: new Map(),
  monetaryAmounts: new Map(),
}

const counters = {
  people: 0,
  organizations: 0,
  dates: 0,
  monetaryAmounts: 0,
}

const documentIndex = []
const extractionFailures = []

for (const result of extractionResults) {
  if (!result || result.status !== 'ok' || !result.extraction) {
    const doc = result?.document
    extractionFailures.push({
      documentId: doc?.id || null,
      documentTitle: doc?.title || null,
      sourcePath: doc?.sourcePath || null,
      error: result?.error || 'Unknown extraction failure.',
    })

    if (doc) {
      documentIndex.push({
        documentId: doc.id,
        documentTitle: doc.title,
        documentIndex: doc.index,
        sourcePath: doc.sourcePath,
        extractionStatus: 'failed',
        warnings: [result?.error || 'Unknown extraction failure.'],
        entityIds: {
          people: [],
          organizations: [],
          dates: [],
          monetaryAmounts: [],
        },
      })
    }
    continue
  }

  const doc = result.document
  const extraction = result.extraction
  const docRecord = {
    documentId: doc.id,
    documentTitle: doc.title,
    documentIndex: doc.index,
    sourcePath: doc.sourcePath,
    extractionStatus: 'ok',
    warnings: Array.isArray(extraction.warnings) ? extraction.warnings.map(cleanString).filter(Boolean) : [],
    entityIds: {
      people: [],
      organizations: [],
      dates: [],
      monetaryAmounts: [],
    },
  }

  for (const type of ['people', 'organizations', 'dates', 'monetaryAmounts']) {
    const entities = Array.isArray(extraction[type]) ? extraction[type] : []

    for (const entity of entities) {
      if (!entity || !cleanString(entity.mentionText)) continue

      const key = typedKey(type, entity)
      let aggregate = maps[type].get(key)

      if (!aggregate) {
        counters[type] += 1
        const id = `${idPrefix(type)}-${String(counters[type]).padStart(5, '0')}`
        aggregate = makeEntity(type, entity, id)
        maps[type].set(key, aggregate)
      }

      mergeEntity(aggregate, type, entity, doc, extraction)
      uniquePush(docRecord.entityIds[type], aggregate.id)
    }
  }

  documentIndex.push(docRecord)
}

function mapValues(map) {
  return Array.from(map.values()).map((entity) => ({
    ...entity,
    variants: entity.variants.filter(Boolean),
    documentIds: entity.documentIds.filter(Boolean),
  }))
}

const people = mapValues(maps.people)
const organizations = mapValues(maps.organizations)
const dates = mapValues(maps.dates)
const monetaryAmounts = mapValues(maps.monetaryAmounts)

const totalMentions =
  people.reduce((sum, e) => sum + e.provenanceCount, 0) +
  organizations.reduce((sum, e) => sum + e.provenanceCount, 0) +
  dates.reduce((sum, e) => sum + e.provenanceCount, 0) +
  monetaryAmounts.reduce((sum, e) => sum + e.provenanceCount, 0)

const preliminaryDataset = {
  schemaVersion: '1.0',
  corpus: {
    requestedDocumentCount: inputDocuments.length,
    processedDocumentCount: documentIndex.length,
    successfulDocumentCount: documentIndex.filter((d) => d.extractionStatus === 'ok').length,
    failedDocumentCount: extractionFailures.length,
  },
  summary: {
    deduplicatedEntityCounts: {
      people: people.length,
      organizations: organizations.length,
      dates: dates.length,
      monetaryAmounts: monetaryAmounts.length,
      total:
        people.length + organizations.length + dates.length + monetaryAmounts.length,
    },
    provenanceMentionCount: totalMentions,
  },
  entities: {
    people,
    organizations,
    dates,
    monetaryAmounts,
  },
  documents: documentIndex.sort((a, b) => a.documentIndex - b.documentIndex),
  extractionFailures,
}

log(
  `Aggregation complete: ${preliminaryDataset.summary.deduplicatedEntityCounts.total} deduplicated entities from ${totalMentions} provenance mention(s).`
)

phase('Quality review')

const qualitySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overallStatus: {
      type: 'string',
      enum: ['pass', 'pass_with_warnings', 'needs_review'],
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          severity: { type: 'string', enum: ['info', 'warning', 'error'] },
          area: { type: 'string' },
          message: { type: 'string' },
          affectedIds: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['severity', 'area', 'message', 'affectedIds'],
      },
    },
    recommendedNextSteps: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['overallStatus', 'issues', 'recommendedNextSteps'],
}

function sampleEntities(array, limit) {
  return array.slice(0, limit).map((e) => ({
    id: e.id,
    canonical: e.canonical,
    variants: e.variants.slice(0, 8),
    documentIds: e.documentIds.slice(0, 12),
    provenanceCount: e.provenanceCount,
  }))
}

const qualityPayload = {
  corpus: preliminaryDataset.corpus,
  summary: preliminaryDataset.summary,
  failureSample: extractionFailures.slice(0, 20),
  warningSample: preliminaryDataset.documents
    .filter((d) => d.warnings.length > 0)
    .slice(0, 20)
    .map((d) => ({
      documentId: d.documentId,
      warnings: d.warnings,
    })),
  entitySamples: {
    people: sampleEntities(people, 25),
    organizations: sampleEntities(organizations, 25),
    dates: sampleEntities(dates, 25),
    monetaryAmounts: sampleEntities(monetaryAmounts, 25),
  },
}

const qualityReview = await agent(
  `
Review this contract entity extraction sweep output for structural quality.

Look for:
- suspiciously low or high counts,
- likely deduplication mistakes visible from samples,
- extraction failures,
- missing provenance patterns,
- normalization concerns.

Do not re-extract documents. Return concise quality findings only.

<dataset_summary>
${JSON.stringify(qualityPayload, null, 2)}
</dataset_summary>
`.trim(),
  {
    label: 'quality-review',
    phase: 'Quality review',
    schema: qualitySchema,
    effort: 'medium',
  }
)

const finalDataset = {
  ...preliminaryDataset,
  qualityReview:
    qualityReview ||
    {
      overallStatus: extractionFailures.length > 0 ? 'pass_with_warnings' : 'pass',
      issues:
        extractionFailures.length > 0
          ? [
              {
                severity: 'warning',
                area: 'extraction',
                message:
                  'One or more extraction agents failed or returned null; see extractionFailures.',
                affectedIds: extractionFailures.map((f) => f.documentId).filter(Boolean),
              },
            ]
          : [],
      recommendedNextSteps: [],
    },
}

log(
  `Document extraction sweep finished: ${finalDataset.corpus.successfulDocumentCount}/${finalDataset.corpus.requestedDocumentCount} documents processed successfully.`
)

finalDataset
```

> **Claude judge:** The script uses a single unbounded pipeline() over all documents with no wave-batching, no stall watchdog, no per-wave result commits, and no retry or backoff logic; it does handle null extractions gracefully and has deterministic prompts and capped schemas, but the core fan-out safety properties are largely absent.

## With skill — rubric 93%, patterns 94%

```js
export const meta = {
  name: 'document-extraction-sweep',
  description:
    'Extract people, organizations, dates, and monetary amounts from contract documents, then aggregate a deduplicated dataset with per-document provenance.',
  phases: [
    { title: 'Preflight' },
    { title: 'Extract' },
    { title: 'Retry extraction' },
    { title: 'Aggregate shards' },
    { title: 'Finalize dataset' },
  ],
}

/*
IMPORTANT OPERATOR STEP AFTER LAUNCH:
ScheduleWakeup({
  delaySeconds: 1200,
  reason: "watchdog: document extraction sweep wf_<runId> may stall silently; check journal mtime",
  prompt: "Watchdog for document extraction sweep run wf_<runId> (task <taskId>, journal at <path>): if the journal mtime is older than 20 min AND the workflow task is not completed, TaskStop the task then resume with Workflow({scriptPath, resumeFromRunId}). Otherwise re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
})
*/

const WAVE_SIZE = Number.isInteger(args?.waveSize) && args.waveSize >= 1 && args.waveSize <= 8 ? args.waveSize : 6
const DOCS_PER_AGGREGATION_SHARD =
  Number.isInteger(args?.docsPerAggregationShard) && args.docsPerAggregationShard >= 5 && args.docsPerAggregationShard <= 40
    ? args.docsPerAggregationShard
    : 20

const rawDocuments = Array.isArray(args?.documents) ? args.documents : Array.isArray(args?.docs) ? args.docs : []

if (!rawDocuments.length) {
  throw new Error(
    'document-extraction-sweep requires args.documents: an array of 200 document descriptors, e.g. {key, path, title} or {key, content}.'
  )
}

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function asString(v) {
  return v === null || v === undefined ? '' : String(v)
}

function stableFallbackKey(index) {
  const n = String(index + 1).padStart(4, '0')
  return `doc-${n}`
}

function normalizeDocument(input, index) {
  if (typeof input === 'string') {
    return {
      key: input,
      path: input,
      title: '',
      content: '',
      metadata: {},
      ordinal: index + 1,
    }
  }

  const obj = input && typeof input === 'object' ? input : {}
  const key = asString(obj.key || obj.id || obj.documentKey || obj.path || obj.file || stableFallbackKey(index)).trim()

  return {
    key: key || stableFallbackKey(index),
    path: asString(obj.path || obj.file || obj.filePath || '').trim(),
    title: asString(obj.title || obj.name || '').trim(),
    content: asString(obj.content || obj.text || '').trim(),
    metadata: obj.metadata && typeof obj.metadata === 'object' ? obj.metadata : {},
    ordinal: index + 1,
  }
}

const DOCUMENTS = rawDocuments.map(normalizeDocument)

phase('Preflight')
log(`Document extraction sweep starting for ${DOCUMENTS.length} document(s).`)
if (DOCUMENTS.length !== 200) {
  log(`Note: expected 200 contract documents; received ${DOCUMENTS.length}. Continuing with provided set.`)
}
log(
  'Watchdog required after launch: ScheduleWakeup({ delaySeconds: 1200, reason: "watchdog: document extraction sweep wf_<runId> may stall silently; check journal mtime", prompt: "If journal mtime is older than 20 min and workflow is not completed, TaskStop then resume via Workflow({scriptPath, resumeFromRunId}); otherwise re-arm." })'
)

const PROVENANCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['documentKey', 'locator', 'snippet', 'confidence'],
  properties: {
    documentKey: { type: 'string' },
    locator: {
      type: 'string',
      description: 'Page, paragraph, clause, heading, line range, or other best available locator.',
    },
    snippet: {
      type: 'string',
      description: 'Short source snippet, ideally <=25 words. Do not include long quotations.',
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'document',
    'people',
    'organizations',
    'dates',
    'monetaryAmounts',
    'truncated',
    'warnings',
  ],
  properties: {
    document: {
      type: 'object',
      additionalProperties: false,
      required: ['key', 'path', 'title'],
      properties: {
        key: { type: 'string' },
        path: { type: 'string' },
        title: { type: 'string' },
      },
    },
    people: {
      type: 'array',
      maxItems: 80,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'normalizedName', 'roles', 'provenance', 'confidence'],
        properties: {
          name: { type: 'string' },
          normalizedName: { type: 'string' },
          roles: { type: 'array', maxItems: 8, items: { type: 'string' } },
          provenance: { type: 'array', minItems: 1, maxItems: 5, items: PROVENANCE_SCHEMA },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    organizations: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'normalizedName', 'roles', 'provenance', 'confidence'],
        properties: {
          name: { type: 'string' },
          normalizedName: { type: 'string' },
          roles: { type: 'array', maxItems: 10, items: { type: 'string' } },
          provenance: { type: 'array', minItems: 1, maxItems: 5, items: PROVENANCE_SCHEMA },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    dates: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dateText', 'normalizedDate', 'dateType', 'provenance', 'confidence'],
        properties: {
          dateText: { type: 'string' },
          normalizedDate: {
            type: 'string',
            description:
              'ISO-8601 date if knowable, e.g. YYYY-MM-DD. Use original text if ambiguous or incomplete.',
          },
          dateType: {
            type: 'string',
            description:
              'Examples: effective_date, execution_date, renewal_date, termination_date, notice_deadline, payment_due_date, amendment_date, other.',
          },
          provenance: { type: 'array', minItems: 1, maxItems: 5, items: PROVENANCE_SCHEMA },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    monetaryAmounts: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['amountText', 'normalizedAmount', 'currency', 'amountType', 'provenance', 'confidence'],
        properties: {
          amountText: { type: 'string' },
          normalizedAmount: {
            type: 'string',
            description: 'Machine-readable numeric amount where possible, preserving ranges/formulas if needed.',
          },
          currency: {
            type: 'string',
            description: 'ISO currency code if inferable, otherwise symbol/text such as USD, EUR, $, GBP, unspecified.',
          },
          amountType: {
            type: 'string',
            description:
              'Examples: fee, payment, cap, liability_cap, penalty, interest, tax, expense, deposit, purchase_price, other.',
          },
          provenance: { type: 'array', minItems: 1, maxItems: 5, items: PROVENANCE_SCHEMA },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    truncated: {
      type: 'object',
      additionalProperties: false,
      required: ['people', 'organizations', 'dates', 'monetaryAmounts'],
      properties: {
        people: { type: 'boolean' },
        organizations: { type: 'boolean' },
        dates: { type: 'boolean' },
        monetaryAmounts: { type: 'boolean' },
      },
    },
    warnings: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string' },
    },
  },
}

const AGGREGATE_PROVENANCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['documentKey', 'sourceValue', 'roleOrType', 'locator', 'snippet', 'confidence'],
  properties: {
    documentKey: { type: 'string' },
    sourceValue: { type: 'string' },
    roleOrType: { type: 'string' },
    locator: { type: 'string' },
    snippet: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
}

const AGGREGATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['datasetVersion', 'sourceDocumentCount', 'sourceDocumentKeys', 'entities', 'gaps', 'dedupeNotes'],
  properties: {
    datasetVersion: { type: 'string' },
    sourceDocumentCount: { type: 'integer', minimum: 0 },
    sourceDocumentKeys: { type: 'array', items: { type: 'string' } },
    entities: {
      type: 'object',
      additionalProperties: false,
      required: ['people', 'organizations', 'dates', 'monetaryAmounts'],
      properties: {
        people: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'id',
              'canonicalName',
              'normalizedName',
              'aliases',
              'roles',
              'documentCount',
              'docKeys',
              'provenance',
            ],
            properties: {
              id: { type: 'string' },
              canonicalName: { type: 'string' },
              normalizedName: { type: 'string' },
              aliases: { type: 'array', items: { type: 'string' } },
              roles: { type: 'array', items: { type: 'string' } },
              documentCount: { type: 'integer', minimum: 0 },
              docKeys: { type: 'array', items: { type: 'string' } },
              provenance: { type: 'array', items: AGGREGATE_PROVENANCE_SCHEMA },
            },
          },
        },
        organizations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'id',
              'canonicalName',
              'normalizedName',
              'aliases',
              'roles',
              'documentCount',
              'docKeys',
              'provenance',
            ],
            properties: {
              id: { type: 'string' },
              canonicalName: { type: 'string' },
              normalizedName: { type: 'string' },
              aliases: { type: 'array', items: { type: 'string' } },
              roles: { type: 'array', items: { type: 'string' } },
              documentCount: { type: 'integer', minimum: 0 },
              docKeys: { type: 'array', items: { type: 'string' } },
              provenance: { type: 'array', items: AGGREGATE_PROVENANCE_SCHEMA },
            },
          },
        },
        dates: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'id',
              'canonicalValue',
              'normalizedDate',
              'dateTypes',
              'documentCount',
              'docKeys',
              'provenance',
            ],
            properties: {
              id: { type: 'string' },
              canonicalValue: { type: 'string' },
              normalizedDate: { type: 'string' },
              dateTypes: { type: 'array', items: { type: 'string' } },
              documentCount: { type: 'integer', minimum: 0 },
              docKeys: { type: 'array', items: { type: 'string' } },
              provenance: { type: 'array', items: AGGREGATE_PROVENANCE_SCHEMA },
            },
          },
        },
        monetaryAmounts: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'id',
              'canonicalValue',
              'normalizedAmount',
              'currency',
              'amountTypes',
              'documentCount',
              'docKeys',
              'provenance',
            ],
            properties: {
              id: { type: 'string' },
              canonicalValue: { type: 'string' },
              normalizedAmount: { type: 'string' },
              currency: { type: 'string' },
              amountTypes: { type: 'array', items: { type: 'string' } },
              documentCount: { type: 'integer', minimum: 0 },
              docKeys: { type: 'array', items: { type: 'string' } },
              provenance: { type: 'array', items: AGGREGATE_PROVENANCE_SCHEMA },
            },
          },
        },
      },
    },
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['documentKey', 'reason'],
        properties: {
          documentKey: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    dedupeNotes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
}

function buildExtractionPrompt(doc) {
  const metadata = JSON.stringify(doc.metadata || {})
  const contentBlock = doc.content
    ? `The full document text is provided below.\n\n<document_text>\n${doc.content}\n</document_text>`
    : `Document path/location: ${doc.path || '(no path provided)'}\nUse available repository/file tools to read this contract document. Do not use the web.`

  return `
You are extracting structured entities from one contract document for a large document extraction sweep.

Document key: ${doc.key}
Document title: ${doc.title || '(unknown)'}
Document path: ${doc.path || '(none)'}
Document metadata JSON: ${metadata}

${contentBlock}

Task:
Extract contract-relevant structured entities:
1. People: signatories, contacts, officers, representatives, named individuals.
2. Organizations: parties, affiliates, vendors, customers, law firms, agencies, banks, assignees.
3. Dates: effective dates, execution dates, deadlines, renewal/termination dates, notice dates, payment due dates.
4. Monetary amounts: fees, payments, caps, penalties, deposits, interest, taxes, reimbursements, purchase prices.

Rules:
- Return ONLY data that is grounded in the document.
- Deduplicate within this document.
- Normalize names conservatively. Do not merge distinct entities.
- For each entity, include concise provenance: page/clause/section/line locator when available, and a short snippet <=25 words.
- Keep output lean. Do not include long quotes or analysis.
- If more than the schema cap exists for a type, prioritize legally/financially significant mentions and set truncated[type] = true.
- Use documentKey exactly as: ${doc.key}
- If the document cannot be read, return empty arrays and include a warning.
`.trim()
}

function runDocumentExtraction(doc) {
  return agent(buildExtractionPrompt(doc), {
    label: `extract:${doc.key}`,
    phase: 'Extract',
    schema: EXTRACTION_SCHEMA,
    effort: 'medium',
  })
}

function lowerKey(v) {
  return asString(v).trim().toLowerCase().replace(/\s+/g, ' ')
}

function sortedStrings(values) {
  return Array.from(new Set((values || []).map(asString).map(s => s.trim()).filter(Boolean))).sort((a, b) =>
    a > b ? 1 : a < b ? -1 : 0
  )
}

function bestProvenanceByDoc(existing, candidate) {
  if (!existing) return candidate
  const ec = typeof existing.confidence === 'number' ? existing.confidence : 0
  const cc = typeof candidate.confidence === 'number' ? candidate.confidence : 0
  if (cc > ec) return candidate
  if (cc === ec && asString(candidate.snippet).length > asString(existing.snippet).length) return candidate
  return existing
}

function makeAggregateProvenance(docKey, sourceValue, roleOrType, prov, confidence) {
  return {
    documentKey: asString(prov?.documentKey || docKey),
    sourceValue: asString(sourceValue),
    roleOrType: asString(roleOrType),
    locator: asString(prov?.locator || ''),
    snippet: asString(prov?.snippet || ''),
    confidence:
      typeof prov?.confidence === 'number'
        ? prov.confidence
        : typeof confidence === 'number'
          ? confidence
          : 0.5,
  }
}

function exactMergeExtractions(extractions, gaps, note) {
  const people = new Map()
  const organizations = new Map()
  const dates = new Map()
  const money = new Map()
  const sourceKeys = []

  function addNameEntity(map, prefix, docKey, item, originalName, normalizedName, roles, provenance, confidence) {
    const norm = lowerKey(normalizedName || originalName)
    if (!norm) return
    const key = `${prefix}:${norm}`
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        canonicalName: asString(normalizedName || originalName),
        normalizedName: asString(normalizedName || originalName),
        aliases: new Set(),
        roles: new Set(),
        docKeys: new Set(),
        provenanceByDoc: new Map(),
      })
    }
    const rec = map.get(key)
    rec.aliases.add(asString(originalName || normalizedName))
    for (const r of roles || []) rec.roles.add(asString(r))
    rec.docKeys.add(docKey)

    const roleText = sortedStrings(roles || []).join('; ') || 'mentioned'
    for (const p of provenance || []) {
      const ap = makeAggregateProvenance(docKey, originalName || normalizedName, roleText, p, confidence)
      rec.provenanceByDoc.set(ap.documentKey, bestProvenanceByDoc(rec.provenanceByDoc.get(ap.documentKey), ap))
    }
  }

  function addDateEntity(docKey, item) {
    const normalizedDate = asString(item.normalizedDate || item.dateText).trim()
    const dateType = asString(item.dateType || 'other').trim()
    const key = `date:${lowerKey(normalizedDate)}:${lowerKey(dateType)}`
    if (!normalizedDate) return
    if (!dates.has(key)) {
      dates.set(key, {
        id: key,
        canonicalValue: normalizedDate,
        normalizedDate,
        dateTypes: new Set(),
        docKeys: new Set(),
        provenanceByDoc: new Map(),
      })
    }
    const rec = dates.get(key)
    rec.dateTypes.add(dateType)
    rec.docKeys.add(docKey)
    for (const p of item.provenance || []) {
      const ap = makeAggregateProvenance(docKey, item.dateText || normalizedDate, dateType, p, item.confidence)
      rec.provenanceByDoc.set(ap.documentKey, bestProvenanceByDoc(rec.provenanceByDoc.get(ap.documentKey), ap))
    }
  }

  function addMoneyEntity(docKey, item) {
    const normalizedAmount = asString(item.normalizedAmount || item.amountText).trim()
    const currency = asString(item.currency || 'unspecified').trim()
    const amountType = asString(item.amountType || 'other').trim()
    if (!normalizedAmount) return
    const key = `money:${lowerKey(currency)}:${lowerKey(normalizedAmount)}:${lowerKey(amountType)}`
    if (!money.has(key)) {
      money.set(key, {
        id: key,
        canonicalValue: `${currency} ${normalizedAmount}`.trim(),
        normalizedAmount,
        currency,
        amountTypes: new Set(),
        docKeys: new Set(),
        provenanceByDoc: new Map(),
      })
    }
    const rec = money.get(key)
    rec.amountTypes.add(amountType)
    rec.docKeys.add(docKey)
    for (const p of item.provenance || []) {
      const ap = makeAggregateProvenance(docKey, item.amountText || normalizedAmount, amountType, p, item.confidence)
      rec.provenanceByDoc.set(ap.documentKey, bestProvenanceByDoc(rec.provenanceByDoc.get(ap.documentKey), ap))
    }
  }

  for (const ex of extractions || []) {
    if (!ex || !ex.document) continue
    const docKey = asString(ex.document.key)
    if (!docKey) continue
    sourceKeys.push(docKey)

    for (const p of ex.people || []) {
      addNameEntity(people, 'person', docKey, p, p.name, p.normalizedName, p.roles, p.provenance, p.confidence)
    }
    for (const o of ex.organizations || []) {
      addNameEntity(organizations, 'org', docKey, o, o.name, o.normalizedName, o.roles, o.provenance, o.confidence)
    }
    for (const d of ex.dates || []) addDateEntity(docKey, d)
    for (const m of ex.monetaryAmounts || []) addMoneyEntity(docKey, m)
  }

  function finalizeName(map) {
    return Array.from(map.values())
      .map(r => {
        const docKeys = sortedStrings(Array.from(r.docKeys))
        return {
          id: r.id,
          canonicalName: r.canonicalName,
          normalizedName: r.normalizedName,
          aliases: sortedStrings(Array.from(r.aliases)),
          roles: sortedStrings(Array.from(r.roles)),
          documentCount: docKeys.length,
          docKeys,
          provenance: Array.from(r.provenanceByDoc.values()).sort((a, b) =>
            a.documentKey > b.documentKey ? 1 : a.documentKey < b.documentKey ? -1 : 0
          ),
        }
      })
      .sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0))
  }

  function finalizeDates(map) {
    return Array.from(map.values())
      .map(r => {
        const docKeys = sortedStrings(Array.from(r.docKeys))
        return {
          id: r.id,
          canonicalValue: r.canonicalValue,
          normalizedDate: r.normalizedDate,
          dateTypes: sortedStrings(Array.from(r.dateTypes)),
          documentCount: docKeys.length,
          docKeys,
          provenance: Array.from(r.provenanceByDoc.values()).sort((a, b) =>
            a.documentKey > b.documentKey ? 1 : a.documentKey < b.documentKey ? -1 : 0
          ),
        }
      })
      .sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0))
  }

  function finalizeMoney(map) {
    return Array.from(map.values())
      .map(r => {
        const docKeys = sortedStrings(Array.from(r.docKeys))
        return {
          id: r.id,
          canonicalValue: r.canonicalValue,
          normalizedAmount: r.normalizedAmount,
          currency: r.currency,
          amountTypes: sortedStrings(Array.from(r.amountTypes)),
          documentCount: docKeys.length,
          docKeys,
          provenance: Array.from(r.provenanceByDoc.values()).sort((a, b) =>
            a.documentKey > b.documentKey ? 1 : a.documentKey < b.documentKey ? -1 : 0
          ),
        }
      })
      .sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0))
  }

  return {
    datasetVersion: 'document-extraction-sweep.v1',
    sourceDocumentCount: sortedStrings(sourceKeys).length,
    sourceDocumentKeys: sortedStrings(sourceKeys),
    entities: {
      people: finalizeName(people),
      organizations: finalizeName(organizations),
      dates: finalizeDates(dates),
      monetaryAmounts: finalizeMoney(money),
    },
    gaps: (gaps || []).map(g => ({
      documentKey: asString(g.documentKey || g),
      reason: asString(g.reason || 'No extraction result was available.'),
    })),
    dedupeNotes: [note || 'Deterministic exact-normalized fallback merge.'],
  }
}

function buildShardAggregationPrompt(shard) {
  const payload = JSON.stringify(shard.extractions)
  return `
You are aggregating structured entity extractions from a shard of contract documents.

Shard id: ${shard.id}
Document keys in shard: ${JSON.stringify(shard.documentKeys)}

Input extraction JSON:
${payload}

Task:
Produce a deduplicated shard dataset using the required schema.

Rules:
- Deduplicate conservatively across this shard.
- Merge obvious aliases for the same person or organization, but do NOT merge legally distinct entities.
- Preserve per-document provenance: for each deduplicated entity, keep one best provenance item per source document where it appears.
- For dates, deduplicate by normalized date plus contractual meaning/date type.
- For monetary amounts, deduplicate by currency, normalized amount, and contractual meaning/amount type.
- Do not invent facts.
- Keep snippets short; do not include long quotations.
- Include gaps only for documents in this shard that have no extraction result.
`.trim()
}

function runShardAggregation(shard) {
  return agent(buildShardAggregationPrompt(shard), {
    label: `aggregate-shard:${shard.id}`,
    phase: 'Aggregate shards',
    schema: AGGREGATE_SCHEMA,
    effort: 'high',
  })
}

function mergeAggregateDatasets(datasets, gaps, note) {
  const pseudoExtractions = []
  const mergedGaps = []
  const notes = []

  for (const ds of datasets || []) {
    if (!ds || !ds.entities) continue
    if (Array.isArray(ds.gaps)) mergedGaps.push(...ds.gaps)
    if (Array.isArray(ds.dedupeNotes)) notes.push(...ds.dedupeNotes)

    for (const e of ds.entities.people || []) {
      for (const p of e.provenance || []) {
        pseudoExtractions.push({
          document: { key: p.documentKey, path: '', title: '' },
          people: [
            {
              name: p.sourceValue || e.canonicalName,
              normalizedName: e.normalizedName || e.canonicalName,
              roles: e.roles || [],
              provenance: [
                {
                  documentKey: p.documentKey,
                  locator: p.locator,
                  snippet: p.snippet,
                  confidence: p.confidence,
                },
              ],
              confidence: p.confidence,
            },
          ],
          organizations: [],
          dates: [],
          monetaryAmounts: [],
          truncated: { people: false, organizations: false, dates: false, monetaryAmounts: false },
          warnings: [],
        })
      }
    }

    for (const e of ds.entities.organizations || []) {
      for (const p of e.provenance || []) {
        pseudoExtractions.push({
          document: { key: p.documentKey, path: '', title: '' },
          people: [],
          organizations: [
            {
              name: p.sourceValue || e.canonicalName,
              normalizedName: e.normalizedName || e.canonicalName,
              roles: e.roles || [],
              provenance: [
                {
                  documentKey: p.documentKey,
                  locator: p.locator,
                  snippet: p.snippet,
                  confidence: p.confidence,
                },
              ],
              confidence: p.confidence,
            },
          ],
          dates: [],
          monetaryAmounts: [],
          truncated: { people: false, organizations: false, dates: false, monetaryAmounts: false },
          warnings: [],
        })
      }
    }

    for (const e of ds.entities.dates || []) {
      for (const p of e.provenance || []) {
        pseudoExtractions.push({
          document: { key: p.documentKey, path: '', title: '' },
          people: [],
          organizations: [],
          dates: [
            {
              dateText: p.sourceValue || e.canonicalValue,
              normalizedDate: e.normalizedDate || e.canonicalValue,
              dateType: p.roleOrType || (e.dateTypes || ['other'])[0] || 'other',
              provenance: [
                {
                  documentKey: p.documentKey,
                  locator: p.locator,
                  snippet: p.snippet,
                  confidence: p.confidence,
                },
              ],
              confidence: p.confidence,
            },
          ],
          monetaryAmounts: [],
          truncated: { people: false, organizations: false, dates: false, monetaryAmounts: false },
          warnings: [],
        })
      }
    }

    for (const e of ds.entities.monetaryAmounts || []) {
      for (const p of e.provenance || []) {
        pseudoExtractions.push({
          document: { key: p.documentKey, path: '', title: '' },
          people: [],
          organizations: [],
          dates: [],
          monetaryAmounts: [
            {
              amountText: p.sourceValue || e.canonicalValue,
              normalizedAmount: e.normalizedAmount || e.canonicalValue,
              currency: e.currency || 'unspecified',
              amountType: p.roleOrType || (e.amountTypes || ['other'])[0] || 'other',
              provenance: [
                {
                  documentKey: p.documentKey,
                  locator: p.locator,
                  snippet: p.snippet,
                  confidence: p.confidence,
                },
              ],
              confidence: p.confidence,
            },
          ],
          truncated: { people: false, organizations: false, dates: false, monetaryAmounts: false },
          warnings: [],
        })
      }
    }
  }

  const merged = exactMergeExtractions(
    pseudoExtractions,
    [...(gaps || []), ...mergedGaps],
    note || 'Merged aggregate shards deterministically after model aggregation.'
  )
  merged.dedupeNotes = sortedStrings([...(merged.dedupeNotes || []), ...notes])
  return merged
}

function buildFinalAggregationPrompt(shardAggregates, missingDocuments) {
  const payload = JSON.stringify(
    [...shardAggregates].sort((a, b) => {
      const ak = (a.sourceDocumentKeys || []).join('|')
      const bk = (b.sourceDocumentKeys || []).join('|')
      return ak > bk ? 1 : ak < bk ? -1 : 0
    })
  )

  return `
You are producing the final deduplicated entity dataset for a contract document extraction sweep.

Missing or incomplete document keys:
${JSON.stringify(missingDocuments)}

Shard aggregate JSON:
${payload}

Task:
Merge all shard aggregates into ONE final deduplicated dataset using the required schema.

Critical requirements:
- Preserve per-document provenance. Each deduplicated entity must retain one best provenance record for every source document in which it appears.
- Deduplicate conservatively. Merge obvious aliases for the same person/organization, but do not collapse distinct legal entities.
- For organizations, treat subsidiaries, branches, parents, and similarly named entities as distinct unless the provenance clearly identifies them as the same entity.
- For dates, deduplicate by normalized date and contractual meaning.
- For monetary amounts, deduplicate by currency, normalized amount, and contractual meaning.
- Include every missing document as a gap.
- Do not invent facts or provenance.
- Keep snippets short.
- Return only the structured dataset.
`.trim()
}

function runFinalAggregation(shardAggregates, missingDocuments) {
  return agent(buildFinalAggregationPrompt(shardAggregates, missingDocuments), {
    label: 'final-deduplicated-dataset',
    phase: 'Finalize dataset',
    schema: AGGREGATE_SCHEMA,
    effort: 'high',
  })
}

const extractionResultsByKey = new Map()
let failedDocuments = []
let backedOff = false

const extractionWaves = chunk(DOCUMENTS, WAVE_SIZE)

for (let w = 0; w < extractionWaves.length; w++) {
  phase(`Extract wave ${w + 1}/${extractionWaves.length}`)
  const docs = extractionWaves[w]
  const batch = await parallel(docs.map(doc => () => runDocumentExtraction(doc)))

  let nulls = 0
  batch.forEach((result, i) => {
    const doc = docs[i]
    if (result && result.document && result.document.key) {
      extractionResultsByKey.set(result.document.key, result)
    } else {
      nulls += 1
      failedDocuments.push(doc)
    }
  })

  log(
    `Extract wave ${w + 1}/${extractionWaves.length}: ${docs.length - nulls}/${docs.length} succeeded; ${extractionResultsByKey.size}/${DOCUMENTS.length} documents extracted.`
  )

  if (nulls / docs.length > 0.4) {
    const remaining = extractionWaves.slice(w + 1).flat()
    failedDocuments.push(...remaining)
    backedOff = true
    log(
      `instability: ${nulls}/${docs.length} failed this wave — backing off; returning partial results so the run can be resumed later.`
    )
    break
  }
}

if (failedDocuments.length && !backedOff) {
  phase('Retry extraction')
  const retryWaves = chunk(failedDocuments, WAVE_SIZE)
  const stillFailed = []

  for (let w = 0; w < retryWaves.length; w++) {
    const docs = retryWaves[w]
    const batch = await parallel(docs.map(doc => () => runDocumentExtraction(doc)))

    let nulls = 0
    batch.forEach((result, i) => {
      const doc = docs[i]
      if (result && result.document && result.document.key) {
        extractionResultsByKey.set(result.document.key, result)
      } else {
        nulls += 1
        stillFailed.push(doc)
      }
    })

    log(
      `Retry extraction wave ${w + 1}/${retryWaves.length}: ${docs.length - nulls}/${docs.length} recovered; ${extractionResultsByKey.size}/${DOCUMENTS.length} documents extracted.`
    )

    if (nulls / docs.length > 0.4) {
      const remaining = retryWaves.slice(w + 1).flat()
      stillFailed.push(...remaining)
      backedOff = true
      log(
        `instability: ${nulls}/${docs.length} failed in retry wave — backing off; returning partial results so the run can be resumed later.`
      )
      break
    }
  }

  failedDocuments = stillFailed
}

const extractionResults = Array.from(extractionResultsByKey.values()).sort((a, b) =>
  a.document.key > b.document.key ? 1 : a.document.key < b.document.key ? -1 : 0
)

const extractedKeys = new Set(extractionResults.map(r => r.document.key))
const missingDocuments = DOCUMENTS.filter(doc => !extractedKeys.has(doc.key)).map(doc => ({
  documentKey: doc.key,
  reason: backedOff
    ? 'Not extracted because the workflow backed off during an instability spike or the document agent failed.'
    : 'Document extraction failed after retry.',
}))

if (missingDocuments.length) {
  log(`partial coverage: missing ${missingDocuments.length}/${DOCUMENTS.length} document(s).`)
}

let shardAggregates = []

if (extractionResults.length) {
  phase('Aggregate shards')
  const extractionShards = chunk(extractionResults, DOCS_PER_AGGREGATION_SHARD).map((items, index) => ({
    id: `shard-${String(index + 1).padStart(3, '0')}`,
    documentKeys: items.map(r => r.document.key),
    extractions: items,
  }))

  const shardWaves = chunk(extractionShards, WAVE_SIZE)
  let failedShards = []
  let aggregationBackedOff = false

  for (let w = 0; w < shardWaves.length; w++) {
    phase(`Aggregate shard wave ${w + 1}/${shardWaves.length}`)
    const shards = shardWaves[w]
    const batch = await parallel(shards.map(shard => () => runShardAggregation(shard)))

    let nulls = 0
    batch.forEach((result, i) => {
      const shard = shards[i]
      if (result) {
        shardAggregates.push(result)
      } else {
        nulls += 1
        failedShards.push(shard)
      }
    })

    log(
      `Aggregate shard wave ${w + 1}/${shardWaves.length}: ${shards.length - nulls}/${shards.length} succeeded.`
    )

    if (nulls / shards.length > 0.4) {
      const remaining = shardWaves.slice(w + 1).flat()
      failedShards.push(...remaining)
      aggregationBackedOff = true
      log(
        `instability: ${nulls}/${shards.length} aggregation shards failed this wave — backing off and using deterministic fallback for missing shards.`
      )
      break
    }
  }

  if (failedShards.length && !aggregationBackedOff) {
    phase('Retry shard aggregation')
    const retryShardWaves = chunk(failedShards, WAVE_SIZE)
    const stillFailedShards = []

    for (let w = 0; w < retryShardWaves.length; w++) {
      const shards = retryShardWaves[w]
      const batch = await parallel(shards.map(shard => () => runShardAggregation(shard)))

      let nulls = 0
      batch.forEach((result, i) => {
        const shard = shards[i]
        if (result) {
          shardAggregates.push(result)
        } else {
          nulls += 1
          stillFailedShards.push(shard)
        }
      })

      log(
        `Retry shard aggregation wave ${w + 1}/${retryShardWaves.length}: ${shards.length - nulls}/${shards.length} recovered.`
      )

      if (nulls / shards.length > 0.4) {
        const remaining = retryShardWaves.slice(w + 1).flat()
        stillFailedShards.push(...remaining)
        aggregationBackedOff = true
        log(
          `instability: ${nulls}/${shards.length} failed in shard retry wave — backing off and using deterministic fallback for missing shards.`
        )
        break
      }
    }

    failedShards = stillFailedShards
  }

  for (const shard of failedShards) {
    shardAggregates.push(
      exactMergeExtractions(
        shard.extractions,
        [],
        `Deterministic fallback aggregation for ${shard.id} because the shard aggregation agent did not return.`
      )
    )
  }
}

phase('Finalize dataset')

let finalDataset = null
if (shardAggregates.length) {
  finalDataset = await runFinalAggregation(shardAggregates, missingDocuments)

  if (!finalDataset && !backedOff) {
    log('Final aggregation agent returned null; retrying once after natural backoff.')
    finalDataset = await runFinalAggregation(shardAggregates, missingDocuments)
  }

  if (!finalDataset) {
    log('Final aggregation agent unavailable; using deterministic aggregate merge fallback.')
    finalDataset = mergeAggregateDatasets(
      shardAggregates,
      missingDocuments,
      'Final deterministic fallback merge because final aggregation agent did not return.'
    )
  }
} else {
  finalDataset = exactMergeExtractions(
    extractionResults,
    missingDocuments,
    'No shard aggregates were available; deterministic exact-normalized merge over document extractions.'
  )
}

const entityCounts = {
  people: finalDataset.entities.people.length,
  organizations: finalDataset.entities.organizations.length,
  dates: finalDataset.entities.dates.length,
  monetaryAmounts: finalDataset.entities.monetaryAmounts.length,
}

log(
  `Completed dataset assembly: ${finalDataset.sourceDocumentCount}/${DOCUMENTS.length} document(s) represented; entity counts ${JSON.stringify(entityCounts)}.`
)

return {
  coverage: {
    plannedDocumentCount: DOCUMENTS.length,
    extractedDocumentCount: extractionResults.length,
    missingDocumentCount: missingDocuments.length,
    missingDocuments,
    backedOffDueToInstability: backedOff,
  },
  entityCounts,
  dataset: finalDataset,
  operatorNotes: [
    'If this workflow stalls silently, use the watchdog comment at the top of this script: TaskStop the stuck task and resume with Workflow({scriptPath, resumeFromRunId}).',
    'For full untruncated intermediate agent outputs, parse the workflow journal.jsonl rather than relying on the UI output.',
  ],
}
```

> **Claude judge:** This script demonstrates nearly all required safety properties: (1) bounded waves of WAVE_SIZE (default 6, max 8) for both extraction and shard aggregation; (2) per-agent null-tolerance with retry waves for both extraction and shard aggregation failures; (3) results committed to extractionResultsByKey and shardAggregates per wave with no single hard barrier; (4) ScheduleWakeup watchdog present as a prominent comment with full prompt text; (5) no Date.now/Math.random usage, deterministic keys throughout; (6) lean capped schemas with maxItems on all arrays; (7) synthesis explicitly tracks missingDocuments and gaps, uses deterministic fallback if final agent fails; (8) backoff triggers when >40% of a wave fails, abandoning remaining waves and returning partial results. The only minor gap is the watchdog is a comment rather than an actual armed call, but the rubric explicitly allows this.

