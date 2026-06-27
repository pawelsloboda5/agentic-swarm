# document-extraction-sweep — `gpt-4.1`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a DOCUMENT EXTRACTION SWEEP: extract structured entities (people, organizations, dates, monetary amounts) from 200 contract documents and aggregate them into a single deduplicated dataset, with per-document provenance.

---

## Baseline (no skill) — rubric 15%, patterns 31%

````js
```js
export const meta = {
  name: 'document-extraction-sweep',
  description: 'Extracts structured entities (people, organizations, dates, monetary amounts) from 200 contract documents and aggregates them into a deduplicated dataset with per-document provenance.',
  phases: [
    { title: 'Extract Entities' },
    { title: 'Aggregate & Deduplicate' },
    { title: 'Output Dataset' }
  ]
}

// --- Script body starts here ---

// Helper: JSON Schema for extracted entities per document
const extractionSchema = {
  type: "object",
  properties: {
    people: {
      type: "array",
      items: { type: "string" },
      description: "List of unique full names of people mentioned in the document."
    },
    organizations: {
      type: "array",
      items: { type: "string" },
      description: "List of unique organization names mentioned in the document."
    },
    dates: {
      type: "array",
      items: { type: "string" },
      description: "List of unique dates (ISO 8601 format if possible) mentioned in the document."
    },
    monetaryAmounts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          amount: { type: "string", description: "The monetary amount as written (e.g. '$1,000,000')" },
          currency: { type: "string", description: "Currency code or symbol if available (e.g. 'USD', '$')" },
          context: { type: "string", description: "Short phrase or sentence giving context for the amount." }
        },
        required: ["amount"],
        additionalProperties: false
      },
      description: "List of unique monetary amounts mentioned in the document."
    }
  },
  required: ["people", "organizations", "dates", "monetaryAmounts"],
  additionalProperties: false
};

// Helper: Normalize entity strings for deduplication
function normalize(str) {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Helper: Normalize monetary amount for deduplication
function normalizeAmount(obj) {
  // Normalize amount and currency, ignore context for deduplication
  return `${obj.amount.replace(/[, ]/g, '').toLowerCase()}|${(obj.currency || '').toLowerCase()}`;
}

// --- Phase 1: Extract Entities from Each Document ---

phase('Extract Entities');

if (!Array.isArray(args.documents) || args.documents.length !== 200) {
  throw new Error('args.documents must be an array of 200 contract document objects.');
}

// Each document: { id: string, content: string }
const extractionResults = await parallel(
  args.documents.map((doc, idx) => async () => {
    log(`Extracting entities from document ${idx + 1}/${args.documents.length} (ID: ${doc.id})`);
    const prompt = `
You are an expert contract analyst. Extract the following structured entities from the contract document below:

- people: List of unique full names of people mentioned (signatories, parties, witnesses, etc.).
- organizations: List of unique organization names (companies, agencies, etc.).
- dates: List of unique dates mentioned (in ISO 8601 format if possible).
- monetaryAmounts: List of unique monetary amounts, with amount as written, currency (if available), and a short context phrase.

Return a JSON object matching this schema:
${JSON.stringify(extractionSchema, null, 2)}

Document ID: ${doc.id}
---
${doc.content}
---
Return only the JSON object.
    `;
    const result = await agent(prompt, {
      label: `Extract entities from document ${doc.id}`,
      phase: 'Extract Entities',
      schema: extractionSchema,
      effort: 'medium'
    });
    if (!result) return null;
    return {
      docId: doc.id,
      entities: result
    };
  })
);

// Filter out failed/errored/skipped documents
const validExtractions = extractionResults.filter(Boolean);

// --- Phase 2: Aggregate & Deduplicate Entities ---

phase('Aggregate & Deduplicate');
log('Aggregating and deduplicating extracted entities...');

// Maps for deduplication and provenance
const peopleMap = new Map();
const orgMap = new Map();
const dateMap = new Map();
const amountMap = new Map();

// For provenance: entityKey -> Set of docIds
const provenance = {
  people: new Map(),
  organizations: new Map(),
  dates: new Map(),
  monetaryAmounts: new Map()
};

// Helper to add entity with provenance
function addEntity(map, provMap, key, value, docId) {
  if (!map.has(key)) {
    map.set(key, value);
    provMap.set(key, new Set());
  }
  provMap.get(key).add(docId);
}

// Aggregate entities from all documents
for (const { doc
````

> **GPT-5.5 judge:** The script uses a single giant parallel() fan-out over all 200 documents, with no bounded waves, no ScheduleWakeup/stall watchdog, no per-agent timeout or retry wrapper, no per-wave commits/checkpoints, no resume/cache-stable prompts, and no high-failure-rate backoff. A hung agent call could block the entire run indefinitely, and completed work is held behind a single hard barrier. It has a structured/lean-ish extraction schema and a small amount of null filtering after parallel completion, but agent errors/hangs are not handled and partial results are not robustly persisted or flagged. The output is also truncated/incomplete, further weakening safety.

## With skill — rubric 15%, patterns 13%

````js
```js
export const meta = {
  name: 'contract-entity-extraction-sweep',
  description: 'Extracts structured entities (people, organizations, dates, monetary amounts) from 200 contract documents and aggregates them into a deduplicated dataset with per-document provenance.',
  phases: [
    { title: 'Extract Entities' },
    { title: 'Aggregate & Deduplicate' }
  ]
}

// === CONFIGURATION ===

// 1. List of contract documents to process.
// Each item: { docId: string, title: string, content: string }
// In production, pass this as `args.documents` (array of 200 docs).
const DOCUMENTS = Array.isArray(args?.documents) ? args.documents : []

if (DOCUMENTS.length === 0) {
  throw new Error('No documents provided in args.documents')
}

// 2. Extraction schema: entities with provenance.
const ENTITY_SCHEMA = {
  type: 'object',
  properties: {
    docId: { type: 'string', description: 'Unique document ID (from input)' },
    title: { type: 'string', description: 'Document title' },
    people: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name of the person' },
          role: { type: 'string', description: 'Role or context in the contract (if available)' }
        },
        required: ['name']
      },
      maxItems: 12
    },
    organizations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Organization name' },
          role: { type: 'string', description: 'Role or context in the contract (if available)' }
        },
        required: ['name']
      },
      maxItems: 12
    },
    dates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in ISO format if possible, else as found' },
          context: { type: 'string', description: 'Context or label for the date (e.g. "Effective Date")' }
        },
        required: ['date']
      },
      maxItems: 12
    },
    monetaryAmounts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          amount: { type: 'string', description: 'Amount as written (e.g. "$1,000,000")' },
          currency: { type: 'string', description: 'Currency code or symbol if available' },
          context: { type: 'string', description: 'Context or label for the amount (e.g. "Total Payment")' }
        },
        required: ['amount']
      },
      maxItems: 12
    }
  },
  required: ['docId', 'title', 'people', 'organizations', 'dates', 'monetaryAmounts']
}

// 3. Aggregation schema: deduplicated entities with provenance.
const AGGREGATED_SCHEMA = {
  type: 'object',
  properties: {
    people: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          roles: { type: 'array', items: { type: 'string' }, maxItems: 8 },
          docIds: { type: 'array', items: { type: 'string' }, maxItems: 20 }
        },
        required: ['name', 'docIds']
      }
    },
    organizations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          roles: { type: 'array', items: { type: 'string' }, maxItems: 8 },
          docIds: { type: 'array', items: { type: 'string' }, maxItems: 20 }
        },
        required: ['name', 'docIds']
      }
    },
    dates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          contexts: { type: 'array', items: { type: 'string' }, maxItems: 8 },
          docIds: { type: 'array', items: { type: 'string' }, maxItems: 20 }
        },
        required: ['date', 'docIds']
      }
    },
    monetaryAmounts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          amount: { type: 'string' },
          currency: { type: 'string' },
          contexts: { type:
````

> **GPT-5.5 judge:** The provided workflow is incomplete/truncated and mainly defines extraction/aggregation schemas. It gets limited credit for lean/capped schemas, provenance fields, and basic input validation. However, there is no visible bounded wave fan-out, no per-agent retry or null-tolerant handling, no per-wave result commits, no ScheduleWakeup stall watchdog, no resume/cache-stable prompts, no partial-input synthesis with explicit gap reporting, and no high-failure-rate backoff. As shown, it does not demonstrate safety against hung connections or silent loss/truncation of completed work.

