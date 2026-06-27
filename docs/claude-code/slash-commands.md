# Slash Commands (Custom Commands & Skills) — Plugin Builder Reference

One-liner: Custom slash commands have been **merged into skills**; a `.claude/commands/<name>.md` file and a `.claude/skills/<name>/SKILL.md` both create `/<name>` and share the same frontmatter, with skills adding supporting files, auto-invocation, and richer fields.

**Source of truth:** https://code.claude.com/docs/en/slash-commands.md (redirects to "Extend Claude with skills") · https://code.claude.com/docs/en/skills · legacy command format at https://code.claude.com/docs/en/agent-sdk/slash-commands · plugin namespacing at https://code.claude.com/docs/en/plugins

---

## 1. Commands vs Skills — what to use in a plugin

| | `.claude/commands/<name>.md` (legacy) | `.claude/skills/<name>/SKILL.md` (recommended) |
| :-- | :-- | :-- |
| Creates | `/<name>` | `/<name>` |
| Command name from | **filename** without `.md` | **directory name** (not frontmatter `name`) |
| Supporting files | No | Yes (scripts, reference docs, templates in same dir) |
| Auto-invoked by Claude | Yes (via description) | Yes (via description) — unless `disable-model-invocation: true` |
| Frontmatter | Same fields as skills | Full field set |

Both still work. **If a skill and a command share a name, the skill wins.** For plugins, prefer the `skills/` directory.

> Note: A single-file `SKILL.md` is the only required file. Keep it under ~500 lines; move long reference material to sibling files and link them.

---

## 2. File locations (precedence: enterprise > personal > project; plugins are namespaced so never conflict)

| Scope | Path |
| :-- | :-- |
| Personal | `~/.claude/skills/<skill-name>/SKILL.md` |
| Project | `.claude/skills/<skill-name>/SKILL.md` |
| Plugin | `<plugin>/skills/<skill-name>/SKILL.md` → `/plugin-name:skill-name` |
| Legacy command | `.claude/commands/<name>.md` or `<plugin>/commands/<name>.md` |

---

## 3. Namespacing → `/plugin:command`

- **Plugin skills are always namespaced**: `my-plugin/skills/review/SKILL.md` → invoke as **`/my-plugin:review`**. This prevents collisions with personal/project/bundled skills.
- **Plugin-root `SKILL.md`** (`my-plugin/SKILL.md`): the command name comes from frontmatter **`name`** (falling back to the plugin directory name) → `/my-plugin:review`. This is the *one* place `name` sets the invocation name.
- **Subdirectory namespacing (legacy commands)**: `.claude/commands/frontend/component.md` → `/component` displayed under the `frontend` namespace. With skills, a nested `.claude/skills/` that name-clashes yields a directory-qualified name, e.g. `apps/web/.claude/skills/deploy/SKILL.md` → `/apps/web:deploy`.
- Pass an argument when invoking a namespaced plugin skill: `/my-first-plugin:hello Alex`.

---

## 4. Frontmatter reference (all optional; only `description` recommended)

```yaml
---
name: deploy                       # display label; for plugin-root SKILL.md only, sets command name
description: Deploy to production   # how Claude decides to auto-invoke; capped ~1,536 chars in listing
argument-hint: [issue-number] [priority]   # shown in /autocomplete
arguments: [issue, branch]         # named positional args → $issue, $branch (space-string or YAML list)
allowed-tools: Bash(git add *) Bash(git commit *)   # pre-approved tools while active (space/comma/YAML list)
disallowed-tools: AskUserQuestion  # tools removed from pool while active; clears on next message
model: inherit                     # same values as /model, or `inherit`
effort: high                       # low | medium | high | xhigh | max
disable-model-invocation: true     # only YOU can invoke via /name; default false
user-invocable: false              # hide from / menu; only Claude invokes; default true
context: fork                      # run in a forked subagent context
agent: Explore                     # subagent type when context: fork (default general-purpose)
when_to_use: "trigger phrases..."  # appended to description in listing
paths: "src/**/*.ts"               # globs limiting auto-activation (comma-string or YAML list)
shell: bash                        # bash (default) or powershell for !`cmd` blocks
hooks: ...                         # hooks scoped to this skill's lifecycle
---
```

Field notes (load-bearing):
- **`description`** — if omitted, first markdown paragraph is used. Combined `description`+`when_to_use` truncated at **1,536 chars** in the listing. Put the key use case first.
- **`argument-hint`** — autocomplete hint only, e.g. `[filename] [format]`. Does not validate.
- **`allowed-tools`** — grants permission *without* prompting; does **not** restrict other tools. For project skills, takes effect only after the workspace-trust dialog is accepted.
- **`disable-model-invocation: true`** — manual-only (`/name`); also keeps the skill out of Claude's context and prevents preloading into subagents. Default `false`.
- **`model`** — override applies for the rest of the current turn only (not saved); a value outside the org `availableModels` allowlist is ignored.

---

## 5. Arguments — `$ARGUMENTS`, `$N` (0-based!), named

| Variable | Meaning |
| :-- | :-- |
| `$ARGUMENTS` | The full argument string as typed. If absent from content, Claude Code appends `ARGUMENTS: <value>`. |
| `$ARGUMENTS[N]` | Argument by **0-based** index. `$ARGUMENTS[0]` = first arg. |
| `$N` | Shorthand for `$ARGUMENTS[N]`. **`$0` = first arg, `$1` = second** (0-based — easy to get wrong). |
| `$name` | Named arg declared in `arguments:` frontmatter, mapped by position. |
| `${CLAUDE_SKILL_DIR}` | Dir containing this `SKILL.md` (the skill subdir for plugins). Use to reference bundled scripts. |
| `${CLAUDE_SESSION_ID}` / `${CLAUDE_EFFORT}` | Session id / current effort level. |

Quoting: indexed args use shell-style quoting — `/my-skill "hello world" second` → `$0`=`hello world`, `$1`=`second`. Escape a literal with `\$1.00`.

**Whole-string example** (`fix-issue`):
```yaml
---
description: Fix a GitHub issue
disable-model-invocation: true
---
Fix GitHub issue $ARGUMENTS following our coding standards.
```
`/fix-issue 123` → "Fix GitHub issue 123 ...".

**Positional example** (`migrate-component`):
```yaml
---
name: migrate-component
description: Migrate a component from one framework to another
---
Migrate the $0 component from $1 to $2.
```
`/migrate-component SearchBar React Vue` → `$0`=SearchBar, `$1`=React, `$2`=Vue.

**Named-args example:**
```yaml
---
argument-hint: [issue-number] [priority]
arguments: [issue, priority]
description: Fix a GitHub issue
---
Fix issue #$issue with priority $priority.
```

---

## 6. Dynamic context: bash `!` and file `@`

- **Inline bash**: `` !`git diff HEAD` `` runs *before* Claude sees the content; output replaces the placeholder (preprocessing, not a tool call). Only recognized when `!` is at line start or after whitespace — `` KEY=!`cmd` `` is left literal.
- **Multi-line bash**: a fenced block opened with ```` ```! ````.
- Output is inserted as plain text and **not re-scanned** for further placeholders.
- Disable globally with `"disableSkillShellExecution": true` in settings (replaces each command with `[shell command execution disabled by policy]`; bundled/managed skills unaffected).
- Deep reasoning: include `ultrathink` anywhere in the body.

Complete skill using injection + fork:
```yaml
---
name: pr-summary
description: Summarize changes in a pull request
context: fork
agent: Explore
allowed-tools: Bash(gh *)
---
## Pull request context
- PR diff: !`gh pr diff`
- Changed files: !`gh pr diff --name-only`

## Your task
Summarize this pull request...
```

---

## 7. Controlling who invokes

| Frontmatter | You invoke | Claude invokes |
| :-- | :-- | :-- |
| (default) | Yes | Yes |
| `disable-model-invocation: true` | Yes | No (description not in context) |
| `user-invocable: false` | No | Yes |

Permission rules (in `/permissions`): `Skill(commit)` exact match, `Skill(review-pr *)` prefix match, deny all with bare `Skill`. `user-invocable` controls menu visibility only — use `disable-model-invocation: true` to block programmatic invocation.

---

## 8. Plugin packaging quick facts

- Put commands in `<plugin>/skills/<name>/SKILL.md` (namespaced `/plugin:name`) or legacy `<plugin>/commands/<name>.md`.
- Adding `.claude-plugin/plugin.json` to a skill folder loads it as a plugin `<name>@skills-dir` that can also bundle agents, hooks, and MCP servers (requires workspace trust in a project's `.claude/skills/`).
- After editing plugin `hooks/`, `.mcp.json`, `agents/`, run `/reload-plugins`. SKILL.md text edits hot-reload within the session.

---

> **Verification:** WebFetch of code.claude.com/docs/en/slash-commands.md (now redirects to the "Extend Claude with skills" page) cross-checked against Context7 /websites/code_claude query-docs (agent-sdk/slash-commands + skills + plugins entries).
>
> **Confidence:** high
>
> **Discrepancies noted:** (1) IMPORTANT: positional args are 0-BASED. `$1` is the SECOND argument, not the first. The task brief's "$1/$2" framing is misleading — `$0`/`$ARGUMENTS[0]` is the first argument. The legacy Context7 example "Fix issue #$0 with priority $1" confirms 0-based. (2) The canonical URL slash-commands.md now serves the merged Skills page; standalone "slash commands" content survives only at the agent-sdk path (code.claude.com/docs/en/agent-sdk/slash-commands) for the legacy `.claude/commands/` format. Both agree on field names. (3) `.claude/commands/<name>.md` files still work and use the same frontmatter, but Anthropic now recommends skills.
>
> **Sources fetched:**
> - https://code.claude.com/docs/en/slash-commands.md
> - https://code.claude.com/docs/en/skills
> - https://code.claude.com/docs/en/agent-sdk/slash-commands
> - https://code.claude.com/docs/en/plugins
> - https://code.claude.com/docs/en/commands
