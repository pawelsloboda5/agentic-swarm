# Fair-control arm — the exact build prompt (provenance)

The `baseline-fair/index.html` control was built by a **single** general-purpose subagent in **one shot**
(no decomposition, no gated-integration, no repair pass), given the **identical rubric** the harness
forward-couples. This file commits the exact prompt for fairness transparency (so the "same rubric,
single-shot, no repair" claim in `PREREGISTRATION.md` is verifiable, not just asserted). The harness arm's
provenance is its committed `harness-arm.workflow.js`.

> **Note on build method (also in RESULTS caveats):** both NEW arms were built by subagents in this
> orchestration, not by separate human-driven `/loop` sessions like the two committed baselines.

## Verbatim prompt given to the fair-control subagent

```
You are building a control artifact for a measured showcase. Build it SINGLE-SHOT and INDEPENDENTLY — do
NOT decompose into subagents, do NOT look at any other arm's files (do not read
evals/loop-demo/game/index.html, .contract.md, or .workstreams/). Build from scratch yourself.

GOAL (the shared prompt): Create a Three.js 3D tower-defense game in a single self-contained index.html:
enemies spawn and follow a path toward your base, you place towers on buildable tiles to shoot them, waves
escalate in difficulty, and a HUD shows score, lives, and gold for buying/upgrading towers. Make it
playable and visually polished. Use Three.js from a CDN (importmap); procedural geometry only (no external
art assets).

ACCEPTANCE CRITERIA (the rubric — build TOWARD these; both arms in this experiment are given this same
rubric, so knowing it is fair):
- Gameplay: enemies spawn + follow the path (lose a life at the base); place towers on buildable tiles;
  towers target + shoot projectiles + deal damage + can be upgraded; waves escalate; economy with
  gold-on-kill, costs, score, lives, win/lose.
- HUD: score, lives, gold, wave readouts; a tower shop with buy/upgrade controls; start/pause/game-over.
- ui-ux: WCAG-AA contrast on all text/background token pairs (verify a pair with
  `python skills/architect/gates/lib/wcag_contrast.py <fg> <bg> normal` — exit 0 means pass, ratio >= 4.5);
  real :hover AND :focus-visible on every control; a consistent spacing scale; at least one responsive
  breakpoint; an intentional visual design (not the generic AI-default look).
- a11y: a semantic HUD (landmarks/headings); accessible names on controls; a keyboard affordance to select
  or buy a tower. (Automated checks catch only ~30-50% of WCAG — PASS is not full conformance.)
- assets: procedural geometry/materials only; no placeholder hosts, lorem, empty src, or external files.
- robustness: feature-detect WebGL and fail gracefully with a visible message (never a silent white
  screen); a delta-clamped animation loop; dispose objects you remove; wrap init so a thrown error shows.

OUTPUT: write ONE complete, self-contained, working file to
evals/loop-demo/game/baseline-fair/index.html. Three.js via a CDN importmap; no build step; no external
assets. It must actually run when opened in a browser. After writing it, return a SHORT summary.
```

The subagent self-reported it implemented all criteria, verified its WCAG pairs with the bundled util, and
caught+fixed a real shared-projectile-geometry dispose bug during self-review. Its scorecard
(`scoring/scorecards.json`) shows it matching or **beating** the harness on every secondary — the score
pattern of an honest/generous control, not a sandbagged one.
