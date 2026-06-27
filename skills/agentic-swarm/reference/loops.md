# Pairing a swarm with `/loop` — extend a fan-out across turns and sessions

A swarm lives inside **one Workflow run**. That run is bounded: one session's token budget, one
script, one set of waves. Some work is bigger than one run — a giant audit, a migration over
thousands of sites, a review that should re-run every few hours. `/loop` is how you carry a *bounded*
swarm **across turns and sessions** without ever building one unbounded mega-run.

This file is the swarm-specific playbook. For the raw `/loop` / `ScheduleWakeup` / `CronCreate`
mechanics (forms, jitter, 7-day expiry, sentinels, provider fallback) see
[`docs/claude-code/loops.md`](../../../docs/claude-code/loops.md).

---

## The three loop layers — keep them distinct

| Layer | What it is | Lives where | Repeats a… | Uses a sentinel? |
| :-- | :-- | :-- | :-- | :-- |
| **1. In-script wave loop** (Pattern 1) | the `for` over waves of 6–8 **inside one Workflow script** | the workflow body | wave, within a single run | no |
| **2. One-shot `ScheduleWakeup` watchdog** (Pattern 4) | a single main-loop wakeup armed *beside* the swarm to catch a silent stall | your session, alongside the run | **nothing — fires once**, you re-arm manually | **NO — plain prompt** |
| **3. `/loop`** (recurring or self-paced) | repeats a whole **turn** over time; each turn can launch a fresh bounded swarm | the session, across turns/sessions | turn, across time | yes (the *runtime* sets it) |

**The one rule that keeps them from crossing:** layer 2 (the watchdog) is a **plain** `ScheduleWakeup`
with a concrete natural-language `prompt`. It must **never** carry a `/loop` sentinel —
`<<autonomous-loop-dynamic>>` (ScheduleWakeup) or `<<autonomous-loop>>` (CronCreate). A sentinel
silently converts your one-shot stall-watchdog into an autonomous loop. Layer 3 is the **user's**
`/loop` (they type it; the runtime passes the sentinel) — you don't hand-author sentinels.

---

## When to wrap a swarm in a `/loop` (layer 3)

### A. Loop-until-dry, across sessions

The in-script discover→dedupe→loop-until-dry pattern (skill: "loop-until-dry") converges **within one
run**. When the backlog is too big for one run's budget, lift it to a `/loop`: each tick launches (or
**resumes**) a bounded swarm over the *remaining* items, then records what's left. "Dry" = N
consecutive ticks add nothing new.

**The architecture point that bites people:** a Workflow **script has no filesystem access** —
`Date.now()`, timers, and disk are all blocked in the sandbox. So the cross-tick worklist cannot live
*inside* the script. It lives with the **main session** (the `/loop` turn), which:

1. **Reads** the worklist file (e.g. `.claude/agentic-swarm/worklist.json`) with the Read tool.
2. Computes the **remaining** items (`planned − done`).
3. Launches a bounded swarm over just those, passing them as the Workflow **`args`** (not hard-coded
   in the script — keep the script stable so `resumeFromRunId` still caches).
4. On completion, **extracts** the journal (`reference/extract_journal.py`), updates `done`, and
   **writes** the worklist back.
5. Decides: backlog non-empty → let the loop tick again; dry for N ticks → stop (a self-paced loop
   ends by not scheduling the next wakeup; a fixed loop is stopped with `Esc`).

```text
# Self-paced (model paces itself; ends itself when dry):
/loop Resume the audit: read .claude/agentic-swarm/worklist.json, run a bounded agentic-swarm
      over the remaining files (waves of 6-8, watchdog armed), extract the journal, write back
      the worklist. If two consecutive ticks add nothing new, say "audit dry" and stop.
```

### B. Loop-until-budget, across sessions

The in-script `while (budget.total && budget.remaining() > X)` loop spends **one turn's** target. To
spend a larger budget than one session grants — or to spread cost over time/quota windows — wrap it:
each `/loop` tick runs **one bounded wave-set** within that tick's budget, checkpoints, and the next
tick resumes. The per-tick swarm stays small and safe; the loop accumulates coverage.

### C. Recurring monitoring swarm

A standing fan-out that re-runs on a cadence — continuous review, freshness checks, drift detection:

```text
/loop 2h Run the review swarm over everything that changed since the last tick (git diff against
         the last-reviewed SHA in .claude/agentic-swarm/last-review.txt): bounded waves, adversarial
         verify, watchdog armed. Append confirmed findings; update last-review.txt.
```

Each tick is a **fresh, bounded** swarm — Pattern 4's watchdog still applies *within* the tick. A
`loop.md` (`.claude/loop.md`) is a good home for a longer standing prompt like this so you can refine
it between ticks without retyping.

---

## Interaction gotchas (swarm × `/loop`)

- **Self-paced `/loop` is itself driven by `ScheduleWakeup`.** Arming a *second*, competing
  `ScheduleWakeup` watchdog inside a self-paced loop can collide with the loop's own wakeup. For a
  swarm you want to babysit, prefer a **fixed-interval `/loop`** (cron-based — leaves `ScheduleWakeup`
  free for the watchdog), or keep each tick's swarm small enough that the **completion notification**
  is your signal and no watchdog is needed.
- **Keep the per-tick swarm bounded.** A `/loop` tick that launches a huge unbounded run reintroduces
  exactly the silent-stall risk the skill exists to remove. One tick = one safe, bounded wave-set.
- **A tick fires between turns, never mid-response, and there is no catch-up.** If a tick comes due
  while a long swarm/turn is still running, it fires once when idle — not once per missed interval. So
  a tick may find the previous tick's swarm still going; have the prompt **check for an in-flight run
  first** (resume/extend it) rather than launching a duplicate.
- **7-day expiry + session scope.** Recurring `/loop` tasks auto-expire after 7 days and are
  session-scoped (restored on `--resume` within 7 days). For a monitor that must outlive the session
  unattended, use **Cloud Routines (`/schedule`)** instead — but note Routines run on a *fresh clone*
  with **no local uncommitted state**, so commit (or persist via the worklist) anything a later run
  needs.
- **Keep the script byte-stable across ticks.** Pass the changing work as `args`; leave the `agent()`
  prompts identical so `Workflow({ scriptPath, resumeFromRunId })` serves completed agents from cache
  (Pattern 5). Editing the script mid-loop busts the cache from the first changed call onward.

---

## Decision shortcut

```
one bounded fan-out, fits one run        -> plain swarm (no /loop). Arm the Pattern 4 watchdog.
bigger than one run, finite backlog      -> /loop (self-paced) + worklist + resumeFromRunId  (until dry)
spend more budget than one session       -> /loop + per-tick bounded wave-set                (until budget)
re-run on a cadence (monitor/review)     -> /loop <interval> ...  (fixed; watchdog free)      (recurring)
must run unattended past the session     -> Cloud Routine (/schedule), not /loop             (commit state)
run until a CONDITION holds, not a clock -> /goal (condition-driven), not /loop
```
