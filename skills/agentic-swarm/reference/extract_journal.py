#!/usr/bin/env python3
"""
extract_journal.py -- pull the FULL result set out of a Workflow swarm's journal.jsonl.

Why this exists
---------------
The workflow `.output` file truncates at ~192 KB; a real swarm's results easily exceed that
(the origin run: 58 results summing to ~885 KB). The append-only `journal.jsonl` has every
agent's complete result, so we parse it instead. No `jq` dependency -- this is pure-stdlib
Python, so it runs the same on macOS, Linux, and Windows.

Journal schema (verified against a real swarm journal)
------------------------------------------------------
One file per runId at `~/.claude/projects/<project-slug>/<session-id>/subagents/workflows/<runId>/journal.jsonl`,
appended across EVERY resume (so "union across runs" is just dedup within this one file). Each
line is one event:
    {"type": "started", "key": "v2:<hash>", "agentId": "<id>"}
    {"type": "result",  "key": "v2:<hash>", "agentId": "<id>", "result": { ...schema object... }}
The `result` payload self-identifies via its schema fields (e.g. result["subarea"]), so you do
not need the agent label.

`started_keys - result_keys` is an UPPER BOUND on hung work, not an exact count
-------------------------------------------------------------------------------
A result-less key means "an agent that did not return on THAT node." But an in-script retry
re-calls `agent()` as a NEW node with a NEW cache key (proven live) -- so when a retry wave
recovers an item, the FIRST (failed) node's key stays in `started - result` even though the
work IS done. So that diff also counts RECOVERED-BY-RETRY agents, not strictly unrecovered work.
The AUTHORITATIVE coverage check is to dedupe the deliverable by its own CONTENT key (e.g.
result["key"] / result["subarea"]) and diff that against your PLANNED item list -- use
`--group-by <content-field>` below and compare the printed groups to the items you planned.
(Origin run: 61 started, 58 resulted => 3 truly hung, because no retry wave had run yet.)

Usage
-----
    # auto-locate by runId (globs the standard Claude projects path; cross-platform via expanduser):
    python extract_journal.py --run wf_<id> --out merged.json

    # or point at one or more journals explicitly (multiple = union them):
    python extract_journal.py --journal A/journal.jsonl --journal B/journal.jsonl --out merged.json

    # coverage check: group the merged results by a self-id field in each result payload, then
    # diff the groups against your planned item list:
    python extract_journal.py --run wf_<id> --group-by subarea --out merged.json

Output
------
- Writes the merged, de-duplicated results to --out as UTF-8 JSON (safe regardless of console encoding).
- Prints an ASCII-only summary: result count, result-less-node count, and per-group coverage
  (ASCII-only so it never trips a cp1252 Windows console).
- Exit code 0 if every started key produced a result; 2 if any are still result-less (useful in a
  resume gate: non-zero => there may be work to resume -- corroborate with the coverage check above).
"""
import argparse
import glob
import json
import os
import sys


def find_journals(run_id):
    """Glob the standard Claude projects location for a runId's journal(s). Cross-platform."""
    patterns = [
        # ~/.claude/projects/<project-slug>/<session-id>/subagents/workflows/<run>/journal.jsonl
        os.path.expanduser(os.path.join("~", ".claude", "projects", "*", "*",
                                        "subagents", "workflows", run_id, "journal.jsonl")),
        # be liberal about depth in case the layout shifts:
        os.path.expanduser(os.path.join("~", ".claude", "projects", "**",
                                        "subagents", "workflows", run_id, "journal.jsonl")),
    ]
    hits = []
    for p in patterns:
        hits.extend(glob.glob(p, recursive=True))
    return sorted(set(hits))


def parse_journals(paths):
    """Return (results_by_key, started_keys). Dedup by key; a later result wins."""
    started = set()
    results = {}            # key -> result payload (last result event for that key wins)
    bad_lines = 0
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    o = json.loads(line)
                except json.JSONDecodeError:
                    bad_lines += 1
                    continue
                t = o.get("type")
                key = o.get("key")
                if t == "started":
                    started.add(key)
                elif t == "result":
                    started.add(key)            # a result implies it started
                    results[key] = o.get("result")
    return results, started, bad_lines


def main():
    ap = argparse.ArgumentParser(description="Extract merged results from Workflow journal.jsonl")
    ap.add_argument("--run", help="runId (e.g. wf_<id>); auto-globs the journal")
    ap.add_argument("--journal", action="append", default=[],
                    help="explicit journal.jsonl path (repeatable; multiple = union)")
    ap.add_argument("--out", help="write merged results here as UTF-8 JSON")
    ap.add_argument("--group-by", help="a field present in each result payload to group/count by (e.g. subarea); "
                                       "this is your coverage check -- diff the groups vs your planned items")
    args = ap.parse_args()

    paths = list(args.journal)
    if args.run:
        found = find_journals(args.run)
        if not found:
            print(f"NO_JOURNAL found for run={args.run}. Pass --journal <path> explicitly.")
            sys.exit(1)
        paths.extend(found)
    if not paths:
        print("Provide --run <id> or one or more --journal <path>.")
        sys.exit(1)

    results, started, bad = parse_journals(paths)
    # Upper bound on hung work: a result-less key may be a node a later retry already recovered
    # under a different key (see the module docstring). Use --group-by for the authoritative check.
    unreturned = sorted(started - results.keys())

    merged = list(results.values())
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(merged, fh, ensure_ascii=False, indent=2)

    # ---- ASCII-only summary (safe on a cp1252 Windows console) ----
    print(f"journals_parsed={len(paths)}")
    print(f"results={len(results)}  started={len(started)}  unreturned_nodes={len(unreturned)}  bad_lines={bad}")
    if args.group_by:
        groups = {}
        for r in merged:
            g = (r or {}).get(args.group_by, "<missing>")
            groups[g] = groups.get(g, 0) + 1
        print(f"by[{args.group_by}]: ({len(groups)} distinct -> diff vs your planned item list)")
        for g in sorted(groups, key=lambda k: str(k)):
            print(f"  {g}: {groups[g]}")
    if unreturned:
        print("UNRETURNED node keys (started, no result on that node -> upper bound; some may be retry-recovered):")
        for k in unreturned:
            print(f"  {k}")
    if args.out:
        print(f"wrote {len(merged)} results -> {args.out}")

    # Non-zero exit when nodes are unreturned, so this doubles as a resume gate (corroborate with --group-by).
    sys.exit(2 if unreturned else 0)


if __name__ == "__main__":
    main()
