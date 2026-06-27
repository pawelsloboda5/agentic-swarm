#!/usr/bin/env python3
"""
redact.py -- shared, importable secret-redaction + home-path scrubbing helpers.

Why this exists
---------------
The /as-new-project profiler reads LOCAL data (Claude Code transcripts, the current repo,
optionally GitHub *metadata*). Privacy is the #1 requirement: before ANY string is written to
an output file, it passes through here so that
  - common secrets (API keys, tokens, bearer/JWT strings, private keys, emails) are masked, and
  - absolute home-directory paths are collapsed to "~" (so usernames / machine layout do not leak).

This module makes ZERO network calls and imports nothing beyond the stdlib. It is pure text
transformation -- import it and call `scrub_text(s)` / `scrub_obj(obj)`.

Design notes
------------
- Patterns are intentionally conservative-but-broad: they target well-known secret SHAPES
  (prefixes like sk-, ghp_, AKIA..., JWT eyJ..., -----BEGIN PRIVATE KEY-----) and "key = value"
  assignments. We prefer over-redacting a coincidental token to leaking a real one.
- Home-path scrubbing handles RAW absolute paths (Windows `C:\\Users\\Name`, POSIX `/home/name`
  and `/Users/name`, Git-Bash `/c/Users/Name`) AND the Claude "project slug" form, where the cwd
  has every non-alphanumeric char replaced by "-" (e.g. `C--Users-Name-Desktop-proj`).
"""
import os
import re

REDACTED = "[REDACTED]"

# ---------------------------------------------------------------------------
# 1. Secret-shaped patterns. Each is matched and replaced with [REDACTED]
#    (or a typed marker). Order does not matter much -- they are applied in turn.
# ---------------------------------------------------------------------------
_SECRET_PATTERNS = [
    # PEM private key blocks (multi-line) -> collapse the whole block.
    ("private_key", re.compile(
        r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----",
        re.DOTALL)),
    # JWTs: three base64url segments. Check BEFORE generic tokens.
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}")),
    # Anthropic keys (sk-ant-...), then OpenAI-style sk- / sk-proj- keys.
    ("anthropic_key", re.compile(r"\bsk-ant-[A-Za-z0-9._-]{8,}")),
    ("openai_key", re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9]{16,}")),
    # GitHub tokens (classic + fine-grained PAT + app tokens).
    ("github_pat", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}")),
    ("github_token", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}")),
    # npm access tokens.
    ("npm_token", re.compile(r"\bnpm_[A-Za-z0-9]{36,}")),
    # Google API keys.
    ("google_key", re.compile(r"\bAIza[0-9A-Za-z_-]{20,}")),
    # AWS access key ids and the GA secret token shape.
    ("aws_akid", re.compile(r"\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA)[0-9A-Z]{16}")),
    # Slack tokens.
    ("slack_token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}")),
    # Stripe / similar live+test secret keys.
    ("stripe_key", re.compile(r"\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}")),
    # Generic long hex secret (>=32 hex) -- catches many session/secret hashes.
    ("hex_secret", re.compile(r"\b[0-9a-fA-F]{40,}\b")),
    # Bearer / Authorization header values.
    ("bearer", re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{8,}")),
]

# "key = value" / "key: value" assignments for sensitive-looking key names.
_ASSIGNMENT = re.compile(
    r"(?i)\b("
    r"api[_-]?key|secret(?:[_-]?key)?|access[_-]?token|refresh[_-]?token|"
    r"client[_-]?secret|auth[_-]?token|password|passwd|pwd|token|"
    r"private[_-]?key|connection[_-]?string|conn[_-]?str"
    r")\b(\s*[:=]\s*)(['\"]?)([^\s'\"]{6,})(['\"]?)"
)

# Emails (belt-and-suspenders; transcript content is never written, but paths/metadata might
# carry one). `git@github.com`-style git-remote handles are parsed structurally elsewhere, so a
# blanket email mask here is safe.
_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")


def _assignment_sub(m):
    # Keep the key name + separator, mask only the value -> readable but secret-free.
    return f"{m.group(1)}{m.group(2)}{m.group(3)}{REDACTED}{m.group(5)}"


def scrub_secrets(s):
    """Mask secret-shaped substrings in `s`. Returns a new string."""
    if not s:
        return s
    for _name, pat in _SECRET_PATTERNS:
        s = pat.sub(REDACTED, s)
    s = _ASSIGNMENT.sub(_assignment_sub, s)
    s = _EMAIL.sub("[REDACTED_EMAIL]", s)
    return s


# ---------------------------------------------------------------------------
# 2. Home-path scrubbing -> collapse the user's home dir to "~".
# ---------------------------------------------------------------------------
def slugify(path):
    """Reproduce Claude Code's project-slug transform: every non-alphanumeric char -> '-'."""
    return re.sub(r"[^A-Za-z0-9]", "-", path)


def _home_dirs():
    """Best-effort set of this user's home-directory absolute paths (raw forms)."""
    homes = set()
    for cand in (
        os.path.expanduser("~"),
        os.environ.get("USERPROFILE", ""),
        os.environ.get("HOME", ""),
    ):
        if cand:
            homes.add(cand)
            homes.add(cand.replace("\\", "/"))
            # Git-Bash style: C:\Users\X -> /c/Users/X
            m = re.match(r"^([A-Za-z]):[\\/](.*)$", cand)
            if m:
                homes.add("/" + m.group(1).lower() + "/" + m.group(2).replace("\\", "/"))
    return {h for h in homes if h}


def _build_home_regexes():
    raw = sorted(_home_dirs(), key=len, reverse=True)  # longest first
    regexes = []
    for h in raw:
        regexes.append(re.compile(re.escape(h), re.IGNORECASE))
        slug = slugify(h)
        if slug and slug != h:
            regexes.append(re.compile(re.escape(slug), re.IGNORECASE))
    return regexes


_HOME_REGEXES = _build_home_regexes()

# Generic fallbacks for any user-home-shaped absolute path (in case the running user's home
# was not detected). These mask the username segment that follows a Users/home root.
_GENERIC_PATH_PATTERNS = [
    re.compile(r"(?i)([A-Za-z]:\\Users\\)[^\\/:*?\"<>|\r\n]+"),   # Windows backslash
    re.compile(r"(?i)([A-Za-z]:/Users/)[^/\r\n]+"),               # Windows forward-slash
    re.compile(r"(?i)(/[a-z]/Users/)[^/\r\n]+"),                  # Git-Bash /c/Users/Name
    re.compile(r"(/Users/)[^/\r\n]+"),                            # macOS
    re.compile(r"(/home/)[^/\r\n]+"),                             # Linux
]


def scrub_paths(s):
    """Collapse home-directory absolute paths (raw + slug forms) to '~'."""
    if not s:
        return s
    for rx in _HOME_REGEXES:
        s = rx.sub("~", s)
    for rx in _GENERIC_PATH_PATTERNS:
        s = rx.sub("~", s)
    return s


# ---------------------------------------------------------------------------
# 3. Public entry points.
# ---------------------------------------------------------------------------
def scrub_text(s):
    """Full scrub: mask secrets, then collapse home paths. Safe on any string."""
    if not isinstance(s, str):
        return s
    return scrub_paths(scrub_secrets(s))


# Back-compat alias.
scrub = scrub_text


def scrub_obj(obj):
    """Recursively scrub every string inside dicts/lists/tuples. Keys are scrubbed too."""
    if isinstance(obj, str):
        return scrub_text(obj)
    if isinstance(obj, dict):
        return {scrub_text(k) if isinstance(k, str) else k: scrub_obj(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [scrub_obj(v) for v in obj]
    return obj


if __name__ == "__main__":
    # Tiny self-test (ASCII-only output, cp1252-safe). Proves the scrubbers fire.
    samples = [
        "key sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 here",
        "token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 here",
        "jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcDEF123456",
        "api_key = 'supersecretvalue12345'",
        "email me@example.com",
        "path C:\\Users\\Pawel Sloboda\\Desktop\\proj",
        "slug C--Users-Pawel-Sloboda-Desktop-gta6",
    ]
    ok = True
    for s in samples:
        out = scrub_text(s)
        leaked = any(bad in out for bad in (
            "sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ", "ghp_ABCDEFGHIJKLMNOP",
            "supersecretvalue", "me@example.com",
        ))
        print(("LEAK  " if leaked else "ok    ") + repr(out))
        ok = ok and not leaked
    print("ALL_REDACTED" if ok else "REDACTION_FAILED")
