# Gate runner — turn a gate definition into a verdict (Phase 3)

This is the contract the architect follows to **run** the gates it forward-coupled into briefs (Phase 1).
A gate library file (`gates/<id>.md`) is a *definition*; the runner is *how you execute it* and emit an
honest verdict. Zero-dependency: the runner is guidance + bundled machine commands + a separate-context
critic; it never requires an external skill or binary to function.

## Schemas

```text
gate := {
  id            // 'tests' | 'assets' | 'ui-ux' | ...   (matches the gates/<id>.md filename)
  applies_when  // when this gate is relevant (use-case / output triggers)
  tier          // 'objective' | 'critic' | 'advisory' | 'mixed'
                //   ('mixed' = an objective floor that GATES + a non-gating rung: a separate-context
                //    critic rung (e.g. ui-ux's screenshot critic, tests's exercise-check, assets's
                //    placeholder-genuineness check) AND/OR an advisory layer (e.g. assets's AI-filler))
  criteria[]    // CONCRETE, self-contained pass conditions (shipped IN the gate file)
  verifier      // a separate-context adversarial-verify prompt that checks the criteria. EVERY gate
                //   declares one (7-key schema): for 'objective' it documents the check the machine
                //   command embodies (run only as optional confirmation); for 'critic'/'mixed' the
                //   runner MUST execute it as the critic rung — a declared verifier is never dead.
  confidence    // how trustworthy this verdict is — REPORTED, never a silent pass
  backing_skill // OPTIONAL external skill that strengthens the gate IF installed
}

verdict := {
  gate_id, tier,
  status ∈ { pass, flag, fail },
  confidence ∈ 0.0 .. 1.0,
  backing_skill, skill_used: bool, degraded: bool,
  evidence[],          // ≥1 concrete item required for a pass (command output, ratios, citations)
  unmet_criteria[]     // enumerated on flag/fail
}
```

**Confidence scale** (so "reported" isn't vacuous): **0.9–1.0** = a clean objective machine pass;
**0.6–0.9** = a critic pass with strong agreement + citations; **≤ 0.6** = any **degraded** pass (missing
backing skill, browserless critic downgraded to advisory, or a retry-exhausted near-miss). A degraded
pass MUST cap at ≤ 0.6 — graceful degradation is never allowed to self-report high confidence.

## The run loop (per applicable gate)

1. **LOAD + validate.** Read `gates/<id>.md`; confirm all **7 keys** are present and `tier` is valid. A
   malformed gate file is **skipped with a logged warning** — never silently dropped.
2. **DETECT `backing_skill`** — a zero-dep filesystem probe matching the on-disk **skill directory** name
   (not the `/plugin:skill` command string):
   - `~/.claude/skills/<id>/SKILL.md` (personal)
   - `.claude/skills/<id>/SKILL.md` (project)
   - `~/.claude/plugins/cache/**/skills/<id>/SKILL.md` (marketplace installs, copied one dir/version)
   - *optional, non-load-bearing* cross-check of `claude plugin list` / `.claude/settings.json`
     `enabledPlugins` — **never depend on parsing them** (`--json` not guaranteed).
3. **RUN BY TIER:**
   - **`objective`** — run the gate's bundled machine command(s); status off exit code / threshold.
     (e.g. `ui-ux` contrast → `python gates/lib/wcag_contrast.py <fg> <bg> <size>`; `tests` → the
     project's own test command; `assets` → a content sweep via the built-in rg-backed Grep tool — or a
     stdlib `re` walk if `rg` is absent — + stdlib stat.)
   - **`critic`** — spawn a **separate-context** judge (a fresh subagent that never saw the producing
     context) using the gate's `verifier`: **binary per-criterion booleans + one grounded pass with
     citations.** The producer never grades itself; **no re-score loop.**
   - **`advisory`** — surface only; never a hard pass/fail.
   - **`mixed`** = run the objective floor (which **gates**) **then** its non-gating rung — a
     separate-context **critic rung** (e.g. `ui-ux`'s screenshot critic, `tests`'s exercise-check
     verifier) **and/or an advisory layer** (e.g. `assets`'s AI-filler check). The floor decides
     pass/flag; the rung informs + adjusts confidence. A critic rung runs at high confidence if a
     browser/runner is available, else its holistic checks **downgrade to advisory** with reported
     confidence. When a `mixed` gate declares a `verifier`, the runner **must** execute it as that
     critic rung (a `verifier` is never dead).
   - A present `backing_skill` is invoked (by its `plugin:skill` name) as an **enhancer over** — never
     instead of — the bundled path; set `skill_used: true`.
4. **EMIT** exactly one verdict per applicable gate (verdict count == number of `applies_when`-true gates).
5. **INVARIANT (anti-theater).** **No `status: pass` without ≥1 `evidence` item AND a reported `tier` AND
   a reported `confidence`.** A degraded pass is allowed **only when explicitly flagged + surfaced**
   (`degraded: true` + a visible note). A holistic "looks good" with no evidence is not a pass.
6. **ON FAIL.** Re-brief the workstream with the **exact** `unmet_criteria` and re-run, **bounded to N=2
   re-attempts (i.e. ≤3 runs total)**; then emit an honest `status: flag` with `unmet_criteria` enumerated
   — **never convert a fail to a silent pass.** Confidence reflects attempts-exhausted (do not reset to
   1.0 on a barely-passing retry). Advisory fails never re-run.
7. **GRACEFUL ≠ SILENT.**
   - Missing `backing_skill` ⇒ still run the bundled criteria, set `degraded: true`, **lower confidence
     (a degraded pass caps `confidence` at ≤ 0.6)**, emit a visible note.
   - Missing optional runner binary (axe / pa11y / Lighthouse / Playwright) ⇒ **skip that sub-check (not
     fail)** with an explicit "runner unavailable; bundled checks only" note.

## Why this shape (the anti-theater rationale)

LLM judges are biased (verbosity, position, self-enhancement) with low test-retest reliability, so a gate
that holistically "scores" output is theater. Every gate therefore (a) prefers an **objective**,
machine-checkable criterion where the use-case allows; (b) uses a **separate-context** critic with
**binary** per-criterion checks and **one** grounded pass when judgment is unavoidable; and (c)
**reports confidence** so graceful degradation (a missing backing skill / browser) never becomes *silent*
quality degradation. This is the repo's "measured, not asserted" ethos enforced at the gate layer.

## Starter library (v0.7.0)

| Gate | File | Tier | Objective floor (zero-dep) |
|---|---|---|---|
| tests | [`../gates/tests.md`](../gates/tests.md) | mixed | floor: tests exit 0 AND >0 collected; typecheck/build; diff-coverage. Critic rung: a separate-context check that the suite *exercises* the changed code. |
| assets | [`../gates/assets.md`](../gates/assets.md) | mixed | placeholder sweep + stdlib stat + SVG well-formed + favicon; filler = advisory. |
| ui-ux | [`../gates/ui-ux.md`](../gates/ui-ux.md) | mixed | WCAG contrast (`gates/lib/wcag_contrast.py`) + spacing + hover/focus + breakpoints + folded a11y; screenshot critic if a browser exists. |

Full standalone **`a11y`** (axe/pa11y/Lighthouse runner + keyboard/semantics critic) is **deferred to
v0.7.x**; its cheap checks are folded into `ui-ux` for now.
