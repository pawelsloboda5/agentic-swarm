# Pilot / calibration record (preceded the pre-registration)

> Per the adversarial integrity critic's #1 required fix: **empirically confirm the task discriminates and
> the instrument is fair BEFORE pre-registering** — otherwise we risk repeating v0.8.0's both-ace null (a
> coarse primary every arm passes) or shipping a broken instrument. This file is the disclosed calibration.
> The pilot engines are **throwaway** and are **not** scored arms; every headline arm is built *after* the
> pre-registration commit.

## What the pilot did

1. **Built a known-good reference engine** (`scoring/reference/index.html`) implementing `SPEC.md` exactly,
   and the held-out scorer (`scoring/invariants.mjs`). Validated the scorer against the reference: a correct
   build must score **1.0** on every family (else the instrument, not the engine, is wrong).
2. **Built throwaway single-shot engines** from the same `SPEC.md` (strong model, one shot — approximating
   the fair control, the hardest case for discrimination) and scored them held-out.
3. **Iterated the instrument** when the pilot exposed flaws, then re-validated.

## What the pilot found

**A fatal instrument flaw, caught and fixed (the main reason to pilot):** the first scorer read resource
events by the reference's *own* field names (`t`/`amt`). A single-shot that conserved resources correctly but
used different field names scored **0.0** on conservation — the metric was measuring "did you match my
reference's schema," not conservation. Fix: the **event object schema `{ seq, type, amount }` is now pinned
in the shared `SPEC.md`** (a symmetric API decision), and conservation is checked **independently** (actual
state-sum vs the event ledger vs `report().minted-burned`). The reference re-validated at 1.0. *Without the
pilot this broken instrument would have been pre-registered.*

**The discriminating dimension (with the fair instrument):**

| build | F_FID (primary) | floor families (F_DET/F_SNAP/F_IDEM/F_CONS/F_MONO) | hard floor |
|---|---|---|---|
| reference (correct) | **1.00** | all 1.00 | no hang / no throw |
| single-shot #1 (strong model) | **0.33** | all 1.00 | no hang / no throw |
| single-shot #2 (strong model) | **0.33** | all 1.00 | no hang / no throw |

- **Both** strong single-shots failed **only** `F_FID` (state fidelity under continuation), at an **identical
  0.33** — a systematic, not noisy, gap. They pass `restore`-*identity* (the visible state matches) but fail
  `restore`-*continue* (restoring and running forward diverges), because their snapshot omits state that
  drives future evolution (PRNG/cooldowns). They nail every other invariant.
- **Self-undetectable:** both builders' own final messages explicitly claimed "exact snapshot/restore incl.
  PRNG state + counters... verified" with 14–18 passing self-tests. Their self-tests checked restore-identity,
  **sharing the exact blind spot of the bug** — which is precisely why a held-out, independent restore-continue
  check is the right instrument and why this is a meaningful test of a *process* that verifies more rigorously.
- The reference (a careful build) passes everything → the dimension is **achievable**, not impossibly hard.
  The single-shots fail it consistently → the dimension is **not free**. This is the discriminating band.

## Calibration → the locked thresholds

From the pilot (control F_FID ≈ 0.33, reference 1.0, ~0 control variance), the pre-registered decision rule
(PREREGISTRATION.md §6) uses **margin δ = 0.25**, **harness-min Fh ≥ 0.67**, **floor-min ≥ 0.90**, and the
degenerate guards (both ≥ 0.90 → ceiling null; both < 0.20 → floor null).

## Reproduce

```
cd evals/loop-demo/engine/scoring && npm install   # provisions Playwright 1.61.1 (browser cached globally)
python aggregate.py reference reference/index.html  # expect F_FID=1.00, floor OK, hard OK
```

## Freeze

- Frozen instrument: `scoring/invariants.mjs` — **SHA-256 `15ddc7dc7cbd826fb449a3da004fef8da1e8ee895ac73c8751e21c7b9db699bb`** (280 lines) as committed at the pre-registration commit.
- Fixed scorer parameters (in `invariants.mjs`): **K=5 seeds, N_OPS=360, CHECKPOINTS=9**.
- Reference fixture: `scoring/reference/index.html` (203 lines), the calibration anchor (must score 1.0).
