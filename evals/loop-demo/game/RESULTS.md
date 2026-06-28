# v0.8.0 Showcase — Results (the measured quality proof)

> **Scaffold committed before the build** (see [`PREREGISTRATION.md`](./PREREGISTRATION.md)); result cells
> are filled only after scoring. **Honesty up front: n=1 showcase, not a controlled benchmark.** A null or
> a harness loss is reported as such — the showcase does not require a win.

## Honesty up front

- The single **controlled** comparison is **harness arm vs `baseline-fair`** (both rubric-aware, built
  here under identical conditions; the only difference is decompose+gated-integration+repair vs single-
  shot). The two **committed pre-harness baselines** are reference context across ≥4 confounded variables.
- All NEW arms here are **subagent-built in one orchestration**, not separate human-driven `/loop`
  sessions like the committed baselines — see Caveats.
- **Retry asymmetry:** the harness arm gets ≤2 gate-driven repairs; every other arm gets one shot.

## The four artifacts

| Arm | File | Rubric-aware | Gate-repair | Lines |
|---|---|---|---|---|
| pre-harness baseline (plugin OFF) | `../baseline/index.html` | no | no | 1207 |
| pre-harness baseline (plugin ON, no harness) | `../agentic-swarm/index.html` | no | no | 1476 |
| fair control (single-shot, rubric in-prompt) | `baseline-fair/index.html` | yes | no | _PENDING_ |
| **harness arm** (architect harness) | `game/index.html` | yes | **yes (≤2)** | _PENDING_ |

## PRIMARY — runtime integrity (held-out; in NO brief)

> Which primary ran: **_PENDING_** (browser if Playwright provisioned, else the static fallback —
> disclosed here with the reason).

| Arm | Browser: uncaught errors / non-blank | Static robustness 0–4 (a,b,c,d) | Primary verdict |
|---|---|---|---|
| pre-harness baseline (OFF) | _PENDING_ | _PENDING_ | _PENDING_ |
| pre-harness baseline (ON) | _PENDING_ | _PENDING_ | _PENDING_ |
| fair control | _PENDING_ | _PENDING_ | _PENDING_ |
| **harness arm** | _PENDING_ | _PENDING_ | _PENDING_ |

**Pre-committed decision (verbatim from PREREGISTRATION):** browser primary → harness wins iff it PASSES
and `baseline-fair` does NOT; fallback → harness wins iff `harness − fair ≥ 1`. Otherwise **NULL**.

**Primary outcome: _PENDING_** (win / null / harness-loss — stated plainly).

## SECONDARY — gate scorecards (exploratory; favor rubric-aware arms by construction)

| Metric (instrument) | baseline OFF | baseline ON | fair control | harness | Deterministic? |
|---|---|---|---|---|---|
| ui-ux contrast pass-count (`wcag_contrast.py`) | _PENDING_ | _PENDING_ | _PENDING_ | _PENDING_ | yes |
| ui-ux states/scale/breakpoints (static) | _PENDING_ | _PENDING_ | _PENDING_ | _PENDING_ | yes |
| a11y axe gating_violations (`a11y_report.py`) | _PENDING_ | _PENDING_ | _PENDING_ | _PENDING_ | browser-gated |
| assets realness (sweep+favicon) | _PENDING_ | _PENDING_ | _PENDING_ | _PENDING_ | yes (drop if degenerate) |
| feature-completeness /8 | _PENDING_ | _PENDING_ | _PENDING_ | _PENDING_ | yes+critic |
| playability (binary critic, AUX) | _PENDING_ | _PENDING_ | _PENDING_ | _PENDING_ | no (critic) |

## Caveats (the rigor markers)

- **n=1, uncontrolled, one build per arm.** No statistical inference, no generalization. Determinism of
  the scorers is NOT evidence of an effect.
- **Build method** differs from the committed baselines (subagent orchestration vs human `/loop`).
- **Secondary metrics favor rubric-aware arms by construction** — they measure "conformance to the spec we
  asked for," not independent quality. Only the held-out primary is the methodology claim.
- **Confounds** vs committed baselines: plugin on/off, /loop vs harness, rubric-in-brief, browser. Named,
  not hidden.
- Whatever the browser-dependent scoring could/could not run is stated explicitly (degrade loudly).

## Bottom line

**_PENDING_** — filled from the primary outcome, stated plainly (including "no measured difference" or
"harness did not beat the fair control" if that is what the data shows).

## Artifacts

| File | Role |
|---|---|
| `PREREGISTRATION.md` | the pre-committed metric/threshold/null + fairness design |
| `game/index.html` | the harness-arm build |
| `baseline-fair/index.html` | the fair single-shot control |
| `../baseline/index.html`, `../agentic-swarm/index.html` | the committed pre-harness baselines |
| `scorecards.json` | the raw per-artifact scores (deterministic scorers) |
| `transcript-*.md` | build transcripts / workstream artifacts |
