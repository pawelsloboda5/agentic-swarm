---
name: as-new-project
description: >-
  Local-only first-run profiler + scaffolder for the agentic-swarm plugin. Reads YOUR Claude Code
  history and current repo (and GitHub repos only if you opt in), all on your machine, to write a
  private PROFILE.md of how you work, then scaffolds tailored agentic-swarm tooling. Use this
  WHENEVER the user wants to "set up agentic-swarm", "bootstrap" / "new project" / "first run",
  "profile me" / "profile my workflow", "as-new-project", "onboard me to the swarm", or "scaffold
  my agentic workflow". 100% local: nothing is ever uploaded; secrets are redacted; home paths are
  collapsed to '~'. Always show the privacy notice and get consent BEFORE scanning anything.
---

# /as-new-project — local profiler + scaffolder (PRIVACY FIRST)

This skill profiles **how you work** from data **already on your disk** and scaffolds the
agentic-swarm tooling for you. The entire trust model of this plugin rests on one promise:
**everything stays on your machine.** Follow the steps in order. Do **not** scan anything before
the user has seen the privacy notice and said yes.

> The scripts that do the work live next to this file in `scripts/`. They are stdlib-only Python 3,
> make **no network calls** (the single exception is the opt-in `scan_github.py`, which only
> *reads* repo metadata via the `gh` CLI and sends nothing out), and pass every string through a
> secret-redaction + home-path-scrubbing pass before writing.

---

## STEP 1 — Show this privacy notice and get explicit consent (DO THIS FIRST)

Print the notice below to the user **verbatim in substance**, then ask for confirmation. Do not run
any script until they confirm.

```
agentic-swarm /as-new-project — what it does, in plain terms

WHAT IT READS (all local, read-only):
  - Your Claude Code session transcripts in ~/.claude/projects (counts, tool names, model names,
    file extensions, and activity times ONLY — never your message text, prompts, or code).
  - This repository (file types, manifest files, dependency names, README/.claude presence, and
    the git remote read from .git/config — no `git` command, no network).
  - Your GitHub repositories — ONLY if you opt in. Default is NO. If you opt in, it reads repo
    METADATA via the `gh` CLI (languages, topics, recency). It sends NONE of your local data out.

WHAT LEAVES YOUR MACHINE:
  - Nothing. There is no upload, no telemetry, no exfiltration. The only network access that can
    happen at all is the opt-in GitHub *read* (listing your own repos' metadata).

PRIVACY PROTECTIONS:
  - Aggregate signals only — counts/lists/histograms, never raw message or file contents.
  - Secrets (API keys, tokens, JWTs, bearer strings, emails) are redacted before anything is written.
  - Absolute home paths are collapsed to "~" so your username / machine layout doesn't leak.

WHAT GETS WRITTEN (local files you own, under this repo):
  - .claude/agentic-swarm/transcript-signals.json   (aggregate signals)
  - .claude/agentic-swarm/repo-signals.json          (aggregate signals)
  - .claude/agentic-swarm/github-signals.json        (only if you opt in)
  - .claude/agentic-swarm/PROFILE.md                 (your human-readable profile)
  Optional scaffolding (only if you say yes): .claude/agentic-swarm/my-first-swarm.js and a short
  note appended to CLAUDE.md. You can delete or .gitignore any of these at any time.
```

Then ask two things and wait for the answers:

1. **"Proceed with the local scan?"** (transcripts + this repo). If no → stop here.
2. **"Also include the optional GitHub repo-metadata scan?"** Default **NO**. Only run
   `scan_github.py` if the user explicitly says yes.

---

## STEP 2 — Run the local signal scripts

Create the output dir `.claude/agentic-swarm/` in the current repo, then run the scripts. Use the
Python on PATH — **`python3`** on macOS/Linux, **`python`** on Windows (try `python3` first, fall
back to `python`). The scripts are at `${CLAUDE_SKILL_DIR}/scripts/`.

```bash
# always (after consent):
python3 "${CLAUDE_SKILL_DIR}/scripts/profile_transcripts.py" --out ".claude/agentic-swarm/transcript-signals.json"
python3 "${CLAUDE_SKILL_DIR}/scripts/scan_repo.py"          --root "." --out ".claude/agentic-swarm/repo-signals.json"

# ONLY if the user opted in to GitHub:
python3 "${CLAUDE_SKILL_DIR}/scripts/scan_github.py" --out ".claude/agentic-swarm/github-signals.json"
```

Notes:
- Each script prints an ASCII-only summary and exits 0 even when there's nothing to scan
  (e.g. "no transcripts directory found", or `gh` not installed/authenticated → it prints a clear
  "skipped" line and writes a `{"skipped": true}` file). Treat a "skipped" GitHub result as normal.
- If `python3` isn't found, rerun the same commands with `python`. Do not install anything.
- Do **not** open or echo any raw transcript file. You only ever read the aggregated `*-signals.json`.

---

## STEP 3 — Synthesize PROFILE.md from the aggregated JSON ONLY

Read **only** the `*-signals.json` files produced in Step 2 (never raw transcripts). From those
aggregates, write a human-readable **`.claude/agentic-swarm/PROFILE.md`** describing the developer.
Ground every statement in the numbers — do not invent details the signals don't support.

Cover, as the data allows:

- **Languages & frameworks** — infer from `repo-signals.json` (languages, frameworks,
  dependency_sample) and the transcript `file_extensions` histogram; corroborate with
  `github-signals.json` languages/topics if present.
- **Tools & MCP servers** — from transcript `tools` (e.g. heavy `Bash`/`Edit`/`Read`, which MCP
  servers like `mcp__supabase__*`, `mcp__context7__*`, whether they use `Workflow`/`Agent`/
  `ScheduleWakeup` — a signal they already run swarms).
- **Models** — from transcript `models` (which Claude models dominate).
- **Working style / cadence** — from `activity_by_hour`, `activity_by_weekday`, `first/last
  activity`, `permission_modes` (e.g. lots of `bypassPermissions` = autonomy-comfortable),
  `cli_versions` (keeps the CLI current?), and `token_usage_totals` (heavy cache reads = long
  iterative sessions).
- **Common task types** — inferred conservatively from tool mix + file extensions + frameworks
  + (if present) GitHub topics. Frame as hypotheses, not certainties.
- **Preferences & agentic-swarm fit** — call out whether they already fan out subagents
  (`Workflow`/`Agent`/`TaskCreate` counts) and where the safe-swarm patterns would help most.

Keep PROFILE.md tight and skimmable (headings + bullets + a couple of small tables). Start the file
with a one-line note that it was generated locally from aggregate signals and contains no raw
content. **Show the user a short summary** of what you found and confirm the file path.

---

## STEP 4 — Scaffold tailored tooling (opt-in + idempotent)

Offer each item below; do each only if the user agrees. **Never overwrite an existing file without
asking** — if the target exists, show the user and ask before replacing.

**(a) Starter safe-swarm script.** Copy the plugin's template into the user's repo so they have a
ready-to-fill swarm:

- Source: `${CLAUDE_SKILL_DIR}/../agentic-swarm/reference/safe-swarm-template.js`
- Destination: `.claude/agentic-swarm/my-first-swarm.js`
- Use the Read tool on the source and the Write tool on the destination (cross-platform; no shell
  `cp`). If the destination already exists, ask before overwriting. After copying, tell the user to
  fill in `ITEMS`, the `*_SCHEMA` objects, and the `*Prompt()` builders, and remind them the
  `/agentic-swarm` skill explains the watchdog + resume workflow.

**(b) CLAUDE.md pointer.** Add a short note so future sessions discover the swarm skill. First check
whether a similar note already exists (idempotent — don't duplicate it). If not present, append to
the repo's `CLAUDE.md` (create it if there is none):

```markdown
## Agentic swarm
This repo has the `agentic-swarm` plugin. Before fanning out many parallel subagents, invoke the
`/agentic-swarm` skill (safe-swarm patterns: bounded waves, stall watchdog, checkpoint/resume).
A starter swarm script is at `.claude/agentic-swarm/my-first-swarm.js`. Run `/as-new-project` again
to refresh your local PROFILE.md.
```

---

## STEP 5 — Wrap up

Tell the user, concisely:
- which files were written (full local paths),
- that everything stayed on their machine and secrets were redacted,
- the top 3–5 profile takeaways,
- the suggested next step: open `/agentic-swarm` and fill in `my-first-swarm.js`.

You may note they can inspect the `*-signals.json` files to verify exactly what was derived, and
that the whole `.claude/agentic-swarm/` dir is safe to delete or `.gitignore`.

---

## Privacy invariants (do not violate)

- Never read, echo, copy, or summarize **raw transcript content** — only the aggregated
  `*-signals.json`. The signals contain no message text by construction.
- Never run a network command as part of this flow except the **opt-in** `scan_github.py`
  (read-only `gh repo list`). Do not add curl/wget/upload steps.
- Never write outside `.claude/agentic-swarm/` and `CLAUDE.md` without telling the user.
- If a script errors, report it plainly and stop — do not work around privacy protections.

## Reference files

| File | Purpose |
|---|---|
| `scripts/redact.py` | Shared, importable secret-redaction + home-path scrubbing. Imported by the other scripts; `python redact.py` runs a self-test. |
| `scripts/profile_transcripts.py` | Local, aggregate-only profiler over `~/.claude/projects/**/*.jsonl`. Writes `transcript-signals.json`. No network. |
| `scripts/scan_repo.py` | Local repo scanner (extensions, manifests, languages/frameworks, dependency names, git remote from `.git/config`). No network. |
| `scripts/scan_github.py` | OPT-IN, read-only GitHub *metadata* via `gh` CLI. Skips cleanly (exit 0) if `gh` is missing/unauthenticated. Sends no local data. |
| `../agentic-swarm/reference/safe-swarm-template.js` | The safe-swarm starter copied into the user's repo in Step 4. |
