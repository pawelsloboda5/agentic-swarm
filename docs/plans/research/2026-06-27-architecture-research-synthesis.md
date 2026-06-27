# Research Synthesis — Multi-Agent Orchestration Architectures (for the v1.0 quality-layer harness)

**Status:** research complete, awaiting convergence · **Date:** 2026-06-27 · **Feeds:**
[`2026-06-27-swarm-architecture-harness-v1-design.md`](../2026-06-27-swarm-architecture-harness-v1-design.md)

## How this was produced (the dogfood)

A **bounded research swarm**, run through the `/agentic-swarm` rails the harness is built on:
`docs/plans/research/architecture-research.workflow.js` — 8 research subareas, 2 waves of 4, retry
wave + instability backoff + partial-synthesis, a `ScheduleWakeup` stall-watchdog armed at launch.
Run `wf_ee0c68b9-95c`: **9 agents, 388,732 subagent tokens, 38 tool calls, ~4.3 min, 0 drops, 0
stalls** (all agents on `claude-opus-4-8[1m]`).

> **Honest coverage note.** All **8/8** subareas returned complete findings. The script's own
> `missing: 8/8` log is a **false alarm from a gap-accounting bug** — it keyed coverage on the
> `subarea` field, but agents filled that with the full title rather than the short key, so the
> `planned − done` diff misfired. The *data* is complete; only the *bookkeeping* was wrong, and the
> synthesis agent flagged the inconsistency itself. Lesson for the harness: **pin the content key in
> the output schema** so coverage checks are reliable.

## 1. Prior-art scan (8 areas)

| Area | Orchestration shape | Decompose / plan / verify | Per-agent briefing | Quality gates | Robustness |
|---|---|---|---|---|---|
| **LangGraph** | Stateful directed graph; prebuilt supervisor (orch-worker) & swarm (handoff) | Developer hand-authors the plan/verify graph; no built-in planner | Static prompt + shared typed state; no auto-synthesis | None native; reflection/HITL nodes are bespoke; LangSmith eval is offline | **Best-in-class:** checkpointer threads, resume, time-travel, HITL interrupts; *no* stall watchdog; checkpoints ≠ exactly-once |
| **CrewAI** | Role/goal/backstory crews; sequential or hierarchical process; Flows graph | Human-authored tasks; `planning=True` only sequences pre-written tasks | Templated role text + task desc + memory; static | Opt-in task guardrails + Pydantic/JSON outputs; offline eval harness; no final-deliverable critic | Per-task retry; `@persist`/replay; thin — manual parallelism, no stall watchdog |
| **AutoGen / AG2 / Magentic-One** | Conversational GroupChat; Magentic-One adds ledger-based orch-worker | **Yes** (Magentic-One): Task Ledger plan + Progress Ledger reflect + stall-counter replan | Static persona + full shared transcript; per-step instruction from ledger | Orchestrator *self*-reflection only; no independent critic/rubric gate | Logical stall detection + replan; no checkpoint/resume, no silent-hang watchdog; token-heavy |
| **OpenAI Agents SDK / Swarm** | Flat peer-to-peer handoff (LLM-routed) | None built in — no plan/verify loop | Static `instructions` + inherited history; `input_filter` knobs | Input/output/tool **guardrails** = pass/fail tripwires (first/last only), not quality scoring | Weak: serial, in-memory, single-run; tracing ≠ resilience |
| **Anthropic multi-agent research + Agent SDK** | **Orchestrator-worker**, lead spins N parallel subagents w/ isolated context | Lead plans + decomposes (research-lite); CitationAgent post-pass | **Canonical brief:** objective + output format + tools/sources + boundaries; effort-scaling heuristics | Runtime: citation pass only; quality enforced **offline** by LLM-judge rubric | Durable execution / resume server-side; no portable stall watchdog; ~15x chat tokens |
| **Plan→execute→verify patterns** (Plan-and-Execute, ReWOO, LLM-Compiler, Reflexion) | Planner → (DAG) executor → joiner/replan | Plans from **prompt + tool list**, not researched evidence; replan = the "verify" | Bare task string per worker; no rich brief notion | Self-judgment only (replan / Reflexion / vote); no named rubric or test gate | Lives in the host runtime (LangGraph), not the pattern; no per-task retry/watchdog in base shapes |
| **Context engineering / brief synthesis** (the `/agent-prompt` idea) | Orch-worker; lead synthesizes a structured brief into each isolated window | Research-lite decompose; JIT context preferred over pre-load | **Strongest match:** objective+format+tools+boundaries+role; XML/MD sections; `/agent-prompt` = 8 sections + self-eval | Self-evals the **brief**, not the **work**; citation pass; no named gate bound to the brief | None — briefing layer carries no failure/resume semantics |
| **Quality-gate / verification patterns** | Verifier bolted onto a generator (judge / debate / critic / test gate / Petri) | Owns the VERIFY step only; best practice = decompose spec into atomic per-claim checks | Briefing = building the *judge* prompt (rubric + spec + reference + reasoning-before-verdict) | **This is the gate.** Reliable = decomposed binary criteria + objective-test anchoring + separate-context critic + pairwise/position-swap; theater = holistic 1-10 self-grade | None — judge treated as a pure function; no resume; can be gamed by the content it grades |

## 2. Viable architectures (× trade-offs)

| # | Architecture | Fit for our goal→excellent-output **plugin** |
|---|---|---|
| **1** | **Orchestrator-worker w/ research-driven, gate+skill-aware briefs + gated integration (OUR design)** | **Best.** Parallel-native for the Workflow tool; turns one GOAL into gated output; portability/degradation designed in. Cons: plan is a single point of failure; most token-expensive; quality hinges on gate strength; unproven empirically. |
| 2 | Stateful durable graph (LangGraph StateGraph + checkpointer) | Poor as the shipped harness (a library, not a plugin), but its **persistence model is the reference** for our `/loop` + resume layer. |
| 3 | Conversational ledger orchestrator (AutoGen/Magentic-One) | Weak — sequential turn-taking conflicts with safe parallel fan-out; replan loop is a good reference for Phase-3 iterate-on-failure. |
| 4 | Handoff router + guardrails (OpenAI Agents SDK) | Poor — serial in-memory; lacks both the safety (parallel/resume) and quality (gates/briefs) layers. |
| 5 | Plan-execute-verify + DAG scheduler (LLM-Compiler / ReWOO) | **Good as the *skeleton* of Phases 0–2** (dependency-aware parallel waves); supplies none of the QUALITY layer. |
| 6 | Role-based crews (CrewAI Crews + Flows) | Weak-to-moderate — guardrail/structured-output hooks resemble gates, but human-authored decomposition + thin safety + library packaging miss the core value. |

## 3. What is genuinely novel (skeptical)

**No single primitive is new — every one exists in prior art.** The novelty is a **coupling + a
packaging stance**:

1. **Gate-aware briefing at decomposition time** *(the headline)* — bind the **named,
   machine-checkable acceptance gates INTO each zero-context brief BEFORE the worker runs**, so the
   subagent self-targets the exact rubric it will be judged against. **Across all 8 areas, gates are
   applied *after* production and briefs are authored *independently* of any rubric — no surveyed
   system feeds the gate definition forward into the brief.**
2. **Skill-aware briefing** — pre-arm each worker with the *right domain skills/procedures* selected
   from research. Existing briefs inject objective/format/tools/boundaries but **not procedural skill
   packs.**
3. **Same named gates run as a separate-context adversarial INTEGRATION pass** — a fresh critic
   (cross-context review) catches what same-thread self-review misses, vs. the trusting
   synthesize/citation-only step Anthropic and the plan-execute patterns use.
4. **Portable, crash-survivable Claude Code *plugin*** — gates ship self-contained and degrade
   gracefully when external skills are absent; one GOAL line → gated output, **zero dependencies.**

**Skeptical caveat:** the novelty is *integration + the forward gate→brief coupling + portability
engineering*, **not a new algorithm** — and it is so far a **DESIGN claim**: there is no empirical
evidence yet that gate-aware briefing beats plain briefing. The research also warns that **more
review rounds add noise without signal**, so the novelty only pays off **if the gates genuinely
discriminate quality.**

## 4. Prior-art overlap (honest)

Orchestrator-worker shape + the brief template = Anthropic's research system + `/agent-prompt`
(Phases 0/1 are *their* pattern). Durability/resume overlaps LangGraph checkpointers + Anthropic
durable execution (our `ScheduleWakeup` watchdog is *thinner*, and conceptually close to
Magentic-One's stall counter — ours catches *silent hangs*, theirs catches *logical no-progress*).
The gate concept is plain LLM-as-judge / rubric / generate-then-verify / Petri. Plan-then-confirm =
LangGraph `interrupt()` HITL. Dependency-aware parallel waves = LLM-Compiler / Send API. `/loop`
persistence overlaps LangGraph threads + CrewAI `@persist`. **What is *not* borrowed:** the forward
gate→brief coupling, skill injection, and the zero-dependency portable-plugin assembly.

## 5. Recommendation (from the synthesis agent)

> **Ship Architecture 1**, implemented on a **plan-execute-verify DAG skeleton** (Arch 5) for the
> fan-out, **borrowing LangGraph's persistence model** (Arch 2) *only as the reference* for the
> `/loop` + resume layer. It is the only option that is parallel-native for the Workflow tool, turns
> one GOAL into gated output, and bakes portability/graceful-degradation in from the start. It
> directly answers the project's hard-won lesson that **a bare swarm does not auto-improve quality:
> the lever is the gate layer + forward-coupling gates into briefs, NOT more workers.** Reject the
> conversational (AutoGen) and handoff (OpenAI SDK) shapes; reject adopting LangGraph/CrewAI as the
> runtime (libraries, not portable plugins).

### The gate-theater crux (make the lever real, not a rubber stamp)

LLM judges have **systematic biases** (verbosity, position, self-enhancement) and **low test-retest
reliability**. A weak gate = a bare swarm with a stamp. Validated mitigations to bake into the gate
model:

- **Decompose each gate into binary per-criterion checks** — not a holistic 1–10 score.
- **Anchor on objective tests / build / lint / measurable checks** wherever the use-case allows.
- **Run the gate as a fresh separate-context critic** (cross-context review).
- Use **pairwise + position-swap** where subjective scoring is unavoidable.
- **Stop at one well-grounded gate pass** — more debate rounds add noise, not signal.

## 6. Open risks

1. **Gate theater** — biased/low-reliability judges give false "excellent" signal (mitigations above).
2. **Portability-vs-quality tension** — bundled criteria are likely weaker than skill-backed
   verification; graceful degradation must not become *silent* quality degradation.
3. **Cost/token blowup** — research + briefs + fan-out + gated verify is the most expensive shape
   (~15x chat tokens); plan-then-confirm + loop-until-budget only partially bound it.
4. **Decomposition is a single point of failure** — Phase 0 is upstream of everything and **nothing
   validates the plan itself**; no surveyed framework solves plan validation.
5. **No exactly-once durable execution** — same critique as LangGraph checkpoints; external-effect
   idempotency is on the author.
6. **Unproven core hypothesis** — gate-aware briefing beating plain briefing is a design claim; the
   game-demo showcase is what would test it.
