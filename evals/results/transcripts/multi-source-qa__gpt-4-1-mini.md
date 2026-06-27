# multi-source-qa — `gpt-4.1-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for MULTI-SOURCE QA: answer "how did our authentication system change over the last year?" by reading 33 design docs and pull requests. Each source is read by an agent that returns the relevant changes; dedupe across sources; synthesize a cited timeline.

---

## Baseline (no skill) — rubric 12%, patterns 19%

````js
```js
export const meta = {
  name: 'multi-source-auth-changes-qa',
  description: 'Answer how the authentication system changed over the last year by reading 33 design docs and PRs, deduping, and synthesizing a cited timeline.',
  phases: [
    { title: 'Extract Changes from Sources' },
    { title: 'Deduplicate Changes' },
    { title: 'Synthesize Timeline' },
  ],
}

const SOURCES = [
  // Example placeholders; in real usage these would be passed in args or loaded externally.
  // Each source is an object with { id: string, type: 'design-doc'|'pull-request', content: string }
  // For demonstration, we simulate 33 sources with ids "doc-1" to "doc-20" and "pr-1" to "pr-13".
  ...Array.from({ length: 20 }, (_, i) => ({ id: `doc-${i+1}`, type: 'design-doc', content: '' })),
  ...Array.from({ length: 13 }, (_, i) => ({ id: `pr-${i+1}`, type: 'pull-request', content: '' })),
]

/**
 * Prompt template to extract relevant authentication system changes from a single source.
 * The agent should return a JSON array of change objects:
 * [{ date: string (ISO or approximate), description: string, sourceId: string }]
 */
function extractChangesPrompt(source) {
  return `
You are a software engineering assistant. You have the full text of a single source document related to our authentication system.

Source ID: ${source.id}
Source Type: ${source.type}

Task:
- Identify all relevant changes to the authentication system described in this source over the last year.
- For each change, provide:
  - A date or approximate date (ISO 8601 format if possible, or a natural language date)
  - A concise description of the change
  - The source ID (include it exactly as given)
- Return a JSON array of change objects with keys: date, description, sourceId.

If no relevant changes are found, return an empty array [].

Source content:
"""
${source.content}
"""
`
}

/**
 * JSON Schema for validating extracted changes from a single source.
 */
const extractChangesSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['date', 'description', 'sourceId'],
    properties: {
      date: { type: 'string' },
      description: { type: 'string' },
      sourceId: { type: 'string' },
    },
    additionalProperties: false,
  },
}

/**
 * Prompt template to deduplicate a list of changes.
 * Input: array of change objects with date, description, sourceId.
 * Output: array of deduplicated changes, merging sources for duplicates.
 */
function dedupePrompt(changes) {
  return `
You are a software engineering assistant tasked with deduplicating a list of changes to an authentication system.

Input: a JSON array of change objects, each with:
- date: string (date or approximate date)
- description: string (concise description of the change)
- sourceId: string (source document ID)

Your task:
- Identify changes that describe the same underlying change (even if wording differs).
- Merge duplicates into a single change object with:
  - date: keep the most precise or earliest date
  - description: a concise, clear description summarizing the change
  - sourceIds: an array of all sourceIds that mention this change

Return a JSON array of deduplicated change objects with keys:
- date: string
- description: string
- sourceIds: array of strings

Example input:
${JSON.stringify(changes.slice(0,3), null, 2)}

Output:
`
}

/**
 * JSON Schema for deduplicated changes.
 */
const dedupedChangesSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['date', 'description', 'sourceIds'],
    properties: {
      date: { type: 'string' },
      description: { type: 'string' },
      sourceIds: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
      },
    },
    additionalProperties: false,
  },
}

/**
 * Prompt template to synthesize a cited timeline from deduplicated changes.
 * Input: array of deduplicated changes with date, description, sourceIds.
 * Output: a human-readable timeline narrative citing sources.
 */
function synthesizeTimelinePrompt(dedupedChanges) {
  return `
You are a software engineering assistant. Given a list of deduplicated changes to our authentication system over the last year, produce a clear, chronological timeline narrative.

Input: JSON array of change objects with:
- date: string (date or approximate date)
- description: string (concise description)
````

> **GPT-5.5 judge:** The script mostly defines prompt templates and schemas, but it does not implement safe fan-out orchestration. There are no bounded waves, no per-agent retry or null-tolerance, no per-wave commits, no ScheduleWakeup/watchdog for hung connections, no resume/cache-stable behavior, no high-failure-rate backoff, and no explicit partial-input synthesis/gap reporting. The JSON schemas are reasonably lean and structured, which earns limited credit, and it does not explicitly show a giant unbounded parallel call, but it also does not provide the requested safety mechanisms.

## With skill — rubric 25%, patterns 19%

````js
```js
export const meta = {
  name: 'multi-source-auth-changes',
  description: 'Aggregate and synthesize changes to authentication system from 33 design docs and PRs over last year',
  phases: [
    { title: 'Extract Changes' },
    { title: 'Deduplicate & Synthesize' },
  ],
}

const WAVE_SIZE = 6

// The 33 sources: stable keys and titles (example placeholders)
const SOURCES = [
  { key: 'doc-001', title: 'Design Doc: OAuth2 Migration' },
  { key: 'doc-002', title: 'PR #1234: Add MFA Support' },
  { key: 'doc-003', title: 'Design Doc: Password Policy Update' },
  { key: 'doc-004', title: 'PR #1250: Session Timeout Changes' },
  { key: 'doc-005', title: 'Design Doc: SSO Integration' },
  { key: 'doc-006', title: 'PR #1300: Token Revocation' },
  { key: 'doc-007', title: 'Design Doc: Authentication Logging' },
  { key: 'doc-008', title: 'PR #1350: Login Rate Limiting' },
  { key: 'doc-009', title: 'Design Doc: Password Reset Flow' },
  { key: 'doc-010', title: 'PR #1400: OAuth2 Scope Changes' },
  { key: 'doc-011', title: 'Design Doc: User Lockout Policy' },
  { key: 'doc-012', title: 'PR #1450: MFA Device Management' },
  { key: 'doc-013', title: 'Design Doc: Authentication API v2' },
  { key: 'doc-014', title: 'PR #1500: SAML SSO Fixes' },
  { key: 'doc-015', title: 'Design Doc: Password Hashing Upgrade' },
  { key: 'doc-016', title: 'PR #1550: Session Cookie Security' },
  { key: 'doc-017', title: 'Design Doc: Login UI Changes' },
  { key: 'doc-018', title: 'PR #1600: OAuth2 Token Expiry' },
  { key: 'doc-019', title: 'Design Doc: Authentication Metrics' },
  { key: 'doc-020', title: 'PR #1650: MFA Enrollment Flow' },
  { key: 'doc-021', title: 'Design Doc: Password Complexity' },
  { key: 'doc-022', title: 'PR #1700: Login Error Messages' },
  { key: 'doc-023', title: 'Design Doc: Authentication Failover' },
  { key: 'doc-024', title: 'PR #1750: OAuth2 Refresh Tokens' },
  { key: 'doc-025', title: 'Design Doc: User Session Management' },
  { key: 'doc-026', title: 'PR #1800: MFA Backup Codes' },
  { key: 'doc-027', title: 'Design Doc: Authentication Security Review' },
  { key: 'doc-028', title: 'PR #1850: Password Reset Email' },
  { key: 'doc-029', title: 'Design Doc: Login Flow Optimization' },
  { key: 'doc-030', title: 'PR #1900: Session Fixation Mitigation' },
  { key: 'doc-031', title: 'Design Doc: Authentication Error Handling' },
  { key: 'doc-032', title: 'PR #1950: OAuth2 Client Registration' },
  { key: 'doc-033', title: 'Design Doc: MFA Usability Improvements' },
]

// Schema for each source's extracted changes
const CHANGE_SCHEMA = {
  type: 'object',
  properties: {
    key: { type: 'string' }, // source key
    title: { type: 'string' }, // source title
    changes: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date of change, ISO 8601 or YYYY-MM-DD' },
          summary: { type: 'string', description: 'One-line summary of the change' },
          detailsUrl: { type: 'string', description: 'URL or reference to source' },
          rationale: { type: 'string', description: 'One-line rationale or why the change was made' },
        },
        required: ['date', 'summary', 'detailsUrl', 'rationale'],
        additionalProperties: false,
      },
    },
  },
  required: ['key', 'title', 'changes'],
  additionalProperties: false,
}

// Schema
````

> **GPT-5.5 judge:** The script includes a WAVE_SIZE of 6 and stable source keys, and it defines a capped extraction schema with maxItems: 8, which helps keep outputs lean. However, the actual orchestration is not present: there is no demonstrated bounded wave execution, no per-agent retry or null-tolerance, no per-wave result commits, no ScheduleWakeup stall watchdog, no resume/cache behavior, no partial-input synthesis with gap reporting, and no high-failure-rate backoff. It avoids showing a dangerous single unbounded parallel fan-out, but it also does not implement most of the safety mechanisms required for a large parallel-subagent workflow.

