# agentic-swarm

> A Claude Code **plugin** that makes fanning out many parallel subagents *safe by construction* — and bootstraps your whole agentic workflow from your own local history.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
&nbsp;**Version 0.1.0**

---

## Why this exists

The Claude Code `Workflow` harness notifies you on **completion** — but **never on a stall**.
Fan a swarm out through one giant `pipeline()`/`parallel()` barrier and a single hung
connection makes the whole workflow `await` forever: no synthesis, no completion event, no
notification. It can sit there, silently deadlocked, for **hours**.

That isn't hypothetical. `agentic-swarm` distills the post-mortem of a real **41-agent
research swarm** that stalled silently for ~2 hours behind one barrier — 17 agent failures,
3 left hung — into patterns that make that outcome impossible:

- **Bounded waves** (6–8 agents) instead of one mega-barrier
- **Retry waves** with timer-free backoff
- A **`ScheduleWakeup` watchdog** that actually catches the silent stall
- **Checkpoint / resume** with cache-stable prompts
- **Lean outputs** + a **journal extractor** for the full dataset
- **Graceful partial-synthesis** that flags gaps instead of hiding them

The next swarm pays none of that tax — because the safety is built into the script before it
launches, not bolted on after it hangs.

## Install

```text
/plugin marketplace add pawelsloboda5/agentic-swarm
/plugin install agentic-swarm@agentic-swarm
```

Prefer the CLI? The equivalents are:

```bash
claude plugin marketplace add pawelsloboda5/agentic-swarm
claude plugin install agentic-swarm@agentic-swarm
```

(`agentic-swarm@agentic-swarm` is the `name@marketplace` form — the plugin and its
marketplace are both named `agentic-swarm`.)

## What's inside

| Component | What it does |
|---|---|
| **`/agentic-swarm` skill** | The safe-swarm playbook: a pre-flight checklist, the 8 patterns, a copy-paste `Workflow()` template, the `ScheduleWakeup` watchdog, and the resume + journal-extraction toolkit. Auto-activates whenever you're about to fan out many agents — you rarely have to invoke it by hand. |
| **`/agentic-swarm:as-new-project` skill** | A **100% local** first-run profiler + scaffolder. Reads your Claude Code transcripts and the current repo (GitHub is opt-in), builds a private `PROFILE.md` of how you work, and scaffolds the agentic-swarm tooling tailored to you. Nothing is ever uploaded. |
| **SessionStart hook** | On first run, nudges you toward `/agentic-swarm:as-new-project`. On later runs, shows a non-blocking, ~24h-throttled "update available" hint by reading the latest GitHub release. Degrades silently offline — it's the plugin's only network call, and it *sends* nothing. |

> Plugin skills are namespaced `/<plugin>:<skill>`, so the profiler is
> `/agentic-swarm:as-new-project`. The safe-swarm skill usually triggers on its own from your
> intent ("run a swarm", "fan out agents", any `Workflow()` over ~10+ items), so you'll mostly
> see it activate without typing anything.

## Quick start

**1. Run a safe swarm.** Just describe the fan-out — the skill activates by itself:

> "Run a research swarm over these 40 topics and synthesize the findings."

The skill walks you through the pre-flight checklist, hands you
`skills/agentic-swarm/reference/safe-swarm-template.js` to fill in with your items, prompts,
and schema, and arms a watchdog at launch so a silent stall can't cost you hours. If a swarm
ever stops or stalls, the same skill's resume runbook recovers it from the cached journal
instead of restarting from zero.

**2. Profile your workflow (first run).** This also gets auto-suggested the first time the
plugin loads:

```text
/agentic-swarm:as-new-project
```

It reads your local history, writes `.claude/agentic-swarm/PROFILE.md` (yours to keep, edit,
or delete), and scaffolds the tooling. It shows you exactly what it will read **before** it
reads anything, and GitHub scanning stays off unless you opt in.

## Privacy

`/agentic-swarm:as-new-project` is **100% local** — your transcript content and the derived
profile **never leave your machine**. Secrets are redacted, paths are scrubbed, and scanning
your GitHub repos is **opt-in** (off by default). The plugin's *only* outbound request is the
SessionStart hook's read-only GitHub version check, which fetches a version string and sends
nothing.

Full plain-language details — exactly what is read, where files land, and how to opt out — are
in **[`docs/PRIVACY.md`](docs/PRIVACY.md)**.

## How it was built & evaluated

**The skill is measured, not just asserted.** A reproducible A/B eval ([`evals/`](evals/)) has
every model write a Claude Code `Workflow` orchestration script for a fan-out task **twice** — once
with a neutral Workflow API reference (*baseline*), once with that same reference **plus the real
`SKILL.md`** (*with-skill*) — and a **GPT-5.5 judge** scores how safe-by-construction each script
is (does it avoid the silent-stall and lost-work failure modes?). The gap is the skill's measured
uplift. Across 6 fan-out tasks it roughly **triples** the safe-orchestration score on capable
models (judge rubric, baseline → with-skill):

| Model | Baseline | With skill | Uplift |
|---|---|---|---|
| `gpt-5.5` | 26% | **75%** | **+49 pts** |
| `gpt-5.4-mini` | 20% | **64%** | **+43 pts** |
| `gpt-4.1-mini` | 16% | 31% | +15 pts |
| `gpt-4.1` | 16% | 23% | +7 pts |

The per-pattern breakdown is candid too — *bounded waves* jump 8% → 85% and *no single barrier*
40% → 92% with the skill, while the `ScheduleWakeup` watchdog stays hard to induce (a finding, not
a brag). Full numbers, caveats, and the one-command way to **reproduce them with your own key** are
in [`evals/README.md`](evals/README.md) and [`evals/results/RESULTS.md`](evals/results/RESULTS.md).

> **Honest scope:** this measures whether the skill makes models *write* safer orchestration (and
> that the guidance generalizes across frontier models from GPT-5.5 down to GPT-4.1) — it does not
> exercise the live Claude-Code runtime.

<sub>The plugin was also **dogfooded**: the vendored reference under
[`docs/claude-code/`](docs/claude-code/) was researched by a bounded fan-out of subagents (one per
doc, in waves with per-agent timeouts and lean outputs). Two agents hit the very
`Connection closed mid-response` failure the skill is built around — and the retry wave recovered
both, zero completed work lost. See [`docs/claude-code/README.md`](docs/claude-code/README.md).</sub>

## Contributing

Issues and PRs are welcome — see **[`CONTRIBUTING.md`](CONTRIBUTING.md)** for local
development (`claude --plugin-dir .`), validation (`claude plugin validate .`), the repo
layout, and the safe-swarm ethos any new orchestration should follow.

## License

[MIT](LICENSE) © 2026 Pawel Sloboda
