# v0.9.0 Discriminating Showcase — Pre-Registration

> **Committed BEFORE any scored arm is built** (git history is the proof). This locks the artifact, the
> shared contract, the held-out primary metric, the decision rule + every numeric threshold, the
> conformance floor, the anti-leak guarantee, and the replication plan — so the result cannot be
> cherry-picked after the fact. It also **discloses the pilot** that calibrated the instrument (§13).
> **Honest framing up front: this is an n=small showcase, not a powered benchmark.** A null or a harness
> loss is reported verbatim.

## 1. The question

The v0.8.0 showcase produced an honest **null**: on a "build a Three.js game" task, the architect harness
did not beat a fair single-shot worker on a *coarse* held-out primary ("does it boot"), which discriminated
**zero** arms. This showcase asks the same methodology question on a **sharper, pilot-verified
discriminating primary**:

> Does building a small **deterministic simulation engine** *through the architect harness* (research →
> decompose into gated workstreams → safe fan-out → gated integration with bounded repair) produce a
> **measurably more correct** engine — specifically, one with **higher state-fidelity under continuation**
> (exact save/load that reproduces the same *future*, not just the same instant) — than a **fair
> single-shot worker given the identical specification and rubric**? Or, honestly, not?

## 2. The artifact + shared contract

A single self-contained, **fully offline, zero-dependency** `index.html` exposing a `window.ENGINE` API for
a deterministic, **integer-only** tick-simulation ("Carousel"). The exact, verbatim, **identical-to-both-
arms** contract is [`SPEC.md`](./SPEC.md) (committed in this same commit). It pins: the 8-method API
(`createWorld/step/applyCommand/snapshot/restore/hashState/drainEventLog/report`), the event object schema
`{ seq, type, amount }`, the documented 31-bit LCG (the only randomness), six step systems in a fixed order,
the command set, and **five correctness requirements stated plainly** — including (#2) that
`restore(snapshot(world))` must "behave **identically going forward**" and (#4) exact resource conservation.

**Why a sim engine (not the spreadsheet the design swarm first proposed):** an adversarial integrity critic
showed a spreadsheet engine is too in-distribution (both-ace risk) and forces an ambiguous external oracle.
A bespoke integer sim replaces the oracle with **pure self-consistency** (a build is checked against
*itself* via `hashState`/`snapshot`/`restore`), so there is **no answer key to leak, no float/NaN
marshaling, and no oracle-validity surface** — the critic's three most serious objections dissolve.

## 3. The arms (one shared instrument scores all)

| Arm | How built | Knows the rubric? | Decomposition + gated repair? |
|---|---|---|---|
| **fair control** | a single general-purpose worker, **one shot**, given the identical `SPEC.md` | yes | no |
| **harness arm** | the architect harness: contract → gated workstreams → fan-out → gated integration (≤2 repairs) | yes | **yes** |

- **The clean comparison is harness vs fair control** — rubric-knowledge is equalized (both read the same
  `SPEC.md`), so the delta isolates **decomposition + gated integration + bounded repair** (the actual claim).
- **Replication (pre-registered to escape v0.8.0's n=1):** build **K=3 independent fair-control engines** and
  **K=3 independent harness engines** under identical conditions. (Minimum 2 per arm if a build is lost to a
  connection drop and cannot be recovered — disclosed in RESULTS.) The per-arm primary is the **mean F_FID
  across that arm's builds**; every individual build's score is also published.
- **Retry asymmetry** (harness gets ≤2 gate-driven repairs; control gets one shot) is disclosed and is
  **conservative against the harness** — if it still ties or loses, the null is strengthened.

## 4. The PRIMARY metric (held-out)

**F_FID — state fidelity under continuation.** Scored by [`scoring/invariants.mjs`](./scoring/invariants.mjs)
over K=5 seeded **adversarial** scenarios (≈360 ops each, 9 checkpoints): per checkpoint, three sub-checks —
(a) **restore-continue**: restore a mid-run snapshot, replay to the end, and the final `hashState` must equal
running straight through; (b) **double round-trip**: restore → snapshot → restore, then continue == ground
truth; (c) **cross-restore determinism**: two independent restores evolve identically. **F_FID = fraction of
these assertions passing** (per arm, a number in [0,1], plus a per-sub-check breakdown).

It **fails iff the snapshot omits any state that drives future evolution** (the PRNG state, cooldowns, a
pending counter) — a real, common save/load-completeness bug that is **self-undetectable**: a build's own
restore-*identity* self-test passes while restore-*continue* diverges.

**Held-out — stated honestly (no overclaim).** The *requirement* (exact save/load incl. forward behavior) is
**disclosed symmetrically** to both arms in `SPEC.md` #2 — this is **not** a secret criterion. What is held
out is the **specific adversarial test vectors, the rigor of verification (bit-exact over thousands of ops +
mid-run restores), and the fact that it is measured at all** — none of which appears in the control's prompt
or in any harness workstream brief. This is exactly a **SWE-bench-style hidden-conformance** design: the
requirement is in the spec; hidden tests measure whether each arm *actually achieved* it. The discrimination
hypothesis is that a single shot, *even when told*, ships save/load incompletely under one-pass attention,
whereas the harness's dedicated persistence workstream + gated verification + repair may actually achieve it.

## 5. Conformance floor + hard floor (disqualifiers, not separators)

Both arms are expected to pass these; they do **not** separate arms (pilot: single-shots score 1.0 on all
of them), but a regression here **disqualifies a "win"** — you cannot win the primary while breaking basics.
- **Floor families** (each must be ≥ **0.90**): `F_DET` (replay determinism, no restore), `F_SNAP` (snapshot
  *identity*), `F_IDEM` (command idempotence), `F_CONS` (resource conservation: state == event-ledger ==
  report-accounting), `F_MONO` (strictly-increasing unique event seqs).
- **Hard floor** (binary disqualifier): **no hang** (a cyclic/finite input must not hang > 2 s) and **no
  uncaught throw** on the adversarial script.

## 6. The decision rule (binary, pre-committed; instrument-authoritative)

Let `Fh` = mean F_FID over the harness builds, `Fc` = mean F_FID over the control builds. **Margin δ = 0.25.**

- **HARNESS WINS** iff **all**: (i) `Fh − Fc ≥ 0.25`; (ii) `Fh ≥ 0.67` (the harness must actually *achieve*
  substantial fidelity, not merely be less-broken); (iii) **every** harness build is `floor_ok` (all five
  floor families ≥ 0.90) **and** `hard_ok` (no hang, no throw); (iv) not a degenerate-ceiling case.
- **NULL** (reported plainly) iff `|Fh − Fc| < 0.25`, **or** a degenerate guard trips.
- **LOSS** iff `Fc − Fh ≥ 0.25`.
- **Degenerate guards** (both reported as v0.8.0-style coarse nulls): **ceiling** if both `Fh ≥ 0.90` and
  `Fc ≥ 0.90` (the task turned out easy for both); **floor** if both `< 0.20` (too hard / inconclusive).
- **Instrument-authoritative:** [`scoring/verdict.py`](./scoring/verdict.py) computes the verdict mechanically
  from the committed `results.json`; if any human/critic reading disagrees with the JSON, **the JSON decides**.
- **Always published regardless of verdict:** every build's continuous F_FID, the per-sub-check breakdown, all
  five floor families, the hard-floor flags, and LOC — so a real-but-non-crossing effect (δ < 0.25) is visible
  as an effect-size estimate, not hidden by the threshold.

## 7. Held-out guarantee + anti-leak gate

- The adversarial scenario generator + the F_FID assertions live **only** in `scoring/invariants.mjs`, scored
  identically for every arm. The specific vectors/edges (cyclic command ids, mid-run restore points, overflow
  injects, kills of nonexistent units) appear in **neither** the control prompt **nor** any harness brief.
- The harness receives **only** `SPEC.md` + the dimension-level rubric. Its workstreams may include a
  persistence/serialization concern and may verify save/load — **that verification is the harness's own
  machinery working** (the legitimate orchestration benefit), **not** a leak, **provided** I never inject the
  held-out vectors or the words of the F_FID checks into its briefs.
- **Pre-build grep audit (VOID-on-hit):** before scoring, every harness workstream brief, the architect's
  emitted contract, and the control prompt are grepped for held-out leak tokens — `restore-continue`,
  `continuation`, `run-to-end`, `cross-restore`, `double round-trip`, `held-out`, `invariants.mjs`, the seed
  values, and the scenario constants. **Any hit voids the run.** (The shared, symmetric phrase "behaves
  identically going forward" from SPEC.md #2 is permitted — it is the disclosed requirement both arms get.)

## 8. The frozen suite

`scoring/invariants.mjs` + `scoring/reference/index.html` are committed in this commit. The committed
`git rev-parse HEAD` of this commit is the freeze point; the SHA-256 of `invariants.mjs` is recorded in
[`PILOT.md`](./PILOT.md). The K=5 instrument seeds, N_OPS=360, and CHECKPOINTS=9 are fixed in the committed
scorer. The scorer is deterministic and re-runs bit-identically over a fixed artifact.

## 9. Secondary / exploratory (declared non-headline)

Reported for context, never the headline: the five floor families (conformance, by construction near-1.0);
the equal-weight 6-family mean; **LOC + F_FID-per-1000-LOC** (to expose any v0.8.0-style "more code, same
quality" pattern); **build cost** (tokens / wall-clock / agent-count per arm — the harness's real value may be
throughput, which an artifact-quality primary cannot capture); and an **auxiliary** separate-context critic
(non-deterministic, **never** overrides the primary).

## 10. Determinism / reproducibility scope

Only the **ruler** (the scorer over a fixed artifact + fixed seeds) is bit-reproducible. The **builds** (real
agents) and any **critic** are not. Determinism of the ruler is **not** evidence of an effect — it only means
the ruler does not wobble. This remains an **n=small, uncontrolled** showcase with **no statistical
inference**; with K=3 per arm we report **directional consistency across builds, no significance claimed**.

## 11. Definition of done

K control + K harness engines built (after this commit); all scored by `invariants.mjs`; the mechanical
`verdict.py` verdict recorded; `RESULTS.md` filled with the outcome (**even if null/loss**) + the per-build
table + every caveat above; ship-gated by a measurement-INTEGRITY panel to **0 blockers**; **PR opened and
left for review — not tagged/released** (a separate user decision).

## 12. Confounds (named, not hidden)

- **Build method:** all arms are subagent-built in one orchestration session; disclosed.
- **Retry asymmetry:** harness ≤2 repairs, control one shot — conservative against the harness.
- **Disclosed criterion:** F_FID's requirement is in `SPEC.md` (§4 explains why this is honest, not a leak).
- **Single discriminating dimension:** by pilot design, F_FID is the **one** dimension strong single-shots
  consistently miss; the showcase measures that dimension specifically and does **not** claim broad
  superiority. The floor families are reported to show the arms are otherwise comparable.

## 13. PILOT DISCLOSURE (the calibration that preceded this pre-registration)

Before locking this metric, the instrument + task were **piloted** on throwaway single-shot engines (the
critic's #1 fix: empirically confirm the task discriminates and the instrument is fair *before*
pre-registering). The pilot (full numbers + reproduction in [`PILOT.md`](./PILOT.md)) established: the
**reference** engine scores **F_FID = 1.0** (the instrument is fair and achievable); two independent strong
single-shots scored **F_FID = 0.33** identically (the task discriminates, with headroom, on a real
self-undetectable bug); and it caught + fixed a fatal instrument flaw (event-field-name coupling) that would
have invalidated conservation scoring. **The pilot engines are discarded** and are **not** scored arms; the
δ=0.25 margin and the 0.67 / 0.90 / 0.20 / 0.90 thresholds are calibrated from this pilot. **Every scored arm
in the headline is built AFTER this commit** — git ancestry proves the ordering.
