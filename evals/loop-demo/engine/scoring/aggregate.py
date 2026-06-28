#!/usr/bin/env python3
# aggregate.py -- run invariants.mjs over each arm's index.html and tabulate the held-out scores.
#
#   python aggregate.py <label> <path/to/index.html> [<label> <path> ...]
#
# Prints, per arm: the PRIMARY family F_FID (state fidelity under continuation -- the
# pilot-confirmed discriminator), the five CONFORMANCE-FLOOR families, the two HARD-FLOOR
# disqualifiers, an equal-weight 6-family mean (so no family's assertion count dominates),
# and a floor_ok flag (every floor family >= FLOOR_MIN). Writes results.json for the record.
# Scoring is mechanical and re-runnable; the emitted JSON is authoritative.
import json, subprocess, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
PRIMARY = "F_FID"
FLOOR = ["F_DET", "F_SNAP", "F_IDEM", "F_CONS", "F_MONO"]
FAM = [PRIMARY] + FLOOR
FLOOR_MIN = 0.90          # a competent build must clear this on every floor family (pre-registered)
SEEDS = "5"

def score(label, path):
    if not os.path.exists(path):
        return {"label": label, "error": "missing artifact: " + path}
    try:
        out = subprocess.run(["node", os.path.join(HERE, "invariants.mjs"), path, SEEDS],
                             capture_output=True, text=True, timeout=900, cwd=HERE)
    except subprocess.TimeoutExpired:
        return {"label": label, "error": "scorer timed out"}
    lines = (out.stdout or "").strip().splitlines()
    if not lines:
        return {"label": label, "error": "no output; stderr=" + (out.stderr or "")[:200]}
    try:
        r = json.loads(lines[-1])
    except Exception as e:
        return {"label": label, "error": "parse fail: " + str(e) + " :: " + lines[-1][:200]}
    r["label"] = label
    pfr = r.get("per_family_rate", {})
    rates = [pfr.get(f) for f in FAM if isinstance(pfr.get(f), (int, float))]
    r["equal_weight"] = round(sum(rates) / len(rates), 4) if rates else None
    r["primary"] = pfr.get(PRIMARY)
    floor_vals = [pfr.get(f) for f in FLOOR]
    r["floor_ok"] = all(isinstance(v, (int, float)) and v >= FLOOR_MIN for v in floor_vals)
    hf = r.get("hard_floor", {})
    r["hard_ok"] = bool(hf.get("no_hang")) and bool(hf.get("no_throw"))
    return r

def cell(v):
    return "{:.2f}".format(v) if isinstance(v, (int, float)) else "  -"

def main():
    if len(sys.argv) < 3 or len(sys.argv) % 2 != 1:
        print("usage: python aggregate.py <label> <path> [<label> <path> ...]"); return
    arms = [(sys.argv[i], sys.argv[i + 1]) for i in range(1, len(sys.argv), 2)]
    results = [score(lbl, pth) for (lbl, pth) in arms]

    cols = ["arm", PRIMARY + "*"] + FLOOR + ["EQ-WT", "floor", "hard"]
    widths = [16, 8] + [7] * len(FLOOR) + [7, 6, 6]
    def row(vals):
        return "  ".join(str(v).rjust(w) if i else str(v).ljust(w) for i, (v, w) in enumerate(zip(vals, widths)))
    print(row(cols)); print("-" * (sum(widths) + 2 * len(widths)))
    for r in results:
        if "error" in r:
            print(r["label"].ljust(16) + "  ERROR: " + r["error"]); continue
        pfr = r.get("per_family_rate", {})
        print(row([r["label"][:16], cell(pfr.get(PRIMARY))] + [cell(pfr.get(f)) for f in FLOOR]
                  + ["{:.3f}".format(r["equal_weight"]) if r.get("equal_weight") is not None else "-",
                     "OK" if r["floor_ok"] else "FAIL", "OK" if r["hard_ok"] else "FAIL"]))
    print("\n* F_FID = the PRIMARY (state fidelity under continuation). floor = all five floor families >= "
          + str(FLOOR_MIN) + ". hard = no hang + no throw.")
    outp = os.path.join(HERE, "results.json")
    with open(outp, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("raw -> " + outp)

if __name__ == "__main__":
    main()
