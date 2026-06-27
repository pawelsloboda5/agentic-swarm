"""Tests for the transcript profiler — and, above all, its PRIVACY GUARANTEE.

The headline contract (docs/PRIVACY.md): the aggregator reads your session
transcripts but writes ONLY structural signals — counts, type/name histograms,
file EXTENSIONS, timestamps. It must NEVER emit message text, thinking blocks,
prompts, tool inputs, or tool outputs. test_privacy_no_content_leaks pins that
down with sentinel content + a recursive forbidden-key scan, so a regression that
starts copying raw content fails loudly.
"""
import json
import os
import subprocess
import sys

import profile_transcripts as pt

_F = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
# Assembled secret (no literal token in source) planted inside message content.
FAKE_SECRET = "sk-" + "ant-api03-" + _F

# Unique sentinels planted in every content-bearing position. None may survive.
SENT_PROMPT = "SENTINEL__USER_PROMPT__zzz"
SENT_THINK = "SENTINEL__THINKING__zzz"
SENT_TOOLIN = "SENTINEL__TOOL_INPUT__zzz"
SENT_TOOLOUT = "SENTINEL__TOOL_OUTPUT__zzz"
SENT_EMAIL = "victim" + "@" + "example.com"

# Keys that would indicate raw content slipped into the output.
FORBIDDEN_KEYS = {
    "content", "text", "thinking", "message", "input", "output",
    "prompt", "tool_use", "tool_result", "old_string", "new_string",
    "signature", "citations", "summary", "toolUseResult", "command",
}


def _walk_keys(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            for kk in _walk_keys(v):
                yield kk
    elif isinstance(obj, list):
        for v in obj:
            for kk in _walk_keys(v):
                yield kk


def _write_rich_transcript(path):
    events = [
        {
            "type": "user", "timestamp": "2026-06-20T09:00:00Z",
            "version": "2.1.195", "gitBranch": "main",
            "permissionMode": "default", "mode": "interactive",
            "message": {"role": "user", "content": [
                {"type": "text",
                 "text": SENT_PROMPT + " my key is " + FAKE_SECRET + " email " + SENT_EMAIL},
            ]},
        },
        {
            "type": "assistant", "timestamp": "2026-06-20T14:30:00Z",
            "version": "2.1.195",
            "message": {"role": "assistant", "model": "claude-opus-4-8",
                        "usage": {"input_tokens": 100, "output_tokens": 50,
                                  "cache_read_input_tokens": 10},
                        "content": [
                            {"type": "thinking", "thinking": SENT_THINK,
                             "signature": "sig" + _F},
                            {"type": "text", "text": "editing " + SENT_PROMPT},
                            {"type": "tool_use", "name": "Edit", "input": {
                                "file_path": "/home/victim/app/main.py",
                                "old_string": SENT_TOOLIN,
                                "new_string": "new " + FAKE_SECRET}},
                            {"type": "tool_use", "name": "Bash", "input": {
                                "command": "echo " + SENT_TOOLIN}},
                        ]},
        },
        {
            "type": "user", "timestamp": "2026-06-21T10:00:00Z",
            "message": {"role": "user", "content": [
                {"type": "tool_result", "is_error": True, "content": SENT_TOOLOUT},
            ]},
        },
    ]
    with open(path, "w", encoding="utf-8") as fh:
        for ev in events:
            fh.write(json.dumps(ev) + "\n")
        fh.write("{ this is : not valid json }\n")       # malformed -> counted, skipped
        fh.write("\n")                                     # blank -> ignored
        fh.write(json.dumps("a bare string, not a dict") + "\n")  # non-dict -> ignored


def _profile(root, include_subagents=False):
    data = pt.aggregate(root, include_subagents)
    return pt.build_output(root, data, include_subagents)


def _seed_project(tmp_path):
    # Slug has no username segment, so any "victim" appearing in the output could
    # only have leaked from message content / a tool-input path / an email — which
    # is exactly what must NOT happen.
    proj = tmp_path / "projects" / "C--code-demoapp"
    proj.mkdir(parents=True)
    _write_rich_transcript(str(proj / "session1.jsonl"))
    return str(tmp_path / "projects")


def test_privacy_no_content_leaks(tmp_path):
    out = _profile(_seed_project(tmp_path))
    blob = json.dumps(out, ensure_ascii=False)

    # 1. No planted content / secret / email / path-username survives anywhere.
    for bad in (SENT_PROMPT, SENT_THINK, SENT_TOOLIN, SENT_TOOLOUT, FAKE_SECRET,
                SENT_EMAIL, "victim"):
        assert bad not in blob, "LEAKED: {0}".format(bad)

    # 2. No content-bearing key appears anywhere in the output structure.
    keys = set(_walk_keys(out))
    overlap = keys & FORBIDDEN_KEYS
    assert not overlap, "forbidden content keys present: {0}".format(overlap)

    # 3. The output advertises the aggregate-only guarantee.
    assert "aggregate" in out["privacy"].lower()


def test_positive_signals_are_captured(tmp_path):
    out = _profile(_seed_project(tmp_path))
    assert out["tools"].get("Edit") == 1
    assert out["tools"].get("Bash") == 1
    assert out["file_extensions"].get(".py") == 1      # extension only, never the path
    assert out["models"].get("claude-opus-4-8") == 1
    assert out["counts"]["sessions"] == 1
    assert out["counts"]["events"] == 3                # 3 valid dict events
    assert out["counts"]["malformed_lines_skipped"] == 1
    assert out["counts"]["tool_result_errors"] == 1
    assert out["token_usage_totals"]["input_tokens"] == 100
    assert out["token_usage_totals"]["output_tokens"] == 50
    assert out["permission_modes"].get("default") == 1
    assert out["session_modes"].get("interactive") == 1
    assert out["cli_versions"].get("2.1.195") == 2   # two events carry the version
    assert out["distinct_git_branches"] == 1
    assert out["first_activity_utc"] == "2026-06-20T09:00:00Z"
    assert out["last_activity_utc"] == "2026-06-21T10:00:00Z"
    # Cadence signals: events fall on 06-20 (x2) and 06-21 (x1) -> 2 distinct days over a 2-day span.
    assert out["distinct_active_days"] == 2
    assert out["activity_span_days"] == 2


def test_cadence_signals_span_and_distinct_days(tmp_path):
    # Three events on three calendar days spread across a two-week window: distinct=3, span=15.
    # density = 3/15 = sporadic -> the synthesizer should NOT recommend a recurring /loop.
    proj = tmp_path / "projects" / "slug"
    proj.mkdir(parents=True)
    events = [
        {"type": "user", "timestamp": "2026-01-01T08:00:00Z", "message": {"content": []}},
        {"type": "user", "timestamp": "2026-01-02T09:00:00Z", "message": {"content": []}},
        {"type": "user", "timestamp": "2026-01-15T23:30:00Z", "message": {"content": []}},
    ]
    with open(proj / "s.jsonl", "w", encoding="utf-8") as fh:
        for ev in events:
            fh.write(json.dumps(ev) + "\n")
    out = _profile(str(tmp_path / "projects"))
    assert out["distinct_active_days"] == 3
    assert out["activity_span_days"] == 15           # (2026-01-15 - 2026-01-01).days + 1
    assert out["first_activity_utc"] == "2026-01-01T08:00:00Z"
    assert out["last_activity_utc"] == "2026-01-15T23:30:00Z"


def test_cadence_signals_absent_without_timestamps(tmp_path):
    # No parseable timestamps -> cadence fields are 0 / None, never a crash.
    proj = tmp_path / "projects" / "slug"
    proj.mkdir(parents=True)
    with open(proj / "s.jsonl", "w", encoding="utf-8") as fh:
        fh.write(json.dumps({"type": "user", "message": {"content": []}}) + "\n")
    out = _profile(str(tmp_path / "projects"))
    assert out["distinct_active_days"] == 0
    assert out["activity_span_days"] is None


def test_malformed_only_transcript(tmp_path):
    proj = tmp_path / "projects" / "slug"
    proj.mkdir(parents=True)
    with open(proj / "s.jsonl", "w", encoding="utf-8") as fh:
        fh.write("not json at all\n")
        fh.write("{ still not json\n")
    out = _profile(str(tmp_path / "projects"))
    assert out["counts"]["events"] == 0
    assert out["counts"]["malformed_lines_skipped"] == 2


def test_subagent_transcripts_counted_but_not_folded(tmp_path):
    root = tmp_path / "projects"
    proj = root / "slug"
    sub = proj / "subagents"
    sub.mkdir(parents=True)
    with open(proj / "main.jsonl", "w", encoding="utf-8") as fh:
        fh.write(json.dumps({"type": "user", "message": {"content": []}}) + "\n")
    with open(sub / "agent.jsonl", "w", encoding="utf-8") as fh:
        fh.write(json.dumps({"type": "assistant", "message": {"content": []}}) + "\n")

    excl = _profile(str(root), include_subagents=False)
    assert excl["counts"]["subagent_transcripts"] == 1
    assert excl["counts"]["events"] == 1               # subagent events excluded

    incl = _profile(str(root), include_subagents=True)
    assert incl["counts"]["events"] == 2               # subagent events folded in


def test_cli_missing_root_exits_zero(tmp_path):
    out_file = tmp_path / "sig.json"
    missing = tmp_path / "nope"
    r = subprocess.run(
        [sys.executable, pt.__file__, "--root", str(missing), "--out", str(out_file)],
        capture_output=True, text=True,
    )
    assert r.returncode == 0
    data = json.loads(out_file.read_text(encoding="utf-8"))
    assert data["counts"]["events"] == 0
    assert "note" in data


def test_cli_end_to_end_writes_clean_file(tmp_path):
    root = _seed_project(tmp_path)
    out_file = tmp_path / "sig.json"
    r = subprocess.run(
        [sys.executable, pt.__file__, "--root", root, "--out", str(out_file)],
        capture_output=True, text=True,
    )
    assert r.returncode == 0
    blob = out_file.read_text(encoding="utf-8")
    for bad in (SENT_PROMPT, SENT_THINK, SENT_TOOLIN, SENT_TOOLOUT, FAKE_SECRET):
        assert bad not in blob
