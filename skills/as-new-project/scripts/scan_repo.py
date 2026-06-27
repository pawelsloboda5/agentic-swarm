#!/usr/bin/env python3
"""
scan_repo.py -- 100% LOCAL scan of the current repository. NO network calls.

WHAT IT DOES
------------
Scans a repo directory and aggregates SIGNALS ONLY:
  - a file-extension histogram (skipping .git, node_modules, .venv, dist, build, ...),
  - which key manifest files are present (package.json, pyproject.toml, requirements.txt,
    go.mod, Cargo.toml, ...), and the languages/frameworks they imply,
  - dependency NAMES inferred from manifests (names only -- never values/secrets),
  - whether the repo has a .claude/ skills dir and a README,
  - the git remote read straight from `.git/config` (NO `git`/network call).

Every string written is passed through redact.scrub_text(). There are NO network calls here --
the git remote is read from the local `.git/config` file, not fetched.

USAGE
-----
    python scan_repo.py [--root DIR] [--out PATH]
  --root  repo to scan (default: current working directory)
  --out   output JSON (default: <tempdir>/agentic-swarm/repo-signals.json)
"""
import argparse
import json
import os
import re
import sys
import tempfile
from collections import Counter
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import redact  # noqa: E402

_SKIP_DIRS = {
    ".git", "node_modules", ".venv", "venv", "env", "dist", "build", ".next",
    "__pycache__", ".mypy_cache", ".pytest_cache", "target", "vendor", ".gradle",
    ".idea", ".vscode", "coverage", ".turbo", ".cache", "out", ".svelte-kit",
}
_MAX_FILES = 50000  # safety bound on huge trees

# manifest filename -> (language, framework-hint)
_MANIFESTS = {
    "package.json": ("JavaScript/TypeScript", "node"),
    "pyproject.toml": ("Python", None),
    "requirements.txt": ("Python", None),
    "Pipfile": ("Python", None),
    "setup.py": ("Python", None),
    "go.mod": ("Go", None),
    "Cargo.toml": ("Rust", None),
    "pom.xml": ("Java", "maven"),
    "build.gradle": ("Java/Kotlin", "gradle"),
    "build.gradle.kts": ("Kotlin", "gradle"),
    "Gemfile": ("Ruby", None),
    "composer.json": ("PHP", None),
    "pubspec.yaml": ("Dart", "flutter"),
    "Package.swift": ("Swift", None),
    "mix.exs": ("Elixir", None),
    "deno.json": ("TypeScript", "deno"),
    "CMakeLists.txt": ("C/C++", "cmake"),
    "Dockerfile": (None, "docker"),
    "docker-compose.yml": (None, "docker-compose"),
}

# substring in a JS dependency name -> framework label
_JS_FRAMEWORK_HINTS = {
    "next": "Next.js", "react": "React", "vue": "Vue", "svelte": "Svelte",
    "@angular/": "Angular", "express": "Express", "fastify": "Fastify",
    "nestjs": "NestJS", "@nestjs": "NestJS", "tailwindcss": "Tailwind",
    "vite": "Vite", "webpack": "Webpack", "jest": "Jest", "vitest": "Vitest",
    "playwright": "Playwright", "cypress": "Cypress", "prisma": "Prisma",
    "drizzle": "Drizzle", "@supabase": "Supabase", "electron": "Electron",
    "astro": "Astro", "remix": "Remix", "@trpc": "tRPC", "graphql": "GraphQL",
}
_PY_FRAMEWORK_HINTS = {
    "django": "Django", "flask": "Flask", "fastapi": "FastAPI", "pandas": "pandas",
    "numpy": "NumPy", "torch": "PyTorch", "tensorflow": "TensorFlow",
    "scikit-learn": "scikit-learn", "sklearn": "scikit-learn", "pytest": "pytest",
    "sqlalchemy": "SQLAlchemy", "pydantic": "Pydantic", "streamlit": "Streamlit",
    "transformers": "Transformers", "langchain": "LangChain", "openai": "openai",
    "anthropic": "anthropic", "supabase": "Supabase",
}


def walk_files(root):
    count = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS and not d.startswith(".git")]
        for fn in filenames:
            count += 1
            if count > _MAX_FILES:
                return
            yield dirpath, fn


def ext_of(name):
    dot = name.rfind(".")
    if dot <= 0 or dot == len(name) - 1:
        return ""
    return name[dot:].lower()


def parse_package_json(path):
    deps = []
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return deps
    for field in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
        d = data.get(field)
        if isinstance(d, dict):
            deps.extend(d.keys())  # NAMES only -- never the version-spec values
    return deps


def parse_requirements(path):
    deps = []
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or line.startswith("-"):
                    continue
                name = re.split(r"[<>=!~\[ ;]", line, 1)[0].strip()
                if name:
                    deps.append(name.lower())
    except OSError:
        pass
    return deps


def parse_pyproject(path):
    deps = []
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except OSError:
        return deps
    # Lightweight: pull dependency names out of dependency arrays without a TOML lib.
    for m in re.finditer(r'["\']([A-Za-z0-9][A-Za-z0-9._-]+)\s*(?:[<>=!~\[].*?)?["\']', text):
        nm = m.group(1).lower()
        if nm in _PY_FRAMEWORK_HINTS or nm not in ("python",):
            deps.append(nm)
    return deps


def detect_frameworks(js_deps, py_deps):
    fw = set()
    for dep in js_deps:
        low = dep.lower()
        for hint, label in _JS_FRAMEWORK_HINTS.items():
            if hint in low:
                fw.add(label)
    for dep in py_deps:
        low = dep.lower()
        for hint, label in _PY_FRAMEWORK_HINTS.items():
            if hint == low or hint in low:
                fw.add(label)
    return sorted(fw)


def read_git_remote(root):
    """Parse remote origin from local .git/config -- NO network, NO git subprocess."""
    cfg = os.path.join(root, ".git", "config")
    if not os.path.isfile(cfg):
        return None
    url = None
    in_origin = False
    try:
        with open(cfg, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                s = line.strip()
                if s.startswith("[remote "):
                    in_origin = '"origin"' in s
                elif s.startswith("[") and not s.startswith("[remote "):
                    in_origin = False
                elif in_origin and s.startswith("url"):
                    parts = s.split("=", 1)
                    if len(parts) == 2:
                        url = parts[1].strip()
                        break
    except OSError:
        return None
    if not url:
        return None
    # Parse into host/owner/repo so we never store credentials embedded in the URL.
    host = owner = repo = None
    m = re.match(r"git@([^:]+):([^/]+)/(.+?)(?:\.git)?/?$", url)
    if m:
        host, owner, repo = m.group(1), m.group(2), m.group(3)
    else:
        m = re.match(r"(?:https?|ssh)://(?:[^@/]+@)?([^/]+)/([^/]+)/(.+?)(?:\.git)?/?$", url)
        if m:
            host, owner, repo = m.group(1), m.group(2), m.group(3)
    return {
        "host": redact.scrub_text(host) if host else None,
        "owner": redact.scrub_text(owner) if owner else None,
        "repo": redact.scrub_text(repo) if repo else None,
    }


def scan(root):
    exts = Counter()
    manifests = []
    languages = set()
    framework_hints = set()
    has_claude_skills = os.path.isdir(os.path.join(root, ".claude", "skills"))
    has_claude_dir = os.path.isdir(os.path.join(root, ".claude"))
    has_readme = False
    js_deps, py_deps = [], []
    total_files = 0

    for dirpath, fn in walk_files(root):
        total_files += 1
        e = ext_of(fn)
        if e:
            exts[e] += 1
        if fn.lower().startswith("readme"):
            has_readme = True
        if fn in _MANIFESTS:
            rel = os.path.relpath(os.path.join(dirpath, fn), root).replace("\\", "/")
            manifests.append(rel)
            lang, fwhint = _MANIFESTS[fn]
            if lang:
                languages.add(lang)
            if fwhint:
                framework_hints.add(fwhint)
            full = os.path.join(dirpath, fn)
            if fn == "package.json":
                js_deps.extend(parse_package_json(full))
            elif fn in ("requirements.txt", "Pipfile"):
                py_deps.extend(parse_requirements(full))
            elif fn in ("pyproject.toml", "setup.py"):
                py_deps.extend(parse_pyproject(full))

    frameworks = sorted(set(detect_frameworks(js_deps, py_deps)) | framework_hints)

    out = {
        "schema": "agentic-swarm/repo-signals/v1",
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "privacy": "Local scan. No network. Dependency NAMES only; secrets redacted; paths scrubbed.",
        "root": redact.scrub_text(root),
        "total_files_scanned": total_files,
        "file_extensions": dict(exts.most_common(40)),
        "manifests": sorted(set(manifests)),
        "languages": sorted(languages),
        "frameworks": frameworks,
        "dependency_sample": {
            "js": sorted(set(d.lower() for d in js_deps))[:60],
            "py": sorted(set(d.lower() for d in py_deps))[:60],
        },
        "has_claude_dir": has_claude_dir,
        "has_claude_skills": has_claude_skills,
        "has_readme": has_readme,
        "git_remote": read_git_remote(root),
    }
    return redact.scrub_obj(out)


def main():
    ap = argparse.ArgumentParser(description="Local, aggregate-only repo scanner (no network)")
    ap.add_argument("--root", default=None, help="repo dir to scan (default: cwd)")
    ap.add_argument("--out", default=None, help="output JSON path")
    args = ap.parse_args()

    root = os.path.abspath(args.root or os.getcwd())
    out_path = args.out or os.path.join(tempfile.gettempdir(), "agentic-swarm", "repo-signals.json")
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)

    if not os.path.isdir(root):
        print("not a directory: " + redact.scrub_text(root))
        sys.exit(0)

    out = scan(root)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)

    # ---- ASCII-only summary ----
    print("Repo signals (LOCAL, no network):")
    print("  root: " + out["root"])
    print("  files_scanned={n}  languages={langs}".format(
        n=out["total_files_scanned"], langs=", ".join(out["languages"]) or "(none)"))
    if out["frameworks"]:
        print("  frameworks: " + ", ".join(out["frameworks"]))
    top_ext = list(out["file_extensions"].items())[:10]
    if top_ext:
        print("  top exts: " + ", ".join("{0}={1}".format(k, v) for k, v in top_ext))
    print("  manifests: " + (", ".join(out["manifests"]) or "(none)"))
    print("  has_readme={r}  has_claude_skills={s}".format(r=out["has_readme"], s=out["has_claude_skills"]))
    if out["git_remote"]:
        gr = out["git_remote"]
        print("  remote: {h}/{o}/{r}".format(h=gr.get("host"), o=gr.get("owner"), r=gr.get("repo")))
    print("wrote " + out_path)
    sys.exit(0)


if __name__ == "__main__":
    main()
