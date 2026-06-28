"""Freeze guard for the v1.1.0 PUBLIC CONTRACT: the gate-file schema + the verdict schema.

As of v1.1.0 the gate (7-key) schema, the verdict schema, and their `tier` / `status` enums are the
plugin's **frozen public surface** (see CONTRIBUTING.md -> "Public contract & stability"). This test
PINS that surface as literals and verifies the canonical definition in `gate-runner.md` still matches,
so ANY drift -- a removed/renamed/added schema key, a changed enum value -- fails CI and forces a
deliberate SemVer decision (a breaking schema change = MAJOR). It also asserts the freeze is *declared*
(the gate-runner marker + the CONTRIBUTING SemVer policy exist), so the stability promise can't be
silently dropped.

Pure stdlib. Complements tests/test_gate_library.py (per-gate structural correctness); this file guards
the frozen contract itself + the SemVer policy that governs changing it.
"""
import os
import re

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_RUNNER = os.path.join(_REPO_ROOT, "skills", "architect", "reference", "gate-runner.md")
_CONTRIBUTING = os.path.join(_REPO_ROOT, "CONTRIBUTING.md")
_PLUGIN_JSON = os.path.join(_REPO_ROOT, ".claude-plugin", "plugin.json")

# --- THE FROZEN PUBLIC CONTRACT (v1.1.0) -------------------------------------------------------------
# Changing any of these literals is a deliberate, reviewed act that MUST ship with the matching SemVer
# bump (a removal/rename/enum-shrink = MAJOR; an additive optional key/gate = MINOR). The guard tests
# below exist so the frozen surface cannot drift by accident.
FROZEN_GATE_KEYS = ("id", "applies_when", "tier", "criteria", "verifier", "confidence", "backing_skill")
FROZEN_TIERS = frozenset({"objective", "critic", "advisory", "mixed"})
FROZEN_STATUSES = frozenset({"pass", "flag", "fail"})
FROZEN_VERDICT_KEYS = (
    "gate_id", "tier", "status", "confidence",
    "backing_skill", "skill_used", "degraded", "evidence", "unmet_criteria",
)
FREEZE_VERSION = (1, 1, 0)


def _read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def _block(text, opener):
    """Return the text between `opener` (e.g. 'gate := {') and the next line that is just '}'."""
    start = text.find(opener)
    assert start != -1, "gate-runner.md missing the %r schema block" % opener
    rest = text[start + len(opener):]
    end = rest.find("\n}")
    assert end != -1, "gate-runner.md %r block is not closed with a '}' line" % opener
    return rest[:end]


def test_gate_schema_keys_are_exactly_the_frozen_set():
    block = _block(_read(_RUNNER), "gate := {")
    # a key line looks like `  id            // ...` or `  criteria[]    // ...`; continuation comment
    # lines start with `//` (no identifier) and are correctly skipped.
    found = tuple(m.group(1) for m in re.finditer(r"(?m)^\s*([a-z_]+)(?:\[\])?\s+//", block))
    assert found == FROZEN_GATE_KEYS, (
        "gate-schema drift: gate-runner.md defines %r but the frozen contract is %r. A removed/renamed/"
        "added gate key is a breaking change -- bump SemVer (MAJOR for remove/rename) and update "
        "FROZEN_GATE_KEYS deliberately." % (list(found), list(FROZEN_GATE_KEYS))
    )


def test_tier_enum_is_exactly_the_frozen_set():
    block = _block(_read(_RUNNER), "gate := {")
    tier_line = next((ln for ln in block.splitlines() if re.match(r"\s*tier\s+//", ln)), None)
    assert tier_line, "gate-runner.md gate block must document the `tier` enum on the tier line"
    found = frozenset(re.findall(r"'([a-z-]+)'", tier_line))
    assert found == FROZEN_TIERS, (
        "tier-enum drift: %r vs frozen %r (changing the valid tiers is a breaking change -- MAJOR)"
        % (sorted(found), sorted(FROZEN_TIERS))
    )


def test_status_enum_is_exactly_the_frozen_set():
    block = _block(_read(_RUNNER), "verdict := {")
    m = re.search(r"status\s*[^{]*\{([^}]*)\}", block)
    assert m, "verdict block must declare 'status ... { pass, flag, fail }'"
    found = frozenset(t.strip() for t in m.group(1).split(",") if t.strip())
    assert found == FROZEN_STATUSES, (
        "status-enum drift: %r vs frozen %r (changing the valid statuses is a breaking change -- MAJOR)"
        % (sorted(found), sorted(FROZEN_STATUSES))
    )


def test_verdict_keys_present():
    block = _block(_read(_RUNNER), "verdict := {")
    for key in FROZEN_VERDICT_KEYS:
        assert re.search(r"\b%s\b" % re.escape(key), block), (
            "verdict schema missing frozen key %r (a removed/renamed verdict field is a breaking "
            "change -- MAJOR)" % key
        )


def test_confidence_range_and_repair_bound_pinned():
    runner = _read(_RUNNER)
    assert "0.0 .. 1.0" in runner, "verdict `confidence` must be the frozen 0.0 .. 1.0 range"
    assert re.search(r"(?i)\bN=2\b", runner), "the bounded-N=2 repair limit is part of the frozen contract"


def test_freeze_is_declared_in_gate_runner():
    runner = _read(_RUNNER).lower()
    assert "frozen" in runner, "gate-runner.md must declare the schema FROZEN (the freeze marker)"
    assert "1.1.0" in runner, "the freeze marker must name the freeze version (v1.1.0)"


def test_semver_policy_documented_in_contributing():
    low = _read(_CONTRIBUTING).lower()
    for word in ("major", "minor", "patch"):
        assert word in low, "CONTRIBUTING.md must document the %s SemVer rule" % word.upper()
    assert "frozen" in low, "CONTRIBUTING.md must declare the public contract frozen"
    assert "schema" in low, "CONTRIBUTING.md must tie the gate/verdict schema to the SemVer policy"


def test_plugin_version_is_at_least_the_freeze_version():
    m = re.search(r'"version"\s*:\s*"(\d+)\.(\d+)\.(\d+)"', _read(_PLUGIN_JSON))
    assert m, "plugin.json must declare a semver version"
    version = tuple(int(x) for x in m.groups())
    assert version >= FREEZE_VERSION, (
        "plugin.json version %s precedes the v%d.%d.%d schema freeze"
        % ((".".join(m.groups()),) + FREEZE_VERSION)
    )
