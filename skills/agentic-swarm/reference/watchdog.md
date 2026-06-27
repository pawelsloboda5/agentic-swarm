# Swarm watchdog — catch the silent stall the harness never reports

The Workflow harness fires a `<task-notification>` on **completion**, and **nothing** on a
stall. A hung connection inside a barrier makes the workflow `await` forever. The watchdog is
an external heartbeat that notices the journal has stopped growing and forces a stop + resume.
This was the *only* thing that caught the 2-hour stall in the origin run (see `reference/origin.md`).

It has two moving parts:
1. **The trigger** — a `ScheduleWakeup` that re-invokes your session after a delay.
2. **The check** — a journal-mtime staleness test that decides: keep waiting, or stop + resume.

---

## 1. Arm it (right after launching the swarm)

`ScheduleWakeup` is a **main-loop tool** — call it from the orchestrating session, **not** from
inside the workflow script (the script has no access to it). Arm it immediately after the
`Workflow` call returns, while you still have the `runId`, `scriptPath`, and the task id from
the launch notification.

```text
ScheduleWakeup({
  delaySeconds: 1200,   // ~20 min. Clamped to [60, 3600]. Long fallback = the sanctioned use here.
  reason: "watchdog: swarm wf_<id> can stall silently; check journal mtime and resume if stuck",
  prompt:
    "WATCHDOG for swarm run wf_<id> (workflow task <taskId>; journal at " +
    "~/.claude/projects/<project-slug>/<session-id>/subagents/workflows/wf_<id>/journal.jsonl; " +
    "scriptPath <scriptPath>). " +
    "Run the journal-staleness check from agentic-swarm/reference/watchdog.md. " +
    "If the journal mtime is older than 20 min AND the workflow task is not 'completed': " +
    "TaskStop(<taskId>), then Workflow({ scriptPath: '<scriptPath>', resumeFromRunId: 'wf_<id>' }), " +
    "then re-arm a fresh 1200s ScheduleWakeup. " +
    "If the journal is still moving OR the task already completed: do nothing except re-arm " +
    "(or stop arming once complete). " +
    "This is a PLAIN one-shot watchdog — do NOT pass the <<autonomous-loop-dynamic>> sentinel " +
    "and do NOT treat it as a /loop."
})
```

**Why 1200 s (not shorter):** the prompt cache TTL is ~5 min. A sub-5-min poll keeps the cache
warm but you'd burn it repeatedly for nothing — and the harness *already* notifies you the
instant the swarm completes normally, so you don't need to poll for the happy path. You only
need a long fallback for the *stall* path, which the harness can't see. 1200 s amortizes one
cache miss across a useful wait.

**Sentinel warning:** there are two autonomous-loop sentinels — `<<autonomous-loop-dynamic>>`
(ScheduleWakeup) and `<<autonomous-loop>>` (CronCreate). This watchdog uses **neither**. Pass a
concrete natural-language `prompt`. Passing a sentinel would convert your one-shot watchdog into
an autonomous loop — a different, unintended mode.

---

## 2. The staleness check (run when the wakeup fires)

If your shell has no `jq`, use **Python** (the check below has no jq dependency). The journal is
append-only, so a growing file = live progress; an mtime that hasn't moved in N minutes while the
task is still "running" = stall. The glob uses `expanduser`, so it is cross-platform.

```bash
python - <<'PY'
import os, time, glob, sys, json

RUN = "wf_<id>"                          # <-- the runId
STALE_MIN = 20                           # tune: a bit longer than your slowest single agent

pattern = os.path.expanduser(f"~/.claude/projects/*/*/subagents/workflows/{RUN}/journal.jsonl")
hits = glob.glob(pattern)
if not hits:
    print("NO_JOURNAL — cannot confirm progress; treat as suspect and inspect the run")
    sys.exit(0)
j = hits[0]
age_min = (time.time() - os.path.getmtime(j)) / 60

# how many agents are still outstanding (started but no result yet)?
started, resulted = set(), set()
for line in open(j, encoding="utf-8"):
    line = line.strip()
    if not line: continue
    o = json.loads(line)
    (started if o.get("type") == "started" else resulted).add(o.get("key"))
outstanding = len(started - resulted)

verdict = "RESUME" if age_min > STALE_MIN else "STILL_MOVING"
print(f"journal_age_min={age_min:.1f} outstanding_agents={outstanding} verdict={verdict}")
PY
```

### Decision tree

```
journal mtime fresh (age < STALE_MIN)        -> STILL_MOVING. Re-arm 1200s. Do nothing else.
journal stale AND task completed             -> DONE. Stop arming. Extract via extract_journal.py.
journal stale AND task running               -> STALL. Run the resume runbook (below). Re-arm.
no journal found                             -> SUSPECT. Check the task state directly; if hung, resume.
```

> Always corroborate the mtime with the **task status** (you have the launch `<task-notification>`;
> a `completed` status means the swarm finished — a stale mtime then just means "done", not "stalled").
> The combination *stale mtime + not completed* is the true stall signal.

### Resume on stall

1. `TaskStop(<taskId>)` — resume refuses to run beside the stuck task; stop it first.
2. `Workflow({ scriptPath: "<scriptPath>", resumeFromRunId: "wf_<id>" })` — completed agents
   return from cache instantly; only the hung/`null` ones re-run (usually fine in a fresh window).
3. Re-arm a new 1200 s `ScheduleWakeup` for the resumed run.

---

## 3. Fallback watchdog — backgrounded shell (if ScheduleWakeup is unavailable)

If a session can't use `ScheduleWakeup`, a backgrounded poll achieves the same heartbeat: it
runs across turns and **re-invokes you when it exits**, so make it exit the moment the journal
goes stale. Keep each sleep short (≤ 270 s) to stay inside the prompt-cache window.

```bash
# run_in_background: true. Exits (and pings you) when the journal stops growing for ~20 min.
python - <<'PY'
import os, time, glob
RUN, STALE = "wf_<id>", 20*60
j = glob.glob(os.path.expanduser(f"~/.claude/projects/*/*/subagents/workflows/{RUN}/journal.jsonl"))
if not j:
    print("no journal yet"); raise SystemExit(0)
j = j[0]
while True:
    age = time.time() - os.path.getmtime(j)
    if age > STALE:
        print(f"STALL: journal idle {age/60:.1f} min — resume wf_<id>"); break
    time.sleep(240)   # short, cache-window-friendly
PY
```

When it exits with `STALL`, run the resume runbook above. (Prefer `ScheduleWakeup` when you
have it — it doesn't hold a background slot the whole time.)
