Claude Code hooks let a plugin run shell commands at lifecycle points; SessionStart is the canonical way a plugin injects context into a fresh session.

**Source of truth:** https://code.claude.com/docs/en/hooks.md and https://code.claude.com/docs/en/hooks-guide.md (verified against Context7 mirror `/websites/code_claude`).

---

## 1. Where plugin hooks live

A plugin declares hooks in **`hooks/hooks.json`** at the plugin root. The shape is `{ "description"?, "hooks": { <Event>: [ <matcher-group>, ... ] } }`. Reference scripts with **`${CLAUDE_PLUGIN_ROOT}`** (absolute path to the plugin dir).

```json
{
  "description": "Inject git + issue context at session start",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/session-context.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

Same `hooks: { ... }` block also works inside any `settings.json` (`~/.claude/settings.json`, project `.claude/settings.json`, `.claude/settings.local.json`). In settings the project-dir variable is **`$CLAUDE_PROJECT_DIR`** / **`"$CLAUDE_PROJECT_DIR"`**; in plugins use `${CLAUDE_PLUGIN_ROOT}`.

Config nesting is always: **Event → array of `{ matcher, hooks: [ { type, command, timeout? } ] }`**. An empty or omitted `matcher` fires on every occurrence of the event.

---

## 2. Hook events (matcher field per event)

| Event | When | Matcher filters on / example values |
|---|---|---|
| `SessionStart` | session begins/resumes | `startup`, `resume`, `clear`, `compact` |
| `SessionEnd` | session terminates | `clear`, `resume`, `logout`, `prompt_input_exit`, `other` |
| `UserPromptSubmit` | prompt submitted, pre-processing | (no matcher) |
| `PreToolUse` | before a tool runs (can block) | tool name: `Bash`, `Edit|Write`, `mcp__.*` |
| `PostToolUse` | after a tool succeeds | tool name |
| `Notification` | Claude sends a notification | notification type |
| `Stop` | Claude finishes responding (can block) | (no matcher) |
| `SubagentStop` | subagent finishes | agent type |
| `PreCompact` / `PostCompact` | around compaction | `manual`, `auto` |
| `Setup` | `--init-only` / `--init`/`--maintenance` in `-p` | `init`, `maintenance` |
| `CwdChanged` / `FileChanged` | cwd or watched file changes | FileChanged matcher = literal filenames split on `|` |

(Additional newer events exist: `PostToolUseFailure`, `SubagentStart`, `PermissionRequest`, `InstructionsLoaded`, `ConfigChange`, `WorktreeCreate/Remove`, etc. — same config shape.) On v2.1.191+ tool-name matchers accept `,` and `|` interchangeably (`Edit,Write` == `Edit|Write`).

---

## 3. SessionStart — the deep dive

### Matcher values
- `startup` — brand new session
- `resume` — `--resume`, `--continue`, or `/resume`
- `clear` — `/clear`
- `compact` — auto or manual compaction (use this to re-inject context lost in compaction)

### stdin JSON (what your script receives)
```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-...jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "SessionStart",
  "source": "startup",
  "model": "claude-sonnet-4-6",
  "agent_type": "Explore",
  "session_title": "auth-refactor"
}
```
`source` is required (`startup|resume|clear|compact`). `model`, `agent_type`, `session_title` are optional.

### stdout JSON (what your hook prints on exit 0)
```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Current branch: feat/auth-refactor\nUncommitted changes: src/auth.ts, src/login.tsx\nActive issue: #4211 Migrate to OAuth2",
    "sessionTitle": "auth-refactor",
    "initialUserMessage": "First message for non-interactive (-p) mode",
    "watchPaths": ["/absolute/path/to/watch"]
  },
  "continue": true,
  "suppressOutput": false,
  "systemMessage": "Optional warning shown to the user"
}
```

Field reference:
- `additionalContext` — **string injected into Claude's context** before the first prompt. This is the main context-injection lever.
- `sessionTitle` — sets the session title (applies on `startup`/`resume`; ignored on `clear`/`compact`).
- `initialUserMessage` — first user message in non-interactive `-p` mode; creates a new turn.
- `watchPaths` — array of absolute paths to watch for `FileChanged` events this session.
- `continue` (default `true`) — `false` stops Claude entirely.
- `suppressOutput` (default `false`) — hides hook stdout from the transcript.
- `systemMessage` — warning text surfaced to the user.

### EXACT minimal JSON to inject context
The smallest valid payload that adds context is just the `hookSpecificOutput` block:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Project conventions: use Bun not npm; run bun test before committing. Current sprint: auth refactor."
  }
}
```

### Plain-stdout shortcut (no JSON needed)
For SessionStart (and UserPromptSubmit), **anything written to stdout on exit 0 is added to Claude's context** — so a context-only hook can skip JSON entirely:
```bash
#!/bin/bash
echo "Current branch: $(git branch --show-current)"
echo "Uncommitted: $(git diff --name-only | tr '\n' ' ')"
exit 0
```

### Producing the JSON from a script
```bash
#!/bin/bash
BRANCH=$(git branch --show-current)
jq -nc --arg b "$BRANCH" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: ("Current branch: " + $b)
  }
}'
```

### Exit codes (SessionStart)
- **0** — success; stdout is parsed as JSON, or if plain text, added to Claude's context.
- **2** — blocking error elsewhere, but **SessionStart cannot truly block**: stderr is shown to the user and the session continues.
- **other** — non-blocking error; transcript shows `<hook> hook error` + first stderr line; full stderr in debug log.

### Timeout / async
- Default timeout **600s** (10 min) for command hooks; override per hook with `"timeout": <seconds>`.
- `"async": true` — run in background, don't block session start.
- `"asyncRewake": true` — run in background and wake Claude on exit code 2 (stderr shown as a system reminder).
- Supported hook types for SessionStart: `"command"` and `"mcp_tool"` only (not prompt/agent/HTTP).

### Persisting env vars from SessionStart
SessionStart hooks get `$CLAUDE_ENV_FILE`; appending `export` lines makes vars persist into every later Bash command:
```bash
[ -n "$CLAUDE_ENV_FILE" ] && echo 'export NODE_ENV=production' >> "$CLAUDE_ENV_FILE"
```

---

## 4. Common settings-file SessionStart examples

Re-inject context after compaction (project settings):
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          { "type": "command",
            "command": "echo 'Reminder: use Bun not npm. Current sprint: auth refactor.'" }
        ]
      }
    ]
  }
}
```

Install deps only in cloud sessions (uses `$CLAUDE_PROJECT_DIR`):
```json
{
  "hooks": {
    "SessionStart": [
      { "matcher": "startup|resume",
        "hooks": [ { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/scripts/install_pkgs.sh" } ] }
    ]
  }
}
```

---

## 5. Security & gotchas (plugin builders)
- Hooks run **arbitrary shell with the user's full environment and credentials** — treat plugin hook scripts as trusted code; validate/quote inputs (paths from stdin can contain spaces/`;`).
- No `/dev/tty` / controlling terminal; for notifications use `terminalSequence` (OSC) rather than reading the TTY.
- JSON string outputs are capped at **10,000 chars**; excess is written to a file.
- Identical handlers are **deduplicated** (run once per event) by command string/args.
- When multiple hooks match, all run to completion and outputs merge; every hook's `additionalContext` is kept and passed to Claude together. Don't rely on one hook's `deny` to suppress another's side effects.
- Admins can set `allowManagedHooksOnly` to block user/project/plugin hooks; design plugins to degrade gracefully if their hooks are disabled.
- Use `/hooks` in the TUI to inspect which hooks are registered, their matcher, source file, and command.

---

> **Verification:** WebFetch of code.claude.com/docs/en/hooks.md + hooks-guide.md, cross-checked against Context7 /websites/code_claude (query-docs returned identical SessionStart input/output JSON and config shapes sourced from code.claude.com/docs/en/hooks).
>
> **Confidence:** high
>
> **Discrepancies noted:** none — Context7 results are themselves scraped from code.claude.com and matched the live WebFetch verbatim (same SessionStart input fields, same additionalContext/sessionTitle output, same matcher values).
>
> **Sources fetched:**
> - https://code.claude.com/docs/en/hooks.md
> - https://code.claude.com/docs/en/hooks-guide.md
> - https://context7.com/websites/code_claude (mirror of code.claude.com/docs)
