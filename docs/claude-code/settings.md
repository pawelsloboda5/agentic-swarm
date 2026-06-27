ന# Claude Code — settings.json, env & permissions (plugin-builder reference)

One-liner: How Claude Code loads settings (4 scopes + precedence), the `permissions`/`env`/`hooks` blocks a plugin cares about, and the `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PROJECT_DIR}` placeholders that make plugin scripts portable.

**Source of truth:** https://code.claude.com/docs/en/settings.md and https://code.claude.com/docs/en/hooks.md (cross-verified via Context7 `/websites/code_claude`). JSON Schema: `https://json.schemastore.org/claude-code-settings.json`.

---

## 1. Settings files & precedence

| Scope | Location | Committed? |
|---|---|---|
| **Managed (enterprise)** | OS-level `managed-settings.json` (deployed by IT) | n/a |
| **User** | `~/.claude/settings.json` (`%USERPROFILE%\.claude` on Windows) | no |
| **Project (shared)** | `<repo>/.claude/settings.json` | yes (git) |
| **Project (local)** | `<repo>/.claude/settings.local.json` | no (gitignored) |

**Precedence, highest wins:**
1. Managed/enterprise (cannot be overridden)
2. Command-line flags (session-only)
3. `.claude/settings.local.json`
4. `.claude/settings.json`
5. `~/.claude/settings.json`

> **Permissions merge, not replace:** allow/deny/ask rules from all scopes are unioned; **deny always wins** over allow. Most edits hot-reload (model/outputStyle may need a restart).

---

## 2. Minimal real settings.json

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "model": "claude-sonnet-4-6",
  "permissions": {
    "allow": [
      "Bash(npm run lint)",
      "Bash(npm run test:*)",
      "Read(~/.zshrc)"
    ],
    "deny": [
      "Bash(curl:*)",
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)"
    ],
    "ask": [],
    "defaultMode": "default",
    "additionalDirectories": ["../shared-libs/"]
  },
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp"
  },
  "hooks": {},
  "enableAllProjectMcpServers": true,
  "cleanupPeriodDays": 30
}
```

Commonly-used top-level keys: `model`, `apiKeyHelper` (script that prints an API key), `env`, `permissions`, `hooks`, `includeCoAuthoredBy` (bool; adds the `Co-Authored-By: Claude` trailer), `cleanupPeriodDays` (transcript retention), `enableAllProjectMcpServers`, `enabledMcpjsonServers` / `disabledMcpjsonServers`.

---

## 3. permissions block (what matters for a plugin running scripts)

Three arrays of **rules**, plus mode controls:

```json
{
  "permissions": {
    "allow": ["Bash(npm run build:*)", "Edit(./src/**)", "WebFetch(domain:docs.example.com)"],
    "ask":   ["Bash(git push:*)"],
    "deny":  ["Read(./.env*)", "Bash(rm:*)"],
    "defaultMode": "acceptEdits",
    "additionalDirectories": ["/abs/extra/dir"]
  }
}
```

**Rule syntax** — `Tool(specifier)`:
- `Bash(npm run test:*)` — prefix/wildcard match on the command. `*` is the wildcard; `:*` matches "this command + any args".
- `Bash(npm run lint)` — exact command, no args.
- `Read(...)` / `Edit(...)` — gitignore-style globs: `./path`, `~/path`, `**` recursive, `*` single-segment.
- `WebFetch(domain:example.com)`, `mcp__<server>__<tool>` for MCP tools.
- Tool name alone (e.g. `"Bash"`) matches all uses of that tool.

**Evaluation:** `deny` > `ask` > `allow`. Anything unmatched falls back to `defaultMode`.

`defaultMode` values: `default` (prompt on first use), `acceptEdits` (auto-accept file edits), `plan` (read-only planning), `bypassPermissions` (no prompts — dangerous).

`additionalDirectories` grants file access outside the project root.

---

## 4. env block

`env` injects environment variables into Claude Code's session **and** into spawned Bash/hook processes. Values must be strings.

```json
{ "env": { "NODE_ENV": "test", "MY_PLUGIN_MODE": "ci", "ANTHROPIC_MODEL": "claude-sonnet-4-6" } }
```

Selected real environment variables (confirmed across sources):
- `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_MODEL` — auth/model override.
- `CLAUDE_CODE_ENABLE_TELEMETRY` (`"1"`) + `OTEL_METRICS_EXPORTER` — OpenTelemetry.
- `BASH_DEFAULT_TIMEOUT_MS` / `BASH_MAX_TIMEOUT_MS` — Bash tool timeouts.
- `MAX_THINKING_TOKENS` — cap extended thinking (`0` disables).
- `DISABLE_AUTOUPDATER`, `NO_COLOR`/`FORCE_COLOR`.

(The settings page also surfaced many `CLAUDE_CODE_DISABLE_*` feature toggles; verify the exact name in the live docs before relying on a specific one — several are newer/uncertain.)

---

## 5. hooks block — exact shape

Map of **event name → array of matcher groups**; each group has a `matcher` (regex over tool name) and a `hooks` array of actions.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/block-rm.sh",
            "timeout": 600
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write" }
        ]
      }
    ]
  }
}
```

- **`matcher`**: regex/alternation on the tool name — `"Bash"`, `"Edit|Write"`, `"mcp__memory__.*"`, `"*"` (all). Omit/`*` to match everything (e.g. for `SessionStart`, `UserPromptSubmit`).
- **`hooks[].type`**: `"command"` (run a shell command). `command` is the script; optional `timeout` (seconds), optional `args` array.
- **Stable events** a plugin can rely on: `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Notification`, `Stop`, `SubagentStop`, `SessionStart`, `SessionEnd`, `PreCompact`. (hooks.md lists many additional newer events — `Setup`, `PermissionRequest`, `PostCompact`, `FileChanged`, etc. — treat as bleeding-edge.)

### Hook I/O
**Input** arrives as JSON on **stdin**:
```json
{
  "session_id": "abc123",
  "transcript_path": "/home/user/.claude/projects/.../transcript.jsonl",
  "cwd": "/home/user/my-project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": { "command": "rm -rf /tmp/build" }
}
```

**Output** options:
- **Exit code:** `0` = success (stdout JSON parsed); `2` = blocking error (stderr fed to Claude); other = non-blocking error.
- **JSON on stdout** for structured control. PreToolUse decision:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Destructive command blocked by hook"
  }
}
```
`permissionDecision` ∈ `allow` | `deny` | `ask`. Universal fields: `continue` (bool), `stopReason`, `suppressOutput`, `systemMessage`. PostToolUse / Stop can `{"decision":"block","reason":"..."}` or add `additionalContext`. SessionStart/PostToolUse can inject `additionalContext`.

---

## 6. Path placeholders (critical for portable plugins)

Substituted in `command` **and** `args`, and exported as env vars to the spawned process:

| Placeholder | Meaning |
|---|---|
| `${CLAUDE_PROJECT_DIR}` | Absolute path to the user's project root. Use for hooks shipped inside a repo's `.claude/hooks/`. |
| `${CLAUDE_PLUGIN_ROOT}` | Absolute path to **this plugin's** install dir. Use for everything a plugin ships (scripts, configs, bundled MCP server binaries). |
| `${CLAUDE_PLUGIN_DATA}` | Plugin's persistent data dir (newer; verify availability). |

> A plugin must reference its own files via `${CLAUDE_PLUGIN_ROOT}` — never a relative or absolute machine path — because the install location is not known ahead of time.

---

## 7. What a PLUGIN ships (vs. a user's settings.json)

A plugin does **not** edit the user's `settings.json`. It declares hooks/MCP/commands/agents in its own **`plugin.json`** (or a `hooks/hooks.json`), using `${CLAUDE_PLUGIN_ROOT}`:

```json
{
  "name": "enterprise-tools",
  "version": "2.1.0",
  "description": "Enterprise workflow automation tools",
  "commands": ["./commands/core/", "./commands/enterprise/"],
  "agents": ["./agents/security-reviewer.md"],
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/scripts/validate.sh" }
        ]
      }
    ]
  },
  "mcpServers": {
    "enterprise-db": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"]
    }
  }
}
```

The plugin's hooks/MCP servers are **merged into** the user's effective config at load time; the user still controls trust (marketplace allow-listing) and can gate plugin scripts via their own `permissions`. A plugin's hook command that runs a script still surfaces through the normal permission flow unless the user has allow-listed it (e.g. `"Bash(${...}/scripts/validate.sh)"` is not how it's gated — hook commands run as hooks, but any `Bash` tool calls the plugin triggers are subject to the user's `permissions`).

---

## 8. Plugin-builder gotchas
- Reference your own files only via `${CLAUDE_PLUGIN_ROOT}`; reference the user's repo via `${CLAUDE_PROJECT_DIR}`.
- `matcher` is a **regex on tool name**, not on command text. To gate by command content, inspect `tool_input.command` inside the script.
- Return exit `2` to hard-block; return the `permissionDecision:"deny"` JSON to block *with a reason Claude sees*.
- Keep hook scripts fast and set a `timeout`; a hanging hook stalls the turn.
- `deny` in any scope beats your plugin's intent — don't assume your hook can override a user `deny` rule.

---

> **Verification:** WebFetch of code.claude.com/docs/en/settings.md + hooks.md, independently cross-checked against Context7 /websites/code_claude (benchmark 88.7) — hook JSON, permissions arrays, CLAUDE_PLUGIN_ROOT/PROJECT_DIR placeholders, env block all agree.
>
> **Confidence:** high
>
> **Discrepancies noted:** The settings.md WebFetch summary listed a large catalog of env vars (e.g. both CLAUDE_CODE_ENABLE_TELEMETRY and CLAUDE_CODE_DISABLE_TELEMETRY) some of which may be model-expanded rather than verbatim; only env vars confirmed across both sources are stated as authoritative below, the rest flagged. Hook event list differs by source granularity: hooks.md surfaced many newer events (Setup, PermissionRequest, PostCompact, etc.) beyond the classic set — the classic/stable set is what a plugin should rely on. CLAUDE_PLUGIN_DATA appears in hooks.md only (not in Context7 sample); treat as newer/less-stable.
>
> **Sources fetched:**
> - https://code.claude.com/docs/en/settings.md
> - https://code.claude.com/docs/en/hooks.md
> - https://code.claude.com/docs/en/plugin-marketplaces
> - https://code.claude.com/docs/en/claude-directory
> - https://code.claude.com/docs/en/hooks-guide
