# Design — Swarm Robustness Eval (v0.5.0 execution demo)

**Status:** approved architecture · **Date:** 2026-06-27 · **Companion to:** the promptfoo eval
(`evals/`, which measures whether the skill makes models *write* safer orchestration).

## Claim under test

At **execution** time, the agentic-swarm orchestration shape (bounded waves + per-agent retry +
instability backoff + partial-synthesis + watchdog/resume) **preserves coverage and fails loudly**
as the agent-drop rate rises, whereas a **naive single-barrier** fan-out **silently loses coverage**
and **deadlocks on a true hang**. The promptfoo eval shows the skill makes models *write* this safer
script; this demo shows that script actually *finishes the job* the naive one drops.

## Why a controlled experiment (the lesson that produced this doc)

We first ran one real A/B at the **ambient** drop rate — which was ~0 (a calm window), n=1 — and both
arms tied at 43/43. **You cannot measure fault-tolerance by hoping a fault occurs.** So we *control*
the failure rate (deterministic, seeded fault injection — chaos-engineering style) and **sweep** it,
yielding a reproducible **robustness curve** instead of a coin-flip number.

## Architecture (a reusable harness, not a one-off)

```
work-list ─▶ [ fault injector: hash(item,attempt,seed) ▶ ok|transient-drop|permanent-drop|hang ]
                 │ (models the real "Connection closed mid-response")
        ┌────────┴────────┐
   NAIVE (1 barrier,        SAFE-SWARM (waves+retry+backoff
   no retry, no flag)        +partial-synth+watchdog/resume)   ◀── the ONE isolated variable
        └────────┬────────┘
   metrics: coverage · silent-gap vs flagged-gap · recovered · stalled(deadlock) · attempts
        │ sweep rate ∈ {0,.1,.2,.3,.4} × seeds {1..5} ▶ robustness curve
```

1. **Work-list + worker** — review one source file; pluggable. Real example: axios `lib/**/*.js`
   ≥25 lines, 43 files, pinned at `manifest.json` (commit `3243566a`).
2. **Fault injector** — deterministic `hash(item, attempt, seed)`. `transient-drop` (fails attempt 1,
   succeeds on retry → tests recovery); `permanent-drop` (fails always → tests gap-flagging); `hang`
   (never resolves on attempt 1; recovers on resume → tests deadlock vs watchdog/resume).
3. **Two orchestrators** — the only variable. `naive-arm.workflow.js` vs `safe-arm.workflow.js`
   (the real-agent arms); the deterministic model re-implements the **same** two shapes.
4. **Metrics** — `coverage`, **`silent_gaps` vs `flagged_gaps`** (the honesty axis), `recovered`,
   `stalled` (deadlock), `attempts` (cost proxy).

## Two layers (both committed, both honest)

- **A — real-agent ambient run (done):** both arms reviewed all 43 files, 43/43, in a calm window →
  the plugin produces a genuine, complete, prioritized review (192 findings, 1 high), and matches the
  naive arm on output when nothing drops (naive even ~2× faster — the real speed/robustness trade-off).
- **B — deterministic sweep + real spot-check:** `robustness-model.mjs` runs the full rate×seed sweep
  (zero tokens, exact — the orchestration logic *is* deterministic JS) → the curve. Then ONE real-agent
  spot-check per arm with a fixed seeded ~20% transient-drop set injected, to confirm the model's
  prediction holds with real agents (naive ≈34/43 silent; safe 43/43 recovered).

## Expected / falsifiable result

- **transient-drop sweep:** naive coverage ≈ `1 − rate` (silent); safe ≈ `1.0` (recovered). Curve diverges.
- **permanent-drop:** equal coverage, but safe `flagged_gaps>0` / `silent_gaps=0`; naive the reverse.
- **hang:** naive `stalled=true` (coverage 0, no notification); safe recovers (coverage ~1.0).

## Honesty guards

- Injected faults are **clearly labeled** as a deterministic model of the real `Connection closed
  mid-response` drops — grounded by (a) the real spot-check and (b) the real drops this very session
  logged (verify-loop-docs: 3/4 agents dropped + recovered; review: 1). The model is **exact** for the
  orchestration logic; only *which* items fault is modeled (seeded), standing in for stochastic timing.
- Single ambient real run is **n=1** — stated as such. The sweep is what carries the rigor.

## Deliverables

`evals/loop-demo/code-review/`: `manifest.json`, `naive-arm.workflow.js`, `safe-arm.workflow.js`,
`robustness-model.mjs` (+ committed `curve.json`), `report.md` (the real review), `RESULTS.md`
(ambient table + the curve + spot-check). README showcase. Ship as **v0.5.0**.
