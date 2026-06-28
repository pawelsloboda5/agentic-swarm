# Gate: `assets`

Run via [`../reference/gate-runner.md`](../reference/gate-runner.md). Mixed tier: an objective floor
(assets are real and present) plus an **advisory** judgment for "AI-filler" — which never hard-fails.

## Definition

- **id:** `assets`
- **applies_when:** the workstream references assets (images, icons, fonts, media) or renders HTML.
- **tier:** `mixed` (objective floor + advisory)
- **criteria:**
  - **Objective floor (gates):**
    1. **No placeholder markers** — ripgrep sweep (scoped to the workstream's files, with an allowlist for
       legitimate uses) for placeholder hosts (`example.com`, `placehold`, `via.placeholder`,
       `lorem`/`ipsum`), empty `src=""` / `href=""`, and `TODO`/`FIXME` in asset positions.
    2. **Local assets exist & are non-empty** — stdlib `os.stat`: every *local* asset path referenced
       resolves to a file that exists and is **> 0 bytes**.
    3. **SVGs are well-formed XML** — parse each `.svg` with stdlib `xml.etree.ElementTree`; a parse error
       fails the asset.
    4. **Favicon present for HTML** — any produced HTML document declares a favicon (`<link rel="icon">`)
       and it resolves to an existing file.
  - **Advisory (surfaced, never hard-fail):**
    5. **AI-filler heuristic** — generic stock-like or obviously placeholder-quality assets are *flagged
       for human attention*, not failed. A well-formed-but-meaningless SVG still trips criterion 1's
       intent if it's a placeholder.
    6. **Remote / CDN refs** — reachability is advisory (network-dependent; don't hard-fail offline).
- **verifier:** a separate-context check that flagged placeholders are genuine (not allowlisted false
  positives) and that "exists & >0 bytes" wasn't satisfied by a 1-byte stub.
- **confidence:** high for the objective floor (deterministic fs/XML checks); the advisory items carry low
  confidence by nature and are reported as advisory.
- **backing_skill:** `responsive-ui-audit` (Playwright catches `naturalWidth===0` / 404s at runtime),
  `frontend-design`, `ui-ux-pro-max` — **optional enhancers only**.

## Evidence required for a pass

The ripgrep result (no disallowed markers), the stat results (paths + sizes), and the SVG-parse / favicon
checks. Advisory findings are listed separately and do not block the pass.

## On fail

Re-brief with the exact offending asset paths/markers, bounded N=2; then honest `flag`. A missing optional
runner (Playwright for runtime 404s) ⇒ skip that sub-check with a note — never a fail.
