# Ambiguity-scrub record (blocker-2 defense)

> The empirical ambiguity-scrubber required by the Phase-0 critic (CRITIQUE.md blocker 2): an
> **independent reader given ONLY `SPEC.md`** predicted the exact output for **every** held-out edge
> vector **blind** (no reference, no expected answers). Any divergence from the frozen `vectors.json`
> flags a spec under-determination → drop or re-pin. This is the real ambiguity defense (the
> `correct-ref ≥ 0.99` gate is author-self-consistent and cannot catch author-side ambiguity).

## Result: ONE genuine ambiguity found (and fixed); all 184 other vectors uniquely SPEC-determined

The blind reader audited all 40 exports × 186 edge vectors and flagged **exactly one** genuine
under-determination:

- **`grayDecode([12])` and `grayDecode([255])`.** The original SPEC prose printed a buggy pseudocode
  (`n ^= (g >> shift)` over `shift = 1,2,4,8…` using the *original* `g`) that **contradicts** the binding
  requirement ("inverse of `grayEncode`" / "XOR-prefix"). A literal implementer of the pseudocode gets
  9/176; one honoring the inverse gets the correct **8/170**. The two diverge for inputs needing a
  shift-3+ term. **This is the same bug all three pilot single-shots independently caught** (ss-1: 12→8,
  ss-2: 8→15, ss-3: 16→31) — triple triangulation. **Resolved before the freeze:** the SPEC prose was
  rewritten to the correct all-shifts form (`n = g ^ (g>>1) ^ (g>>2) ^ …`) + a domain pin (`0 ≤ g <
  2^31`); the `vectors.json` values (8, 170) were already correct (reference-derived) and unchanged.

Everything else the blind reader predicted **matched `vectors.json` exactly** — including the
independently-recomputed **custom base32** values (`foob`→`cpnmuog`, `fooba`→`cpnmuoj1`), confirming the
disclosed custom alphabet is unambiguous. Two inputs are deliberate **correctness traps** that the reader
correctly judged as *uniquely determined* (NOT ambiguous): `unescapeHtml("&amp;lt;")` → `"&lt;"` (the
inverse + listed order resolve the `&amp;`-ordering hazard) and `normalizeNewlines("\r\n\r\n")` → `"\n\n"`
(CRLF as a unit).

## Non-issue: NUL-vs-space transcription in the scrub prompt

A few inputs containing NUL bytes (`"A\x00B"`, `"\x00\x00"`) were rendered as spaces when I transcribed
them into the scrub prompt, so the reader audited space-variants for those specific cells. The reader
correctly flagged this as a **prompt-rendering artifact, not a spec ambiguity** (it read the singleton
NUL token correctly: `base64Decode("AA==")` → NUL, etc.). Those NUL edges are simple, unambiguous byte
values and are covered by the 3 pilots' agreement with the vectors (all scored EDGE = 1.000). No action
needed.

## Conclusion

After the `grayDecode` prose fix, **0 ambiguous vectors remain**; the 186-vector instrument is uniquely
determined by the disclosed `SPEC.md` and confirmed by three independent derivations (the correct
reference, three strong single-shot pilots, and this blind SPEC-only reader). A held-out edge failure in
a scored arm is therefore a *real* drop/bug, not a defensible different choice.
