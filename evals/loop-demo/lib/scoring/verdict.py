#!/usr/bin/env python3
# verdict.py -- mechanically apply the PRE-REGISTERED, DECOMPOSED decision rule to results.json.
# Instrument-authoritative: the JSON decides. Arms grouped by label prefix before '-'
# (control / harness / harnessnr). Thresholds are pilot-calibrated and frozen in PREREGISTRATION.md.
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
MARGIN = 0.10        # absolute completeness uplift to declare a win (pilot-calibrated)
CEIL = 0.975         # an axis is "at ceiling" (degenerate) if a group mean >= this

def mean(xs):
    xs = [x for x in xs if isinstance(x, (int, float))]
    return round(sum(xs) / len(xs), 4) if xs else None

def spread(xs):
    xs = [x for x in xs if isinstance(x, (int, float))]
    return round(max(xs) - min(xs), 4) if len(xs) > 1 else 0.0

def main():
    path = os.path.join(HERE, "results.json")
    if not os.path.exists(path):
        print("no results.json; run aggregate.py first"); return
    rows = json.load(open(path, encoding="utf-8"))
    groups = {}
    for r in rows:
        groups.setdefault(r["label"].split("-")[0], []).append(r)
    if "harness" not in groups or "control" not in groups:
        print("need harness-* and control-* arms; have:", list(groups)); return

    def axis(group, key):
        return mean([r.get(key) for r in groups[group]]), spread([r.get(key) for r in groups[group]])

    print("=== PRE-REGISTERED DECOMPOSED VERDICT (verdict.py, instrument-authoritative) ===")
    for g in groups:
        om, oms = axis(g, "omission_completeness"); ed, eds = axis(g, "edge_correctness"); co, cos = axis(g, "completeness")
        floor = all(r.get("hard_ok") for r in groups[g])
        print("  %-10s n=%d  OMISSION=%s(spread %.3f)  EDGE=%s  COMPLETE=%s(spread %.3f)  hard_ok=%s"
              % (g, len(groups[g]), om, oms, ed, co, cos, floor))

    om_h, _ = axis("harness", "omission_completeness"); om_c, om_c_sp = axis("control", "omission_completeness")
    co_h, _ = axis("harness", "completeness"); co_c, _ = axis("control", "completeness")
    ed_h, _ = axis("harness", "edge_correctness"); ed_c, _ = axis("control", "edge_correctness")

    print("\n-- HEADLINE: completeness-under-scale (OMISSION axis) --")
    d_om = round(om_h - om_c, 4)
    if om_c >= CEIL and om_h >= CEIL:
        print("VERDICT(omission): NULL (ceiling -- single shots did NOT drop whole exports; the "
              "completeness-under-scale mechanism had nothing to act on). delta=%s" % d_om)
    elif om_c >= 1.0:
        print("VERDICT(omission): NULL (omission axis NOT LIVE -- control omitted nothing; cannot test drop-prevention). delta=%s" % d_om)
    elif d_om >= MARGIN and d_om > om_c_sp:
        print("VERDICT(omission): HARNESS WINS (delta %s >= margin %s and > control within-arm spread %s)" % (d_om, MARGIN, om_c_sp))
    elif round(om_c - om_h, 4) >= MARGIN:
        print("VERDICT(omission): LOSS (control more complete by %s)" % round(om_c - om_h, 4))
    else:
        print("VERDICT(omission): NULL (|delta| %s < margin %s, or within within-arm spread %s)" % (abs(d_om), MARGIN, om_c_sp))

    print("\n-- SECONDARY findings (reported, NOT the completeness-under-scale claim) --")
    print("EDGE-correctness delta (harness - control) = %s   [label: 'per-slice focus aids edge correctness']"
          % (round(ed_h - ed_c, 4) if (ed_h is not None and ed_c is not None) else "n/a"))
    print("COMPLETENESS (composite) delta = %s" % round(co_h - co_c, 4))
    print("CASCADE-isolation: inspect 'cascade_by_ws' + 'edge_fail' in results.json for shared-root clusters")
    if "harnessnr" in groups:
        nr_om, _ = axis("harnessnr", "omission_completeness"); nr_co, _ = axis("harnessnr", "completeness")
        print("RETRY-confound control (harness NO-repair): OMISSION=%s COMPLETE=%s (vs harness-with-repair %s/%s)"
              % (nr_om, nr_co, om_h, co_h))

if __name__ == "__main__":
    main()
