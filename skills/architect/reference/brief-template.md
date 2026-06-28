# Worker brief template (Phase 1) — forward-couple the gate into the brief

A worker brief is a **zero-context** prompt: a fresh agent that has never seen this conversation must be
able to execute it *and* self-check against the gate. The defining move of this harness is the **MUST
PASS GATES** block — each selected gate's **concrete pass-criteria are inlined** so the worker builds
*toward* the bar, not blind. (No surveyed framework does this; briefs are normally authored independently
of any rubric — though this is integration + packaging, not a new algorithm: measured across three
showcases to add no artifact-quality uplift over a fair single shot, so forward-coupling is for *building
toward a disclosed bar + auditability*, not a quality multiplier — see
[`evals/loop-demo/MEASURED.md`](../../../evals/loop-demo/MEASURED.md).) Keep the brief self-contained: inline the criteria so the worker passes the gate with
**zero external skills** — name skills only as optional enhancers.

## Required sections

1. **Mission** — one sentence: the single outcome this workstream owns.
2. **Research context** — the relevant "what GOOD looks like" findings from Phase 0 (norms, constraints,
   the bar). Cite verified facts (e.g. Context7-checked API shapes); don't make the worker re-research.
3. **Contract / interfaces** — the shared tokens, naming, file layout, and the interfaces this output
   must conform to so it integrates with the other workstreams.
4. **Expected output schema** — exactly what to return (fields, file paths, format). Lean: cap arrays,
   short evidence (links not page-dumps), "your output IS data."
5. **Invoke skills** — "**Invoke skill `<plugin:skill>` if available** to strengthen this; otherwise
   proceed with the criteria below." List the optional enhancers Phase 0 detected. Never make the brief
   *depend* on a skill being installed.
6. **You MUST PASS these GATES** — for each selected gate, inline its `id`, `tier`, and the **concrete,
   self-contained pass-criteria** the output must satisfy. The worker should treat these as acceptance
   tests and self-verify before returning. Only list gates that have shipped criteria (Phase 0's
   anti-theater rule); never promise a `future` gate here. For a **browser-dependent** gate (e.g.
   `a11y`'s automated runner sweep) inline only the **browserless-capable subset** the worker can actually
   self-verify when no browser is provisioned (semantics / landmarks / label-association + the
   "PASS ≠ conformance" caveat) — never tell a worker to pass a check it cannot run.
7. **Lean-output + integration rules** — size caps, where long evidence lives (URLs), and how to keep the
   output mergeable against the contract.

## Skeleton

```text
MISSION
  <one sentence>

RESEARCH CONTEXT (what GOOD looks like)
  - <verified norm / constraint / bar>  (source: <Context7 / docs>)
  - ...

CONTRACT / INTERFACES
  - design tokens / naming / layout: <...>
  - interface this output must satisfy: <...>

EXPECTED OUTPUT
  - <schema / files / format>  — lean: <caps>. Your output IS data.

INVOKE SKILLS (optional enhancers — proceed without them)
  - Invoke `frontend-design` if available; else use the criteria below.

YOU MUST PASS THESE GATES (self-verify before returning)
  - GATE <id> [<tier>]: <inlined concrete pass-criteria — acceptance tests>
  - ...

LEAN-OUTPUT + INTEGRATION RULES
  - <size caps; link don't paste; conform to the contract>
```

## Filled example — a "hero section" UI workstream (gates: ui-ux, assets, a11y)

```text
MISSION
  Build the landing-page hero section (headline, subhead, primary CTA, hero visual) as a self-contained
  component that drops into the shared layout.

RESEARCH CONTEXT (what GOOD looks like)
  - Above-the-fold value prop + one primary CTA; secondary action de-emphasized.
  - Mobile-first; the CTA stays a >=24x24px tap target at all breakpoints (WCAG 2.2 AA 2.5.8).
  - Text over the hero image must stay readable -> real contrast, not eyeballed.

CONTRACT / INTERFACES
  - Use design tokens: --color-fg, --color-bg, --color-accent, spacing scale {4,8,12,16,24,32}.
  - Export <Hero/> consuming {headline, subhead, ctaHref}; no inline hex colors.

EXPECTED OUTPUT
  - One component file + its styles, conforming to the tokens. Return the file paths + a 3-line summary.
    Lean: no inline screenshots; link any asset by path. Your output IS data.

INVOKE SKILLS (optional enhancers — proceed without them)
  - Invoke `frontend-design` and `ui-ux-pro-max` if available (by their `plugin:skill` name; names
    illustrative); else use the criteria below.

YOU MUST PASS THESE GATES (self-verify before returning)
  - GATE ui-ux [tier: mixed (objective floor + critic)]:
      * WCAG AA contrast >=4.5:1 normal text / >=3:1 large (>=24px or >=18.66px bold) on every token pair
        used (sRGB->linear->relative luminance->ratio; compute it, don't guess).
      * Consistent spacing scale (only the tokens above); hover AND :focus-visible states present.
      * Responsive at >=3 breakpoints; no horizontal overflow; tap targets >=24x24px.
      * Alt text / accessible name on the hero visual and the CTA (folded a11y).
      * Not a generic AI-default layout (intentional type scale + rhythm).
  - GATE assets [tier: mixed (objective + advisory)]:
      * Every local asset referenced exists and is >0 bytes; SVGs are well-formed XML; a favicon is
        present for HTML; no placeholder hosts / lorem / empty src / TODO. Remote/CDN refs and
        "AI-filler" judgments are advisory only.
  - GATE a11y [tier: mixed (scoped runner + semantics/keyboard critic)]:
      * Semantic structure: one <main>, ordered headings, the CTA is a real <button>/<a> with a
        programmatic label; valid ARIA roles/states (no redundant/invalid roles).
      * Keyboard: every interactive control is reachable and operable by keyboard in a sensible order.
      * (contrast / alt text / accessible-name presence / tap-target are covered by ui-ux above -> not
        repeated here.) If a browser + axe/pa11y is provisioned, the scoped automated sweep must report
        gating_violations == 0. PASS != conformance (automation covers ~30-50% of WCAG SC).

LEAN-OUTPUT + INTEGRATION RULES
  - Return <=2 files + a 3-line summary; link assets by path, don't paste them.
  - Conform to the tokens/interface above so the section merges into the shared layout cleanly.
```

> The inlined gate criteria above are the **same** criteria the Phase-3 gate runner (v0.7+) will check in a
> separate context — forward-coupling means the worker and the verifier share one bar. Keep them in sync
> with the gate library as it ships.
