# Measured — what the architect harness does (and does not) buy

> **One canonical page** consolidating the three pre-registered, held-out, measured showcases the
> v0.5 → v1.0 build track ran to test the architect harness's central claim. Linked from
> [`README.md`](../../README.md), [`skills/architect/SKILL.md`](../../skills/architect/SKILL.md), and
> `CHANGELOG.md [1.0.0]`. The per-showcase evidence is **frozen** in each `RESULTS.md`; this page only
> summarizes and links — it does not restate or re-score.

## The claim we tested

The architect harness (`/agentic-swarm:architect`) decomposes a goal into researched, gate-aware
workstreams, fans them out on the safe-swarm rails, and integrates the outputs against a shared contract +
forward-coupled gates. The hypothesis under test: that this **produces a better artifact than a fair
single shot** given the *identical* spec/rubric.

## The result — three honest NULLs across three task families

| Showcase | Task family | Held-out, pre-registered primary | Result | Evidence |
|---|---|---|---|---|
| **v0.8.0** | Three.js tower-defense game | runtime integrity (boot + render, 0 uncaught errors) | **NULL** — discriminated 0 of 4 arms; supported only "rubric-in-brief > no rubric," not decomposition | [`game/RESULTS.md`](game/RESULTS.md) |
| **v0.9.0** | deterministic integer sim engine | state-fidelity under continuation (self-consistency, no external oracle) | **NULL (ceiling)** — single shots fully correct; harness matches at ~5× cost; 2 instrument artifacts caught + corrected | [`engine/RESULTS.md`](engine/RESULTS.md) |
| **v0.10.0** | 40-requirement wire-format / canonical-form library | **decomposed** OMISSION / EDGE / CASCADE completeness, per-export-isolated | **NULL (ceiling)** — all 6 arms 1.000 on every axis; harness completeness-faithful, no uplift at ~5.4× cost | [`lib/RESULTS.md`](lib/RESULTS.md) |

Each primary was **pre-registered before any scored arm** (git ancestry = proof), **held out** from the
builders, and scored by a **mechanical verdict** script. Each comparison was the harness vs a **fair
single-shot control** given the *identical* frozen spec/rubric, with every arm built in an isolated,
anti-leak-audited sandbox.

## The converged finding

On **self-contained, objectively-scorable build tasks**, strong single shots produce **correct, complete
artifacts in one pass**. The architect harness adds **no measurable artifact-quality or completeness
uplift** over a fair single shot — at roughly **5× the token cost**. This held **three times**, across
three task families, the last with a **decomposed, validated** instrument built specifically to detect the
harness's strongest theoretical case (completeness under scale) — an instrument that *could* have
attributed a win to the correct mechanism, and found none.

**Completeness-faithful, not degrading (new in v0.10.0):** the harness's decomposition into disjoint
slices + gated integration **matches** the single-shot ceiling without dropping or botching requirements
during integration. So the honest case is **"no uplift at ~5× cost," not "it degrades the work."**

## What this means for v1.0 — the narrowed claim

agentic-swarm ships its harness for **process guarantees**, **not** artifact-quality uplift:

- **Safe parallel throughput** — bounded waves, per-agent retry, the `ScheduleWakeup` stall watchdog,
  checkpoint/resume. (This is the `/agentic-swarm` **safety** layer, *separately* measured to make models
  *write* safer orchestration — see the [README eval](../../README.md#how-it-was-built--evaluated). That
  safety result stands and is independent of the artifact-quality nulls here.)
- **Bounded repair** — gate-fail → re-brief with the *exact* unmet criteria → re-run, N≤2, then honestly
  `flag` the remainder.
- **Gated forward-coupling of disclosed criteria** — each worker builds *toward* a named, checkable bar
  inlined in its brief (the headline novelty), and each output is verified against *its* gates with
  evidence + tier + confidence (never a silent pass).
- **Auditability** — the PLAN, briefs, per-gate verdicts, and journal make *what was built and checked*
  inspectable after the fact.
- **Completeness-faithful integration** — decomposition + integration match the single-shot ceiling
  without dropping requirements.

We **do not** claim the harness produces a better artifact than one capable agent on these tasks. Reach
for it when you want the **process** properties above — bounded, auditable, repairable parallel work — not
as a quality multiplier.

## What is still untested (a deferred user decision, not a result)

Every showcase used a **single, enumerable, self-contained** spec — the regime where a capable single shot
comfortably holds the whole task. The harness's completeness case could still discriminate where a single
shot *genuinely cannot hold the whole thing*:

- far more than ~40 requirements (100+),
- requirements **not enumerable up front** (the model must *discover* the work-list and can silently miss
  some), or
- cross-file / repo-scale work that exceeds one context.

Each breaks the symmetric-spec fairness or the one-offline-module scope this track deliberately held
fixed. **Running variants until one discriminates would be p-hacking** — the cardinal sin this project
rejects. The principled next step is a **user decision** to design (or not) a fair test in that regime —
not a speculative run.

## Method & integrity (shared across all three)

- **Pre-registration before builds**, held-out primary, mechanical verdict — all git-ancestry verifiable.
- **Fair single-shot control** given the identical spec/rubric; arms built in isolated sandboxes
  (anti-leak audited).
- **Instrument validation** — each scorer bracketed by a correct anchor *and* a deliberately-broken anchor
  (proven neither over-strict nor vacuous).
- **Adversarial ship-gate** — a fresh-context measurement-integrity panel audited each showcase to **0
  blockers** before release.
- **Conservative against the harness** — cost is operator-recorded (cannot inflate a win); the retry and
  per-agent-effort asymmetries all *favor* the harness, which still only tied.
- **Honest scope** — small n (≈3 builds/arm), one effort level, directional only; no statistical inference
  claimed.

---

Frozen per-showcase evidence — **do not edit** (locked provenance): [`game/`](game/) · [`engine/`](engine/)
· [`lib/`](lib/) (each carries `PREREGISTRATION.md`, `RESULTS.md`, `scoring/`, and `arms/`).
