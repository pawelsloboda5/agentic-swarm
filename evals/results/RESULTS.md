# Eval results — safe-swarm skill uplift

> 48 results · 4 models · 6 fan-out tasks · 2 variants (baseline vs with-skill) · judge: GPT-5.5
> Headline = the GPT-5.5 `llm-rubric` (0–1): how safe-by-construction the generated Workflow script is.
> Run `eval-VHp-2026-06-27T06:10:38` · regenerate with `bun run table`. Numbers shift run-to-run (LLM sampling).

## Skill uplift (rubric score: baseline → with-skill)

| Model | Baseline | With skill | Δ uplift |
|---|---|---|---|
| `openai:chat:gpt-4.1` | 16% | 23% | +7% |
| `openai:chat:gpt-4.1-mini` | 16% | 31% | +15% |
| `openai:chat:gpt-5.4-mini` | 20% | 64% | +43% |
| `openai:chat:gpt-5.5` | 26% | 75% | +49% |

## Heuristic per-pattern score (with skill)

Mean of the programmatic pattern checks under the with-skill variant (breakdown, not the
headline). 100% = all 8 patterns detected on every task.

| Model | Pattern score (baseline → with skill) |
|---|---|
| `openai:chat:gpt-4.1` | 27% → 47% |
| `openai:chat:gpt-4.1-mini` | 25% → 51% |
| `openai:chat:gpt-5.4-mini` | 28% → 73% |
| `openai:chat:gpt-5.5` | 43% → 95% |

## Per-pattern coverage (heuristic mean across all models)

Each safe-swarm pattern's mean programmatic score, baseline vs with-skill.

| Pattern | Baseline | With skill |
|---|---|---|
| 1. bounded waves | 8% | 85% |
| 2. retry wrapper | 71% | 79% |
| 3. no single barrier | 40% | 92% |
| 4. watchdog (ScheduleWakeup) | 0% | 25% |
| 5. resume / cache-stable | 10% | 60% |
| 6. lean outputs | 65% | 75% |
| 7. partial synthesis | 52% | 79% |
| 8. instability backoff | 0% | 35% |

> **Reading this honestly.** The rubric is the headline; the per-pattern numbers are a regex
> heuristic (approximate). `ScheduleWakeup` reads low partly because it's armed at the agent
> level, not inside the script body, so a model writing only the script can legitimately omit
> it. This eval measures whether the skill makes models *write* safer orchestration — it does
> not exercise the live runtime.

_Reproduce: see [`evals/README.md`](../README.md)._
