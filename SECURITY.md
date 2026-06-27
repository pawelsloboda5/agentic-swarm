# Security Policy

`agentic-swarm` runs inside Claude Code with access to your machine and your code, and its profiler
reads local history — so security and privacy are taken seriously here, and issues are very welcome.

## Reporting a vulnerability

Please report security or privacy issues **privately first**, so a fix can ship before public
disclosure:

- Open a [GitHub private vulnerability report](https://github.com/pawelsloboda5/agentic-swarm/security/advisories/new)
  (repo **Security → Report a vulnerability**), or
- email the maintainer (the `author` in [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json)).

Include what you found, how to reproduce it, and the impact. Expect an acknowledgement within a few
days; public disclosure is coordinated after a fix is available.

## What counts as a security / privacy issue

The privacy guarantee is part of the product, so a break in it **is** a security bug. In particular:

- **Any exfiltration of local data.** The `/agentic-swarm:as-new-project` profiler is 100% local and
  must make **zero** outbound network requests. The plugin's *only* network call is the SessionStart
  hook's read-only GitHub version check, which **sends nothing about you**. Anything that
  contradicts [`docs/PRIVACY.md`](docs/PRIVACY.md) is a bug.
- **Secret leakage.** The profiler redacts secrets before writing anything; a secret-shaped value
  surviving redaction — or a real secret committed to this repo — is a security issue. (CI also
  fails if a secret-shaped literal lands in tracked source — see
  [`tests/test_no_literal_secrets.py`](tests/test_no_literal_secrets.py).)
- **Reading outside the documented scope** — local transcripts, the current repo, and opt-in GitHub
  metadata are the only things the profiler should ever read.

## Supported versions

This is a young project; security fixes target the **latest release**. Please update before
reporting.

## Scope note

The plugin executes the orchestration scripts and subagents you direct it to run; running untrusted
prompts or scripts is out of scope in the same way running untrusted code generally is. The
safe-swarm patterns are about *reliability* (no silent stalls, no lost work), not a sandbox.
