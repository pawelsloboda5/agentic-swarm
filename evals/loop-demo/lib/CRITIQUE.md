# Phase-0 adversarial measurement-integrity critique → resolutions

> A fresh-context adversarial critic stress-tested the Phase-0 design **before** any build (the
> designated Phase-0 gate; the in-workflow critic dropped on a connection error, so it was re-run
> standalone). Verdict: **REVISE** — three real blockers, each with a concrete, cheap fix. All three
> are folded into [`DESIGN.md`](./DESIGN.md) and will be locked in [`PREREGISTRATION.md`](./PREREGISTRATION.md)
> **before** any scored arm (git ancestry = proof). Recorded here verbatim-in-substance for provenance.

## Blocker 1 — a non-terminating export would zero the whole arm (kills independence)

- **Issue.** A per-call `try/catch` cannot interrupt a synchronous infinite loop (`while(true)`, a
  non-advancing `parseCsv`/`fromRadix`/`toRoman`). With a single whole-process wall-clock kill, one
  looping export → the scorer process dies → **all 40 exports go unscored / 0**, not just the one.
- **Why it invalidates.** The headline metric is "fraction of 40 **independent** requirements passing."
  A single legitimate one-requirement bug (should cost 1/40) instead tanks the arm to ~0/40, inflating
  apparent incompleteness and any harness-vs-control gap. "Wrong base32 padding doesn't break hex" is
  false the moment any export can hang.
- **RESOLUTION (in `DESIGN.md` §Scorer).** **Per-export isolation:** the scorer scores each export in
  its **own child `node` process** (`node score-one.mjs <armPath> <exportName>`) with a **per-export
  timeout** (≈8 s). A hang/crash → that export scores 0 (and flips the hard-floor `no_hang`/`no_throw`)
  while the **other 39 are unaffected** — a hang costs **exactly 1/40**. Results stream to disk
  incrementally. Validated against a stub whose **single** export infinite-loops: the other 39 must
  still score.

## Blocker 2 — spec-ambiguity false-drops are invisible to every stated guard

- **Issue.** The two anchors meant to catch ambiguity cannot. (a) The `correct-ref ≥ 0.99` gate
  compares a reference and vectors **authored by the same team from the same SPEC reading** — if the
  author consistently picked interpretation X, `ref(X)` scores 1.0 against `vectors(X)` no matter how
  ambiguous the prose; ambiguity only manifests when an **independent** builder picks Y, which the gate
  never sees. (b) The failure-shape heuristic cannot separate a **tail-edge ambiguity false-drop** from
  a **tail-edge attention drop** — both are per-export and tail-concentrated. The remaining defense was
  a **self-graded** ambiguity review — not enough for a project whose cardinal sin is artifact-driven
  false signal.
- **Why it invalidates.** Each ambiguous edge the control "fails" is counted as a dropped requirement,
  lowering `Cc` and inflating `uplift = Ch − Cc`. The number stops measuring coverage and starts
  measuring "how many defensible disagreements the author pinned against."
- **RESOLUTION (in `DESIGN.md` §Pilot + §Anti-artifact).** **Empirical ambiguity-scrubber:** during the
  pilot, an **independent reader with ONLY `SPEC.md`** (no reference, no vectors) predicts the expected
  output for **every** held-out vector **blind**; any disagreement flags an ambiguous edge → **delete
  or re-pin** the vector. Additionally, for every A2 vector any throwaway single-shot fails, adjudicate
  "is the builder's output defensible under the **disclosed prose alone**?" — if yes, **delete the
  vector** (it measures ambiguity, not coverage). Plus: the **5 highest-ambiguity requirements are
  dropped** outright — `canonicalizeQueryString`, `canonicalizePosixPath`, `canonicalizeMac` (no
  canonical standard), and the unpinnable `base64url` (optional padding) + `truncateMiddle` (3 unpinned
  axes) — replaced with cleanly-pinnable ones (`canonicalizeInteger`, `collapseWhitespace`,
  `normalizeNewlines`, `toRadix/fromRadix`, `zeroPad`).

## Blocker 3 — the dropped dimension ≠ the fixed dimension (mechanism mislabel)

- **Issue.** The claim is about **silent whole-requirement drops**. But a strong single shot **handed an
  enumerated list of 40 named exports** will almost never omit a whole export (it's a checklist) →
  outright-drop rate ≈ 0 → the harness's disjoint-slice advantage has nothing to bite on. Where the
  control **will** lose points is the hidden **edges** — and the design itself pre-registers that the
  harness has **no inherent advantage there** beyond per-slice focus. So any measured gap most likely
  comes from (i) per-slice attention helping **edge-correctness**, or (ii) decomposition avoiding
  **shared-helper/alphabet cascades** (one buggy `chunkBits` fails base32+base64+hex together in a
  single shot; the harness puts them in different workers). **Both are real benefits — but neither is
  "completeness under scale."** Reporting such a gap under the completeness headline claims the harness
  does X when it did Y — the cardinal sin in subtle form.
- **Why it invalidates.** The pilot gate "median control < 1.0" is necessary but **not sufficient** — it
  passes whenever the control botches *any* edge, even with zero omissions, certifying a task that is
  non-discriminating on the **only** axis the claim is about.
- **RESOLUTION (in `DESIGN.md` §Metric + §Decision rule + §Pilot).** **Decompose the metric** and
  pre-register which sub-metric carries which claim:
  - **OMISSION-completeness** = fraction of the 40 exports that **exist and pass A1 + the 2 disclosed
    happy examples**. **This and only this carries the "completeness under scale" claim.**
  - **EDGE-correctness** = hidden-edge (A2) pass-rate among present exports — reported as a **separate**
    finding ("per-slice focus aids edge-correctness"), not the headline.
  - **CASCADE-isolation** = whether a build's failures share a root helper/alphabet — reported
    **separately** ("decomposition avoids shared-helper cascades").
  - **Composite COMPLETENESS** (passes everything) still reported, with the decomposition making clear
    which axis drove any gap.
  - **Pilot gate upgrade:** require the throwaway single-shots to **actually omit ≥1 whole export** for
    the omission claim to be *live*; if they never omit at n=40, the omission claim is **dead → report
    the null on that axis** (raising count to force omissions, not edge-hardening, is the only lever —
    and 40→52 is unlikely to suffice, so a null on the headline is the **expected, honest** outcome).
  - **Harden ladder fixed:** lead with "raise count toward omission pressure"; **drop "output-length
    pressure"** (it raises edge-botch/truncation for *both* arms equally and cannot manufacture the
    omission gap).

## Key concerns folded in (non-blocking)

- **Disclosed examples must be strictly non-edge** — pre-lock check: no disclosed happy example
  coincides with any held-out A2 vector (else the edge leaks).
- **Output-cap VOID rule** — a control build whose file is **truncated / missing closing structure** is
  **VOID and re-run**, never scored as incomplete (a length-cap "drop" is mechanical, not attention; it
  would manufacture a harness win).
- **No-repair harness arm** — included, with its integrator pinned to **pure assembly** (no
  example-running, no gap-filling — the prior v0.9.0 integrator's "fill gaps yourself" would smuggle a
  repair into the "no-repair" arm). Isolates decomposition from repair.
- **Statistical honesty at K=3** — report **within-arm spread**; a "win" requires the cross-arm gap to
  **exceed the within-arm spread**; report **McNemar discordant pairs** (control-pass/harness-fail vs
  vice-versa), not just the marginal difference.
- **Pair double-counting** — a wrong shared alphabet fails both halves of a pair (2 of 40); reported
  honestly and surfaced by the cascade analysis (not hidden).
- **Recall-from-memory floor** — standard base64/hex/RFC-base32 are recoverable from memory (low
  discrimination); discrimination lives in the **custom** base32 alphabet + the pinned edges. Noted, not
  hidden.
- **Per-requirement pins** applied: IPv6 single-zero-field no-compress exception (RFC 5952 §4.2.2) +
  exclude embedded-IPv4/zone/brackets/port/prefix; base32 = strict custom alphabet, no aliasing, no
  padding; `escapeHtml` apostrophe = `&#39;`; `percentEncode` uppercase `%HH`, space→`%20`, encode all
  non-unreserved; CSV minimal-quote; UUID requires hyphenated 8-4-4-4-12 (no braces/urn); hex-color
  input set pinned.

*Provenance: design swarm `wf_ad12906e-595` (5 lenses + synthesis) + a standalone fresh-context
adversarial critic + a primary-source standards-verification agent. Verdict went REVISE → the above
resolutions make it PROCEED; the ship-gate (task #8) is the final 0-blockers gate on the built result.*
