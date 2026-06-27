# Eval results — safe-swarm skill uplift

> 144 results · 4 models · 6 fan-out tasks × 3 reps · 2 variants (baseline vs with-skill) · judge: Claude (claude-sonnet-4-6)
> Headline = the Claude `llm-rubric` (0–1): how safe-by-construction the generated Workflow script is.
> Run `eval-UTU-2026-06-27T08:04:36` · regenerate with `bun run table`. Numbers shift run-to-run (LLM sampling).

## Skill uplift (rubric score: baseline → with-skill)

| Model | Baseline | With skill | Δ uplift |
|---|---|---|---|
| `openai:chat:gpt-4.1` | 19% | 89% | +70% |
| `openai:chat:gpt-4.1-mini` | 22% | 92% | +71% |
| `openai:chat:gpt-5.4-mini` | 20% | 77% | +56% |
| `openai:chat:gpt-5.5` | 30% | 94% | +63% |

## Heuristic per-pattern score (with skill)

Mean of the programmatic pattern checks under the with-skill variant (breakdown, not the
headline). 100% = all 8 patterns detected on every task.

| Model | Pattern score (baseline → with skill) |
|---|---|
| `openai:chat:gpt-4.1` | 26% → 97% |
| `openai:chat:gpt-4.1-mini` | 26% → 96% |
| `openai:chat:gpt-5.4-mini` | 24% → 76% |
| `openai:chat:gpt-5.5` | 43% → 95% |

## Per-pattern coverage (heuristic mean across all models)

Each safe-swarm pattern's mean programmatic score, baseline vs with-skill.

| Pattern | Baseline | With skill |
|---|---|---|
| 1. bounded waves | 10% | 100% |
| 2. retry wrapper | 67% | 99% |
| 3. no single barrier | 38% | 100% |
| 4. watchdog (ScheduleWakeup) | 0% | 75% |
| 5. resume / cache-stable | 9% | 96% |
| 6. lean outputs | 63% | 78% |
| 7. partial synthesis | 51% | 97% |
| 8. instability backoff | 0% | 81% |

> **Reading this honestly.** The rubric is the headline; the per-pattern numbers are a regex
> heuristic (approximate). `ScheduleWakeup` reads low partly because it's armed at the agent
> level, not inside the script body, so a model writing only the script can legitimately omit
> it. This eval measures whether the skill makes models *write* safer orchestration — it does
> not exercise the live runtime.

_Reproduce: see [`evals/README.md`](../README.md)._
