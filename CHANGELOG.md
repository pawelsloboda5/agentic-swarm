# Changelog

All notable changes to **agentic-swarm** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
  backing_skill`): **tests** (objective — green AND >0 collected, typecheck/build, diff-coverage),
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

[Unreleased]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/pawelsloboda5/agentic-swarm/releases/tag/v0.1.0
