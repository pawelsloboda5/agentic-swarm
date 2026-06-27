# agentic-swarm

> A Claude Code **plugin** that makes fanning out many parallel subagents *safe by construction* — and bootstraps your whole agentic workflow from your own local history.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
&nbsp;**Status: early WIP (v0.1.0 in progress).**

---

## What it is

The Claude Code `Workflow` harness notifies you on **completion** — but **never on a stall**.
A single hung connection inside one giant `pipeline()`/`parallel()` barrier can deadlock for
**hours** with no notification. `agentic-swarm` distills a real post-mortem of a 41-agent
research swarm — which stalled silently for two hours — into patterns that make that
impossible:

- **Bounded waves** (6–8 agents) instead of one mega-barrier
- **Retry waves** + timer-free backoff
- A **`ScheduleWakeup` watchdog** that catches the silent stall
- **Checkpoint / resume** with cache-stable prompts
- **Lean outputs** + a **journal extractor** for the full dataset
- **Graceful partial-synthesis** that flags gaps instead of hiding them

It also ships **`/as-new-project`**: a first-run command that reads your *local* Claude Code
history (and, optionally, your current repo and GitHub) to build a private profile of how you
work, then scaffolds the agentic-swarm tooling tailored to you.

## Install

```text
/plugin marketplace add pawelsloboda5/agentic-swarm
/plugin install agentic-swarm
```

First time (also auto-suggested on first run):

```text
/as-new-project
```

## What's inside

| Component | What it does |
|---|---|
| `/agentic-swarm` skill | The safe-swarm playbook: checklist, 8 patterns, a copy-paste workflow template, the watchdog, and the resume/extraction toolkit. |
| `/as-new-project` command | Builds a **local** profile from your Claude transcripts + current repo (+ GitHub, opt-in), then scaffolds the tooling for you. |
| SessionStart hook | First-run nudge + a non-blocking "update available" check (like `gsd`). |

## Privacy

`/as-new-project` is **100% local** — your transcript content and derived profile **never
leave your machine**. Secrets are redacted, and scanning your GitHub repos is **opt-in**
(off by default). See [`docs/PRIVACY.md`](docs/PRIVACY.md) (coming with v0.1.0).

## How it was built

The reference docs under [`docs/claude-code/`](docs/claude-code/) were researched and
**independently verified** (official docs + Context7) using the very safe-swarm pattern this
plugin teaches — see [`docs/claude-code/README.md`](docs/claude-code/README.md).

## License

[MIT](LICENSE) © 2026 Pawel Sloboda
