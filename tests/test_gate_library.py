"""Structural + invariant tests for the v0.7.0 gate library and gate runner.

Guards the design contract (mvp-gate-library plan §1/§2) without re-implementing it:
- each MVP gate file declares all 7 keys with a valid tier and id==filename,
- the gate runner encodes the anti-theater invariant, the verdict schema, the N=2 bound, and graceful
  (non-silent) degradation,
- the ui-ux gate is wired to the shipped WCAG util,
- the use-case->gate map cannot claim an "active" gate the library doesn't actually ship.

Pure stdlib.
"""
import os
import re

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_GATES = os.path.join(_REPO_ROOT, "skills", "architect", "gates")
_RUNNER = os.path.join(_REPO_ROOT, "skills", "architect", "reference", "gate-runner.md")
_GATEMAP = os.path.join(_REPO_ROOT, "skills", "architect", "reference", "usecase-gate-map.md")
_WCAG = os.path.join(_GATES, "lib", "wcag_contrast.py")

MVP_GATES = ("tests", "assets", "ui-ux")
SEVEN_KEYS = ("id", "applies_when", "tier", "criteria", "verifier", "confidence", "backing_skill")
VALID_TIERS = {"objective", "critic", "advisory", "mixed"}


def _read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def test_mvp_gate_files_exist():
    for gid in MVP_GATES:
        assert os.path.isfile(os.path.join(_GATES, gid + ".md")), "missing gates/%s.md" % gid


def test_each_gate_declares_seven_keys():
    for gid in MVP_GATES:
        text = _read(os.path.join(_GATES, gid + ".md"))
        for key in SEVEN_KEYS:
            assert ("**%s:**" % key) in text, "gates/%s.md missing key '%s'" % (gid, key)


def test_each_gate_tier_is_valid():
    for gid in MVP_GATES:
        text = _read(os.path.join(_GATES, gid + ".md"))
        m = re.search(r"\*\*tier:\*\*\s*`?([a-z-]+)`?", text)
        assert m, "gates/%s.md has no parseable tier" % gid
        assert m.group(1) in VALID_TIERS, "gates/%s.md tier '%s' invalid" % (gid, m.group(1))


def test_each_gate_id_matches_filename():
    for gid in MVP_GATES:
        text = _read(os.path.join(_GATES, gid + ".md"))
        m = re.search(r"\*\*id:\*\*\s*`([^`]+)`", text)
        assert m and m.group(1) == gid, "gates/%s.md id must be `%s`" % (gid, gid)


def test_runner_encodes_the_contract():
    runner = _read(_RUNNER)
    low = runner.lower()
    # anti-theater invariant: no pass without evidence + tier + confidence
    assert "anti-theater" in low or "anti theater" in low
    assert "evidence" in low and "confidence" in low
    assert re.search(r"no\s+`?status:\s*pass`?|no\s+\*\*?status:\s*pass", low) or "without" in low
    # verdict schema keys present
    for key in ("gate_id", "status", "degraded", "unmet_criteria", "skill_used"):
        assert key in runner, "runner missing verdict key '%s'" % key
    # bounded N=2 re-brief and graceful (non-silent) degradation
    assert "n=2" in low or "bounded n" in low
    assert "graceful" in low and "silent" in low


def test_ui_ux_gate_uses_the_wcag_util():
    text = _read(os.path.join(_GATES, "ui-ux.md"))
    assert "wcag_contrast.py" in text, "ui-ux gate must reference the bundled WCAG util"
    assert os.path.isfile(_WCAG), "gates/lib/wcag_contrast.py must exist"


def test_gatemap_active_gates_have_shipped_files():
    """The map must not advertise an 'active' gate that the library doesn't ship."""
    text = _read(_GATEMAP)
    idx = text.find("## Gate status")
    assert idx != -1, "gate map must have a '## Gate status' section"
    section = text[idx:text.find("## Default map", idx) if "## Default map" in text else len(text)]
    missing = []
    for line in section.splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 2:
            continue
        status = cells[1].lower()
        if "active" not in status:
            continue
        # extract the gate id from the first cell: **tests** -> tests
        m = re.search(r"\*\*([a-z0-9-]+)\*\*", cells[0])
        if not m:
            continue
        gid = m.group(1)
        if not os.path.isfile(os.path.join(_GATES, gid + ".md")):
            missing.append(gid)
    assert not missing, "map marks these gates active but no gates/<id>.md ships: %r" % missing
