# v0.10.0 Completeness-Under-Scale Showcase — Phase-0 Design (converged)

> Phase-0 design of record: design swarm (5 perspective-diverse lenses → synthesis) → primary-source
> standards verification → **adversarial measurement-integrity critic (verdict REVISE → 3 blockers
> resolved)**. The critic's blockers + resolutions are in [`CRITIQUE.md`](./CRITIQUE.md); they are folded
> in below and will be locked in `PREREGISTRATION.md` **before any scored arm**. **Measured, not
> asserted:** this design is built to report a third honest **null** (the most probable outcome) and to
> attribute any gap to the **correct mechanism**, never to manufacture or mislabel a win.

## The question (sharpened by the critic)

v0.8.0 (a game) and v0.9.0 (a sim engine) both measured honest **NULLs** — but both tested **correctness
of ONE moderate artifact**, which strong single shots handle very well. This milestone tests a
**many-requirement** artifact and asks **where** a fair single shot loses completeness and **which
mechanism, if any, the harness's decomposition closes** — measured on **three distinct axes** so a gap
is never mislabeled:

1. **OMISSION-completeness** — does the build deliver a *working* function for each requirement (vs
   silently dropping/stubbing some)? **This axis, and only this, carries the "completeness under scale"
   claim** (the harness's disjoint-slice decomposition is theorized to prevent drops).
2. **EDGE-correctness** — among delivered functions, does it get the hidden, spec-pinned **edges** right?
   (The harness has *no inherent* advantage here beyond per-slice focus — pre-registered. Reported as a
   **separate** finding, not the headline.)
3. **CASCADE-isolation** — when a single shot writes one buggy shared helper/alphabet (failing several
   exports from one root), does the harness's decomposition (those exports in different workers) avoid
   the cascade? (A **separate** finding — a real but *different* benefit than drop-prevention.)

> **Honest prior (stated up front):** the critic argues — convincingly — that a strong single shot handed
> an **enumerated** 40-export checklist will rarely omit a whole export, so the **omission axis most
> likely NULLs**. The genuinely plausible findings are on **edge-correctness** and **cascade-isolation**.
> The decomposed metric exists so that whatever happens is reported under the **correct** label.

## The artifact

A single self-contained, **zero-dependency, fully offline** ES module `lib.mjs` exposing **exactly 40
named pure exports** (`export function name(...)`), imported by the scorer as `import * as lib` and
called by name. I/O is **STRING and INTEGER only** — no floats, no NaN/Infinity, no byte-array/UTF-8
marshaling (string codec inputs are restricted to **code points 0–255 = one byte each**; out-of-range
input is out of domain). Every export is **total, deterministic, pure**: no top-level side effects, no
`Math.random`/`Date.now`, no I/O. Three function shapes (all chosen for clean held-out scoring):
**reversible encode/decode pairs** (round-trip `decode(encode(x))===x`), **involutions** (`f(f(x))===x`),
**idempotent canonicalizers** (`canon(canon(x))===canon(x)`), and **single-direction pinned formatters**
(exact vectors only). Pure-Node scorer → **zero provisioning** (no Playwright, no `node_modules`).

**Domain = "deterministic wire-format & canonical-form toolkit."** Codecs give leakage-proof, oracle-free,
no-float held-out scoring; the both-ace risk (codecs are in-distribution) is countered by pinning a
**CUSTOM disclosed alphabet** (base32) and **CITED-standard canonical forms** (RFC 5952/4180/3986/4122),
so the work is **spec-FOLLOWING, not library-recall**. The 5 highest-ambiguity candidates were **dropped**
(see CRITIQUE.md blocker 2).

## The final 40 requirements (6 disjoint workstreams)

| WS | group (n) | exports (signature notes) |
|---|---|---|
| **WS1** | Base-N codecs (8) | `hexEncode/hexDecode` (lowercase); `base64Encode/base64Decode` (RFC 4648 §4 alphabet + pinned `=` padding); `base32Encode/base32Decode` (**custom disclosed 32-char alphabet, strict, no padding, no aliasing**); `toRadix/fromRadix` (nonneg int↔string, radix 2–36, lowercase digits) |
| **WS2** | Escaping/quoting (6) | `percentEncode/percentDecode` (RFC 3986: encode all non-unreserved, **UPPERCASE** `%HH`, space→`%20`); `escapeHtml/unescapeHtml` (5 entities; apostrophe = `&#39;`); `csvEscape/csvUnescape` (RFC 4180 field; **minimal-quote**; doubled `"`) |
| **WS3** | Ciphers + run-length (6) | `rot13` (involution); `atbash` (involution); `caesarEncode/caesarDecode` (shift mod 26, case-preserved, non-letter passthrough); `runLengthEncode/runLengthDecode` (**custom fully-pinned** scheme) |
| **WS4** | Integer transforms (6) | `toRoman/fromRoman` (1–3999, subtractive); `zigzagEncode/zigzagDecode` (signed↔nonneg int); `grayEncode/grayDecode` (binary-reflected) |
| **WS5** | Idempotent canonicalizers (7) | `canonicalizeIPv6` (RFC 5952 §4 incl. single-zero-field no-compress; **no embedded-IPv4/zone/brackets/port/prefix**); `canonicalizeIPv4` (strip leading zeros, decimal); `canonicalizeUuid` (lowercase; requires hyphenated 8-4-4-4-12); `canonicalizeHexColor` (#RGB→#rrggbb, #RGBA→#rrggbbaa, lowercase); `canonicalizeInteger` (strip leading zeros/`+`, single `-`, `-0`→`0`); `collapseWhitespace` (runs of space/tab→single space, trim); `normalizeNewlines` (CR/CRLF/LF→LF) |
| **WS6** | Single-direction formatters (7) | `slugify` (lowercase; run of non-`[a-z0-9]`→single `-`; trim `-`; **no translit**, `&` not special; empty→''); `titleCase` (**disclosed** small-word list + rules); `ordinal` (11/12/13 rule); `formatThousands` (comma grouping, negatives); `formatDuration` (nonneg int seconds → pinned format); `padCenter` (width, fill, pinned odd bias); `zeroPad` (int, width, pinned sign) |

**Dropped vs the draft (CRITIQUE.md):** `canonicalizeQueryString`, `canonicalizePosixPath`,
`canonicalizeMac` (no canonical standard → genuine divergence), `base64url` (optional-padding ambiguity),
`truncateMiddle` (3 unpinned axes). **Mutual independence** of *scoring* is real (each export scored
alone); the **cascade** axis explicitly measures *build-side* coupling (a shared helper failing several).

## The held-out scorer (per-export isolated)

`scoring/score-one.mjs <armPath> <exportName>` scores **one** export in **its own child `node` process**
with a **per-export timeout (≈8 s)**; `scoring/aggregate.py` orchestrates all 40 per arm and writes
`results.json`; `scoring/verdict.py` applies the rule mechanically. Per export, two axes:

- **A1 — PROPERTY (reference-free).** Pairs: `decode(encode(x))===x` over a **seeded hidden corpus**.
  Involutions: `f(f(x))===x`. Canonicalizers: `canon(canon(x))===canon(x)`. Single-direction formatters:
  no A1. *Reference-free → structurally cannot be a schema-match artifact; a dropped export → calling
  `undefined` throws → that export scores 0 (the drop signal), and — per blocker 1 — the other 39 are
  unaffected because each runs in its own process.*
- **A2 — SPEC-VECTOR.** Held-out `input→exact-output` literals **derived purely from SPEC prose / cited
  standard** (never from a reference impl), weighted on the pinned-but-**undisclosed** edges. *Catches
  the consistent-but-wrong codec that round-trips on a wrong alphabet.*

**Hard floor (per export, per build):** `no_hang` (no per-export timeout) + `no_throw` on disclosed
behavior. A hang/crash costs **exactly 1/40** (blocker 1). Validated against a single-export-infinite-loop
stub: the other 39 must still score.

## The metric (decomposed; blocker 3)

Per build, over the 40 exports:
- **OMISSION-completeness** = fraction that **exist** AND pass the **2 disclosed happy examples** AND
  (where applicable) A1 on a **non-edge** corpus. *The drop axis — carries the headline claim.*
- **EDGE-correctness** = among present-and-happy-ok exports, fraction passing **A2 hidden edges** (+ A1
  on the adversarial corpus). *Separate finding.*
- **COMPLETENESS (composite)** = fraction passing **everything** (present + happy + A1 + all A2).
- **CASCADE-isolation** = a post-hoc analysis of whether a build's failures cluster on a shared root
  (e.g., all base-N fail together); reported as the count of **independent failure roots**. *Separate
  finding.*

`C* _h` / `C* _c` = harness / control means on each axis; deltas reported per axis. Token cost +
uplift-per-token reported alongside.

## The decision rule (binary, per-axis; instrument-authoritative)

- **Completeness-under-scale (OMISSION axis — the headline):** **HARNESS WINS** iff the **omission axis is
  live** (control omitted/core-broke ≥1 export) AND `(omission_h − omission_c) ≥ MARGIN` AND the gap
  **exceeds the within-arm spread** across the K builds. Otherwise **NULL on the headline** (the expected
  outcome) — reported plainly.
- **EDGE-correctness & CASCADE-isolation (secondary):** report each delta; a positive gap exceeding
  within-arm spread is reported as that **specific** finding ("per-slice focus aids edge-correctness" /
  "decomposition avoids shared-helper cascades"), **never** as "completeness under scale."
- **LOSS** iff control beats harness by ≥ MARGIN on the composite (reported as such).
- **MARGIN** target **+0.10** (≈ 4/40), **pilot-calibrated then frozen**; reported with **McNemar
  discordant pairs**, not just the marginal difference.
- **VOID guards (run is invalid, not a finding):** correct-reference < 0.99 → instrument broken;
  incomplete-reference does not drop clearly below correct-ref → scorer measures schema not coverage; a
  **truncated/malformed** control build → VOID + re-run (never scored as incomplete — blocker-2 concern);
  any arm built with the scorer reachable → contaminated, rebuild in isolation.

## Held-out / anti-leak design

- **DISCLOSED to BOTH arms (symmetric) in `SPEC.md`:** all 40 exports + signatures; the exact pinned rule
  per export (citing RFC 5952/4180/3986/4122/4648 where a standard exists, or the full custom
  alphabet/table/rule where it does not); and **exactly 2 happy-path examples** per export. **Pre-lock
  check: no disclosed example coincides with any held-out A2 vector** (else the edge leaks).
- **HELD OUT (only in the scorer):** the seeded corpus; the A2 literals; **which** edges are probed; the
  fact-of-measurement.
- **Anti-leak grep** (ZERO hits required in every build sandbox before scoring): `scorer`, `vectors`,
  `expected`, `score-one`, `decode(encode`, `canon(canon`, `.spec.`, `assert`, plus a sample of literal
  hidden edge inputs.
- **The harness's coverage gate** runs on **disclosed examples only** (zero held-out leakage) — it closes
  the **outright-drop** class and is blind to hidden edges. *This honest limit is pre-registered.*

## Anti-artifact design

- **The empirical ambiguity-scrubber (blocker 2).** During the pilot, an **independent reader with ONLY
  `SPEC.md`** predicts every held-out vector **blind**; any disagreement → the edge is ambiguous → **drop
  or re-pin** the vector. For every A2 vector a throwaway single-shot fails, adjudicate "defensible under
  disclosed prose alone?" — if yes, **delete the vector** (it measures ambiguity, not coverage).
- **The two reference anchors (committed before any real arm):** a **CORRECT** reference must score
  **≥ 0.99** (not over-strict / not author-side-ambiguous), and a deliberately-**INCOMPLETE** reference
  (8 exports stubbed identity/empty + 6 edges botched) must drop clearly (~**0.78–0.82**) (the ruler
  measures **coverage**, not schema). *Caveat (blocker 2): the correct-ref gate is author-self-consistent
  — the scrubber, not this gate, is the real ambiguity defense.*
- **No field/format coupling:** string/int I/O only; A1 reference-free; A2 from SPEC prose; exports
  accessed **by name**, never by object shape.

## The load-bearing pre-flight (before locking the prereg)

1. **Author** `SPEC.md` + the scorer + seeded corpus/vectors + both reference anchors.
2. **Instrument validation:** correct-ref ≥ 0.99; incomplete-ref ~0.80. Both committed.
3. **Ambiguity-scrub:** the blind SPEC-only reader pass → drop/re-pin ambiguous vectors.
4. **Discrimination check:** build **N=2–3 throwaway single-shots** in isolation (SPEC only), score them.
   Inspect the **failure-class breakdown** (omissions vs edge-botches vs shared-helper cascades). The
   **omission claim is live only if** single-shots actually **omit/core-break ≥1 export**; otherwise
   report the **null on the headline** and focus on edge/cascade. **Cross-check builder self-reports vs
   the held-out score** (the contradiction that caught v0.9.0's worst artifact).
5. **Harden-or-null:** if discrimination is absent on all axes, harden by **raising the export count
   toward omission pressure** (NOT output-length pressure, NOT edge depth — those raise both arms
   equally) once; if still flat, **report the third honest null** (argues to narrow v1.0). Don't force a
   win. The throwaway shots are discarded; scored arms are built fresh.

## Isolation + arms

- Every scored arm is built in its **own isolated sandbox** with ONLY `SPEC.md` (control / no-repair
  harness assembly sees the full spec or its slice brief) — no scorer, no vectors, no reference, no
  sibling arm. After build, `lib.mjs` is copied into the scorer.
- **Arm A — fair single-shot control** (K=3): one general worker, one shot, identical full SPEC, no repair.
- **Arm B — harness + gated integration (≤2 repairs)** (K=3): decompose the 40 into the 6 disjoint
  workstreams → one focused worker per slice → integrator runs the **disclosed-example** coverage gate +
  bounded repair.
- **Arm C — harness, NO repair** (K=2–3): same decomposition, integrator pinned to **PURE ASSEMBLY** (no
  example-running, no gap-filling) — isolates **decomposition** from **repair** (blocker-2 concern; the
  v0.9.0 integrator's "fill gaps yourself" is explicitly forbidden here).
- min 2 builds/arm if one is lost to a connection drop. Truncated/malformed builds are VOID + re-run.

## Open risks (named, carried into the pre-flight)

1. **Most probable outcome is a NULL on the headline (omission axis)** — a checklist-fed single shot won't
   omit enumerated exports. The design is built to report that honestly and to surface any **edge** /
   **cascade** signal under its correct label. (This is a *feature*, per the project's #1 value.)
2. **Ambiguity → fake drops** — defended by the empirical scrubber + dropping the 5 worst reqs + cited
   standards; residual risk inspected via failure-shape + blind adjudication.
3. **Both-ace ceiling** — standard base64/hex/RFC-base32 are recall-able (low discrimination); custom
   base32 + pinned edges carry it; the pilot harden-or-null gate is the backstop.
4. **Pair double-count + cascade coupling** — surfaced by the cascade analysis, not hidden.
5. **HARNESS-MIN vs hardening can be self-defeating** — with the *decomposed* metric, near-1.0 omission for
   both arms is the expected null (reported), not a VOID; the composite + sub-axes carry the nuance.
6. **~5× cost** — report uplift-per-token; even a real edge/cascade benefit is weighed against tokens for v1.0.

---

*Provenance: design swarm `wf_ad12906e-595`; standalone fresh-context adversarial critic (REVISE →
resolved, see `CRITIQUE.md`); primary-source standards verification (RFC 4648/3986/4180/5952/4122,
protobuf zigzag, Gray code, Roman). Numeric thresholds are pilot-calibrated and frozen in
`PREREGISTRATION.md` before any scored arm (git ancestry = proof).*
