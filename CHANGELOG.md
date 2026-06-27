# Changelog

All notable changes to **agentic-swarm** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

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

[Unreleased]: https://github.com/pawelsloboda5/agentic-swarm/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/pawelsloboda5/agentic-swarm/releases/tag/v0.1.0
