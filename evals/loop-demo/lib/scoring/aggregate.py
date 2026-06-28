#!/usr/bin/env python3
# aggregate.py -- score each arm by running score-one.mjs once PER EXPORT in its own child process
# with a PER-EXPORT timeout (blocker-1 isolation: a hang/crash costs exactly 1/40, never the whole arm).
# Composes the three decomposed axes (OMISSION-completeness / EDGE-correctness / COMPLETENESS) plus the
# hard floor and a cascade-by-workstream readout. Writes results.json. Mechanical + re-runnable.
#
#   python aggregate.py <label> <armDir-or-lib.mjs> [<label> <armDir> ...]
#
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCORE_ONE = os.path.join(HERE, "score-one.mjs")
PER_EXPORT_TIMEOUT = 8  # seconds; a sync infinite loop in one export is killed here, others survive
INVOLUTION_OR_CANON = {"involution", "canon"}

def export_names():
    with open(os.path.join(HERE, "vectors.json"), encoding="utf-8") as f:
        return list(json.load(f).keys())

def score_export(arm_path, name):
    try:
        p = subprocess.run(["node", SCORE_ONE, arm_path, name],
                           capture_output=True, text=True, timeout=PER_EXPORT_TIMEOUT, cwd=HERE)
    except subprocess.TimeoutExpired:
        return {"export": name, "present": False, "happy_ok": False, "happy_pass": 0,
                "edge_pass": 0, "edge_total": 0, "edge_ok": False, "prop_ok": None,
                "threw": False, "hang": True}
    line = (p.stdout or "").strip().splitlines()
    if not line:
        return {"export": name, "present": False, "happy_ok": False, "edge_pass": 0, "edge_total": 0,
                "edge_ok": False, "prop_ok": None, "threw": True, "crash": (p.stderr or "")[:160]}
    try:
        r = json.loads(line[-1])
    except Exception as e:
        return {"export": name, "present": False, "happy_ok": False, "edge_pass": 0, "edge_total": 0,
                "edge_ok": False, "prop_ok": None, "threw": True, "parse_error": str(e)}
    return r

def score_arm(label, arm_path):
    names = export_names()
    per = [score_export(arm_path, n) for n in names]
    n = len(per)
    delivered, fully, edge_pass, edge_total = [], [], 0, 0
    no_hang, no_throw = True, True
    dropped, edge_fail, cascade = [], [], {}
    for r in per:
        d = bool(r.get("present")) and bool(r.get("happy_ok"))
        delivered.append(d)
        if r.get("hang"):
            no_hang = False
        if r.get("threw"):
            no_throw = False
        # fully_correct: present + happy + all edges; block on prop only for involution/canon
        prop = r.get("prop_ok")
        prop_block = (r.get("kind") in INVOLUTION_OR_CANON) and (prop is False)
        fc = d and bool(r.get("edge_ok")) and not prop_block
        fully.append(fc)
        if d:  # edge axis only meaningful among delivered exports
            edge_pass += int(r.get("edge_pass") or 0)
            edge_total += int(r.get("edge_total") or 0)
        if not d:
            dropped.append(r["export"])
        elif not fc:
            edge_fail.append(r["export"])
        if not fc:
            ws = r.get("ws") or "?"
            cascade[ws] = cascade.get(ws, 0) + 1
    omission = round(sum(delivered) / n, 4)
    completeness = round(sum(fully) / n, 4)
    edge_rate = round(edge_pass / edge_total, 4) if edge_total else None
    return {
        "label": label, "n": n,
        "omission_completeness": omission,
        "edge_correctness": edge_rate,
        "completeness": completeness,
        "hard_ok": no_hang and no_throw, "no_hang": no_hang, "no_throw": no_throw,
        "dropped": dropped, "edge_fail": edge_fail, "cascade_by_ws": cascade,
        "per_export": per,
    }

def cell(v):
    return "{:.3f}".format(v) if isinstance(v, (int, float)) else "  -"

def main():
    if len(sys.argv) < 3 or len(sys.argv) % 2 != 1:
        print("usage: python aggregate.py <label> <armDir-or-lib.mjs> [<label> <armDir> ...]"); return
    arms = [(sys.argv[i], sys.argv[i + 1]) for i in range(1, len(sys.argv), 2)]
    results = [score_arm(lbl, pth) for (lbl, pth) in arms]
    cols = ["arm", "OMISSION", "EDGE", "COMPLETE", "hard"]
    w = [16, 9, 9, 9, 6]
    def row(vals): return "  ".join(str(v).ljust(w[i]) if i == 0 else str(v).rjust(w[i]) for i, v in enumerate(vals))
    print(row(cols)); print("-" * (sum(w) + 2 * len(w)))
    for r in results:
        print(row([r["label"][:16], cell(r["omission_completeness"]), cell(r["edge_correctness"]),
                   cell(r["completeness"]), "OK" if r["hard_ok"] else "FAIL"]))
        if r["dropped"]:
            print("    dropped (omission): " + ", ".join(r["dropped"]))
        if r["edge_fail"]:
            print("    edge-fail: " + ", ".join(r["edge_fail"]))
    outp = os.path.join(HERE, "results.json")
    with open(outp, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("\nOMISSION-completeness = headline (completeness-under-scale). EDGE/CASCADE = separate findings.")
    print("raw -> " + outp)

if __name__ == "__main__":
    main()
