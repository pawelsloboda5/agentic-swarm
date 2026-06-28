# v0.10.0 Completeness-Under-Scale Showcase — Results

> Scored against the metric locked in [`PREREGISTRATION.md`](./PREREGISTRATION.md) **before** any scored
> arm (git ancestry = proof). **Honesty up front: the headline is a NULL — a degenerate ceiling — and
> it is the *expected* outcome, disclosed in the prereg.** On a 40-requirement library, a fair single
> shot already produces a **fully-complete, fully-correct** artifact in one pass; the architect harness
> **matches** it exactly (no requirements dropped, no edges botched) at **~5× the token cost**. This is
> the **third** honest null across three task families (game, engine, library) — now with a
> **decomposed, validated** instrument that could attribute a gap to the correct mechanism, and found
> none. Reported as measured, not inflated.

## Bottom line

| | result |
|---|---|
| **Pre-registered HEADLINE** (OMISSION-completeness = completeness under scale) | **NULL — degenerate ceiling.** harness mean **1.00**, control mean **1.00**, delta **0.00**. |
| **Mechanical verdict** (`scoring/verdict.py`, instrument-authoritative) | `VERDICT(omission): NULL (ceiling -- single shots did NOT drop whole exports; the completeness-under-scale mechanism had nothing to act on). delta=0.0` |
| **EDGE-correctness** (secondary) | delta **0.00** (both 1.00) — single shots got every held-out edge right too. |
| **CASCADE-isolation** (secondary) | no failures in any arm → no shared-helper cascades to isolate. |
| **What it means** | On this task a fair single shot is already complete + correct; there is **no coverage gap** for the harness to close — on *any* of the three decomposed axes. |
| **Cost** | The harness spent **~5.4× the tokens** of a single shot for **identical** completeness. |

## The arms (one held-out, per-export-isolated instrument scores all)

K=3 fair single-shot **controls** vs K=3 **harness** libraries (architect harness: contract → 6 disjoint
workstream slices → gated integration with disclosed-example coverage gate + ≤2 repairs), both given the
**identical** frozen [`SPEC.md`](./SPEC.md). All six were built in **isolated sandboxes** (only `SPEC.md`
reachable; anti-leak audit below) **after** the pre-registration freeze, and moved into `arms/` only for
scoring.

| arm | OMISSION (headline) | EDGE | COMPLETE | hard | LOC |
|---|---|---|---|---|---|
| `reference` (correct anchor) | 1.00 | 1.00 | 1.00 | OK | 255 |
| `reference-broken` (incomplete anchor) | **0.80** | 0.91 | **0.65** | OK | — |
| control-1 | **1.00** | 1.00 | 1.00 | OK | 555 |
| control-2 | **1.00** | 1.00 | 1.00 | OK | 501 |
| control-3 | **1.00** | 1.00 | 1.00 | OK | 531 |
| harness-1 | **1.00** | 1.00 | 1.00 | OK | 607 |
| harness-2 | **1.00** | 1.00 | 1.00 | OK | 655 |
| harness-3 | **1.00** | 1.00 | 1.00 | OK | 711 |

Within-arm spread = **0.000** on every axis for both arms; delta = **0.00** on every axis.
Re-runnable: `cd scoring && python aggregate.py control-1 ../arms/control-1 … harness-3 ../arms/harness-3 && python verdict.py`. The `reference` (1.00) and `reference-broken` (0.80 omission / 0.65 complete) anchors bracket the instrument — see Integrity §2.

## Build cost (the one real, measured difference)

| arm | builds | tokens | wall-clock | tokens / library | LOC (mean) |
|---|---|---|---|---|---|
| harness | 3 (one Workflow, **24 agents**) | **1,368,418** | ~14 min (sequential) | **~456,000** | 658 |
| control | 3 (single-shot each) | ~81–87k each (**~253k** total) | ~6 min each (parallelizable) | **~84,500** | 529 |

Identical completeness on every axis; the harness used **~5.4× the tokens** and ~**2×** the wall-clock,
and produced **~24% more code** (658 vs 529 LOC mean) — the same qualitative "more resources, no measured
quality edge" pattern as v0.8.0/v0.9.0. (The token/agent/wall-clock figures are **operator-recorded** from
the build-run telemetry — a pre-declared SECONDARY/exploratory measure, PREREGISTRATION §9 — **not**
independently reproducible from committed artifacts; LOC **is** reproducible via `wc -l`. The cost runs
**conservative against the harness**: it is a cost, and cannot inflate a non-existent win.)

## What the harness arms uniquely tested (and the new sub-finding)

The pilot already established the single-shot ceiling (§ Why the null). What the scored **harness** arms
add — the one question the pilot could not answer — is **MATCH vs DEGRADE**: does the harness's
decomposition into 6 slices + gated integration **preserve** completeness on a 40-requirement task, or
does the integration step **drop/botch** something (a LOSS)?

**Answer: it MATCHES exactly (1.00).** The harness integrator faithfully merged all 6 disjoint slices
into 40 working exports with every held-out edge correct — **no integration drop, no cascade**. So the
honest, complete finding is: on this task the harness adds **no completeness uplift** (no gap to close)
**and** does **no completeness harm** (integration is faithful), at ~5.4× cost.

## Why the null (read carefully)

- **OMISSION axis (headline) — ceiling.** All three strong single shots delivered **40/40** working
  exports passing their disclosed contract; zero silent drops. A checklist of 40 enumerated,
  objectively-specified functions is comfortably within a capable model's one-pass capacity — exactly the
  Phase-0 critic's prediction (CRITIQUE.md blocker 3): *enumeration defeats omission.* The harness's
  disjoint-slice decomposition is theorized to prevent silent drops; with **no drops to prevent**, it has
  nothing to act on.
- **EDGE axis (secondary) — also ceiling.** Single shots got **all 186 held-out, pinned-but-
  unexemplified edges** right (custom base32 alphabet, RFC 5952 IPv6 tie-breaks, base64 padding, runLength
  run==10, caesar wraparound, …). Even the dimension where per-slice focus *might* have helped shows no
  gap — single shots simply nailed it.
- **CASCADE axis (secondary) — moot.** No arm had any failure, so there were no shared-helper cascades for
  decomposition to isolate. (The mechanism is real — the broken reference's stubbed base-N family shows
  how it *would* surface — but no real build triggered it.)
- So the harness's decomposition + gated integration + repair added **no measurable completeness**,
  because **there was no gap to close on any axis** for capable single-shot models on this task.

## The validated instrument (the methodology is the durable artifact)

This milestone's lasting value is a **decomposed, triple-validated completeness instrument** plus a clean
demonstration of the pre-flight working: the ceiling was caught **cheaply at the pilot stage** before the
expensive run, and a real SPEC bug was caught + fixed before the freeze.

1. **Not over-strict (correct-ref = 1.00).** A correct reference scores 1.00 on every axis — a held-out
   failure is a real drop, not instrument over-strictness.
2. **Not vacuous (incomplete-ref = 0.80 omission / 0.65 complete).** A deliberately-incomplete reference
   (8 exports stubbed + 6 edges botched) drops clearly and *correctly* — the exact 8 stubs fall out of
   OMISSION (0.80 = 32/40) and the 6 botches lower EDGE + COMPLETE. The ruler measures **coverage**, not
   schema-matching (`scoring/instrument-validation.json`).
3. **Per-export isolation verified (blocker 1).** A single export that infinite-loops costs **exactly
   1/40** (`selftest-hang` = 0.975), not the whole arm — preserving the per-requirement independence the
   whole design rests on.
4. **Ambiguity-scrubbed (blocker 2).** A blind, SPEC-only independent reader predicted all 186 vectors;
   it flagged **one** genuine ambiguity (`grayDecode` prose — also caught independently by all 3 pilots,
   4× triangulation), fixed pre-freeze; all 184 others uniquely SPEC-determined (`SCRUB.md`).
5. **Decomposed attribution (blocker 3).** OMISSION / EDGE / CASCADE are reported separately so a gap
   would be attributed to the correct mechanism — *completeness-under-scale* vs *per-slice edge help* vs
   *cascade isolation* — never mislabeled. (Here all three are flat, so the point is moot but the
   discipline is in place.)

## Confounds & integrity notes (named, not hidden)

1. **Anti-leak audit — clean.** Every arm was built in an isolated sandbox with **no `scoring/`
   reachable** (the live harness sandbox was verified filesystem-level: its `SPEC.md` sha256 matches the
   frozen `f97e4ddf…` and it contains no `scoring/` dir). The grep of the entire harness build journal
   (every agent brief + the emitted contracts + results) is clean — **0** occurrences of any held-out
   **answer** token: `score-one`, the corpus seed `20260628`, the held-out base32 outputs
   `cpnmuog`/`cpnmuoj1`, `reference-broken`. The same tokens are **0** across the committed agent-facing
   artifacts too (`arms/`, `arms/control.prompt.md`, `SPEC.md`). The strings `scoring/` and `vectors.json`
   **do** appear — but **only** inside the orchestrator's own isolation-WARNING comment
   (`lib-harness.workflow.js` L11–12: "ROOT must be an ISOLATED copy … NO scoring/, no vectors.json"),
   i.e. the *opposite* of a leak; they appear in **no** agent brief, emitted contract, control prompt, or
   built arm. (The metric is also largely property-based, so even scorer access could not *fabricate* a
   passing score without actually implementing the functions.)
2. **Enumeration is the disclosed reason for the null.** Both arms received an explicit 40-export
   checklist — which is exactly why the OMISSION axis ceilings (a checklist defeats silent drops). This is
   pre-registered, not a post-hoc excuse; the honest reading is that the harness's *completeness*
   advantage requires a regime (un-enumerated / far larger N) that breaks the symmetric-spec fairness or
   the one-offline-module scope.
3. **Hardening was declined, with reasoning.** The pre-flight's harden-or-null rule offered hardening; we
   declined (the critic's enumeration-defeats-omission argument; raising count creates truncation, not
   silent-drop pressure; chasing a discriminating task is the p-hacking this project rejects). Disclosed
   in PILOT.md §4.
4. **n is small, one task family, one effort level.** 3 builds/arm. No statistical inference; directional
   consistency only (and the direction is a flat tie, spread 0.000).
5. **Retry asymmetry** (harness ≤2 repairs, control one shot) is disclosed and conservative against the
   harness — it had more chances and still only tied. (The no-repair arm was pre-registered as
   conditional on a harness loss; since the harness tied rather than lost, it was not needed.)
6. **One pre-freeze SPEC fix** (`grayDecode` prose) — disclosed in PILOT.md; the vectors were already
   correct and did not change.
7. **Per-agent effort asymmetry** — the harness sub-agents ran at `effort: high`
   (`lib-harness.workflow.js`); the single-shot control prompt pinned no effort (default). This is
   **conservative against the harness** (it had the richer per-call config and still only tied at ~5.4×
   cost) and cannot inflate a non-existent win. Disclosed here for a clean match.

## Honest implication for v1.0

- This is the **third** honest null on artifact quality, now on a **third** task family (a game, a sim
  engine, a 40-function library) and — crucially — with a **decomposed, validated** instrument built
  specifically to detect *completeness under scale*, the harness's strongest theoretical case. The
  harness's orchestration adds **no measurable artifact-quality or completeness uplift** over a fair
  single shot on self-contained, objectively-scorable build tasks — now shown three times, the last time
  with an instrument that could have attributed a win to the right mechanism and found none.
- **New this milestone:** the harness's decomposition + gated integration is **completeness-faithful** —
  it matches the single-shot ceiling without dropping requirements during integration (a non-trivial
  failure mode the prior single-artifact showcases couldn't test). So the case *against* the harness is
  "no uplift at ~5× cost," **not** "it degrades the work."
- **What still could discriminate (untested, offered as a user decision — NOT run speculatively):** a task
  where a single shot *genuinely cannot hold the whole thing* — far more than 40 requirements (100+),
  **or** requirements that are **not enumerable up front** (so the model must *discover* the work-list and
  can silently miss some), **or** cross-file/repo-scale work that exceeds one context. Each breaks the
  symmetric-spec fairness or the one-offline-module scope this track has used. Running more variants until
  one discriminates would be p-hacking; the principled next step is a **user decision**, not a speculative
  run.
- **The v1.0 posture the data supports (unchanged + strengthened):** ship the harness for its **process**
  guarantees (parallel throughput, bounded repair, gated forward-coupling of disclosed criteria,
  auditability, completeness-faithful integration) and **do not** claim artifact-quality or completeness
  uplift from orchestration — because we built three measurements capable of detecting it, the last one
  decomposed by mechanism, and did not find it.

## Artifacts

| Path | Role |
|---|---|
| `PREREGISTRATION.md` | the decomposed metric + per-axis rule + held-out guarantee + frozen SHA-256s, committed before any arm (git-ancestry verified) |
| `DESIGN.md` · `CRITIQUE.md` | the Phase-0 design + the adversarial critic's 3 blockers and their resolutions |
| `PILOT.md` · `SCRUB.md` | the disclosed pre-flight: instrument validation, ambiguity-scrub, the CEILING discrimination check, the harden-declined decision |
| `SPEC.md` | the shared contract given identically to both arms |
| `scoring/{config,score-one}.mjs` `vectors.json` | the held-out, per-export-isolated scorer (186 edge vectors); `aggregate.py` + `verdict.py` (mechanical) |
| `scoring/reference/lib.mjs` (1.00) · `scoring/reference-broken/lib.mjs` (0.80/0.65) · `scoring/selftest-hang/` (0.975) | the instrument's fairness + not-vacuous + isolation anchors |
| `scoring/results.json` · `scoring/instrument-validation.json` | the raw per-arm scores (all 1.00) and the instrument-validation snapshot |
| `arms/control-{1,2,3}/`, `arms/harness-{1,2,3}/` | the six scored libraries (built in isolation) + `arms/control.prompt.md` |
| `lib-harness.workflow.js` · `lib-shipgate.workflow.js` · `design-swarm.workflow.js` | the build, ship-gate, and design-swarm scripts (reproducible) |
