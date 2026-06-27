**One-line summary:** A Skill is a `SKILL.md` file (plus optional supporting files) whose YAML frontmatter tells Claude when to load it; in a plugin it lives at `<plugin>/skills/<name>/SKILL.md` and is invoked as `/<plugin>:<name>`. Skills use progressive disclosure (description always in context, body loads on invoke) and support `$ARGUMENTS` substitution.

**Source of truth:** https://code.claude.com/docs/en/skills.md (Claude Code official docs). Skills follow the open [Agent Skills](https://agentskills.io) standard; Claude Code adds invocation control, subagent execution (`context: fork`), and dynamic context injection.

---

## 1. Anatomy & locations

Every skill is a **directory** with `SKILL.md` as the required entrypoint:

```text
my-skill/
├── SKILL.md           # required: YAML frontmatter + markdown body
├── reference.md       # optional: loaded only when SKILL.md points Claude to it
├── examples/sample.md # optional
└── scripts/helper.py  # optional: executed, not loaded into context
```

Where it lives decides who can use it:

| Location | Path | Applies to |
| :-- | :-- | :-- |
| Personal | `~/.claude/skills/<name>/SKILL.md` | all your projects |
| Project | `.claude/skills/<name>/SKILL.md` | this project (commit to share) |
| **Plugin** | `<plugin>/skills/<name>/SKILL.md` | where the plugin is enabled |

Precedence when names clash: enterprise > personal > project, and any of these overrides a bundled skill of the same name. **Plugin skills are namespaced (`plugin-name:skill-name`) so they never conflict** with other levels. Custom commands have merged into skills: `.claude/commands/deploy.md` and `.claude/skills/deploy/SKILL.md` both create `/deploy`; if both exist the skill wins.

## 2. Plugin discovery & namespacing (the key plugin-builder facts)

Put skills in a `skills/` directory at your plugin root. Command name = **skill directory name, namespaced by the plugin**:

```text
my-plugin/skills/review/SKILL.md   →  /my-plugin:review
```

The frontmatter `name` field sets only the **display label** in listings — it does **not** change what you type after `/` for a directory-based skill. The one exception: a **plugin-root `SKILL.md`** (no `skills/` subdir) takes its command name from frontmatter `name`, falling back to the plugin directory name:

```text
my-plugin/SKILL.md  with  name: review   →  /my-plugin:review
```

A standalone skill folder containing `.claude-plugin/plugin.json` loads as a plugin named `<name>@skills-dir` and can then bundle agents, hooks, and MCP servers. Plugin skills are **not** affected by the `skillOverrides` setting — manage them via `/plugin`. After editing a plugin's `hooks/`, `.mcp.json`, `agents/`, or `output-styles/`, run `/reload-plugins` (SKILL.md text itself hot-reloads).

## 3. Frontmatter reference (verified field names)

All fields optional; only `description` is recommended. Minimal real example:

```yaml
---
name: my-skill
description: What this skill does
disable-model-invocation: true
allowed-tools: Read Grep
---

Your skill instructions here...
```

| Field | Meaning / default |
| :-- | :-- |
| `name` | Display name in listings. Defaults to directory name. (Sets command name only for a plugin-root SKILL.md.) |
| `description` | What it does + when to use it — Claude matches on this. If omitted, uses first paragraph of the body. `description` + `when_to_use` combined are capped at **1,536 chars** in the listing; put the key use case first. |
| `when_to_use` | Extra trigger phrases / example requests, appended to `description` (counts toward the 1,536 cap). |
| `argument-hint` | Autocomplete hint, e.g. `[issue-number]` or `[filename] [format]`. |
| `arguments` | Named positional args for `$name` substitution. Space-separated string or YAML list; names map to positions in order. |
| `disable-model-invocation` | `true` → only the user can invoke (via `/name`); Claude won't auto-load and it won't preload into subagents. Default `false`. |
| `user-invocable` | `false` → hidden from the `/` menu; only Claude invokes. Default `true`. |
| `allowed-tools` | Tools pre-approved (no permission prompt) while skill is active. Space/comma string or YAML list. Does NOT restrict the pool. |
| `disallowed-tools` | Tools removed from the pool while active; clears on your next message. |
| `model` | Model override for the rest of the turn (or `inherit`). |
| `effort` | `low`/`medium`/`high`/`xhigh`/`max` for this skill. |
| `context` | `fork` → run in a forked subagent context. |
| `agent` | Which subagent type when `context: fork` (`Explore`, `Plan`, `general-purpose`, or a `.claude/agents/` custom agent). Default `general-purpose`. **Note: the field is `agent`, NOT `subagent`.** |
| `hooks` | Hooks scoped to this skill's lifecycle. |
| `paths` | Glob patterns limiting auto-activation to matching files. Comma string or YAML list. |
| `shell` | `bash` (default) or `powershell` for `` !`cmd` `` blocks. |

> There is **no `tags` field and no `subagent` field** — those are not part of the spec.

## 4. Model-invocation vs user-only (progressive disclosure)

By default both you (`/skill-name`) and Claude (auto-load) can invoke. Two fields gate this:

| Frontmatter | You invoke | Claude invokes | When loaded into context |
| :-- | :-- | :-- | :-- |
| (default) | Yes | Yes | Description always in context; **full body loads only on invoke** |
| `disable-model-invocation: true` | Yes | No | Description **not** in context; body loads when you invoke |
| `user-invocable: false` | No | Yes | Description always in context; body loads on invoke |

Use `disable-model-invocation: true` for side-effecting workflows (`/commit`, `/deploy`). Use `user-invocable: false` for background knowledge Claude should know but users wouldn't run as a command. `user-invocable` controls **menu visibility only** — to truly block programmatic (Skill-tool) invocation, use `disable-model-invocation: true`. Permission rules also apply: `Skill(commit)` (exact) or `Skill(deploy *)` (prefix) in `/permissions`.

This progressive-disclosure model is why a skill is cheaper than CLAUDE.md: the body's tokens cost nothing until invoked. Once invoked, the rendered body enters the conversation as one message and **stays for the session** (not re-read), so write standing instructions, keep `SKILL.md` under ~500 lines, and move bulk reference into supporting files.

## 5. Supporting / reference files

Reference them from `SKILL.md` so Claude knows what they hold and when to load them:

```markdown
## Additional resources
- For complete API details, see [reference.md](reference.md)
- For usage examples, see [examples.md](examples.md)
```

These files load on demand (or, for scripts, are executed, never loaded). Use `${CLAUDE_SKILL_DIR}` to reference bundled files/scripts regardless of CWD — for a plugin skill this resolves to the **skill's subdirectory within the plugin**, not the plugin root:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/visualize.py .
```

## 6. `$ARGUMENTS` and string substitution

| Variable | Expands to |
| :-- | :-- |
| `$ARGUMENTS` | Full argument string as typed. If absent from the body, args are appended as `ARGUMENTS: <value>`. |
| `$ARGUMENTS[N]` / `$N` | Argument by 0-based index (`$0`, `$1`, …). Shell-style quoting: `/skill "hello world" b` → `$0`=`hello world`, `$1`=`b`. |
| `$name` | Named arg declared in `arguments:` frontmatter (maps by position). |
| `${CLAUDE_SESSION_ID}` | Current session ID. |
| `${CLAUDE_EFFORT}` | Current effort level. |
| `${CLAUDE_SKILL_DIR}` | Directory of this `SKILL.md`. |

Real example:

```yaml
---
name: fix-issue
description: Fix a GitHub issue
disable-model-invocation: true
---

Fix GitHub issue $ARGUMENTS following our coding standards.
1. Read the issue description
2. Implement the fix
3. Write tests and commit
```

`/fix-issue 123` → Claude receives "Fix GitHub issue 123 …". Escape a literal token with a backslash: `\$1.00`.

## 7. Dynamic context injection (preprocessing, not tool calls)

`` !`<command>` `` runs **before** Claude sees the content; output replaces the placeholder. Only recognized at line start or after whitespace (`KEY=!`cmd`` stays literal). Multi-line form uses a ` ```! ` fenced block. Disable globally with `"disableSkillShellExecution": true` in settings (bundled/managed skills exempt).

```yaml
---
name: pr-summary
description: Summarize changes in a pull request
context: fork
agent: Explore
allowed-tools: Bash(gh *)
---

## PR context
- Diff: !`gh pr diff`
- Comments: !`gh pr view --comments`

## Task
Summarize this pull request...
```

## 8. Subagent execution (`context: fork`)

`context: fork` runs the skill body as the prompt of an isolated subagent (no conversation history); `agent:` picks the executor. `agent: Explore`/`Plan` skip CLAUDE.md + git status for a lean context. Only meaningful for skills with an actual task, not pure reference guidelines.

## 9. Authoring gotchas

- Malformed YAML → body still loads but with **empty metadata** (so `/name` works but Claude has no `description` to match). Run `claude --debug` to see the parse error.
- "Triggers too often" → tighten `description` or add `disable-model-invocation: true`. "Won't trigger" → put natural keywords in `description`; confirm via "What skills are available?".
- Descriptions get truncated when you have many skills (budget = 1% of context window). Raise via `skillListingBudgetFraction` / `SLASH_COMMAND_TOOL_CHAR_BUDGET`; per-entry cap is `maxSkillDescriptionChars` (default 1,536). `/doctor` shows what's shortened.
- For project (and `.claude/skills/`-as-plugin) skills, `allowed-tools` takes effect only after accepting the **workspace trust dialog** — review skills before trusting a repo, since a skill can grant itself broad tool access.

---

> **Verification:** WebFetch of https://code.claude.com/docs/en/skills.md (full page) cross-checked against Context7 /websites/code_claude query-docs — frontmatter table, command-name table, and substitution table matched verbatim.
>
> **Confidence:** high
>
> **Discrepancies noted:** The task brief named two fields that DO NOT exist in the live docs: `subagent` (the real field is `agent`, used with `context: fork`) and `tags` (no such field; use `description` + `when_to_use` for discovery/matching). All other named fields (name, description, disable-model-invocation, allowed-tools) are real and verified. Reported here so the builder does not author a non-functional `subagent:`/`tags:` key.
>
> **Sources fetched:**
> - https://code.claude.com/docs/en/skills.md
> - https://code.claude.com/docs/en/skills
> - Context7: /websites/code_claude (Claude Code docs mirror)
