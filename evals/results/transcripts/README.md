# Eval transcripts

Exactly what each model produced for each task, **baseline** (no skill) vs **with-skill**, with the Claude judge's score and reasoning. This is the raw evidence behind [`../RESULTS.md`](../RESULTS.md). The prompts are in [`../../prompts/`](../../prompts/) (rendered examples under [`rendered/`](../../prompts/rendered/)).

| Task | Model | Baseline | With skill | Δ | Transcript |
|---|---|---|---|---|---|
| code-review-swarm | `gpt-4.1` | 18% | 92% | +74% | [code-review-swarm__gpt-4-1.md](code-review-swarm__gpt-4-1.md) |
| code-review-swarm | `gpt-4.1-mini` | 20% | 92% | +72% | [code-review-swarm__gpt-4-1-mini.md](code-review-swarm__gpt-4-1-mini.md) |
| code-review-swarm | `gpt-5.4-mini` | 25% | 78% | +53% | [code-review-swarm__gpt-5-4-mini.md](code-review-swarm__gpt-5-4-mini.md) |
| code-review-swarm | `gpt-5.5` | 25% | 97% | +72% | [code-review-swarm__gpt-5-5.md](code-review-swarm__gpt-5-5.md) |
| document-extraction-sweep | `gpt-4.1` | 20% | 82% | +62% | [document-extraction-sweep__gpt-4-1.md](document-extraction-sweep__gpt-4-1.md) |
| document-extraction-sweep | `gpt-4.1-mini` | 22% | 100% | +78% | [document-extraction-sweep__gpt-4-1-mini.md](document-extraction-sweep__gpt-4-1-mini.md) |
| document-extraction-sweep | `gpt-5.4-mini` | 20% | 82% | +62% | [document-extraction-sweep__gpt-5-4-mini.md](document-extraction-sweep__gpt-5-4-mini.md) |
| document-extraction-sweep | `gpt-5.5` | 35% | 93% | +58% | [document-extraction-sweep__gpt-5-5.md](document-extraction-sweep__gpt-5-5.md) |
| flaky-test-triage | `gpt-4.1` | 15% | 88% | +73% | [flaky-test-triage__gpt-4-1.md](flaky-test-triage__gpt-4-1.md) |
| flaky-test-triage | `gpt-4.1-mini` | 35% | 93% | +58% | [flaky-test-triage__gpt-4-1-mini.md](flaky-test-triage__gpt-4-1-mini.md) |
| flaky-test-triage | `gpt-5.4-mini` | 25% | 72% | +47% | [flaky-test-triage__gpt-5-4-mini.md](flaky-test-triage__gpt-5-4-mini.md) |
| flaky-test-triage | `gpt-5.5` | 35% | 92% | +57% | [flaky-test-triage__gpt-5-5.md](flaky-test-triage__gpt-5-5.md) |
| migration-swarm | `gpt-4.1` | 18% | 88% | +70% | [migration-swarm__gpt-4-1.md](migration-swarm__gpt-4-1.md) |
| migration-swarm | `gpt-4.1-mini` | 20% | 100% | +80% | [migration-swarm__gpt-4-1-mini.md](migration-swarm__gpt-4-1-mini.md) |
| migration-swarm | `gpt-5.4-mini` | 22% | 78% | +56% | [migration-swarm__gpt-5-4-mini.md](migration-swarm__gpt-5-4-mini.md) |
| migration-swarm | `gpt-5.5` | 28% | 95% | +67% | [migration-swarm__gpt-5-5.md](migration-swarm__gpt-5-5.md) |
| multi-source-qa | `gpt-4.1` | 18% | 88% | +70% | [multi-source-qa__gpt-4-1.md](multi-source-qa__gpt-4-1.md) |
| multi-source-qa | `gpt-4.1-mini` | 20% | 88% | +68% | [multi-source-qa__gpt-4-1-mini.md](multi-source-qa__gpt-4-1-mini.md) |
| multi-source-qa | `gpt-5.4-mini` | 18% | 75% | +57% | [multi-source-qa__gpt-5-4-mini.md](multi-source-qa__gpt-5-4-mini.md) |
| multi-source-qa | `gpt-5.5` | 32% | 92% | +60% | [multi-source-qa__gpt-5-5.md](multi-source-qa__gpt-5-5.md) |
| research-swarm | `gpt-4.1` | 20% | 92% | +72% | [research-swarm__gpt-4-1.md](research-swarm__gpt-4-1.md) |
| research-swarm | `gpt-4.1-mini` | 20% | 92% | +72% | [research-swarm__gpt-4-1-mini.md](research-swarm__gpt-4-1-mini.md) |
| research-swarm | `gpt-5.4-mini` | 18% | 78% | +60% | [research-swarm__gpt-5-4-mini.md](research-swarm__gpt-5-4-mini.md) |
| research-swarm | `gpt-5.5` | 35% | 97% | +62% | [research-swarm__gpt-5-5.md](research-swarm__gpt-5-5.md) |
