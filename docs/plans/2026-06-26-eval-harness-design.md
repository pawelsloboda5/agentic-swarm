# Eval harness design — measuring the safe-swarm skill's uplift

> Status: **approved (decisions locked), build in progress.** Turns the README's "we
> dogfooded it" anecdote into a reproducible, model-versioned evaluation anyone can re-run.

## Goal

Replace the narrative "How it was built" claim with **evidence**: a table showing that the
`/agentic-swarm` skill measurably improves how safely frontier models write parallel-subagent
orchestration — produced by a harness any contributor can run with their own API key.

## Decisions (confirmed with the owner)

- **What we measure:** *skill uplift, A/B.* Each model writes a Claude Code `Workflow()` script
  for a fan-out task **twice** — *baseline* (fair Workflow API reference + task) vs *with-skill*
  (same API reference **+ the real `SKILL.md`** + task). Headline metric = the **uplift Δ** per
  model. The A/B isolates the skill as the cause of any safety gain.
- **Tool:** [promptfoo](https://www.promptfoo.dev) — purpose-built for model-comparison tables,
  `llm-rubric` model-graded judging, external JS assertions with per-criterion `namedScores`, and
  shareable web/HTML reports. Lives in `evals/` with its **own** `package.json` so the **plugin
  root stays zero-dependency**.
- **Model matrix (frontier → floor, ~4):** GPT-5.5 (frontier + the rubric judge), a mid tier
  (GPT-5.x-mini), GPT-4.1, GPT-4.1-mini. Exact IDs pinned from the account's `GET /v1/models` at
  build time — not hardcoded from memory. ~6 tasks × 2 variants × 4 models.

## What is (and isn't) being claimed — honesty

This measures whether the skill makes models **write** safer swarm-orchestration code, scored on
the 8 safety patterns. It demonstrates the guidance **generalizes across frontier models**. It
does **not** claim to exercise the live Claude-Code retry/watchdog *runtime*. The original
dogfooding story (2 agents hit `Connection closed mid-response`; the retry wave recovered both)
stays in the README, demoted to a footnote — the reproducible table leads.

## Scoring

Each generated script is scored two ways, per task:

1. **Programmatic** (`asserts/safety-patterns.js`) — heuristic checks for each of the 8 patterns
   (bounded waves vs one mega-barrier, per-`agent()` retry/null-tolerance, `ScheduleWakeup`
   watchdog, resume/cache-stable design, lean/capped outputs, partial-synthesis gap-flagging,
   instability backoff), each emitted as a `namedScore`. Objective but imperfect — a breakdown,
   not the verdict.
2. **Model-graded** (`llm-rubric`, judged by GPT-5.5) — a holistic 0–1 "does this avoid silent
   stalls and lost work" score with written reasoning. This is the **primary** headline score;
   the programmatic `namedScores` are the per-pattern breakdown.

## Structure

```
evals/
├── package.json              # promptfoo as a devDependency; bun/npm run scripts
├── promptfooconfig.yaml      # providers (4 models), prompts (baseline+with-skill), tests, asserts
├── prompts/
│   ├── workflow-api.md        # neutral, fair Workflow API reference (shared by both variants)
│   ├── baseline.js            # api + task          (the control)
│   └── with-skill.js          # api + real SKILL.md + task   (the treatment)
├── tasks/tasks.yaml          # ~6 realistic fan-out scenarios (the test vars)
├── asserts/
│   ├── safety-patterns.js     # per-pattern programmatic scoring -> namedScores
│   └── rubric.md              # the llm-rubric text (GPT-5.5 judge)
├── scripts/
│   ├── list-models.mjs        # GET /v1/models -> pin exact available IDs (Phase 2)
│   └── make-table.mjs         # results/latest.json -> results/RESULTS.md uplift table
├── results/RESULTS.md        # generated, committed (the artifact people read)
└── README.md                 # what/why/how-to-run/how-to-read/cost
```

- **Key handling:** `OPENAI_API_KEY` in the repo-root **`.env.local`** (already gitignored via
  `.env.*`). The eval runner loads it explicitly; `evals/node_modules` is gitignored. The key is
  never committed, never printed, never sent anywhere but OpenAI.
- **Run:** `cd evals && bun install && bun run eval` → `bun run table` → `bun run view` (or
  `promptfoo share` for a public link). Works under npm too (`npm run …`).

## Presentation

- `evals/results/RESULTS.md` — the committed table: rows = models, columns = baseline score,
  with-skill score, **Δ uplift**, plus per-pattern coverage.
- `promptfoo view` — local interactive side-by-side web report; `promptfoo share` — public link.
- README "How it was built" → "**How it was built & evaluated**": leads with the table + a
  one-command "reproduce it yourself", footnotes the dogfooding anecdote.

## Cost & safety rails

- Bounded by default (~6 tasks × 2 × 4 = 48 generations + ~24 judge calls). A **cost estimate is
  printed/approved before any paid run**; a `--smoke` path runs 1 task × 2 models first.
- No eval on the per-PR CI path (costs money + needs a secret). An **optional** manual
  `workflow_dispatch` job can re-run it later with `OPENAI_API_KEY` as a GitHub Actions secret.

## Build phases

1. **Scaffold (no key):** all files above; `node --check` the JS, parse the YAML, pin promptfoo
   version. Commit. ← inert without a key, safe to commit.
2. **Run (needs key):** pin exact model IDs from `/v1/models`; print cost estimate; smoke run;
   full run; generate `RESULTS.md`; rewrite the README section. Commit.
