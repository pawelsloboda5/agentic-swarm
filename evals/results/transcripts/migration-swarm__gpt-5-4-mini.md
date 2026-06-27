# migration-swarm — `gpt-5.4-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: Claude (claude-sonnet-4-6).

**Task**

> Write a Claude Code Workflow script for a MIGRATION SWARM: migrate 35 call sites from the deprecated `fetchUser(id)` API to the new `getUser({ id })` API. Each call site is handled by its own subagent in isolation; verify each migration is type-correct; produce a report of which sites migrated, which need manual attention, and why.

---

## Baseline (no skill) — rubric 22%, patterns 25%

```js
export const meta = {
  name: 'migration-swarm-fetchUser-to-getUser',
  description:
    'Migrate 35 call sites from fetchUser(id) to getUser({ id }) with isolated subagents, type verification, and a structured migration report.',
  phases: [
    { title: 'Inventory' },
    { title: 'Isolated Migrations' },
    { title: 'Type Verification' },
    { title: 'Report' },
  ],
}

const sites = Array.from({ length: 35 }, (_, i) => ({
  index: i + 1,
  siteId: `call-site-${String(i + 1).padStart(2, '0')}`,
}))

phase('Inventory')
log(`Preparing migration swarm for ${sites.length} call sites.`)

const inventory = await agent(
  `You are auditing a migration from deprecated fetchUser(id) to getUser({ id }).
For the 35 call sites listed below, produce a concise migration plan per site.
Do not change code yet.

Call sites:
${sites.map((s) => `- ${s.siteId}`).join('\n')}

Return JSON only matching this schema:
{
  "sites": [
    {
      "siteId": string,
      "migrationRisk": "low" | "medium" | "high",
      "notes": string
    }
  ]
}

If you cannot assess a site, use "high" risk and explain why.`,
  {
    label: 'inventory',
    phase: 'Inventory',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['sites'],
      properties: {
        sites: {
          type: 'array',
          minItems: 35,
          maxItems: 35,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['siteId', 'migrationRisk', 'notes'],
            properties: {
              siteId: { type: 'string' },
              migrationRisk: { type: 'string', enum: ['low', 'medium', 'high'] },
              notes: { type: 'string' },
            },
          },
        },
      },
    },
    effort: 'medium',
    model: 'claude-3.5-sonnet',
  },
)

const planBySite = new Map(inventory?.sites?.map((s) => [s.siteId, s]) ?? [])

phase('Isolated Migrations')
log('Launching one isolated subagent per call site.')

const migrationResults = await parallel(
  sites.map((site) => async () => {
    const plan = planBySite.get(site.siteId)
    const prompt = `You are migrating exactly one isolated call site in a codebase from fetchUser(id) to getUser({ id }).

Site: ${site.siteId}
Index: ${site.index}
Risk: ${plan?.migrationRisk ?? 'unknown'}
Plan notes: ${plan?.notes ?? 'none'}

Task:
1) Update the site to use getUser({ id }) instead of fetchUser(id).
2) Preserve behavior exactly.
3) Check the result for type correctness.
4) If the migration is unsafe, incomplete, or requires broader refactoring, do not force it; return a manual-attention result with a clear reason.

Return JSON only matching:
{
  "siteId": string,
  "status": "migrated" | "manual_attention",
  "changed": boolean,
  "typeCheck": "pass" | "fail" | "unknown",
  "reason": string,
  "diffSummary": string
}

Rules:
- "migrated" only if the call site can be safely converted to getUser({ id }) and type-checks.
- "manual_attention" if any ambiguity, type issue, overload mismatch, inference failure, destructuring complication, spread/rest issue, or side-effect risk remains.
- Keep the reason specific and actionable.`,
    const result = await agent(prompt, {
      label: `migrate:${site.siteId}`,
      phase: 'Isolated Migrations',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['siteId', 'status', 'changed', 'typeCheck', 'reason', 'diffSummary'],
        properties: {
          siteId: { type: 'string' },
          status: { type: 'string', enum: ['migrated', 'manual_attention'] },
          changed: { type: 'boolean' },
          typeCheck: { type: 'string', enum: ['pass', 'fail', 'unknown'] },
          reason: { type: 'string' },
          diffSummary: { type: 'string' },
        },
      },
      effort: 'high',
      model: 'claude-3.5-sonnet',
      isolation: 'worktree',
    })
    return result
  }),
)

phase('Type Verification')
log('Verifying each migration result for type correctness and consistency.')

const verificationResults = await parallel(
  migrationResults.map((result, idx) => async () => {
    const site = sites[idx]
    if (!result) {
      return {
        siteId: site.siteId,
        verified: false,
        reason: 'Migration subagent failed or was skipped.',
      }
    }

    const verification = await agent(
      `You are validating a single migration result for ${result.siteId}.

Migration result:
${JSON.stringify(result, null, 2)}

Determine whether the migration is type-correct based on the reported status and typeCheck.
If status is "migrated", it must have typeCheck "pass" and a concrete change summary.
If status is "manual_attention", explain whether the reported reason is sufficient and whether the site should remain unresolved.

Return JSON only:
{
  "siteId": string,
  "verified": boolean,
  "verificationNote": string
}`,
      {
        label: `verify:${site.siteId}`,
        phase: 'Type Verification',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['siteId', 'verified', 'verificationNote'],
          properties: {
            siteId: { type: 'string' },
            verified: { type: 'boolean' },
            verificationNote: { type: 'string' },
          },
        },
        effort: 'medium',
        model: 'claude-3.5-sonnet',
      },
    )

    return verification ?? {
      siteId: site.siteId,
      verified: false,
      verificationNote: 'Verification subagent failed or was skipped.',
    }
  }),
)

phase('Report')
log('Compiling migration report.')

const report = sites.map((site, idx) => {
  const migration = migrationResults[idx]
  const verification = verificationResults[idx]
  const plan = planBySite.get(site.siteId)

  const status = migration?.status ?? 'manual_attention'
  const typeCheck = migration?.typeCheck ?? 'unknown'
  const verified = verification?.verified ?? false

  return {
    siteId: site.siteId,
    risk: plan?.migrationRisk ?? 'unknown',
    status,
    changed: migration?.changed ?? false,
    typeCheck,
    verified,
    reason:
      migration?.reason ??
      verification?.verificationNote ??
      'No result returned by migration or verification subagent.',
    diffSummary: migration?.diffSummary ?? '',
    needsManualAttention: status !== 'migrated' || typeCheck !== 'pass' || !verified,
  }
})

const summary = {
  totalSites: sites.length,
  migrated: report.filter((r) => r.status === 'migrated' && r.typeCheck === 'pass' && r.verified).length,
  manualAttention: report.filter((r) => r.needsManualAttention).length,
  details: report,
}

log(
  `Done: ${summary.migrated} migrated, ${summary.manualAttention} need manual attention out of ${summary.totalSites}.`,
)

summary
```

> **Claude judge:** The script fans out all 35 agents in a single parallel() call with no wave bounding (~6-8 items), no per-agent retry or timeout/watchdog, no per-wave result commits (hard barrier before synthesis), no ScheduleWakeup stall detection, no backoff on high failure rates, and no cache-stable/resume mechanism. Positives include null-tolerance in the report phase (fallback values for missing results), lean schemas with additionalProperties:false, and synthesis that explicitly flags gaps via needsManualAttention. Overall the script is missing most of the safety-by-construction properties required for large parallel fan-out.

## With skill — rubric 78%, patterns 75%

```js
export const meta = {
  name: 'fetchUser-to-getUser-migration-swarm',
  description: 'Migrate 35 call sites from fetchUser(id) to getUser({ id }) with isolated verification and reporting',
  phases: [
    { title: 'Plan' },
    { title: 'Migration Wave 1' },
    { title: 'Migration Wave 2' },
    { title: 'Migration Wave 3' },
    { title: 'Migration Wave 4' },
    { title: 'Retry' },
    { title: 'Synthesize' },
  ],
}

const CALL_SITES = [
  { key: 'cs01', file: 'src/sites/site01.ts', symbol: 'fetchUser(id) call site #1' },
  { key: 'cs02', file: 'src/sites/site02.ts', symbol: 'fetchUser(id) call site #2' },
  { key: 'cs03', file: 'src/sites/site03.ts', symbol: 'fetchUser(id) call site #3' },
  { key: 'cs04', file: 'src/sites/site04.ts', symbol: 'fetchUser(id) call site #4' },
  { key: 'cs05', file: 'src/sites/site05.ts', symbol: 'fetchUser(id) call site #5' },
  { key: 'cs06', file: 'src/sites/site06.ts', symbol: 'fetchUser(id) call site #6' },
  { key: 'cs07', file: 'src/sites/site07.ts', symbol: 'fetchUser(id) call site #7' },
  { key: 'cs08', file: 'src/sites/site08.ts', symbol: 'fetchUser(id) call site #8' },
  { key: 'cs09', file: 'src/sites/site09.ts', symbol: 'fetchUser(id) call site #9' },
  { key: 'cs10', file: 'src/sites/site10.ts', symbol: 'fetchUser(id) call site #10' },
  { key: 'cs11', file: 'src/sites/site11.ts', symbol: 'fetchUser(id) call site #11' },
  { key: 'cs12', file: 'src/sites/site12.ts', symbol: 'fetchUser(id) call site #12' },
  { key: 'cs13', file: 'src/sites/site13.ts', symbol: 'fetchUser(id) call site #13' },
  { key: 'cs14', file: 'src/sites/site14.ts', symbol: 'fetchUser(id) call site #14' },
  { key: 'cs15', file: 'src/sites/site15.ts', symbol: 'fetchUser(id) call site #15' },
  { key: 'cs16', file: 'src/sites/site16.ts', symbol: 'fetchUser(id) call site #16' },
  { key: 'cs17', file: 'src/sites/site17.ts', symbol: 'fetchUser(id) call site #17' },
  { key: 'cs18', file: 'src/sites/site18.ts', symbol: 'fetchUser(id) call site #18' },
  { key: 'cs19', file: 'src/sites/site19.ts', symbol: 'fetchUser(id) call site #19' },
  { key: 'cs20', file: 'src/sites/site20.ts', symbol: 'fetchUser(id) call site #20' },
  { key: 'cs21', file: 'src/sites/site21.ts', symbol: 'fetchUser(id) call site #21' },
  { key: 'cs22', file: 'src/sites/site22.ts', symbol: 'fetchUser(id) call site #22' },
  { key: 'cs23', file: 'src/sites/site23.ts', symbol: 'fetchUser(id) call site #23' },
  { key: 'cs24', file: 'src/sites/site24.ts', symbol: 'fetchUser(id) call site #24' },
  { key: 'cs25', file: 'src/sites/site25.ts', symbol: 'fetchUser(id) call site #25' },
  { key: 'cs26', file: 'src/sites/site26.ts', symbol: 'fetchUser(id) call site #26' },
  { key: 'cs27', file: 'src/sites/site27.ts', symbol: 'fetchUser(id) call site #27' },
  { key: 'cs28', file: 'src/sites/site28.ts', symbol: 'fetchUser(id) call site #28' },
  { key: 'cs29', file: 'src/sites/site29.ts', symbol: 'fetchUser(id) call site #29' },
  { key: 'cs30', file: 'src/sites/site30.ts', symbol: 'fetchUser(id) call site #30' },
  { key: 'cs31', file: 'src/sites/site31.ts', symbol: 'fetchUser(id) call site #31' },
  { key: 'cs32', file: 'src/sites/site32.ts', symbol: 'fetchUser(id) call site #32' },
  { key: 'cs33', file: 'src/sites/site33.ts', symbol: 'fetchUser(id) call site #33' },
  { key: 'cs34', file: 'src/sites/site34.ts', symbol: 'fetchUser(id) call site #34' },
  { key: 'cs35', file: 'src/sites/site35.ts', symbol: 'fetchUser(id) call site #35' },
]

const WAVE_SIZE = 7
const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const MIGRATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'key',
    'file',
    'status',
    'changed',
    'typeCorrect',
    'why',
    'manualAttention',
    'notes',
  ],
  properties: {
    key: { type: 'string' },
    file: { type: 'string' },
    status: { type: 'string', enum: ['migrated', 'manual_attention', 'blocked'] },
    changed: { type: 'boolean' },
    typeCorrect: { type: 'boolean' },
    why: { type: 'string' },
    manualAttention: { type: 'boolean' },
    notes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
}

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'migrated', 'manualAttention', 'blocked', 'gaps'],
  properties: {
    summary: { type: 'string' },
    migrated: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'file', 'why'],
        properties: {
          key: { type: 'string' },
          file: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
    manualAttention: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'file', 'why'],
        properties: {
          key: { type: 'string' },
          file: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
    blocked: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'file', 'why'],
        properties: {
          key: { type: 'string' },
          file: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
    gaps: {
      type: 'array',
      items: { type: 'string' },
    },
  },
}

function buildPrompt(site) {
  return [
    `Migrate exactly one isolated call site from deprecated fetchUser(id) to getUser({ id }).`,
    `Target site: ${site.key} in ${site.file}.`,
    `Context: ${site.symbol}.`,
    `Requirements:`,
    `- Update the call site to the new API shape getUser({ id }).`,
    `- Verify the change is type-correct at the call site level.`,
    `- If the migration cannot be done safely without broader code changes, mark it manual_attention or blocked.`,
    `- Keep the output lean and specific to this single site.`,
    `- Return only the schema fields.`,
    `- Explain briefly why the site is migrated or why manual attention is needed.`,
    `- If there is an overload, union, optional id, destructuring mismatch, or inferred type issue, call that out.`,
  ].join('\n')
}

function buildReportPrompt(done, missing, partialItems) {
  const payload = {
    migrated_or_reviewed: done.map(r => ({
      key: r.key,
      file: r.file,
      status: r.status,
      typeCorrect: r.typeCorrect,
      manualAttention: r.manualAttention,
      why: r.why,
    })),
    missing_sites: missing,
    partial_items: partialItems,
  }
  return [
    `Synthesize a migration report for a call-site swarm that migrated fetchUser(id) to getUser({ id }).`,
    `Use the embedded JSON as the source of truth and flag gaps explicitly; do not silently omit missing items.`,
    `Produce concise sections for migrated, manual attention, blocked, and gaps.`,
    `Explain whether the migration was type-correct for each migrated site.`,
    `If an item is missing or unresolved, put it in gaps and explain the likely reason.`,
    `JSON payload:`,
    JSON.stringify(payload),
  ].join('\n')
}

function runMigration(site) {
  return agent(buildPrompt(site), {
    label: `migrate:${site.key}`,
    phase: 'Migration Wave',
    schema: MIGRATION_SCHEMA,
    model: 'claude-sonnet-4-5',
    effort: 'medium',
    isolation: 'worktree',
  })
}

phase('Plan')
log(`Planning migration swarm for ${CALL_SITES.length} call sites`)

const waves = chunk(CALL_SITES, WAVE_SIZE)
const done = []
let failed = []

for (let w = 0; w < waves.length; w++) {
  phase(`Migration Wave ${w + 1}/${waves.length}`)
  const wave = waves[w]
  const batch = await parallel(
    wave.map(site => () => runMigration(site))
  )

  batch.forEach((result, i) => {
    if (result) done.push(result)
    else failed.push(wave[i])
  })

  const nulls = batch.filter(r => r === null).length
  log(`Wave ${w + 1}: ${done.length}/${CALL_SITES.length} complete, ${failed.length} pending retry`)

  if (batch.length > 0 && nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} failed this wave — backing off; return partial, resume later`)
    break
  }
}

if (failed.length) {
  phase('Retry')
  const retried = await parallel(failed.map(site => () => runMigration(site)))
  const stillFailed = []
  retried.forEach((result, i) => {
    if (result) done.push(result)
    else stillFailed.push(failed[i])
  })
  failed = stillFailed
  log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

const seen = new Set(done.map(r => r.key))
const missing = CALL_SITES.filter(site => !seen.has(site.key)).map(site => site.key)

if (missing.length) {
  log(`⚠ partial: missing ${missing.length}/${CALL_SITES.length}: ${missing.join(', ')}`)
}

phase('Synthesize')

const migrated = done
  .filter(r => r.status === 'migrated' && r.typeCorrect)
  .map(r => ({ key: r.key, file: r.file, why: r.why }))

const manualAttention = done
  .filter(r => r.status === 'manual_attention' || (r.changed && !r.typeCorrect) || r.manualAttention)
  .map(r => ({ key: r.key, file: r.file, why: r.why }))

const blocked = done
  .filter(r => r.status === 'blocked')
  .map(r => ({ key: r.key, file: r.file, why: r.why }))

const partialItems = done
  .slice()
  .sort((a, b) => (a.key > b.key ? 1 : a.key < b.key ? -1 : 0))
  .map(r => ({
    key: r.key,
    file: r.file,
    status: r.status,
    typeCorrect: r.typeCorrect,
    manualAttention: r.manualAttention,
    why: r.why,
  }))

const report = await agent(
  buildReportPrompt(done, missing, partialItems),
  {
    label: 'synth-report',
    phase: 'Synthesize',
    schema: REPORT_SCHEMA,
    model: 'claude-sonnet-4-5',
    effort: 'high',
  }
)

return {
  summary: report?.summary ?? `Processed ${done.length}/${CALL_SITES.length} sites; ${missing.length} missing.`,
  migrated,
  manualAttention,
  blocked,
  gaps: report?.gaps ?? missing,
  details: done,
  missing,
  report,
}
```

> **Claude judge:** The script implements bounded waves of 7, per-wave null-tolerance with a dedicated retry phase, incremental result commitment, deterministic prompts, strict schemas, gap-flagging synthesis, and a >40% failure-rate backoff. The sole missing safety property is an armed stall watchdog (ScheduleWakeup), which means a single hung agent connection could deadlock a wave indefinitely with no notification.

