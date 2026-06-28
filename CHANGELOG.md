# Changelog

All notable changes to **agentic-swarm** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-06-28

**The narrowed claim — 1.0 ships honest.** Across **three** pre-registered, held-out, measured showcases
(v0.8 game · v0.9 engine · v0.10 library), the architect harness was compared against a **fair single-shot
control** given the *identical* spec/rubric. The converged finding: on self-contained, objectively-scorable
build tasks, **strong single shots produce correct, complete artifacts in one pass, and the architect
harness adds NO measurable artifact-quality or completeness uplift** over a fair single shot — only ~5× the
token cost. The decomposition + gated integration is **completeness-faithful** (it matches the single-shot
ceiling without dropping requirements), so the honest case is *"no uplift at ~5× cost," not "it degrades the
work."* v1.0 therefore **narrows the harness's claim to its PROCESS guarantees** — safe parallel throughput,
bounded repair, gated forward-coupling of disclosed criteria, auditability, completeness-faithful
integration — and **stops claiming artifact-quality / completeness uplift** or "better work than one agent."
Consolidated evidence: [`evals/loop-demo/MEASURED.md`](evals/loop-demo/MEASURED.md).

> **Supersedes** the "the quality uplift is unproven until the showcase measures it" framing in the v0.6.0
> and v0.7.0 entries below (and in the dated design/plan docs under `docs/plans/`): the showcases ran, and
> measured no uplift. Those dated entries are preserved as historical record; the **live** skill surfaces
> and README now state the measured posture.

### Added

- **`evals/loop-demo/MEASURED.md`** — one canonical page consolidating the three measured nulls into the
  converged finding, the narrowed "process guarantees" claim, the method/integrity summary, and the one
  explicitly-untested regime (non-enumerable / 100+ requirements / repo-scale work) — **offered as a future
  user decision, not run** (running variants until one discriminates would be p-hacking). Cited by the
  README, the architect skill, and this entry.
- **`docs/plans/2026-06-28-v1.0.0-narrowed-claim.md`** — the v1.0.0 plan and the full claims-surface audit
  (`file:line → old claim → honest reword`).

### Changed

- **Narrowed every live claim to the measured posture.** `skills/architect/SKILL.md` (frontmatter
  description, title, 3-layer framing, the headline-novelty caveat, the Phase-3 note) and
  `skills/architect/reference/brief-template.md` no longer claim the harness "produces better work than one
  agent" or that the uplift is "unproven pending a showcase"; they state it adds **no artifact-quality
  uplift** and is shipped for its **process guarantees**, citing `MEASURED.md`.
- **README** — corrected the stale `0.4.0` version badge → `1.0.0`; added a "The architect layer (measured)"
  section (process guarantees; the measured three-null finding; links `MEASURED.md`) and a `What's inside`
  row for `/agentic-swarm:architect`; fixed an inaccurate "benefit grows with model capability" line (the
  eval table shows mid-tier models gain the most). The separate safe-orchestration eval (+56–71 pts) is a
  **process/safety** result and is unchanged.
- **Dated design/plan docs** under `docs/plans/` now carry a "superseded by measurement" banner pointing to
  `MEASURED.md`; the architecture-design doc (linked from the live skill) also had its present-tense "better
  work" Vision lines corrected. The dated bodies are otherwise preserved as provenance.
- `.claude-plugin/plugin.json` version **0.10.0 → 1.0.0**. (`marketplace.json` stays version-less by design.)

> **Scope note:** v1.0.0 is a **claims-correction + release** milestone, **not a new eval** — it cites the
> frozen evidence and runs no new showcase. The originally-planned **gate-schema freeze** (build-task-plan
> §v1.0-T2) is **deferred** past 1.0.0 as a later additive decision.

## [0.10.0] — 2026-06-28

The **completeness-under-scale showcase** — and an honest **third NULL**. We tested the architect harness's
*strongest theoretical case*: on a single artifact with **40 mutually-independent requirements** (a
zero-dependency "wire-format & canonical-form toolkit" library), does decomposition into 6 disjoint
workstream slices + gated integration produce a **more complete** result — fewer **silently dropped
requirements** — than a fair single-shot worker given the identical spec? Measured against a **decomposed,
validated, held-out** instrument, **pre-registered before any scored arm**, the answer is **no**: strong
single shots produce **fully-complete, fully-correct** libraries in one pass (no drops, every held-out edge
correct), and the harness **matches** that ceiling exactly — completeness-faithful, no integration drops —
at **~5.4× the tokens**. Reported as measured, not inflated — see
[`evals/loop-demo/lib/RESULTS.md`](evals/loop-demo/lib/RESULTS.md).

> **Version note:** this milestone **follows v0.9.0** (the discriminating-showcase attempt, PR #9). It was
> developed off `main` (v0.8.0) in parallel with v0.9.0 and merged after it.

### Added

- **Completeness-under-scale showcase** under `evals/loop-demo/lib/` — six self-contained 40-export
  ES-module libraries scored by **one per-export-isolated held-out instrument**: K=3 architect-harness
  builds (`arms/harness-{1,2,3}/lib.mjs`, built by a real contract → 6-slice fan-out → gated-integration
  Workflow) vs K=3 **fair single-shot controls** (`arms/control-{1,2,3}/lib.mjs`, given the identical
  frozen `SPEC.md`). Includes `PREREGISTRATION.md` (the **decomposed** OMISSION/EDGE/CASCADE metric +
  per-axis decision rule + frozen SHA-256s, committed first), `DESIGN.md` + `CRITIQUE.md` (the Phase-0
  design + the adversarial critic's 3 resolved blockers), `PILOT.md` + `SCRUB.md` (the disclosed
  pre-flight), `RESULTS.md`, the **pure-node** scorer (`scoring/` — zero provisioning, no Playwright), and
  the reproducible `lib-harness.workflow.js` / `lib-shipgate.workflow.js` / `design-swarm.workflow.js`.
- **Per-export-isolated scorer** — each of the 40 exports is scored in its own child process with an 8 s
  timeout, so a single non-terminating export costs exactly **1/40**. Validated against a correct reference
  (1.00), a deliberately-incomplete reference (**0.80** omission / **0.65** complete), and a hang stub
  (**0.975**) — the ruler measures coverage, not schema.

### Measured result (honest)

- **PRIMARY (OMISSION-completeness = completeness under scale): NULL — degenerate ceiling.** harness mean
  **1.00**, control mean **1.00**, delta **0.00**; mechanical `verdict.py` = `NULL (ceiling)`. A checklist
  of 40 enumerated, objectively-specified functions is within a capable model's one-pass capacity, so there
  are **no silent drops** for the harness's decomposition to prevent.
- **SECONDARY (also flat):** EDGE-correctness delta **0.00** (single shots got all 186 held-out edges
  right); no failures → no shared-helper cascades. New sub-finding: the harness's integration is
  **completeness-faithful** (matches the ceiling without dropping requirements), so the case is "no uplift
  at ~5.4× cost," **not** "it degrades the work."
- **Implication:** the **third** honest null across three task families (game, engine, library) — now with
  an instrument **decomposed by mechanism** that could have attributed a win to the correct cause and found
  none. v1.0 posture: ship the harness for its **process** guarantees (parallel throughput, bounded repair,
  gated forward-coupling, auditability, faithful integration) and **do not** claim artifact-quality /
  completeness uplift from orchestration.

### Changed

- `.claude-plugin/plugin.json` version **0.9.0 → 0.10.0**. (`marketplace.json` stays version-less by design.)

## [0.9.0] — 2026-06-28

The **discriminating-showcase attempt** — an honest **NULL**, and (more valuably) a **measurement-integrity
case study**. We set out to build a *sharper* primary than v0.8.0's coarse "does it boot" (which discriminated
zero arms): a held-out **state-fidelity** check on a bespoke deterministic integer simulation engine, scored by
pure self-consistency. After correcting **two** instrument artifacts caught during the run, the task turned out
**not to discriminate** — strong single-shot workers produce **fully-correct** engines, and the architect
harness matches them at **~5× the token cost**. Reported as measured — see
[`evals/loop-demo/engine/RESULTS.md`](evals/loop-demo/engine/RESULTS.md). The v1.0 gate ("ship only after a
showcase measures the uplift") remains **not met**.

### Added

- **Discriminating-showcase eval** under `evals/loop-demo/engine/` — a bespoke deterministic integer sim engine
  (`SPEC.md`, `window.ENGINE`) built K=3× by a fair single-shot control vs K=3× through the architect harness
  (`engine-harness.workflow.js`), scored by ONE held-out **self-consistency** instrument
  (`scoring/invariants.mjs`; no external oracle, integer state → no float/NaN marshaling). Includes
  `PREREGISTRATION.md` (held-out primary + binary decision rule, committed before any arm), `PILOT.md` (the
  calibration + the disclosed post-freeze instrument-correction deviation), `RESULTS.md`, the mechanical
  `scoring/verdict.py`, the `reference`/`reference-broken` instrument anchors (1.00 / 0.33),
  `results.json` + `results-prefreeze.json`, the six scored arms, and `engine-shipgate.workflow.js`.
- **Provisioned (showcase-only)** Playwright under `evals/.../engine/scoring/` — the shipped plugin stays
  **zero-provision / zero-dependency**.

### Measured result (honest)

- **PRIMARY (F_FID — state fidelity under continuation): NULL — degenerate ceiling.** Harness mean F_FID =
  control mean = **1.00** (delta 0.00, mechanical `verdict.py`). On this task a fair single shot already
  produces a fully-correct engine (determinism, idempotence, conservation, monotonic events, *and* exact
  save/load), so there is **no correctness gap** for the harness to close; it matches at ~5× the token cost.
- **Two instrument artifacts caught + corrected** before either could ship a false result — (1) event-field-name
  coupling (caught in the pilot, before the prereg locked); (2) an event-log/draining asymmetry in F_FID
  (caught *after* the builds, because a fair control's self-report contradicted its score). The fix is a
  disclosed, neutral, **verdict-preserving** deviation (NULL both before `0.33=0.33` and after `1.00=1.00`,
  verifiable from `results-prefreeze.json` + `results.json`); the corrected instrument is validated **not
  vacuous** (`reference-broken` scores 0.33).
- **Integrity:** arms were built in an isolated sandbox after two in-repo controls were caught reading the
  scorer; a 5-lens **measurement-integrity** ship-gate returned **0 blockers**.
- **Implication:** corroborates v0.8.0 — the harness adds **no measurable artifact-quality uplift** over a fair
  single shot, now shown on two task families with a *validated* fine-grained instrument (not just a coarse
  one). The harness's *strongest* case — **completeness under scale** (many independent requirements where a
  single shot's attention might drop some) — remains **untested** and is the honest next experiment. v1.0
  should ship the harness for its **process** guarantees (throughput, bounded repair, gated forward-coupling,
  auditability), **not** artifact quality.

## [0.8.0] — 2026-06-28

The **measured showcase** — and an honest **null** headline. We re-built the Three.js tower-defense game
**through the architect harness** and measured it against a **fair single-shot control given the same
rubric**, with a **pre-registered held-out primary metric** (committed before any build). The result does
**not** show a harness/decomposition uplift; it shows that **forward-coupling the rubric into the build
helps, but the harness's extra machinery did not beat a single rubric-aware worker on this n=1 task**.
Reported as measured, not inflated — see [`evals/loop-demo/game/RESULTS.md`](evals/loop-demo/game/RESULTS.md).

### Added

- **Measured showcase** under `evals/loop-demo/game/` — four self-contained Three.js games scored by **one
  shared instrument**: the architect-harness build (`game/index.html`, 3071 ln, built by a real
  research→contract→gated-workstreams→gated-integration Workflow), a **fair single-shot control**
  (`baseline-fair/index.html`, given the identical rubric), and the two committed pre-harness baselines.
  Includes `PREREGISTRATION.md` (the held-out primary + decision rule + numeric null, committed first),
  `RESULTS.md`, the deterministic + Playwright scorers (`scoring/`), `scorecards.json`, and the
  reproducible `harness-arm.workflow.js`.
- **Provisioned (showcase-only)** Playwright + `@axe-core/playwright` under `evals/.../scoring/` — the
  shipped plugin stays **zero-provision**.

### Measured result (honest)

- **PRIMARY (held-out runtime integrity): NULL.** All four games load with **0 uncaught errors** and a
  non-blank render — the harness arm did **not** beat the fair control on the pre-registered primary.
- **SECONDARY (in-brief, favors rubric-aware arms by construction):** both rubric-aware arms add
  `:focus-visible` + a spacing scale + **0 a11y-gating violations** the rubric-**blind** committed
  baselines lack — but **harness vs fair control are essentially tied** (the harness's contrast heuristic
  merely *detects fewer pairs* — both 100% pass — with 2.3× the code). The held-out primary discriminated
  **zero** arms (all four boot + render clean), so the null is an absence-of-signal on a coarse instrument.
- **Implication:** the evidence supports the narrow claim (gate-aware briefing > no rubric) but **not** a
  decomposition/orchestration uplift. The **v1.0** gate ("ship only after the showcase measures the
  uplift") is therefore **not met by this n=1 showcase** — v1.0 should narrow its claim to what the data
  supports or run a stronger/larger showcase. Full caveats (instrument blind spots, n=1, retry asymmetry,
  build-method confound) are in `RESULTS.md`.

## [0.7.1] — 2026-06-27

The standalone-`a11y` release: completes the v0.7 gate library with the full **`a11y`** gate the v0.7.0
design deferred — an auto-detected accessibility-runner sweep + a keyboard/semantics critic — **without
double-counting** the cheap checks `ui-ux` already owns and **without ever rubber-stamping** ("PASS ≠
conformance"). Shipped as a patch because it is an **additive feature completing v0.7.0's originally-scoped
a11y** (per the 0.7.0 deferral note), not a bugfix — pre-1.0, additive work folds into the open `0.x` line,
and `0.8.0` is reserved for the measured Three.js showcase.

### Added

- **a11y** (mixed — `skills/architect/gates/a11y.md`): the standalone accessibility gate, a 7-key
  definition whose objective floor is a
  **scoped** automated runner sweep (axe → pa11y → Lighthouse priority) and whose critic rung is a
  separate-context **static-semantics + keyboard** check. It gates only on **a11y-distinctive** rules —
  contrast / alt-text / accessible-name presence / tap-target stay **single-owned by `ui-ux`** and are
  surfaced **advisory** here (no double-count). The automated runner is a **browser-dependent optional
  enhancer**: with no runner present the gate **skips-with-note** and falls back to the browserless static
  critic, and if nothing a11y-specific is verifiable it emits an honest **`flag`** — never a borrowed-
  evidence pass (mirroring the `tests`/`ui-ux` precedent). Carries a prominent **"PASS ≠ conformance"**
  caveat (automation covers ~30–50% of WCAG SC; confidence never reaches 1.0 on automation alone).
- **Zero-dep a11y runner-output normalizer** (`skills/architect/gates/lib/a11y_report.py`): turns the
  **heterogeneous** JSON each runner emits into one verdict. Defensive by construction — accepts both the
  programmatic-object and the **CLI bare-array** serializations of axe and pa11y (the pa11y CLI emits a
  bare array — the silent-false-pass trap), **fails closed** on malformed input (`error` + `pass: False` +
  exit 2, never `count == 0 ⇒ pass`), treats the Lighthouse score as **advisory + null-safe** (never a hard
  gate, never coerced to 0), and partitions ui-ux-owned rules to advisory. CLI exit `0/1/2` + ASCII-only
  output mirror the WCAG util. Unit-tested with fixtures for every shape (`tests/test_a11y_report.py`).
- **a11y activated across the harness** — un-folded from `ui-ux` in `reference/usecase-gate-map.md`
  (future → active; added to the Web-UI / landing / dashboard gate-sets), added to the
  `reference/gate-runner.md` starter table, the `SKILL.md` active-gates line + starter-library annotation,
  and the `reference/brief-template.md` (a conditional a11y block — only the browserless-capable subset is
  inlined when no browser, so a "MUST PASS" instruction is never unsatisfiable).
- **Tests** — the gate-library guard now covers `a11y` across all structural + **tier-drift** surfaces
  (renamed to `ACTIVE_GATES`), plus a decomposition guard that `a11y` defers ui-ux-owned checks to advisory
  and flags (never borrow-passes) when no runner is present.

> The full design rationale + the 6-lens adversarial planning critique that reconciled it are in
> `docs/plans/2026-06-27-v0.7.1-standalone-a11y-gate.md`; the **measured Three.js showcase** (v0.8.0) and
> the schema-freezing **v1.0** still follow — see `docs/plans/`.

## [0.7.0] — 2026-06-27

The gate-runner release: the architect's Phase 3 can now **run** the quality gates it forward-couples
into briefs — a tiered, objective-anchored gate library that reports confidence and refuses to rubber-stamp.

### Added

- **Gate runner** (`skills/architect/reference/gate-runner.md`) — the contract that turns a gate
  definition into a `verdict`: gate + verdict schemas, LOAD+validate, a zero-dep skill-detection probe,
  run-by-tier (objective machine check / separate-context critic / advisory), one verdict per applicable
  gate, the **anti-theater invariant** (no `pass` without ≥1 evidence + tier + confidence), bounded-N=2
  re-brief on fail, and **graceful-not-silent** degradation (missing backing skill/runner ⇒
  `degraded: true` + lowered confidence + a visible note, never a silent pass).
- **Starter gate library** `{tests, assets, ui-ux}` (`skills/architect/gates/*.md`) — each a
  self-contained 7-key definition (`id, applies_when, tier, criteria, verifier, confidence,
  backing_skill`): **tests** (mixed: objective floor — green AND >0 collected, typecheck/build,
  diff-coverage — + a critic rung that checks the suite exercises the change),
  **assets** (mixed — placeholder sweep + stdlib stat + SVG well-formed + favicon; AI-filler advisory),
  **ui-ux** (mixed — WCAG contrast + spacing/states/breakpoints + folded cheap a11y; screenshot critic
  if a browser is available, else advisory). External skills are optional enhancers only (portability).
- **Zero-dep WCAG contrast util** (`skills/architect/gates/lib/wcag_contrast.py`) — the objective-floor
  primitive for `ui-ux`: importable `ratio`/`passes`/`luminance`/`parse_hex` + a CLI machine check
  (exit 0/1). Fixed W3C formula; unit-tested with exact vectors (black-on-white = 21:1) via TDD.
- **Tests** — `tests/test_wcag_contrast.py` (the util) and `tests/test_gate_library.py` (each gate
  declares all 7 keys with a valid tier and id==filename; the runner encodes the invariant + verdict
  schema + N=2 bound + graceful degradation; the map can't advertise an "active" gate the library
  doesn't ship).
- **Phase 3 wired** to the runner + library — the architect now runs each output through its gates via
  `reference/gate-runner.md` and the shipped `gates/<id>.md` files.

> Full standalone **`a11y`** (axe/pa11y/Lighthouse runner + keyboard/semantics critic) is deferred to
> **v0.7.x**; the **measured Three.js showcase** that proves the quality uplift is **v0.8.0**; **v1.0**
> freezes the gate-file schema. See `docs/plans/`.

## [0.6.0] — 2026-06-27

The QUALITY-layer release: a new `/agentic-swarm:architect` skill that turns a one-line goal into a
researched, gate-aware subagent swarm — the layer that makes a fan-out *produce better work*, on top of
`/agentic-swarm`'s existing *survive-the-fan-out* safety layer.

### Added

- **Skill: `/agentic-swarm:architect`** (`skills/architect/SKILL.md`) — Phases 0 & 1 of the architecture
  harness: **Phase 0** researches "what does GOOD look like", classifies the use-case, decomposes the goal
  into workstreams, selects the skill-set + quality GATES per workstream, and defines the shared contract;
  a **plan-then-confirm** checkpoint presents the PLAN for approval before the expensive fan-out;
  **Phase 1** synthesizes a zero-context brief per workstream. It **references** (never duplicates) the
  shipped `/agentic-swarm` rails for Phase 2 (safe fan-out) and `reference/loops.md` for the optional
  Phase-4 persistence back-edge.
- **Brief template** (`skills/architect/reference/brief-template.md`) — the headline novelty:
  **forward-couples each selected gate's concrete pass-criteria into the worker's brief** (a "You MUST
  PASS these GATES" block), alongside skill-aware briefing ("invoke skill X if available"), so workers
  build *toward* a named, checkable bar. Self-contained: criteria are inlined so a worker passes with zero
  external skills; includes a filled UI-workstream example.
- **Use-case → gate map** (`skills/architect/reference/usecase-gate-map.md`) — default gate-set per
  use-case with an **anti-theater rule**: only gates with shipped, checkable criteria are forward-coupled
  into briefs; non-MVP gates (`a11y` full, `api-contract`, `security`, `docs`, `perf`, `completeness`,
  `source-verification`) are marked `future / not-yet-built` and surfaced in the PLAN only.
- **Structural test** (`tests/test_architect_skill.py`) — guards the design contract: the skill lives at
  `skills/architect/` (command = directory name → `/agentic-swarm:architect`), frontmatter is exactly
  `name`+`description`, the brief template forward-couples gates + names skills, the gate map keeps the
  anti-theater scoping, and Phase 4 references the `/loop` rails rather than duplicating them.

> The **gate runner + gate library** (`tests`/`assets`/`ui-ux` files, detection probe, verdict schema,
> shared WCAG util) and the **measured showcase** land in v0.7.0 / v0.8.0 — see
> `docs/plans/2026-06-27-mvp-gate-library-and-versioning-plan.md`.

## [0.5.0] — 2026-06-27

The robustness-proof release: a reproducible execution-time demo that the safe-swarm orchestration
shape preserves coverage and fails loudly where a naive single-barrier fan-out silently loses work —
the **Phase-2 safety proof** of the architecture harness now under design.

### Added

- **Swarm robustness eval** under `evals/loop-demo/code-review/` — a controlled A/B over the agentic-swarm
  orchestration shape vs a naive single-barrier fan-out, on a pinned 43-file axios corpus (`manifest.json`,
  commit `3243566a`). Two byte-identical review arms isolate orchestration as the only variable. Evidence
  is two-layer and honest: (A) one real-agent **ambient run** (n=1, calm window) producing a complete
  43/43-file review (192 findings, 1 high — a genuine unhandled-http2-error process-crash bug in axios);
  (B) a **deterministic robustness sweep** (`robustness-model.mjs` → `curve.json`, reproduces
  bit-identically) showing safe-swarm holds **100% coverage** under transient drops while naive decays
  ~`1−rate`, **flags** permanent gaps where naive hides them, and **survives a hang** that takes naive to
  0% coverage with no notification. Full writeup with caveats in `RESULTS.md`. The injected faults are a
  clearly-labeled deterministic model of the real `Connection closed mid-response` drops.
- **Architecture & design docs** under `docs/plans/` — the converged v1.0 "architect harness" design
  (3-layer SAFETY/QUALITY/PERSISTENCE; orchestrator-worker with research-driven, gate+skill-aware briefs
  and gated integration; the forward-coupling novelty), the MVP gate-library + versioning build-spec
  (`{ tests, assets, ui-ux }`, the v0.5→v1.0 track), the robustness-eval design, the dogfooded research
  synthesis + reproducible swarm scripts, and the lifecycle diagram.

## [0.4.0] — 2026-06-27

The `/loop` release: the plugin now teaches how to carry a swarm **across turns and sessions** with
`/loop`, the pre-warm profiler **infers your likely goals unprompted** and can scaffold a loop, and a
new vendored reference pins the real `/loop` mechanics — verified against the live docs *and* the
in-session tool schemas (which turned out to disagree in two places).

### Added

- **Vendored `docs/claude-code/loops.md`** — a verified reference snapshot for `/loop` and the
  scheduling layer: the three forms (fixed-interval via `CronCreate`, self-paced via `ScheduleWakeup`,
  bare-maintenance + `loop.md`), the `CronCreate`/`CronList`/`CronDelete` and `ScheduleWakeup`
  signatures, the **internal `<<autonomous-loop>>` / `<<autonomous-loop-dynamic>>` sentinels**, jitter,
  the 7-day expiry and 50-task cap, provider fallback (Bedrock/Vertex/Foundry → fixed 10-min), and how
  `/loop` compares to Routines, Workflows, and `/goal`. It carries an explicit **"Discrepancies noted"**
  footer for two real **doc-vs-schema divergences** the verification fan-out caught (the recurring-task
  jitter magnitude, and the fact that the sentinels are undocumented internal detail).
- **Skill: pair a swarm with `/loop`.** A new "three loop layers" section in
  `skills/agentic-swarm/SKILL.md` plus `skills/agentic-swarm/reference/loops.md` teach **loop-until-dry
  / loop-until-budget across sessions**, **recurring monitoring swarms**, and the cross-tick **worklist
  architecture** (a Workflow script can't self-schedule, so scheduling lives in the main session). This
  **builds on — never contradicts —** the existing rule that the swarm watchdog is a *plain one-shot*
  `ScheduleWakeup`, not a `/loop` (no sentinel).
- **Profiler: infer goals unprompted + optional loop setup** (`as-new-project`). A new **STEP 3.5**
  turns the local aggregate signals into **inferred end goals + recommended automations** (one-shot
  swarm vs recurring `/loop` vs self-paced loop), framed as hypotheses to confirm — *without the user
  ever stating a goal*. A new **STEP 4(c)** optionally scaffolds the chosen loop (a recommended `/loop`
  and/or an approved `.claude/loop.md`) on opt-in. Stays **100% local**.
- **New cadence signals** in `profile_transcripts.py`: `distinct_active_days` and `activity_span_days`
  (density = daily-driver vs sporadic), so the goal/loop inference can tell a recurring loop from an
  on-demand one. Aggregate counts only — privacy guarantee unchanged; covered by new tests.
- **`SECURITY.md`** — how to report a security or privacy issue, and what counts as one (a break in
  the local-only / no-exfiltration privacy guarantee is treated as a security bug).

## [0.3.0] — 2026-06-27

A rigor-and-trust release: the eval is rebuilt to be hard to fool, the docs drop the personal
war-story in favor of the (now trustworthy) eval results, and there's explicit guidance on getting
the most out of the skill.

### Changed

- **Eval rebuilt for rigor.** Fixes that make the numbers trustworthy: outputs are no longer
  truncated (`max_tokens` / `max_completion_tokens` pinned — the earlier flaw that capped the
  GPT-4.1 family mid-script and then unfairly scored the cut-off code); the non-reasoning models run
  deterministically (temperature 0 + fixed seed); the reasoning models are averaged over 3 repeats;
  and the judge is now an **independent, cross-family Claude model** (no self-preference from a GPT
  judge grading GPT outputs). With truncation fixed the skill shows a large uplift on **every** model
  — GPT-5.5 30%→94%, GPT-4.1-mini 22%→92%, GPT-4.1 19%→89%, GPT-5.4-mini 20%→77% (rubric) — and the
  watchdog / backoff patterns jump 0%→75% / 0%→81%. Method documented in `evals/README.md`.
- **Docs lead with the eval, not anecdotes.** Removed the personal "41-agent / ~2-hour stall"
  war-story from the README, the skill, and the watchdog reference (and deleted
  `skills/agentic-swarm/reference/origin.md`), reframing around the reproducible eval evidence.

### Added

- **README "Best used with"** — the skill shines under dynamic workflow orchestration; turn it on
  with `/effort` at its top tier (ultracode) and pick a strong `/model`.
- **`bun run report` / `make-transcripts.mjs`** — regenerates the results table and the per-model
  transcripts (with the Claude judge's reasoning) in one step.

## [0.2.0] — 2026-06-27

The trust-and-evidence release: the skill is now **measured**, the privacy guarantee is **enforced
by tests in CI**, and the whole eval — prompts, model outputs, and judge reasoning — is committed
for anyone to inspect or reproduce.

### Added

- **Eval harness** under `evals/` (promptfoo) — a reproducible A/B eval measuring whether the
  `agentic-swarm` skill makes models write *safer* parallel-subagent orchestration. Each model
  writes a `Workflow` script for a fan-out task with vs without the live `SKILL.md`, scored by a
  GPT-5.5 `llm-rubric` plus a per-pattern programmatic check. Result (GPT-5.5 → GPT-4.1): the skill
  **more than triples** the safe-orchestration rubric score on capable models (GPT-5.5 26%→83%,
  GPT-5.4-mini 20%→64%), with a smaller positive lift on the older GPT-4.1 family. Isolated with
  its own `package.json` so the plugin stays zero-dependency.
- **Committed eval evidence** — the rendered prompts (`evals/prompts/rendered/`) and a readable
  transcript of every model's baseline-vs-with-skill output **with the GPT-5.5 judge's reasoning**
  (`evals/results/transcripts/`), plus the aggregate table (`evals/results/RESULTS.md`). The README
  "How it was built" section now leads with the uplift table instead of an anecdote.
- **Test suite** under `tests/` — `pytest` for the four profiler scripts (redactor, transcript
  profiler, repo scanner, GitHub scanner) and a built-in `node:test` black-box test for the
  SessionStart hook. The profiler tests **enforce the privacy guarantee**: a synthetic transcript
  seeded with secrets and sentinel content is profiled, then the aggregated output is asserted to
  contain no message text / thinking / tool input / tool output (and no content-bearing key) — so
  a regression that starts copying raw content fails the build.
- **GitHub Actions CI** (`.github/workflows/ci.yml`) — runs the Python + Node tests on Ubuntu and
  Windows, plus `claude plugin validate --strict` in both marketplace and plugin modes, on every
  push to `main` and every pull request.
- **Secret-shape guard** (`tests/test_no_literal_secrets.py`) — fails the build if any complete
  secret-shaped literal (token / JWT / key) ever lands in tracked source, so redactor test
  fixtures can't reintroduce a scanner false-positive.

### Changed

- **Skill: the watchdog + instability-backoff guidance is now front-and-center.** A new "emit these
  two" block and a stiffer pre-flight checklist push models to include the `ScheduleWakeup` stall
  watchdog and the per-wave backoff check (the two most-forgotten patterns). The eval re-run shows
  the frontier model's safety score rising 75% → 83% after this change.
- **CI installs the Claude Code CLI with Bun** (`oven-sh/setup-bun` + `bun install -g`) rather than
  npm.
- `redact.py`'s self-test now assembles its secret-shaped sample inputs at runtime instead of
  embedding literal placeholder tokens, so the file no longer trips external secret scanners. (The
  values were always non-functional placeholders — no real credential was ever committed.)
- The SessionStart hook gained an `AGENTIC_SWARM_RELEASES_URL` override seam (defaults to the
  public GitHub API; used by tests to exercise offline degradation, and usable for GitHub
  Enterprise hosts). The version check remains a read-only GET that sends nothing — the privacy
  guarantee in `docs/PRIVACY.md` is unchanged.

### Fixed

- `scan_repo.py` passed `maxsplit` positionally to `re.split`, which Python 3.13+ deprecates; it
  is now passed as a keyword, so the profiler runs warning-clean on current Python.

## [0.1.0] — 2026-06-26

Initial release.

### Added

- **`/agentic-swarm` safe-swarm skill** — the playbook for fanning out large parallel-subagent
  swarms with the `Workflow` tool *safely by construction*: a pre-flight checklist, the 8
  patterns (bounded waves, per-agent retry, no single hard barrier, the `ScheduleWakeup`
  stall watchdog, checkpoint/resume with cache-stable prompts, lean outputs, graceful
  partial-synthesis, and instability backoff), a copy-paste `Workflow()` template, a watchdog
  runbook, and a Python journal extractor for recovering the full dataset.
- **`/agentic-swarm:as-new-project` local profiler/scaffolder** — a **100% local** first-run
  skill that builds a private profile of how you work from your Claude Code transcripts and the
  current repo (GitHub scanning opt-in, off by default), redacts secrets, writes a
  user-owned `.claude/agentic-swarm/PROFILE.md`, and scaffolds the agentic-swarm tooling. No
  exfiltration: it makes zero outbound network requests.
- **SessionStart hook** — nudges first-time users toward `/agentic-swarm:as-new-project`, then
  on later runs shows a non-blocking, ~24h-throttled "update available" hint from the latest
  GitHub release. Degrades silently offline; the version check is the plugin's only network
  call and sends nothing.
- **One-command marketplace install** — the repo serves both the plugin and its marketplace
  (`/plugin marketplace add pawelsloboda5/agentic-swarm` →
  `/plugin install agentic-swarm@agentic-swarm`).
- **Vendored, verified Claude Code reference** under `docs/claude-code/` — a point-in-time,
  independently cross-verified (official docs + Context7) snapshot of the plugin/skill/hook
  docs, so future sessions can build against a stable, cited reference.
- **Docs & trust** — full `README.md`, plain-language `docs/PRIVACY.md`, `CONTRIBUTING.md`,
  this changelog, and the MIT `LICENSE`.

[Unreleased]: https://github.com/pawelsloboda5/agentic-swarm/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.10.0...v1.0.0
[0.10.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/pawelsloboda5/agentic-swarm/releases/tag/v0.1.0
