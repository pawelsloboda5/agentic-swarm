#!/usr/bin/env python3
"""
scan_github.py -- OPT-IN, READ-ONLY aggregation of your GitHub repo *metadata* via the `gh` CLI.

This is the ONLY script in /as-new-project that touches the network, and it does so ONLY through
the official `gh` CLI in a read-only listing call:

    gh repo list --json name,primaryLanguage,description,isPrivate,repositoryTopics,updatedAt --limit 100

It READS metadata about repos you already own/can see. It NEVER sends any local data out -- it
passes no file contents, no transcript data, no profile to GitHub; it only issues the list query
above and aggregates the response locally. If `gh` is missing or not authenticated, it prints a
clear "skipped" message and exits 0 (so the caller degrades gracefully).

Aggregates SIGNALS ONLY: language histogram, topic histogram, public/private counts, and recency
buckets. Repo names are NOT stored; descriptions are dropped (only mined for topic-like signal is
avoided to keep it lean). Every retained string is redacted.

USAGE
-----
    python scan_github.py [--out PATH] [--limit N]
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from collections import Counter
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import redact  # noqa: E402


def gh_available():
    return shutil.which("gh") is not None


def gh_authenticated():
    try:
        r = subprocess.run(["gh", "auth", "status"], capture_output=True, text=True, timeout=20)
        return r.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def fetch_repos(limit):
    fields = "name,primaryLanguage,description,isPrivate,repositoryTopics,updatedAt"
    try:
        r = subprocess.run(
            ["gh", "repo", "list", "--json", fields, "--limit", str(limit)],
            capture_output=True, text=True, timeout=60,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if r.returncode != 0:
        return None
    try:
        return json.loads(r.stdout or "[]")
    except ValueError:
        return None


def recency_bucket(updated_at):
    dt = None
    if isinstance(updated_at, str):
        try:
            dt = datetime.fromisoformat(updated_at.replace("Z", "+00:00")).astimezone(timezone.utc)
        except (ValueError, TypeError):
            dt = None
    if not dt:
        return "unknown"
    days = (datetime.now(timezone.utc) - dt).days
    if days <= 30:
        return "<=30d"
    if days <= 90:
        return "<=90d"
    if days <= 365:
        return "<=1y"
    return ">1y"


def aggregate(repos):
    languages = Counter()
    topics = Counter()
    recency = Counter()
    n_private = n_public = 0
    for repo in repos:
        if not isinstance(repo, dict):
            continue
        lang = repo.get("primaryLanguage")
        if isinstance(lang, dict):
            nm = lang.get("name")
            if nm:
                languages[redact.scrub_text(str(nm))] += 1
        if repo.get("isPrivate"):
            n_private += 1
        else:
            n_public += 1
        tlist = repo.get("repositoryTopics")
        if isinstance(tlist, list):
            for t in tlist:
                name = t.get("name") if isinstance(t, dict) else t
                if name:
                    topics[redact.scrub_text(str(name))] += 1
        recency[recency_bucket(repo.get("updatedAt"))] += 1

    return {
        "schema": "agentic-swarm/github-signals/v1",
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "privacy": (
            "Opt-in, read-only metadata via `gh repo list`. No local data is sent. "
            "Repo names dropped; only language/topic/recency aggregates kept. Secrets redacted."
        ),
        "repos_seen": len(repos),
        "public": n_public,
        "private": n_private,
        "languages": dict(languages.most_common()),
        "topics": dict(topics.most_common(40)),
        "recency": dict(recency),
    }


def write_skipped(out_path, reason):
    payload = {
        "schema": "agentic-swarm/github-signals/v1",
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "skipped": True,
        "reason": reason,
    }
    try:
        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
    except OSError:
        pass


def main():
    ap = argparse.ArgumentParser(description="OPT-IN read-only GitHub metadata aggregator (gh CLI)")
    ap.add_argument("--out", default=None, help="output JSON path")
    ap.add_argument("--limit", type=int, default=100, help="max repos to list (default 100)")
    args = ap.parse_args()

    out_path = args.out or os.path.join(tempfile.gettempdir(), "agentic-swarm", "github-signals.json")

    if not gh_available():
        write_skipped(out_path, "gh CLI not installed")
        print("skipped: GitHub CLI ('gh') is not installed -- GitHub scan skipped. (exit 0)")
        sys.exit(0)
    if not gh_authenticated():
        write_skipped(out_path, "gh not authenticated")
        print("skipped: 'gh' is installed but not authenticated ('gh auth login') -- skipped. (exit 0)")
        sys.exit(0)

    repos = fetch_repos(args.limit)
    if repos is None:
        write_skipped(out_path, "gh repo list failed")
        print("skipped: 'gh repo list' did not return data -- skipped. (exit 0)")
        sys.exit(0)

    out = redact.scrub_obj(aggregate(repos))
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)

    # ---- ASCII-only summary ----
    print("GitHub signals (opt-in, read-only metadata):")
    print("  repos_seen={n}  public={pub}  private={priv}".format(
        n=out["repos_seen"], pub=out["public"], priv=out["private"]))
    if out["languages"]:
        print("  languages: " + ", ".join("{0}={1}".format(k, v) for k, v in list(out["languages"].items())[:10]))
    if out["topics"]:
        print("  topics: " + ", ".join("{0}={1}".format(k, v) for k, v in list(out["topics"].items())[:10]))
    print("wrote " + out_path)
    sys.exit(0)


if __name__ == "__main__":
    main()
