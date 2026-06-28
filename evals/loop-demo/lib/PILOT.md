# Pilot / pre-flight record (preceded the pre-registration)

> The load-bearing pre-flight (CRITIQUE.md): empirically validate the instrument AND confirm the task
> discriminates **before** locking the prereg — otherwise we risk a both-ace ceiling-null (v0.8.0/v0.9.0)
> or a broken instrument. The pilot single-shots are **throwaway** (not scored arms); every headline arm
> is built *after* the pre-registration commit. **This pilot returned a CEILING — disclosed honestly
> below.**

## 1. Instrument validation (the two anchors + the hang isolation)

`python aggregate.py reference ./reference broken ./reference-broken` (committed as
`scoring/instrument-validation.json`):

| arm | OMISSION | EDGE | COMPLETE | hard |
|---|---|---|---|---|
| correct reference | **1.000** | 1.000 | 1.000 | OK |
| incomplete reference (8 stubs + 6 edge-botches) | **0.800** | 0.908 | **0.650** | OK |

The correct reference scores **1.0** (the instrument is not over-strict / not author-side-ambiguous on a
correct build); the deliberately-incomplete reference drops **clearly** — exactly the 8 stubbed exports
fall out of OMISSION (0.800 = 32/40) and the 6 edge-botches lower EDGE + COMPLETE — so the ruler measures
**coverage**, not schema-matching.

**Blocker-1 hang isolation (verified).** A self-test stub (`scoring/selftest-hang/`) whose single
`toRoman` export infinite-loops scores **OMISSION 0.975** (39/40), `hard = FAIL` — the hang is killed by
the per-export 8 s timeout and costs **exactly 1/40**; the other 39 exports score normally. Per-export
independence holds.

## 2. Ambiguity-scrub (blocker-2; full record in `SCRUB.md`)

A blind, SPEC-only independent reader predicted all 186 edge vectors. It flagged **one** genuine
ambiguity — `grayDecode([12])`/`[255]` (buggy prose pseudocode vs the "inverse" requirement) — and
matched the frozen vectors everywhere else (incl. the independently-recomputed custom base32). The
`grayDecode` SPEC prose was corrected before the freeze (vectors unchanged; they were already correct).

## 3. Discrimination check — the headline finding: a CEILING (the task does NOT discriminate)

Three throwaway single-shots were built in **isolated sandboxes** (SPEC only, scorer unreachable) and
scored on the held-out instrument:

| pilot single-shot | OMISSION | EDGE | COMPLETE | hard | self-reported LOC |
|---|---|---|---|---|---|
| ss-1 | **1.000** | 1.000 | 1.000 | OK | 516 |
| ss-2 | **1.000** | 1.000 | 1.000 | OK | 508 |
| ss-3 | **1.000** | 1.000 | 1.000 | OK | 500 |

**All three strong single-shots produced fully-complete, fully-correct 40-export libraries in one pass**
— zero omissions (OMISSION 1.0), and every one of the held-out, pinned-but-unexemplified **edges**
correct (EDGE 1.0). This is the **both-ace ceiling** the Phase-0 critic predicted: a checklist of 40
enumerated, objectively-specified functions is comfortably within a capable model's one-pass capacity, so
there is **no coverage gap** for the harness's decomposition to close — on *any* of the three decomposed
axes.

**Self-report vs held-out cross-check (the v0.9.0 discipline) — CONSISTENT.** All three builders
self-reported "40/40 exports, all SPEC happy-examples passing" and the held-out score **confirms** it
(1.0). Unlike v0.9.0 (where a builder's "verified" self-report *contradicted* a 0.33 score, exposing an
artifact), here the strong self-reports are *true* — the builds really are complete. The builders even
**independently caught the `grayDecode` spec bug** (3× triangulation) and implemented the correct
inverse, beyond what they were asked.

## 4. The harden-or-null decision: report the pre-registered CEILING-NULL

The pre-flight's stated rule (DESIGN.md): pilot control ≥ 0.97 → **HARDEN (raise count) once, OR honestly
report a ceiling-null.** We choose **report the ceiling-null**, for principled reasons:

- **Hardening is unlikely to discriminate** and is the wrong lever. The critic's analysis (CRITIQUE.md
  blocker 3) is decisive: a strong model handed an *enumerated* checklist of N named functions implements
  all N regardless of N — raising the count creates output-length/truncation pressure (which is a VOID,
  not attention), not the *silent-drop* effect the harness is theorized to fix. Edge-hardening raises
  *both* arms equally. The only lever that could force omissions — removing the explicit enumeration so
  the model must *derive* the list — breaks the symmetric-spec fairness.
- **Chasing a discriminating task = p-hacking**, which this project rejects ("you run ONE principled task
  where the mechanism should help, and report whatever it shows"). The OMISSION + EDGE axes are *both* at
  ceiling on a *decomposed, validated* instrument; that is the honest result.

**We still build the scored arms** (after the prereg freeze) — not to seek a harness *win* (the pilot
rules that out), but to answer the one question the pilot cannot: on a 40-requirement task, does the
harness's decomposition + gated integration **MATCH** the single-shot ceiling, or does the orchestration
overhead **DEGRADE** it (drop/botch during integration → a LOSS)? That is genuinely new vs v0.9.0 (a
single moderate artifact) and directly informs the v1.0 decision.

## 5. Freeze

- Frozen at the pre-registration commit: `SPEC.md`, `scoring/config.mjs`, `scoring/score-one.mjs`,
  `scoring/vectors.json` (186 edge vectors), `scoring/aggregate.py`, `scoring/verdict.py`, and the two
  reference anchors. SHA-256 hashes are recorded in `PREREGISTRATION.md §8`.
- Fixed scorer parameters: per-export timeout 8 s; A1 corpus seed 20260628.
- The pilot single-shots are **discarded**; the scored control + harness arms are built **after** the
  freeze commit (git ancestry proves the ordering).

## DEVIATION — pre-freeze SPEC correction (disclosed)

The `grayDecode` SPEC **prose** contained a buggy pseudocode that contradicted the binding "inverse of
grayEncode" requirement (would mislead a literal-following builder → a false-drop). Caught by all three
pilots **and** the blind ambiguity-scrub before the freeze; the prose was corrected to the all-shifts
form + a `0 ≤ g < 2^31` domain pin. **The `vectors.json` values were already correct (reference-derived)
and did not change** — only the prose was fixed, so this is a pre-freeze clarification, not a post-freeze
instrument change.
