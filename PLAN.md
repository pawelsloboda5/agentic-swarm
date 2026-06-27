# agentic-swarm — v0.1.0 build plan & definition of done

> The build plan for the open-source `agentic-swarm` Claude Code plugin. The **Definition of
> Done** at the bottom is the explicit end-goal checklist the autonomous build loop drives
> toward. Architecture facts here are grounded in the verified `docs/claude-code/` snapshot.

## Vision

A Claude Code **plugin**, installable in one command, that (1) makes large parallel-subagent
swarms *safe by construction* via the `agentic-swarm` skill, and (2) on first run, builds a
**100% local** profile of how you work and scaffolds the tooling tailored to you
(`/as-new-project`). MIT licensed; built to be installed widely, like `superpowers`.

## Locked decisions (confirmed with the owner)

- **Scope:** full vision in v1 (skill + plugin + profiler + first-run/update hook + marketplace + docs).
- **Profiler privacy:** local-only; auto-scan transcripts + current repo; **GitHub opt-in**; redact secrets; profile written to a local file the user owns; nothing is ever exfiltrated.
- **Install:** one-command marketplace (repo serves both plugin and marketplace).
- **License:** MIT.
- **Workflow:** all commits pushed straight to `main`.

## Architecture (per verified docs/claude-code/)

```
agentic-swarm/                          (repo root == plugin root == marketplace root)
├── .claude-plugin/
│   └── plugin.json                     # manifest: name, version, description, author, repo, license, keywords
├── marketplace.json                    # one repo serves the plugin AND its marketplace
├── skills/
│   ├── agentic-swarm/
│   │   ├── SKILL.md                    # generalized safe-swarm skill (no GTA6/machine specifics)
│   │   └── reference/{safe-swarm-template.js, watchdog.md, extract_journal.py}
│   └── as-new-project/
│       ├── SKILL.md                    # local profiler + scaffolder workflow
│       └── scripts/{profile_transcripts.py, scan_repo.py, scan_github.sh, scaffold.py, redact.py}
├── hooks/
│   ├── hooks.json                      # SessionStart -> check-session.(js)
│   └── scripts/check-session.js        # first-run nudge + non-blocking update check (cross-platform node)
├── docs/
│   ├── claude-code/ …                  # DONE: verified upstream reference snapshot
│   └── PRIVACY.md                      # exactly what /as-new-project reads/writes; the local-only guarantee
├── examples/                           # a worked safe-swarm example
├── README.md  CONTRIBUTING.md  CHANGELOG.md  LICENSE  .gitignore  .gitattributes
```

**Verified facts that shape the build (from the swarm, corrections to common assumptions):**
- `plugin.json` lives in `.claude-plugin/`; everything else at plugin root. Only `name` is required; pin `version` for stable update semantics.
- Skills frontmatter: `name`, `description`, `disable-model-invocation`, `allowed-tools`. **No `subagent`/`tags`** — use `agent` + `context: fork` for subagent execution; discovery via `description`/`when_to_use`. (Re-check `skills.md` while authoring.)
- SessionStart hook: `hooks/hooks.json`, matcher `startup`; script prints JSON `{ hookSpecificOutput: { hookEventName:"SessionStart", additionalContext: "…" } }`; exit 0; set a `timeout`; fail silently offline. `${CLAUDE_PLUGIN_ROOT}` is reliable; `${CLAUDE_PLUGIN_DATA}` is newer — fall back to a path under the plugin root / OS temp if unset.
- Marketplace plugin source uses `"source": "url"` form (per the marketplaces page).
- Commands vs skills: Anthropic now recommends **skills**; `/as-new-project` and `/agentic-swarm` are skills (auto-invocable + user-invocable).
- Session transcripts: `~/.claude/projects/<project-slug>/<session-id>.jsonl`, one JSON event per line; per-line schema is **undocumented** (derived empirically) → the profiler must parse defensively and degrade gracefully.

## Cross-platform requirement

Every installer runs a different OS. Hook + profiler scripts must work on macOS/Linux/Windows.
Prefer **Node** for the hook (ships with most setups; the docs' own examples use node) and
**Python 3** for the profiler heavy-lifting, with capability checks and graceful fallbacks. No
`jq` dependency. No hard `bash`-only assumptions.

## Privacy model (non-negotiable, public trust)

`/as-new-project` and the hook: **read-only of local data, no network exfiltration ever.** The
only network call is the hook's GitHub *version* check (fetches a version string; sends nothing).
GitHub repo scanning is opt-in and read-only via `gh`. Secrets are redacted before anything is
written. The derived profile is a local file under the user's control. `docs/PRIVACY.md` states
this in plain language and is linked from the README and surfaced by `/as-new-project` before it scans.

## Build sequence (the loop works these in order)

1. Generalize the `agentic-swarm` skill into `skills/agentic-swarm/` (strip all GTA6/machine specifics; keep a generalized retro/credits).
2. `plugin.json` + `marketplace.json` + `.gitattributes` already done → validate the plugin loads (`--plugin-dir` / `claude plugin validate`).
3. SessionStart hook (`hooks/hooks.json` + `check-session.js`): first-run nudge + update check; gracefully offline.
4. `/as-new-project` skill + scripts: profile (transcripts + repo + GitHub opt-in, secret-redacted) → write local profile → scaffold tooling.
5. Docs: README (full), PRIVACY.md, CONTRIBUTING.md, CHANGELOG.md, examples/.
6. Fresh-eyes review gate (read-only subagent) → fix blockers.
7. Tag v0.1.0; final push; confirm installable.

## Definition of Done (END GOALS — the loop runs until every box is checked)

- [ ] **G1 — Installable in one command.** `/plugin marketplace add pawelsloboda5/agentic-swarm` then `/plugin install agentic-swarm` works; `claude plugin validate` (or `--plugin-dir` load) reports no errors.
- [ ] **G2 — Manifests.** Valid `.claude-plugin/plugin.json` (MIT, `version` 0.1.0, repository) and root `marketplace.json` listing the plugin (`source: url`, ref `main`).
- [ ] **G3 — Generalized skill.** `skills/agentic-swarm/SKILL.md` (+ reference files) is fully generic (no GTA6/machine paths), encodes all 8 patterns + watchdog + resume + extractor, with valid frontmatter (no `subagent`/`tags`).
- [ ] **G4 — `/as-new-project`.** Builds a local profile from transcripts + current repo (+ GitHub opt-in), redacts secrets, writes a local profile file, and scaffolds the agentic-swarm tooling — verifiably local-only (no exfiltration), cross-platform.
- [ ] **G5 — SessionStart hook.** First-run nudge to `/as-new-project` (state persisted) + non-blocking GitHub update hint; degrades silently offline; cross-platform.
- [ ] **G6 — Docs & trust.** README (full), `docs/PRIVACY.md`, CONTRIBUTING.md, CHANGELOG.md, `examples/`, and the vendored `docs/claude-code/` (done).
- [ ] **G7 — Reviewed.** A read-only fresh-eyes review passes with no blockers; privacy guarantee audited (no network writes of user data).
- [ ] **G8 — Live.** Everything committed + pushed to `main`; tagged `v0.1.0`; repo is installable by anyone.

> When G1–G8 are all checked and pushed, the loop is done.
