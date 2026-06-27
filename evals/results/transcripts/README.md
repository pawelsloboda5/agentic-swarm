# Eval transcripts

Exactly what each model produced for each task, **baseline** (no skill) vs **with-skill**, with the GPT-5.5 judge's score and reasoning. This is the raw evidence behind [`../RESULTS.md`](../RESULTS.md). The prompts are in [`../../prompts/`](../../prompts/) (rendered examples under [`rendered/`](../../prompts/rendered/)).

| Task | Model | Baseline | With skill | Δ | Transcript |
|---|---|---|---|---|---|
| code-review-swarm | `gpt-4.1` | 15% | 20% | +5% | [code-review-swarm__gpt-4-1.md](code-review-swarm__gpt-4-1.md) |
| code-review-swarm | `gpt-4.1-mini` | 15% | 25% | +10% | [code-review-swarm__gpt-4-1-mini.md](code-review-swarm__gpt-4-1-mini.md) |
| code-review-swarm | `gpt-5.4-mini` | 30% | 62% | +32% | [code-review-swarm__gpt-5-4-mini.md](code-review-swarm__gpt-5-4-mini.md) |
| code-review-swarm | `gpt-5.5` | 20% | 84% | +64% | [code-review-swarm__gpt-5-5.md](code-review-swarm__gpt-5-5.md) |
| document-extraction-sweep | `gpt-4.1` | 15% | 15% | +0% | [document-extraction-sweep__gpt-4-1.md](document-extraction-sweep__gpt-4-1.md) |
| document-extraction-sweep | `gpt-4.1-mini` | 18% | 30% | +12% | [document-extraction-sweep__gpt-4-1-mini.md](document-extraction-sweep__gpt-4-1-mini.md) |
| document-extraction-sweep | `gpt-5.4-mini` | 22% | 65% | +43% | [document-extraction-sweep__gpt-5-4-mini.md](document-extraction-sweep__gpt-5-4-mini.md) |
| document-extraction-sweep | `gpt-5.5` | 35% | 78% | +43% | [document-extraction-sweep__gpt-5-5.md](document-extraction-sweep__gpt-5-5.md) |
| flaky-test-triage | `gpt-4.1` | 20% | 30% | +10% | [flaky-test-triage__gpt-4-1.md](flaky-test-triage__gpt-4-1.md) |
| flaky-test-triage | `gpt-4.1-mini` | 20% | 30% | +10% | [flaky-test-triage__gpt-4-1-mini.md](flaky-test-triage__gpt-4-1-mini.md) |
| flaky-test-triage | `gpt-5.4-mini` | 15% | 55% | +40% | [flaky-test-triage__gpt-5-4-mini.md](flaky-test-triage__gpt-5-4-mini.md) |
| flaky-test-triage | `gpt-5.5` | 25% | 86% | +61% | [flaky-test-triage__gpt-5-5.md](flaky-test-triage__gpt-5-5.md) |
| migration-swarm | `gpt-4.1` | 20% | 25% | +5% | [migration-swarm__gpt-4-1.md](migration-swarm__gpt-4-1.md) |
| migration-swarm | `gpt-4.1-mini` | 15% | 40% | +25% | [migration-swarm__gpt-4-1-mini.md](migration-swarm__gpt-4-1-mini.md) |
| migration-swarm | `gpt-5.4-mini` | 20% | 70% | +50% | [migration-swarm__gpt-5-4-mini.md](migration-swarm__gpt-5-4-mini.md) |
| migration-swarm | `gpt-5.5` | 25% | 84% | +59% | [migration-swarm__gpt-5-5.md](migration-swarm__gpt-5-5.md) |
| multi-source-qa | `gpt-4.1` | 12% | 30% | +18% | [multi-source-qa__gpt-4-1.md](multi-source-qa__gpt-4-1.md) |
| multi-source-qa | `gpt-4.1-mini` | 12% | 25% | +13% | [multi-source-qa__gpt-4-1-mini.md](multi-source-qa__gpt-4-1-mini.md) |
| multi-source-qa | `gpt-5.4-mini` | 20% | 68% | +48% | [multi-source-qa__gpt-5-4-mini.md](multi-source-qa__gpt-5-4-mini.md) |
| multi-source-qa | `gpt-5.5` | 25% | 84% | +59% | [multi-source-qa__gpt-5-5.md](multi-source-qa__gpt-5-5.md) |
| research-swarm | `gpt-4.1` | 15% | 12% | -3% | [research-swarm__gpt-4-1.md](research-swarm__gpt-4-1.md) |
| research-swarm | `gpt-4.1-mini` | 15% | 25% | +10% | [research-swarm__gpt-4-1-mini.md](research-swarm__gpt-4-1-mini.md) |
| research-swarm | `gpt-5.4-mini` | 15% | 65% | +50% | [research-swarm__gpt-5-4-mini.md](research-swarm__gpt-5-4-mini.md) |
| research-swarm | `gpt-5.5` | 25% | 80% | +55% | [research-swarm__gpt-5-5.md](research-swarm__gpt-5-5.md) |
