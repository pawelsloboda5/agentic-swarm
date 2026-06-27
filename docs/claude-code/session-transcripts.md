> One-liner: Claude Code writes every session as a JSONL transcript at `~/.claude/projects/<project-slug>/<session-id>.jsonl` (one JSON event per line) — the raw source a local profiler reads for prompts, model, tokens, tool calls, timestamps, cwd, and git branch.
>
> **Source of truth:** https://code.claude.com/docs/en/data-usage.md (retention + path), https://code.claude.com/docs/en/sessions ("Export and locate session data"), https://code.claude.com/docs/en/claude-directory (plaintext storage). The **per-line event schema is NOT in the docs** — it is reverse-engineered from a real transcript and noted as such below.

## 1. On-disk layout (official, verified)

```
~/.claude/                                  # config root (override: $CLAUDE_CONFIG_DIR)
└── projects/
    └── <project-slug>/                     # one dir per working directory
        ├── <session-id>.jsonl              # the session transcript (UUID filename)
        ├── <session-id>.jsonl              # ... one file per session in that cwd
        ├── memory/                         # auto-memory (MEMORY.md, topic .md) — NOT transcripts
        └── <session-id>/                   # sidecar dir for a session's child agents
            └── subagents/
                ├── agent-<hex-id>.jsonl    # one transcript per subagent
                └── workflows/wf_<id>/
                    ├── agent-<hex-id>.jsonl
                    └── journal.jsonl       # workflow orchestration journal
```

- **`<project-slug>`** = the absolute cwd with path separators (and `:`) replaced by `-`. Real example on Windows: cwd `C:\Users\Pawel Sloboda\Desktop\secu-spark-frontend` → slug `C--Users-Pawel-Sloboda-Desktop-secu-spark-frontend`. (Docs phrase it as "the project derived from the working directory path" / "`<encoded-cwd>`".) The slug is also written into each event as a `slug` field.
- **`<session-id>`** = a UUID; the filename stem equals the `sessionId` value inside every line of that file (real example: `c225d2f6-75ba-477a-aedf-4edd0dfe877d.jsonl`).
- **Resume gotcha (Agent SDK docs):** resume keys off `<encoded-cwd>`; a mismatched cwd makes a resume create a *fresh* session instead of loading history.
- **Format:** JSONL — newline-delimited JSON, one event object per line, appended in chronological order. Plaintext, **not encrypted at rest** (relies on OS file permissions).

## 2. Retention & relevant settings (official)

| Concern | Value |
|---|---|
| Default retention | **30 days**, then auto-deleted |
| Adjust retention | `cleanupPeriodDays` in `settings.json` |
| Relocate the whole tree | `CLAUDE_CONFIG_DIR` env var (→ `$CLAUDE_CONFIG_DIR/projects/...`) |
| Skip writing transcripts/prompt history | `CLAUDE_CODE_SKIP_PROMPT_HISTORY` env var |
| Upload for feedback | `/feedback` (current session default) sends a copy; the transcript-share survey uploads "the raw session log file from disk" |

A profiler should treat files as **append-only and ephemeral** (rotated out at `cleanupPeriodDays`); read incrementally and tolerate truncated final lines while a session is live.

## 3. Per-line event schema (EMPIRICAL — docs are thin here)

Derived by parsing one real 965-line transcript (field names only, no message content). Each line is a JSON object with a `type` discriminator.

**`type` values observed (with rough frequency in a 965-line file):**

| `type` | What it is | Profiler use |
|---|---|---|
| `assistant` | a model turn (369) | model, tokens, tool_use, thinking, text |
| `user` | a user/tool-result turn (221) | prompts + tool_result blocks |
| `attachment` | injected context, e.g. hook output (146) | hook events, files |
| `last-prompt` | pointer to the latest prompt (`leafUuid`) (47) | — |
| `mode` / `permission-mode` | session mode + permission mode (47/47) | `mode`, `permissionMode` |
| `ai-title` | auto-generated session title (`aiTitle`) (46) | label sessions |
| `file-history-snapshot` | checkpoint of tracked file backups (25) | rewind/checkpoint |
| `system` | system notices, retries (7) | `subtype`, `level`, `error` |
| `pr-link` | linked PR (`prNumber`,`prUrl`,`prRepository`) (6) | — |
| `queue-operation` | queued-prompt ops (4) | — |

**Common top-level keys (present on most `user`/`assistant` events):**
`type`, `sessionId`, `uuid`, `parentUuid` (links events into a DAG; `null` at roots), `timestamp` (ISO-8601 UTC, e.g. `2026-05-27T10:06:51.351Z`), `cwd`, `gitBranch`, `version` (CLI version, e.g. `2.1.152`), `slug`, `userType` (`external`), `entrypoint` (`cli`), `isSidechain` (subagent flag), `message`, plus `requestId`, `promptId`, `toolUseResult`, `sourceToolAssistantUUID`, `isMeta`.

**`assistant` line — `message` object keys:**
`role` (`"assistant"`), `id`, `type`, `model`, `content`, `usage`, `stop_reason`, `stop_details`, `stop_sequence`, `diagnostics`.
- `model` real value: `"claude-opus-4-7"`.
- `usage` keys: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `service_tier`, `server_tool_use`, plus extras (`cache_creation`, `inference_geo`, `iterations`, `speed`). → token accounting + cache-hit ratio.

**`message.content` block types** (assistant & user content is either a `str` or a `list` of blocks):
`text`, `thinking` (extended-thinking blocks), `tool_use`, `tool_result`.
- `tool_use` block keys: `id`, `name`, `input`, `type`, `caller`.
- `tool_result` block keys: `tool_use_id`, `content`, `is_error`, `type`.

## 4. Concrete real line shapes (field names only — content elided)

Session-start / mode lines (first lines of a file):
```json
{"type":"last-prompt","leafUuid":"<uuid>","sessionId":"<session-id>"}
{"type":"permission-mode","permissionMode":"bypassPermissions","sessionId":"<session-id>"}
```

A user prompt line (skeleton):
```json
{"parentUuid":null,"isSidechain":false,"promptId":"<uuid>","type":"user",
 "message":{"role":"user","content":"<text or [blocks]>"},
 "uuid":"<uuid>","timestamp":"2026-05-27T10:06:53.575Z","cwd":"C:\\Users\\...\\secu-spark-frontend",
 "sessionId":"<session-id>","version":"2.1.152","gitBranch":"master","slug":"C--Users-...-secu-spark-frontend"}
```

An assistant line (skeleton):
```json
{"parentUuid":"<uuid>","type":"assistant","requestId":"<id>",
 "message":{"role":"assistant","id":"msg_...","model":"claude-opus-4-7",
   "content":[{"type":"thinking", ...},{"type":"text", ...},{"type":"tool_use","id":"toolu_...","name":"Read","input":{...},"caller":...}],
   "usage":{"input_tokens":N,"output_tokens":N,"cache_read_input_tokens":N,"service_tier":"..."},
   "stop_reason":"tool_use"},
 "uuid":"<uuid>","timestamp":"...","cwd":"...","sessionId":"<session-id>","gitBranch":"master"}
```

A tool-result is carried on the *next* `user` line as a `tool_result` block (`tool_use_id` links back to the `tool_use.id`), with the structured result mirrored in the top-level `toolUseResult` field.

## 5. Minimal profiler recipe

```python
import json, glob, os
root = os.path.expandvars(r"%USERPROFILE%\.claude\projects")  # or $CLAUDE_CONFIG_DIR/projects
for path in glob.glob(os.path.join(root, "**", "*.jsonl"), recursive=True):
    if os.sep + "subagents" + os.sep in path:   # skip child agents unless wanted
        continue
    with open(path, encoding="utf-8") as fh:     # ALWAYS utf-8
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                ev = json.loads(line)             # tolerate a truncated final line on live sessions
            except json.JSONDecodeError:
                continue
            t = ev.get("type")
            if t == "assistant":
                m = ev.get("message", {})
                u = m.get("usage", {})
                # m["model"], u["input_tokens"], u["output_tokens"], u.get("cache_read_input_tokens")
                # ev["timestamp"], ev["cwd"], ev["gitBranch"], ev["sessionId"], ev["version"]
            elif t == "user":
                pass  # ev["message"]["content"] -> prompt text or tool_result blocks
```

**Identity for a profiler:** `(slug, sessionId)` uniquely names a session; `parentUuid → uuid` reconstructs the turn DAG; `timestamp` deltas give latency; `usage` gives cost; `gitBranch`/`cwd`/`version` give per-session context. Field names are stable enough to profile but **undocumented** — guard every `.get()` and pin/inspect against the CLI `version` field, since the schema can change between releases.

---

> **Verification:** WebFetch of data-usage.md + interactive-mode.md + claude-directory; cross-checked against Context7 /websites/code_claude (cites /en/sessions, /en/data-usage, /en/claude-directory); per-line schema empirically derived by parsing a real 965-line .jsonl with Python (utf-8), field names only.
>
> **Confidence:** high
>
> **Discrepancies noted:** Official docs are THIN on the per-line JSONL event schema: they specify the file LOCATION/format/retention precisely but do NOT document the per-line fields. The full event schema below (top-level keys, type values, content-block shapes) is derived from empirical inspection of a real transcript, not from docs, and is therefore unversioned/unstable. Minor: the claude-directory "explorer" describes ~/.claude/projects/ primarily as auto-memory, while data-usage.md and the /sessions page authoritatively state the same projects/ tree holds session transcript .jsonl files; both coexist (memory/ subdir + <session-id>.jsonl files live side by side).
>
> **Sources fetched:**
> - https://code.claude.com/docs/en/data-usage.md
> - https://code.claude.com/docs/en/interactive-mode.md
> - https://code.claude.com/docs/en/claude-directory
> - https://code.claude.com/docs/en/sessions
> - https://code.claude.com/docs/en/agent-sdk/sessions
