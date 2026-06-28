# Fair-control build prompt (verbatim — used for every control-N arm)

> The fair single-shot control: one general-purpose worker, one shot, no decomposition, no gated
> integration, no repair — given the **identical** frozen `SPEC.md` both arms receive. Committed for
> build provenance. Built in an isolated sandbox (only `SPEC.md` reachable; the scorer is NOT present).
> Output path varies per build (`arms/control-1/`, `-2`, `-3`).

---

You are a one-shot library builder. Read this build spec carefully and in full:

`<SANDBOX>/SPEC.md`

Build the COMPLETE library it describes as a single self-contained, zero-dependency ES module and write
it to `<SANDBOX>/lib.mjs`.

Implement ALL 40 named exports exactly as specified (exact names, parameter order, pinned rules, and edge
behavior). Pure functions, deterministic, string/integer I/O only, no dependencies.

This is a ONE-SHOT build: produce your single best COMPLETE implementation in one pass. Build PURELY from
the SPEC — work only within your assigned directory; do NOT search the wider filesystem or look for any
test/scorer/verification harness (there is none to consult). Write the file to disk, then return a brief
self-report: the number of the 40 exports you implemented, the exact names of any you skipped or were
unsure about, any specific edge rules you were uncertain you got right, and the final line count.
