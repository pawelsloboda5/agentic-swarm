# document-extraction-sweep — `gpt-4.1`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a DOCUMENT EXTRACTION SWEEP: extract structured entities (people, organizations, dates, monetary amounts) from 200 contract documents and aggregate them into a single deduplicated dataset, with per-document provenance.

---

## Baseline (no skill) — rubric 20%, patterns 31%

```js
export const meta = {
  name: 'document-extraction-sweep',
  description: 'Extracts structured entities (people, organizations, dates, monetary amounts) from 200 contract documents and aggregates them into a deduplicated dataset with per-document provenance.',
  phases: [
    { title: 'Extract Entities' },
    { title: 'Aggregate & Deduplicate' },
    { title: 'Synthesize Final Dataset' }
  ]
}

// --- Script body starts here ---

// args: { documents: Array<{ id: string, content: string, [meta: string]: any }> }
// Each document must have a unique 'id' and 'content' (the contract text).

if (!args || !Array.isArray(args.documents) || args.documents.length === 0) {
  throw new Error('Input must be { documents: Array<{ id, content, ... }> } with at least one document.');
}

const documents = args.documents.slice(0, 200); // Limit to 200 docs

phase('Extract Entities');
log(`Extracting entities from ${documents.length} documents...`);

const entitySchema = {
  type: 'object',
  properties: {
    people: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string', nullable: true }
        },
        required: ['name']
      }
    },
    organizations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      }
    },
    dates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: 'string', description: 'ISO 8601 date or date range' },
          context: { type: 'string', nullable: true }
        },
        required: ['value']
      }
    },
    monetaryAmounts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          amount: { type: 'string', description: 'e.g. "$1,000,000" or "USD 1M"' },
          context: { type: 'string', nullable: true }
        },
        required: ['amount']
      }
    }
  },
  required: ['people', 'organizations', 'dates', 'monetaryAmounts']
};

// Extract entities in parallel, one agent per document
const extractionResults = await parallel(
  documents.map(doc => async () => {
    const result = await agent(
      `Extract all unique people (with roles if available), organizations, dates (as ISO 8601 or clear text), and monetary amounts (with context if possible) from the following contract document. Return as JSON matching the provided schema. Only extract entities explicitly mentioned in the text. Do not hallucinate or infer.

Document ID: ${doc.id}
---
${doc.content}
`,
      {
        label: `Extract entities from doc ${doc.id}`,
        phase: 'Extract Entities',
        schema: entitySchema,
        effort: 'medium'
      }
    );
    if (!result) return null;
    return {
      docId: doc.id,
      entities: result
    };
  })
);

// Filter out failed/errored docs
const perDocEntities = extractionResults.filter(Boolean);

phase('Aggregate & Deduplicate');
log('Aggregating and deduplicating entities across all documents...');

// Helper: Normalize entity for deduplication
function normalizePerson(person) {
  return person.name.trim().toLowerCase();
}
function normalizeOrg(org) {
  return org.name.trim().toLowerCase();
}
function normalizeDate(date) {
  return date.value.trim();
}
function normalizeAmount(amount) {
  return amount.amount.replace(/[\s,]/g, '').toUpperCase();
}

// Aggregate with provenance
const peopleMap = new Map();
const orgMap = new Map();
const dateMap = new Map();
const amountMap = new Map();

for (const { docId, entities } of perDocEntities) {
  // People
  for (const person of entities.people) {
    const key = normalizePerson(person);
    if (!peopleMap.has(key)) {
      peopleMap.set(key, { ...person, provenance: [docId] });
    } else {
      // Merge provenance, prefer first non-null role
      const entry = peopleMap.get(key);
      if (!entry.role && person.role) entry.role = person.role;
      if (!entry.provenance.includes(docId)) entry.provenance.push(docId);
    }
  }
  // Organizations
  for (const org of entities.organizations) {
    const key = normalizeOrg(org);
    if (!orgMap.has(key)) {
      orgMap.set(key, { ...org, provenance: [docId] });
    } else {
      const entry = orgMap.get(key);
      if (!entry.provenance.includes(docId)) entry.provenance.push(docId);
    }
  }
  // Dates
  for (const date of entities.dates) {
    const key = normalizeDate(date);
    if (!dateMap.has(key)) {
      dateMap.set(key, { ...date, provenance: [docId] });
    } else {
      const entry = dateMap.get(key);
      if (!entry.provenance.includes(docId)) entry.provenance.push(docId);
    }
  }
  // Monetary Amounts
  for (const amount of entities.monetaryAmounts) {
    const key = normalizeAmount(amount);
    if (!amountMap.has(key)) {
      amountMap.set(key, { ...amount, provenance: [docId] });
    } else {
      const entry = amountMap.get(key);
      if (!entry.provenance.includes(docId)) entry.provenance.push(docId);
    }
  }
}

phase('Synthesize Final Dataset');
log('Synthesizing final deduplicated dataset with provenance...');

const finalDataset = {
  people: Array.from(peopleMap.values()),
  organizations: Array.from(orgMap.values()),
  dates: Array.from(dateMap.values()),
  monetaryAmounts: Array.from(amountMap.values()),
  perDocument: perDocEntities.map(({ docId, entities }) => ({
    docId,
    entities
  }))
};

return finalDataset;
```

> **Claude judge:** The script fans out all 200 documents in a single `parallel()` call (no bounded waves of 6-8), has no ScheduleWakeup watchdog, no per-agent retry logic (just filters nulls), no per-wave result commits (single hard barrier before synthesis), no backoff on high failure rates, and no explicit gap-flagging in synthesis. It does have null-tolerance (filter(Boolean)), cache-stable prompts (no Date.now/Math.random), and a lean capped schema, but the critical safety properties for large fan-out are mostly absent.

## With skill — rubric 82%, patterns 100%

```js
export const meta = {
  name: 'document-extraction-sweep',
  description: 'Extracts structured entities (people, organizations, dates, monetary amounts) from a set of contract documents and aggregates them into a deduplicated dataset with per-document provenance.',
  phases: [
    { title: 'Extract Entities' },
    { title: 'Aggregate & Deduplicate' }
  ]
}

// --- CONFIGURATION ---

// args.documents: array of { id: string, title: string, content: string }
// Each document must have a unique, stable id.

const DOCUMENTS = Array.isArray(args.documents) ? args.documents.slice(0, 200) : []
if (DOCUMENTS.length === 0) throw new Error('No documents provided in args.documents')

// --- SCHEMAS ---

const ENTITY_SCHEMA = {
  type: 'object',
  required: ['document_id', 'entities'],
  properties: {
    document_id: { type: 'string', description: 'The unique id of the document.' },
    entities: {
      type: 'object',
      required: ['people', 'organizations', 'dates', 'monetary_amounts'],
      properties: {
        people: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', description: 'Full name of the person.' },
              role: { type: 'string', description: 'Role or title if available.', nullable: true }
            }
          },
          maxItems: 12
        },
        organizations: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', description: 'Organization name.' },
              type: { type: 'string', description: 'Type of organization if available.', nullable: true }
            }
          },
          maxItems: 12
        },
        dates: {
          type: 'array',
          items: {
            type: 'object',
            required: ['date'],
            properties: {
              date: { type: 'string', description: 'Date in ISO format if possible.' },
              description: { type: 'string', description: 'What the date refers to.', nullable: true }
            }
          },
          maxItems: 12
        },
        monetary_amounts: {
          type: 'array',
          items: {
            type: 'object',
            required: ['amount'],
            properties: {
              amount: { type: 'string', description: 'Amount and currency, as stated in the document.' },
              description: { type: 'string', description: 'What the amount refers to.', nullable: true }
            }
          },
          maxItems: 12
        }
      }
    }
  }
}

const AGGREGATED_SCHEMA = {
  type: 'object',
  required: ['people', 'organizations', 'dates', 'monetary_amounts', 'provenance', 'gaps'],
  properties: {
    people: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'documents'],
        properties: {
          name: { type: 'string' },
          role: { type: 'string', nullable: true },
          documents: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs of documents where this person appears.'
          }
        }
      }
    },
    organizations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'documents'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', nullable: true },
          documents: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    },
    dates: {
      type: 'array',
      items: {
        type: 'object',
        required: ['date', 'documents'],
        properties: {
          date: { type: 'string' },
          description: { type: 'string', nullable: true },
          documents: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    },
    monetary_amounts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['amount', 'documents'],
        properties: {
          amount: { type: 'string' },
          description: { type: 'string', nullable: true },
          documents: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    },
    provenance: {
      type: 'object',
      description: 'Map of document_id to {title}',
      additionalProperties: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' }
        }
      }
    },
    gaps: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of document_ids for which extraction failed or is missing.'
    }
  }
}

// --- UTILS ---

const WAVE_SIZE = 8
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }

// --- ENTITY EXTRACTION ---

function buildExtractionPrompt(doc) {
  return (
    `Extract the following structured entities from the contract document below:\n` +
    `- People: full names and roles/titles if available\n` +
    `- Organizations: names and types if available\n` +
    `- Dates: all relevant dates (in ISO format if possible) and what they refer to\n` +
    `- Monetary amounts: all amounts and currencies, and what they refer to\n\n` +
    `Return at most 12 of each entity type. Your output must fill the provided schema. ` +
    `Do not include entities not present in the document. Do not hallucinate. ` +
    `If a field is not present, return an empty array for that field.\n\n` +
    `Document ID: ${doc.id}\nTitle: ${doc.title}\n---\n${doc.content}\n`
  )
}

async function runExtraction(doc) {
  return agent(
    buildExtractionPrompt(doc),
    {
      label: `extract:${doc.id}`,
      phase: 'Extract Entities',
      schema: ENTITY_SCHEMA,
      effort: 'medium'
    }
  )
}

// --- SAFE SWARM WAVE LOOP ---

const waves = chunk(DOCUMENTS, WAVE_SIZE)
const extracted = []
let failed = []

for (let w = 0; w < waves.length; w++) {
  phase(`Wave ${w + 1}/${waves.length}`)
  log(`Launching extraction for documents ${w * WAVE_SIZE + 1}–${Math.min((w + 1) * WAVE_SIZE, DOCUMENTS.length)}`)
  const batch = await parallel(waves[w].map(doc => () => runExtraction(doc)))
  batch.forEach((result, i) => {
    if (result) extracted.push(result)
    else failed.push(waves[w][i])
  })
  log(`Wave ${w + 1}: ${extracted.length}/${DOCUMENTS.length} extracted, ${failed.length} to retry`)
  // Instability backoff (Pattern 8)
  const nulls = batch.filter(r => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`⚠ instability: ${nulls}/${batch.length} failed this wave — backing off. Returning partial; resume later.`)
    break
  }
}

// Retry wave for failed docs
if (failed.length) {
  phase('Retry')
  log(`Retrying extraction for ${failed.length} failed documents`)
  const retried = await parallel(failed.map(doc => () => runExtraction(doc)))
  const stillFailed = []
  retried.forEach((result, i) => {
    if (result) extracted.push(result)
    else stillFailed.push(failed[i])
  })
  failed = stillFailed
  log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

// --- AGGREGATION & DEDUPLICATION ---

phase('Aggregate & Deduplicate')

function deduplicateEntities(entities, keyFields) {
  // entities: array of { ...fields, document_id }
  // keyFields: array of field names to use as deduplication key
  const map = new Map()
  for (const ent of entities) {
    const key = keyFields.map(f => (ent[f] || '').toLowerCase().trim()).join('|')
    if (!key || key === '|') continue
    if (!map.has(key)) {
      map.set(key, { ...ent, documents: [ent.document_id] })
    } else {
      // Merge: add document_id if not present
      const existing = map.get(key)
      if (!existing.documents.includes(ent.document_id)) {
        existing.documents.push(ent.document_id)
      }
      // Optionally, merge roles/types/descriptions if missing
      for (const f of keyFields) {
        if (!existing[f] && ent[f]) existing[f] = ent[f]
      }
    }
  }
  // Remove document_id from output
  return Array.from(map.values()).map(({ document_id, ...rest }) => rest)
}

// Flatten all extracted entities
const allPeople = []
const allOrgs = []
const allDates = []
const allAmounts = []
const provenance = {}

for (const doc of DOCUMENTS) {
  provenance[doc.id] = { title: doc.title }
}

for (const result of extracted) {
  const docId = result.document_id
  if (result.entities.people) {
    for (const p of result.entities.people) {
      allPeople.push({ ...p, document_id: docId })
    }
  }
  if (result.entities.organizations) {
    for (const o of result.entities.organizations) {
      allOrgs.push({ ...o, document_id: docId })
    }
  }
  if (result.entities.dates) {
    for (const d of result.entities.dates) {
      allDates.push({ ...d, document_id: docId })
    }
  }
  if (result.entities.monetary_amounts) {
    for (const m of result.entities.monetary_amounts) {
      allAmounts.push({ ...m, document_id: docId })
    }
  }
}

// Deduplicate by key fields
const dedupedPeople = deduplicateEntities(allPeople, ['name'])
const dedupedOrgs = deduplicateEntities(allOrgs, ['name'])
const dedupedDates = deduplicateEntities(allDates, ['date', 'description'])
const dedupedAmounts = deduplicateEntities(allAmounts, ['amount', 'description'])

// Compute missing docs
const extractedDocIds = new Set(extracted.map(r => r.document_id))
const missing = DOCUMENTS.filter(doc => !extractedDocIds.has(doc.id)).map(doc => doc.id)
if (missing.length) log(`⚠ partial: missing ${missing.length}/${DOCUMENTS.length}: ${missing.join(', ')}`)

// --- SYNTHESIS AGENT (for explicitness, but aggregation is above) ---

const synthesisPrompt =
  `You are aggregating extracted entities from a set of contract documents. ` +
  `You have the following deduplicated lists of people, organizations, dates, and monetary amounts, each with a list of document IDs where they appear. ` +
  `Provenance for each document is included. The following documents could not be extracted: ${JSON.stringify(missing)}. ` +
  `Flag these as gaps in the output. Do not hallucinate any data. Output must fill the provided schema. ` +
  `If any entity appears in multiple documents, merge their provenance. ` +
  `Here is the data to aggregate:\n` +
  `People: ${JSON.stringify(dedupedPeople)}\n` +
  `Organizations: ${JSON.stringify(dedupedOrgs)}\n` +
  `Dates: ${JSON.stringify(dedupedDates)}\n` +
  `Monetary Amounts: ${JSON.stringify(dedupedAmounts)}\n` +
  `Provenance: ${JSON.stringify(provenance)}\n` +
  `Gaps: ${JSON.stringify(missing)}\n`

const aggregated = await agent(
  synthesisPrompt,
  {
    label: 'aggregate-synthesis',
    phase: 'Aggregate & Deduplicate',
    schema: AGGREGATED_SCHEMA,
    effort: 'high'
  }
)

// --- RETURN FINAL OUTPUT ---

return {
  aggregated,
  missing,
  extracted_count: extracted.length,
  total_documents: DOCUMENTS.length
}

// --- SCHEDULEWATCHDOG (Pattern 4) ---
// (This must be emitted at the agent level, not inside the script body.)
// After launching this workflow, arm the following watchdog (replace <id> with your runId):

/*
ScheduleWakeup({
  delaySeconds: 1200,
  reason: "watchdog: swarm wf_<id> may stall silently; check journal mtime",
  prompt: "Watchdog for run wf_<id>: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
})
*/
```

> **Claude judge:** The script implements bounded waves of 8, per-agent null-checking with a retry wave, per-wave result accumulation, high-failure-rate backoff (>40%), capped schemas, and gap-flagging in synthesis — all strong safety properties. The watchdog is present only as a commented-out block rather than an actual armed call, and per-wave results are in-memory rather than durably persisted, which are meaningful but not fatal gaps.

