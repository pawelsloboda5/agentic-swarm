# v0.8.0 Showcase — Pre-Registration

> **Committed BEFORE any arm is built or scored** (git history is the proof). This locks the primary
> metric, the threshold, the null definition, and the fairness design so the result cannot be
> cherry-picked after the fact. Folds in the measurement-honesty critique (`wf_48ee3d82-2de`).
> **Honest framing up front: this is an n=1 showcase, not a controlled benchmark.**

## The question

Does building "a Three.js tower-defense game" **through the architect harness** (research → decompose →
gated skill-aware briefs → safe fan-out → gated integration, with N≤2 gate-driven repair) produce a
**more robust, more complete** result than a **single-shot worker given the identical rubric**?

## The arms (4 artifacts, scored by one instrument)

| Arm | What | How built | Knows the gate rubric? | Gate-driven repair? |
|---|---|---|---|---|
| `baseline/` (committed) | Crystal Keep (1207 ln) | v0.5 real bare `/loop`, plugin OFF | no | no |
| `agentic-swarm/` (committed) | Prism Defenders (1476 ln) | v0.5 real bare `/loop`, plugin ON (no architect harness) | no | no |
| `baseline-fair/` (new) | the **fair control** | single-shot worker, **rubric in-prompt** | **yes** | no |
| `game/` (new) | the **harness arm** | architect harness (decompose + gated briefs + integration) | yes | **yes (≤2)** |

**Why the fair control exists (the load-bearing fix):** the harness arm gets the rubric in its briefs
*and* up to 2 gate-driven repairs against it; the committed baselines saw neither. Scoring only those
three with the same ruler would measure "we told one builder the answer key," not methodology. The
**`baseline-fair` arm equalizes rubric-knowledge** (same criteria in-prompt, single shot, no repair), so
the harness-vs-fair delta isolates **decomposition + gated integration + repair** — the actual claim.

## PRIMARY metric (held-out — appears in NO brief)

**Runtime integrity.** Neither the shared game prompt nor any gate brief (ui-ux / assets / tests / a11y)
asks for runtime robustness — so it is genuinely held out. Two readouts, in priority order:

1. **Browser runtime integrity (if Playwright provisions — the preferred primary):** load each
   `index.html` headless, run **15 s** of scripted play, record **uncaught console errors** and whether
   the **canvas renders non-blank** (pixel variance over a fixed threshold). **PASS = 0 uncaught errors
   AND non-blank render.**
2. **Static runtime-robustness score 0–4 (fallback primary if no browser — disclosed as fallback):** a
   deterministic + separate-context-critic audit, each binary with a cited line: (a) a WebGL/Three.js
   availability guard (graceful when WebGL is absent); (b) dead game objects removed from the scene **and
   disposed** (no unbounded growth); (c) the animation loop guarded (delta-clamped or visibility-aware,
   not an unbounded accumulator); (d) init wrapped so a throw doesn't white-screen silently.

**Decision rule (pre-committed):**
- Browser primary available: **harness "wins" the primary iff it PASSES and `baseline-fair` does NOT.**
- Fallback primary: **harness "wins" iff `harness_score − fair_score ≥ 1` (out of 4).**
- **NULL / no measured difference** (reported plainly, not spun): browser primary both-pass-or-both-fail;
  or fallback `|harness − fair| < 1`. A null or a harness loss is reported **as such** — the showcase
  does not require a win.

Whichever primary runs is disclosed; the other is reported as "not run (reason)".

## SECONDARY metrics (exploratory — "conformance to spec we asked for", NOT the headline)

Scored on all 4 artifacts with the **same instrument**; deterministic where noted, critic rungs flagged
non-deterministic. These were in the shared prompt and/or the harness briefs, so they favor the rubric-
aware arms **by construction** — reported as secondary context only:
- **ui-ux objective floor** (deterministic): WCAG-AA contrast pass-count over the CSS token pairs, via
  `skills/architect/gates/lib/wcag_contrast.py`; presence of `:hover`/`:focus-visible`, a spacing scale,
  responsive breakpoints.
- **a11y** (browser-gated): an axe run via `a11y_report.py` if Playwright+axe provisioned; else "not run".
- **assets realness** (deterministic): placeholder/lorem/empty-src sweep + favicon presence. *Likely
  degenerate* (all arms are procedural single-file) — confirmed-discriminating-or-dropped before reporting.
- **feature-completeness** (from the shared prompt, deterministic + critic): enemies spawn, path-follow,
  tower placement on buildable tiles, shooting, wave escalation, HUD (score/lives/gold), tower buy/upgrade.
- **AUXILIARY — playability** (separate-context **binary** critic with citations, NOT a holistic score;
  NOT a library gate): does a fresh reviewer judge it launches into a playable loop? Labeled auxiliary.

## Confounds (named, not hidden)

- `agentic-swarm/index.html` is the v0.5 **plugin-ON bare-`/loop`/naive-swarm** arm — **not** a bare
  baseline. The two committed games are the **"pre-harness baselines"**.
- harness-vs-committed changes ≥4 variables at once (plugin, /loop-vs-harness, rubric-in-brief, browser).
  The **single clean comparison is harness vs `baseline-fair`** (methodology only). Committed baselines
  are reference context.
- **Build-method caveat:** all NEW arms here are built by **subagents in one orchestration**, not by
  separate human-driven `/loop` sessions like the committed baselines — disclosed in RESULTS.
- **Retry asymmetry:** harness arm gets ≤2 gate-driven repairs; all others get one shot. Disclosed in
  every table caption.

## Determinism / reproducibility scope

Only the **objective-floor scorers** (`wcag_contrast.py`, `a11y_report.py`, the static sweeps) are
deterministic / re-runnable bit-identically over the fixed artifacts. The **builds** (real agents) and the
**critic rungs** (LLM judges) are **not** deterministic. Determinism of the ruler is **not** evidence of an
effect — the comparison remains **n=1, uncontrolled, one build per arm, no statistical inference**.

## Definition of done (this milestone)

`game/index.html` + `baseline-fair/index.html` built; all 4 artifacts scored; `RESULTS.md` filled with the
primary outcome (even if null/negative) + secondary scorecards + every caveat above; ship-gated to 0
blockers; **PR opened and left for review — not tagged/released** (that is a separate user decision).
