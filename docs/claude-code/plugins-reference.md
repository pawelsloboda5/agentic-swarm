> Reference for plugin builders: the `.claude-plugin/plugin.json` manifest schema, the exact on-disk layout, and the `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` path variables and what persists across updates.
>
> **Source of truth:** https://code.claude.com/docs/en/plugins-reference.md (independently verified against Context7 `/websites/code_claude`).

A **plugin** is a self-contained directory of components (skills, agents, hooks, MCP servers, LSP servers, monitors, themes) that extends Claude Code.

---

## 1. The manifest: `.claude-plugin/plugin.json`

**The manifest is OPTIONAL.** If omitted, Claude Code auto-discovers components in their default locations and derives the plugin name from the directory name. Use a manifest when you need metadata or custom component paths.

### Required vs optional

- **`name` is the ONLY required field** when a manifest is present. It must be **kebab-case, no spaces**, and is used for namespacing (e.g. agent `agent-creator` in plugin `plugin-dev` shows as `plugin-dev:agent-creator`).
- Everything else is optional.

### Complete schema (verbatim shape from docs)

```json
{
  "name": "plugin-name",
  "displayName": "Plugin Name",
  "version": "1.2.0",
  "description": "Brief plugin description",
  "author": {
    "name": "Author Name",
    "email": "author@example.com",
    "url": "https://github.com/author"
  },
  "homepage": "https://docs.example.com/plugin",
  "repository": "https://github.com/author/plugin",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],
  "skills": "./custom/skills/",
  "commands": ["./custom/commands/special.md"],
  "agents": ["./custom/agents/reviewer.md"],
  "hooks": "./config/hooks.json",
  "mcpServers": "./mcp-config.json",
  "outputStyles": "./styles/",
  "lspServers": "./.lsp.json",
  "experimental": {
    "themes": "./themes/",
    "monitors": "./monitors.json"
  },
  "dependencies": [
    "helper-lib",
    { "name": "secrets-vault", "version": "~2.1.0" }
  ]
}
```

### Metadata fields

| Field | Type | Notes |
| :-- | :-- | :-- |
| `name` | string | **Required.** Unique id, kebab-case, no spaces. Namespacing key. |
| `$schema` | string | JSON Schema URL for editor autocomplete; ignored at load time. e.g. `https://json.schemastore.org/claude-code-plugin-manifest.json` |
| `displayName` | string | Human-readable UI label (may contain spaces/casing). Falls back to `name`. Not used for lookup. **Requires v2.1.143+.** |
| `version` | string | Optional semver. **Setting it pins the version** — users only get updates when you bump it. If omitted, Claude Code falls back to the git commit SHA, so every commit = new version. If also set in the marketplace entry, **`plugin.json` wins**. |
| `description` | string | Plugin purpose. |
| `author` | object | `{ "name", "email", "url" }` — all sub-fields optional. |
| `homepage` | string | Docs URL. |
| `repository` | string | Source URL. |
| `license` | string | SPDX id, e.g. `"MIT"`, `"Apache-2.0"`. |
| `keywords` | array of string | Discovery tags. Wrong type (e.g. a string) is a **load error**. |
| `defaultEnabled` | boolean | Default `true`. Set `false` to ship installed-but-disabled. **Requires v2.1.154+** (earlier versions ignore it). |

**Unrecognized top-level fields are ignored** (so one file can double as a `package.json` / VS Code / DXT manifest). `claude plugin validate` reports unknown fields as **warnings**, not errors; the plugin still loads. **Wrong-type values for recognized fields still fail.** Use `claude plugin validate ./my-plugin --strict` in CI to treat warnings as errors.

### Component-path fields

All paths are **relative to the plugin root and must start with `./`**. Whether a custom path **replaces** or **adds to** the default scan depends on the field:

| Field | Type | Replace or Add | Notes |
| :-- | :-- | :-- | :-- |
| `skills` | string \| array | **Adds** to default `skills/` scan | (Marketplace-root `source` exception: declaring subdirs replaces.) |
| `commands` | string \| array | **Replaces** default `commands/` | To keep default + add: `["./commands/", "./extras/"]` |
| `agents` | string \| array | **Replaces** default `agents/` | |
| `hooks` | string \| array \| object | own merge rules | Path(s) or inline config |
| `mcpServers` | string \| array \| object | own merge rules | Path(s) or inline config |
| `outputStyles` | string \| array | **Replaces** default `output-styles/` | |
| `lspServers` | string \| array \| object | own merge rules | LSP configs |
| `experimental.themes` | string \| array | **Replaces** default `themes/` | experimental |
| `experimental.monitors` | string \| array | **Replaces** default `monitors/` | experimental; requires v2.1.105+ |
| `userConfig` | object | — | Values prompted at enable time (see below) |
| `channels` | array | — | Message channels bound to an MCP server |
| `dependencies` | array | — | Other plugins required; entries are a bare name string or `{ "name", "version": "~2.1.0" }` |

> A single `SKILL.md` at the plugin root (no `skills/` dir, no `skills` field) is auto-loaded as a single-skill plugin in **v2.1.142+**. The skill's invocation name comes from the SKILL.md frontmatter `name` (falls back to the directory basename — which for marketplace installs is a version string that changes every update, so set `name`).

### `userConfig` (prompt the user at enable time)

```json
{
  "userConfig": {
    "api_endpoint": { "type": "string", "title": "API endpoint", "description": "Your team's API endpoint" },
    "api_token":    { "type": "string", "title": "API token", "description": "Auth token", "sensitive": true }
  }
}
```

Per-option fields: `type` (`string|number|boolean|directory|file`, required), `title` (required), `description` (required), `sensitive`, `required`, `default`, `multiple`, `min`/`max`. Use values as `${user_config.KEY}` in MCP/LSP/hook/monitor commands (and non-sensitive ones in skill/agent content). All exported to subprocesses as `CLAUDE_PLUGIN_OPTION_<KEY>`. Non-sensitive values are stored in `settings.json` under `pluginConfigs[<plugin-id>].options`; **sensitive values go to the system keychain** (~2 KB shared limit).

---

## 2. On-disk layout

Only `plugin.json` lives in `.claude-plugin/`. **Every other directory must be at the plugin root, NOT inside `.claude-plugin/`.**

```text
enterprise-plugin/
├── .claude-plugin/           # Metadata dir (optional)
│   └── plugin.json           # THE manifest — only this goes here
├── skills/                   # Skills: <name>/SKILL.md (+ optional scripts/, reference.md)
│   ├── code-reviewer/
│   │   └── SKILL.md
│   └── pdf-processor/
│       ├── SKILL.md
│       └── scripts/
├── commands/                 # Skills as flat .md files (legacy; prefer skills/)
│   ├── status.md
│   └── logs.md
├── agents/                   # Subagent .md definitions
│   └── security-reviewer.md
├── output-styles/            # Output style definitions
│   └── terse.md
├── themes/                   # Color themes (experimental)
│   └── dracula.json
├── monitors/                 # Background monitors (experimental)
│   └── monitors.json
├── hooks/                    # Hook configs
│   ├── hooks.json            # Main hook config
│   └── security-hooks.json
├── bin/                      # Executables added to the Bash tool PATH
│   └── my-tool               # invokable as a bare command while enabled
├── settings.json             # Default settings (only `agent` + `subagentStatusLine` keys supported)
├── .mcp.json                 # MCP server definitions
├── .lsp.json                 # LSP server configurations
├── scripts/                  # Hook/utility scripts
│   ├── format-code.py
│   └── deploy.js
├── LICENSE
└── CHANGELOG.md
```

### Default locations table

| Component | Default location | Notes |
| :-- | :-- | :-- |
| Manifest | `.claude-plugin/plugin.json` | Optional |
| Skills | `skills/` | `<name>/SKILL.md` structure |
| Commands | `commands/` | Flat `.md`; use `skills/` for new plugins |
| Agents | `agents/` | Subagent `.md` |
| Output styles | `output-styles/` | |
| Themes | `themes/` | experimental |
| Hooks | `hooks/hooks.json` | |
| MCP servers | `.mcp.json` | |
| LSP servers | `.lsp.json` | |
| Monitors | `monitors/monitors.json` | experimental |
| Executables | `bin/` | Added to Bash tool `PATH`; bare-command invokable when enabled |
| Settings | `settings.json` | Only `agent` and `subagentStatusLine` keys honored |

> A root `CLAUDE.md` is **NOT** loaded as project context. Ship instructions via a skill instead. Common mistake: putting `commands/`, `agents/`, `hooks/` inside `.claude-plugin/` — symptom is "plugin loads but components missing."

---

## 3. Path variables & what persists across updates

Three variables; all substituted inline in skill/agent content, hook/monitor commands, and MCP/LSP configs, and exported as env vars to subprocesses:

- **`${CLAUDE_PLUGIN_ROOT}`** — absolute path to the plugin's install dir. Use for bundled scripts/binaries/config. **This path CHANGES on every update.** The old version dir lingers ~7 days then is cleaned up — **treat it as ephemeral; never write state here.** In shell-form hooks/monitors wrap in double quotes: `"${CLAUDE_PLUGIN_ROOT}"`; in exec-form hooks use `args` so no quoting is needed. After a mid-session update, hooks/MCP/LSP keep the old path until `/reload-plugins`; monitors need a session restart.
- **`${CLAUDE_PLUGIN_DATA}`** — a **persistent** directory that **survives updates**. Use for `node_modules`, Python venvs, generated code, caches, any cross-version state. Created on first reference. Resolves to `~/.claude/plugins/data/{id}/` where `{id}` is the plugin id with non-`[a-zA-Z0-9_-]` chars replaced by `-` (e.g. `formatter@my-marketplace` → `~/.claude/plugins/data/formatter-my-marketplace/`). Deleted on uninstall from the last scope (CLI deletes by default; `--keep-data` preserves it).
- **`${CLAUDE_PROJECT_DIR}`** — the project root (same dir hooks get as `CLAUDE_PROJECT_DIR`). Quote for spaces.

Hook example using the root variable:

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

Persist deps across versions — install once into `CLAUDE_PLUGIN_DATA`, reuse via `NODE_PATH`:

```json
{
  "mcpServers": {
    "routines": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"],
      "env": { "NODE_PATH": "${CLAUDE_PLUGIN_DATA}/node_modules" }
    }
  }
}
```

---

## 4. Versioning semantics

Version is the cache key that decides whether an update applies. Resolved from the first that is set: (1) `version` in `plugin.json` → (2) `version` in the marketplace entry → (3) git commit SHA (for `github`/`url`/`git-subdir`/relative-path git-hosted sources) → (4) `unknown` (npm sources / non-git local dirs).

- **Explicit version** (`"version": "2.1.0"`): users get updates **only when you bump the field**. Pushing commits alone does nothing (`/plugin update` says "already at the latest version"). Follow semver (`MAJOR.MINOR.PATCH`).
- **Commit-SHA version** (omit `version` everywhere): users update on every new commit — best for internal/fast-iterating plugins.

---

## 5. Skills-directory plugins (no marketplace, no install)

Any folder under a skills dir with a `.claude-plugin/plugin.json` loads as `<name>@skills-dir` on the next session, discovered in place (not copied to cache). Scaffold with `claude plugin init <name>` (creates `~/.claude/skills/<name>/`). Disable via `claude plugin disable my-tool@skills-dir` (delete the folder to remove — nothing was installed).

| Skills dir | Scope | Loads |
| :-- | :-- | :-- |
| `~/.claude/skills/` | personal | every project; no restrictions |
| `<cwd>/.claude/skills/` | project | only after workspace trust; MCP per-server approval, LSP only after trust, **monitors don't load** |

---

## 6. Caching, path traversal, symlinks

Marketplace plugins are **copied** to `~/.claude/plugins/cache` (each version is its own dir; orphaned versions removed ~7 days later; Glob/Grep skip orphaned dirs). Consequence: **plugins cannot reference files outside their dir** — paths like `../shared-utils` break after install because external files aren't copied. To share within the same marketplace use symlinks: links within the plugin's own dir are preserved (relative); links elsewhere in the same marketplace are dereferenced (content copied); links outside the marketplace are skipped for security. For `--plugin-dir`/local installs, only symlinks resolving inside the plugin's own dir are preserved.

---

## 7. Validation & debugging quick refs

- `claude plugin validate ./my-plugin [--strict]` — checks `plugin.json`, skill/agent/command frontmatter, and `hooks/hooks.json`. Also `/plugin validate` in-session.
- `claude --debug` — shows plugin load, manifest errors, skill/agent/hook registration, MCP init.
- Common errors: `name: Required` (missing required field); `keywords` as a string → load error; skills not appearing → `skills/` must be at root, not in `.claude-plugin/`; hooks not firing → `chmod +x` the script; MCP fails → use `${CLAUDE_PLUGIN_ROOT}` for all paths.
- Install scopes: `user` (`~/.claude/settings.json`, default), `project` (`.claude/settings.json`), `local` (`.claude/settings.local.json`, gitignored), `managed` (read-only).

---

> **Verification:** WebFetch of the full official page (code.claude.com/docs/en/plugins-reference.md) cross-checked against Context7 /websites/code_claude query-docs — manifest schema, layout tree, and CLAUDE_PLUGIN_ROOT examples matched verbatim.
>
> **Confidence:** high
>
> **Discrepancies noted:** none — Context7 returned the identical plugin.json schema and directory-structure snippets as the live official page.
>
> **Sources fetched:**
> - https://code.claude.com/docs/en/plugins-reference.md
> - Context7: /websites/code_claude (query: plugin.json manifest schema + layout + CLAUDE_PLUGIN_ROOT)
