# Claude Code Docs — Vendored Reference Snapshot

Verified reference snapshot of the official Claude Code plugin/skill/hook docs, distilled for building the **agentic-swarm plugin**. Source of truth = https://code.claude.com/docs.

These 8 files are a point-in-time, independently verified distillation of the upstream documentation — kept in-repo so any future fresh session can build against a stable, cited reference without re-fetching live docs. When in doubt, the live docs at the URL above win.

## Index

| File | Title | Confidence |
| --- | --- | --- |
| [`hooks.md`](./hooks.md) | Claude Code Hooks (focus: SessionStart) — Plugin Builder Reference | high |
| [`plugin-marketplaces.md`](./plugin-marketplaces.md) | Claude Code Plugin Marketplaces | high |
| [`plugins.md`](./plugins.md) | Claude Code Plugins: Overview, Creation, and Local Testing | high |
| [`plugins-reference.md`](./plugins-reference.md) | Claude Code Plugin Reference: Manifest & Layout | high |
| [`session-transcripts.md`](./session-transcripts.md) | Claude Code Session Transcripts on Disk (for a Local Profiler) | high |
| [`settings.md`](./settings.md) | Claude Code settings.json, env & permissions — plugin builder reference | high |
| [`skills.md`](./skills.md) | Claude Code Skills (SKILL.md) — Authoring & Discovery for Plugin Builders | high |
| [`slash-commands.md`](./slash-commands.md) | Slash Commands (Custom Commands & Skills) — Plugin Builder Reference | high |

## How this was built

These docs were researched via the **agentic-swarm safe-swarm wave pattern** — a bounded fan-out of parallel research subagents, one per doc, run in controlled waves with per-agent timeouts and lean outputs. Every doc was **cross-verified by an independent subagent** against the live upstream pages using **WebFetch** and the **Context7** mirror of `code.claude.com/docs`, so the distilled reference matches the current API rather than model memory. All 8 docs returned **high** confidence.

## Gaps / TODO

No gaps. All 8 planned reference docs were produced and verified — the MISSING list is empty.

> Caveat: this is a snapshot. Upstream docs at https://code.claude.com/docs evolve; re-verify against the live source (WebFetch + Context7) before relying on any detail for a breaking change or version-pinned decision.
