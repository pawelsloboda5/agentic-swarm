# Loop demo-eval — real-session runbook (the legit A/B)

This eval is run by hand in **two real Claude Code sessions** driving the native `/loop`, so it
exercises the actual `/loop` runtime + the real `agentic-swarm` skill — not a simulation. You drive
the two loops; the maintainer handles capture + the side-by-side README.

## The shared prompt (paste IDENTICALLY into both `/loop`s)

```
/loop Create a Three.js 3D tower-defense game in a single self-contained index.html: enemies spawn and follow a path toward your base, you place towers on buildable tiles to shoot them, waves escalate in difficulty, and a HUD shows score, lives, and gold for buying/upgrading towers. Make it playable and visually polished. Use Three.js from a CDN; procedural geometry only (no external art assets). The entry file MUST be index.html at the folder root.
```

> An **explicit** prompt is passed, so any `loop.md` is ignored (verified behavior) — both arms get
> byte-identical instructions.

## The two sessions

| Arm | Folder | Plugin | Settings |
| :-- | :-- | :-- | :-- |
| **baseline** | `C:\Users\Pawel Sloboda\Desktop\loop-demo-baseline` (empty) | **OFF** | see chosen config |
| **agentic-swarm** | `C:\Users\Pawel Sloboda\Desktop\loop-demo-swarm` (empty) | **ON** | see chosen config + `/effort ultracode` |

### Baseline session
1. Open a new terminal in `C:\Users\Pawel Sloboda\Desktop\loop-demo-baseline`.
2. Start Claude **without** the plugin: plain `claude`. (`agentic-swarm` is **not** installed globally
   on this machine — confirmed via `claude plugin list` — so plain `claude` is already vanilla; no
   `/plugin disable` needed. The folder is empty: nothing is copied in — that's the fair start.)
3. `/model opus` + `/effort ultracode` (**config A**: identical power to the swarm arm — the *only*
   difference between arms is that this one has the plugin OFF).
4. Paste the shared `/loop …` prompt. Let it run for the agreed budget, then press **`Esc`** to stop.

### Agentic-swarm session
1. Open a new terminal in `C:\Users\Pawel Sloboda\Desktop\loop-demo-swarm`.
2. Start Claude **with** the local plugin active:
   `claude --plugin-dir "C:/Users/Pawel Sloboda/Desktop/agentic-swarm"`
   (or ensure the installed `agentic-swarm` plugin is enabled).
3. `/model opus` + `/effort ultracode` (turns on dynamic workflow orchestration — what the skill
   makes safe by construction).
4. Paste the **same** shared `/loop …` prompt. Same budget, then **`Esc`**.

## Config (the one design choice) — **CHOSEN: A**

- **A. Same power, plugin on/off — ✅ CHOSEN:** BOTH sessions use `/model opus` + `/effort
  ultracode`; the ONLY difference is the plugin (on for swarm, off for baseline). Cleanest
  single-variable test — isolates exactly what the plugin adds to a fan-out-heavy build.
- ~~B. Out-of-box vs recommended: baseline = plain `/loop` at default effort, no plugin; swarm =
  `/loop` + plugin + `ultracode`.~~ (not chosen — changes two variables at once.)

## Budget (same for both — fair A/B)

Picked: **medium, ~30–45 min per arm.** Run each for roughly the same wall-clock (or the same number
of `/loop` iterations), then `Esc`. **Note for each arm: elapsed time + iteration count** — these go
in the README for honesty.

## When both are done

Tell the maintainer ("baseline done / swarm done"). They will:
1. Copy each `index.html` (+ any sibling files) into `evals/loop-demo/{baseline,agentic-swarm}/`.
2. Serve each build on a local static server and capture **identical** screenshots + a short GIF via
   the Chrome MCP into `evals/loop-demo/media/` (repo-weight budget: < ~3 MB total).
3. Assemble the side-by-side section in the repo README + a short methodology note (each arm's exact
   config, elapsed time, iterations) so the comparison is transparent, then ship as **v0.5.0**.

## Fairness checklist

- [ ] Identical prompt, identical budget, empty starting folders, same model.
- [ ] Only the intended variable(s) differ (per the chosen config).
- [ ] Entry artifact is `index.html` at each folder root.
- [ ] Elapsed time + iteration count recorded per arm.
- [ ] README states each arm's exact config — no overclaiming; it's a showcase, not a controlled benchmark.
