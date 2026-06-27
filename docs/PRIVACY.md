# Privacy

`agentic-swarm` is built so that **trusting it requires reading it, not believing a promise.**
This page states, in plain language, exactly what the plugin reads, what it writes, and what
(if anything) ever leaves your machine. The short version:

> **`/agentic-swarm:as-new-project` is 100% local. Nothing about you or your code is ever
> uploaded. The plugin's only outbound network request is a read-only GitHub version check
> that *sends nothing*.**

If anything below ever stops matching what the code does, that's a bug — please open an issue.

---

## The two things that touch your data

There are exactly two parts of this plugin that read anything about you:

1. **The `/agentic-swarm:as-new-project` skill** — the local profiler/scaffolder.
2. **The SessionStart hook** — the first-run nudge + update check.

Everything else (the `/agentic-swarm` safe-swarm skill, the templates, the vendored docs) is
inert reference material that reads nothing and sends nothing.

---

## 1. `/agentic-swarm:as-new-project` (the local profiler)

### What it reads

When you run it — and it tells you this **before** it reads anything — it looks at:

- **Your local Claude Code transcripts** in `~/.claude/projects/`. These are the session
  logs already sitting on your disk. The profiler parses them to learn *how you work*
  (languages, tools, cadence, the kinds of tasks you run), not to copy their contents.
- **The current repository** you're working in — its structure, languages, and config files,
  to tailor the scaffolded tooling to this project.
- **GitHub repository metadata — only if you explicitly opt in.** This is **off by default.**
  When enabled, it reads public-ish repo metadata through your already-installed `gh` CLI
  (your own authenticated session); it never asks for or stores a token of its own.

### What it does NOT do

- It does **not** upload your transcripts, your code, your profile, or any derived signal —
  **anywhere.** There is no telemetry, no analytics endpoint, no "phone home." The profiler
  makes **zero** outbound network requests.
- It does **not** read files outside the directories listed above.
- It does **not** require GitHub access to function — skip the opt-in and it profiles purely
  from local transcripts + the current repo.

### Secret redaction & path scrubbing

Before anything is written to disk, the profiler **redacts secrets** (API keys, tokens,
passwords, connection strings, and similar high-entropy / known-pattern values) and
**scrubs absolute paths** down to non-identifying forms. The output is **aggregated signals**
— counts, categories, and preferences — not a transcript dump. You are never building a file
that quietly contains your `.env`.

### What it writes, and where

- **`.claude/agentic-swarm/PROFILE.md`** — your behavioral profile, written into the current
  project. This is a plain Markdown file. **You own it**: read it, edit it, commit it, or
  delete it. It is the profiler's primary output.
- Scaffolded tooling files, also under your project, that tailor the agentic-swarm workflow to
  what the profile found.

Nothing the profiler writes leaves the directory it writes into.

---

## 2. The SessionStart hook

The hook runs once per session start and does two small things:

1. **First-run nudge.** The first time the plugin loads, it suggests you run
   `/agentic-swarm:as-new-project`. It records that it has done this (so it doesn't nag you
   every session) in **local state under `~/.agentic-swarm/`**. That state file stays on your
   machine.
2. **Update check.** On later runs, it performs a single **read-only** request to GitHub to
   read the latest published release version, and — at most about **once every 24 hours** —
   shows a non-blocking "update available" hint if your installed version is behind.

### The one network call, in full

This GitHub version check is **the only outbound network request the entire plugin ever
makes.** It is a plain read of a public version string. It **sends nothing about you** — not
your identity, not your repo, not your profile, not your usage. If you're offline, the check
**fails silently** and the session continues normally. The hook never blocks your session.

---

## Network summary

| Action | Network? | Direction | Sends data about you? |
|---|---|---|---|
| `/agentic-swarm` safe-swarm skill | No | — | No |
| `/agentic-swarm:as-new-project` profiler | No | — | No |
| GitHub repo scan (opt-in) | Yes, via your `gh` | Inbound read only | No (reads metadata; uploads nothing) |
| SessionStart update check | Yes | **Inbound read only** | **No — fetches a version string, sends nothing** |

There is **no** path in this plugin that uploads your transcripts, code, or profile.

---

## How to disable / opt out

You're in full control. Pick any or all of the following:

- **Skip the profiler.** It only ever runs when you invoke `/agentic-swarm:as-new-project`. If
  you never run it, it never reads anything. (You can dismiss the first-run nudge — it's a
  suggestion, not an action.)
- **Keep GitHub scanning off.** It's already off by default. Simply decline the opt-in prompt
  and the profiler stays local-transcripts + current-repo only.
- **Disable the SessionStart hook** to stop the first-run nudge and the update check entirely.
  Disable the plugin's hooks via `/plugin` (manage → disable hooks), or disable the whole
  plugin with `claude plugin disable agentic-swarm`. With the hook off, the plugin makes **no
  network requests at all.**
- **Delete the local state.** Remove the hook's bookkeeping directory `~/.agentic-swarm/` at
  any time — it'll simply be treated as a fresh first run next time.
- **Delete your profile.** `.claude/agentic-swarm/PROFILE.md` is yours; delete it whenever you
  like. Nothing depends on it persisting, and no copy exists anywhere else.

---

## Reporting a concern

If you find any behavior that contradicts this document — anything that reads more than it
should or sends data it shouldn't — please treat it as a security bug and open an issue. The
privacy guarantee here is a feature, and it's meant to be auditable line by line.
