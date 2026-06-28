"""Unit tests for the a11y runner-output normalizer (gates/lib/a11y_report.py).

Guards the v0.7.1 standalone a11y gate's TDD anchor against the defects the planning critique
(wf_48ee3d82-2de) caught:
- heterogeneous runner shapes: axe object vs CLI array-of-pages; pa11y JS-API object vs CLI BARE ARRAY,
- single-owner decomposition: ui-ux-owned rules (contrast/alt/name/tap-target) are ADVISORY, never gating,
- Lighthouse is advisory + null-safe (never a hard gate, never coerced to 0),
- fail-closed: garbage / wrong-shape JSON NEVER yields count==0 => pass,
- CLI exit codes mirror wcag_contrast.py (0 pass / 1 fail / 2 bad-input).

Pure stdlib (conftest puts skills/architect/gates/lib on sys.path).
"""
import json

import pytest

import a11y_report as a


# --- axe: programmatic object form {violations:[{id,nodes}]} ---
def test_axe_object_form_counts_gating_violations():
    data = {
        "violations": [
            {"id": "landmark-one-main", "nodes": [{}]},   # a11y-distinctive -> gates
            {"id": "color-contrast", "nodes": [{}, {}]},  # ui-ux-owned -> advisory
        ],
        "incomplete": [{"id": "color-contrast", "nodes": [{}]}],
    }
    v = a.normalize(data, "axe")
    assert v["runner"] == "axe"
    assert v["gating_violations"] == 1      # only landmark-one-main gates
    assert v["advisory_violations"] == 1    # color-contrast partitioned out
    assert v["incomplete_count"] == 1       # surfaced, not gating
    assert v["pass"] is False               # 1 gating violation
    assert v["error"] is None


# --- axe: CLI array-of-pages form [{violations:[...]}, ...] ---
def test_axe_cli_array_form_sums_pages_and_passes_clean():
    data = [{"violations": []}, {"violations": []}]
    v = a.normalize(data, "axe")
    assert v["gating_violations"] == 0 and v["pass"] is True and v["error"] is None


# --- pa11y: JS API object form {issues:[...]} ---
def test_pa11y_object_form_errors_only():
    data = {"issues": [
        {"code": "WCAG2AA.Principle1.Guideline1_3.1_3_1.H42.2", "type": "error"},  # structure -> gates
        {"code": "WCAG2AA.Principle1.Guideline1_4.1_4_3.G18", "type": "error"},     # 1_4_3 contrast -> advisory
        {"code": "X", "type": "warning"},                                          # warning -> skipped (not an error)
    ]}
    v = a.normalize(data, "pa11y")
    assert v["gating_violations"] == 1      # only the structure error gates
    assert v["errors_only"] == 2            # both type==error counted before the ui-ux partition
    assert v["pass"] is False


# --- pa11y: CLI BARE ARRAY form [{type,...}] (the false-pass trap) ---
def test_pa11y_cli_bare_array_is_not_a_false_pass():
    data = [{"code": "WCAG2AA.Principle1.Guideline1_3.1_3_1.H42.2", "type": "error"}]
    v = a.normalize(data, "pa11y")
    assert v["gating_violations"] == 1 and v["pass"] is False   # NOT silently 0/pass


# --- ui-ux-owned-only input gates clean (deferred to ui-ux) ---
def test_only_uiux_owned_violations_do_not_gate_a11y():
    data = {"violations": [
        {"id": "color-contrast", "nodes": [{}]},
        {"id": "image-alt", "nodes": [{}]},
        {"id": "target-size", "nodes": [{}]},
    ]}
    v = a.normalize(data, "axe")
    assert v["gating_violations"] == 0 and v["advisory_violations"] == 3 and v["pass"] is True


# --- lighthouse: advisory score, never a hard gate ---
def test_lighthouse_valid_score_is_advisory_not_gating():
    data = {"categories": {"accessibility": {"score": 0.82}}}
    v = a.normalize(data, "lighthouse")
    assert v["score"] == 0.82 and v["advisory"] is True
    assert v["pass"] is True       # advisory score never hard-fails
    assert v["degraded"] is True   # lighthouse-only => no hard gate => degraded


def test_lighthouse_null_score_is_degraded_not_zero():
    v = a.normalize({"categories": {"accessibility": {"score": None}}}, "lighthouse")
    assert v["score"] is None and v["degraded"] is True and v["error"] is not None
    assert v["pass"] is False


def test_lighthouse_runtime_error_is_degraded():
    v = a.normalize(
        {"runtimeError": {"code": "NO_FCP"}, "categories": {"accessibility": {"score": 0.0}}},
        "lighthouse",
    )
    assert v["degraded"] is True and v["error"] is not None and v["pass"] is False


# --- axe empty top-level array means zero pages audited => fail closed (not a clean count==0 pass) ---
def test_axe_empty_top_level_array_fails_closed():
    v = a.normalize([], "axe")
    assert v["error"] is not None and v["pass"] is False
    assert v["gating_violations"] == 0     # but NOT a pass — error is set


# --- a JSON bool score is not a valid lighthouse score (bool subclasses int) ---
def test_lighthouse_bool_score_rejected():
    v = a.normalize({"categories": {"accessibility": {"score": True}}}, "lighthouse")
    assert v["error"] is not None and v["pass"] is False


# --- fail-closed on garbage / wrong-shape, for EVERY runner (not just axe) ---
def test_garbage_json_does_not_pass():
    cases = {
        # axe `[]` is empty-pages => fail closed; pa11y `[]` is a clean page (legit pass) so it is NOT here.
        "axe": [42, "nope", {"unexpected": 1}, {"violations": "notalist"}, []],
        "pa11y": [42, "nope", {"unexpected": 1}, {"issues": "notalist"}, [1, 2]],   # bare array of non-dicts
        "lighthouse": [42, "nope", {"categories": {}}, {"categories": {"accessibility": {}}},
                       {"categories": {"accessibility": {"score": "0.9"}}}],
    }
    for runner, bads in cases.items():
        for bad in bads:
            v = a.normalize(bad, runner)
            assert v["error"] is not None and v["pass"] is False, (runner, bad)   # never count==0 => pass


def test_unknown_runner_errors():
    with pytest.raises(ValueError):
        a.normalize({"violations": []}, "bogus")


# --- CLI exit codes mirror wcag_contrast.py (0 pass / 1 fail / 2 bad-input) ---
def test_cli_exit_codes(tmp_path):
    p = tmp_path / "axe.json"
    p.write_text(json.dumps({"violations": []}), encoding="utf-8")
    assert a._main([str(p), "--runner", "axe"]) == 0

    p.write_text(json.dumps({"violations": [{"id": "tabindex", "nodes": [{}]}]}), encoding="utf-8")
    assert a._main([str(p), "--runner", "axe"]) == 1

    p.write_text("{ not json", encoding="utf-8")
    assert a._main([str(p), "--runner", "axe"]) == 2          # unparseable JSON

    p.write_text(json.dumps({"unexpected": 1}), encoding="utf-8")
    assert a._main([str(p), "--runner", "axe"]) == 2          # valid JSON, wrong shape -> fail-closed exit 2


def test_cli_bad_args():
    assert a._main([]) == 2                                   # no path, no runner
    assert a._main(["x.json"]) == 2                           # no --runner
    assert a._main(["x.json", "--runner"]) == 2               # --runner without a value
    assert a._main(["x.json", "--runner", "bogus"]) == 2      # unknown runner
    assert a._main(["x.json", "--frobnicate"]) == 2           # unknown flag
