# Swarm Robustness Eval — Results (v0.5.0 safety proof)

> **What this is.** The execution-time evidence that the agentic-swarm orchestration shape
> (bounded waves + per-agent retry + instability backoff + partial-synthesis + watchdog/resume)
> **preserves coverage and fails loudly** as the agent-drop rate rises, where a **naive single-barrier**
> fan-out **silently loses coverage** and **deadlocks on a true hang**. Companion to the promptfoo eval
> in [`evals/`](../../../evals/) (which measures whether the skill makes models *write* safer scripts);
> this demo shows the safer script actually *finishes the job* the naive one drops. Design:
> [`docs/plans/2026-06-27-swarm-robustness-eval-design.md`](../../../docs/plans/2026-06-27-swarm-robustness-eval-design.md).

**Honesty up front.** Two layers of evidence, with very different strengths:

- **Layer A — one real-agent ambient run (n=1).** Real, complete, but a *single* run in a calm window
  where the ambient drop rate was ~0. It proves the plugin produces a genuine, complete review; it does
  **not**, on its own, prove fault-tolerance (you cannot measure fault-tolerance by hoping a fault occurs).
- **Layer B — the deterministic robustness sweep.** This is where the rigor lives. The orchestration
  control-flow of both arms is re-implemented as deterministic JS and swept across drop-rate × seed.
  The faults are a **clearly-labeled deterministic model** of the real `Connection closed mid-response`
  drops this environment produces — **exact for the orchestration logic**, seeded only in *which* items
  fault (standing in for stochastic timing).

The headline numbers (curve) come from Layer B. Layer A is corroboration, not the proof.

---

## Layer A — real-agent ambient run (n=1)

One real safe-swarm arm ([`safe-arm.workflow.js`](safe-arm.workflow.js)) reviewed the pinned corpus —
axios `lib/**/*.js` files ≥25 lines, **43 files**, pinned at commit `3243566a` in
[`manifest.json`](manifest.json) — one agent per file, in waves of 7 with a retry wave. The synthesized
review is [`report.md`](report.md); the raw per-file output is [`safe-arm-results.json`](safe-arm-results.json).

| Metric | Safe-swarm arm (ambient) |
|---|---|
| Files in corpus | 43 |
| Files reviewed (coverage) | **43 / 43 (100%)** |
| Silently dropped files | 0 |
| Flagged gaps | 0 |
| Total findings | **192** |
| → high | 1 |
| → medium | 29 |
| → low | 104 |
| → info | 58 |

**The one HIGH** (verified in `safe-arm-results.json` and `report.md`): `lib/helpers/Http2Sessions.js`
(L41, L107) — no `'error'` listener on the pooled `ClientHttp2Session`, so an async session error
(TLS failure / GOAWAY / socket reset) on an idle pooled session re-throws and **crashes the Node
process**. This is a real, plausible defect in a widely-used library — evidence the review has teeth,
not filler.

**Caveats (do not overstate):**
- **n = 1, ambient drop rate ≈ 0.** This run happened in a calm window; nothing dropped, so both
  orchestration shapes would tie here. This run is **not** evidence of robustness — it is evidence of a
  complete, genuine review. The robustness claim rests entirely on Layer B.
- **The naive arm's ambient run is not committed.** Only the safe arm's ambient output
  (`safe-arm-results.json`) is in the repo. The design prose mentions a naive ambient run that also
  reached full coverage and ran faster when nothing dropped (the expected speed-for-robustness
  trade-off) — but **those are uncommitted, unverified design-note figures**, not an observed result in
  this repo, so this writeup does **not** treat the naive ambient comparison as established. The arms
  *are* a clean A/B by construction: the per-file review agent is **byte-identical**
  between [`safe-arm.workflow.js`](safe-arm.workflow.js) and [`naive-arm.workflow.js`](naive-arm.workflow.js);
  the orchestration shape is the only variable.

---

## Layer B — deterministic robustness sweep (the rigor)

[`robustness-model.mjs`](robustness-model.mjs) is a **faithful, hand-written re-implementation** of the
two arms' control flow (confirming it matches the *real* agents is exactly what the not-yet-run spot-check
in Layer B′ would do)
— `naive()` = one barrier, attempt-1 only, no retry, no gap accounting; `safe()` = per-wave commit +
retry wave + watchdog-driven resume passes (`MAX_PASSES = 4`) + partial-synthesis that flags the
remainder — and sweeps a seeded fault injector. Parameters (from [`curve.json`](curve.json) `meta`):
**N = 43, wave = 7, seeds = {1..8} (8 per rate), rates = {0, .1, .2, .3, .4}, max_passes = 4.** All
"gaps / recovered" counts below are **means over the 8 seeds** (hence fractional). Zero tokens, fully
deterministic.

**Reproducibility:** re-running `node evals/loop-demo/code-review/robustness-model.mjs` regenerates
`curve.json` **bit-identically** — `git status` / `git diff` show no change after a fresh run. The
committed curve is exactly what the model produces.

### 1. Transient drop — the headline curve

Item drops on attempt 1, succeeds on retry (models "Connection closed mid-response", recovers on retry).

| Drop rate | Naive coverage | Naive silently lost (mean files) | Safe coverage | Safe recovered (mean files) |
|---|---|---|---|---|
| 0%  | 100.0% | 0.0  | **100.0%** | 0.0  |
| 10% | 89.5%  | 4.5  | **100.0%** | 4.5  |
| 20% | 78.2%  | 9.4  | **100.0%** | 9.4  |
| 30% | 70.1%  | 12.9 | **100.0%** | 12.9 |
| 40% | 58.4%  | 17.9 | **100.0%** | 17.9 |

**Read:** naive coverage decays as ~`1 − rate` and the lost files vanish **silently** (no flag). The
safe arm recovers every transient drop on retry/resume → **100% coverage at every rate**, recovering up
to ~18 of 43 files at the 40% rate. The curves diverge exactly as the failure rate climbs.

### 2. Permanent drop — equal coverage, but who *flags* the gap?

Item never recovers (fails every attempt). The honesty axis: coverage is necessarily equal, but the
naive arm's gaps are **silent** while the safe arm's are **flagged**.

| Drop rate | Naive coverage | Naive **silent** gaps (mean) | Safe coverage | Safe **flagged** gaps (mean) |
|---|---|---|---|---|
| 0%  | 100.0% | 0.0  | 100.0% | 0.0  |
| 10% | 90.1%  | 4.3  | 90.1%  | 4.3  |
| 20% | 78.2%  | 9.4  | 78.2%  | 9.4  |
| 30% | 69.5%  | 13.1 | 69.5%  | 13.1 |
| 40% | 59.9%  | 17.3 | 59.9%  | 17.3 |

**Read:** when work genuinely can't be recovered, neither arm invents coverage — but the naive report
**reads as complete** while silently missing ~17 files at the 40% rate; the safe arm reports the *same*
coverage and **names every missing file** (`flagged_gaps > 0`, `silent_gaps = 0`). Same numbers, opposite
honesty. (Transient and permanent draws use independent seeded hashes, so their per-rate fault sets — and
thus the small coverage differences at a given rate — are not expected to match exactly.)

### 3. Hang — the catastrophic case the watchdog exists for

One agent never resolves on attempt 1 (the silent stall — the harness notifies on completion, never on
stall).

| Arm | Stalled? | Coverage | Outcome |
|---|---|---|---|
| **Naive** | **true** | **0%** (0/43) | one hang in the lone barrier deadlocks the **entire** workflow — no synthesis, no completion event, **no notification** |
| **Safe-swarm** | false | **100%** (43/43) | watchdog `TaskStop`s + resumes; already-completed waves are cached, the hung item recovers on resume (`recovered = 1`, `attempts = 44`) |

**Read:** this is the failure mode the whole skill is built around. A single hung connection takes the
naive run to **zero delivered coverage with no signal**; the safe arm loses nothing.

---

## Layer B′ — seeded real-agent spot-check: **NOT YET RUN**

The design's Layer B also calls for **one real-agent spot-check per arm** with a fixed, seeded ~20%
transient-drop set injected, to confirm the deterministic model's prediction holds with real agents
(predicted: **naive ≈ 34/43, silent**; **safe = 43/43, recovered**). **This has not been run.** No
`naive-arm-results.json` (or injected-fault safe-arm result) is committed; the only real-agent artifact
is the ambient safe run above.

- **Status:** outstanding. The deterministic sweep carries the rigor; the spot-check is corroboration of
  the model's realism, not a load-bearing number.
- **The 20% column is a model prediction, labeled as such** — not an observed real-agent result.
- **To run it** (token-costly, real agents): execute `naive-arm.workflow.js` and `safe-arm.workflow.js`
  with the seeded ~20% transient-drop set wired into the per-file agent, commit
  `naive-arm-results.json` + the safe injected-fault result, and add the observed row here next to the
  model's predicted row.

This gap is **disclosed, not papered over** — consistent with the repo's "measured, not asserted" ethos.

---

## Bottom line

- The agentic-swarm orchestration shape **preserves coverage under transient drops (100% vs decaying
  ~`1−rate`)**, **flags rather than hides permanent gaps**, and **survives a hang that zeroes the naive
  arm with no notification** — shown by an exact, reproducible deterministic sweep (Layer B), and
  corroborated by a complete real ambient review (Layer A, n=1).
- **Honest limits:** the ambient run is n=1 in a calm window; the seeded real-agent spot-check is
  not-yet-run; the injected faults are a deterministic *model* (exact for orchestration logic, seeded for
  fault timing) of the real `Connection closed mid-response` drops.

### Artifacts

| File | What |
|---|---|
| [`manifest.json`](manifest.json) | The pinned 43-file axios corpus (commit `3243566a`, MIT). |
| [`safe-arm.workflow.js`](safe-arm.workflow.js) / [`naive-arm.workflow.js`](naive-arm.workflow.js) | The two real-agent arms; per-file review agent is byte-identical (orchestration is the only variable). |
| [`safe-arm-results.json`](safe-arm-results.json) | Raw per-file output of the ambient safe run (43 reviews, 192 findings). |
| [`report.md`](report.md) | The synthesized, prioritized review (the real deliverable). |
| [`robustness-model.mjs`](robustness-model.mjs) | The deterministic model of both shapes; writes `curve.json`. |
| [`curve.json`](curve.json) | The committed robustness curve (reproduces bit-identically). |
