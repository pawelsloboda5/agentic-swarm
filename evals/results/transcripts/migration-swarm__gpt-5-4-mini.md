# migration-swarm — `gpt-5.4-mini`

> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task below. The **with-skill** variant additionally injects the live [`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: [baseline](../../prompts/rendered/baseline.example.md) · [with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.

**Task**

> Write a Claude Code Workflow script for a MIGRATION SWARM: migrate 35 call sites from the deprecated `fetchUser(id)` API to the new `getUser({ id })` API. Each call site is handled by its own subagent in isolation; verify each migration is type-correct; produce a report of which sites migrated, which need manual attention, and why.

---

## Baseline (no skill) — rubric 20%, patterns 25%

```js
export const meta = {
  name: 'migration-swarm-fetchUser-to-getUser',
  description: 'Migrates 35 fetchUser(id) call sites to getUser({ id }) in isolated subagents, with type-correctness verification and a final report.',
  phases: [
    { title: 'Plan migration swarm' },
    { title: 'Migrate call sites in isolation' },
    { title: 'Verify type correctness' },
    { title: 'Synthesize report' },
  ],
}

phase('Plan migration swarm')
log('Preparing a 35-item migration swarm for fetchUser(id) -> getUser({ id }) call-site updates.')

const callSites = Array.from({ length: 35 }, (_, i) => ({
  siteId: `call-site-${String(i + 1).padStart(2, '0')}`,
  index: i + 1,
}))

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['siteId', 'status', 'migrated', 'typeCorrect', 'needsManualAttention', 'reason', 'summary'],
  properties: {
    siteId: { type: 'string' },
    status: { type: 'string', enum: ['migrated', 'manual_attention', 'failed'] },
    migrated: { type: 'boolean' },
    typeCorrect: { type: 'boolean' },
    needsManualAttention: { type: 'boolean' },
    reason: { type: 'string' },
    summary: { type: 'string' },
  },
}

const results = await parallel(
  callSites.map((site) => async () => {
    const prompt = `
You are handling ONE isolated migration task in a migration swarm.

Task:
- Migrate call site ${site.siteId} (${site.index}/35) from deprecated fetchUser(id) to getUser({ id }).
- Treat this as an isolated subtask; do not assume other call sites exist in the same edit context.
- Verify the migration is type-correct.
- If the call site can be safely migrated, produce the migrated result.
- If type-correct migration is ambiguous, risky, or requires broader context, mark it for manual attention and explain why.

Required output:
- Return a JSON object matching the schema exactly.
- siteId must be "${site.siteId}".
- status must be one of: migrated, manual_attention, failed.
- migrated must be true only if you safely migrated this site.
- typeCorrect must be true only if you verified the migrated form is type-correct.
- needsManualAttention must be true whenever the site should be reviewed by a human.
- reason should be concise but specific.
- summary should be a short one-line description of the action taken.

Migration target:
- Deprecated: fetchUser(id)
- New API: getUser({ id })

Typical correct transformation:
- fetchUser(userId) -> getUser({ id: userId })

Potential manual-attention cases:
- Nontrivial expression/side effect in id position
- Overloaded or variadic usage
- Already partially migrated or wrapped in a helper
- Unclear type expectations for the new object parameter
- Any case where type correctness cannot be confidently established
`.trim()

    return await agent(prompt, {
      label: site.siteId,
      phase: 'Migrate call sites in isolation',
      schema,
      effort: 'high',
      isolation: 'worktree',
    })
  })
)

phase('Verify type correctness')
log('Checking migrated sites for type correctness and collecting manual-attention reasons.')

const migrated = []
const manualAttention = []
const failed = []

for (const item of results) {
  if (!item) {
    failed.push({
      siteId: 'unknown',
      migrated: false,
      typeCorrect: false,
      needsManualAttention: true,
      reason: 'Subagent failed or was skipped due to a terminal runtime/API issue.',
      summary: 'Migration could not be completed.',
    })
    continue
  }

  if (item.status === 'migrated' && item.migrated && item.typeCorrect && !item.needsManualAttention) {
    migrated.push(item)
  } else if (item.status === 'manual_attention' || item.needsManualAttention || !item.typeCorrect) {
    manualAttention.push({
      ...item,
      migrated: Boolean(item.migrated),
      typeCorrect: Boolean(item.typeCorrect),
      needsManualAttention: true,
      status: 'manual_attention',
    })
  } else {
    failed.push({
      ...item,
      needsManualAttention: true,
      status: 'failed',
      reason: item.reason || 'Migration result did not satisfy the required type-correctness constraints.',
    })
  }
}

phase('Synthesize report')

const report = {
  totals: {
    requested: 35,
    migrated: migrated.length,
    manualAttention: manualAttention.length,
    failed: failed.length,
  },
  migratedSites: migrated.map(({ siteId, summary, reason }) => ({
    siteId,
    summary,
    note: reason,
  })),
  manualAttentionSites: manualAttention.map(({ siteId, reason, summary, typeCorrect, migrated }) => ({
    siteId,
    reason,
    summary,
    migrated,
    typeCorrect,
  })),
  failedSites: failed.map(({ siteId, reason, summary }) => ({
    siteId,
    reason,
    summary,
  })),
  notes: [
    'Each call site was handled by its own isolated subagent.',
    'Type correctness was required for a site to be counted as successfully migrated.',
    'Sites flagged manual_attention should be reviewed before merging.',
  ],
}

log(`Completed migration swarm: ${report.totals.migrated} migrated, ${report.totals.manualAttention} need manual attention, ${report.totals.failed} failed.`)

report
```

> **GPT-5.5 judge:** The script uses a single unbounded parallel() fan-out over all 35 agents with no bounded waves, no ScheduleWakeup stall watchdog, no per-agent retry, no per-wave checkpoint/commit, and no high-failure-rate backoff. Because results are only processed after the full parallel() completes, one hung agent could deadlock the whole run with no notification, and completed work is not durably synthesized until the hard barrier finishes. It does have a lean strict schema, some null/failed-result tolerance after completion, and a final report that flags manual/failed items, but those protections do not address the main large fan-out safety risks.

## With skill — rubric 70%, patterns 75%

```js
export const meta = {
  name: 'migrate-fetchUser-to-getUser-swarm',
  description: 'Migrate 35 call sites from fetchUser(id) to getUser({ id }) with verification and report.',
  phases: [
    { title: 'Plan' },
    { title: 'Migrate' },
    { title: 'Verify' },
    { title: 'Report' },
  ],
}

const CALL_SITES = Array.from({ length: 35 }, (_, i) => ({
  key: `site-${String(i + 1).padStart(2, '0')}`,
  // Stable identifiers only; replace these labels with your actual call-site inventory in args.
  file: `call-site-${String(i + 1).padStart(2, '0')}.ts`,
  location: `line:${i + 1}`,
}))

const WAVE_SIZE = 7
const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const MIGRATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['key', 'file', 'location', 'status', 'reason', 'before', 'after', 'typeCheck'],
  properties: {
    key: { type: 'string' },
    file: { type: 'string' },
    location: { type: 'string' },
    status: { type: 'string', enum: ['migrated', 'manual_attention'] },
    reason: { type: 'string' },
    before: { type: 'string' },
    after: { type: 'string' },
    typeCheck: {
      type: 'object',
      additionalProperties: false,
      required: ['passed', 'details'],
      properties: {
        passed: { type: 'boolean' },
        details: { type: 'string' },
      },
    },
  },
}

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'migrated', 'manualAttention', 'gaps', 'notes'],
  properties: {
    summary: {
      type: 'object',
      additionalProperties: false,
      required: ['total', 'migrated', 'manualAttention', 'typeCheckPassed', 'typeCheckFailed'],
      properties: {
        total: { type: 'integer' },
        migrated: { type: 'integer' },
        manualAttention: { type: 'integer' },
        typeCheckPassed: { type: 'integer' },
        typeCheckFailed: { type: 'integer' },
      },
    },
    migrated: {
      type: 'array',
      maxItems: 35,
      items: MIGRATION_SCHEMA,
    },
    manualAttention: {
      type: 'array',
      maxItems: 35,
      items: MIGRATION_SCHEMA,
    },
    gaps: {
      type: 'array',
      maxItems: 50,
      items: { type: 'string' },
    },
    notes: {
      type: 'array',
      maxItems: 50,
      items: { type: 'string' },
    },
  },
}

const stablePromptFor = (site) => `
You are migrating one call site in isolation.

Task:
- Migrate the deprecated API call from fetchUser(id) to getUser({ id }).
- Preserve semantics and surrounding behavior.
- Verify the migration is type-correct.
- If the migration is unsafe, ambiguous, or requires broader code changes, mark it for manual attention.

Constraints:
- Handle only this single call site.
- Keep output lean and structured.
- Do not invent unrelated changes.
- Return exact before/after snippets when possible.
- Explain any type issue clearly and briefly.

Call site:
- key: ${site.key}
- file: ${site.file}
- location: ${site.location}

Required output fields:
- key
- file
- location
- status: "migrated" | "manual_attention"
- reason
- before
- after
- typeCheck: { passed: boolean, details: string }

Assume the new API shape is:
getUser({ id })

If the call site already uses getUser correctly, report it as migrated and mention it is already aligned.
`

phase('Plan')

const sites = Array.isArray(args?.callSites) && args.callSites.length ? args.callSites : CALL_SITES
const waves = chunk(sites, WAVE_SIZE)

log(`Planning migration swarm for ${sites.length} call sites in ${waves.length} waves`)

const processSite = async (site) =>
  agent(stablePromptFor(site), {
    label: `migrate:${site.key}`,
    phase: 'Migrate',
    schema: MIGRATION_SCHEMA,
    effort: 'medium',
    isolation: 'worktree',
  })

const done = []
let failed = []

for (let w = 0; w < waves.length; w++) {
  phase(`Migrate wave ${w + 1}/${waves.length}`)
  const batch = await parallel(waves[w].map((site) => () => processSite(site)))

  batch.forEach((r, i) => {
    if (r) done.push(r)
    else failed.push(waves[w][i])
  })

  const nulls = batch.filter((r) => r === null).length
  log(`Wave ${w + 1}: migrated=${done.length}, retry=${failed.length}, nulls=${nulls}/${batch.length}`)

  if (batch.length && nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} failed this wave — backing off; return partial, resume later`)
    break
  }
}

if (failed.length) {
  phase('Retry')
  log(`Retrying ${failed.length} call sites after primary waves`)

  const retried = await parallel(failed.map((site) => () => processSite(site)))
  const stillFailed = []

  retried.forEach((r, i) => {
    if (r) done.push(r)
    else stillFailed.push(failed[i])
  })

  failed = stillFailed
  log(`Retry wave recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

const migrated = done.filter((r) => r.status === 'migrated')
const manualAttention = done.filter((r) => r.status === 'manual_attention')

const haveKeys = new Set(done.map((r) => r.key))
const missing = sites.filter((site) => !haveKeys.has(site.key)).map((site) => site.key)

if (missing.length) {
  log(`⚠ partial: missing ${missing.length}/${sites.length}: ${missing.join(', ')}`)
}

phase('Report')

const report = await agent(
  `Synthesize a migration report from these results.

Rules:
- Be explicit about what migrated and what needs manual attention.
- Flag all gaps and uncertainties.
- Include type-check outcomes.
- Keep the report concise but useful.
- Do not silently drop missing call sites.

Inputs:
${JSON.stringify(
    {
      total: sites.length,
      migrated,
      manualAttention,
      missing,
      results: done,
    },
    null,
    2,
  )}`,
  {
    label: 'migration-report',
    phase: 'Report',
    schema: REPORT_SCHEMA,
    effort: 'high',
  },
)

return {
  summary: {
    total: sites.length,
    migrated: migrated.length,
    manualAttention: manualAttention.length,
    typeCheckPassed: done.filter((r) => r.typeCheck?.passed).length,
    typeCheckFailed: done.filter((r) => !r.typeCheck?.passed).length,
  },
  migrated,
  manualAttention,
  missing,
  report,
}
```

> **GPT-5.5 judge:** The script uses bounded waves of 7, accumulates completed results across waves, retries null/failed items once, tolerates partial completion by tracking missing keys, uses structured/capped schemas, asks the report to flag gaps, and backs off when a wave has a high null rate. However, it has no armed ScheduleWakeup/stall watchdog or per-agent timeout, so a single hung agent/parallel call can still deadlock the whole run with no notification. It also does not durably checkpoint per-wave results or implement a true resume/cache mechanism beyond stable prompts. Overall it meets many loss/truncation safeguards but misses the key hung-connection protection.

