# Contributing to agentic-swarm

Thanks for helping make parallel-subagent swarms safe by construction. This guide covers how
to develop the plugin locally, the repo layout, and the conventions any change should follow.

## Develop locally

Clone the repo and load it as a local plugin — no install, no marketplace needed:

```bash
git clone https://github.com/pawelsloboda5/agentic-swarm.git
cd agentic-swarm
claude --plugin-dir .
```

A `--plugin-dir` plugin takes precedence over an installed copy of the same name for that
session, so this is the right way to test changes against a real Claude Code session. After
editing files in-session, run `/reload-plugins` to pick up changes to hooks, agents, or MCP
config (skill `SKILL.md` edits apply immediately).

Verify the plugin loads cleanly before opening a PR:

```bash
claude plugin validate .            # checks plugin.json, skill/hook frontmatter, hooks.json schema
claude plugin validate . --strict   # treat warnings (e.g. misspelled manifest fields) as errors
```

`--strict` is what the marketplace review pipeline runs, so a green `--strict` is the bar. If
something won't load, `claude --debug` prints manifest errors and skill/agent/hook init detail.

## Repo layout

```text
agentic-swarm/                       (repo root == plugin root == marketplace root)
├── .claude-plugin/
│   ├── plugin.json                  # the plugin manifest (name, version, license, keywords)
│   └── marketplace.json             # one repo serves the plugin AND its marketplace
├── skills/
│   ├── agentic-swarm/               # the safe-swarm playbook skill (+ reference/ toolkit)
│   └── as-new-project/              # the local profiler/scaffolder skill (+ scripts/)
├── hooks/
│   ├── hooks.json                   # SessionStart handler registration
│   └── scripts/                     # the cross-platform hook script(s)
├── docs/
│   ├── claude-code/                 # vendored, verified upstream reference (see below)
│   └── PRIVACY.md                   # the local-only guarantee, in plain language
├── README.md  CONTRIBUTING.md  CHANGELOG.md  LICENSE
```

Only `plugin.json` and `marketplace.json` live in `.claude-plugin/`. **Everything else
(`skills/`, `hooks/`, `docs/`) is at the plugin root** — putting component folders inside
`.claude-plugin/` is the single most common reason a plugin silently fails to load.

## The verified upstream reference

`docs/claude-code/` is a point-in-time, independently verified snapshot of the official
Claude Code plugin/skill/hook docs (source of truth: <https://code.claude.com/docs>). When
you're building against the plugin/skill/hook API, **read it first** — it's there so you don't
have to re-fetch live docs to get a load-bearing detail right. It is a snapshot, though: for
anything version-sensitive or recently changed, re-verify against the live docs (WebFetch +
Context7) before relying on it.

## The safe-swarm ethos (for any new orchestration)

If your change adds or modifies anything that fans out subagents through `Workflow()`, it must
hold the same line the plugin teaches. Before writing the script, read the `/agentic-swarm`
skill and satisfy its pre-flight checklist — concretely:

- **Bounded waves (6–8), never one mega-barrier.** A bad API window should damage one wave,
  not the whole run.
- **Every `agent()` goes through a retry wrapper** that tolerates `null` and defers failures
  to a retry wave.
- **Arm a `ScheduleWakeup` watchdog at launch.** The harness notifies on completion, never on
  a stall — the watchdog is the only thing that catches a silent deadlock.
- **Design resume in:** stable, cache-keyed finder prompts; synthesis that embeds its inputs
  so it re-runs as results grow.
- **Lean outputs, partial-synthesis, instability backoff.** Cap arrays, flag gaps explicitly,
  and back off rather than hammer a bad window.

New orchestration that can deadlock silently will be asked to adopt these patterns before
merge — they're not optional polish, they're the point of the project.

## Cross-platform requirement

Contributors run every OS. Hook and profiler scripts must work on macOS, Linux, and Windows:
prefer **Node** for hooks and **Python 3** for heavier profiling, with capability checks and
graceful fallbacks. No `jq` dependency (parse JSON with Python). No hard `bash`-only
assumptions. Keep Python `print()` output ASCII-only or write UTF-8 files — Windows consoles
default to cp1252 and will raise `UnicodeEncodeError` on `→`/`—`/emoji.

## Commits & pull requests

- **Atomic commits** with clear, present-tense messages ("Add watchdog re-arm on resume", not
  "fixes").
- Keep PRs focused; describe what changed and how you verified it (`claude plugin validate .`
  output, the swarm/profiler run you tested).
- Run `claude plugin validate . --strict` before pushing.
- Don't break the privacy guarantee. Any change that touches the profiler or hook must keep
  `docs/PRIVACY.md` accurate — local-only, secrets redacted, the version check the only
  outbound call. If your change alters data flow, update `docs/PRIVACY.md` in the same PR.

## License & DCO

This project is **MIT licensed**. By contributing, you agree your contributions are licensed
under the same MIT license, and you certify the
[Developer Certificate of Origin](https://developercertificate.org/) — i.e. that you wrote the
patch or otherwise have the right to submit it under MIT. No CLA, no copyright assignment;
keep it simple and keep it yours.
