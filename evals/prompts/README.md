# Eval prompts

Every model writes a Claude Code `Workflow` script for each [task](../tasks/tasks.yaml) under **two
variants**. The only difference between them is the skill — so any score gap is attributable to it.

| Variant | Prompt = | Built by |
|---|---|---|
| **baseline** (control) | [`workflow-api.md`](workflow-api.md) (a neutral Workflow API reference) + the task | [`baseline.js`](baseline.js) |
| **with-skill** (treatment) | the same API reference **+ the live [`SKILL.md`](../../skills/agentic-swarm/SKILL.md)** + the task | [`with-skill.js`](with-skill.js) |

`baseline.js` / `with-skill.js` are promptfoo prompt **functions** — they assemble the messages at
run time. `with-skill.js` reads the real `SKILL.md` off disk, so the eval always measures the skill
**as it currently ships** (edit the skill, re-run, see the new number).

## See the exact prompts

To inspect the literal text sent to the models (without running anything), see the rendered
examples — generated from a real run, one representative task each:

- [`rendered/baseline.example.md`](rendered/baseline.example.md)
- [`rendered/with-skill.example.md`](rendered/with-skill.example.md) — shows the full injected `SKILL.md`

## See what the models answered

The models' actual outputs (the generated Workflow scripts), baseline vs with-skill, with the
GPT-5.5 judge's score and reasoning, are in
[`../results/transcripts/`](../results/transcripts/) (start at its
[`README.md`](../results/transcripts/README.md)). The aggregate table is
[`../results/RESULTS.md`](../results/RESULTS.md).
