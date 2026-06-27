# `/loop`, Scheduled Tasks & Self-Pacing — Plugin Builder Reference

One-liner: `/loop` repeats a whole **turn** over time — on a **fixed cron interval** (`/loop 5m <prompt>`, engine: `CronCreate`) or **self-paced** (`/loop <prompt>`, the model picks each delay via `ScheduleWakeup`, 1 min–1 h) — which is a different layer from a Workflow's in-script wave loop and from a one-shot `ScheduleWakeup` watchdog.

**Source of truth:** https://code.claude.com/docs/en/scheduled-tasks.md · https://code.claude.com/docs/en/tools-reference.md (ScheduleWakeup / CronCreate / CronList / CronDelete) · https://code.claude.com/docs/en/goal.md · https://code.claude.com/docs/en/routines.md · https://code.claude.com/docs/en/workflows.md

> **Why this doc exists for agentic-swarm.** The plugin's `ScheduleWakeup` **watchdog** (skill Pattern 4) is a *plain one-shot* `ScheduleWakeup` and must **never** be confused with a `/loop`. `/loop` has its own internal sentinels (`<<autonomous-loop>>`, `<<autonomous-loop-dynamic>>`) that the watchdog must not use. This snapshot pins the real mechanics so the skill can pair swarms with loops without crossing the wires. See `skills/agentic-swarm/reference/loops.md`.

---

## 1. The three forms of `/loop`

| You type | Engine | Cadence | Stops when |
| :-- | :-- | :-- | :-- |
| `/loop <interval> <prompt>` | `CronCreate` (fixed cron) | Every interval — units **`s` `m` `h` `d`** (e.g. `/loop 5m …`, `/loop 2h …`) | You press `Esc`, or 7-day expiry |
| `/loop <prompt>` (no interval) | `ScheduleWakeup` (self-paced) | Claude picks a delay **between 1 minute and 1 hour** after each iteration, from what it observed | You press `Esc`, **or Claude decides the work is done** (stops scheduling), or 7-day expiry |
| `/loop` (no interval, no prompt) | self-paced + built-in prompt | Dynamic (as above) | As above |

- **Fixed-interval:** *"Supported units are `s` for seconds, `m` for minutes, `h` for hours, and `d` for days."* Claude converts the interval to a cron expression, schedules the job, and confirms the cadence + job ID.
- **Self-paced:** *"When you omit the interval, Claude chooses one dynamically instead of running on a fixed cron schedule. After each iteration it picks a delay between one minute and one hour based on what it observed."* A self-paced loop can **self-terminate**: *"Claude can also end the loop on its own by not scheduling the next wakeup once the task is provably complete."*
- **Bare `/loop`:** runs a **built-in maintenance prompt**, in order: *"continue any unfinished work from the conversation; tend to the current branch's pull request: review comments, failed CI runs, merge conflicts; run cleanup passes such as bug hunts or simplification when nothing else is pending."*
  - Safety scope baked into that maintenance prompt: *"irreversible actions such as pushing or deleting only proceed when they continue something the transcript already authorized."*

A `/loop` fires **between turns, never mid-response**: *"A scheduled prompt fires between your turns, not while Claude is mid-response. If Claude is busy when a task comes due, the prompt waits until the current turn ends."*

---

## 2. Customizing the default loop — `loop.md`

The bare-`/loop` maintenance prompt is overridable with a `loop.md` file. **First match wins:**

| Path | Scope |
| :-- | :-- |
| `.claude/loop.md` | Project — **takes precedence** when both exist |
| `~/.claude/loop.md` | User — fallback for any project without a project-level file |

- Plain Markdown, no required structure. *"Edits to `loop.md` take effect on the next iteration … Keep the file concise: content beyond 25,000 bytes is truncated."*
- **Ignored whenever a prompt is supplied on the command line** (`loop.md` only feeds the *prompt-less* form).

---

## 3. The two engines and their **internal** sentinels

`/loop` is sugar over two lower-level scheduling tools, picked by whether you gave an interval:

| Form | Engine tool | Internal `prompt` sentinel |
| :-- | :-- | :-- |
| `/loop <prompt>` (self-paced) | **`ScheduleWakeup`** | `<<autonomous-loop-dynamic>>` |
| `/loop <interval> <prompt>` / bare maintenance | **`CronCreate`** | `<<autonomous-loop>>` |

> ⚠️ **The sentinels are internal harness/tool-schema detail — they do NOT appear in the public docs.** A full-text check of `scheduled-tasks.md` and `tools-reference.md` finds no occurrence of `autonomous-loop`, `sentinel`, or `<<`. They are documented here from the **`ScheduleWakeup` / `CronCreate` tool schemas** (the runtime contract), not from a public URL. When the runtime drives an autonomous `/loop` with no user prompt, it passes the matching sentinel as the engine tool's `prompt`.
>
> **agentic-swarm rule (do not break):** the swarm **watchdog** (skill Pattern 4) is a *plain one-shot* `ScheduleWakeup` with a concrete natural-language `prompt`. **Never** pass it `<<autonomous-loop-dynamic>>` (or the `CronCreate` `<<autonomous-loop>>`) — that would silently convert a stall-watchdog into an autonomous loop. `ScheduleWakeup` always uses the `-dynamic` variant; `CronCreate` uses the non-dynamic one.

---

## 4. `ScheduleWakeup` — the self-paced engine (and the watchdog primitive)

*"Reschedules the next iteration of a self-paced `/loop`. Claude calls this at the end of each iteration to pick when the next one runs, between one minute and one hour out; you don't call it directly."* The pending wakeup surfaces in `session_crons` in the Stop-hook input.

| Param | Type | Notes |
| :-- | :-- | :-- |
| `delaySeconds` | number | **Clamped to `[60, 3600]`** (1 min – 1 h). Out-of-range is auto-clamped, **no error thrown** *(clamp semantics are from the tool schema; the docs state only the 1 min–1 h range).* |
| `reason` | string | One short sentence; shown to the user + logged to telemetry. |
| `prompt` | string | The prompt to run on wakeup. Autonomous `/loop` passes the `<<autonomous-loop-dynamic>>` sentinel; a watchdog passes a concrete prompt. |

**One-shot vs. recurring.** A single `ScheduleWakeup` fires **once**. A self-paced `/loop` *is* "call it again at the end of every iteration." The agentic-swarm **watchdog uses the one-shot shape** — it fires once, you re-arm it manually if still needed.

**Picking `delaySeconds` (prompt-cache aware).** The Anthropic prompt cache TTL is ~5 min. Sleeping past 300 s means the next wake reads the full context **uncached** (slower + costlier).
- **60–270 s** — cache stays warm. Use only when actively polling external state the harness can't notify you about.
- **1200 s+** — pay one cache miss to buy a long wait. The default for an idle heartbeat / a stall watchdog.
- **Don't pick 300 s** — worst of both: you eat the cache miss without amortizing it. Drop to 270 s or jump to 1200 s+.

---

## 5. `CronCreate` / `CronList` / `CronDelete` — the fixed-interval engine

`CronCreate(cron, prompt, recurring=true, durable=false)` — schedule a prompt at a future time; used for both recurring schedules and one-shot reminders.

| Param | Notes |
| :-- | :-- |
| `cron` | Standard **5-field** expression `M H DoM Mon DoW` in **local time** (`"*/5 * * * *"` = every 5 min; `"0 9 * * 1-5"` = weekdays 9 am local). |
| `prompt` | The prompt enqueued at each fire. |
| `recurring` | `true` (default) = fire on every match until deleted / 7-day expiry. `false` = fire once, then auto-delete (one-shot "remind me at X"). |
| `durable` | **Tool-schema field, not in the public `/loop` docs.** `true` persists to `.claude/scheduled_tasks.json` and survives restarts; default `false` = in-memory, dies with the session. The public docs steer cross-restart durability toward Cloud **Routines** / Desktop tasks instead. |

- **Local timezone:** *"All times are interpreted in your local timezone. A cron expression like `0 9 * * *` means 9am wherever you're running Claude Code, not UTC."*
- **`CronList`** lists the session's scheduled tasks; **`CronDelete(id)`** cancels one by its **8-character ID** (from `CronCreate` / `CronList`).
- **Cap:** *"A session can hold up to 50 scheduled tasks at once."*
- **Not for live watching:** `CronCreate` re-runs on a wall-clock schedule. To react the instant a log line / process state changes, use the **`Monitor`** tool (streams events) instead of polling on a cron.

---

## 6. Timing: jitter, no catch-up, idle-only

**Jitter (fixed-interval only).** The scheduler adds a jitter offset to spread API load; the live doc notes this offset is **deterministic — derived from the task ID, so a given task always gets the same one**. **⚠ Doc-vs-schema divergence on the magnitude — flagged, not silently reconciled:**

| Source | Recurring-task jitter |
| :-- | :-- |
| **Live doc** (`scheduled-tasks.md`, *Jitter*) | *"up to 30 minutes after the scheduled time (or up to half the interval, for tasks that run more often than hourly)."* |
| **`CronCreate` tool schema** (runtime contract) | *"recurring tasks fire up to 10% of their period late (max 15 min)."* |

Both agree on the rest: **one-shot** tasks landing on `:00`/`:30` fire **up to 90 s early**, and self-paced loops have **no jitter** (*"The jitter rules don't apply to it, but the seven-day expiry does."*). The robust workaround is unaffected by the divergence: **pick an off-minute** (`3 9 * * *`, `7 * * * *`) instead of `:00`/`:30` when the exact minute doesn't matter.

**No catch-up:** *"If a task's scheduled time passes while Claude is busy on a long-running request, it fires once when Claude becomes idle, not once per missed interval."*

**Idle-only:** tasks fire only while the REPL is idle (between turns), never mid-query.

---

## 7. Lifecycle: 7-day expiry, session scope, resume

- **7-day expiry (recurring):** *"Recurring tasks automatically expire 7 days after creation. The task fires one final time, then deletes itself."* Applies to **both** fixed and self-paced loops.
- **Session-scoped:** *"Tasks are session-scoped: they live in the current conversation and stop when you start a new one."* Closing the terminal / letting the session exit stops them firing.
- **Resume:** *"Resuming with `--resume` or `--continue` brings back any task that hasn't expired: a recurring task created within the last 7 days, or a one-shot whose scheduled time hasn't passed yet."*
- To survive restarts unattended, use **Cloud Routines / Desktop tasks** (the `durable:true` `CronCreate` field exists in the tool schema but is not surfaced in the public `/loop` docs).

---

## 8. Provider support

| Provider | `/loop <interval> <prompt>` | `/loop <prompt>` (no interval) | bare `/loop` |
| :-- | :-- | :-- | :-- |
| **Anthropic-hosted** | Full (cron) | Full self-paced (`ScheduleWakeup`) | Maintenance prompt + `loop.md` |
| **Bedrock / Vertex AI / Foundry** | Cron works | **Falls back to a fixed 10-minute schedule** | Prints the usage message; **`loop.md` not read** |

*"On Bedrock, Vertex AI, and Microsoft Foundry, a prompt with no interval runs on a fixed 10-minute schedule instead."* Self-paced mode is Anthropic-only because `ScheduleWakeup` is an Anthropic-backend feature.

---

## 9. `/loop` vs. the alternatives (Routines, Desktop, Workflow, `/goal`)

| | `/loop` (session) | Cloud Routine (`/schedule`) | Desktop task | Workflow | `/goal` |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Driven by | Time (cron or self-paced) | Cron / API / GitHub trigger | Local scheduler | — (not scheduled) | **A completion condition** |
| Requires open session | **Yes** (restored on resume < 7 d) | No (cloud) | No (local machine) | Yes (background, resumable) | Yes |
| Local file access | Yes | **No (fresh clone each run)** | Yes | Yes (via cloned repo) | Yes |
| Multi-agent | One prompt/turn (the turn may launch a swarm) | One prompt/run | One prompt/run | **Yes — orchestrates ≤16 concurrent / ≤1000 total subagents** | One turn/step |
| Next turn starts when | Interval elapses (or self-paced delay) | Trigger fires | Schedule fires | n/a | **Previous turn finishes** |
| Stops when | `Esc` / done / 7 d | You delete it | You delete it | Script returns | **A model confirms the condition holds** |

- **`/goal` vs `/loop`:** *"The `/goal` command sets a completion condition and Claude keeps working toward it without you prompting each step. After each turn, a small fast model checks whether the condition holds."* Use `/goal` for *condition*-driven work, `/loop` for *time*-driven repetition.
- **Workflow scripts cannot self-schedule.** A `Workflow` script's vocabulary is `agent()` / `parallel()` / `pipeline()` / `phase()` / `log()` — it has **no** `ScheduleWakeup` / `CronCreate` hook, and the script sandbox blocks timers / `Date.now()`. So scheduling lives **outside** the script: a `/loop` turn (or the main session) launches a `Workflow`, and arms any `ScheduleWakeup` watchdog. (Per the `Workflow` tool contract; the public workflow doc says the script "coordinates the agents" with "no direct filesystem or shell access from the workflow itself.")
- **Composition that matters for agentic-swarm:** a `/loop` turn **can launch a swarm** — each tick runs a bounded `Workflow` fan-out, then the next tick checks/extends it. This is how loop-until-dry / loop-until-budget extends *across* turns and sessions, beyond a single workflow run's budget.

---

## 10. Stopping & disabling

- **Stop a running loop:** press **`Esc`** while it waits — *"This clears the pending wakeup so the loop does not fire again."* (Tasks you created by *asking* Claude directly aren't cleared by `Esc`; delete those with `CronDelete`.)
- **Disable entirely:** *"Set `CLAUDE_CODE_DISABLE_CRON=1` in your environment to disable the scheduler entirely. The cron tools and `/loop` become unavailable, and any already-scheduled tasks stop firing."*
- **Minimum version:** *"Scheduled tasks require Claude Code v2.1.72 or later."*

---

> **Verification:** WebFetch of `code.claude.com/docs/en/scheduled-tasks.md`, `/tools-reference.md`, `/goal.md`, `/routines.md`, `/workflows.md` (all resolved at the `.md` URL, HTTP 200, no redirect), cross-checked against the **live `ScheduleWakeup` / `CronCreate` / `CronList` / `CronDelete` / `Monitor` tool schemas** in-session (the runtime contract). Claims were verified by an independent adversarial fan-out (4 verifier subagents, one per claim-cluster), each quoting the smallest supporting sentence.
>
> **Confidence:** high for §1, §2, §7, §8, §10 (confirmed verbatim against the live doc); high for §5/§6/§9 tool signatures (primary-source tool schemas); medium where noted (sentinel strings; clamp semantics).
>
> **Discrepancies noted:**
> 1. **Jitter magnitude (§6):** the live doc says recurring tasks fire *up to 30 min late (or half the interval sub-hourly)*; the `CronCreate` tool schema says *up to 10% of period, max 15 min*. Materially different — both are reported. The tool schema is authoritative for actual runtime behavior; the public-doc number is cited as the public statement. The "avoid `:00`/`:30`" workaround holds either way.
> 2. **Sentinels (§3):** `<<autonomous-loop>>` / `<<autonomous-loop-dynamic>>` are **not in the public docs** (internal harness/tool-schema detail). Documented here from the tool schemas, not a public URL.
> 3. **`durable` flag (§5, §7):** present in the `CronCreate` tool schema (persists to `.claude/scheduled_tasks.json`) but **not surfaced in the public `/loop`/scheduled-tasks docs**, which route cross-restart durability to Routines/Desktop tasks.
> 4. **Clamp behavior (§4):** the docs state the 1 min–1 h range but not *how* out-of-range values are handled; "auto-clamp, no error" is from the `ScheduleWakeup` tool schema.
>
> **Sources fetched:**
> - https://code.claude.com/docs/en/scheduled-tasks.md
> - https://code.claude.com/docs/en/tools-reference.md
> - https://code.claude.com/docs/en/goal.md
> - https://code.claude.com/docs/en/routines.md
> - https://code.claude.com/docs/en/workflows.md
>
> Caveat: a snapshot. Upstream docs evolve and (per discrepancy #1) the tool schemas can diverge from the prose — re-verify against the live source + the in-session tool schemas before relying on a version-pinned detail.
