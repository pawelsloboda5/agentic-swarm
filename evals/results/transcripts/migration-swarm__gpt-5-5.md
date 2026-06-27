# migration-swarm — `gpt-5.5`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a MIGRATION SWARM: migrate 35 call sites from the deprecated `fetchUser(id)` API to the new `getUser({ id })` API. Each call site is handled by its own subagent in isolation; verify each migration is type-correct; produce a report of which sites migrated, which need manual attention, and why.

---

## Baseline (no skill) — rubric 28%, patterns 44%

```js
export const meta = {
  name: 'migration-swarm-fetchUser-to-getUser',
  description: 'Migrate 35 deprecated fetchUser(id) call sites to getUser({ id }) using isolated subagents, verify type-correctness, and produce a migration report.',
  phases: [
    { title: 'Discover call sites' },
    { title: 'Migrate in isolated swarm' },
    { title: 'Synthesize report' },
  ],
}

const SITE_COUNT_TARGET = 35

const callSiteSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['sites', 'notes'],
  properties: {
    notes: { type: 'string' },
    sites: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'file', 'line', 'symbolContext', 'currentSnippet', 'migrationHint'],
        properties: {
          id: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer', minimum: 1 },
          symbolContext: { type: 'string' },
          currentSnippet: { type: 'string' },
          migrationHint: { type: 'string' },
        },
      },
    },
  },
}

const migrationResultSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'siteId',
    'file',
    'line',
    'status',
    'changedFiles',
    'summary',
    'verification',
    'manualAttentionReason',
    'residualFetchUserReferences',
  ],
  properties: {
    siteId: { type: 'string' },
    file: { type: 'string' },
    line: { type: 'integer', minimum: 1 },
    status: {
      type: 'string',
      enum: ['migrated_verified', 'migrated_unverified', 'manual_attention', 'not_found', 'skipped'],
    },
    changedFiles: {
      type: 'array',
      items: { type: 'string' },
    },
    summary: { type: 'string' },
    verification: {
      type: 'object',
      additionalProperties: false,
      required: ['typecheckRun', 'typecheckPassed', 'commandsRun', 'outputSummary'],
      properties: {
        typecheckRun: { type: 'boolean' },
        typecheckPassed: { type: 'boolean' },
        commandsRun: {
          type: 'array',
          items: { type: 'string' },
        },
        outputSummary: { type: 'string' },
      },
    },
    manualAttentionReason: { type: 'string' },
    residualFetchUserReferences: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['file', 'line', 'snippet', 'reason'],
        properties: {
          file: { type: 'string' },
          line: { type: 'integer', minimum: 1 },
          snippet: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
}

const reportSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['markdownReport', 'counts', 'migrated', 'manualAttention', 'unverified', 'notFoundOrSkipped'],
  properties: {
    markdownReport: { type: 'string' },
    counts: {
      type: 'object',
      additionalProperties: false,
      required: ['totalDiscovered', 'migratedVerified', 'migratedUnverified', 'manualAttention', 'notFoundOrSkipped'],
      properties: {
        totalDiscovered: { type: 'integer', minimum: 0 },
        migratedVerified: { type: 'integer', minimum: 0 },
        migratedUnverified: { type: 'integer', minimum: 0 },
        manualAttention: { type: 'integer', minimum: 0 },
        notFoundOrSkipped: { type: 'integer', minimum: 0 },
      },
    },
    migrated: {
      type: 'array',
      items: { type: 'string' },
    },
    manualAttention: {
      type: 'array',
      items: { type: 'string' },
    },
    unverified: {
      type: 'array',
      items: { type: 'string' },
    },
    notFoundOrSkipped: {
      type: 'array',
      items: { type: 'string' },
    },
  },
}

function uniqBySiteKey(sites) {
  const seen = new Set()
  const out = []
  for (const site of sites || []) {
    if (!site || !site.file || !site.line) continue
    const key = `${site.file}:${site.line}:${site.currentSnippet || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(site)
  }
  return out
}

function compactResult(result, site) {
  if (result) return result
  return {
    siteId: site.id,
    file: site.file,
    line: site.line,
    status: 'manual_attention',
    changedFiles: [],
    summary: 'Migration subagent returned no result.',
    verification: {
      typecheckRun: false,
      typecheckPassed: false,
      commandsRun: [],
      outputSummary: 'No verification available because the subagent returned null.',
    },
    manualAttentionReason: 'Subagent was skipped, failed, or hit a terminal API/runtime error.',
    residualFetchUserReferences: [],
  }
}

phase('Discover call sites')
log('Discovering deprecated fetchUser(id) call sites...')

const discovery = await agent(
  `You are the discovery coordinator for a repository migration.

Task:
Find every call site that uses the deprecated API \`fetchUser(id)\` and should be migrated to the new API \`getUser({ id })\`.

Requirements:
- Inspect the repository thoroughly using search and code navigation.
- Identify exactly the call expressions/import usages that represent call sites, not unrelated text.
- Include tests, scripts, backend/frontend code, and any generated-looking source only if it is normally edited in this repo.
- Exclude comments, documentation-only mentions, type declarations with no runtime call, and already-migrated \`getUser({ id })\` calls.
- Return up to the full expected set. The migration request expects ${SITE_COUNT_TARGET} call sites; if you find a different count, explain in notes.
- Give each site a stable id like "site-01", "site-02", ... sorted by file path then line number.
- For each site, include enough snippet/context for a migration subagent to locate it unambiguously.

Return only the schema object.`,
  {
    label: 'discover-fetchUser-call-sites',
    phase: 'Discover call sites',
    schema: callSiteSchema,
    effort: 'high',
  },
)

const discoveredSites = uniqBySiteKey(discovery && discovery.sites ? discovery.sites : [])
log(`Discovery found ${discoveredSites.length} candidate call site(s).`)

const sites = discoveredSites.slice(0, SITE_COUNT_TARGET)
if (discoveredSites.length > SITE_COUNT_TARGET) {
  log(`Discovery found more than ${SITE_COUNT_TARGET}; limiting swarm to first ${SITE_COUNT_TARGET} sorted sites and flagging remainder in report.`)
}
if (discoveredSites.length < SITE_COUNT_TARGET) {
  log(`Discovery found fewer than expected (${discoveredSites.length}/${SITE_COUNT_TARGET}); proceeding with discovered sites and flagging count mismatch.`)
}

phase('Migrate in isolated swarm')
log(`Launching ${sites.length} isolated migration subagent(s)...`)

const migrationResults = await parallel(
  sites.map((site, index) => async () => {
    const result = await agent(
      `You are migration worker ${index + 1} of ${sites.length}. You are operating in an isolated worktree.

Migration target:
- Deprecated API: \`fetchUser(id)\`
- New API: \`getUser({ id })\`

Your assigned call site:
${JSON.stringify(site, null, 2)}

Strict scope:
- Migrate ONLY this assigned call site and the minimal supporting imports/types needed for this site.
- Do not opportunistically migrate other \`fetchUser\` call sites.
- Do not perform broad refactors, formatting-only rewrites, dependency upgrades, or unrelated cleanup.
- Preserve behavior exactly. The argument expression passed to \`fetchUser(...)\` must become the \`id\` property value in \`getUser({ id: ... })\`, using shorthand only when correct.
- If the old import is \`fetchUser\`, update it to \`getUser\` only as needed. If multiple old and unmigrated uses share an import in the same file, make the minimal safe import change that keeps the file compiling.
- Handle aliases carefully:
  - \`fetchUser(userId)\` -> \`getUser({ id: userId })\`
  - \`fetchUser(id)\` -> \`getUser({ id })\`
  - \`await fetchUser(expr)\` -> \`await getUser({ id: expr })\`
  - Preserve generics, await/Promise handling, error handling, mocks, and test expectations where applicable.
- If the call site cannot be migrated safely in isolation, do not guess. Return \`manual_attention\` and explain why.

Verification:
- After editing, run the most relevant type-check command available in the repo.
- Prefer targeted checks if obvious, otherwise run the standard project/package typecheck.
- If there is no obvious typecheck command, inspect package scripts/config and run the closest compile/static type validation.
- Record every verification command you ran and whether it passed.
- Search the changed file(s) after migration and report any residual \`fetchUser\` reference related to this assigned site.

Return only the schema object. Be precise and honest; if edits were made but verification could not be run or failed, use \`migrated_unverified\` unless manual follow-up is required.`,
      {
        label: `migrate-${site.id}`,
        phase: 'Migrate in isolated swarm',
        schema: migrationResultSchema,
        isolation: 'worktree',
        effort: 'high',
      },
    )
    return compactResult(result, site)
  }),
)

const normalizedResults = migrationResults.map((result, index) => compactResult(result, sites[index]))

phase('Synthesize report')
log('Synthesizing migration report...')

const extraDiscoveryNote =
  discoveredSites.length > SITE_COUNT_TARGET
    ? `Discovery found ${discoveredSites.length} sites, which is more than the expected ${SITE_COUNT_TARGET}. The swarm migrated the first ${SITE_COUNT_TARGET} sorted sites. Extra discovered sites: ${JSON.stringify(discoveredSites.slice(SITE_COUNT_TARGET), null, 2)}`
    : discoveredSites.length < SITE_COUNT_TARGET
      ? `Discovery found only ${discoveredSites.length} sites, fewer than the expected ${SITE_COUNT_TARGET}.`
      : `Discovery found the expected ${SITE_COUNT_TARGET} sites.`

const finalReport = await agent(
  `You are the migration lead. Produce the final report for the migration swarm.

Migration:
- Deprecated API: \`fetchUser(id)\`
- New API: \`getUser({ id })\`
- Expected number of call sites: ${SITE_COUNT_TARGET}

Discovery notes:
${discovery && discovery.notes ? discovery.notes : 'Discovery agent returned no notes.'}

Count note:
${extraDiscoveryNote}

Per-site migration results:
${JSON.stringify(normalizedResults, null, 2)}

Report requirements:
- Produce a clear Markdown report.
- Include summary counts.
- List every site that was migrated and type-verified.
- List migrated but unverified sites, with commands/output summary and why verification did not pass or did not run.
- List sites needing manual attention, with exact reason.
- List not-found/skipped sites.
- Mention any discovery count mismatch or extra discovered sites.
- Call out residual \`fetchUser\` references reported by workers.
- Be concise but complete.
- Do not claim repository-wide success beyond the evidence in the worker results.

Return only the schema object.`,
  {
    label: 'final-migration-report',
    phase: 'Synthesize report',
    schema: reportSchema,
    effort: 'medium',
  },
)

if (finalReport && finalReport.markdownReport) {
  log(finalReport.markdownReport)
} else {
  const migratedVerified = normalizedResults.filter(r => r.status === 'migrated_verified')
  const migratedUnverified = normalizedResults.filter(r => r.status === 'migrated_unverified')
  const manualAttention = normalizedResults.filter(r => r.status === 'manual_attention')
  const notFoundOrSkipped = normalizedResults.filter(r => r.status === 'not_found' || r.status === 'skipped')

  log(`# Migration swarm report

${extraDiscoveryNote}

## Counts
- Discovered: ${discoveredSites.length}
- Migrated and verified: ${migratedVerified.length}
- Migrated but unverified: ${migratedUnverified.length}
- Manual attention: ${manualAttention.length}
- Not found/skipped: ${notFoundOrSkipped.length}

## Migrated and verified
${migratedVerified.map(r => `- ${r.siteId} ${r.file}:${r.line} — ${r.summary}`).join('\n') || '- None'}

## Migrated but unverified
${migratedUnverified.map(r => `- ${r.siteId} ${r.file}:${r.line} — ${r.summary}; verification: ${r.verification.outputSummary}`).join('\n') || '- None'}

## Needs manual attention
${manualAttention.map(r => `- ${r.siteId} ${r.file}:${r.line} — ${r.manualAttentionReason || r.summary}`).join('\n') || '- None'}

## Not found or skipped
${notFoundOrSkipped.map(r => `- ${r.siteId} ${r.file}:${r.line} — ${r.summary}`).join('\n') || '- None'}
`)
}

export default {
  discovery: {
    expectedCount: SITE_COUNT_TARGET,
    discoveredCount: discoveredSites.length,
    notes: discovery ? discovery.notes : 'Discovery failed or returned null.',
    sites,
    extraSites: discoveredSites.slice(SITE_COUNT_TARGET),
  },
  results: normalizedResults,
  report: finalReport,
}
```

> **Claude judge:** The script fans out all 35 agents in a single unbounded parallel() barrier with no wave batching, no per-agent retry (only null-coalescing), no stall watchdog, and no backoff on high failure rates. Positive marks go to stable/cache-friendly prompts, well-structured schemas with additionalProperties:false, graceful null handling via compactResult, and synthesis that explicitly flags count mismatches and partial results.

## With skill — rubric 95%, patterns 100%

```js
export const meta = {
  name: 'migration-swarm-fetchUser-to-getUser',
  description: 'Safely migrate 35 fetchUser(id) call sites to getUser({ id }) with isolated per-site agents, verification, application, and reporting.',
  phases: [
    { title: 'Discover' },
    { title: 'Migrate/Verify Waves' },
    { title: 'Retry' },
    { title: 'Apply' },
    { title: 'Report' },
  ],
}

// IMPORTANT WATCHDOG (agent-level, run immediately after launching this Workflow; not available inside script body):
// ScheduleWakeup({
//   delaySeconds: 1200,
//   reason: "watchdog: migration swarm wf_<id> may stall silently; check journal mtime",
//   prompt: "Watchdog for migration swarm run wf_<id> (task <taskId>, journal at <path>): if the journal mtime is older than 20 min AND the workflow task is not 'completed', TaskStop the task then resume with Workflow({scriptPath, resumeFromRunId}); otherwise re-arm another 1200s ScheduleWakeup. Plain one-shot watchdog — NOT a /loop sentinel."
// })

const WAVE_SIZE = 7
const TARGET_SITE_COUNT = 35
const MAX_DIFF_CHARS = 24000

const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const clip = (s, n) => {
  const str = String(s ?? '')
  return str.length <= n ? str : str.slice(0, n) + '\n...[truncated]'
}

const stableStringify = (value) => JSON.stringify(value, Object.keys(value || {}).sort())

const sanitizeSite = (site, index) => {
  const file = String(site.file || site.path || '')
  const line = Number.isFinite(site.line) ? site.line : Number(site.line || 0)
  const column = Number.isFinite(site.column) ? site.column : Number(site.column || 0)
  const snippet = clip(site.snippet || site.expressionSnippet || site.context || '', 900)
  const rawKey = site.key || `${file}:${line}:${column}:${clip(snippet.replace(/\s+/g, ' '), 80)}`
  return {
    key: String(rawKey || `site-${index + 1}`),
    file,
    line: Number.isFinite(line) ? line : 0,
    column: Number.isFinite(column) ? column : 0,
    snippet,
    importHint: clip(site.importHint || site.importSource || '', 300),
    notes: clip(site.notes || site.risk || '', 500),
  }
}

const dedupeSites = (sites) => {
  const seen = new Set()
  const out = []
  for (let i = 0; i < sites.length; i++) {
    const s = sanitizeSite(sites[i], i)
    if (!s.key || seen.has(s.key)) continue
    seen.add(s.key)
    out.push(s)
  }
  return out.sort((a, b) => (a.key > b.key ? 1 : a.key < b.key ? -1 : 0))
}

const DISCOVERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['typecheckCommand', 'callSites', 'notes'],
  properties: {
    typecheckCommand: { type: 'string' },
    notes: { type: 'array', maxItems: 8, items: { type: 'string' } },
    callSites: {
      type: 'array',
      maxItems: 45,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'file', 'line', 'column', 'snippet', 'importHint', 'risk'],
        properties: {
          key: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'number' },
          column: { type: 'number' },
          snippet: { type: 'string' },
          importHint: { type: 'string' },
          risk: { type: 'string' },
        },
      },
    },
  },
}

const MIGRATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'key',
    'file',
    'status',
    'summary',
    'manualReason',
    'changedFiles',
    'diff',
    'checksRun',
    'typecheckCommandUsed',
    'notes',
  ],
  properties: {
    key: { type: 'string' },
    file: { type: 'string' },
    status: { type: 'string', enum: ['migrated', 'manual_attention'] },
    summary: { type: 'string' },
    manualReason: { type: 'string' },
    changedFiles: { type: 'array', maxItems: 6, items: { type: 'string' } },
    diff: { type: 'string' },
    checksRun: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['command', 'status', 'summary'],
        properties: {
          command: { type: 'string' },
          status: { type: 'string', enum: ['pass', 'fail', 'not_run'] },
          summary: { type: 'string' },
        },
      },
    },
    typecheckCommandUsed: { type: 'string' },
    notes: { type: 'array', maxItems: 6, items: { type: 'string' } },
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['key', 'file', 'status', 'typeCorrect', 'checksRun', 'issues', 'summary'],
  properties: {
    key: { type: 'string' },
    file: { type: 'string' },
    status: { type: 'string', enum: ['verified', 'rejected', 'manual_attention'] },
    typeCorrect: { type: 'boolean' },
    checksRun: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['command', 'status', 'summary'],
        properties: {
          command: { type: 'string' },
          status: { type: 'string', enum: ['pass', 'fail', 'not_run'] },
          summary: { type: 'string' },
        },
      },
    },
    issues: { type: 'array', maxItems: 10, items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

const APPLY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'summary', 'applied', 'manualAttention', 'fullTypecheck'],
  properties: {
    status: { type: 'string', enum: ['applied_all', 'applied_partial', 'none_applied', 'failed'] },
    summary: { type: 'string' },
    applied: {
      type: 'array',
      maxItems: 35,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'file', 'status', 'reason'],
        properties: {
          key: { type: 'string' },
          file: { type: 'string' },
          status: { type: 'string', enum: ['applied', 'skipped', 'conflict', 'failed'] },
          reason: { type: 'string' },
        },
      },
    },
    manualAttention: {
      type: 'array',
      maxItems: 35,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'file', 'reason'],
        properties: {
          key: { type: 'string' },
          file: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    fullTypecheck: {
      type: 'object',
      additionalProperties: false,
      required: ['command', 'status', 'summary'],
      properties: {
        command: { type: 'string' },
        status: { type: 'string', enum: ['pass', 'fail', 'not_run'] },
        summary: { type: 'string' },
      },
    },
  },
}

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'counts', 'migrated', 'manualAttention', 'notAttempted', 'typecheckSummary', 'nextSteps'],
  properties: {
    summary: { type: 'string' },
    counts: {
      type: 'object',
      additionalProperties: false,
      required: ['planned', 'verified', 'applied', 'manualAttention', 'notAttempted'],
      properties: {
        planned: { type: 'number' },
        verified: { type: 'number' },
        applied: { type: 'number' },
        manualAttention: { type: 'number' },
        notAttempted: { type: 'number' },
      },
    },
    migrated: {
      type: 'array',
      maxItems: 35,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'file', 'summary'],
        properties: {
          key: { type: 'string' },
          file: { type: 'string' },
          summary: { type: 'string' },
        },
      },
    },
    manualAttention: {
      type: 'array',
      maxItems: 35,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'file', 'reason'],
        properties: {
          key: { type: 'string' },
          file: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    notAttempted: {
      type: 'array',
      maxItems: 35,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'file', 'reason'],
        properties: {
          key: { type: 'string' },
          file: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    typecheckSummary: { type: 'string' },
    nextSteps: { type: 'array', maxItems: 10, items: { type: 'string' } },
  },
}

const workerModel = args?.workerModel
const verifierModel = args?.verifierModel || workerModel
const synthesizerModel = args?.synthesizerModel || workerModel
const requestedTypecheckCommand = String(args?.typecheckCommand || '').trim()
const applyChanges = args?.apply !== false

phase('Discover')

let discovered = null
let sites = []

if (Array.isArray(args?.callSites) && args.callSites.length) {
  sites = dedupeSites(args.callSites).slice(0, TARGET_SITE_COUNT)
  discovered = {
    typecheckCommand: requestedTypecheckCommand,
    notes: ['Using call sites supplied in workflow args.'],
    callSites: sites.map(s => ({
      key: s.key,
      file: s.file,
      line: s.line,
      column: s.column,
      snippet: s.snippet,
      importHint: s.importHint,
      risk: s.notes,
    })),
  }
  log(`Using ${sites.length} supplied call sites.`)
} else {
  discovered = await agent(
    `You are preparing a migration swarm.

Task:
- Inspect the repository and find call sites of the deprecated API fetchUser(id) that should migrate to getUser({ id }).
- Return up to exactly ${TARGET_SITE_COUNT} concrete call sites.
- Include stable keys so later agents can operate independently and resume safely.
- Prefer keys like "path/to/file.ts:line:column".
- Include only actual fetchUser(id) runtime call sites, not declarations, docs, tests that intentionally assert deprecated behavior, or unrelated identifiers.
- If there are fewer than ${TARGET_SITE_COUNT}, return all real call sites and explain in notes.
- Identify the best typecheck command for this repo. If unsure, choose the most likely project command and explain briefly.

Output must be lean. Snippets should be one or two lines only.
Search hints supplied by caller:
${clip(JSON.stringify(args?.searchHints || {}, null, 2), 3000)}`,
    {
      label: 'discover-fetchUser-call-sites',
      phase: 'Discover',
      schema: DISCOVERY_SCHEMA,
      model: workerModel,
      effort: 'medium',
    }
  )

  if (discovered && Array.isArray(discovered.callSites)) {
    sites = dedupeSites(discovered.callSites).slice(0, TARGET_SITE_COUNT)
  }
  log(`Discovered ${sites.length} candidate call sites.`)
}

const typecheckCommand = requestedTypecheckCommand || String(discovered?.typecheckCommand || '').trim()

if (!sites.length) {
  phase('Report')
  const emptyReport = {
    summary: 'No fetchUser(id) call sites were supplied or discovered; no migration was attempted.',
    counts: { planned: 0, verified: 0, applied: 0, manualAttention: 0, notAttempted: 0 },
    migrated: [],
    manualAttention: [],
    notAttempted: [],
    typecheckSummary: 'No typecheck run because no migration was attempted.',
    nextSteps: ['Confirm the deprecated API name and provide callSites explicitly if discovery missed them.'],
  }
  return { ok: false, discovered, sites: [], results: [], missing: [], applyResult: null, report: emptyReport }
}

function migrationPrompt(site) {
  return `You are one isolated migration worker for exactly one call site.

Migration:
- Deprecated API: fetchUser(id)
- New API: getUser({ id })
- Migrate ONLY this call site:
${JSON.stringify(site, null, 2)}

Hard rules:
1. Work in your isolated worktree.
2. Make the smallest safe code change for this one call site.
3. Preserve async/await behavior, generics, nullability, comments, and surrounding semantics.
4. If fetchUser is imported, update imports conservatively:
   - add/import getUser from the correct module,
   - remove fetchUser only if no remaining fetchUser references in that file,
   - do not break other fetchUser call sites assigned to other workers.
5. If this call is ambiguous, dynamically constructed, shadowed, test-only intentional deprecated coverage, or requires broader refactoring, do NOT force it. Return manual_attention with a concise reason.
6. Run a relevant typecheck if feasible. Preferred command:
${typecheckCommand || '(infer from repository: package manager script, tsc --noEmit, or equivalent)'}
7. Return a unified diff for the change. Keep it targeted; if the diff would exceed ${MAX_DIFF_CHARS} characters, return manual_attention instead and explain why.
8. Do not include long logs. Summarize checks in one line each.

Return migrated only when the code edit is complete and ready for independent verification.`
}

function verifyPrompt(site, migration) {
  return `You are an independent verifier for exactly one migrated call site.

Original call site:
${JSON.stringify(site, null, 2)}

Migration worker output:
${clip(JSON.stringify(migration, null, 2), MAX_DIFF_CHARS + 4000)}

Verification task:
1. In your isolated worktree, apply the provided unified diff.
2. Inspect the migrated call site and confirm it changes fetchUser(id) to getUser({ id }) without changing behavior.
3. Confirm imports are type-correct and conservative.
4. Run the preferred typecheck command if feasible:
${typecheckCommand || migration.typecheckCommandUsed || '(infer from repository)'}
5. If typecheck cannot be run, use static TypeScript inspection and mark typeCorrect=false unless you have strong evidence.
6. Return verified only if this individual patch is type-correct and safe.
7. Return rejected/manual_attention with concise issues if the patch does not apply, is not targeted, is semantically risky, or fails typecheck.

Keep output lean. Do not include full command logs.`
}

async function runItem(site) {
  try {
    const migration = await agent(migrationPrompt(site), {
      label: `migrate:${site.key}`,
      phase: 'Migrate/Verify Waves',
      schema: MIGRATION_SCHEMA,
      model: workerModel,
      effort: 'medium',
      isolation: 'worktree',
    })

    if (!migration) return null

    if (migration.status !== 'migrated') {
      return {
        key: site.key,
        file: site.file,
        line: site.line,
        column: site.column,
        finalStatus: 'manual_attention',
        reason: migration.manualReason || migration.summary || 'Migration worker requested manual attention.',
        migration,
        verification: null,
        diff: '',
      }
    }

    if (!migration.diff || migration.diff.length > MAX_DIFF_CHARS) {
      return {
        key: site.key,
        file: site.file,
        line: site.line,
        column: site.column,
        finalStatus: 'manual_attention',
        reason: !migration.diff
          ? 'Migration worker did not return a diff.'
          : `Migration diff exceeded ${MAX_DIFF_CHARS} characters and needs manual review.`,
        migration,
        verification: null,
        diff: '',
      }
    }

    const verification = await agent(verifyPrompt(site, migration), {
      label: `verify:${site.key}`,
      phase: 'Migrate/Verify Waves',
      schema: VERIFY_SCHEMA,
      model: verifierModel,
      effort: 'medium',
      isolation: 'worktree',
    })

    if (!verification) return null

    if (verification.status === 'verified' && verification.typeCorrect) {
      return {
        key: site.key,
        file: site.file,
        line: site.line,
        column: site.column,
        finalStatus: 'verified_migration',
        reason: verification.summary || migration.summary || 'Verified type-correct migration.',
        migration,
        verification,
        diff: migration.diff,
      }
    }

    return {
      key: site.key,
      file: site.file,
      line: site.line,
      column: site.column,
      finalStatus: 'manual_attention',
      reason:
        (verification.issues && verification.issues.length ? verification.issues.join('; ') : '') ||
        verification.summary ||
        'Verifier rejected migration or could not prove type correctness.',
      migration,
      verification,
      diff: '',
    }
  } catch (e) {
    log(`Worker exception for ${site.key}: ${String(e && e.message ? e.message : e)}`)
    return null
  }
}

phase('Migrate/Verify Waves')

const waves = chunk(sites, WAVE_SIZE)
const done = []
let failed = []
let instabilitySpike = false

for (let w = 0; w < waves.length; w++) {
  phase(`Migrate/Verify Wave ${w + 1}/${waves.length}`)
  const wave = waves[w]

  const batch = await parallel(wave.map(site => () => runItem(site)))

  batch.forEach((result, i) => {
    if (result) done.push(result)
    else failed.push(wave[i])
  })

  const nulls = batch.filter(r => r === null).length
  log(`Wave ${w + 1}/${waves.length}: ${batch.length - nulls}/${batch.length} returned; cumulative ${done.length}/${sites.length}; failed-to-retry ${failed.length}.`)

  if (nulls / batch.length > 0.4) {
    log(`⚠ instability: ${nulls}/${batch.length} failed this wave — backing off. Returning partial results; resume later to recover remaining work from cache.`)
    instabilitySpike = true
    break
  }
}

if (failed.length && !instabilitySpike) {
  phase('Retry')
  const retryItems = failed
  failed = []

  const retried = await parallel(retryItems.map(site => () => runItem(site)))

  retried.forEach((result, i) => {
    if (result) done.push(result)
    else failed.push(retryItems[i])
  })

  log(`Retry wave recovered ${retried.filter(Boolean).length}/${retryItems.length}; still missing ${failed.length}.`)
} else if (failed.length && instabilitySpike) {
  log(`Retry skipped because of instability backoff; ${failed.length} failed items can be recovered on resume.`)
}

const resultByKey = new Map()
for (const r of done) resultByKey.set(r.key, r)
const dedupedResults = Array.from(resultByKey.values()).sort((a, b) => (a.key > b.key ? 1 : a.key < b.key ? -1 : 0))

const haveKeys = new Set(dedupedResults.map(r => r.key))
const missing = sites
  .filter(site => !haveKeys.has(site.key))
  .map(site => ({
    key: site.key,
    file: site.file,
    reason: instabilitySpike
      ? 'Not completed because workflow backed off during an API instability spike; resume this run.'
      : 'Worker or verifier did not return a result after retry.',
  }))

if (missing.length) {
  log(`⚠ partial: missing ${missing.length}/${sites.length}: ${missing.map(m => m.key).join(', ')}`)
}

const verifiedPatches = dedupedResults
  .filter(r => r.finalStatus === 'verified_migration' && r.diff)
  .map(r => ({
    key: r.key,
    file: r.file,
    line: r.line,
    column: r.column,
    reason: r.reason,
    diff: clip(r.diff, MAX_DIFF_CHARS),
  }))
  .sort((a, b) => (a.key > b.key ? 1 : a.key < b.key ? -1 : 0))

let applyResult = null

if (applyChanges && verifiedPatches.length) {
  phase('Apply')
  applyResult = await agent(
    `You are the integration applier for verified isolated migration patches.

Goal:
- Apply verified patches that migrate fetchUser(id) to getUser({ id }) in the main worktree.
- Apply only patches listed below.
- If patches conflict, resolve only straightforward import/context conflicts that preserve the verified migration.
- If a patch is risky or cannot be applied cleanly, skip it and report manual attention.
- After applying all clean patches, run full typecheck if feasible.
- Preferred full typecheck command:
${typecheckCommand || '(infer from repository)'}
- Do not migrate additional call sites not represented by these verified patches.
- Keep output concise.

Verified patches:
${clip(JSON.stringify(verifiedPatches, null, 2), 120000)}

Known manual/missing items to leave untouched:
${JSON.stringify(
  dedupedResults
    .filter(r => r.finalStatus !== 'verified_migration')
    .map(r => ({ key: r.key, file: r.file, reason: r.reason }))
    .concat(missing),
  null,
  2
)}`,
    {
      label: 'apply-verified-migrations',
      phase: 'Apply',
      schema: APPLY_SCHEMA,
      model: workerModel,
      effort: 'high',
    }
  )

  if (!applyResult) {
    log('⚠ apply agent returned null; verified patches are reported but may not be applied.')
  }
} else {
  phase('Apply')
  log(applyChanges ? 'No verified patches to apply.' : 'apply=false; verified patches were not applied.')
}

phase('Report')

const manualAttention = dedupedResults
  .filter(r => r.finalStatus !== 'verified_migration')
  .map(r => ({
    key: r.key,
    file: r.file,
    reason: r.reason || 'Needs manual attention.',
  }))
  .sort((a, b) => (a.key > b.key ? 1 : a.key < b.key ? -1 : 0))

const reportPayload = {
  plannedSites: sites,
  discoveryNotes: discovered?.notes || [],
  typecheckCommand,
  instabilitySpike,
  results: dedupedResults.map(r => ({
    key: r.key,
    file: r.file,
    line: r.line,
    column: r.column,
    finalStatus: r.finalStatus,
    reason: r.reason,
    migrationSummary: r.migration?.summary || '',
    migrationChecks: r.migration?.checksRun || [],
    verificationSummary: r.verification?.summary || '',
    verificationChecks: r.verification?.checksRun || [],
    verificationIssues: r.verification?.issues || [],
  })),
  missing,
  applyResult,
}

const report = await agent(
  `Produce the final migration report for this fetchUser(id) -> getUser({ id }) migration swarm.

Requirements:
- Be explicit about which call sites migrated, which need manual attention, and why.
- Do not hide partial coverage. Include every missing/not-attempted site.
- Distinguish "verified in isolated worktree" from "applied to main worktree".
- Summarize typecheck status, including full integration typecheck if available.
- Keep the report concise and actionable.

Input payload:
${JSON.stringify(reportPayload, null, 2)}`,
  {
    label: 'final-migration-report',
    phase: 'Report',
    schema: REPORT_SCHEMA,
    model: synthesizerModel,
    effort: 'high',
  }
)

const fallbackReport = {
  summary: 'Migration swarm completed but the report synthesis agent did not return a structured report.',
  counts: {
    planned: sites.length,
    verified: verifiedPatches.length,
    applied: applyResult?.applied?.filter(a => a.status === 'applied').length || 0,
    manualAttention: manualAttention.length,
    notAttempted: missing.length,
  },
  migrated: verifiedPatches.map(p => ({ key: p.key, file: p.file, summary: p.reason || 'Verified migration.' })),
  manualAttention,
  notAttempted: missing,
  typecheckSummary: applyResult?.fullTypecheck?.summary || 'See raw migration and verification checks.',
  nextSteps: [
    'Review manualAttention and notAttempted lists.',
    'If this run backed off or stalled, resume using Workflow({ scriptPath, resumeFromRunId }) rather than restarting.',
  ],
}

return {
  ok: !instabilitySpike && missing.length === 0 && manualAttention.length === 0 && !!(report || fallbackReport),
  plannedCount: sites.length,
  verifiedCount: verifiedPatches.length,
  manualAttentionCount: manualAttention.length,
  missingCount: missing.length,
  instabilitySpike,
  typecheckCommand,
  discovered,
  results: dedupedResults,
  missing,
  applyResult,
  report: report || fallbackReport,
}
```

> **Claude judge:** All eight safety properties are present: bounded 7-item waves with sequential iteration, per-agent null-tolerance with a dedicated retry wave, per-wave result accumulation with no single hard barrier, an armed ScheduleWakeup watchdog comment (correctly noted as agent-level), deterministic cache-stable keys, capped schemas and clipped outputs, synthesis with explicit gap-flagging and a fallback report, and a >40% failure-rate backoff that halts further waves and skips retry.

