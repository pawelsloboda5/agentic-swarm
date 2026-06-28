#!/usr/bin/env python3
"""Run the SAME instrument over all four showcase arms and emit one scorecards.json + a table.

Deterministic for the static scorer; the runtime scorer is live (Playwright) so its numbers can vary
run-to-run (it is the held-out PRIMARY readout, recorded as observed). a11y gating count reuses the gate's
own a11y_report.py normalizer over the axe violation ids (consistency with the shipped a11y gate).

Usage:  python aggregate.py            (writes scorecards.json, prints a table)
ASCII-only output (cp1252-safe).
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
LIB = os.path.join(REPO, "skills", "architect", "gates", "lib")
sys.path.insert(0, LIB)
import a11y_report  # noqa: E402

ARMS = [
    ("baseline_off", os.path.join(REPO, "evals", "loop-demo", "baseline", "index.html")),
    ("baseline_on", os.path.join(REPO, "evals", "loop-demo", "agentic-swarm", "index.html")),
    ("fair_control", os.path.join(REPO, "evals", "loop-demo", "game", "baseline-fair", "index.html")),
    ("harness", os.path.join(REPO, "evals", "loop-demo", "game", "index.html")),
]


def run_json(cmd):
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        return json.loads(out.stdout)
    except Exception as exc:  # noqa: BLE001
        return {"error": "scorer failed: %s" % (str(exc)[:120])}


def a11y_gating(axe_ids):
    # Re-use the shipped gate normalizer: a11y gates only on non-ui-ux-owned rule ids.
    fake = {"violations": [{"id": i, "nodes": [{}]} for i in (axe_ids or [])]}
    v = a11y_report.normalize(fake, "axe")
    return v["gating_violations"], v["advisory_violations"]


def main():
    cards = {}
    for name, path in ARMS:
        static = run_json([sys.executable, os.path.join(HERE, "score_static.py"), path])
        runtime = run_json(["node", os.path.join(HERE, "score_runtime.mjs"), path])
        gating, advisory = a11y_gating(runtime.get("axe_violation_ids"))
        cards[name] = {"path": os.path.relpath(path, REPO).replace("\\", "/"), "static": static, "runtime": runtime,
                       "a11y_gating_violations": gating, "a11y_advisory_violations": advisory}
    with open(os.path.join(HERE, "scorecards.json"), "w", encoding="utf-8") as fh:
        json.dump(cards, fh, indent=2)

    # Compact table
    cols = ["lines", "contrast", "uiux_states", "a11y_gate", "assets_ok", "features", "robust", "runtime_primary"]
    print("arm".ljust(14) + "".join(c.ljust(13) for c in cols))
    for name, c in cards.items():
        s, r = c.get("static", {}), c.get("runtime", {})
        con = s.get("contrast", {})
        ux = s.get("uiux_static", {})
        asset = s.get("assets", {})
        primary = "PASS" if (r.get("loaded") and r.get("uncaught_errors") == 0 and r.get("render_nonblank")) else "FAIL"
        row = {
            "lines": s.get("meta", {}).get("lines", "?"),
            "contrast": "%s/%s" % (con.get("pairs_passing", "?"), con.get("pairs_checked", "?")),
            "uiux_states": ("H" if ux.get("has_hover") else "-") + ("F" if ux.get("has_focus_visible") else "-") + ("B" if ux.get("has_breakpoint") else "-") + ("S" if ux.get("has_spacing_scale") else "-"),
            "a11y_gate": "%dg/%da" % (c.get("a11y_gating_violations", 0), c.get("a11y_advisory_violations", 0)),
            "assets_ok": "ok" if (asset.get("placeholder_hits") == 0 and asset.get("external_asset_refs") == 0 and asset.get("procedural_only")) else "no",
            "features": "%s/7" % s.get("features", {}).get("features_count", "?"),
            "robust": "%s/4" % s.get("runtime_static_robustness", {}).get("score", "?"),
            "runtime_primary": "%s(e%s,nb%s)" % (primary, r.get("uncaught_errors", "?"), 1 if r.get("render_nonblank") else 0),
        }
        print(name.ljust(14) + "".join(str(row[c]).ljust(13) for c in cols))


if __name__ == "__main__":
    main()
