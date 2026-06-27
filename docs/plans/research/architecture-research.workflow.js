export const meta = {
  name: 'swarm-architecture-research',
  description: 'Bounded research swarm over multi-agent orchestration architectures, to ground the v1.0 quality-layer harness design',
  phases: [
    { title: 'Research', detail: '8 subareas (frameworks + cross-cutting patterns), waves of 4' },
    { title: 'Retry', detail: 'retry wave over any dropped agents' },
    { title: 'Synthesize', detail: 'viable-architectures comparison + novelty assessment + recommendation' },
  ],
}

// ---- Work-list embedded inline (args were unreliable last session; keep it in the script) ----
const SUBAREAS = [
  {
    key: 'langgraph',
    title: 'LangGraph (LangChain) — graph-based agent orchestration',
    focus: 'Stateful graph of nodes/edges; persistence/checkpointers; supervisor & swarm prebuilts; human-in-the-loop; durable execution / resume.',
  },
  {
    key: 'crewai',
    title: 'CrewAI — role-based multi-agent crews',
    focus: 'Agents with role/goal/backstory; Tasks; sequential vs hierarchical process; Flows; how it decomposes work and whether it verifies outputs.',
  },
  {
    key: 'autogen-ag2',
    title: 'Microsoft AutoGen / AG2 — conversational multi-agent (incl. AutoGen 0.4 + Magentic-One)',
    focus: 'GroupChat / conversational orchestration; the orchestrator (Magentic-One) ledger/replanning; termination; failure handling.',
  },
  {
    key: 'openai-agents-sdk',
    title: 'OpenAI Swarm -> OpenAI Agents SDK — handoffs & routines',
    focus: 'Lightweight handoffs/routines (Swarm) now productionized as the Agents SDK; guardrails; tracing; how (if at all) it decomposes + verifies.',
  },
  {
    key: 'anthropic-multi-agent',
    title: 'Anthropic multi-agent research system + Claude Agent SDK / subagents',
    focus: 'Orchestrator-worker (lead agent spins subagents with isolated context); how the lead writes subagent task descriptions/briefs; verification; cost/parallelism lessons from the engineering write-up.',
  },
  {
    key: 'decompose-verify-patterns',
    title: 'Plan->execute->verify orchestration patterns (academic + applied)',
    focus: 'Plan-and-Execute, ReWOO, LLM-Compiler, orchestrator-worker, map-reduce, Reflection/Reflexion, self-consistency — the abstract control-flow shapes, not a product.',
  },
  {
    key: 'context-engineering-briefs',
    title: 'Context engineering & per-subagent BRIEF synthesis (the /agent-prompt idea)',
    focus: 'Context isolation per subagent; just-in-time vs pre-loaded context; structured zero-context briefs (mission/contract/output schema/role); how briefing quality changes subagent output.',
  },
  {
    key: 'quality-gates-verification',
    title: 'Quality-gate & verification patterns',
    focus: 'LLM-as-judge, debate, verifier/critic models, generate-then-verify, self-critique / Constitutional AI, eval-driven & test-based gates, rubric scoring; what makes a gate reliable vs theater.',
  },
]

const FINDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['subarea', 'one_liner', 'orchestration_shape', 'strengths', 'weaknesses', 'novelty_gap', 'evidence_urls'],
  properties: {
    subarea: { type: 'string', description: 'the subarea key' },
    one_liner: { type: 'string', description: 'what it is, 1 sentence' },
    orchestration_shape: { type: 'string', description: 'orchestrator-worker / graph / conversation / handoff / pipeline / abstract pattern' },
    decompose_plan_verify: { type: 'string', description: 'how (if at all) it does research/decompose -> plan -> execute -> verify' },
    context_briefing: { type: 'string', description: 'how it briefs / contextualizes each agent (per-agent prompt/context synthesis)' },
    quality_gates: { type: 'string', description: 'how (if at all) it gates/verifies output quality before acceptance' },
    robustness: { type: 'string', description: 'failure / stall / retry / resume / checkpoint handling' },
    strengths: { type: 'array', maxItems: 4, items: { type: 'string' } },
    weaknesses: { type: 'array', maxItems: 4, items: { type: 'string' } },
    novelty_gap: { type: 'string', description: 'what this does NOT do that a safe-fan-out + research-driven skill+gate-aware-briefs + gated-integration harness would' },
    recency_note: { type: 'string', description: 'version / date of the info, and whether it is current as of 2026' },
    evidence_urls: { type: 'array', maxItems: 3, items: { type: 'string' } },
  },
}

const SYNTH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['viable_architectures', 'novelty_assessment', 'prior_art_overlap', 'recommendation', 'open_risks'],
  properties: {
    viable_architectures: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'summary', 'pros', 'cons', 'fit'],
        properties: {
          name: { type: 'string' },
          summary: { type: 'string' },
          pros: { type: 'array', maxItems: 4, items: { type: 'string' } },
          cons: { type: 'array', maxItems: 4, items: { type: 'string' } },
          fit: { type: 'string', description: 'fit for our goal->excellent-complete-output plugin harness' },
        },
      },
    },
    novelty_assessment: { type: 'string', description: 'what is genuinely novel about safe fan-out + research-driven skill+gate-aware briefs + gated integration, given the prior art' },
    prior_art_overlap: { type: 'string', description: 'honest: where our design overlaps existing work and is NOT novel' },
    recommendation: { type: 'string', description: 'recommended architecture for our v1.0 harness + rationale' },
    open_risks: { type: 'array', maxItems: 6, items: { type: 'string' } },
  },
}

function buildPrompt(sub) {
  return [
    `You are a research subagent for an architecture-design swarm. Research ONE subarea and return ONLY the schema object (your output IS data, not prose).`,
    ``,
    `SUBAREA: ${sub.title}`,
    `FOCUS: ${sub.focus}`,
    ``,
    `CONTEXT — what the findings feed: we are designing a Claude Code PLUGIN harness that turns a one-line GOAL into excellent, complete, end-to-end output by composing three layers: (1) SAFETY — a bounded-wave parallel-subagent fan-out that survives connection drops (retry, a ScheduleWakeup stall-watchdog, checkpoint/resume, partial-synthesis); (2) QUALITY — research-driven decomposition + rich per-subagent BRIEFS that inject the right skills and named quality GATES + gated adversarial integration; (3) PERSISTENCE — /loop across sessions. We already shipped SAFETY and PERSISTENCE; the QUALITY layer is the new design. We need to know what existing systems/patterns do so we can pin down what is genuinely novel.`,
    ``,
    `ANSWER for this subarea (use official docs / primary sources; prefer current 2025-2026 info; note recency):`,
    `- one_liner, orchestration_shape`,
    `- decompose_plan_verify: does it research/decompose a goal, plan, then execute, then verify? how?`,
    `- context_briefing: how does it construct each agent's context/prompt/brief? (most relevant to our /agent-prompt-style brief synthesis)`,
    `- quality_gates: does it gate/verify output quality before accepting it? (judge/critic/tests/rubric?)`,
    `- robustness: failure/stall/retry/resume/checkpoint behavior`,
    `- strengths (<=4), weaknesses (<=4)`,
    `- novelty_gap: the KEY field — what does this NOT do that our harness (safe fan-out + research-driven, skill+gate-aware briefs + gated integration, all in a portable plugin) WOULD do?`,
    `- recency_note, evidence_urls (<=3, prefer official docs)`,
    ``,
    `Be concise and concrete. Use WebSearch/WebFetch for current facts; do NOT guess APIs. Cap evidence to <=3 URLs; link sources, do not paste long quotes.`,
  ].join('\n')
}

// ---- Safe-swarm wave loop (Patterns 1,2,3,7,8) ----
const WAVE_SIZE = 4
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

// Retry wave over the nulls (elapsed time IS the backoff; no timers)
if (failed.length) {
  phase('Retry')
  const retried = await parallel(failed.map(sub => () => runItem(sub)))
  const stillFailed = []
  retried.forEach((r, i) => (r ? done.push(r) : stillFailed.push(failed[i])))
  failed = stillFailed
  log(`Retry recovered ${retried.filter(Boolean).length}; still missing ${failed.length}`)
}

// Coverage / gap accounting (Pattern 7)
const haveKeys = new Set(done.map(r => r.subarea))
const missing = SUBAREAS.filter(s => !haveKeys.has(s.key)).map(s => s.key)
if (missing.length) log(`partial: missing ${missing.length}/${SUBAREAS.length}: ${missing.join(', ')}`)

// ---- Synthesis (Pattern 5: embed inputs so it re-runs over the fuller set on resume) ----
const OUR_DESIGN = 'agentic-swarm v1.0 harness: GOAL -> Phase0 orient/research/decompose/select skill+gate set -> Phase1 synthesize rich ZERO-CONTEXT subagent briefs (mission + research context + shared contract/interfaces + output schema + "invoke skills X" + "MUST pass gates Y") -> Phase2 SAFE bounded-wave fan-out (retry, ScheduleWakeup watchdog, resume, partial-synthesis) -> Phase3 GATED INTEGRATION (each output adversarially verified against NAMED, self-contained gates; external skills are optional enhancers, gates degrade gracefully) -> optional Phase4 /loop persistence. Three layers: SAFETY (shipped), QUALITY (new), PERSISTENCE (shipped). Ships as a portable public Claude Code plugin; plan-then-confirm autonomy; gates ship self-contained so users without extra skills still pass.'

const payload = JSON.stringify([...done].sort((a, b) => (a.subarea > b.subarea ? 1 : -1)))
phase('Synthesize')
const synthesis = await agent(
  [
    `You are the synthesis agent for an architecture-design research swarm. Produce ONLY the schema object.`,
    ``,
    `OUR DESIGN UNDER EVALUATION: ${OUR_DESIGN}`,
    ``,
    `RESEARCH FINDINGS (${done.length}/${SUBAREAS.length} subareas; missing: ${JSON.stringify(missing)}):`,
    payload,
    ``,
    `TASKS:`,
    `1. viable_architectures: 4-6 DISTINCT architecture options for OUR goal->excellent-output plugin harness, drawn from the findings + our design (e.g. orchestrator-worker-with-briefs, graph/stateful, conversational, handoff-router, plan-execute-verify, generate-then-gate). For each: summary, pros (<=4), cons (<=4), fit for a portable Claude Code plugin.`,
    `2. novelty_assessment: pin down what is GENUINELY NOVEL about pairing a SAFE fan-out with research-driven, skill+gate-aware briefs + gated integration, given the prior art above. Be specific and skeptical.`,
    `3. prior_art_overlap: be honest about where our design is NOT novel (overlaps LangGraph/CrewAI/Anthropic orchestrator-worker/etc.).`,
    `4. recommendation: the single best architecture for our v1.0 harness + why, respecting the portability constraint (must work with zero external skills) and the lesson that a bare swarm does NOT auto-improve quality.`,
    `5. open_risks (<=6).`,
    `Flag any gap from missing subareas; never silently treat partial as complete.`,
  ].join('\n'),
  { label: 'synthesis', phase: 'Synthesize', schema: SYNTH_SCHEMA, effort: 'high' }
)

return { findings: done, missing, synthesis }
