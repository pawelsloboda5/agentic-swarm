"""Guard test: no COMPLETE secret-shaped literal may exist in tracked source.

Why this exists: this repo's redactor needs secret-SHAPED test inputs, and a
literal `ghp_...` token / `eyJ...` JWT in a committed file trips external secret
scanners (GitGuardian flagged commit 4dcae1e for exactly that — both were
placeholders, no real credential). The fix, and the standing convention, is to
ASSEMBLE secret shapes at runtime from fragments (see CONTRIBUTING.md). This test
fails CI if anyone reintroduces a literal token, so the false-positive can't recur.

Note: the patterns below are deliberately a touch stricter than redact.py's so
that regex *definitions* (which contain fragments like `ghp_`, `eyJ`) and runtime
assemblies (e.g. `"ghp" + "_" + filler`) do NOT match — only contiguous literals do.
"""
import os
import re
import subprocess

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SHAPE_PATTERNS = [
    re.compile(r"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}"),
    re.compile(r"sk-ant-[A-Za-z0-9._-]{16,}"),
    re.compile(r"\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA)[0-9A-Z]{16}\b"),
    re.compile(r"xox[baprs]-[A-Za-z0-9-]{16,}"),
    re.compile(r"AIza[0-9A-Za-z_-]{30,}"),
    re.compile(r"\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{20,}"),
    re.compile(r"npm_[A-Za-z0-9]{36,}"),
]


def _tracked_files():
    r = subprocess.run(
        ["git", "ls-files"], cwd=_REPO_ROOT, capture_output=True, text=True
    )
    return [f for f in r.stdout.splitlines() if f and not f.endswith(".pyc")]


def test_no_literal_secret_shapes_in_tracked_source():
    offenders = []
    for rel in _tracked_files():
        path = os.path.join(_REPO_ROOT, rel)
        try:
            text = open(path, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        for pat in SHAPE_PATTERNS:
            for m in pat.findall(text):
                offenders.append("{0}: {1}...".format(rel, m[:20]))
    assert not offenders, (
        "Literal secret-shaped strings found in tracked source. Assemble shapes at "
        "runtime instead (see CONTRIBUTING.md):\n  " + "\n  ".join(offenders)
    )
