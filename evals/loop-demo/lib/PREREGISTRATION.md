# v0.10.0 Completeness-Under-Scale Showcase — Pre-Registration

> **Committed BEFORE any scored arm is built** (git ancestry is the proof). Locks the artifact, the
> shared contract, the held-out **decomposed** metric, the decision rule + every numeric threshold, the
> conformance/hard floor, the anti-leak guarantee, and the replication plan — so the result cannot be
> cherry-picked after the fact. It **discloses the pilot** (§13), which returned a **ceiling**.
> **Honest framing up front:** the pilot already shows strong single shots produce fully-complete,
> fully-correct libraries (no drops, no edge-botches). This is an **n-small showcase, not a powered
> benchmark**; a null/loss is reported verbatim. The scored arms test whether the harness **matches or
> degrades** that ceiling — not whether it "wins."

## 1. The question

v0.8.0 (a game) and v0.9.0 (a sim engine) both measured honest **nulls** on *correctness of one moderate
artifact*. This showcase tests the harness's **strongest untested case — completeness under scale**:

> On a single artifact with **40 mutually-independent, automatically-checkable requirements**, does
> building **through the architect harness** (decompose into 6 disjoint workstream slices → one focused
> worker each → gated integration with bounded repair) produce a **measurably more complete** library —
> specifically, fewer **silently dropped requirements** — than a **fair single-shot worker** given the
> identical specification? Or, honestly, not?

## 2. The artifact + shared contract

One self-contained, **zero-dependency, fully offline** ES module `lib.mjs` exporting **exactly 40 named
pure functions** (string/integer I/O only; byte = code point 0–255; no floats/NaN). A "deterministic
wire-format & canonical-form toolkit." The exact, verbatim, **identical-to-both-arms** contract is
[`SPEC.md`](./SPEC.md): the 40 exports across 6 disjoint workstreams, each **pinned to exactly one output**
(RFC 4648/3986/4180/5952/4122 cited; a custom disclosed base32 alphabet + author-pinned rules), with
**exactly 2 happy-path examples** per export. Every per-export edge is determined by the disclosed prose
(confirmed by a blind SPEC-only ambiguity audit, [`SCRUB.md`](./SCRUB.md)).

## 3. The arms (one held-out instrument scores all)

| Arm | How built | Decomposition? | Repair? |
|---|---|---|---|
| **fair control** (K=3) | one general worker, **one shot**, identical full `SPEC.md` | no | no |
| **harness** (K=3) | architect harness: contract → 6 disjoint slices → gated integration | **yes** | ≤2 (disclosed-example gate) |
| **harness no-repair** (K≥2, conditional) | same decomposition, integrator pinned to **pure assembly** | yes | **no** |

- The clean comparison is **harness vs fair control** (identical `SPEC.md` → the delta isolates
  decomposition + gated integration + bounded repair).
- **Replication:** K=3 per arm (min 2 if a build is lost to a connection drop). Per-arm metric = the
  **mean across that arm's builds**; every build is published.
- **No-repair arm** is run *only if* the harness shows a loss vs control (to test whether repair recovers
  drops); it pins the integrator to pure assembly (no example-running, no gap-filling) so any
  decomposition effect is isolated from repair.
- **Retry asymmetry** (harness ≤2 repairs, control one shot) is disclosed and **conservative against the
  harness**.
- **VOID rule:** a build whose `lib.mjs` is **truncated / malformed / unparseable** is VOID and re-run —
  never scored as incomplete (a length-cap "drop" is mechanical, not attention).

## 4. The PRIMARY metric (held-out, DECOMPOSED)

Scored by the per-export-isolated [`scoring/`](./scoring) harness (each export in its own child process,
8 s timeout; a hang costs exactly 1/40). Two axes per export: **A1 property** (reference-free round-trip /
idempotence / involution over a seeded hidden corpus) and **A2 spec-vectors** (held-out
`input→exact-output` edge literals derived from the SPEC). Decomposed into three reported metrics:

- **OMISSION-completeness = the HEADLINE** = fraction of the 40 exports that **exist AND pass the 2
  disclosed happy examples**. A *silent drop* (missing/stubbed/fundamentally-broken export) fails this.
  **This axis, and only this, carries the "completeness under scale" claim.**
- **EDGE-correctness** (secondary finding) = among delivered exports, the fraction of held-out A2 edges
  passing. Labelled "per-slice focus aids edge correctness" — **never** the headline (the harness's
  coverage gate sees disclosed examples only, so it has no inherent edge advantage; pre-registered limit).
- **CASCADE-isolation** (secondary finding) = whether a build's failures cluster on a shared root
  helper/alphabet (reported via `cascade_by_ws` + `edge_fail`). Labelled "decomposition avoids
  shared-helper cascades."
- **COMPLETENESS (composite)** = fraction passing everything (present + happy + A1 + all A2), reported
  with the decomposition making clear which axis drove any gap.

## 5. Conformance / hard floor

- **Hard floor** (per build): `no_hang` (no per-export timeout) + `no_throw` on disclosed behavior. A
  build that hangs/throws on in-domain input is flagged.
- These do not separate arms (pilot: single-shots are clean); a regression disqualifies a "win".

## 6. The decision rule (binary, per-axis; instrument-authoritative)

Computed mechanically by [`scoring/verdict.py`](./scoring/verdict.py) from `results.json` — **the JSON
decides.** Let `omission_h/omission_c` etc. be arm means. **MARGIN = 0.10** (≈ 4/40); **CEIL = 0.975**.

- **HEADLINE (OMISSION / completeness-under-scale):** **HARNESS WINS** iff the axis is **live** (control
  omitted ≥1 export, i.e. `omission_c < 1.0`) AND `(omission_h − omission_c) ≥ MARGIN` AND the gap
  **exceeds the within-arm spread** across builds. **NULL** otherwise — including the degenerate
  **ceiling** (`omission_h ≥ CEIL` and `omission_c ≥ CEIL`: "single shots did not drop; the mechanism had
  nothing to act on"). **LOSS** iff control beats harness on the composite by ≥ MARGIN.
- **SECONDARY (reported, NOT the completeness claim):** the EDGE-correctness delta and the
  CASCADE-isolation analysis, each under its own label.
- **Always published regardless of verdict:** every build's three axes, the per-export drop/edge-fail
  lists, the hard-floor flags, LOC, **token cost + uplift-per-token**, within-arm spread, and McNemar
  discordant pairs (control-pass/harness-fail vs vice-versa).

## 7. Held-out guarantee + anti-leak gate

- The held-out corpus + the A2 edge literals live **only** in `scoring/` (`config.mjs` + `vectors.json` +
  `score-one.mjs`), applied identically to every arm; the specific edges + the fact-of-measurement appear
  in **neither** the control prompt **nor** any harness brief.
- Arms are built in **isolated sandboxes** containing only `SPEC.md` (no `scoring/` reachable). The
  harness's integration coverage gate runs on **disclosed examples only** (zero held-out leakage).
- **Pre-score grep audit (VOID-on-hit):** every harness brief, the emitted contract, and the control
  prompt are grepped for held-out tokens — `scorer`, `vectors`, `expected`, `score-one`, `decode(encode`,
  `canon(canon`, `.spec.`, `assert`, and a sample of literal hidden edge inputs. **Any hit voids the run.**

## 8. The frozen suite (SHA-256, as committed at this freeze)

| file | sha256 |
|---|---|
| `SPEC.md` | `f97e4ddf961d29ef1d98b244e2a4e7d4be181155e9ecd06914343f7cba890145` |
| `scoring/config.mjs` | `9a1235431852f968b63f7a30b375c7ba8353ce5f26e5ed48c4c9e308f8dfd1a7` |
| `scoring/score-one.mjs` | `da18c2c48c4f3534eb0c60ddc915362fd204eaee6af3ec3e4d94ef77e7f88c02` |
| `scoring/vectors.json` | `183eaa4bb2895ca5ea7050d3296aaa35eeed109f18fa241b4c802fb921d5e638` |
| `scoring/aggregate.py` | `d6c1d4db81342fe2dcbd067332ebf499d5040aece0b8c084f4b41e922ed57e52` |
| `scoring/verdict.py` | `8cd28a49fc0485cd1c72a3709cae72aae539658bc77bbf1a4880d2ecea4f7a0e` |

(The reference anchors `scoring/reference/lib.mjs` and `scoring/reference-broken/lib.mjs` are committed in
this same commit.) The scorer is deterministic and re-runs identically over a fixed artifact.

## 9. Secondary / exploratory (declared non-headline)

LOC + completeness-per-1000-LOC; **build cost** (tokens / wall-clock / agent-count per arm — the harness's
real value may be throughput); EDGE-correctness; CASCADE-isolation; the no-repair arm (conditional).

## 10. Determinism / reproducibility scope

Only the **ruler** (the scorer over a fixed `lib.mjs` + fixed corpus/vectors) is bit-reproducible. The
**builds** (real agents) are not. Determinism of the ruler is **not** evidence of an effect. This is an
**n-small, uncontrolled** showcase with **no statistical inference**; K=3 → directional consistency only.

## 11. Definition of done

K control + K harness libraries built (after this commit); all scored by the frozen `scoring/` harness;
the mechanical `verdict.py` verdict recorded; `RESULTS.md` filled with the outcome (**even if
null/loss**) + the decomposed per-build table + every caveat; ship-gated by a measurement-INTEGRITY panel
to **0 blockers**; **PR opened and left for review — not tagged/released** (a separate user decision).

## 12. Confounds (named, not hidden)

- **Build method:** all arms subagent-built in one orchestration session; disclosed.
- **Retry asymmetry:** harness ≤2 repairs, control one shot — conservative against the harness.
- **Enumeration:** both arms get an explicit 40-export checklist — which (per the pilot + critic) is
  exactly why the OMISSION axis is expected to null (a checklist defeats silent drops).
- **Single task family, one effort level, n=3.** No significance claimed.

## 13. PILOT DISCLOSURE (the calibration that preceded this pre-registration)

Before locking, the instrument + task were **piloted** ([`PILOT.md`](./PILOT.md), [`SCRUB.md`](./SCRUB.md)):

- **Instrument validated:** correct reference **1.000** all axes; incomplete reference (8 stubs + 6
  edge-botches) **OMISSION 0.800 / COMPLETE 0.650** (measures coverage, not schema); a single-export hang
  isolated to **1/40** (blocker-1).
- **Ambiguity-scrubbed:** a blind SPEC-only reader found **one** ambiguity (`grayDecode` prose), fixed
  pre-freeze; all other 184 vectors uniquely SPEC-determined + independently confirmed.
- **Discrimination check → CEILING:** three throwaway single-shots (isolated, SPEC only) each scored
  **1.000 on all three axes** — zero omissions, every held-out edge correct. The OMISSION axis is at
  ceiling; **the task does not discriminate** (the both-ace outcome the critic predicted). Per the
  pre-flight rule we **report the ceiling-null** rather than harden (raising count cannot create silent
  drops for capable models on an enumerated checklist; chasing a discriminating task would be p-hacking).
- **What the scored arms still test:** whether the harness's decomposition + gated integration **matches**
  the single-shot ceiling or **degrades** it (a loss) on a 40-requirement task — genuinely new vs v0.9.0.
- **Pilot single-shots are discarded.** Every scored arm in the headline is built **AFTER** this commit —
  git ancestry proves the ordering.
