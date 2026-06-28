# Design — Per-subagent skill + gate ASSIGNMENT (the "assignment layer")

> **Status:** brainstormed design (2026-06-28), **research-backed**, **not yet built**. Architecture choice
> **confirmed by the owner: Option B (palette + routing)**. This is **eval-first**: the make-or-break is the
> evaluation (task selection), so nothing is claimed until measured. Honors
> [[architecture-first-rigorous-evals]] and the v1.0 narrowed posture (process guarantees, not artifact-quality
> uplift). **Research backing:** dogfooded research swarm `wf_d2bfe6c5-4a3` (6/6 subareas, 0 drops; sources in
> §11). Builds on the shipped `architect` skill (Phases 0–4) and the frozen v1.1.0 gate contract.

## 1. Goal & non-goals

**Goal.** Extend the orchestration layer so it **assigns custom gates + skills to each subagent it
dispatches** — a HYBRID substrate (select an existing skill where one fits, synthesize a small micro-skill
where none does) — so that on **long-horizon, heterogeneous, end-to-end tasks** the swarm produces
**better, more reliable, more efficient** outputs than a single agent that degrades over the horizon.

**Non-goals (explicitly, from three measured nulls + the research).**
- **NOT** artifact-quality uplift on **self-contained, enumerable, single-shot** tasks — that regime ceilings;
  a fair single shot ties or wins (v0.8/v0.9/v0.10). We do not relitigate it.
- **NOT** a claim that "more agents/skills = better." The defensible payoff is **efficiency + reliability**
  (cost, tokens, latency, fewer dead-ends, requirements held to the end), which on long-horizon work
  *manifests as* a better final output — measured, not asserted.

## 2. The honest reframe (why this is winnable where the nulls weren't)

The three nulls used the wrong **regime**, and there is now a *falsifiable* reason:

- **Task-parallelizability bound** (Amdahl-style; arXiv 2503.15703): specialization beats a generalist
  **only** when subtasks are heterogeneous / interdependent / convention-heavy. Homogeneous, enumerable
  tasks → generalists tie or win, *predictably*. So the prior nulls were the *expected* outcome, not a
  failure of the idea.
- **Long-horizon baseline is a *degrading* agent, not a ceilinged one.** Context rot (Chroma, 18 models),
  lost-in-the-middle (Stanford) — a single long-runner wanders, truncates, and silently drops requirements.
  Against *that* baseline the assignment layer's reliability shows up **as** a better output.
- **Reuse compounds over long horizons** (Voyager, arXiv 2305.16291: 3.3× more done, milestones 15.3×
  faster) — the gains come from reuse/compounding, exactly the long-horizon regime, not single-shot quality.
- This is the **one regime v1.0 deliberately left untested** ("work that exceeds one context"). We are
  aiming at the declared gap, not the closed questions.

## 3. Research basis (condensed; full sources §11)

- **Prior art** (LangGraph, CrewAI, AutoGen, OpenAI Agents SDK, Anthropic multi-agent, MetaGPT): all
  *assert* role/skill specialization helps; **no public per-subagent assignment ablation exists.** Anthropic's
  4-part subagent contract (objective / output format / tool guidance / boundaries) + MetaGPT's Reviewer gate
  validate the *structure*. The honest novel contribution is **the ablation itself.**
- **Routing only pays past a large pool** (RAG-MCP arXiv 2505.03275; "how many tools" chance-corrected study;
  Anthropic Tool Search 49→74 / 79.5→88.1, ~85% token cut): below ~100 tools / ~50k def-tokens, a single shot
  already selects correctly → curation adds nothing. **Selection accuracy is a hard ceiling** — a wrong/narrow
  route is *net-negative* vs give-everything.
- **Skill libraries** (Voyager): description-embedding retrieval; a skill is admitted **only after a
  self-verification gate passes** — the gate *is* the admission test.
- **Efficiency** (RouteLLM: 95% of GPT-4 quality at ~85% cost cut; context-rot): per-agent model/effort
  tiering + narrow context are well-evidenced cost/reliability levers. Token usage explained ~80% of perf
  variance in Anthropic's evals → **fair comparisons must hold token budget constant.**
- **Feasibility** (Claude Code docs + vendored snapshot): see §4 constraint box.

## 4. Architecture — Option B (palette + routing)

A new **assignment layer = Phase 1.5 (Route)** in the `architect` lifecycle, between decompose (Phase 0) and
fan-out (Phase 2). Four components:

1. **The palette** — a small library of pre-authored subagent definitions (`.claude/agents/*.md`), each a
   *specialist*: scoped `tools` allowlist + preloaded `skills` + focused system prompt + default
   `model`/`effort` + its gate. Each carries a **manifest** (`name`, one-line `description`, `when_to_use`,
   `preloads`, `gate`). The **`description` is the routing key**, so description quality is first-order
   (the documented failure mode is semantically-similar / poorly-described skills). Seed specialists map to
   the existing ecosystem (e.g. `supabase-migrations` = RLS/idempotency, `pgvector` = `halfvec(3072)`,
   `frontend-a11y` = WCAG-AA tokens) + a **generic fallback**.
2. **The router** — per subtask brief: embed it, top-k match against palette manifest descriptions
   (Voyager-style). Best match **≥ threshold** → assign that `agentType` (inherits scoped tools + preloaded
   skill + gate). **< threshold** → synthesize a micro-skill (inline prose in the brief) + generic agent +
   synthesized gate (hybrid select-or-build). **Always record** the chosen skills/tools/gate + confidence.
3. **The per-subagent gate** — the **frozen v1.1.0 gate contract**, applied per subagent: the dispatch
   `schema` + the definition's gate file. Doubles as a **cascade verifier** on long tasks (cheap attempt →
   escalate `model`/`effort` on fail, bounded N≤2 — the existing repair rule).
4. **Audit trail** — every routing decision + gate verdict + the skills actually used, so
   *"did routing match usage?"* (precision/recall) is measurable and a low-recall route is a **named harm
   signal** (not a silent net-negative).

> **Feasibility constraint (load-bearing).** `agent()` exposes only `model`/`effort`/`schema`/`agentType`
> per call — there is **no per-call `tools`/`skills` param.** Real tool-scoping + skill-preload live in
> **pre-authored subagent definitions**, selected by `agentType`; the `skills:` frontmatter injects **full**
> skill content (a real token cost at scale). The only fully-dynamic per-call levers are the `schema` gate +
> model/effort. Truly *runtime-synthesized* tool-scopes would require the **Agent SDK** (`AgentDefinition` /
> `--agents`), which leaves the swarm-safety substrate (Option C, deferred). Plugin-shipped subagents
> **ignore** `hooks`/`mcpServers`/`permissionMode`, so gates must be **schema-based** or definitions copied
> into `.claude/agents/`.

**YAGNI cut for the MVP:** the **skill-promotion loop** (a synthesized micro-skill that passes its gate is
promoted into the palette for reuse by later subagents in the *same* long run — where Voyager-style reuse
compounds) is a **Phase-2 enhancement**, not in the first build.

## 5. Data flow (extends Phases 0–4)

```
GOAL
  ▸ Phase 0   decompose → workstreams (existing)
  ▸ Phase 1   zero-context briefs (existing: forward-couple gate criteria)
  ▸ Phase 1.5 ROUTE  (NEW): per workstream → embed brief → match palette
  │              → assign agentType + scoped tools + preloaded skill + gate
  │              → OR synthesize micro-skill (prose) + generic agent + synthesized gate
  │              → record routing decision + confidence
  ▸ PLAN now shows per-subagent assignment + routing confidence → plan-then-confirm
  ▸ Phase 2   safe fan-out (existing rails: waves, retry, watchdog, resume) —
  │              each subagent dispatched WITH its assigned definition
  ▸ Phase 3   gated integration (existing): each output vs ITS gate; bounded repair;
  │              cascade-escalate model/effort on fail
  ▸ Phase 4   loop across the long horizon (existing /loop) — where reliability + (Phase-2) reuse compound
```

## 6. Error handling & risks (named, with mitigations)

| Risk (from research) | Mitigation |
|---|---|
| **Selection ceiling** — a wrong/narrow route caps the subagent *below* give-everything+Tool-Search | Confidence **fallback to broaden** (or give-everything+Tool-Search) when match confidence is low; **measure routing precision/recall** as a first-class harm signal. |
| **Preload token cost** — full skill-preload at swarm scale can *erase* efficiency gains | Lean preload (one matched skill, progressive disclosure); **measure NET cost**, not just dead-end reduction. |
| **Confound: "more guidance" vs "relevance"** | Token-match the generic baseline; add a **mis-assigned-skill arm** so a win is attributable to relevance. |
| **Plugin subagents ignore hooks/mcp/permissionMode** | Gates are **schema-based**; if richer gates needed, ship definitions into `.claude/agents/`. |
| **Unpredictability / runaway cost** (AutoGen-style) | Keep the palette **small + typed**; synthesize a micro-skill only on a miss; reuse the existing **instability backoff** + budget rails. |

## 7. Evaluation — the make-or-break (eval-first, pre-registered)

A **single pre-registered, paired, single-variable ablation** on a **long-horizon, heterogeneous** task:

- **Arms** — **A)** routed/assigned (matched skill + scoped tools + per-subagent gate); **B)** token-matched
  competent **generic** subagent + generic self-check gate (no strawman); **C)** **mis-assigned** skill
  (relevance control). Everything else byte-identical: same orchestrator, same decomposition, same fan-out,
  same budget.
- **Primary metric** = ONE pre-registered **process** number (candidates: gate-pass-on-first-try rate /
  tool-calls-to-passing-gate / requirements-held-to-the-end / backtrack count). **Output quality** =
  co-measure (held-out rubric) as a **non-inferiority guardrail**; **tokens/$/latency** reported.
- **Falsifiability (turns the nulls into a validity check):** pre-register a **NULL prediction on a
  short/homogeneous control task.** The design must be **positive on long-heterogeneous AND null on
  short-homogeneous** to prove it *discriminates* rather than *fishes*.
- **Baseline-to-beat:** give-everything **+ Anthropic Tool Search** (49→74 / 79.5→88.1) — hand-routing must
  beat it to justify itself.
- **Anti-p-hacking rails (project DNA):** pre-register hypothesis + primary metric + task list + analysis
  **before** building arms; power-analyze N (target effect, e.g. ≥63% paired win-rate); ≥3 seeds; paired
  (McNemar) on the same tasks; held-out scoring; correct for multiple comparisons; report effect sizes + CIs;
  isolated sandboxes (the held-out-scorer lesson). **No running variants until one wins.**

## 8. Testing (plugin TDD)

- **Router unit tests** — brief → expected `agentType`; sub-threshold → synthesize path; low-confidence →
  broaden fallback. Pure-stdlib, deterministic fixtures.
- **Palette guard test** — every `.claude/agents/*.md` declares a well-formed manifest (`name`,
  `description`, `when_to_use`, `gate`) with `id==filename`, mirroring `test_gate_library.py`.
- **Contract** — the **agent-definition manifest schema** becomes a future **frozen-contract surface**
  (add to `test_schema_contract.py` when it stabilizes; new manifest field = MINOR, removal = MAJOR).
- Zero-dependency; `claude plugin validate --strict` green both modes; safe-swarm rails preserved.

## 9. Staged roadmap

1. **Phase A (minimal, buildable today)** — schema-gate + model/effort **tiering** inside the Workflow API;
   micro-skills as prompt prose. Proves the **cascade/efficiency** slice with zero new substrate.
2. **Phase B (this design)** — the **palette + embedding-routing + per-subagent gate + audit trail**. The
   real per-subagent scoping/skill-preload.
3. **Phase C (Voyager reuse)** — the **skill-promotion loop** (admit a gate-passing micro-skill into the
   palette mid-run) — where long-horizon reuse compounds.
4. **Showcase** — the §7 pre-registered ablation on a long-horizon heterogeneous task + the null control.
   *(Agent SDK runtime synthesis — original "Option C" — remains a separate, later track; it leaves the
   swarm-safety substrate.)*

## 10. Open decisions (decide before/with the showcase)

1. **The discriminating long-horizon task family** — e.g. a multi-surface app feature where each subagent
   needs a *different* non-obvious convention (RLS/idempotency · `halfvec(3072)` · WCAG-AA), OR an
   interdependent pipeline (schema → typed client → query → UI) where a plausible-but-wrong early choice
   cascades. **This is the single biggest lever.**
2. **The ONE primary process metric** + the target effect size for the power analysis.
3. **Build vs reuse for selection** — implement description-embedding routing ourselves, or lean on
   Anthropic's **Tool Search** as both the baseline-to-beat *and* a candidate mechanism?
4. **Net-cost ceiling** — what token premium (preload + fan-out can hit ~5–15×) is acceptable for what
   efficiency/dead-end delta at equal quality?
5. **Phase A first, or straight to B?** (A de-risks the eval harness cheaply; B is the real thing.)

## 11. Sources (from research swarm `wf_d2bfe6c5-4a3`)

- Anthropic — *How we built our multi-agent research system* · *Advanced tool use (Tool Search)* ·
  *Equipping agents with Agent Skills* (anthropic.com/engineering/…)
- *Predicting Multi-Agent Specialization via Task Parallelizability* — arXiv 2503.15703
- *RAG-MCP: Mitigating Prompt Bloat in LLM Tool Selection* — arXiv 2505.03275
- *Voyager: An Open-Ended Embodied Agent with LLMs* — arXiv 2305.16291
- *RouteLLM: Learning to Route LLMs with Preference Data* — arXiv 2406.18665
- *Toolshed: Scale Tool-Equipped Agents with RAG-Tool Fusion* — arXiv 2410.14594
- MetaGPT — arXiv 2308.00352 · OpenAI Agents SDK (handoffs) docs · Claude Code sub-agents + Agent SDK docs ·
  Chroma "Context Rot" · Stanford "lost-in-the-middle"

## 12. Invariants (any build must preserve)

- Plugin **zero-dependency**; skills frontmatter `name`+`description` only; `validate --strict` green both
  modes; `marketplace.json` version-less; `plugin.json` ↔ tag lockstep.
- Reuse the **safe-swarm rails** (waves, retry, watchdog, resume, backoff) — do not reinvent.
- **Measured, not asserted** — pre-register before building arms; report nulls verbatim; no p-hacking; the
  v1.0 process-guarantees posture is the ceiling on claims until the showcase says otherwise.
