#!/usr/bin/env python3
"""Zero-dependency normalizer for automated-a11y runner output — the objective primitive for the `a11y` gate.

Pure Python stdlib. Importable (`normalize`) AND runnable as a machine check:

    python gates/lib/a11y_report.py <json-file> --runner axe|pa11y|lighthouse   # (from the skill root)
    # prints the unified verdict JSON; exit 0 if pass, 1 if gating violations, 2 on bad/unreadable input.

It turns the HETEROGENEOUS JSON each runner emits into ONE verdict, and it is deliberately defensive
because the shapes differ by *invocation*, not just by tool (verified via Context7, 2026-06-27):
  - axe-core: `axe.run()` returns `{"violations":[{"id","nodes":[...]}], "incomplete":[...]}`, but the
    `@axe-core/cli` file can be a TOP-LEVEL ARRAY of per-page result objects. Both are accepted.
  - pa11y:    the JS API returns `{"issues":[{"type","code",...}]}`, but the CLI `--reporter json` emits a
    BARE ARRAY `[{...}]` (pa11y 2.0: "outputs only the results array"). Both are accepted. Only
    `type == "error"` counts; warnings/notices are advisory.
  - lighthouse: `{"categories":{"accessibility":{"score": 0..1}}}` — a WEIGHTED SUBSET score, so it is
    ADVISORY only (never a hard gate); a null score or a top-level `runtimeError` is DEGRADED, never 0.

SINGLE-OWNER DECOMPOSITION (no double-count with the `ui-ux` gate): contrast, alt-text, accessible-name
*presence*, and tap-target stay owned by `ui-ux`. A runner naturally emits those too, so this normalizer
PARTITIONS any violation of a ui-ux-owned rule into the ADVISORY count (deferred to ui-ux) and gates ONLY
on a11y-distinctive violations (keyboard / focus-order / ARIA role-value-state / landmarks / headings /
structure). `UIUX_OWNED_RULES` / `UIUX_OWNED_SC` below are the documented seam.

FAIL-CLOSED: any unparseable / wrong-shape / missing-expected-keys payload yields an `error` verdict
(`pass: False`, exit 2) — NEVER a silent `count == 0 => pass`. ASCII-only output (cp1252-safe).
"""
import json
import sys

RUNNERS = ("axe", "pa11y", "lighthouse")

# --- The ui-ux-owned seam: rules a11y must NOT gate on (surfaced advisory, deferred to ui-ux). ---
# axe rule ids for contrast + the alt-text family + the accessible-name family + tap-target.
UIUX_OWNED_RULES = frozenset({
    "color-contrast",
    "image-alt", "input-image-alt", "area-alt", "object-alt", "svg-img-alt", "role-img-alt",
    "label", "label-title-only", "button-name", "link-name",
    "aria-input-field-name", "aria-toggle-field-name", "aria-command-name",
    "target-size",
})
# pa11y/htmlcs codes don't expose a clean rule id, so we partition by WCAG success-criterion substring.
# Approximate (htmlcs 4.1.2 codes are predominantly name-related; axe is preferred where ids partition
# cleanly) — documented in a11y.md. 1_4_3 contrast, 1_1_1 non-text/alt, 4_1_2 name, 2_5_8 target-size.
UIUX_OWNED_SC = ("1_4_3", "1_1_1", "4_1_2", "2_5_8")


class _ShapeError(Exception):
    """Raised internally when a payload does not match the expected runner shape (=> fail-closed)."""


def _is_real_number(x):
    """True for an int/float that is NOT a bool (bool subclasses int; a JSON bool is not a valid score)."""
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _verdict(runner):
    return {
        "runner": runner,
        "gating_violations": 0,
        "advisory_violations": 0,
        "errors_only": 0,
        "score": None,
        "incomplete_count": 0,
        "pass": False,
        "degraded": False,
        "advisory": False,
        "error": None,
        "note": "",
    }


def _axe_pages(data):
    """A dict result or a NON-EMPTY list of per-page result dicts -> list of page dicts. Fail-closed
    otherwise. An empty top-level list means zero pages were audited (a real @axe-core/cli run emits >=1
    page object), so it fails closed rather than reporting a clean count==0 pass."""
    if isinstance(data, dict):
        return [data]
    if isinstance(data, list) and data:
        return data
    raise _ShapeError()


def _normalize_axe(data, v):
    gating = advisory = incomplete = 0
    for page in _axe_pages(data):
        if not isinstance(page, dict):
            raise _ShapeError()
        violations = page.get("violations")
        if not isinstance(violations, list):
            raise _ShapeError()
        for item in violations:
            if not isinstance(item, dict):
                raise _ShapeError()
            if item.get("id") in UIUX_OWNED_RULES:
                advisory += 1
            else:
                gating += 1
        inc = page.get("incomplete")
        if isinstance(inc, list):
            incomplete += len(inc)
    v["gating_violations"] = gating
    v["advisory_violations"] = advisory
    v["incomplete_count"] = incomplete
    v["pass"] = gating == 0
    if incomplete:
        v["note"] = "%d axe 'incomplete' (needs-review) item(s) surfaced, not gating" % incomplete
    return v


def _pa11y_issues(data):
    """A dict with an `issues` list, or a bare list of issue dicts. Fail-closed otherwise."""
    if isinstance(data, dict):
        issues = data.get("issues")
    elif isinstance(data, list):
        issues = data
    else:
        raise _ShapeError()
    if not isinstance(issues, list):
        raise _ShapeError()
    return issues


def _normalize_pa11y(data, v):
    errors = gating = advisory = 0
    for it in _pa11y_issues(data):
        if not isinstance(it, dict):
            raise _ShapeError()
        if it.get("type") != "error":
            continue  # warnings / notices are not WCAG failures -> skipped (not added to any count)
        errors += 1
        # Match the SC as a whole dot-delimited code SEGMENT (e.g. '1_4_3'), not a raw substring, so an
        # a11y-distinctive code is not mis-deferred just because an SC token appears inside another token.
        segments = (it.get("code") or "").split(".")
        if any(sc in segments for sc in UIUX_OWNED_SC):
            advisory += 1
        else:
            gating += 1
    v["errors_only"] = errors
    v["gating_violations"] = gating
    v["advisory_violations"] = advisory
    v["pass"] = gating == 0
    return v


def _normalize_lighthouse(data, v):
    if not isinstance(data, dict):
        raise _ShapeError()
    cats = data.get("categories")
    if not isinstance(cats, dict):
        raise _ShapeError()
    acc = cats.get("accessibility")
    if not isinstance(acc, dict) or "score" not in acc:
        raise _ShapeError()
    score = acc.get("score")
    # Lighthouse a11y is a weighted subset => ADVISORY only, never a hard gate => always degraded.
    v["degraded"] = True
    if data.get("runtimeError") or score is None:
        v["error"] = "lighthouse run errored or accessibility score missing"
        v["score"] = score if _is_real_number(score) else None
        v["pass"] = False
        return v
    if not _is_real_number(score) or not (0.0 <= score <= 1.0):
        raise _ShapeError()
    v["score"] = score
    v["advisory"] = True
    # pass==True here means "did not hard-fail" (advisory), NOT "objective floor satisfied" — the gate is
    # always degraded for a lighthouse-only run, so the gate-runner caps confidence <= 0.6.
    v["pass"] = True
    v["note"] = "lighthouse accessibility score is ADVISORY (weighted subset, not conformance)"
    return v


def normalize(data, runner):
    """Normalize one runner's parsed JSON into the unified a11y verdict dict.

    `runner` must be one of RUNNERS (else ValueError). A shape mismatch fails closed: the returned
    verdict carries `error` + `pass: False` (never count==0 => pass).
    """
    if runner not in RUNNERS:
        raise ValueError("unknown runner: %r (expected one of %s)" % (runner, list(RUNNERS)))
    v = _verdict(runner)
    try:
        if runner == "axe":
            return _normalize_axe(data, v)
        if runner == "pa11y":
            return _normalize_pa11y(data, v)
        return _normalize_lighthouse(data, v)
    except _ShapeError:
        v["error"] = "unrecognized/malformed %s JSON" % runner
        v["degraded"] = True
        v["pass"] = False
        return v


def _main(argv):
    runner = None
    path = None
    i = 0
    while i < len(argv):
        tok = argv[i]
        if tok == "--runner":
            if i + 1 >= len(argv):
                sys.stderr.write("error: --runner needs a value\n")
                return 2
            runner = argv[i + 1]
            i += 2
            continue
        if tok.startswith("--"):
            sys.stderr.write("error: unknown flag %s\n" % tok)
            return 2
        path = tok
        i += 1
    if path is None or runner is None:
        sys.stderr.write("usage: a11y_report.py <json-file> --runner axe|pa11y|lighthouse\n")
        return 2
    if runner not in RUNNERS:
        sys.stderr.write("error: unknown runner %r\n" % runner)
        return 2
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        sys.stderr.write("error: cannot read/parse %s: %s\n" % (path, exc))
        return 2
    v = normalize(data, runner)
    sys.stdout.write(json.dumps(v) + "\n")  # ensure_ascii defaults True -> cp1252-safe
    if v["error"] is not None:
        return 2
    return 0 if v["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
