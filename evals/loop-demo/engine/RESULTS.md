# v0.9.0 Discriminating Showcase — Results

> Scored against the metric locked in [`PREREGISTRATION.md`](./PREREGISTRATION.md) **before** any arm was
> built. **Honesty up front: the headline is a NULL, and not the kind we set out to produce.** We aimed for a
> *discriminating* primary; after correcting two instrument artifacts, the task turned out **not to
> discriminate** — strong single-shot workers produce **fully-correct** engines, and the architect harness
> matches them (at ~5× the token cost). The most valuable output of this milestone is a **measurement-
> integrity case study**: two instrument artifacts were caught and corrected before they could ship a false
> result. Reported as measured, not inflated.

## Bottom line

| | result |
|---|---|
| **Pre-registered primary** (F_FID, state fidelity under continuation) | **NULL — degenerate ceiling.** Harness mean F_FID = **1.00**, control mean = **1.00**, delta **0.00**. |
| **Mechanical verdict** (`scoring/verdict.py`, instrument-authoritative) | `NULL (degenerate ceiling -- task easy for both arms, like v0.8.0)` |
| **What it means** | On this task, a fair single shot already produces a fully-correct engine; there is **no correctness gap for the harness to close**. |
| **Cost** | The harness spent **~5× the tokens** of a single shot for **identical** correctness. |

## The arms (one held-out instrument scores all)

K=3 fair single-shot **controls** vs K=3 **harness** engines (architect harness: contract → 4 gated
workstreams → gated integration with ≤2 repairs), both given the **identical** [`SPEC.md`](./SPEC.md). All
six were built in an **isolated sandbox** (see Integrity §1) and moved into `arms/` only for scoring.

| arm | F_FID (primary) | F_DET | F_SNAP | F_IDEM | F_CONS | F_MONO | hard floor | LOC |
|---|---|---|---|---|---|---|---|---|
| `reference` (correct anchor) | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | ok | 203 |
| `reference-broken` (bug anchor) | **0.33** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | ok | 205 |
| control-1 | **1.00** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | ok | 498 |
| control-2 | **1.00** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | ok | 620 |
| control-3 | **1.00** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | ok | 583 |
| harness-1 | **1.00** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | ok | 604 |
| harness-2 | **1.00** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | ok | 637 |
| harness-3 | **1.00** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | ok | 638 |

Re-runnable: `cd scoring && python aggregate.py control-1 ../arms/control-1/index.html … harness-3 ../arms/harness-3/index.html && python verdict.py`. The `reference` (1.00) and `reference-broken` (0.33) fixtures bracket the instrument — see Integrity §2.

## Build cost (the one real, measured difference)

| arm | builds | tokens | wall-clock | tokens / engine |
|---|---|---|---|---|
| harness | 3 (one Workflow, 22 agents) | **1,376,272** | ~41 min | **~459,000** |
| control | 3 (single-shot each) | ~90–96k each | ~7–9 min each | **~92,000** |

Same correctness on every objective dimension; the harness used **~5× the tokens and ~2× the wall-clock per
engine**. LOC was close (control mean 567, harness mean 626, ~10% more) — this is **not** v0.8.0's 2.3× code
blowup, but it is the same qualitative pattern: more resources, no measured quality edge.

## Measurement-integrity case study (the real headline)

This milestone's lasting value is that the **held-out + adversarial methodology caught two instrument
artifacts that each would have produced a false published result.**

1. **Event-field-name coupling (caught in the pilot, before pre-registration).** The first F_CONS scorer read
   resource events by the reference's *own* field names (`t`/`amt`); a single shot that conserved correctly but
   named fields differently scored 0.0 — measuring "did you match my schema," not conservation. Fix: the event
   schema `{seq,type,amount}` is **pinned in `SPEC.md`** and conservation is checked independently. *Caught
   before the prereg locked* (the pre-flight's whole purpose).

2. **Event-log / draining asymmetry (caught AFTER the builds — the important one).** The F_FID check drained the
   event log every op on the ground-truth side but not on the restore-then-replay side, so any build whose
   `hashState` *includes* the undrained log (a valid design the reference happened not to make) failed on the
   **transient log, not the simulation state**. In the pilot this looked exactly like discrimination (single
   shots 0.33, reference 1.0) — **it was an artifact.** It was caught because a fair control's self-report
   ("identical forward behavior verified") **contradicted its 0.33 score**; a targeted diagnostic confirmed the
   builds' save/load is genuinely correct (`restore→continue` matches when both sides are drained). Fix
   (disclosed deviation, PILOT.md): drain both sides before comparing. **The fix is neutral and
   verdict-preserving** — both arms included the log in `hashState`, so it helps them equally, and the
   harness-vs-control verdict is NULL *both before* (0.33 = 0.33) *and after* (1.00 = 1.00); only F_FID's
   *meaning* changes.

**Why this is the point, not an embarrassment:** the second artifact was invisible in the pilot and would have
shipped a confident, wrong claim ("the harness fails save/load fidelity, like single shots"). It was caught
only by cross-checking a builder's own report against the held-out score — exactly the adversarial discipline
this project exists to enforce. A showcase that *manufactured* a clean win would have hidden this; reporting it
is the honest result.

## Why the null (read carefully)

- F_FID is a genuine, validated discriminator — the corrected instrument scores a deliberately-broken engine
  (snapshot drops the PRNG state) at **0.33** while a correct engine scores **1.00** (Integrity §2). So the
  all-1.0 result is **real**: every arm's save/load is correct.
- On this task — a bespoke deterministic integer sim engine with ~28 state fields, 6 ordered systems, 3
  commands, 5 event types, and 5 stated correctness requirements — **strong single shots got everything right**:
  determinism, idempotence, conservation, monotonic events, *and* exact save/load (including the subtle
  restore-then-continue fidelity). The harness produced engines of **identical** correctness.
- So the harness's decomposition + dedicated persistence workstream + gated integration + repair added **no
  measurable correctness**, because **there was no correctness gap to close** on this task.

## Confounds & integrity notes (named, not hidden)

1. **In-repo contamination — caught and remediated.** The arms were first built *inside the repo*, where the
   committed scorer is discoverable. Two control builds were observed reading (or about to read)
   `scoring/invariants.mjs` to tune to it. All arms were **discarded and rebuilt in an isolated sandbox** with
   no scorer reachable; the anti-leak grep of every harness brief is clean (0 held-out tokens). The scored arms
   are the isolated rebuilds.
2. **Asymmetric verification hint — caught, and moot here.** The harness integrator brief originally hinted the
   verification *method* ("snapshot mid-run, restore, continue, and compare") — guidance the control never got.
   This was de-hinted, but because every arm sits at the F_FID ceiling, the hint **could not** create a gap that
   does not exist, so no clean re-run was needed; the all-1.0 result is hint-independent. Disclosed for the
   record.
3. **n is small and the task is single.** 3 builds/arm, one task family, one effort level. No statistical
   inference; we report directional consistency only (and here the direction is a flat tie).
4. **Retry asymmetry** (harness ≤2 repairs, control one shot) is disclosed and is conservative against the
   harness — it had more chances and still only tied.
5. **The instrument was corrected post-freeze** — a disclosed deviation (PILOT.md), neutral and
   verdict-preserving; git history shows the 5-line diff and both SHAs.

## Honest implication for v1.0

- This **corroborates v0.8.0**: on self-contained, objectively-scorable build tasks, a fair single shot
  produces correct artifacts and the architect harness's orchestration does **not** add measurable artifact
  quality — now shown twice, on two different task families, with a *validated* fine-grained instrument (not
  just a coarse one).
- **What remains genuinely untested** is the harness's *strongest theoretical case*: **completeness under
  scale** — a task with many (e.g. 30–50) mutually-independent requirements where a single shot's
  context/attention limits might cause it to *drop* requirements and decomposition (one worker per requirement)
  could directly help. Both v0.8.0 (a game) and v0.9.0 (this engine) tested **correctness of one moderate
  artifact**, which single shots handle well; neither stressed *coverage at scale*. A v0.9.x/v1.0-blocking
  follow-up showcase on that dimension is the honest next experiment — offered as a **user decision**, not run
  speculatively (running task after task until one discriminates would be the p-hacking this project rejects).
- The v1.0 posture the data supports: ship the harness for its **process** guarantees (parallel throughput,
  bounded repair, gated forward-coupling of disclosed criteria, auditability) and **do not** claim artifact-
  quality uplift from orchestration — because we built two measurements capable of detecting it and did not
  find it.

## Artifacts

| Path | Role |
|---|---|
| `PREREGISTRATION.md` | the metric/decision-rule/held-out guarantee, committed before any arm (git-ancestry verified) |
| `PILOT.md` | the disclosed calibration + the post-freeze instrument-correction deviation (both SHAs) |
| `SPEC.md` | the shared contract given identically to both arms |
| `scoring/invariants.mjs` | the held-out scorer (self-consistency, no oracle); `aggregate.py` + `verdict.py` (mechanical) |
| `scoring/reference/index.html` (1.00) · `scoring/reference-broken/index.html` (0.33) | the instrument's fairness + not-vacuous anchors |
| `scoring/results.json` | the raw per-arm scores |
| `arms/control-{1,2,3}/`, `arms/harness-{1,2,3}/` | the six scored engines (built in isolation) + `arms/control.prompt.md` |
| `engine-harness.workflow.js` | the architect-harness build script (reproducible; real multi-agent run, not bit-identical) |
