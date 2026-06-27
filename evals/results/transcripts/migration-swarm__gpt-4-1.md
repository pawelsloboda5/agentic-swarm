# migration-swarm — `gpt-4.1`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a MIGRATION SWARM: migrate 35 call sites from the deprecated `fetchUser(id)` API to the new `getUser({ id })` API. Each call site is handled by its own subagent in isolation; verify each migration is type-correct; produce a report of which sites migrated, which need manual attention, and why.

---

## Baseline (no skill) — rubric 18%, patterns 25%

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

// args: { callSites: Array<{ id: string, file: string, code: string }> }
// Each call site: { id: unique id, file: filename, code: code snippet containing fetchUser(id) }

if (!args || !Array.isArray(args.callSites) || args.callSites.length !== 35) {
  throw new Error('Expected args.callSites to be an array of 35 call site objects.');
}

phase('Discovery');
log(`Discovered ${args.callSites.length} call sites using deprecated fetchUser(id).`);

const callSites = args.callSites;

// Helper: migration agent prompt
function migrationPrompt(callSite) {
  return `
You are migrating a call site from the deprecated API fetchUser(id) to the new API getUser({ id }).
- The old usage is: fetchUser(id)
- The new usage is: getUser({ id })
- The function signature for getUser is: getUser({ id: string }): Promise<User>
- Update ONLY the relevant call site code, preserving all other logic/context.
- Do not change unrelated code.
- Output ONLY the updated code snippet, ready to replace the original.

Original code:
\`\`\`js
${callSite.code}
\`\`\`
`;
}

// Helper: type-check agent prompt
function typeCheckPrompt(migratedCode, file) {
  return `
You are a TypeScript type checker. Given the following code snippet (from file: ${file}), check if it is type-correct.
- If type errors exist, list them precisely.
- If type-correct, reply "TYPE_CORRECT".
- Do not suggest further edits.

Code to check:
\`\`\`js
${migratedCode}
\`\`\`
`;
}

// Helper: reporting schema
const reportSchema = {
  type: 'object',
  required: ['siteId', 'file', 'status', 'reason', 'migratedCode'],
  properties: {
    siteId: { type: 'string' },
    file: { type: 'string' },
    status: { type: 'string', enum: ['migrated', 'manual_attention'] },
    reason: { type: 'string' },
    migratedCode: { type: 'string' }
  }
};

phase('Migration');
log('Starting migration of all call sites in parallel.');

const migrationResults = await parallel(
  callSites.map((site, idx) => async () => {
    // Each call site handled in isolation
    const migratedCode = await agent(
      migrationPrompt(site),
      {
        label: `Migrate site ${site.id}`,
        phase: 'Migration',
        isolation: 'worktree',
        effort: 'medium',
        model: 'claude-3-opus-20240229'
      }
    );
    return { ...site, migratedCode };
  })
);

phase('Type Check');
log('Verifying type correctness of migrated code.');

const typeCheckResults = await parallel(
  migrationResults.map((result, idx) => async () => {
    if (!result || !result.migratedCode) return null;
    const typeCheck = await agent(
      typeCheckPrompt(result.migratedCode, result.file),
      {
        label: `Type check site ${result.id}`,
        phase: 'Type Check',
        effort: 'low',
        model: 'claude-3-opus-20240229'
      }
    );
    return { ...result, typeCheck };
  })
);

phase('Reporting');
log('Compiling migration report.');

const reportItems = await parallel(
  typeCheckResults.map((result, idx) => async () => {
    if (!result) {
      // Migration agent failed or was skipped
      return {
        siteId: callSites[idx].id,
        file: callSites[idx].file,
        status: 'manual_attention',
        reason: 'Migration agent failed or returned no result.',
        migratedCode: ''
      };
    }
    if (!result.migratedCode) {
      return {
        siteId: result.id,
        file: result.file,
        status: 'manual_attention',
        reason: 'No migrated code produced.',
        migratedCode: ''
      };
    }
    if (!result.typeCheck) {
      return {
        siteId: result.id,
        file: result.file,
        status: 'manual_attention',
        reason: 'Type check agent failed or returned no result.',
        migratedCode: result.migratedCode
      };
    }
    if (typeof result.typeCheck === 'string' && result.typeCheck.trim() === 'TYPE_CORRECT') {
      return {
        siteId: result.id,
        file: result.file,
        status: 'migrated',
        reason: 'Migration and type check successful.',
        migratedCode: result.migratedCode
      };
    } else {
      return {
        siteId: result.id,
        file: result.file,
        status: 'manual_attention',
        reason: `Type check failed: ${result.typeCheck}`,
        migratedCode: result.migratedCode
      };
    }
  })
);

// Validate and filter report items
const finalReport = [];
for (const item of reportItems) {
  if (!item) continue;
  // Validate against schema
  try {
    const validated = await agent(
      `Validate the following object against this JSON schema. If valid, return the object unchanged. If not, return an object with status "manual_attention" and a reason describing the schema error.
Schema:
${JSON.stringify(reportSchema, null, 2)}

Object:
${JSON.stringify(item, null, 2)}
`,
      { schema: reportSchema, label: 'Validate report item', effort: 'low', phase: 'Reporting' }
    );
    finalReport.push(validated || item);
  } catch (e) {
    finalReport.push({
      siteId: item.siteId || 'unknown',
      file: item.file || 'unknown',
      status: 'manual_attention',
      reason: `Schema validation error: ${e.message}`,
      migratedCode: item.migratedCode || ''
    });
  }
}

log('Migration swarm complete. See report for details.');

return {
  summary: {
    total: finalReport.length,
    migrated: finalReport.filter(r => r.status === 'migrated').length,
    manual_attention: finalReport.filter(r => r.status === 'manual_attention').length
  },
  report: finalReport
};
```

> **Claude judge:** The script fans out all 35 agents in a single unbounded parallel() call with no wave bounding (~6-8 items), no per-agent retry or timeout/watchdog, no per-wave result commits (all three phases are hard barriers), no ScheduleWakeup stall detection, no backoff on high failure rates, and no cache-stable/resume-friendly prompts. It does have partial null-tolerance in the reporting phase and a lean schema, but the core safety-by-construction properties are largely absent.

## With skill — rubric 88%, patterns 94%

```js
export const meta = {
  name: 'migrate-fetchUser-to-getUser-swarm',
  description: 'Migrates 35 call sites from fetchUser(id) to getUser({ id }) using agentic swarm; verifies type correctness and reports results.',
  phases: [
    { title: 'Migrate' },
    { title: 'Verify' },
    { title: 'Synthesize Report' }
  ]
}

// --- CONFIGURATION ---

// List of 35 call sites to migrate. Each item should have a unique, stable key and enough context for migration.
// For demo, we use placeholder objects; in production, fill with real file/line/code context.
const CALL_SITES = [
  // Example:
  // { key: 'userService.js:42', file: 'userService.js', line: 42, code: 'const user = await fetchUser(id);' },
  // ... 34 more ...
  // For brevity, we'll generate 35 dummy call sites:
  ...Array.from({ length: 35 }, (_, i) => ({
    key: `file${i + 1}.js:${10 + i * 3}`,
    file: `file${i + 1}.js`,
    line: 10 + i * 3,
    code: `const user = await fetchUser(id${i + 1});`
  }))
]

// Output schema for each migration agent
const MIGRATION_SCHEMA = {
  type: 'object',
  required: ['key', 'migrated_code', 'type_check_passed', 'needs_manual_attention', 'reason'],
  properties: {
    key: { type: 'string', description: 'Unique call site key (file:line)' },
    migrated_code: { type: 'string', description: 'The migrated code snippet, or empty string if not migrated.' },
    type_check_passed: { type: 'boolean', description: 'True if the migrated code is type-correct.' },
    needs_manual_attention: { type: 'boolean', description: 'True if the migration could not be completed automatically or type check failed.' },
    reason: { type: 'string', description: 'Short explanation if manual attention is needed, or "ok" if migration succeeded.' }
  }
}

// --- UTILS ---

const WAVE_SIZE = 7
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }

// Stable prompt builder for each call site
function buildMigrationPrompt(site) {
  return `
You are migrating a JavaScript/TypeScript codebase from the deprecated API fetchUser(id) to the new API getUser({ id }).
For the following call site, rewrite the code to use getUser({ id }) instead of fetchUser(id).
- Ensure the migration is type-correct (assume TypeScript type checking).
- If the migration cannot be performed automatically (e.g., complex usage, dynamic arguments, or ambiguous context), flag it for manual attention and explain why.
- If the migration is successful, return the migrated code snippet.
- If type checking would fail, flag for manual attention and explain.
- Do NOT change unrelated code.
- Your output must fill the provided schema.

Call site context:
File: ${site.file}
Line: ${site.line}
Original code:
${site.code}

Return a JSON object with:
- key: "${site.key}"
- migrated_code: (string, the migrated code or empty string if not migrated)
- type_check_passed: (boolean)
- needs_manual_attention: (boolean)
- reason: (short string: "ok" or explanation)
`
}

// --- MAIN SWARM LOGIC ---

const waves = chunk(CALL_SITES, WAVE_SIZE)
const done = []
let failed = []

// Single source of truth for running one migration agent
async function runMigration(site) {
  return agent(buildMigrationPrompt(site), {
    label: `migrate:${site.key}`,
    phase: 'Migrate',
    schema: MIGRATION_SCHEMA,
    effort: 'medium',
    isolation: 'worktree'
  })
}

// --- SWARM EXECUTION ---

for (let w = 0; w < waves.length; w++) {
  phase(`Wave ${w + 1}/${waves.length}`)
  log(`Launching migration agents for wave ${w + 1}/${waves.length}...`)
  const batch = await parallel(waves[w].map(site => () => runMigration(site)))
  batch.forEach((result, i) => (result ? done.push(result) : failed.push(waves[w][i])))
  log(`Wave ${w + 1}: ${done.length}/${CALL_SITES.length} migrated, ${failed.length} to retry`)
  // Instability backoff: if too many nulls, stop and resume later
  const nulls = batch.filter(r => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`⚠ instability: ${nulls}/${batch.length} failed this wave — backing off. Returning partial; resume later.`)
    break
  }
}

// Retry wave for failed agents (natural backoff = elapsed time)
if (failed.length) {
  phase('Retry')
  log(`Retrying ${failed.length} failed migrations...`)
  const retried = await parallel(failed.map(site => () => runMigration(site)))
  const stillFailed = []
  retried.forEach((result, i) => (result ? done.push(result) : stillFailed.push(failed[i])))
  failed = stillFailed
  log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

// --- SYNTHESIS PHASE ---

phase('Synthesize Report')

// Compute missing call sites (never migrated)
const haveKeys = new Set(done.map(r => r.key))
const missing = CALL_SITES.filter(site => !haveKeys.has(site.key)).map(site => site.key)
if (missing.length) log(`⚠ partial: missing ${missing.length}/${CALL_SITES.length}: ${missing.join(', ')}`)

// Partition results
const migrated = []
const manual = []
for (const r of done) {
  if (r && !r.needs_manual_attention && r.type_check_passed) {
    migrated.push({ key: r.key, migrated_code: r.migrated_code })
  } else if (r) {
    manual.push({
      key: r.key,
      reason: r.reason,
      original_code: CALL_SITES.find(s => s.key === r.key)?.code ?? ''
    })
  }
}

// Synthesis prompt embeds the sorted results for deterministic resume
const synthPayload = JSON.stringify({
  migrated: migrated.sort((a, b) => a.key.localeCompare(b.key)),
  manual: manual.sort((a, b) => a.key.localeCompare(b.key)),
  missing: missing.sort()
})

const report = await agent(
  `You are to produce a migration report for a codebase that is migrating from fetchUser(id) to getUser({ id }).
You are given:
- migrated: array of { key, migrated_code } for call sites migrated automatically and type-checked.
- manual: array of { key, reason, original_code } for call sites needing manual attention.
- missing: array of call site keys for which no result was returned.

For the report:
- List all migrated call sites (file:line), with the migrated code.
- List all call sites needing manual attention, with the reason and original code.
- List any missing call sites (no result).
- At the top, summarize: how many migrated, how many need manual attention, how many missing.
- Be concise and clear.

Input data:
${synthPayload}
`,
  {
    label: 'synthesize-report',
    phase: 'Synthesize Report',
    effort: 'high'
  }
)

// --- RETURN ---

return {
  migrated,
  manual_attention: manual,
  missing,
  report
}

// --- ARM WATCHDOG (Pattern 4) ---
// (This is NOT part of the script body, but must be armed at the agent level after launch.)
// ScheduleWakeup({
//   delaySeconds: 1200,
//   reason: "watchdog: swarm wf_<id> may stall silently; check journal mtime",
//   prompt: "Watchdog for run wf_<id>: if the journal mtime is >20 min old AND the workflow task is not 'completed', TaskStop the task then resume via Workflow({scriptPath, resumeFromRunId}); else re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
// })
```

> **Claude judge:** The script implements all eight safety properties: bounded 7-item waves, per-agent null-tolerance with a retry wave, per-wave result commits, deterministic prompts, a lean output schema, gap-flagging synthesis, and a >40% failure-rate backoff. The only gap is the ScheduleWakeup watchdog appearing only as a comment rather than an actual call, making it dependent on external arming and thus partial.

