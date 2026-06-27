"""Structural + invariant tests for the /agentic-swarm:architect skill (v0.6.0).

These guard the converged design contract without re-implementing it:
- the skill lives at skills/architect/ (command = directory name => /agentic-swarm:architect),
- its frontmatter is EXACTLY name+description (the repo-wide skills invariant),
- the headline novelty is present in the brief template (gate criteria forward-coupled into the
  brief) alongside skill-aware briefing,
- the use-case->gate map keeps the anti-theater scoping (non-MVP gates marked future),
- the Phase-4 persistence back-edge references the shipped /loop rails rather than duplicating them.

Pure stdlib (no YAML dep): the frontmatter is simple `key: value` lines, parsed by hand.
"""
import os
import re

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SKILL_DIR = os.path.join(_REPO_ROOT, "skills", "architect")
_SKILL_MD = os.path.join(_SKILL_DIR, "SKILL.md")
_BRIEF = os.path.join(_SKILL_DIR, "reference", "brief-template.md")
_GATEMAP = os.path.join(_SKILL_DIR, "reference", "usecase-gate-map.md")


def _read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def _frontmatter_keys(text):
    """Top-level keys in the leading `---`-delimited YAML frontmatter block."""
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    assert m, "SKILL.md must start with a `---` frontmatter block"
    keys = []
    for line in m.group(1).splitlines():
        km = re.match(r"^([A-Za-z][A-Za-z0-9_-]*):", line)
        if km:
            keys.append(km.group(1))
    return keys


def test_skill_file_exists():
    assert os.path.isfile(_SKILL_MD), "skills/architect/SKILL.md must exist"


def test_frontmatter_is_exactly_name_and_description():
    keys = _frontmatter_keys(_read(_SKILL_MD))
    assert set(keys) == {"name", "description"}, (
        "skills frontmatter invariant: exactly name+description, got " + repr(keys)
    )


def test_skill_name_matches_directory():
    # Command name derives from the DIRECTORY (skills/architect -> /agentic-swarm:architect);
    # the frontmatter `name` is the display label and should agree.
    text = _read(_SKILL_MD)
    m = re.search(r"^name:\s*(.+?)\s*$", text, re.MULTILINE)
    assert m and m.group(1).strip() == "architect", "frontmatter name must be 'architect'"
    # The directory basename IS the command name, so it must equal the frontmatter name.
    assert os.path.basename(_SKILL_DIR) == "architect", "skill directory must be named 'architect'"


def test_reference_files_exist():
    assert os.path.isfile(_BRIEF), "reference/brief-template.md must exist"
    assert os.path.isfile(_GATEMAP), "reference/usecase-gate-map.md must exist"


def test_skill_links_its_reference_files():
    body = _read(_SKILL_MD)
    assert "brief-template.md" in body, "SKILL.md must point to the brief template"
    assert "usecase-gate-map.md" in body, "SKILL.md must point to the use-case->gate map"


def test_brief_template_forward_couples_gates_and_skills():
    brief = _read(_BRIEF)
    # The headline novelty: the gate's pass-criteria are forward-coupled into the brief.
    assert re.search(r"MUST\s+PASS", brief, re.IGNORECASE), (
        "brief template must contain a 'MUST PASS ... GATES' block (gate forward-coupling)"
    )
    assert "gate" in brief.lower(), "brief template must reference gates"
    # Skill-aware briefing.
    assert re.search(r"invoke\s+skill", brief, re.IGNORECASE), (
        "brief template must instruct the worker to invoke skills if available"
    )


def test_gatemap_has_antitheater_scoping():
    gatemap = _read(_GATEMAP).lower()
    # Non-MVP gates must be marked as not-yet-built so the architect never forward-couples a gate
    # that has no shipped, checkable criteria.
    assert "future" in gatemap or "not-yet-built" in gatemap or "not yet built" in gatemap, (
        "use-case->gate map must mark non-MVP gates as future/not-yet-built (anti-theater)"
    )
    # The MVP gate set must be present.
    for gate in ("tests", "assets", "ui-ux"):
        assert gate in gatemap, "MVP gate '%s' must appear in the map" % gate


def test_gatemap_active_column_excludes_unbuilt_gates():
    """Machine-enforce anti-theater: the 'Active in MVP (forward-coupled now)' column of the default
    map must never promise an unbuilt gate. (a11y is exempt — it is *folded into* ui-ux, not a
    standalone forward-coupled gate, so it legitimately appears as prose in the active column.)"""
    text = _read(_GATEMAP)
    idx = text.find("## Default map")
    assert idx != -1, "usecase-gate-map must have a '## Default map' section"
    section = text[idx:]
    forbidden = [
        "`api-contract`", "`security`", "`docs`", "`perf`", "`data-viz`",
        "`completeness`", "`source-verification`", "`contract`",
    ]
    offenders = []
    for line in section.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        cells = [c.strip() for c in stripped.strip("|").split("|")]
        if len(cells) < 3:
            continue
        active = cells[-1]  # the 'Active in MVP (forward-coupled now)' column
        # skip the header row and the |---|---| separator row
        if active.lower().startswith("active") or set(active) <= set("-: "):
            continue
        for tok in forbidden:
            if tok in active:
                offenders.append("%s in active column: %s" % (tok, active))
    assert not offenders, (
        "future/unbuilt gate forward-coupled in the 'Active in MVP' column:\n  " + "\n  ".join(offenders)
    )


def test_phase4_references_loop_rails():
    body = _read(_SKILL_MD)
    assert "loops.md" in body, (
        "Phase 4 must reference skills/agentic-swarm/reference/loops.md (not duplicate the /loop rails)"
    )
