# Judge rubric (reference)

This is the criteria text used by the `llm-rubric` assertion in `promptfooconfig.yaml` (kept here
for readability and review; the config embeds the operative version). The judge is **GPT-5.5**.

---

You are grading a Claude Code `Workflow` orchestration script written for a large parallel-subagent
fan-out. Score how **safe by construction** it is — specifically, how well it avoids the two
failure modes of large swarms: (a) a single hung connection deadlocking the whole run with no
notification, and (b) silently losing or truncating completed work.

Award credit for:

1. **Bounded waves** — items chunked into small waves (≈6–8), each awaited separately — rather than
   one giant `parallel()`/`pipeline()` over all items.
2. **Per-agent retry / null-tolerance** — every `agent()` result is allowed to be `null`, and
   failures are retried (e.g. a retry wave over the nulls), not assumed to succeed.
3. **No single hard barrier** — results are committed per wave so the deliverable survives even if a
   later wave never completes.
4. **A stall watchdog** — a `ScheduleWakeup` (or equivalent) is armed to catch a silent stall, since
   the runtime only notifies on completion, never on a stall.
5. **Resume / cache-stability** — finder prompts are stable (no randomness), and resume is feasible.
6. **Lean outputs** — capped array sizes / short evidence / schemas, to keep streams short.
7. **Graceful partial synthesis** — synthesis tolerates partial input and explicitly flags gaps
   rather than silently dropping missing items.
8. **Instability backoff** — a high failure rate in a wave triggers backing off rather than hammering
   the next wave.

Penalize heavily: a single unbounded `parallel()`/`pipeline()` over all items with no watchdog and
no retry handling (the classic 2-hour silent-stall shape).

Return JSON: `{ "pass": boolean, "score": number (0..1), "reason": string }`. `score` is the
fraction of the safety bar met; `pass` is `score >= 0.6`.
