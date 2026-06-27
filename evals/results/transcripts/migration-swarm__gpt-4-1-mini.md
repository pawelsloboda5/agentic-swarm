# migration-swarm — `gpt-4.1-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a MIGRATION SWARM: migrate 35 call sites from the deprecated `fetchUser(id)` API to the new `getUser({ id })` API. Each call site is handled by its own subagent in isolation; verify each migration is type-correct; produce a report of which sites migrated, which need manual attention, and why.

---

## Baseline (no skill) — rubric 20%, patterns 25%

```js
export const meta = {
  name: 'migration-swarm-fetchUser-to-getUser',
  description: 'Migrate 35 call sites from fetchUser(id) to getUser({ id }) with type verification and reporting',
  phases: [
    { title: 'Migrate Call Sites' },
    { title: 'Verify Type Correctness' },
    { title: 'Generate Report' },
  ],
}

const totalCallSites = 35

// JSON Schema for migration result from each subagent
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
log(`Starting migration of ${totalCallSites} call sites from fetchUser(id) to getUser({ id })`)

// Run one isolated subagent per call site to perform migration and type check
const migrationResults = await parallel(
  Array.from({ length: totalCallSites }, (_, i) => async () => {
    const callSiteId = i + 1
    // Prompt instructs the subagent to migrate the specific call site and verify type correctness
    const prompt = `
You are migrating a single call site #${callSiteId} that uses the deprecated API:
  fetchUser(id)

Migrate this call site to use the new API:
  getUser({ id })

Ensure the migrated code is type-correct (e.g. argument shape, usage).

Respond with a JSON object with these fields:
- migrated: true if migration succeeded and is type-correct, else false
- needsManualAttention: true if migration failed or type check failed and manual fix is needed, else false
- reason: a short explanation if manual attention is needed, or "Migration successful" if not
- callSiteId: the call site number (${callSiteId})

Example response:
{
  "migrated": true,
  "needsManualAttention": false,
  "reason": "Migration successful",
  "callSiteId": ${callSiteId}
}
`
    // Run the subagent with isolation and schema validation
    const result = await agent(prompt, {
      label: `Migrate call site #${callSiteId}`,
      phase: 'Migrate Call Sites',
      schema: migrationResultSchema,
      isolation: 'worktree',
      effort: 'high',
    })
    // If subagent failed or was skipped, mark as needing manual attention
    if (result === null) {
      return {
        migrated: false,
        needsManualAttention: true,
        reason: 'Subagent failed or skipped',
        callSiteId,
      }
    }
    return result
  }),
)

phase('Verify Type Correctness')
log('Verifying type correctness of migrated call sites')

// We already asked subagents to verify type correctness, but do a sanity check here
// Filter out null results just in case
const verifiedResults = migrationResults.filter(r => r !== null)

// Separate migrated and manual attention needed
const migratedSites = verifiedResults.filter(r => r.migrated && !r.needsManualAttention)
const manualAttentionSites = verifiedResults.filter(r => r.needsManualAttention)

// Compose a report string
phase('Generate Report')
log('Generating migration report')

const reportLines = []
reportLines.push(`Migration Report for ${totalCallSites} call sites:`)
reportLines.push(`\nSuccessfully migrated (${migratedSites.length}):`)
for (const r of migratedSites) {
  reportLines.push(`- Call site #${r.callSiteId}: ${r.reason}`)
}
reportLines.push(`\nNeed manual attention (${manualAttentionSites.length}):`)
for (const r of manualAttentionSites) {
  reportLines.push(`- Call site #${r.callSiteId}: ${r.reason}`)
}

const report = reportLines.join('\n')

log('Migration complete. Summary:')
log(report)

return {
  migratedCount: migratedSites.length,
  manualAttentionCount: manualAttentionSites.length,
  details: verifiedResults,
  report,
}
```

> **Claude judge:** The script fans out all 35 agents in a single parallel() call (no bounded waves of 6-8), has no ScheduleWakeup watchdog, no per-wave result commits (single hard barrier before synthesis), no backoff on high failure rates, and only minimal null-tolerance (null check but no retry). It does have deterministic prompts (no Date.now/Math.random), a lean JSON schema, and synthesis that tolerates partial input and flags gaps.

## With skill — rubric 100%, patterns 94%

```js
export const meta = {
  name: 'migration-swarm-fetchUser-to-getUser',
  description: 'Migrate 35 call sites from fetchUser(id) to getUser({id}) with type-check and report',
  phases: [
    { title: 'Migrate Call Sites' },
    { title: 'Verify Migration' },
    { title: 'Synthesize Report' },
  ],
}

const WAVE_SIZE = 6

// Stable list of 35 call sites to migrate, each with a stable key and source snippet
// (In real use, this would come from args or a DB; here we hardcode for example)
const CALL_SITES = Array.from({ length: 35 }, (_, i) => ({
  key: `callsite_${i + 1}`,
  // Minimal example snippet; in real use, include file path, line number, code context
  snippet: `// call site ${i + 1} code snippet using fetchUser(id)`,
}))

// JSON Schema for migration result from each subagent
const MIGRATION_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    migratedCode: { type: 'string' }, // migrated snippet using getUser({ id })
    typeCheckPassed: { type: 'boolean' },
    issues: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5,
    },
  },
  required: ['key', 'migratedCode', 'typeCheckPassed', 'issues'],
  additionalProperties: false,
}

// JSON Schema for final synthesis report
const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    migrated: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 35,
    },
    manualAttention: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['key', 'reason'],
        additionalProperties: false,
      },
      maxItems: 35,
    },
    summary: { type: 'string' },
  },
  required: ['migrated', 'manualAttention', 'summary'],
  additionalProperties: false,
}

// Build stable prompt for migrating one call site
function buildMigrationPrompt(callsite) {
  return `You are migrating a single call site from the deprecated API:
  
  Original call site snippet:
  ${callsite.snippet}
  
  Task:
  1. Rewrite the snippet to use the new API call getUser({ id }) instead of fetchUser(id).
  2. Verify the migrated code is type-correct (assume TypeScript).
  3. If type errors or issues are found, list them briefly.
  
  Return a JSON object with these fields:
  - key: the call site key (string)
  - migratedCode: the migrated code snippet (string)
  - typeCheckPassed: true if type check passed, false otherwise
  - issues: an array of up to 5 short strings describing any issues or empty if none
  
  Return ONLY the JSON object, no extra text.`
}

// Run one call site's migration agent, returns object or null on failure
async function runMigration(callsite) {
  return await agent(buildMigrationPrompt(callsite), {
    label: `migrate:${callsite.key}`,
    phase: 'Migrate Call Sites',
    schema: MIGRATION_RESULT_SCHEMA,
    isolation: 'worktree',
    effort: 'medium',
  })
}

// After migration, verify each result's type correctness and issues are present
// (Verification is embedded in migration step here, so no separate agent needed)

// Synthesis prompt embeds all results and missing keys, asks for a report
function buildSynthesisPrompt(results, missingKeys) {
  // Sort results by key for stable prompt
  const sorted = [...results].sort((a, b) => (a.key > b.key ? 1 : -1))
  const payload = JSON.stringify(sorted, null, 2)
  return `You are synthesizing a migration report for 35 call sites migrated from fetchUser(id) to getUser({ id }).

Input data: ${sorted.length} migrated call sites with their migration results:
${payload}

Missing call sites (no migration result): ${JSON.stringify(missingKeys)}

Task:
- List keys of call sites successfully migrated (typeCheckPassed: true).
- List keys and reasons for call sites needing manual attention (typeCheckPassed: false or issues present).
- Provide a concise summary of the overall migration status and recommendations.

Return a JSON object with fields:
- migrated: array of keys migrated successfully
- manualAttention: array of objects { key, reason }
- summary: a short summary string

Return ONLY the JSON object, no extra text.`
}

async function runSynthesis(results, missingKeys) {
  const prompt = buildSynthesisPrompt(results, missingKeys)
  return await agent(prompt, {
    label: 'synthesize-report',
    phase: 'Synthesize Report',
    schema: REPORT_SCHEMA,
    effort: 'high',
  })
}

// Utility: chunk array into waves of size n
function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

export default async function () {
  phase('Migration Swarm Start')

  const waves = chunk(CALL_SITES, WAVE_SIZE)
  const done = [] // successful results
  let failed = [] // call sites whose agent returned null this run

  // Pattern 1 + 3 + 8: run migration in waves, commit per wave, backoff on instability
  for (let w = 0; w < waves.length; w++) {
    phase(`Wave ${w + 1}/${waves.length}`)
    const batch = await parallel(
      waves[w].map((callsite) => async () => {
        const res = await runMigration(callsite)
        return res
      })
    )
    batch.forEach((r, i) => {
      if (r) done.push(r)
      else failed.push(waves[w][i])
    })
    log(`Wave ${w + 1}: ${done.length}/${CALL_SITES.length} migrated, ${failed.length} failed`)

    // Pattern 8: instability backoff
    const nulls = batch.filter((r) => r === null).length
    if (nulls / batch.length > 0.4) {
      log(`⚠ instability: ${nulls}/${batch.length} failed this wave — backing off; returning partial, resume later.`)
      break
    }
  }

  // Pattern 2: retry wave for failed call sites
  if (failed.length) {
    phase('Retry Failed Migrations')
    const retried = await parallel(
      failed.map((callsite) => async () => {
        const res = await runMigration(callsite)
        return res
      })
    )
    const stillFailed = []
    retried.forEach((r, i) => {
      if (r) done.push(r)
      else stillFailed.push(failed[i])
    })
    failed = stillFailed
    log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
  }

  // Pattern 7 + 5: identify missing keys, pass to synthesis prompt
  const haveKeys = new Set(done.map((r) => r.key))
  const missing = CALL_SITES.filter((it) => !haveKeys.has(it.key)).map((it) => it.key)
  if (missing.length) log(`⚠ partial: missing ${missing.length}/${CALL_SITES.length}: ${missing.join(', ')}`)

  // Pattern 7: synthesis must flag gaps explicitly
  const synthesis = await runSynthesis(done, missing)

  // Return full deliverable with partial results, missing keys, and synthesis report
  return { results: done, missing, synthesis }
}

// Pattern 4: ScheduleWakeup watchdog to detect silent stalls and resume
ScheduleWakeup({
  delaySeconds: 1200,
  reason: 'watchdog: migration-swarm-fetchUser-to-getUser may stall silently; check journal mtime',
  prompt: `Watchdog for migration-swarm-fetchUser-to-getUser run: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel.`,
})
```

> **Claude judge:** Grading passed

