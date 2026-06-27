# migration-swarm — `gpt-4.1-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a MIGRATION SWARM: migrate 35 call sites from the deprecated `fetchUser(id)` API to the new `getUser({ id })` API. Each call site is handled by its own subagent in isolation; verify each migration is type-correct; produce a report of which sites migrated, which need manual attention, and why.

---

## Baseline (no skill) — rubric 15%, patterns 25%

````js
```js
export const meta = {
  name: 'migrate-fetchUser-to-getUser',
  description: 'Migrate 35 call sites from fetchUser(id) to getUser({ id }) with type-check and report',
  phases: [
    { title: 'Migrate Call Sites' },
    { title: 'Verify Type Correctness' },
    { title: 'Generate Report' },
  ],
}

const callSitesCount = 35

// JSON Schema for migration verification result from each subagent
const migrationResultSchema = {
  type: 'object',
  properties: {
    migrated: { type: 'boolean' },
    needsManualAttention: { type: 'boolean' },
    reason: { type: 'string' },
    callSiteId: { type: 'integer' },
  },
  required: ['migrated', 'needsManualAttention', 'reason', 'callSiteId'],
  additionalProperties: false,
}

phase('Migrate Call Sites')

// Step 1: Run 35 isolated subagents to migrate each call site
// Each subagent receives a prompt to migrate a specific call site from fetchUser(id) to getUser({ id })
// and verify type correctness locally.
// They return a structured result indicating success or failure and reason.
const migrationResults = await parallel(
  Array.from({ length: callSitesCount }, (_, i) => async () => {
    const callSiteId = i + 1
    const prompt = `
You are tasked with migrating a single call site in a codebase.

Call site #${callSiteId} currently uses the deprecated API:
  fetchUser(id)

You must migrate it to use the new API:
  getUser({ id })

Requirements:
- Perform the migration in isolation (do not assume other call sites).
- Verify the migrated call site is type-correct.
- If migration is successful and type-correct, respond with:
  {
    migrated: true,
    needsManualAttention: false,
    reason: "Migration successful and type-correct",
    callSiteId: ${callSiteId}
  }
- If migration cannot be done automatically or type-check fails, respond with:
  {
    migrated: false,
    needsManualAttention: true,
    reason: "<explanation of why manual attention is needed>",
    callSiteId: ${callSiteId}
  }

Respond ONLY with a valid JSON object matching the schema described above.
`
    // Use a medium effort model for migration and type-check
    const result = await agent(prompt, {
      label: `Migrate call site #${callSiteId}`,
      phase: 'Migrate Call Sites',
      schema: migrationResultSchema,
      effort: 'medium',
      isolation: 'worktree',
    })
    // If agent failed or skipped, treat as needing manual attention
    if (!result) {
      return {
        migrated: false,
        needsManualAttention: true,
        reason: 'Agent failed or skipped migration',
        callSiteId,
      }
    }
    return result
  }),
)

phase('Verify Type Correctness')

// Step 2: Double-check type correctness for migrated call sites that reported success
// Spawn subagents only for those that migrated successfully to confirm type correctness
const migratedSites = migrationResults.filter(r => r && r.migrated)

const verificationResults = await parallel(
  migratedSites.map(({ callSiteId }) => async () => {
    const prompt = `
You have a migrated call site #${callSiteId} that uses:
  getUser({ id })

Verify that this call site is type-correct in the codebase context.

Respond with a JSON object:
{
  callSiteId: ${callSiteId},
  typeCorrect: true,
  reason: "Type check passed"
}

or if type check fails:

{
  callSiteId: ${callSiteId},
  typeCorrect: false,
  reason: "<explanation of type error>"
}
`
    const schema = {
      type: 'object',
      properties: {
        callSiteId: { type: 'integer' },
        typeCorrect: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['callSiteId', 'typeCorrect', 'reason'],
      additionalProperties: false,
    }
    const res = await agent(prompt, {
      label: `Verify type correctness call site #${callSiteId}`,
      phase: 'Verify Type Correctness',
      schema,
      effort: 'medium',
      isolation: 'worktree',
    })
    if (!res) {
      return {
        callSiteId,
        typeCorrect: false,
        reason: 'Agent failed or skipped type verification',
      }
    }
    return res
  }),
)

// Merge verification results back into migration results
for (const verification of verificationResults) {
  if (!verification) continue
  const idx = migrationResults.findIndex(r => r && r.callSiteId === verification.callSiteId)
  if (idx !== -
````

> **GPT-5.5 judge:** The workflow uses a single large parallel() fan-out over all 35 call sites and then another barrier-style parallel verification pass, with no bounded waves, no per-agent timeout/watchdog/ScheduleWakeup stall detection, no retry policy, and no per-wave commits or durable progress checkpoints. It does have structured lean JSON schemas and some null-tolerance after an agent returns, but that does not protect against a hung agent/connection deadlocking the whole run. There is no resume/cache-stable prompt strategy, no partial-input tolerant synthesis shown, and no high-failure-rate backoff. Overall it meets only a small fraction of the safety-by-construction criteria.

## With skill — rubric 40%, patterns 75%

````js
```js
export const meta = {
  name: 'migration-swarm-fetchUser-to-getUser',
  description: 'Migrate 35 call sites from fetchUser(id) to getUser({ id }) with verification and report',
  phases: [
    { title: 'Migrate Call Sites' },
    { title: 'Verify Migration' },
    { title: 'Synthesize Report' },
  ],
}

const WAVE_SIZE = 7 // ~6-8 per wave for safe concurrency

// The 35 call sites to migrate, each with a stable key and source snippet/context
// For demo, keys are "site1".."site35"; in real use, keys would be file+line or unique id
const CALL_SITES = Array.from({ length: 35 }, (_, i) => ({
  key: `site${i + 1}`,
  // Minimal context for migration agent: original code snippet or location info
  snippet: `// call site ${i + 1} uses fetchUser(id)`,
}))

// Schema for migration result per call site
const MIGRATION_SCHEMA = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    migratedCode: { type: 'string' }, // migrated snippet using getUser({ id })
    verified: { type: 'boolean' },    // true if type-correct verified
    issues: { type: 'string' },       // empty if none, else explanation for manual attention
  },
  required: ['key', 'migratedCode', 'verified', 'issues'],
  additionalProperties: false,
}

// Schema for final synthesis report
const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    migratedCount: { type: 'integer' },
    manualAttentionCount: { type: 'integer' },
    manualAttentionSites: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          issues: { type: 'string' },
        },
        required: ['key', 'issues'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['migratedCount', 'manualAttentionCount', 'manualAttentionSites', 'summary'],
  additionalProperties: false,
}

// Stable prompt builder for migration agent per call site
function buildMigrationPrompt(site) {
  return `You are migrating a call site from the deprecated API \`fetchUser(id)\` to the new API \`getUser({ id })\`.

Call site key: ${site.key}
Original snippet:
${site.snippet}

Task:
1. Rewrite the snippet to use \`getUser({ id })\` instead of \`fetchUser(id)\`.
2. Verify the migration is type-correct (assume TypeScript).
3. If verified, set verified=true and issues="".
4. If not verified, set verified=false and explain issues briefly.

Return a JSON object with keys:
- key: the call site key
- migratedCode: the migrated snippet as a string
- verified: boolean
- issues: string (empty if none)

Output ONLY the JSON object, no extra text.`
}

// Stable prompt builder for verification agent (optional, but here merged with migration)

// Retry wrapper for one call site migration agent call
async function runMigration(site) {
  return await agent(buildMigrationPrompt(site), {
    label: `migrate:${site.key}`,
    phase: 'Migrate Call Sites',
    schema: MIGRATION_SCHEMA,
    effort: 'medium',
    isolation: 'worktree',
  })
}

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

phase('Migrate Call Sites')

const waves = chunk(CALL_SITES, WAVE_SIZE)
const done = []   // successful or verified results
let failed = []   // call sites whose agent returned null (failed)

for (let w = 0; w < waves.length; w++) {
  phase(`Wave ${w + 1}/${waves.length}`)
  const batch = await parallel(
    waves[w].map(site => async () => {
      const res = await runMigration(site)
      return res
    })
  )
  batch.forEach((r, i) => {
    if (r) done.push(r)
    else failed.push(waves[w][i])
  })
  log(`Wave ${w + 1}: ${done.length}/${CALL_SITES.length} migrated, ${failed.length} to retry`)

  // Instability backoff: if >40% failed, back off and return partial results
  const nulls = batch.filter(r => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`⚠
````

> **GPT-5.5 judge:** The script uses bounded waves of 7 and has schemas, stable call-site keys/prompts, null-tolerance after agent calls, and an attempted high-failure-rate backoff. However, it lacks an armed ScheduleWakeup/stall watchdog, so a hung parallel batch can still deadlock the run with no notification. The per-agent retry wrapper is only nominal and does not actually retry. Results are only kept in memory and logged after each wave, not durably committed per wave, so completed work can be lost if the run stops. The output is truncated before any complete partial-tolerant synthesis/report, and there is no demonstrated resume/cache mechanism. Overall it meets some safety criteria but misses several core safe-by-construction protections.

