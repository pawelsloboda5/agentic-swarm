# Loop demo-eval — the fair A/B contract

A **showcase** eval (separate from the promptfoo script-scorer in `evals/`): take **one** simple
prompt and build the same game **two ways**, then put the results side-by-side in the README as
visual proof. This file pins the contract so the comparison is fair.

## The shared prompt (identical for both arms)

> Create a Three.js 3D tower-defense game in a single self-contained `index.html`: enemies spawn and
> follow a path toward your base, you place towers on buildable tiles to shoot them, waves escalate
> in difficulty, and a HUD shows score, lives, and gold for buying/upgrading towers. Make it playable
> and visually polished. Use Three.js from a CDN; procedural geometry only (no external art assets).

## The two arms (run for real — see `RUNBOOK.md`)

This is run by hand in **two real Claude Code sessions** driving the native `/loop`, in empty folders,
so it exercises the live `/loop` runtime + the real skill (not a subagent simulation). Step-by-step in
[`RUNBOOK.md`](./RUNBOOK.md).

| Arm | Method | Result lands in |
| :-- | :-- | :-- |
| **baseline** | A real `/loop` session, plugin **off** — plain Claude Code building the game over loop iterations. | `baseline/index.html` |
| **agentic-swarm** | A real `/loop` session with the `agentic-swarm` plugin **on** (+ `/effort ultracode`) — the skill keeps the fan-out safe by construction. | `agentic-swarm/index.html` |

## Fairness rules

- **Same prompt**, same model, comparable total effort, same empty starting state.
- **Self-contained** single-file `index.html` per arm (Three.js via CDN; no build step; no external
  assets) — so each can be opened/served directly and captured identically.
- Capture is identical for both: same viewport, same static-server, screenshots + a short GIF via the
  Chrome MCP, written to `media/`.
- **Honest framing:** this measures whether the agentic-swarm *methodology* (decompose + parallel
  build + integrate/verify) yields a more complete/polished result than a single linear worker at
  comparable effort. It is a showcase, not a controlled benchmark — the README says so.

## Repo-weight budget

GIFs/PNGs are binary. Keep total media under ~3 MB: cap GIF dimensions (~800px wide), short loops
(~6–10 s), and PNG screenshots compressed. If it grows past that, move media to git-lfs.
