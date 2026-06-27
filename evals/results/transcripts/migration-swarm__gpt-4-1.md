# migration-swarm — `gpt-4.1`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a MIGRATION SWARM: migrate 35 call sites from the deprecated `fetchUser(id)` API to the new `getUser({ id })` API. Each call site is handled by its own subagent in isolation; verify each migration is type-correct; produce a report of which sites migrated, which need manual attention, and why.

---

## Baseline (no skill) — rubric 20%, patterns 25%

````js
```js
export const meta = {
  name: 'migration-swarm',
  description: 'Migrate 35 call sites from fetchUser(id) to getUser({ id }) with type-check verification and reporting.',
  phases: [
    { title: 'Discovery' },
    { title: 'Migration' },
    { title: 'Type Check' },
    { title: 'Reporting' }
  ]
}

// --- Script body starts here ---

// 1. Discovery phase: get the 35 call sites to migrate
phase('Discovery')
log('Discovering 35 call sites using fetchUser(id)...')

const callSites = await agent(
  `
You are a codebase analysis agent. The codebase uses a deprecated API: fetchUser(id).
Your task: List the 35 unique call sites (file path and line number) where fetchUser(id) is called.
Output an array of objects: { file: string, line: number, code: string }.
If you cannot find all 35, list as many as you can.
`,
  {
    label: 'Find fetchUser call sites',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'line', 'code'],
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          code: { type: 'string' }
        }
      },
      minItems: 1,
      maxItems: 35
    }
  }
)

if (!callSites || callSites.length === 0) {
  log('No call sites found. Exiting.')
  return { migrated: [], manual: [], error: 'No call sites found.' }
}

log(`Discovered ${callSites.length} call sites.`)

// 2. Migration phase: migrate each call site in isolation
phase('Migration')
log('Migrating call sites to getUser({ id })...')

const migrationResults = await parallel(
  callSites.map((site, idx) => async () => {
    // Each migration is isolated
    return await agent(
      `
You are a code migration agent. Migrate the following code from using fetchUser(id) to getUser({ id }).
- Only change the fetchUser call at the specified line.
- Do not change unrelated code.
- Ensure the migration is type-correct and preserves logic.
- Output ONLY the migrated code snippet (not the whole file), as a string.

Original code:
${site.code}
`,
      {
        label: `Migrate call site ${idx + 1}`,
        phase: 'Migration',
        isolation: 'worktree',
        schema: { type: 'string' }
      }
    )
  })
)

// 3. Type Check phase: verify each migrated snippet is type-correct
phase('Type Check')
log('Verifying type correctness of migrated call sites...')

const typeCheckResults = await parallel(
  migrationResults.map((migratedCode, idx) => async () => {
    if (!migratedCode) return { typeCorrect: false, error: 'Migration failed or was skipped.' }
    const site = callSites[idx]
    // Ask a subagent to check type correctness
    return await agent(
      `
You are a TypeScript type-checking agent.
Given the following migrated code snippet, check if it is type-correct in its original context.
If type-correct, respond: { "typeCorrect": true }
If not, respond: { "typeCorrect": false, "error": "<brief reason>" }
Migrated code:
${migratedCode}
Original file: ${site.file}, line: ${site.line}
`,
      {
        label: `Type check site ${idx + 1}`,
        phase: 'Type Check',
        schema: {
          type: 'object',
          required: ['typeCorrect'],
          properties: {
            typeCorrect: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    )
  })
)

// 4. Reporting phase: collate results
phase('Reporting')
log('Compiling migration report...')

const migrated = []
const manual = []

for (let i = 0; i < callSites.length; ++i) {
  const site = callSites[i]
  const migratedCode = migrationResults[i]
  const typeCheck = typeCheckResults[i]

  if (!migratedCode) {
    manual.push({
      file: site.file,
      line: site.line,
      original: site.code,
      reason: 'Migration agent failed or was skipped.'
    })
    continue
  }

  if (typeCheck && typeCheck.typeCorrect) {
    migrated.push({
      file: site.file,
      line: site.line,
      migrated: migratedCode
    })
  } else {
    manual.push({
      file: site.file,
      line: site.line,
      original: site.code,
      migrated
````

> **GPT-5.5 judge:** The workflow uses giant parallel() fan-outs over all discovered call sites for both migration and type checking, with no bounded waves, no ScheduleWakeup/stall watchdog, no per-agent retry policy, and no per-wave commits/checkpoints, so a hung subagent or connection could block the whole run and completed work is only collated after hard barriers. It has some limited safety features: schemas cap discovery to 35 items, migration outputs are intended to be lean snippets, type-check/reporting tolerate null migration results, and the final report separates migrated vs manual items. However, it does not provide resume/cache-stable discovery, durable partial-result persistence, high-failure-rate backoff, or robust partial synthesis beyond simple manual flags. Overall it meets only a small fraction of the safe-by-construction bar.

## With skill — rubric 25%, patterns 38%

````js
```js
export const meta = {
  name: 'migrate-fetchUser-to-getUser-swarm',
  description: 'Migrates 35 call sites from fetchUser(id) to getUser({ id }) using agentic swarm, verifies type correctness, and reports results.',
  phases: [
    { title: 'Migrate' },
    { title: 'Verify' },
    { title: 'Synthesize Report' }
  ]
}

// --- CONFIGURATION ---

// List of call sites to migrate. Each item should have a unique, stable key and enough context for migration.
// For real use, fill this array with actual call site info (file, line, code snippet, etc).
const CALL_SITES = [
  // Example entries; replace with real data.
  { key: 'user-profile.js:42', file: 'user-profile.js', line: 42, snippet: 'const user = await fetchUser(id);' },
  { key: 'dashboard.js:88', file: 'dashboard.js', line: 88, snippet: 'fetchUser(userId).then(...);' },
  // ... 33 more ...
  // For demonstration, we'll fill up to 35 with dummy data:
  ...Array.from({ length: 33 }, (_, i) => ({
    key: `file${i + 3}.js:${10 + i}`,
    file: `file${i + 3}.js`,
    line: 10 + i,
    snippet: `const u = fetchUser(someId${i});`
  }))
]

// Schema for the migration agent's output
const MIGRATION_SCHEMA = {
  type: 'object',
  required: ['key', 'migrated_code', 'migration_notes'],
  properties: {
    key: { type: 'string', description: 'Unique key for the call site (file:line)' },
    migrated_code: { type: 'string', description: 'The migrated code snippet using getUser({ id })' },
    migration_notes: { type: 'string', description: 'Short notes on the migration (e.g., assumptions, edge cases, or if manual review is needed)' }
  }
}

// Schema for the verification agent's output
const VERIFICATION_SCHEMA = {
  type: 'object',
  required: ['key', 'type_correct', 'verification_notes'],
  properties: {
    key: { type: 'string', description: 'Unique key for the call site' },
    type_correct: { type: 'boolean', description: 'Whether the migrated code is type-correct' },
    verification_notes: { type: 'string', description: 'Notes on type correctness or issues found' }
  }
}

// --- UTILS ---

const WAVE_SIZE = 7
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }

// --- AGENT RUNNERS ---

// Migration agent: migrate one call site
function runMigration(site) {
  // Prompt is stable (no randomness, no time)
  return agent(
    `You are migrating a JavaScript/TypeScript codebase from the deprecated fetchUser(id) API to the new getUser({ id }) API.

Call site context:
- File: ${site.file}
- Line: ${site.line}
- Original code:
\`\`\`
${site.snippet}
\`\`\`

Instructions:
- Replace fetchUser(id) with getUser({ id }).
- Ensure the migration is correct and idiomatic.
- If the migration is ambiguous or needs manual review, note why.
- Output only the migrated code snippet and a short note.

Return a JSON object matching this schema:
${JSON.stringify(MIGRATION_SCHEMA, null, 2)}
`,
    {
      label: `migrate:${site.key}`,
      phase: 'Migrate',
      schema: MIGRATION_SCHEMA,
      effort: 'medium',
      isolation: 'worktree'
    }
  )
}

// Verification agent: check type correctness of migrated code
function runVerification(migration) {
  if (!migration) return null
  return agent(
    `You are verifying the type correctness of a migrated JavaScript/TypeScript code snippet.

Context:
- Call site key: ${migration.key}
- Migrated code:
\`\`\`
${migration.migrated_code}
\`\`\`

Instructions:
- Check if the code is type-correct (assume standard TypeScript types for getUser).
- If type errors or ambiguities exist, explain them.
- If the migration is not type-correct or needs manual attention, set type_correct to false and explain why.

Return a JSON object matching this schema:
${JSON.stringify(VERIFICATION_SCHEMA, null, 2)}
`,
    {
      label: `verify:${migration.key}`,
      phase: 'Verify',
      schema: VERIFICATION_SCHEMA,
      effort: 'medium',
      isolation: 'work
````

> **GPT-5.5 judge:** The script shows some safety-conscious elements: a WAVE_SIZE of 7 with a chunk helper suggesting bounded waves, stable labels/prompts, and lean JSON schemas for migration and verification outputs. It also has a small null-tolerance check in runVerification. However, the provided workflow is incomplete/truncated and does not demonstrate actual wave execution, per-agent retry handling, per-wave result commits/checkpointing, a ScheduleWakeup stall watchdog, resume/cache-based recovery, partial-input-tolerant synthesis with explicit gap reporting, or backoff on high failure rates. Most importantly, it does not adequately protect against a hung agent deadlocking the run or against loss/truncation of completed work.

