---
name: architect
description: >-
  Turn a one-line goal into complete, gated, auditable, end-to-end output by orchestrating a researched,
  gate-aware subagent swarm — not just a swarm that survives. Use WHENEVER a goal is big or multi-part
  enough to fan out and you want the result complete and checked against named criteria: "build an app /
  feature / landing page / dashboard / game", a large audit, migration, or review, or any "decompose this
  and verify it end-to-end" request. It runs five phases (0-4): (0) research what GOOD looks like, classify
  the use-case, decompose into workstreams, and select the skill-set + quality GATES per workstream; then
  present a PLAN for approval (plan-then-confirm) before the expensive fan-out; (1) synthesize a zero-context
  brief per workstream that FORWARD-COUPLES each gate's concrete pass-criteria into the worker's brief (the
  headline novelty) and tells it which skills to invoke; (2) run the fan-out on the /agentic-swarm safe-swarm
  rails; (3) integrate and verify each output against ITS gates; (4) optionally loop across sessions via /loop.
  This is the QUALITY-PROCESS layer over /agentic-swarm's SAFETY layer — reach for it before hand-writing a
  big multi-workstream Workflow, for its process guarantees (gated forward-coupling, bounded repair,
  completeness-faithful integration, auditability). Measured across three showcases to add no artifact-quality
  uplift over a fair single shot — use it for those guarantees, not to beat one capable agent.
---

# Architect — turn a one-line goal into complete, gated, integrated, end-to-end output

`/agentic-swarm` makes a large fan-out **survive** (bounded waves, retry, watchdog, resume). This skill
aims to make it **complete and measurably gated**: it researches what "good" looks like, decomposes the
goal, and — the headline move — **forward-couples each workstream's quality GATE into that workstream's
brief**, so every worker builds *toward* a named, checkable bar instead of producing generic output that's
verified (or not) after the fact.

> **Three layers (see [the design](../../docs/plans/2026-06-27-swarm-architecture-harness-v1-design.md)).**
> **SAFETY** (shipped — `/agentic-swarm`): the fan-out survives. **QUALITY-PROCESS** (this skill): the
> fan-out is research-driven decomposition + skill+gate-aware briefs + gated integration — **measured to add
> no artifact-quality uplift over a fair single shot, shipped for its process guarantees**
> ([`MEASURED.md`](../../evals/loop-demo/MEASURED.md)). **PERSISTENCE** (shipped — `/loop`): the work spans
> turns/sessions.

**Headline novelty:** *forward-coupling the named gate into the brief.* No surveyed framework feeds the
gate definition forward into the subagent's brief — they author briefs independently of any rubric and
apply gates only *after* production. **Measured posture (three pre-registered, held-out showcases — v0.8
game · v0.9 engine · v0.10 library):** this is **integration + packaging**, not a new algorithm, and it
adds **no measurable artifact-quality or completeness uplift** over a fair single shot on self-contained,
objectively-scorable build tasks — at ~5× the token cost. What it *does* guarantee are **process**
properties: safe parallel throughput, bounded repair, gated forward-coupling of disclosed criteria,
auditability, and **completeness-faithful integration** (it matches the single-shot ceiling without
dropping requirements). Reach for those guarantees — not "better work than one agent." Let the gates
produce *evidence*, not assertions ("measured, not asserted" — see
[`evals/loop-demo/MEASURED.md`](../../evals/loop-demo/MEASURED.md)).

## When to use this

- A goal big or multi-part enough to fan out: build/ship an app, feature, landing page, dashboard, game,
  CLI, or library; a large audit, migration, or multi-file review.
- You want the result to be **good and complete end-to-end**, not just "a swarm ran."
- You're about to hand-write a multi-workstream `Workflow` and want it research-grounded + gate-checked.

## When NOT to use this

- A single small task one agent finishes well — just do it (or use `/agentic-swarm` for a plain fan-out
  with no quality decomposition needed).
- A pure survive-the-fan-out concern with generic workers — that's exactly `/agentic-swarm` alone.

## The lifecycle (Phases 0–4)

```
GOAL (one line)
  ▼ PHASE 0 — ORIENT / RESEARCH   research "what does GOOD look like?", classify use-case,
  │                               decompose into workstreams, select skills + GATES, define contract
  │                               ⇒ a PLAN  ──► plan-then-confirm checkpoint (approve before fan-out)
  ▼ PHASE 1 — BRIEF SYNTHESIS     per workstream, a zero-context brief that FORWARD-COUPLES the gate
  │                               criteria + names the skills to invoke   (reference/brief-template.md)
  ▼ PHASE 2 — SAFE FAN-OUT        run the briefed workers on the /agentic-swarm rails (waves, retry,
  │                               watchdog, resume)                       (../agentic-swarm/SKILL.md)
  ▼ PHASE 3 — GATED INTEGRATION   integrate vs the contract; run each output through ITS gates
  │                               (gate runner + library land in v0.7)
  ▼ PHASE 4 — (optional) LOOP     across sessions: loop-until-dry / -budget / recurring, resuming PLAN
RESULT  (complete · gated · integrated · honestly flagged where thin)
```

The full design + Mermaid (color-coded by layer) is in
[`docs/plans/2026-06-27-swarm-architecture-harness-v1-design.md`](../../docs/plans/2026-06-27-swarm-architecture-harness-v1-design.md) §2.

---

## Phase 0 — orient / research, decompose, select, contract

Do this in the **orchestrator**, before any fan-out. Keep it a bounded, read-only scout — not a mega-swarm.

1. **Research "what does GOOD look like here?"** Domain norms, constraints, prior art, the bar a
   practitioner would hold. Verify any library/framework/SDK/CLI/cloud API with **Context7** if available
   (else official docs) before asserting how it behaves; use web/official docs for domain knowledge too.
   Bound it (a few targeted reads).
2. **Classify the use-case:** web UI · game · frontend · API · backend · library · data/ML · CLI · docs ·
   audit · research. The class drives the default gate-set.
3. **Decompose into workstreams** — the work-list. Each must be independently briefable and have a
   **stable key** (so resume serves it from cache — see the rails' Pattern 5). Examples: a game →
   `ui-ux`, `art/assets`, `gameplay`, `audio`; a landing page → `hero`, `sections`, `assets`, `copy`.
4. **Select the skill-set + GATE-set per workstream** using
   [`reference/usecase-gate-map.md`](reference/usecase-gate-map.md). **Anti-theater rule (load-bearing):**
   only select a gate that has **shipped, checkable criteria** to forward-couple into the brief. The active
   gates are `{ tests, assets, ui-ux, a11y }` (cheap a11y stays owned by `ui-ux`; the standalone `a11y`
   gate adds only the scoped runner sweep + keyboard/semantics critic on top); anything the map marks
   `future / not-yet-built` may be **surfaced in the PLAN** but must **not** be promised in a brief —
   never tell a worker it "MUST PASS" a gate that has no criteria and no runner.
5. **Detect optional enhancer skills** (zero-dep, portability). A skill is present if its on-disk
   **directory** has a `SKILL.md` at any of: `~/.claude/skills/<id>/SKILL.md`,
   `.claude/skills/<id>/SKILL.md`, or `~/.claude/plugins/cache/**/skills/<id>/SKILL.md`. Wire a present
   enhancer into the brief as "invoke `<plugin:skill>` if available"; **never hard-depend on it** — the
   bundled criteria must stand alone (the plugin is public; other users won't have your skills).
6. **Define the shared CONTRACT** so independent outputs integrate: interfaces, design tokens, naming
   conventions, file layout, the output schema each worker fills.

**Output of Phase 0 = the PLAN:** `workstreams × skills × gates × contract`.

---

## Plan-then-confirm checkpoint

Before the expensive fan-out, **present the PLAN and ask for approval** (use `AskUserQuestion` or a clear
summary): the workstreams, the selected gate-set per workstream (and which gates are deferred), the
shared contract, and a rough agent/budget estimate. On **"revise"**, loop back to Phase 0. This is the
converged autonomy model (decision #3) — it bounds cost and keeps the human in the loop before tokens
are spent. Skip the checkpoint only when the user has explicitly pre-authorized autonomous execution.

---

## Phase 1 — brief synthesis (the novelty lives here)

For each workstream, synthesize a **zero-context** worker brief from
[`reference/brief-template.md`](reference/brief-template.md). The defining move: the gate-set you selected
in Phase 0 becomes a **"You MUST PASS these GATES"** block with **each gate's concrete pass-criteria
inlined** — the worker sees the bar it's building toward, not just a task. The brief also names the
**skills to invoke if available** (skill-aware briefing) and the **lean-output + integration rules** so
results fit the contract and don't blow the output cap.

A brief is well-formed when a fresh agent with **zero prior context** could execute it and self-check
against the inlined gate criteria. See the template for the full section list + a filled example.

---

## Phase 2 — safe fan-out (reuse the rails, don't reinvent)

Run the briefed workers through the **shipped** safe-swarm rails — bounded waves of 6–8, per-agent retry,
instability backoff, the `ScheduleWakeup` stall watchdog, checkpoint/resume, lean outputs, graceful
partial-synthesis. Do **not** duplicate that machinery here; follow
[`../agentic-swarm/SKILL.md`](../agentic-swarm/SKILL.md) and its `reference/safe-swarm-template.js`. The
architect's job is *what to brief*; `/agentic-swarm`'s job is *running it safely*.

---

## Phase 3 — gated integration + verify

Integrate the workers' outputs against the contract, then run **each output through ITS gates** using the
**gate runner** ([`reference/gate-runner.md`](reference/gate-runner.md)): load the gate file, detect any
backing skill, run by tier (objective machine check / separate-context critic / advisory), and emit one
honest `verdict` per applicable gate. Gates are **tiered + objective-anchored** and **report `confidence`**
— never a silent pass: the **anti-theater invariant** forbids `pass` without ≥1 evidence + tier +
confidence. On fail, re-brief the workstream with the **exact unmet criteria** and re-run (bounded N=2),
then honestly `flag` the remainder; missing backing skill/runner degrades *loudly* (`degraded: true` +
lowered confidence), never silently.

> **Starter gate library (v0.7.1):** [`gates/tests.md`](gates/tests.md) (mixed),
> [`gates/assets.md`](gates/assets.md) (mixed), [`gates/ui-ux.md`](gates/ui-ux.md) (mixed; uses the
> bundled [`gates/lib/wcag_contrast.py`](gates/lib/wcag_contrast.py) WCAG util), and
> [`gates/a11y.md`](gates/a11y.md) (mixed — a scoped axe/pa11y/Lighthouse runner via
> [`gates/lib/a11y_report.py`](gates/lib/a11y_report.py) + a keyboard/semantics critic; cheap a11y stays
> `ui-ux`-owned, "PASS ≠ conformance") — each a self-contained 7-key gate file. The **measured showcases**
> (v0.8 game · v0.9 engine · v0.10 library) found **no artifact-quality uplift** over a fair single shot —
> the gates buy *evidence + auditability*, not better output; see
> [`evals/loop-demo/MEASURED.md`](../../evals/loop-demo/MEASURED.md).

---

## Phase 4 — (optional) persistence across sessions

When the work outgrows one bounded run — a backlog too big for one budget, or a fan-out to re-run on a
cadence — carry the PLAN across turns/sessions with `/loop`, **resuming** each bounded swarm
(`resumeFromRunId`) the next tick until the backlog is dry or the budget target is hit. This is the
dashed back-edge in the lifecycle. **Reference, don't duplicate:** the three loop layers, the
worklist-in-the-main-session architecture (a Workflow script can't self-schedule), and the
watchdog-is-a-plain-one-shot-not-a-`/loop`-sentinel rule all live in
[`../agentic-swarm/reference/loops.md`](../agentic-swarm/reference/loops.md).

---

## Reference files

| File | When to read it |
|---|---|
| [`reference/brief-template.md`](reference/brief-template.md) | **Phase 1.** The zero-context worker brief that forward-couples gate criteria + names skills to invoke; includes a filled example. |
| [`reference/usecase-gate-map.md`](reference/usecase-gate-map.md) | **Phase 0.** Use-case → default gate-set, with non-MVP gates marked `future` (anti-theater scoping). |
| [`../agentic-swarm/SKILL.md`](../agentic-swarm/SKILL.md) | **Phase 2.** The safe-swarm rails (waves, retry, watchdog, resume) — run the fan-out here. |
| [`../agentic-swarm/reference/loops.md`](../agentic-swarm/reference/loops.md) | **Phase 4.** Pairing a swarm with `/loop` across turns/sessions. |
