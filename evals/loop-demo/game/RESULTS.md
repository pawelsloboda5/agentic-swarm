# v0.8.0 Showcase — Results (the measured quality proof)

> Scored against the metric [`PREREGISTRATION.md`](./PREREGISTRATION.md) committed **before** any build.
> **Honesty up front: n=1 showcase, not a controlled benchmark — and the headline result is a NULL.**
> The architect harness did **not** measurably beat a single-shot worker given the same rubric on the
> pre-registered held-out primary. Reported as such, not inflated.

## Honesty up front

- The one **controlled** comparison is **harness vs `fair_control`** — both rubric-aware, both built here
  under identical conditions; the only difference is the harness's decompose + gated-integration + repair
  machinery vs a single shot. The two **committed pre-harness baselines** are reference context across ≥4
  confounded variables (plugin on/off, /loop vs harness, rubric-in-brief, browser).
- All NEW arms here are **subagent-built in one orchestration**, not separate human-driven `/loop` sessions
  like the committed baselines.
- **Retry asymmetry:** the harness arm got ≤2 gate-driven repairs; every other arm got one shot.

## The four artifacts

| Arm | File | Rubric-aware | Gate-repair | Lines |
|---|---|---|---|---|
| pre-harness baseline (plugin OFF) | `../baseline/index.html` | no | no | 1207 |
| pre-harness baseline (plugin ON, no harness) | `../agentic-swarm/index.html` | no | no | 1476 |
| fair control (single-shot, rubric in-prompt) | `baseline-fair/index.html` | yes | no | 1349 |
| **harness arm** (architect harness) | `game/index.html` | yes | **yes (≤2)** | 3071 |

## PRIMARY — runtime integrity (held out from the gate briefs + the fair control's prompt)

Which primary ran: **browser** (Playwright provisioned). Each game served over http, loaded headless,
played ~15 s; recorded uncaught/console errors + a non-blank canvas render. PASS = 0 uncaught errors AND
non-blank render.

> **Precision on "held out":** this metric is absent from every gate brief and from the fair control's
> prompt — but the harness's *own* internal briefs (`harness-arm.workflow.js`) explicitly asked the harness
> to "feature-detect WebGL", "delta-clamp the loop", "dispose dead objects", and "run without obvious
> error". So the harness was *coached on the primary and the fair control was not*, which makes the null
> **more conservative against the harness**, never an overclaim.
>
> **Environment (for the one live metric):** Playwright `1.61.1`, `@axe-core/playwright` `4.12.1`, Node 24,
> headless Chromium — pinned in `scoring/package.json` + lockfile.

| Arm | uncaught errors | console errors | non-blank render | axe (a11y rules) | **PRIMARY** |
|---|---|---|---|---|---|
| baseline OFF | 0 | 0 | yes (pixvar 800) | 1 | **PASS** |
| baseline ON | 0 | 0 | yes (pixvar 681) | 1 | **PASS** |
| fair control | 0 | 0 | yes (pixvar 573) | 0 | **PASS** |
| **harness** | 0 | 0 | yes (pixvar 400) | 0 | **PASS** |

**Pre-committed decision:** browser primary → harness wins iff it PASSES and `fair_control` does NOT.
**Both PASS ⇒ NULL.**

> **PRIMARY OUTCOME: NULL — no measured difference.** All four games actually run (0 uncaught errors,
> non-blank render). The harness arm did **not** beat the fair single-shot control on the held-out primary.
> **Read this honestly:** the primary discriminated **zero** arms — even both *rubric-blind* committed
> baselines PASS — so this null is an **absence of signal on a coarse instrument** ("does it boot + render
> without errors"), **not** positive evidence that the arms are equivalent. A discriminating held-out
> primary is the #1 thing a stronger future showcase needs.

## SECONDARY — gate scorecards (exploratory; favor rubric-aware arms by construction)

Deterministic **static** scorers: re-run `python scoring/aggregate.py --static-only` (writes
`scorecards_static.json`, so it never clobbers the committed live capture) or `score_static.py <arm>`
per-arm → **bit-identical** static numbers. The a11y/runtime row is a **live one-shot Playwright capture**
(non-deterministic; pixvar varies run-to-run). `uiux_states` = **H**over / **F**ocus-visible /
**B**reakpoint / **S**pacing-scale present. `assets` and `feature-completeness` came out **degenerate**
(identical across all four arms) — kept here for transparency, but per the pre-registration's drop-rule
they carry no discriminating signal.

| Metric (instrument) | baseline OFF | baseline ON | fair control | harness | Det.? |
|---|---|---|---|---|---|
| ui-ux contrast pairs passing | 1/2 | 6/6 | **9/9** | 6/6 | yes |
| ui-ux states (H/F/B/S) | H·B· | H·B· | **HFBS** | **HFBS** | yes |
| a11y axe gating / advisory | 1g / 0a | 1g / 0a | **0g** / 0a | **0g** / 0a | yes |
| assets (procedural, no placeholders) | ok | ok | ok | ok | yes |
| feature-completeness | 7/7 | 7/7 | 7/7 | 7/7 | yes+critic |
| static runtime-robustness /4 | 2/4 | 4/4 | 4/4 | 4/4 | yes |
| playability (binary critic, AUX) | yes | yes | yes | yes | no (critic) |

**What the secondaries actually show (read carefully):**
- The two **rubric-aware** arms (`fair_control`, `harness`) both add **`:focus-visible`**, a **spacing
  scale**, and **0 a11y-gating violations** — exactly the gate criteria — which **both rubric-blind
  committed baselines lack** (`H·B·`, 1 a11y violation each). So *knowing the rubric* appears to move the
  gated metrics — though this committed-vs-new comparison **also carries the build-method confound**
  (subagent orchestration vs human `/loop`), so it is suggestive, not clean. The *clean* rubric isolation
  is harness-vs-fair (both rubric-aware), and there they are tied.
- **harness vs `fair_control` are essentially tied** (the one clean comparison): identical `HFBS`,
  identical 0 a11y-gating, identical 4/4 robustness and 7/7 features; the harness's contrast heuristic
  detects **fewer pairs** (6 vs 9 — **both at 100% pass**, an artifact of the under-counting heuristic, not
  worse contrast). The harness produced **2.3× more code** (3071 vs 1349 lines) with **no measured quality
  advantage** over the single-shot control.

## AUXILIARY — playability critic (separate-context, non-deterministic)

A skeptical fresh-context reviewer read all four games' core loops (cited). **All four are playable**
(spawn → path-follow → tower targeting → projectiles/damage → wave escalation → win/lose, all present and
cited in each file). On the methodology question — **harness vs `fair_control`** — the reviewer found them
**essentially comparable as games**: nearly identical mechanics by design (3 towers arrow/cannon/frost, 3
enemy roles, first-along-path targeting, splash/slow, upgrade+sell, win+lose). The harness's extra ~1700
lines go **almost entirely to architecture + defensive scaffolding** (a model/view mesh-reconciler, an
event-bus store, per-component fallback meshes, WebGL context-loss handling, a boot-error overlay) plus
screen-shake — i.e. **engineering robustness, not player-facing depth**. The `fair_control` was judged
*marginally more curated* on the player-facing side (a hand-authored final boss-rush wave vs the harness's
purely algorithmic waves). The reviewer also flagged a **duplicated config block** in the harness
(`GAME.config` declared twice) — "more surface area without more game." This is auxiliary and
non-deterministic; it **corroborates** the deterministic null (it is not a tiebreaker).

## Bottom line

On this n=1 showcase, with this instrument, **the measured advantage belongs to "rubric in the prompt,"
not to "the harness machinery."** Forward-coupling the gate criteria into the build (the headline novelty's
*core idea*) clearly helps — both rubric-aware arms beat the rubric-blind committed baselines on every
gated dimension. But the harness's *additional* machinery — decomposition, parallel fan-out, gated
integration, repair — did **not** measurably beat a single rubric-aware worker on this game. The held-out
primary (does it actually run?) is a clean **NULL** (all four work).

**Honest implication for the track:** the evidence supports the *narrow* claim (gate-aware briefing > no
rubric) but **not** a decomposition/orchestration uplift. v1.0 — which gates on "the showcase measures the
uplift" — should make only the claim the data supports, or run a stronger showcase (see Limitations).

## Caveats / limitations (the rigor markers)

- **n=1, uncontrolled, one build per arm.** No statistical inference. Determinism of the scorers is not
  evidence of an effect; it only means the ruler does not wobble.
- **Build method** differs from the committed baselines (subagent orchestration vs human `/loop`).
- **Secondary metrics measure "conformance to the spec we asked for," not independent quality** — they
  favor rubric-aware arms by construction. Only the held-out primary is the methodology claim, and it is null.
- **Instrument blind spots that could hide a real harness advantage:** the contrast metric only scores
  explicit `color`+`background` co-declarations (under-counts); features/robustness are keyword heuristics;
  the primary ("renders + no errors") is coarse — it cannot see game-feel, balance, or depth. A harness
  advantage on *those* dimensions would not show up here; the auxiliary playability critic is the only
  (non-deterministic) probe of it, and is reported as auxiliary.
- **The retry asymmetry favors the harness** and it still did not win — which makes the null result, if
  anything, conservative against the harness.
- This is a single genre (tower-defense) at one effort level. A different/larger task could differ.

## Artifacts

| File | Role |
|---|---|
| `PREREGISTRATION.md` | the pre-committed metric/threshold/null + fairness design (committed before any build) |
| `game/index.html` | the harness-arm build (3071 ln) |
| `baseline-fair/index.html` | the fair single-shot control (1349 ln) |
| `../baseline/index.html`, `../agentic-swarm/index.html` | the committed pre-harness baselines |
| `scoring/score_static.py`, `scoring/score_runtime.mjs`, `scoring/aggregate.py` | the one shared instrument (`--static-only` for the deterministic check) |
| `scoring/scorecards.json` | the raw per-arm scores (static = deterministic; runtime = live one-shot) |
| `harness-arm.workflow.js` | the architect-harness build script — committed + re-runnable (the build is a real multi-agent run, **not** bit-identical output) |
| `fair-control.prompt.md` | the exact single-shot prompt for the fair control (build provenance) |
