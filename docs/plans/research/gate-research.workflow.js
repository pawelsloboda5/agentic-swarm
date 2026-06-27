export const meta = {
  name: 'gate-library-and-versioning-research',
  description: 'Research the MVP gate library (tiers, self-contained criteria, verifiers, enhancers) + plugin versioning strategy, to get ready for the still-open harness decisions',
  phases: [
    { title: 'Research', detail: '6 subareas (4 candidate gates + runner/degradation + versioning), waves of 3' },
    { title: 'Retry', detail: 'retry wave over any dropped agents' },
    { title: 'Synthesize', detail: 'MVP gate-library spec + gate-runner contract + versioning recommendation' },
  ],
}

// Shared context injected into every research brief (the converged design + portability constraint).
const CTX = [
  'HARNESS CONTEXT: we are designing (not yet building) a portable, public Claude Code PLUGIN harness',
  'that turns a one-line GOAL into excellent, complete output via: Phase0 research/decompose/select-gates',
  '-> Phase1 synthesize per-workstream BRIEFS that forward-couple the named GATES into the brief',
  '-> Phase2 SAFE bounded-wave fan-out -> Phase3 GATED INTEGRATION (each output verified against its gates).',
  'CONVERGED DECISIONS: (a) gates are TIERED + OBJECTIVE-ANCHORED and REPORT confidence -- tier in',
  "{'objective' = machine check (test/build/lint/measurable), 'critic' = separate-context LLM judge with",
  "binary per-criterion checks + one grounded pass, 'advisory' = surfaced but not a hard pass}. (b) PORTABILITY",
  'is load-bearing: every gate ships SELF-CONTAINED criteria + verifier that work with ZERO external skills;',
  'external skills are OPTIONAL enhancers wired in only IF installed; a gate must DEGRADE GRACEFULLY and never',
  'turn graceful degradation into SILENT quality degradation. Gates will live in skills/swarm-architect/gates/',
  '(one file per gate: id, applies_when, tier, criteria, verifier, confidence, backing_skill).',
  'LOCAL OPTIONAL-ENHANCER SKILLS that exist on THIS machine (SEPARATE plugins other users will NOT have, so',
  'treat as optional only): frontend-design, ui-ux-pro-max, web-design-guidelines, responsive-ui-audit,',
  'wcag-aa-contrast-remediation, vercel:react-best-practices. The lesson driving all of this: a bare swarm does',
  'NOT auto-improve quality -- the gate layer is the quality lever, so a gate that just rubber-stamps is theater.',
].join(' ')

const SUBAREAS = [
  {
    key: 'gate-tests',
    kind: 'gate',
    title: 'TESTS gate',
    focus: 'How to ship a self-contained, OBJECTIVE-tier tests gate. What machine-checkable criteria are portable across project types (detect + run the project test command, require exit 0; new/changed code has tests; coverage threshold if a report exists; build/typecheck passes). How to detect the test runner generically (node:test/vitest/jest/pytest/go test) without assuming one. Verifier shape. Optional enhancers. How it degrades with zero external skills. Is it MVP?',
  },
  {
    key: 'gate-assets',
    kind: 'gate',
    title: 'ASSETS gate (no placeholders / real assets)',
    focus: 'How to ship a mostly-OBJECTIVE assets gate that proves outputs use REAL assets, not placeholders. Machine-checkable: detect placeholder markers (lorem ipsum, placeholder.com / via.placeholder / dummyimage URLs, empty/missing src/href, TODO/FIXME asset notes, 0-byte or missing referenced files, missing favicon), validate SVG/icon well-formedness, flag obvious AI-generic filler. What tools (grep patterns, an SVG validator like svgo, simple file-existence checks, an HTML link/asset checker). Verifier shape, enhancers, zero-skill degradation. MVP?',
  },
  {
    key: 'gate-ui-ux',
    kind: 'gate',
    title: 'UI-UX gate (inherently CRITIC-tier)',
    focus: 'How to ship a CRITIC-tier ui-ux gate that genuinely discriminates quality without being theater. Bundled binary per-criterion checks (visual hierarchy present, consistent spacing scale, deliberate type pairing, sufficient contrast, responsive at key breakpoints, NOT a generic AI-default aesthetic, interactive states present). How to run it as a SEPARATE-CONTEXT critic; whether to use a rendered screenshot (Playwright) vs static code review; how to keep it to one grounded pass. Optional enhancers (frontend-design, ui-ux-pro-max, web-design-guidelines, responsive-ui-audit). Zero-skill degradation. MVP?',
  },
  {
    key: 'gate-a11y',
    kind: 'gate',
    title: 'A11Y gate (MIXED: objective + critic)',
    focus: 'How to ship a MIXED a11y gate. OBJECTIVE part: WCAG AA contrast math (provide the formula so it needs no skill), alt-text presence, form-label/ARIA presence, tap-target size, run an automated checker (axe-core / pa11y / Lighthouse a11y) if available. CRITIC part: keyboard/focus order, semantic structure. What tools, verifier shape, enhancers (wcag-aa-contrast-remediation, responsive-ui-audit, web-design-guidelines). Zero-skill degradation (bundled contrast formula + heuristics). Should a11y be IN the MVP set or the next tier?',
  },
  {
    key: 'gate-runner-degradation',
    kind: 'design',
    title: 'Gate-runner contract + graceful degradation + skill detection',
    focus: 'The design glue (not a single gate): how the orchestrator should (1) DETECT which optional backing skills are installed at runtime in Claude Code, (2) wire them in if present else fall back to bundled criteria, (3) run a gate as objective-check OR separate-context critic, (4) REPORT tier + confidence + pass/flag without silent passes, (5) iterate failures (re-brief/re-run) vs honestly flag. How is skill availability discoverable to a skill/orchestrator in Claude Code? Keep it portable + zero-dep. Cite Claude Code docs where relevant.',
  },
  {
    key: 'versioning-release',
    kind: 'versioning',
    title: 'Plugin versioning + release strategy',
    focus: 'Recommend the versioning/release track. KNOWN REPO STATE: main is at tag v0.4.0 (released); v0.1.0-v0.4.0 shipped; the harness + robustness-eval work lives UNMERGED on branch feat/loop-demo-v0.5.0 (commit 35b1afa). QUESTION 1: is the architect harness a v0.5 -> v1.0 track, or does the harness itself become v1.0 with v0.5.x as interim? QUESTION 2: does the standalone robustness eval get its OWN tag (v0.5.0) or only ship folded into the harness? Research: Claude Code plugin marketplace versioning conventions, semver for plugins, CHANGELOG/release practices. READ the repo: .claude-plugin/ manifests (plugin.json / marketplace.json) and CHANGELOG.md if present, to ground the current version + cadence. Give a concrete recommended version plan.',
  },
]

const FINDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['subarea', 'title', 'summary', 'key_findings', 'recommendation', 'evidence_urls'],
  properties: {
    subarea: { type: 'string', description: 'set to EXACTLY the provided key string (e.g. gate-tests)' },
    title: { type: 'string' },
    summary: { type: 'string', description: 'one sentence' },
    key_findings: { type: 'array', maxItems: 6, items: { type: 'string' } },
    recommendation: { type: 'string', description: 'the actionable recommendation for THIS subarea (gate include?+tier, or the version plan, or the runner/degradation contract)' },
    recommended_tier: { type: 'string', description: 'objective | critic | mixed | advisory | n/a (for gates only)' },
    objective_checks: { type: 'array', maxItems: 5, items: { type: 'string' }, description: 'machine-checkable checks + the tool/command' },
    self_contained_criteria: { type: 'array', maxItems: 6, items: { type: 'string' }, description: 'bundled pass conditions needing ZERO external skills' },
    optional_enhancers: { type: 'array', maxItems: 4, items: { type: 'string' }, description: 'format: "skill-name: what it adds" (external, may be absent)' },
    degradation_note: { type: 'string', description: 'how it works with zero external skills' },
    recommended_tools: { type: 'array', maxItems: 4, items: { type: 'string' }, description: 'real, current tools/libs (prefer Context7/official-doc verified)' },
    pitfalls: { type: 'array', maxItems: 3, items: { type: 'string' } },
    evidence_urls: { type: 'array', maxItems: 3, items: { type: 'string' } },
  },
}

const SYNTH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['mvp_gate_set', 'gate_runner_contract', 'versioning_recommendation', 'open_questions_for_user', 'risks'],
  properties: {
    mvp_gate_set: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['gate', 'tier', 'include', 'rationale'],
        properties: {
          gate: { type: 'string' },
          tier: { type: 'string' },
          include: { type: 'boolean', description: 'include in the MVP set?' },
          one_line_criteria: { type: 'string' },
          primary_objective_check: { type: 'string', description: 'the load-bearing machine check, or n/a' },
          optional_enhancers: { type: 'array', maxItems: 4, items: { type: 'string' } },
          rationale: { type: 'string' },
        },
      },
    },
    gate_library_roadmap: { type: 'array', maxItems: 8, items: { type: 'string' }, description: 'gates beyond the MVP + when to add them' },
    gate_runner_contract: { type: 'string', description: 'how a gate runs: detect-skill -> objective OR separate-context critic -> report tier+confidence -> iterate or flag; degradation' },
    versioning_recommendation: { type: 'string', description: 'the concrete version plan + robustness-eval tag decision' },
    open_questions_for_user: { type: 'array', maxItems: 4, items: { type: 'string' } },
    risks: { type: 'array', maxItems: 5, items: { type: 'string' } },
  },
}

function buildPrompt(sub) {
  return [
    `You are a research subagent for a DESIGN-READINESS swarm. Research ONE subarea and return ONLY the schema object (your output IS data, not prose).`,
    ``,
    CTX,
    ``,
    `SUBAREA (kind=${sub.kind}): ${sub.title}`,
    `FOCUS: ${sub.focus}`,
    ``,
    `IMPORTANT: set the "subarea" field to EXACTLY this key string: "${sub.key}"`,
    ``,
    sub.kind === 'gate'
      ? `Fill: recommended_tier, self_contained_criteria (zero-dep bundled pass conditions), objective_checks (machine-checkable + tool), optional_enhancers ("skill: what it adds"), degradation_note, recommended_tools, pitfalls, plus a clear recommendation on whether this gate belongs in the MVP set {currently proposed: ui-ux, assets, tests}.`
      : sub.kind === 'versioning'
        ? `Use the Read tool on the repo's .claude-plugin manifests and CHANGELOG.md to ground the current version; WebSearch Claude Code plugin marketplace versioning conventions + semver. Put the concrete version plan in "recommendation"; leave gate-only fields empty/n-a.`
        : `Use WebSearch + Claude Code docs (and the Read tool on this repo's skill/manifest files) as needed. Put the runner/degradation contract recommendation in "recommendation" and the mechanics in key_findings; leave gate-only fields as n/a where they don't apply.`,
    ``,
    `Use Context7 or official docs to VERIFY any specific tool/library/API before asserting it; note recency. Be concise; cap evidence to <=3 URLs; link sources, no long quotes.`,
  ].join('\n')
}

// ---- Safe-swarm wave loop (Patterns 1,2,3,5,7,8) ----
const WAVE_SIZE = 3
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }

function runItem(sub) {
  return agent(buildPrompt(sub), { label: `research:${sub.key}`, phase: 'Research', schema: FINDING_SCHEMA, effort: 'medium' })
}

const waves = chunk(SUBAREAS, WAVE_SIZE)
const done = []
let failed = []
for (let w = 0; w < waves.length; w++) {
  phase('Research')
  log(`Wave ${w + 1}/${waves.length}: ${waves[w].map(s => s.key).join(', ')}`)
  const batch = await parallel(waves[w].map(sub => () => runItem(sub)))
  batch.forEach((r, i) => (r ? done.push(r) : failed.push(waves[w][i])))
  log(`Wave ${w + 1}: ${done.length}/${SUBAREAS.length} ok, ${failed.length} to retry`)
  const nulls = batch.filter(r => r === null).length
  if (nulls / batch.length > 0.4) {
    log(`instability: ${nulls}/${batch.length} failed this wave - backing off; returning partial, resume later`)
    break
  }
}

if (failed.length) {
  phase('Retry')
  const retried = await parallel(failed.map(sub => () => runItem(sub)))
  const stillFailed = []
  retried.forEach((r, i) => (r ? done.push(r) : stillFailed.push(failed[i])))
  failed = stillFailed
  log(`Retry recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

// Coverage check now keyed on the pinned subarea==key (bug fixed from the last run)
const haveKeys = new Set(done.map(r => r.subarea))
const missing = SUBAREAS.filter(s => !haveKeys.has(s.key)).map(s => s.key)
if (missing.length) log(`partial: missing ${missing.length}/${SUBAREAS.length}: ${missing.join(', ')}`)

// ---- Synthesis (Pattern 5: embed inputs so it re-runs over the fuller set on resume) ----
const payload = JSON.stringify([...done].sort((a, b) => (a.subarea > b.subarea ? 1 : -1)))
phase('Synthesize')
const synthesis = await agent(
  [
    `You are the synthesis agent for the design-readiness swarm. Produce ONLY the schema object.`,
    ``,
    CTX,
    ``,
    `RESEARCH FINDINGS (${done.length}/${SUBAREAS.length}; missing: ${JSON.stringify(missing)}):`,
    payload,
    ``,
    `TASKS:`,
    `1. mvp_gate_set: for each candidate gate (tests, assets, ui-ux, a11y -- and say if any should be deferred), give gate, tier, include(bool), one_line_criteria, primary_objective_check (or n/a), optional_enhancers, rationale. Honor objective-anchored + portability.`,
    `2. gate_library_roadmap: gates beyond MVP (security, api-contract, docs, perf, data-viz) + when.`,
    `3. gate_runner_contract: the concrete contract for how a gate runs (detect skill -> objective OR separate-context critic -> report tier+confidence -> iterate or flag) and how it degrades gracefully without silent quality loss.`,
    `4. versioning_recommendation: the concrete version plan (v0.5 -> v1.0 track?) and whether the robustness eval gets its own tag.`,
    `5. open_questions_for_user (<=4): the specific decisions the user must confirm.`,
    `6. risks (<=5).`,
    `Flag any gap from missing subareas; never treat partial as complete.`,
  ].join('\n'),
  { label: 'synthesis', phase: 'Synthesize', schema: SYNTH_SCHEMA, effort: 'high' }
)

return { findings: done, missing, synthesis }
