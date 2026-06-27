# agentic-swarm evals

**Question this answers:** does the `/agentic-swarm` skill actually make models write *safer*
parallel-subagent orchestration — or do we just claim it does?

We measure it with an **A/B uplift eval**: every model writes a Claude Code `Workflow` script for
a fan-out task **twice** — once with only a neutral Workflow API reference (*baseline*), once with
that same reference **plus the real `SKILL.md`** (*with-skill*). The gap between the two scores is
the skill's measured uplift, scored across the OpenAI lineup from frontier (GPT-5.5) down to the
GPT-4.1 floor.

This is intentionally **reproducible**: anyone with an OpenAI key can run it and get their own
table. It is isolated in this `evals/` directory with its own `package.json` so the **plugin
itself stays zero-dependency**.

## What's measured

Each generated script is scored two ways per task:

- **GPT-5.5 `llm-rubric` (headline).** A 0–1 holistic judgment of how safe-by-construction the
  orchestration is — does it avoid the two swarm failure modes (one hung connection deadlocking
  the whole run; silently losing completed work)? Criteria in [`asserts/rubric.md`](asserts/rubric.md).
- **Programmatic per-pattern score (breakdown).** [`asserts/safety-patterns.js`](asserts/safety-patterns.js)
  heuristically checks for each of the 8 patterns (bounded waves, per-agent retry, no single
  barrier, `ScheduleWakeup` watchdog, resume/cache-stable, lean outputs, partial synthesis,
  instability backoff) and emits one `namedScore` each. Objective but imperfect — a breakdown, not
  the verdict.

> **Honesty:** this measures whether the skill makes models *write* safer swarm code, and shows
> the guidance generalizes across frontier models. It does **not** exercise the live Claude-Code
> retry/watchdog runtime.

## Methodology — why these numbers are trustworthy

Built to be hard to fool itself:

- **No truncation.** Output length is pinned (`max_tokens` for the non-reasoning models,
  `max_completion_tokens` for the GPT-5 reasoning models) so every script is written in full. An
  earlier version truncated the weaker models mid-script and then unfairly graded the cut-off code.
- **Deterministic where the models allow it.** The non-reasoning models (GPT-4.1 / -mini) run at
  `temperature: 0` with a fixed `seed`, so they're reproducible. OpenAI's GPT-5 reasoning models
  **reject `temperature`**, so those run with a seed (best-effort) and are **averaged over 3
  repeats** to tame sampling variance.
- **An independent, cross-family judge.** Claude grades the OpenAI outputs. With no Claude model in
  the contestant list there is **no self-preference bias** — the failure mode of grading GPT
  outputs with a GPT judge.
- **A calibrated rubric.** The judge assesses each of the 8 safety patterns explicitly against
  anchored score bands, rather than guessing one holistic number.

Numbers still drift run-to-run for the reasoning models (hence repeat + average); read small deltas
as noise and the large baseline → with-skill gaps as the signal.

## Inspect the prompts and the answers (no run needed)

Everything that produced the numbers is committed and readable:

- **The prompts** — [`prompts/`](prompts/) (baseline vs with-skill, the A/B explained), with the
  exact rendered text under [`prompts/rendered/`](prompts/rendered/).
- **The answers** — every model's baseline-vs-with-skill output **with the GPT-5.5 judge's
  reasoning**, in [`results/transcripts/`](results/transcripts/) (start at its
  [`README.md`](results/transcripts/README.md)).
- **The table** — [`results/RESULTS.md`](results/RESULTS.md).

## Run it

```bash
# 1. Key — put OPENAI_API_KEY in the repo-root .env.local (gitignored via .env.*)
cp evals/.env.example .env.local && $EDITOR .env.local

# 2. Install (Bun preferred, npm works too)
cd evals && bun install

# 3. Confirm the exact model IDs your account can call, then pin them in promptfooconfig.yaml
bun run models

# 4. Smoke first (1 task), then the full matrix. The reasoning models are non-deterministic, so
#    average over repeats for trustworthy numbers:
bun run smoke
bun run eval -- --repeat 3 --no-cache

# 5. Build the table + transcripts, and open the interactive report
bun run report         # writes results/RESULTS.md + results/transcripts/
bun run view           # local web UI; `promptfoo share` for a public link
```

## Cost

The default rigorous run is 6 tasks × 2 variants × 4 models × 3 repeats = **144 generations** + 144
Claude judge calls — in practice **~$12** (≈$10 generation, dominated by the frontier model, + ~$2
for the Claude judge). **Check current provider pricing.** `bun run smoke` (1 task, no repeats) is
the cheap dry run; trim `providers:` / `tasks/tasks.yaml` / `--repeat` to spend less.

## Files

| Path | What it is |
|---|---|
| `promptfooconfig.yaml` | The eval: providers (models), the two prompt variants, tasks, assertions. |
| `prompts/workflow-api.md` | Neutral Workflow API reference given to **both** variants (the fair control). |
| `prompts/baseline.js` · `with-skill.js` | The A/B prompts; `with-skill` injects the **live** `SKILL.md`. |
| `tasks/tasks.yaml` | The fan-out scenarios under test. |
| `asserts/safety-patterns.js` · `rubric.md` | Programmatic per-pattern scorer · the judge rubric (reference copy). |
| `scripts/` | `list-models` (pin IDs) · `run-eval` (loads root key) · `make-table` + `make-transcripts`. |
| `results/RESULTS.md` · `results/transcripts/` | The committed table and per-model transcripts (regenerated by `bun run report`). |
