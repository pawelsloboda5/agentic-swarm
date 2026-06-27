# Origin — the 2-hour silent stall this skill exists to prevent

This skill is the distilled post-mortem of one real swarm: **41 agents** fanned out across
**19 research sub-areas** in a single `pipeline()` — no waves, no watchdog, no per-agent guard.
It *did* eventually deliver — **18 of 19 sub-areas** recovered across **two manual resumes** —
but only after a **~2-hour silent stall** and **17 agent failures** along the way, with
**3 agents left hung** at the end. The point of the skill is that the *next* swarm pays none of
that tax.

## The failure signature

The dominant error was `API Error: Connection closed mid-response` — the model stream dropping
mid-generation. It is **environmental/transient, not a logic bug**: a different set of agents
failed on each run (3 → 4 → 13 across attempts), and the **heaviest agents failed most** (longest
outputs spend the longest on the wire, so they have the highest drop probability). Two outcomes:

1. **Clean failure** — `agent()` exhausts its internal retries and returns `null`. Survivable.
2. **The killer** — a connection that never resolves *or* rejects. `agent()` never returns, so any
   barrier `await`-ing it deadlocks **forever**. The harness notifies on *completion*, never on
   *stall* — so nothing fired. One hung item inside the one big `pipeline()` barrier hung the whole
   workflow for two hours with zero notification.

## The 8 lessons (one line each)

1. **Bound the blast radius** — waves of 6–8, not one mega-barrier; a bad window then damages one wave.
2. **Wrap every `agent()`** — tolerate `null`, defer failures to a retry wave (backoff = elapsed time).
3. **No single hard barrier** — commit results per wave so the deliverable survives a later stall.
4. **Arm a watchdog** — a `ScheduleWakeup` + journal-mtime check is the *only* thing that sees a stall.
5. **Design resume in** — stable finder prompts (cache hits); synthesis embeds its inputs so it re-runs.
6. **Keep outputs lean** — capped arrays, URLs not page-dumps; short streams drop less and fit the cap.
7. **Synthesize from partial** — never block on 100%; flag gaps explicitly instead of hiding them.
8. **Back off on instability** — a wave full of `null`s is a spike; stop and resume later, don't hammer.

## What actually saved it

- **Checkpoint / resume** — re-running the same script reused dozens of cached agents across both
  stops, losing **zero** completed work.
- **A manual watchdog** — the *only* signal in two hours of silence; this skill arms one by default.
- **Structured outputs** — every agent returned a schema object, so partial results were still usable.
- **Journal union** — the full dataset was recovered by parsing the append-only `journal.jsonl`
  (one file per run, appended across every resume) and de-duplicating by key — not the truncated,
  ~192 KB-capped `.output`.
