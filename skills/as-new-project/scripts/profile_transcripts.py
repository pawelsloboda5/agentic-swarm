#!/usr/bin/env python3
"""
profile_transcripts.py -- 100% LOCAL profiler over Claude Code session transcripts.

WHAT IT DOES (and, just as importantly, what it does NOT do)
------------------------------------------------------------
Walks `~/.claude/projects/**/*.jsonl` (the on-disk session transcripts; layout + per-line schema
documented in docs/claude-code/session-transcripts.md) and aggregates SIGNALS ONLY:
  - counts of projects / sessions / subagent transcripts / events
  - event-type counts, model-name counts, tool-name counts
  - a file-extension histogram inferred from tool-input file_path fields (Read/Edit/Write/...),
    NOT from message bodies
  - activity by hour-of-day and weekday, first/last activity timestamps
  - aggregate token usage (sums of usage counters) and CLI versions seen
  - per-project session/event counts with the project slug PATH-SCRUBBED to '~'

It NEVER copies message text, thinking blocks, tool inputs/outputs, prompts, or any raw content
into the output. Only structural facts (types, names, counts, extensions, timestamps) are kept,
and every string is passed through redact.scrub_text() before it is written. There are NO network
calls of any kind in this file.

USAGE
-----
    python profile_transcripts.py [--out PATH] [--root DIR] [--include-subagents]

  --out   where to write the aggregated JSON (default: <tempdir>/agentic-swarm/transcript-signals.json)
  --root  transcripts root (default: $CLAUDE_CONFIG_DIR/projects or ~/.claude/projects)
  --include-subagents  also fold subagent/workflow transcripts into the event aggregates
                       (they are always COUNTED; this flag includes their events in the totals)

Prints an ASCII-only summary; exits 0 even when no transcripts are found.
"""
import argparse
import json
import os
import sys
import tempfile
from collections import Counter
from datetime import datetime, timezone

# Import the shared redactor whether run as a script or imported as a module.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import redact  # noqa: E402


# Tool names whose input carries a file path we want an EXTENSION from (never the path itself).
_PATH_INPUT_KEYS = ("file_path", "notebook_path", "path")
# Cap how many distinct project slugs we keep, so the output stays small and bounded.
_MAX_PROJECTS = 200


def default_root():
    cfg = os.environ.get("CLAUDE_CONFIG_DIR")
    if cfg:
        return os.path.join(cfg, "projects")
    return os.path.expanduser(os.path.join("~", ".claude", "projects"))


def iter_jsonl(root):
    """Yield (path, is_subagent) for every *.jsonl under root. Defensive against odd trees."""
    for dirpath, _dirnames, filenames in os.walk(root):
        is_sub = (os.sep + "subagents" + os.sep) in (dirpath + os.sep)
        for fn in filenames:
            if fn.endswith(".jsonl"):
                yield os.path.join(dirpath, fn), is_sub


def ext_of(path_str):
    """Return a lowercased file extension (with dot) or '' -- we keep ONLY the extension."""
    if not isinstance(path_str, str) or not path_str:
        return ""
    base = path_str.replace("\\", "/").rsplit("/", 1)[-1]
    dot = base.rfind(".")
    if dot <= 0 or dot == len(base) - 1:
        return ""  # no extension, or dotfile like ".env"
    return base[dot:].lower()


def project_slug_of(path, root):
    """The first path segment under root is the project-slug directory."""
    rel = os.path.relpath(path, root)
    parts = rel.replace("\\", "/").split("/")
    return parts[0] if parts else "<unknown>"


def parse_ts(ts):
    if not isinstance(ts, str):
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def aggregate(root, include_subagents):
    agg = {
        "total_events": 0,
        "event_types": Counter(),
        "models": Counter(),
        "tools": Counter(),
        "file_extensions": Counter(),
        "activity_by_hour": Counter(),     # "0".."23"
        "activity_by_weekday": Counter(),  # "Mon".."Sun"
        "permission_modes": Counter(),
        "session_modes": Counter(),
        "cli_versions": Counter(),
        "git_branches": Counter(),
        "tool_errors": 0,
        "tokens": Counter(),               # summed usage counters
    }
    per_project = {}   # slug -> {"sessions": int, "events": int}
    sessions = set()   # distinct non-subagent transcript files (by path)
    subagent_files = 0
    malformed_lines = 0
    first_ts = None
    last_ts = None
    weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    for path, is_sub in iter_jsonl(root):
        slug = project_slug_of(path, root)
        bucket = per_project.setdefault(slug, {"sessions": 0, "events": 0})
        if is_sub:
            subagent_files += 1
            if not include_subagents:
                # Counted, but its events are not folded into the totals.
                continue
        else:
            sessions.add(path)
            bucket["sessions"] += 1

        try:
            fh = open(path, encoding="utf-8")
        except (OSError, IOError):
            continue
        with fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    ev = json.loads(line)
                except json.JSONDecodeError:
                    malformed_lines += 1
                    continue
                if not isinstance(ev, dict):
                    continue

                agg["total_events"] += 1
                bucket["events"] += 1
                etype = ev.get("type")
                if isinstance(etype, str):
                    agg["event_types"][etype] += 1

                ver = ev.get("version")
                if isinstance(ver, str):
                    agg["cli_versions"][ver] += 1
                gb = ev.get("gitBranch")
                if isinstance(gb, str) and gb:
                    agg["git_branches"][gb] += 1
                pm = ev.get("permissionMode")
                if isinstance(pm, str):
                    agg["permission_modes"][pm] += 1
                md = ev.get("mode")
                if isinstance(md, str):
                    agg["session_modes"][md] += 1

                dt = parse_ts(ev.get("timestamp"))
                if dt:
                    agg["activity_by_hour"][str(dt.hour)] += 1
                    agg["activity_by_weekday"][weekdays[dt.weekday()]] += 1
                    if first_ts is None or dt < first_ts:
                        first_ts = dt
                    if last_ts is None or dt > last_ts:
                        last_ts = dt

                msg = ev.get("message")
                if isinstance(msg, dict):
                    model = msg.get("model")
                    if isinstance(model, str) and model:
                        agg["models"][model] += 1
                    usage = msg.get("usage")
                    if isinstance(usage, dict):
                        for k, v in usage.items():
                            if isinstance(v, (int, float)):
                                agg["tokens"][k] += int(v)
                    content = msg.get("content")
                    if isinstance(content, list):
                        for block in content:
                            if not isinstance(block, dict):
                                continue
                            btype = block.get("type")
                            if btype == "tool_use":
                                name = block.get("name")
                                if isinstance(name, str) and name:
                                    agg["tools"][name] += 1
                                inp = block.get("input")
                                if isinstance(inp, dict):
                                    for pk in _PATH_INPUT_KEYS:
                                        e = ext_of(inp.get(pk))
                                        if e:
                                            agg["file_extensions"][e] += 1
                            elif btype == "tool_result":
                                if block.get("is_error"):
                                    agg["tool_errors"] += 1

    return {
        "agg": agg,
        "per_project": per_project,
        "n_sessions": len(sessions),
        "n_subagent_files": subagent_files,
        "malformed_lines": malformed_lines,
        "first_ts": first_ts,
        "last_ts": last_ts,
    }


def build_output(root, data, include_subagents):
    agg = data["agg"]

    # Scrub + bound the per-project list; sort by events desc.
    projects = []
    for slug, b in data["per_project"].items():
        projects.append({
            "project": redact.scrub_text(slug),
            "sessions": b["sessions"],
            "events": b["events"],
        })
    projects.sort(key=lambda p: p["events"], reverse=True)
    projects = projects[:_MAX_PROJECTS]

    out = {
        "schema": "agentic-swarm/transcript-signals/v1",
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "privacy": (
            "AGGREGATE SIGNALS ONLY. No message text, prompts, thinking, tool inputs or outputs "
            "are included. Secrets redacted; home paths collapsed to '~'. 100% local; no network."
        ),
        "source_root": redact.scrub_text(root),
        "include_subagents": include_subagents,
        "counts": {
            "projects": len(data["per_project"]),
            "sessions": data["n_sessions"],
            "subagent_transcripts": data["n_subagent_files"],
            "events": agg["total_events"],
            "malformed_lines_skipped": data["malformed_lines"],
            "tool_result_errors": agg["tool_errors"],
        },
        "first_activity_utc": data["first_ts"].strftime("%Y-%m-%dT%H:%M:%SZ") if data["first_ts"] else None,
        "last_activity_utc": data["last_ts"].strftime("%Y-%m-%dT%H:%M:%SZ") if data["last_ts"] else None,
        "event_types": dict(agg["event_types"].most_common()),
        "models": dict(agg["models"].most_common()),
        "tools": dict(agg["tools"].most_common()),
        "file_extensions": dict(agg["file_extensions"].most_common()),
        "activity_by_hour": {str(h): agg["activity_by_hour"].get(str(h), 0) for h in range(24)},
        "activity_by_weekday": {
            d: agg["activity_by_weekday"].get(d, 0)
            for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        },
        "permission_modes": dict(agg["permission_modes"].most_common()),
        "session_modes": dict(agg["session_modes"].most_common()),
        "cli_versions": dict(agg["cli_versions"].most_common()),
        "token_usage_totals": dict(agg["tokens"]),
        "distinct_git_branches": len(agg["git_branches"]),
        "projects": projects,
    }
    # Belt-and-suspenders: scrub the WHOLE object once more before returning.
    return redact.scrub_obj(out)


def main():
    ap = argparse.ArgumentParser(description="Local, aggregate-only Claude Code transcript profiler")
    ap.add_argument("--out", default=None, help="output JSON path")
    ap.add_argument("--root", default=None, help="transcripts root (default: ~/.claude/projects)")
    ap.add_argument("--include-subagents", action="store_true",
                    help="fold subagent/workflow transcript events into the totals")
    args = ap.parse_args()

    root = args.root or default_root()
    out_path = args.out or os.path.join(tempfile.gettempdir(), "agentic-swarm", "transcript-signals.json")
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)

    if not os.path.isdir(root):
        empty = {
            "schema": "agentic-swarm/transcript-signals/v1",
            "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source_root": redact.scrub_text(root),
            "counts": {"projects": 0, "sessions": 0, "events": 0},
            "note": "No transcripts directory found. Nothing scanned.",
        }
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(empty, fh, ensure_ascii=False, indent=2)
        print("no transcripts directory found at the configured root -- wrote empty signals.")
        print("wrote " + out_path)
        sys.exit(0)

    data = aggregate(root, args.include_subagents)
    out = build_output(root, data, args.include_subagents)

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)

    # ---- ASCII-only summary (cp1252-safe) ----
    c = out["counts"]
    print("Claude Code transcript signals (LOCAL, aggregate-only):")
    print("  projects={p}  sessions={s}  subagent_transcripts={sa}  events={e}".format(
        p=c["projects"], s=c["sessions"], sa=c["subagent_transcripts"], e=c["events"]))
    print("  malformed_lines_skipped={m}  tool_result_errors={te}".format(
        m=c["malformed_lines_skipped"], te=c["tool_result_errors"]))
    if out["first_activity_utc"]:
        print("  activity: {a} .. {b}".format(a=out["first_activity_utc"], b=out["last_activity_utc"]))
    top_tools = list(out["tools"].items())[:8]
    if top_tools:
        print("  top tools: " + ", ".join("{0}={1}".format(k, v) for k, v in top_tools))
    top_ext = list(out["file_extensions"].items())[:8]
    if top_ext:
        print("  top file exts: " + ", ".join("{0}={1}".format(k, v) for k, v in top_ext))
    if out["models"]:
        print("  models: " + ", ".join("{0}={1}".format(k, v) for k, v in list(out["models"].items())[:6]))
    print("wrote " + out_path)
    sys.exit(0)


if __name__ == "__main__":
    main()
