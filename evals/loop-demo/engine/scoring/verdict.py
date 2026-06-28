#!/usr/bin/env python3
# verdict.py -- mechanically apply the PRE-REGISTERED decision rule to results.json.
# The pre-registration declares this script INSTRUMENT-AUTHORITATIVE: the JSON decides.
#
#   python aggregate.py harness-1 <p> harness-2 <p> control-1 <p> control-2 <p> ...   # writes results.json
#   python verdict.py                                                                 # reads results.json, prints verdict
#
# Arms are grouped by label prefix before the first '-': "harness-*" vs "control-*".
# Constants are the pre-registered thresholds (PREREGISTRATION.md section 6) -- do not change post-hoc.
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MARGIN = 0.25          # |Fh - Fc| threshold for win/loss
HARNESS_MIN = 0.67     # harness must achieve substantial fidelity to "win"
FLOOR_MIN = 0.90       # every floor family must clear this
CEIL_NULL = 0.90       # both arms >= this on F_FID -> degenerate ceiling null
FLOOR_NULL = 0.20      # both arms < this -> degenerate floor null (too hard)

def mean(xs):
    xs = [x for x in xs if isinstance(x, (int, float))]
    return round(sum(xs) / len(xs), 4) if xs else None

def main():
    path = os.path.join(HERE, "results.json")
    if not os.path.exists(path):
        print("no results.json; run aggregate.py first"); return
    rows = [r for r in json.load(open(path, encoding="utf-8")) if "error" not in r]
    groups = {}
    for r in rows:
        role = r["label"].split("-")[0]
        groups.setdefault(role, []).append(r)
    if "harness" not in groups or "control" not in groups:
        print("need both harness-* and control-* arms in results.json; have:", list(groups)); return

    Fh = mean([r.get("primary") for r in groups["harness"]])
    Fc = mean([r.get("primary") for r in groups["control"]])
    harness_floor_ok = all(r.get("floor_ok") and r.get("hard_ok") for r in groups["harness"])
    delta = round((Fh - Fc), 4) if (Fh is not None and Fc is not None) else None

    print("=== PRE-REGISTERED VERDICT (verdict.py, instrument-authoritative) ===")
    print("harness builds : " + ", ".join("{}={}".format(r["label"], r.get("primary")) for r in groups["harness"]))
    print("control builds : " + ", ".join("{}={}".format(r["label"], r.get("primary")) for r in groups["control"]))
    print("mean F_FID      : harness Fh={}  control Fc={}  delta={}".format(Fh, Fc, delta))
    print("harness floor_ok+hard_ok (all builds): {}".format(harness_floor_ok))

    if Fh is None or Fc is None:
        print("VERDICT: INCONCLUSIVE (missing scores)"); return
    if Fh >= CEIL_NULL and Fc >= CEIL_NULL:
        print("VERDICT: NULL (degenerate ceiling -- task easy for both arms, like v0.8.0)"); return
    if Fh < FLOOR_NULL and Fc < FLOOR_NULL:
        print("VERDICT: NULL (degenerate floor -- task too hard for both; inconclusive)"); return
    if delta >= MARGIN and Fh >= HARNESS_MIN and harness_floor_ok:
        print("VERDICT: HARNESS WINS (delta {} >= {}, Fh {} >= {}, floor/hard ok)".format(delta, MARGIN, Fh, HARNESS_MIN)); return
    if delta >= MARGIN and not (Fh >= HARNESS_MIN and harness_floor_ok):
        print("VERDICT: NULL (margin met but harness did not clear Fh>={} / floor / hard -- not a clean win)".format(HARNESS_MIN)); return
    if (-delta) >= MARGIN:
        print("VERDICT: LOSS (control beat the harness by >= {})".format(MARGIN)); return
    print("VERDICT: NULL (|delta| {} < margin {})".format(abs(delta), MARGIN))

if __name__ == "__main__":
    main()
