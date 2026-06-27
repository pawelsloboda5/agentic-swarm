# Changelog

All notable changes to **agentic-swarm** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

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

[Unreleased]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/pawelsloboda5/agentic-swarm/releases/tag/v0.1.0
