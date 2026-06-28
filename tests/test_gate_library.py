"""Structural + invariant tests for the v0.7.0 gate library and gate runner.

Guards the design contract (mvp-gate-library plan §1/§2) without re-implementing it:
- each active gate file declares all 7 keys with a valid tier and id==filename,
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
_A11Y_REPORT = os.path.join(_GATES, "lib", "a11y_report.py")

# Every gate the library ships with a runnable file + a forward-couplable definition. a11y joined in
# v0.7.1 (the standalone runner gate), so it is guarded across all the structural + tier-drift checks.
ACTIVE_GATES = ("tests", "assets", "ui-ux", "a11y")
SEVEN_KEYS = ("id", "applies_when", "tier", "criteria", "verifier", "confidence", "backing_skill")
VALID_TIERS = {"objective", "critic", "advisory", "mixed"}


def _read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def test_mvp_gate_files_exist():
    for gid in ACTIVE_GATES:
        assert os.path.isfile(os.path.join(_GATES, gid + ".md")), "missing gates/%s.md" % gid


def test_each_gate_declares_seven_keys():
    for gid in ACTIVE_GATES:
        text = _read(os.path.join(_GATES, gid + ".md"))
        for key in SEVEN_KEYS:
            assert ("**%s:**" % key) in text, "gates/%s.md missing key '%s'" % (gid, key)


def test_each_gate_tier_is_valid():
    for gid in ACTIVE_GATES:
        text = _read(os.path.join(_GATES, gid + ".md"))
        m = re.search(r"\*\*tier:\*\*\s*`?([a-z-]+)`?", text)
        assert m, "gates/%s.md has no parseable tier" % gid
        assert m.group(1) in VALID_TIERS, "gates/%s.md tier '%s' invalid" % (gid, m.group(1))


def test_tier_labels_consistent_across_docs():
    """Each active gate's tier must match the gate file's DECLARED tier across EVERY surface that names it —
    SKILL.md's '(tier)' annotation, the gate-runner starter table, the usecase-gate-map status row, and
    the CHANGELOG. Guards the cross-file tier-label drift class (e.g. a doc still saying 'objective' after
    a gate was re-tiered to 'mixed')."""
    skill = _read(os.path.join(_REPO_ROOT, "skills", "architect", "SKILL.md"))
    runner = _read(_RUNNER)
    gatemap = _read(_GATEMAP)
    changelog = _read(os.path.join(_REPO_ROOT, "CHANGELOG.md"))
    for gid in ACTIVE_GATES:
        gate = _read(os.path.join(_GATES, gid + ".md"))
        declared = re.search(r"\*\*tier:\*\*\s*`?([a-z-]+)`?", gate).group(1)
        surfaces = {
            "SKILL.md": re.search(r"gates/%s\.md\)\s*\(([a-z-]+)" % re.escape(gid), skill),
            "gate-runner table": re.search(r"\|\s*%s\s*\|[^|]*\|\s*([a-z-]+)\s*\|" % re.escape(gid), runner),
            "usecase-gate-map status row": re.search(r"\|\s*\*\*%s\*\*\s*\|[^|]*\|\s*([a-z-]+)" % re.escape(gid), gatemap),
            "CHANGELOG": re.search(r"\*\*%s\*\*\s*\(([a-z-]+)" % re.escape(gid), changelog),
        }
        for where, m in surfaces.items():
            assert m, "%s must name a tier for the %s gate" % (where, gid)
            assert m.group(1) == declared, (
                "%s labels %s '%s' but the gate file declares '%s'" % (where, gid, m.group(1), declared)
            )


def test_each_gate_id_matches_filename():
    for gid in ACTIVE_GATES:
        text = _read(os.path.join(_GATES, gid + ".md"))
        m = re.search(r"\*\*id:\*\*\s*`([^`]+)`", text)
        assert m and m.group(1) == gid, "gates/%s.md id must be `%s`" % (gid, gid)


def test_runner_encodes_the_contract():
    runner = _read(_RUNNER)
    low = runner.lower()
    # Anti-theater invariant must be stated as a PROHIBITION, not merely a keyword. Mutation-resistant:
    # require a single line that co-locates "status: pass" + "evidence" with a negation ("no"/"never")
    # binding the pass. An inverted rule ("a status: pass MAY exist without evidence") has no negation
    # before "status: pass" and must therefore FAIL this assertion.
    invariant_ok = False
    for ln in runner.splitlines():
        l = ln.lower()
        if "status: pass" in l and "evidence" in l:
            prefix = l.split("status: pass")[0]
            if "no " in prefix or "never" in prefix or prefix.rstrip().endswith("no"):
                invariant_ok = True
                break
    assert invariant_ok, (
        "gate-runner must PROHIBIT an evidence-less pass: a 'no/never ... status: pass without evidence' "
        "line (keyword presence alone is insufficient — anti-theater)"
    )
    assert "tier" in low and "confidence" in low, "invariant must also require tier + confidence"
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


def test_a11y_gate_uses_the_normalizer():
    text = _read(os.path.join(_GATES, "a11y.md"))
    assert "a11y_report.py" in text, "a11y gate must reference the bundled runner-output normalizer"
    assert os.path.isfile(_A11Y_REPORT), "gates/lib/a11y_report.py must exist"


def test_a11y_does_not_regate_uiux_checks():
    """Single-owner decomposition guard: a11y must defer contrast/alt/name/tap-target to ui-ux (advisory)
    and never re-gate them; its no-runner path must FLAG (not a borrowed-evidence pass); and it must carry
    the PASS != conformance caveat. Cheap guard against a future edit silently double-gating ui-ux's checks."""
    text = _read(os.path.join(_GATES, "a11y.md")).lower()
    assert "ui-ux" in text, "a11y must reference ui-ux as the owner of the cheap checks"
    assert "advisory" in text, "a11y must surface ui-ux-owned violations as advisory (not gating)"
    assert "flag" in text, "a11y no-runner/browserless path must flag, never a borrowed-evidence pass"
    assert "conformance" in text, "a11y must carry the PASS != conformance caveat"


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
