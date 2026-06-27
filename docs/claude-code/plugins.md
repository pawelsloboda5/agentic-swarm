A plugin is a self-contained, shareable directory that extends Claude Code with skills, agents, hooks, MCP/LSP servers, and monitors — distributed via marketplaces or tested locally with `--plugin-dir`.

**Source of truth:** https://code.claude.com/docs/en/plugins.md and https://code.claude.com/docs/en/plugins-reference.md (fetched 2026-06-26)

---

## 1. What a plugin is

A plugin is a directory of components plus an optional `.claude-plugin/plugin.json` manifest. Versus standalone `.claude/` config: plugins are **shareable, versioned, reusable across projects**, and their skills are **namespaced** (`/plugin-name:skill` instead of `/skill`). Namespacing prevents collisions between plugins. Start standalone in `.claude/` for iteration; convert to a plugin to share.

Components a plugin can ship: **skills, agents (subagents), hooks, MCP servers, LSP servers, background monitors, output styles, default settings, bin/ executables.**

## 2. Directory structure

```text
my-plugin/
├── .claude-plugin/
│   └── plugin.json      ← ONLY the manifest goes here
├── skills/              ← <name>/SKILL.md dirs (preferred for skills)
│   └── code-review/
│       └── SKILL.md
├── commands/            ← flat .md skill files (legacy; use skills/ for new)
├── agents/              ← subagent .md definitions
├── hooks/
│   └── hooks.json       ← event handlers
├── .mcp.json            ← MCP server configs
├── .lsp.json            ← LSP server configs
├── monitors/monitors.json
├── bin/                 ← executables added to Bash PATH while enabled
└── settings.json        ← default settings when enabled
```

**Critical mistake to avoid:** Do NOT put `commands/`, `agents/`, `skills/`, or `hooks/` inside `.claude-plugin/`. Only `plugin.json` lives there; everything else is at the plugin root.

Single-skill shortcut: a plugin shipping exactly one skill may place `SKILL.md` at the plugin root (uses frontmatter `name` for invocation). Use `skills/` if it might grow.

## 3. The manifest — `.claude-plugin/plugin.json`

Minimal (only `name` is required):

```json
{
  "name": "my-first-plugin",
  "description": "A greeting plugin to learn the basics",
  "version": "1.0.0",
  "author": { "name": "Your Name" }
}
```

Full schema with all recognized fields:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "plugin-name",
  "displayName": "Plugin Name",
  "version": "1.2.0",
  "description": "Brief plugin description",
  "author": { "name": "Author Name", "email": "author@example.com", "url": "https://github.com/author" },
  "homepage": "https://docs.example.com/plugin",
  "repository": "https://github.com/author/plugin",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],
  "defaultEnabled": true,
  "skills": "./custom/skills/",
  "commands": ["./custom/commands/special.md"],
  "agents": ["./custom/agents/reviewer.md"],
  "hooks": "./config/hooks.json",
  "mcpServers": "./mcp-config.json",
  "outputStyles": "./styles/",
  "lspServers": "./.lsp.json",
  "experimental": { "themes": "./themes/", "monitors": "./monitors.json" },
  "userConfig": { "api_token": { "type": "string", "title": "API token", "sensitive": true } },
  "dependencies": [ "helper-lib", { "name": "secrets-vault", "version": "~2.1.0" } ]
}
```

Field notes (load-bearing):
- **`name`** (required, string): unique id + skill namespace. No spaces/path separators. Skills become `/name:skill`.
- **`displayName`** (string, v2.1.143+): human-readable UI label; may contain spaces. Falls back to `name`.
- **`version`** (string, optional): if set, users get updates only when you bump it. **If omitted and distributed via git, the commit SHA is the version** — every commit counts as a new version. `plugin.json` wins over a marketplace entry's version.
- **`author`** (object), **`homepage`/`repository`/`license`** (strings), **`keywords`** (array).
- **`defaultEnabled`** (boolean, v2.1.154+): default `true`. Set `false` to install disabled; user enables via `claude plugin enable <plugin>` or `/plugin`.
- **Component path fields** (`skills`, `commands`, `agents`, `hooks`, `mcpServers`, `outputStyles`, `lspServers`): override/add to default folders. `skills` *adds to* the default `skills/` scan; `commands`/`agents`/`outputStyles` *replace* their default folder. Accept string or array (hooks/mcpServers/lspServers also accept inline object).
- All paths must be **relative and start with `./`**.

Validation behavior: **unrecognized top-level fields → warnings, not errors** (so one manifest can double as a `package.json`/VS Code/DXT manifest). **Wrong type → load error** (e.g. `keywords` as a string fails). Use `--strict` in CI to treat warnings as errors.

## 4. Component shapes (real examples)

**Skill** — `skills/hello/SKILL.md` (folder name = skill name):
```markdown
---
description: Greet the user with a personalized message
---
# Hello Skill
Greet the user named "$ARGUMENTS" warmly and ask how you can help today.
```
`$ARGUMENTS` captures text typed after the skill name. `disable-model-invocation: true` makes it user-invoke-only.

**Hooks** — `hooks/hooks.json` (same shape as `.claude/settings.json` `hooks` object):
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/format-code.sh" }
        ]
      }
    ]
  }
}
```
Event names are **case-sensitive** (`PostToolUse`, not `postToolUse`). Hook types: `command`, `http`, `mcp_tool`, `prompt`, `agent`. Events include `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `SessionEnd`, and many more.

**MCP servers** — `.mcp.json`:
```json
{
  "mcpServers": {
    "plugin-database": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
      "env": { "DB_PATH": "${CLAUDE_PLUGIN_ROOT}/data" }
    }
  }
}
```

**LSP** — `.lsp.json`:
```json
{ "go": { "command": "gopls", "args": ["serve"], "extensionToLanguage": { ".go": "go" } } }
```

**Monitors** — `monitors/monitors.json`:
```json
[ { "name": "error-log", "command": "tail -F ./logs/error.log", "description": "Application error log" } ]
```

**Default settings** — `settings.json` (only `agent` and `subagentStatusLine` keys supported):
```json
{ "agent": "security-reviewer" }
```

**Agents:** plugin-shipped agent frontmatter supports `name`, `description`, `model`, `effort`, `maxTurns`, `tools`, `disallowedTools`, `skills`, `memory`, `background`, `isolation` (only valid value `"worktree"`). `hooks`, `mcpServers`, `permissionMode` are NOT allowed in plugin agents.

**`${CLAUDE_PLUGIN_ROOT}`** = absolute path to the plugin's install dir; use it for all bundled scripts/configs. Other substitutions: `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}`, `${user_config.*}`, `${ENV_VAR}`.

## 5. Creating a plugin (quickstart)

```bash
mkdir my-first-plugin
mkdir my-first-plugin/.claude-plugin
# write my-first-plugin/.claude-plugin/plugin.json (see §3)
mkdir -p my-first-plugin/skills/hello
# write my-first-plugin/skills/hello/SKILL.md (see §4)
claude --plugin-dir ./my-first-plugin
# then in-session:
/my-first-plugin:hello Alex
```

**Scaffold instead** — `claude plugin init`:
```bash
claude plugin init my-tool                       # creates ~/.claude/skills/my-tool/ with manifest + SKILL.md
claude plugin init my-helper --with skills hooks # add starter component folders
claude plugin init my-helper --force             # overwrite existing .claude-plugin/
```
`--with` values: `skills agents hooks mcp lsp output-style channel`. Defaults: `--author`→`git config user.name`, `--author-email`→`git config user.email`. Aliased as `claude plugin new`.

**Skills-directory plugins:** any folder under a skills dir containing `.claude-plugin/plugin.json` auto-loads next session as `<name>@skills-dir` — no marketplace, no install. (A folder with `SKILL.md` but no manifest is just a plain skill `foo`.) Disable with `claude plugin disable my-tool@skills-dir`; remove by deleting the folder.

## 6. Local testing

```bash
claude --plugin-dir ./my-plugin                  # load a local plugin for the session
claude --plugin-dir ./my-plugin.zip              # .zip archive (requires v2.1.128+)
claude --plugin-dir ./plugin-one --plugin-dir ./plugin-two   # multiple
```
A `--plugin-dir` plugin **takes precedence over an installed marketplace plugin of the same name** for that session (except managed-settings force-enable/disable). Test a remote `.zip` (e.g. CI artifact):
```bash
claude --plugin-url https://example.com/my-plugin.zip
claude --plugin-url "https://example.com/a.zip https://example.com/b.zip"   # space-separated
```
Fetched at startup, loaded for that session only; a bad fetch/archive logs a load error and starts without it.

**Hot reload:** run `/reload-plugins` after edits — reloads plugins, skills, agents, hooks, plugin MCP servers, and LSP servers without restarting. (Skill `SKILL.md` edits apply immediately in-session; `hooks/`, `.mcp.json`, `agents/`, output-styles need `/reload-plugins` or restart.)

Verify after reload: skills via `/plugin-name:skill-name`, agents via `/agents`, hooks by triggering their event.

## 7. Validation & debugging

```bash
claude plugin validate ./my-plugin            # checks plugin.json, skill/agent/command frontmatter, hooks/hooks.json schema
claude plugin validate ./my-plugin --strict   # treat warnings (e.g. misspelled fields) as errors — use in CI
claude --debug                                # shows plugin load details, manifest errors, skill/agent/hook + MCP init
```
Also available in-session: `/plugin validate`. Run `claude plugin validate` before submitting to a marketplace — the review pipeline runs the same check.

Common issues: plugin not loading → invalid `plugin.json` (validate it); skills missing → `skills/`/`commands/` placed inside `.claude-plugin/` (move to root); hooks not firing → script not executable (`chmod +x`) or wrong-case event name; MCP fails → missing `${CLAUDE_PLUGIN_ROOT}`; path errors → use relative `./` paths. `/doctor` and `claude plugin list` flag ignored default folders (v2.1.140+).

## 8. Other CLI commands (non-interactive management)

```bash
claude plugin install formatter@my-marketplace [--scope user|project|local]   # default user
claude plugin uninstall <plugin> [--prune]
claude plugin enable <plugin>     /  claude plugin disable <plugin>
claude plugin update <plugin>
claude plugin list   /   claude plugin details <name>
claude plugin prune                                   # remove orphaned deps (v2.1.121+)
claude plugin marketplace add anthropics/claude-plugins-official
```
`--scope project` writes the plugin to `enabledPlugins` in `.claude/settings.json` (shared with everyone who clones the repo).

## 9. Distribution (brief)
Add a `README.md`, choose a version strategy, distribute via a **marketplace** (`marketplace.json`); see /en/plugin-marketplaces. Public marketplaces: `claude-plugins-official` (curated by Anthropic) and `claude-community` (add via `/plugin marketplace add anthropics/claude-plugins-community`, install as `@claude-community`). When migrating from `.claude/`, hooks move from `settings.json` into `hooks/hooks.json` (same format); remove originals to avoid duplicates (project/user `.claude/agents/` override same-named plugin agents).

---

> **Verification:** WebFetch of both official pages (plugins.md + plugins-reference.md) cross-checked against Context7 /websites/code_claude (benchmark 88.67), whose snippets are sourced from the same code.claude.com/docs URLs — manifest schema and --plugin-dir examples matched exactly.
>
> **Confidence:** high
>
> **Discrepancies noted:** none — Context7 snippets are scraped from the same official docs and agreed on every load-bearing fact (manifest fields, directory layout, --plugin-dir). No conflicts found.
>
> **Sources fetched:**
> - https://code.claude.com/docs/en/plugins.md
> - https://code.claude.com/docs/en/plugins-reference.md
