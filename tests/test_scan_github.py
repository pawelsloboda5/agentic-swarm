"""Tests for the OPT-IN GitHub metadata scanner (scan_github.py).

Contract (docs/PRIVACY.md): the ONLY script that touches the network, and only
via the user's own `gh` CLI in a read-only listing. It sends nothing about the
user; it drops repo NAMES and keeps only language/topic/recency aggregates. If
`gh` is missing / unauthenticated / fails, it writes a "skipped" file and exits 0.

All tests here are hermetic: aggregate() is pure (fed synthetic metadata), and the
skip paths are exercised by monkeypatching the gh probes — no network is ever hit.
"""
import inspect
import json
import sys

import pytest

import scan_github as sg


def test_aggregate_drops_repo_names_keeps_signals():
    repos = [
        {"name": "SECRETREPONAME_ALPHA", "primaryLanguage": {"name": "Python"},
         "isPrivate": True, "repositoryTopics": [{"name": "ml"}, {"name": "cli"}],
         "updatedAt": "2000-01-01T00:00:00Z"},
        {"name": "SECRETREPONAME_BETA", "primaryLanguage": {"name": "JavaScript"},
         "isPrivate": False, "repositoryTopics": ["nextjs"],
         "updatedAt": "2000-01-01T00:00:00Z"},
    ]
    out = sg.aggregate(repos)
    blob = json.dumps(out)
    assert "SECRETREPONAME_ALPHA" not in blob
    assert "SECRETREPONAME_BETA" not in blob
    assert out["repos_seen"] == 2
    assert out["private"] == 1
    assert out["public"] == 1
    assert out["languages"].get("Python") == 1
    assert out["languages"].get("JavaScript") == 1
    assert out["topics"].get("ml") == 1
    assert out["topics"].get("cli") == 1
    assert out["topics"].get("nextjs") == 1
    assert out["recency"].get(">1y") == 2


def test_aggregate_is_robust_to_malformed_entries():
    out = sg.aggregate(["not a dict", {}, {"primaryLanguage": "notadict", "updatedAt": "bad"}])
    assert out["repos_seen"] == 3            # counts the raw list length
    assert out["recency"].get("unknown", 0) >= 1


def _run_main(monkeypatch, tmp_path, extra=()):
    out_file = tmp_path / "gh.json"
    monkeypatch.setattr(sys, "argv", ["scan_github.py", "--out", str(out_file)] + list(extra))
    with pytest.raises(SystemExit) as ei:
        sg.main()
    assert ei.value.code == 0
    return json.loads(out_file.read_text(encoding="utf-8"))


def test_skip_when_gh_missing_exits_zero(monkeypatch, tmp_path):
    monkeypatch.setattr(sg, "gh_available", lambda: False)
    data = _run_main(monkeypatch, tmp_path)
    assert data["skipped"] is True
    assert "install" in data["reason"].lower()


def test_skip_when_not_authenticated_exits_zero(monkeypatch, tmp_path):
    monkeypatch.setattr(sg, "gh_available", lambda: True)
    monkeypatch.setattr(sg, "gh_authenticated", lambda: False)
    data = _run_main(monkeypatch, tmp_path)
    assert data["skipped"] is True
    assert "auth" in data["reason"].lower()


def test_skip_when_list_fails_exits_zero(monkeypatch, tmp_path):
    monkeypatch.setattr(sg, "gh_available", lambda: True)
    monkeypatch.setattr(sg, "gh_authenticated", lambda: True)
    monkeypatch.setattr(sg, "fetch_repos", lambda limit: None)
    data = _run_main(monkeypatch, tmp_path)
    assert data["skipped"] is True


def test_network_only_via_gh_cli():
    src = inspect.getsource(sg)
    for banned in ("import urllib", "import requests", "import http.client",
                   "urlopen", "import socket"):
        assert banned not in src, "unexpected direct-network usage: " + banned
    assert "subprocess" in src  # the gh CLI is the only network path
