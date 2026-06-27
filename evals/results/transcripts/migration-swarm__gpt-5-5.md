# migration-swarm — `gpt-5.5`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a MIGRATION SWARM: migrate 35 call sites from the deprecated `fetchUser(id)` API to the new `getUser({ id })` API. Each call site is handled by its own subagent in isolation; verify each migration is type-correct; produce a report of which sites migrated, which need manual attention, and why.

---

## Baseline (no skill) — rubric 25%, patterns 38%

```js
export const meta = {
  name: 'migration-swarm-fetchUser-to-getUser',
  description:
    'Migrate 35 call sites from deprecated fetchUser(id) to getUser({ id }) using isolated per-site subagents, verify type correctness, and report outcomes.',
  phases: [
    { title: 'Discover call sites' },
    { title: 'Migrate in isolation' },
    { title: 'Verify migrations' },
    { title: 'Integrate verified changes' },
    { title: 'Final validation and report' },
  ],
}

const DISCOVERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['callSites', 'summary'],
  properties: {
    summary: { type: 'string' },
    callSites: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'siteId',
          'file',
          'line',
          'column',
          'currentExpression',
          'surroundingCode',
          'importOrRequireContext',
          'confidence',
          'notes',
        ],
        properties: {
          siteId: {
            type: 'string',
            description:
              'Stable unique id, preferably derived from file path and source location.',
          },
          file: { type: 'string' },
          line: { type: 'integer', minimum: 1 },
          column: { type: 'integer', minimum: 1 },
          currentExpression: {
            type: 'string',
            description: 'The exact fetchUser(...) expression or call statement found.',
          },
          surroundingCode: {
            type: 'string',
            description: 'Small code excerpt sufficient to relocate the call site.',
          },
          importOrRequireContext: {
            type: 'string',
            description:
              'Relevant import/require lines for fetchUser/getUser in this file, if any.',
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          notes: { type: 'string' },
        },
      },
    },
  },
}

const MIGRATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'siteId',
    'file',
    'status',
    'changedFiles',
    'patch',
    'verificationCommands',
    'verificationSummary',
    'manualAttentionReason',
    'notes',
  ],
  properties: {
    siteId: { type: 'string' },
    file: { type: 'string' },
    status: {
      type: 'string',
      enum: ['migrated', 'manual_attention'],
    },
    changedFiles: {
      type: 'array',
      items: { type: 'string' },
    },
    patch: {
      type: 'string',
      description:
        'Unified git diff for the isolated worktree changes. Empty if no safe migration was made.',
    },
    verificationCommands: {
      type: 'array',
      items: { type: 'string' },
    },
    verificationSummary: {
      type: 'string',
      description:
        'Summary of local checks run by the migration subagent and whether they passed.',
    },
    manualAttentionReason: {
      type: 'string',
      description:
        'Empty when status=migrated. Required explanation when status=manual_attention.',
    },
    notes: { type: 'string' },
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'siteId',
    'file',
    'status',
    'typeCorrect',
    'commandsRun',
    'evidence',
    'manualAttentionReason',
    'notes',
  ],
  properties: {
    siteId: { type: 'string' },
    file: { type: 'string' },
    status: {
      type: 'string',
      enum: ['verified', 'failed_verification', 'manual_attention'],
    },
    typeCorrect: { type: 'boolean' },
    commandsRun: {
      type: 'array',
      items: { type: 'string' },
    },
    evidence: {
      type: 'string',
      description:
        'Concise evidence from static checks/tests showing whether the migration is type-correct.',
    },
    manualAttentionReason: {
      type: 'string',
      description:
        'Empty when status=verified. Explanation when verification failed or needs manual work.',
    },
    notes: { type: 'string' },
  },
}

const INTEGRATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'applied',
    'notApplied',
    'commandsRun',
    'finalTypecheckPassed',
    'finalTypecheckEvidence',
    'notes',
  ],
  properties: {
    applied: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['siteId', 'file', 'summary'],
        properties: {
          siteId: { type: 'string' },
          file: { type: 'string' },
          summary: { type: 'string' },
        },
      },
    },
    notApplied: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['siteId', 'file', 'reason'],
        properties: {
          siteId: { type: 'string' },
          file: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    commandsRun: {
      type: 'array',
      items: { type: 'string' },
    },
    finalTypecheckPassed: { type: 'boolean' },
    finalTypecheckEvidence: { type: 'string' },
    notes: { type: 'string' },
  },
}

const FINAL_REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['markdownReport'],
  properties: {
    markdownReport: { type: 'string' },
  },
}

const expectedCount =
  typeof args?.expectedCount === 'number' && args.expectedCount > 0
    ? Math.floor(args.expectedCount)
    : 35

const typecheckHint =
  typeof args?.typecheckCommand === 'string' && args.typecheckCommand.trim()
    ? args.typecheckCommand.trim()
    : 'Infer and run the repository’s normal TypeScript/type-check command, such as npm run typecheck, pnpm typecheck, yarn typecheck, npx tsc --noEmit, or the closest equivalent.'

const testHint =
  typeof args?.testCommand === 'string' && args.testCommand.trim()
    ? args.testCommand.trim()
    : 'Run the smallest relevant test or compile check when available; otherwise explain why only type-checking was possible.'

const userProvidedSites = Array.isArray(args?.callSites) ? args.callSites : null

phase('Discover call sites')
log(
  userProvidedSites
    ? `Using ${userProvidedSites.length} user-provided call site(s).`
    : `Discovering fetchUser(id) call sites; expected count is ${expectedCount}.`,
)

let discovered

if (userProvidedSites) {
  discovered = {
    summary: `Received ${userProvidedSites.length} call site(s) from workflow args.`,
    callSites: userProvidedSites.map((site, index) => ({
      siteId:
        typeof site.siteId === 'string' && site.siteId
          ? site.siteId
          : `provided-site-${index + 1}`,
      file: String(site.file || ''),
      line: Number.isInteger(site.line) && site.line > 0 ? site.line : 1,
      column: Number.isInteger(site.column) && site.column > 0 ? site.column : 1,
      currentExpression: String(site.currentExpression || 'fetchUser(...)'),
      surroundingCode: String(site.surroundingCode || ''),
      importOrRequireContext: String(site.importOrRequireContext || ''),
      confidence:
        site.confidence === 'medium' || site.confidence === 'low'
          ? site.confidence
          : 'high',
      notes: String(site.notes || 'Provided by workflow args.'),
    })),
  }
} else {
  discovered = await agent(
    `
You are the discovery coordinator for a code migration.

Goal:
Find every call site of the deprecated API:

  fetchUser(id)

that must be migrated to:

  getUser({ id })

Repository task:
1. Search the repo thoroughly for actual runtime call sites of fetchUser.
2. Include direct calls, imported aliases only if you can confidently prove they reference fetchUser, and calls in tests if they are part of the repo source that must compile.
3. Exclude definitions/declarations of fetchUser, comments, docs-only mentions, changelogs, and unrelated identifiers.
4. For each call site, capture enough location and code context for another isolated agent to modify exactly that site.
5. Pay attention to imports/requires: migration may require replacing fetchUser imports with getUser imports or adding getUser while preserving other imports.
6. Expected number of call sites: ${expectedCount}. If you find a different number, still return all real call sites and explain the discrepancy in summary.

Return strictly the schema object.
`,
    {
      label: 'discover-fetchUser-call-sites',
      phase: 'Discover call sites',
      schema: DISCOVERY_SCHEMA,
      effort: 'high',
    },
  )
}

if (!discovered || !Array.isArray(discovered.callSites)) {
  discovered = {
    summary:
      'Discovery failed or was skipped. No migrations can be performed automatically.',
    callSites: [],
  }
}

const siteKey = site =>
  `${site.file || ''}:${String(site.line || '')}:${String(site.column || '')}:${
    site.siteId || ''
  }`

const callSites = discovered.callSites
  .slice()
  .sort((a, b) => siteKey(a).localeCompare(siteKey(b)))
  .map((site, index) => ({
    ...site,
    siteId: site.siteId || `site-${index + 1}`,
  }))

log(`Discovery complete: ${callSites.length} call site(s) found.`)

if (callSites.length !== expectedCount) {
  log(
    `Expected ${expectedCount} call site(s), but discovery found ${callSites.length}. Continuing with discovered sites and reporting the mismatch.`,
  )
}

phase('Migrate in isolation')

const migrationResults = await pipeline(
  callSites,
  async (site, originalSite, index) => {
    log(
      `Migrating ${index + 1}/${callSites.length}: ${site.siteId} in ${site.file}`,
    )

    return await agent(
      `
You are one isolated migration worker in a migration swarm.

You are responsible for exactly ONE call site. Do not modify unrelated call sites.

Migration:
- Deprecated API: fetchUser(id)
- New API: getUser({ id })
- Preserve existing behavior, async/await behavior, error handling, and surrounding control flow.
- If the old call is fetchUser(userId), migrate to getUser({ id: userId }).
- If the argument expression is already named id, getUser({ id }) is acceptable.
- If fetchUser is imported/required in the file and no longer needed after your single-site change, update imports safely.
- If other fetchUser call sites remain in the same file, keep fetchUser imported for them.
- If getUser is not imported/required, add it from the same module that supplied fetchUser unless repository conventions clearly indicate otherwise.
- Make the smallest safe change.
- Work only in your isolated worktree.

Call site:
${JSON.stringify(site, null, 2)}

Verification requirements:
- After editing, run formatting/linting only if this repo normally requires it and it is safe.
- Verify the migration is type-correct.
- Type-check instruction: ${typecheckHint}
- Test instruction: ${testHint}
- If full type-check is too expensive or blocked, run the narrowest reliable static check and explain.
- If the call site is ambiguous, generated code, dynamically aliased, has incompatible types, or cannot be safely migrated in isolation, do not guess. Return manual_attention with a clear reason.

Output:
- Return a unified git diff in "patch" containing all changes you made.
- If you made no safe change, patch must be empty and status must be manual_attention.
- The patch should be suitable for later application to the main worktree.
- Return strictly the schema object.
`,
      {
        label: `migrate-${site.siteId}`,
        phase: 'Migrate in isolation',
        schema: MIGRATION_SCHEMA,
        isolation: 'worktree',
        effort: 'high',
      },
    )
  },
  async (migration, site, index) => {
    if (!migration) {
      return {
        site,
        migration: {
          siteId: site.siteId,
          file: site.file,
          status: 'manual_attention',
          changedFiles: [],
          patch: '',
          verificationCommands: [],
          verificationSummary:
            'Migration subagent failed, was skipped, or hit a terminal API error.',
          manualAttentionReason:
            'No migration result was produced for this call site.',
          notes: '',
        },
        verification: {
          siteId: site.siteId,
          file: site.file,
          status: 'manual_attention',
          typeCorrect: false,
          commandsRun: [],
          evidence: 'No migration patch was available to verify.',
          manualAttentionReason:
            'Migration subagent did not produce a usable result.',
          notes: '',
        },
      }
    }

    if (migration.status !== 'migrated' || !migration.patch.trim()) {
      return {
        site,
        migration,
        verification: {
          siteId: site.siteId,
          file: site.file,
          status: 'manual_attention',
          typeCorrect: false,
          commandsRun: migration.verificationCommands || [],
          evidence:
            migration.verificationSummary ||
            'Migration worker marked this site for manual attention.',
          manualAttentionReason:
            migration.manualAttentionReason ||
            'Migration worker did not produce a patch.',
          notes: migration.notes || '',
        },
      }
    }

    phase('Verify migrations')
    log(
      `Verifying ${index + 1}/${callSites.length}: ${site.siteId} in ${site.file}`,
    )

    const verification = await agent(
      `
You are an independent verification worker.

You are verifying exactly ONE proposed migration from fetchUser(id) to getUser({ id }).

Call site:
${JSON.stringify(site, null, 2)}

Migration result:
${JSON.stringify(migration, null, 2)}

Patch to verify:
${migration.patch}

Instructions:
1. In your isolated worktree, apply the provided patch to a clean checkout.
2. Confirm the intended call site was changed from fetchUser(...) to getUser({ id: ... }) or getUser({ id }) as appropriate.
3. Confirm no unrelated call sites were accidentally migrated by this patch.
4. Confirm imports/requires remain correct:
   - getUser is imported/required from the correct module.
   - fetchUser remains only if still used in that file.
5. Verify type correctness.
   Type-check instruction: ${typecheckHint}
6. Run the smallest relevant test/compile check when useful.
   Test instruction: ${testHint}
7. If the patch does not apply cleanly, does not type-check, changes the wrong code, or is semantically questionable, mark failed_verification or manual_attention and explain why.

Return strictly the schema object.
`,
      {
        label: `verify-${site.siteId}`,
        phase: 'Verify migrations',
        schema: VERIFY_SCHEMA,
        isolation: 'worktree',
        effort: 'high',
      },
    )

    return {
      site,
      migration,
      verification:
        verification || {
          siteId: site.siteId,
          file: site.file,
          status: 'failed_verification',
          typeCorrect: false,
          commandsRun: [],
          evidence:
            'Verification subagent failed, was skipped, or hit a terminal API error.',
          manualAttentionReason:
            'Could not independently verify this migration patch.',
          notes: '',
        },
    }
  },
)

const perSiteResults = migrationResults.filter(Boolean)

const verifiedResults = perSiteResults.filter(
  result =>
    result.verification &&
    result.verification.status === 'verified' &&
    result.verification.typeCorrect === true &&
    result.migration &&
    result.migration.status === 'migrated' &&
    typeof result.migration.patch === 'string' &&
    result.migration.patch.trim(),
)

const manualOrFailedResults = perSiteResults.filter(
  result => !verifiedResults.some(v => v.site.siteId === result.site.siteId),
)

log(
  `Per-site verification complete: ${verifiedResults.length} verified, ${manualOrFailedResults.length} needing manual attention or failed verification.`,
)

phase('Integrate verified changes')

let integration

if (verifiedResults.length === 0) {
  integration = {
    applied: [],
    notApplied: [],
    commandsRun: [],
    finalTypecheckPassed: false,
    finalTypecheckEvidence:
      'No verified migration patches were available to apply.',
    notes: 'Integration skipped.',
  }
} else {
  integration = await agent(
    `
You are the integration worker for a migration swarm.

Goal:
Apply all independently verified patches to the main working tree, preserving correctness.

Important:
- Apply only patches whose verification status is verified and typeCorrect=true.
- Apply patches carefully, one at a time.
- If a patch conflicts or no longer applies, do not force it. Record that site as notApplied with the reason.
- After applying all clean patches, run the repository type-check.
- Type-check instruction: ${typecheckHint}
- Run relevant tests if practical: ${testHint}
- Do not apply patches for manual_attention or failed_verification sites.

Verified patch set:
${JSON.stringify(
  verifiedResults.map(result => ({
    site: result.site,
    migration: result.migration,
    verification: result.verification,
  })),
  null,
  2,
)}

Manual/failed sites to leave untouched:
${JSON.stringify(
  manualOrFailedResults.map(result => ({
    site: result.site,
    migration: result.migration,
    verification: result.verification,
  })),
  null,
  2,
)}

Return strictly the schema object.
`,
    {
      label: 'integrate-verified-migrations',
      phase: 'Integrate verified changes',
      schema: INTEGRATION_SCHEMA,
      effort: 'high',
    },
  )
}

if (!integration) {
  integration = {
    applied: [],
    notApplied: verifiedResults.map(result => ({
      siteId: result.site.siteId,
      file: result.site.file,
      reason:
        'Integration worker failed, was skipped, or hit a terminal API error.',
    })),
    commandsRun: [],
    finalTypecheckPassed: false,
    finalTypecheckEvidence:
      'Integration did not complete, so final type correctness could not be established.',
    notes: '',
  }
}

phase('Final validation and report')

const report = await agent(
  `
You are the reporting coordinator for a migration swarm.

Create a concise but complete Markdown report for the user.

Migration target:
- Deprecated: fetchUser(id)
- New: getUser({ id })
- Expected call sites: ${expectedCount}
- Discovered call sites: ${callSites.length}

Discovery summary:
${discovered.summary}

Per-site results:
${JSON.stringify(perSiteResults, null, 2)}

Integration result:
${JSON.stringify(integration, null, 2)}

Report requirements:
1. Start with an executive summary.
2. Include counts:
   - discovered
   - expected
   - migrated by isolated worker
   - independently type-verified
   - applied to main worktree
   - needing manual attention
   - integration not applied
   - final type-check pass/fail
3. Include a table of successfully migrated/applied sites with file, site id, and evidence.
4. Include a table of sites needing manual attention, with file, site id, exact reason, and recommended next action.
5. Include any discovery count mismatch warning.
6. Include final validation commands/evidence.
7. Be explicit if some verified patches could not be integrated.
8. Do not claim success for any site that was not applied to the main worktree.
9. Keep the report actionable.

Return strictly the schema object.
`,
  {
    label: 'final-migration-report',
    phase: 'Final validation and report',
    schema: FINAL_REPORT_SCHEMA,
    effort: 'medium',
  },
)

log(report ? report.markdownReport : 'Final report generation failed.')
report ? report.markdownReport : 'Final report generation failed.'
```

> **GPT-5.5 judge:** The workflow has some partial-safety features: it uses strict schemas, handles null/failed subagent results for migration/verification/integration/reporting, and the final synthesis explicitly reports manual/failed/unapplied sites rather than claiming success. However, it uses a single pipeline over all discovered call sites with no explicit bounded wave size, no armed ScheduleWakeup/stall watchdog, no per-agent retry policy, no per-wave durable commits/checkpoints, no resume/cache-stable discovery mechanism, and no backoff when many sites fail. It also carries full patches/results through later JSON prompts, which risks large/truncated outputs. Overall it is heavily vulnerable to a hung connection stalling the run and to completed work being lost or truncated before integration.

## With skill — rubric 84%, patterns 88%

```js
export const meta = {
  name: 'migration-swarm-fetchuser-to-getuser',
  description: 'Safely migrate fetchUser(id) call sites to getUser({ id }) with isolated per-site agents, verification, integration, and reporting.',
  phases: [
    { title: 'Preflight' },
    { title: 'Discover' },
    { title: 'Migrate' },
    { title: 'Retry' },
    { title: 'Integrate' },
    { title: 'Report' },
  ],
}

/*
After launching this workflow, arm the required one-shot stall watchdog from the
surrounding agent context, replacing wf_<id>, <taskId>, and <path> with the
Workflow launch result:

ScheduleWakeup({
  delaySeconds: 1200,
  reason: "watchdog: swarm wf_<id> may stall silently; check journal mtime",
  prompt: "Watchdog for swarm run wf_<id> (task <taskId>, journal at <path>): if the journal mtime is older than 20 min AND the workflow task is not 'completed', TaskStop the task then resume with Workflow({scriptPath, resumeFromRunId}). Otherwise re-arm another 1200s ScheduleWakeup. Do NOT use the autonomous-loop sentinel — this is a plain one-shot watchdog, not a /loop."
})
*/

const WAVE_SIZE = Number.isInteger(args?.waveSize) && args.waveSize >= 1 && args.waveSize <= 8 ? args.waveSize : 6
const EXPECTED_COUNT = Number.isInteger(args?.expectedCount) ? args.expectedCount : 35
const SHOULD_INTEGRATE = args?.integrate === false || args?.reportOnly === true ? false : true
const INTEGRATE_UNVERIFIED = args?.integrateUnverified === true
const SCOPE = typeof args?.scope === 'string' && args.scope.trim() ? args.scope.trim() : 'the current repository'
const TYPECHECK_HINT = typeof args?.typecheckCommand === 'string' && args.typecheckCommand.trim()
  ? args.typecheckCommand.trim()
  : ''

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
}

function sanitizeLabel(s) {
  return String(s || 'unknown')
    .replace(/[^a-zA-Z0-9._/-]+/g, '-')
    .slice(0, 80)
}

function normalizeSite(raw, index) {
  const file = String(raw?.file || raw?.path || '').trim()
  const line = Number.isInteger(raw?.line) ? raw.line : (
    Number.isInteger(raw?.startLine) ? raw.startLine : 0
  )
  const column = Number.isInteger(raw?.column) ? raw.column : (
    Number.isInteger(raw?.startColumn) ? raw.startColumn : 0
  )
  const explicitKey = typeof raw?.key === 'string' && raw.key.trim() ? raw.key.trim() : ''
  const key = explicitKey || `${file || 'unknown-file'}:${line || 0}:${column || 0}:fetchUser:${index + 1}`
  return {
    key,
    file,
    line,
    column,
    snippet: typeof raw?.snippet === 'string' ? raw.snippet.slice(0, 1200) : '',
    importHint: typeof raw?.importHint === 'string' ? raw.importHint.slice(0, 500) : '',
    notes: typeof raw?.notes === 'string' ? raw.notes.slice(0, 1000) : '',
  }
}

function dedupeAndSortSites(sites) {
  const byKey = new Map()
  sites.forEach((site, i) => {
    const normalized = normalizeSite(site, i)
    if (!byKey.has(normalized.key)) byKey.set(normalized.key, normalized)
  })
  return [...byKey.values()].sort((a, b) => a.key > b.key ? 1 : a.key < b.key ? -1 : 0)
}

const CALL_SITE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['key', 'file', 'line', 'column', 'snippet', 'importHint', 'notes'],
  properties: {
    key: { type: 'string' },
    file: { type: 'string' },
    line: { type: 'integer' },
    column: { type: 'integer' },
    snippet: { type: 'string', maxLength: 1200 },
    importHint: { type: 'string', maxLength: 500 },
    notes: { type: 'string', maxLength: 1000 },
  },
}

const DISCOVERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['callSites', 'warnings'],
  properties: {
    callSites: {
      type: 'array',
      maxItems: 80,
      items: CALL_SITE_SCHEMA,
    },
    warnings: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string', maxLength: 500 },
    },
  },
}

const MIGRATION_RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'key',
    'file',
    'status',
    'summary',
    'changedFiles',
    'verification',
    'manualAttention',
    'risk',
    'diff',
  ],
  properties: {
    key: { type: 'string' },
    file: { type: 'string' },
    status: {
      type: 'string',
      enum: [
        'migrated',
        'already_migrated',
        'manual_attention',
        'not_found',
        'skipped',
      ],
    },
    summary: { type: 'string', maxLength: 1200 },
    changedFiles: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string', maxLength: 300 },
    },
    verification: {
      type: 'object',
      additionalProperties: false,
      required: ['typecheck', 'commands', 'evidence'],
      properties: {
        typecheck: {
          type: 'string',
          enum: ['passed', 'failed', 'not_run', 'unrelated_failures'],
        },
        commands: {
          type: 'array',
          maxItems: 5,
          items: { type: 'string', maxLength: 300 },
        },
        evidence: { type: 'string', maxLength: 1500 },
      },
    },
    manualAttention: {
      type: 'object',
      additionalProperties: false,
      required: ['needed', 'reason'],
      properties: {
        needed: { type: 'boolean' },
        reason: { type: 'string', maxLength: 1500 },
      },
    },
    risk: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
    diff: {
      type: 'string',
      maxLength: 12000,
      description: 'Unified diff for this call-site-only migration, or empty string if no automatic change is safe.',
    },
  },
}

const INTEGRATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['applied', 'changedFiles', 'verification', 'notes'],
  properties: {
    applied: {
      type: 'array',
      maxItems: 80,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'status', 'reason'],
        properties: {
          key: { type: 'string' },
          status: {
            type: 'string',
            enum: ['applied', 'already_present', 'conflict', 'skipped_manual', 'failed'],
          },
          reason: { type: 'string', maxLength: 1000 },
        },
      },
    },
    changedFiles: {
      type: 'array',
      maxItems: 80,
      items: { type: 'string', maxLength: 300 },
    },
    verification: {
      type: 'object',
      additionalProperties: false,
      required: ['typecheck', 'commands', 'evidence'],
      properties: {
        typecheck: {
          type: 'string',
          enum: ['passed', 'failed', 'not_run', 'unrelated_failures'],
        },
        commands: {
          type: 'array',
          maxItems: 8,
          items: { type: 'string', maxLength: 300 },
        },
        evidence: { type: 'string', maxLength: 2000 },
      },
    },
    notes: { type: 'string', maxLength: 3000 },
  },
}

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'migrated',
    'manualAttention',
    'missing',
    'verification',
    'reportMarkdown',
  ],
  properties: {
    summary: {
      type: 'object',
      additionalProperties: false,
      required: [
        'expectedCallSites',
        'identifiedCallSites',
        'workerResults',
        'migratedCount',
        'manualAttentionCount',
        'missingCount',
        'integrated',
      ],
      properties: {
        expectedCallSites: { type: 'integer' },
        identifiedCallSites: { type: 'integer' },
        workerResults: { type: 'integer' },
        migratedCount: { type: 'integer' },
        manualAttentionCount: { type: 'integer' },
        missingCount: { type: 'integer' },
        integrated: { type: 'boolean' },
      },
    },
    migrated: {
      type: 'array',
      maxItems: 80,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'file', 'status', 'verification', 'integrationStatus', 'notes'],
        properties: {
          key: { type: 'string' },
          file: { type: 'string' },
          status: { type: 'string' },
          verification: { type: 'string', maxLength: 500 },
          integrationStatus: { type: 'string', maxLength: 500 },
          notes: { type: 'string', maxLength: 1000 },
        },
      },
    },
    manualAttention: {
      type: 'array',
      maxItems: 80,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'file', 'reason', 'workerStatus'],
        properties: {
          key: { type: 'string' },
          file: { type: 'string' },
          reason: { type: 'string', maxLength: 1500 },
          workerStatus: { type: 'string' },
        },
      },
    },
    missing: {
      type: 'array',
      maxItems: 80,
      items: { type: 'string' },
    },
    verification: {
      type: 'object',
      additionalProperties: false,
      required: ['overall', 'details'],
      properties: {
        overall: {
          type: 'string',
          enum: ['passed', 'failed', 'partial', 'not_run'],
        },
        details: { type: 'string', maxLength: 3000 },
      },
    },
    reportMarkdown: { type: 'string', maxLength: 12000 },
  },
}

function buildDiscoveryPrompt() {
  return `
You are the discovery agent for a TypeScript/JavaScript migration swarm.

Task:
Find the ${EXPECTED_COUNT} deprecated call sites that use \`fetchUser(id)\` and must be migrated to \`getUser({ id })\`.

Scope:
${SCOPE}

Instructions:
- Search the repository for actual call sites of the deprecated \`fetchUser(id)\` API.
- Include direct calls, awaited calls, calls inside callbacks, and aliased imports only if you can confidently identify them as the deprecated API.
- Exclude the implementation/definition of fetchUser, tests/mocks unless they are real production call sites in scope, and unrelated functions with the same name.
- Return stable keys. Prefer "file:line:column" when known.
- Keep snippets short. Do not include full files.
- Return exactly the migration targets if possible. If the count differs from ${EXPECTED_COUNT}, include a warning explaining why.

Output must match the schema.
`.trim()
}

function buildMigrationPrompt(site) {
  return `
You are one isolated migration subagent in a larger swarm.

Your single assigned call site:
${stableStringify(site)}

Migration:
- Deprecated API: \`fetchUser(id)\`
- New API: \`getUser({ id })\`

Hard boundaries:
- You are running in an isolated worktree.
- Handle ONLY the assigned call site above.
- Do NOT broad-replace every \`fetchUser\` occurrence.
- Do NOT migrate neighboring call sites unless the exact same syntactic call expression is the assigned site.
- If import edits are needed, make the minimal import change required for this one site.
- If multiple assigned sites share a file, another subagent will handle those separately; avoid unrelated cleanup.

Required work:
1. Locate the exact assigned call site.
2. Determine whether it is still using \`fetchUser(id)\`, is already migrated, cannot be found, or needs manual attention.
3. If safe, update the call to \`getUser({ id })\`.
4. Preserve behavior:
   - Preserve \`await\`, promise chaining, error handling, optional chaining, comments, and surrounding formatting.
   - Preserve the exact id expression as the value of the \`id\` property.
   - If the old call uses multiple arguments, spread/generic overloads, destructuring, unusual binding, shadowed names, or semantics you cannot prove, do not guess; mark manual attention.
5. Update imports minimally:
   - Remove \`fetchUser\` import only when this call site no longer needs it and doing so is safe for the file.
   - Add/import \`getUser\` from the correct module by inspecting existing code and project conventions.
   - If the correct module cannot be determined confidently, mark manual attention.
6. Verify type correctness:
   - Prefer the repo/package's existing typecheck command.
   - ${TYPECHECK_HINT ? `If applicable, use this typecheck hint: \`${TYPECHECK_HINT}\`.` : 'If no obvious command exists, inspect package scripts and run the most targeted safe TypeScript check.'}
   - If the repository has unrelated pre-existing type errors, report \`unrelated_failures\` only when you can show the migration itself is not the cause.
   - If verification cannot run, report \`not_run\` and explain.

Return lean structured data:
- Echo the assigned key exactly.
- Include a concise summary.
- Include the commands run and short evidence.
- Include a unified diff for only the relevant migration, capped to roughly 200 lines.
- If manual attention is needed, leave diff empty unless a partial safe change is truly useful.
`.trim()
}

function buildIntegrationPrompt(payload) {
  return `
You are the integration agent for a completed migration swarm.

Goal:
Apply the verified safe \`fetchUser(id)\` -> \`getUser({ id })\` migrations to the main working tree and run final verification.

Important:
- The per-call-site workers ran in isolated worktrees. Their results are below.
- Apply only entries listed in \`safeMigrations\`.
- Do NOT apply entries listed in \`manualOrUnsafe\`.
- Prefer applying the actual intended source edits over blindly forcing patches if context has shifted.
- Consolidate import edits when multiple safe migrations touch the same file.
- Preserve behavior and formatting.
- If a diff conflicts or appears stale, skip that call site and mark it \`conflict\` or \`failed\` rather than guessing.
- After applying, run the best available typecheck. ${TYPECHECK_HINT ? `Prefer this command when appropriate: \`${TYPECHECK_HINT}\`.` : ''}
- Keep output concise.

Integration payload:
${stableStringify(payload)}

Output must match the schema.
`.trim()
}

function buildReportPrompt(payload) {
  return `
You are the reporting agent for a migration swarm.

Produce a concise but complete report for the migration:
\`fetchUser(id)\` -> \`getUser({ id })\`

Use ONLY the structured payload below.
Flag gaps explicitly. Do not claim full success if any call site is missing, unverified, manually skipped, or failed integration.

Payload:
${stableStringify(payload)}

Report requirements:
- Summarize counts.
- List which sites migrated and whether they were integrated.
- List which sites need manual attention and why.
- List missing/unprocessed sites explicitly.
- Summarize typecheck verification status.
- Keep the Markdown report compact and actionable.

Output must match the schema.
`.trim()
}

phase('Preflight')
log(`Migration swarm starting: expected ${EXPECTED_COUNT} call sites, wave size ${WAVE_SIZE}, integrate=${SHOULD_INTEGRATE}`)

let sites = []
let discoveryWarnings = []

if (Array.isArray(args?.callSites) && args.callSites.length > 0) {
  sites = dedupeAndSortSites(args.callSites)
  log(`Using ${sites.length} call sites supplied in args.callSites`)
} else {
  phase('Discover')
  const discovery = await agent(buildDiscoveryPrompt(), {
    label: 'discover-fetchUser-call-sites',
    phase: 'Discover',
    schema: DISCOVERY_SCHEMA,
    effort: 'medium',
  })

  if (discovery === null) {
    log('Discovery failed; no call sites available to migrate.')
    return {
      ok: false,
      reason: 'Discovery agent failed or was skipped.',
      expectedCallSites: EXPECTED_COUNT,
      callSites: [],
      results: [],
      missing: [],
      integration: null,
      report: null,
    }
  }

  sites = dedupeAndSortSites(discovery.callSites || [])
  discoveryWarnings = discovery.warnings || []
  log(`Discovery identified ${sites.length} unique call sites`)
}

if (sites.length !== EXPECTED_COUNT) {
  log(`⚠ expected ${EXPECTED_COUNT} call sites, but identified ${sites.length}`)
}

if (sites.length === 0) {
  return {
    ok: false,
    reason: 'No call sites were identified.',
    expectedCallSites: EXPECTED_COUNT,
    callSites: [],
    discoveryWarnings,
    results: [],
    missing: [],
    integration: null,
    report: null,
  }
}

function runCallSite(site) {
  return agent(buildMigrationPrompt(site), {
    label: `migrate:${sanitizeLabel(site.key)}`,
    phase: 'Migrate',
    schema: MIGRATION_RESULT_SCHEMA,
    effort: 'medium',
    isolation: 'worktree',
  })
}

const waves = chunk(sites, WAVE_SIZE)
const doneByKey = new Map()
let failed = []
let notStarted = []
let stoppedForInstability = false

phase('Migrate')
for (let w = 0; w < waves.length; w++) {
  phase(`Migrate wave ${w + 1}/${waves.length}`)
  const wave = waves[w]
  log(`Starting migration wave ${w + 1}/${waves.length} (${wave.length} call sites)`)

  const batch = await parallel(wave.map(site => () => runCallSite(site)))

  let nulls = 0
  batch.forEach((result, i) => {
    const site = wave[i]
    if (result === null) {
      nulls += 1
      failed.push(site)
      return
    }

    if (result.key !== site.key) {
      doneByKey.set(site.key, {
        ...result,
        key: site.key,
        manualAttention: {
          needed: true,
          reason: `Worker returned mismatched key "${result.key}" for assigned key "${site.key}". Review required.`,
        },
        status: 'manual_attention',
        risk: 'high',
      })
      return
    }

    doneByKey.set(site.key, result)
  })

  log(`Wave ${w + 1}: ${doneByKey.size}/${sites.length} returned, ${failed.length} failed/null so far`)

  if (nulls / wave.length > 0.4) {
    stoppedForInstability = true
    notStarted = waves.slice(w + 1).flat()
    log(`⚠ instability: ${nulls}/${wave.length} failed this wave — backing off. Returning partial; resume later.`)
    break
  }
}

if (!stoppedForInstability && failed.length > 0) {
  phase('Retry')
  const retryItems = failed
  failed = []

  log(`Starting retry wave for ${retryItems.length} failed call sites`)
  const retried = await parallel(retryItems.map(site => () => runCallSite(site)))

  retried.forEach((result, i) => {
    const site = retryItems[i]
    if (result === null) {
      failed.push(site)
      return
    }

    if (result.key !== site.key) {
      doneByKey.set(site.key, {
        ...result,
        key: site.key,
        manualAttention: {
          needed: true,
          reason: `Retry worker returned mismatched key "${result.key}" for assigned key "${site.key}". Review required.`,
        },
        status: 'manual_attention',
        risk: 'high',
      })
      return
    }

    doneByKey.set(site.key, result)
  })

  log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

const workerResults = [...doneByKey.values()].sort((a, b) => a.key > b.key ? 1 : a.key < b.key ? -1 : 0)
const returnedKeys = new Set(workerResults.map(r => r.key))
const missingSites = sites.filter(site => !returnedKeys.has(site.key))
const missing = missingSites.map(site => site.key)

if (missing.length > 0) {
  log(`⚠ partial: missing ${missing.length}/${sites.length}: ${missing.join(', ')}`)
}

const safeMigrations = workerResults.filter(r => {
  if (r.status !== 'migrated') return false
  if (r.manualAttention?.needed) return false
  if (!r.diff || !r.diff.trim()) return false
  if (INTEGRATE_UNVERIFIED) return r.verification.typecheck !== 'failed'
  return r.verification.typecheck === 'passed'
})

const alreadyMigrated = workerResults.filter(r => r.status === 'already_migrated')

const manualOrUnsafe = workerResults.filter(r => {
  if (r.status === 'manual_attention' || r.status === 'not_found' || r.status === 'skipped') return true
  if (r.manualAttention?.needed) return true
  if (r.status === 'migrated' && !safeMigrations.some(s => s.key === r.key)) return true
  return false
})

let integration = null

if (SHOULD_INTEGRATE && safeMigrations.length > 0) {
  phase('Integrate')
  log(`Integrating ${safeMigrations.length} verified safe migrations into the main working tree`)

  integration = await agent(buildIntegrationPrompt({
    expectedCallSites: EXPECTED_COUNT,
    identifiedCallSites: sites.length,
    safeMigrations: safeMigrations.map(r => ({
      key: r.key,
      file: r.file,
      summary: r.summary,
      changedFiles: r.changedFiles,
      verification: r.verification,
      diff: r.diff,
    })),
    alreadyMigrated: alreadyMigrated.map(r => ({
      key: r.key,
      file: r.file,
      summary: r.summary,
    })),
    manualOrUnsafe: manualOrUnsafe.map(r => ({
      key: r.key,
      file: r.file,
      status: r.status,
      reason: r.manualAttention?.reason || r.summary,
      verification: r.verification,
    })),
    missing,
  }), {
    label: 'integrate-verified-migrations',
    phase: 'Integrate',
    schema: INTEGRATION_SCHEMA,
    effort: 'high',
  })

  if (integration === null) {
    log('⚠ integration agent failed or was skipped; report will mark integration as incomplete')
  }
} else if (!SHOULD_INTEGRATE) {
  log('Skipping integration because args.integrate=false or args.reportOnly=true')
} else {
  log('No verified safe migrations available for automatic integration')
}

phase('Report')

const integrationByKey = new Map()
if (integration?.applied) {
  integration.applied.forEach(entry => integrationByKey.set(entry.key, entry))
}

const reportPayload = {
  expectedCallSites: EXPECTED_COUNT,
  identifiedCallSites: sites.length,
  discoveryWarnings,
  stoppedForInstability,
  notStarted: notStarted.map(site => site.key),
  missing,
  integrationRequested: SHOULD_INTEGRATE,
  integration,
  workerResults: workerResults.map(r => ({
    key: r.key,
    file: r.file,
    status: r.status,
    summary: r.summary,
    changedFiles: r.changedFiles,
    verification: r.verification,
    manualAttention: r.manualAttention,
    risk: r.risk,
    integrated: integrationByKey.get(r.key) || null,
  })),
}

const report = await agent(buildReportPrompt(reportPayload), {
  label: 'migration-report',
  phase: 'Report',
  schema: REPORT_SCHEMA,
  effort: 'medium',
})

return {
  ok: missing.length === 0 && !stoppedForInstability,
  expectedCallSites: EXPECTED_COUNT,
  identifiedCallSites: sites.length,
  discoveryWarnings,
  stoppedForInstability,
  notStarted: notStarted.map(site => site.key),
  results: workerResults,
  safeMigrations: safeMigrations.map(r => r.key),
  alreadyMigrated: alreadyMigrated.map(r => r.key),
  manualAttention: manualOrUnsafe.map(r => ({
    key: r.key,
    file: r.file,
    status: r.status,
    reason: r.manualAttention?.reason || r.summary,
  })),
  missing,
  integration,
  report,
}
```

> **GPT-5.5 judge:** The script meets most of the safety bar: it uses bounded waves with a default size of 6 and max 8, tolerates null agent results, retries failed/null call sites, records completed results into doneByKey after each wave, uses capped schemas and lean outputs, synthesizes partial results with explicit missing/manual/integration gaps, and backs off when a wave has a high null failure rate. It also includes a detailed ScheduleWakeup watchdog instruction. However, the watchdog is only documented in a comment rather than actually armed by the workflow itself, each wave still has a hard parallel() barrier so a single hung subagent can stall that wave until external intervention, and there is no explicit persistent cache/resume mechanism beyond stable keys and the watchdog resume suggestion. Overall it is strongly safe-by-construction but not perfect against hangs without the external watchdog being correctly armed.

