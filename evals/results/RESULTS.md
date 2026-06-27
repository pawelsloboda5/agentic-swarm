# Eval results — safe-swarm skill uplift

> **Not generated yet.** This file is produced by `bun run table` after a run. Until then there
> are no numbers to show — and we don't ship placeholder numbers.

To generate it:

```bash
cp evals/.env.example .env.local      # then put your OPENAI_API_KEY in .env.local (repo root)
cd evals && bun install               # or: npm install
bun run models                        # confirm the exact model IDs your account can call
bun run eval                          # run the full matrix (prints a cost summary as it goes)
bun run table                         # write this file
```

See [`../README.md`](../README.md) for what is measured and how to read it.
