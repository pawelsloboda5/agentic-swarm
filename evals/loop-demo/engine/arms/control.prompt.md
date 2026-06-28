# Fair-control build prompt (verbatim — used for every control-N arm)

> The fair single-shot control. One general-purpose worker, one shot, no decomposition, no gated
> integration, no repair loop — given the **identical** shared `SPEC.md` both arms receive. This file is
> committed for build provenance. (Output path varies per build: `arms/control-1/`, `-2`, `-3`.)

---

You are a one-shot builder. Read the build spec at this exact path (read it carefully and in full):

`evals/loop-demo/engine/SPEC.md`

Build the COMPLETE engine it describes as a SINGLE self-contained, fully offline `index.html` (zero
dependencies — no CDN, no external files) and write it to the assigned output path
(`evals/loop-demo/engine/arms/control-N/index.html`).

Implement the FULL public `window.ENGINE` API exactly as specified (including `report()` returning `minted`
and `burned`, and the exact event object schema `{ seq, type, amount }`), all six step systems in fixed
order, the command set, the event system, AND all 5 correctness requirements (determinism via the documented
LCG; exact snapshot/restore incl. PRNG state + counters so it behaves identically going forward; idempotent
commands by id; resource conservation; strictly-increasing unique event seqs). Integer-only state. Handle odd
inputs gracefully (never throw, never hang).

This is a ONE-SHOT build: produce your single best complete implementation in one pass. Write the file to disk
early, then verify. Return ONLY a one-line summary: line count + any requirement you were unsure about.
