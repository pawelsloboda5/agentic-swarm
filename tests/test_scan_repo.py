"""Tests for the local repo scanner (scan_repo.py).

Contract (docs/PRIVACY.md): a 100% local scan, NO network, NO `git` subprocess —
the remote is read straight from .git/config. It emits dependency NAMES only
(never version values), language/framework signals, and a credential-stripped
git remote. Everything is redacted before write.
"""
import inspect
import json
import os

import scan_repo as sr

_F = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def _make_repo(root):
    os.makedirs(os.path.join(root, ".claude", "skills"), exist_ok=True)
    os.makedirs(os.path.join(root, "src"), exist_ok=True)
    with open(os.path.join(root, "package.json"), "w", encoding="utf-8") as fh:
        json.dump({
            "name": "demo",
            "dependencies": {"next": "VERSIONVALUE_A", "react": "VERSIONVALUE_B"},
            "devDependencies": {"vitest": "VERSIONVALUE_C"},
        }, fh)
    with open(os.path.join(root, "requirements.txt"), "w", encoding="utf-8") as fh:
        fh.write("django==4.2.0\nrequests>=2.0  # http client\n-e .\n# a comment\nfastapi\n")
    with open(os.path.join(root, "README.md"), "w", encoding="utf-8") as fh:
        fh.write("# demo\n")
    with open(os.path.join(root, "src", "main.py"), "w", encoding="utf-8") as fh:
        fh.write("print(1)\n")
    with open(os.path.join(root, "src", "app.ts"), "w", encoding="utf-8") as fh:
        fh.write("export const x = 1\n")


def test_scan_emits_names_not_versions(tmp_path):
    root = str(tmp_path / "repo")
    os.makedirs(root)
    _make_repo(root)
    out = sr.scan(root)
    blob = json.dumps(out)

    assert "next" in out["dependency_sample"]["js"]
    assert "react" in out["dependency_sample"]["js"]
    assert "django" in out["dependency_sample"]["py"]
    assert "fastapi" in out["dependency_sample"]["py"]
    # version VALUES must never appear
    for v in ("VERSIONVALUE_A", "VERSIONVALUE_B", "VERSIONVALUE_C"):
        assert v not in blob


def test_scan_detects_frameworks_and_structure(tmp_path):
    root = str(tmp_path / "repo")
    os.makedirs(root)
    _make_repo(root)
    out = sr.scan(root)
    for fw in ("Next.js", "React", "Django", "FastAPI"):
        assert fw in out["frameworks"], "missing framework: " + fw
    assert ".py" in out["file_extensions"]
    assert ".ts" in out["file_extensions"]
    assert out["has_readme"] is True
    assert out["has_claude_skills"] is True
    assert out["total_files_scanned"] >= 4
    assert "Python" in out["languages"]
    assert "JavaScript/TypeScript" in out["languages"]


def test_git_remote_strips_embedded_credentials(tmp_path):
    root = str(tmp_path / "repo2")
    os.makedirs(os.path.join(root, ".git"))
    cfg = (
        "[core]\n"
        '[remote "origin"]\n'
        "\turl = https://x-token:CREDENTIALSECRET@github.com/alice/myrepo.git\n"
        "\tfetch = +refs/heads/*:refs/remotes/origin/*\n"
    )
    with open(os.path.join(root, ".git", "config"), "w", encoding="utf-8") as fh:
        fh.write(cfg)
    gr = sr.read_git_remote(root)
    assert gr["host"] == "github.com"
    assert gr["owner"] == "alice"
    assert gr["repo"] == "myrepo"
    assert "CREDENTIALSECRET" not in json.dumps(gr)


def test_git_remote_ssh_form(tmp_path):
    root = str(tmp_path / "repo3")
    os.makedirs(os.path.join(root, ".git"))
    with open(os.path.join(root, ".git", "config"), "w", encoding="utf-8") as fh:
        fh.write('[remote "origin"]\n\turl = git@github.com:bob/proj.git\n')
    assert sr.read_git_remote(root) == {"host": "github.com", "owner": "bob", "repo": "proj"}


def test_git_remote_absent_returns_none(tmp_path):
    root = str(tmp_path / "repo4")
    os.makedirs(root)
    assert sr.read_git_remote(root) is None


def test_scan_repo_does_not_import_network_or_git_subprocess():
    # Match real imports/calls, not the word "subprocess" in the module docstring.
    src = inspect.getsource(sr)
    for banned in ("import socket", "import urllib", "import requests",
                   "import http", "urlopen", "import subprocess",
                   "subprocess.run", "subprocess.Popen", "import ssl"):
        assert banned not in src, "scan_repo must stay network-free, found: " + banned
