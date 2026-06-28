# MVP Gate Library + Versioning — Readiness Build-Spec

> ⚠️ **Superseded by measurement (2026-06-28).** This dated doc gates v1.0 on a showcase "measuring the
> quality uplift." The showcases ran (v0.8 game · v0.9 engine · v0.10 library) and measured **NO**
> artifact-quality/completeness uplift over a fair single shot — only ~5× cost. v1.0 narrows the claim to
> the harness's **process guarantees**; see [`evals/loop-demo/MEASURED.md`](../../evals/loop-demo/MEASURED.md)
> and `CHANGELOG.md [1.0.0]`. The dated body below is preserved as planning provenance.

> **For Claude:** this is a **design-readiness build-spec**, not a task-by-task TDD plan. The project
> is deliberately **architecture-first / build-deferred** — do NOT author the `architect` skill
> or gate files from this doc. A future build session expands §5 into `superpowers:writing-plans`
> TDD tasks (REQUIRED SUB-SKILL then: `superpowers:test-driven-development`).

**Status:** research-backed, **pending user confirmation** of the marked decisions · **Date:** 2026-06-27
**Goal:** lock the MVP gate library (gates × tiers × self-contained criteria × enhancers), the
gate-runner contract, and the version/release track — the two still-open items from the harness design.
**Research backing:** dogfooded swarm `wf_fb8217fd-2cb` (6/6 subareas, `missing: []`) +
[`research/2026-06-27-architecture-research-synthesis.md`](research/2026-06-27-architecture-research-synthesis.md).
Workflow script: [`research/gate-research.workflow.js`](research/gate-research.workflow.js).

---

## 1. MVP gate library (research-backed)

**MVP set = `{ tests, assets, ui-ux }`** (each with folded objective a11y sub-checks); **standalone
`a11y` deferred to v0.7.x.** Every gate ships self-contained (zero external skills) and reports a
`tier` + `confidence`; external skills are optional enhancers only.

| Gate | Tier | In MVP | Self-contained core (zero-dep) | Optional enhancers (absent ⇒ degrade *loudly*) |
|---|---|---|---|---|
| **tests** | objective | ✅ | Detect runner from manifests → run project's own test cmd → **exit 0 AND >0 tests collected** (zero-tests = FAIL) + typecheck/build + **diff-coverage presence** (every changed source has a test). Coverage % only if a baseline exists. | `gsd-add-tests` (auto-gen missing tests), `superpowers:test-driven-development`, `vercel:react-best-practices` |
| **assets** | mixed | ✅ | ripgrep sweep for placeholder hosts/lorem/empty-src/TODO (scoped + allowlist) + **stdlib stat**: every *local* asset exists & >0 bytes + **SVG well-formed XML** + favicon for HTML. Remote/CDN refs = advisory. "AI-filler" = **advisory, never hard-fail**. | `responsive-ui-audit` (Playwright catches `naturalWidth===0`/404s), `frontend-design`, `ui-ux-pro-max` |
| **ui-ux** | mixed | ✅ | **Objective floor (always gates, browser-free):** WCAG contrast on token pairs, consistent spacing scale, hover+focus-visible present, breakpoints present, anti-AI-default heuristic **+ folded cheap a11y** (alt-text, accessible-name, tap-target ≥24px). **Critic rung:** separate-context screenshot critic (3 breakpoints) at high confidence *if a browser is available*, else static critic **downgraded to advisory** with reported confidence. One grounded pass, binary per-criterion, citations. | `responsive-ui-audit`, `ui-ux-pro-max`, `web-design-guidelines`, `frontend-design` |
| **a11y** (full) | mixed | ⛔ **defer → v0.7.x** | Bundled WCAG math + alt/label/tap-target + **auto-detected axe-core/pa11y/Lighthouse** (`violations===0`) + critic for keyboard/focus/semantics. **"PASS ≠ conformance"** caveat (automation catches ~30–50% of WCAG). | `wcag-aa-contrast-remediation`, `responsive-ui-audit`, `web-design-guidelines` |

**Why defer standalone `a11y`:** its cheap objective wins (contrast/alt/label/tap-target) **fold into
the `ui-ux` gate now** (same artifact + verifier) — a standalone gate would **double-count**. Its
distinctive value (the axe/pa11y/Lighthouse runner + keyboard/semantics critic) is real but additive,
and an automated PASS must never masquerade as full conformance.

**Anti-rubber-stamp invariants baked into the criteria:** zero collected tests = FAIL (the #1 test
theater); a well-formed-but-meaningless SVG still fails the placeholder intent (so well-formedness
alone is insufficient — pair with the advisory filler check); a pure-LLM ui-ux critic judging *from
code alone* will confidently pass ugly UI → anchor on the objective floor + a real screenshot when
possible.

## 2. Gate-runner contract (research-backed; skill-detection Context7-verified)

```
gate := { id, applies_when, tier ∈ {objective, critic, advisory},   // mixed = objective-floor + critic-rung
          criteria[], verifier, confidence, backing_skill }
verdict := { gate_id, tier, status ∈ {pass, flag, fail}, confidence 0..1,
             backing_skill, skill_used: bool, degraded: bool, evidence[], unmet_criteria[] }
```

1. **LOAD + validate** the gate file (all 7 keys; malformed ⇒ skipped with a logged warning, not silently dropped).
2. **DETECT `backing_skill`** — zero-dep filesystem probe (`test -f` / Glob), matching the on-disk
   **skill *directory* name** (not the `/plugin:skill` command string):
   - `~/.claude/skills/<id>/SKILL.md` (personal)
   - `.claude/skills/<id>/SKILL.md` (project)
   - `~/.claude/plugins/cache/**/skills/<id>/SKILL.md` (marketplace installs are *copied* here, one dir/version)
   - *optional* cross-check: `claude plugin list` / `.claude/settings.json` `enabledPlugins` — **never depend on parsing them** (`--json` not guaranteed).
3. **RUN BY TIER:** `objective` = run the bundled machine command, status off exit code/threshold.
   `critic` = spawn a **separate-context** judge (a `context: fork` skill or a general-purpose subagent
   that never saw the producing context) → **binary per-criterion booleans + one grounded pass with
   citations**; the producer never grades itself; no re-score loop. `advisory` = surface only. A present
   `backing_skill` is invoked via the Skill tool by its `plugin:skill` name as an **enhancer over** (never
   instead of) the bundled path.
4. **EMIT** exactly one verdict per applicable gate (count == # of `applies_when`-true gates).
5. **INVARIANT (anti-theater):** no `status: pass` without ≥1 `evidence` item **and** a reported `tier`
   **and** a reported `confidence`. Degraded passes are allowed **only when explicitly flagged + surfaced**.
6. **ON FAIL:** re-brief the workstream with the **exact unmet criteria** and re-run, **bounded N=2**;
   then honest `status: flag` with `unmet_criteria` enumerated — never convert a fail to a silent pass;
   confidence reflects attempts-exhausted (not reset to 1.0 on a barely-passing retry). Advisory fails never re-run.
7. **GRACEFUL ≠ SILENT:** missing `backing_skill` ⇒ still run bundled criteria, set `degraded: true`,
   lower confidence, emit a visible note. Missing optional runner binary (axe/pa11y/Lighthouse/Playwright)
   ⇒ **skip** that sub-check (not fail) with an explicit "runner unavailable; bundled checks only" note.

## 3. Versioning & release track (research-backed; grounded in repo + Claude Code docs)

The harness is a **v0.5 → v1.0 track**, staying on 0.x (surface **explicitly not frozen**) until the
MVP is complete **and the showcase MEASURES the quality uplift** — because 1.0 is a stability/quality
promise and the headline novelty is unproven until measured ("measured, not asserted").

| Tag | Contents |
|---|---|
| **v0.5.0 — now** | Merge `feat/loop-demo-v0.5.0`; CHANGELOG "Added: robustness eval (deterministic curve + real axios review + session-drop evidence) as the **Phase 2 safety proof**" + the committed architecture/design docs; bump `plugin.json` → `0.5.0`; annotated tag `v0.5.0`; `[0.5.0]` compare-link footer. *(Consistent with the 0.2.0/0.3.0 evals-only release precedent.)* |
| **v0.6.0** | `architect` skill scaffold (Phase 0/1) + brief-template (additive minor). |
| **v0.7.0** | Starter gate library `{ tests, assets, ui-ux + folded a11y }` + the gate runner; each gate file declares `id/applies_when/tier/criteria/verifier/confidence/backing_skill`. (Full standalone `a11y` follows in **v0.7.x** — see §1/§6.) |
| **v0.8.0** | The showcase redo (Three.js game) that **MEASURES** swarm-beats-bare-`/loop` — the proof. |
| **v1.0.0** | MVP complete + showcase measured + `claude plugin validate --strict` green (both modes) + docs updated. **1.0 freezes the public contract = the two skills + the gate-file schema.** |

**Discipline:** keep `plugin.json` `version` and the git tag in **lockstep**; do **not** add a `version`
to `marketplace.json` (single source of truth = `plugin.json`); do **not** unset `plugin.json` `version`
(SHA fallback turns every commit into a spurious "update"). Post-1.0 SemVer: gate-schema change or skill
removal = **MAJOR**; new gate/skill = **MINOR**; fix = **PATCH**.

## 4. Tooling verification status (CLAUDE.md discipline)

| Tool | Status | Note |
|---|---|---|
| **axe-core** | ✅ **Context7-verified first-hand** (`/dequelabs/axe-core`) | `await axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})` → `{violations:[{id,nodes}]}`; `resultTypes:['violations']` cuts compute. **Runs inside a DOM/browser** (needs Playwright/Puppeteer/jsdom) ⇒ optional browser-dependent enhancer. |
| **SVGO** | ✅ Context7-verified by swarm (`/svg/svgo`) | Optional accelerator; SVG well-formedness is achievable with a **stdlib XML parser** (no dep). |
| **Playwright** | ✅ verified current | `setViewportSize` + `screenshot({fullPage:true})`; a harness-provisionable dependency, **not a skill**. |
| **WCAG AA contrast** | ✅ fixed standard (no library) | Ships inline: `cs=c/255; lin = cs≤0.03928 ? cs/12.92 : ((cs+0.055)/1.055)^2.4; L=0.2126R+0.7152G+0.0722B; ratio=(L_light+0.05)/(L_dark+0.05)`; pass ≥4.5 normal / ≥3 large (≥24px or ≥18.66px bold) / ≥3 UI components. |
| **pa11y · linkinator · html-validate · Lighthouse** | ⚠ official-docs only (not in Context7) | Optional enhancers behind capability detection. **Re-verify each tool's exact API via Context7/official docs at build time** before authoring its gate file. |

## 5. Build roadmap (high-level — expand to TDD at build time, NOT now)

Per the build-deferred constraint, this is the *shape* a future `superpowers:writing-plans` session
fills in (REQUIRED SUB-SKILL then: `superpowers:test-driven-development`, atomic commits):

1. **v0.5.0 release chore** (mergeable now, low-risk): CHANGELOG + `plugin.json` bump + tag; validate `--strict` both modes. *(This is the only near-term actionable; the rest stays designed-not-built.)*
2. **v0.6.0:** `skills/architect/SKILL.md` (Phases 0/1 orchestration) + `reference/brief-template.md` (forward-couples gates into briefs).
3. **v0.7.0:** `skills/architect/gates/{tests,assets,ui-ux}.md` (+ `a11y.md`) each = §2 schema; a `gate-runner` reference implementing the §2 contract (detection probe, verdict schema, invariant tests); the bundled WCAG contrast utility (shared by ui-ux + a11y).
4. **v0.8.0:** the game-demo redo run *through* the harness, measuring vs the committed bare-`/loop` "before".
5. **v1.0.0:** docs/README, `validate --strict`, freeze the gate-file schema.

## 6. Decisions

**Confirmed (2026-06-27):**
- **MVP gate set = `{ tests, assets, ui-ux }`** with the cheap objective a11y checks **folded into
  `ui-ux`**; the standalone `a11y` gate (axe/pa11y/Lighthouse runner + keyboard/semantics critic)
  **deferred to v0.7.x.** ✅
- **Versioning = the v0.5 → v1.0 track**: **tag `v0.5.0` now** (robustness eval = the Phase-2 safety
  proof; merge `feat/loop-demo-v0.5.0`) → v0.6 architect → v0.7 gates → v0.8 measured showcase → **v1.0**
  (freezes the gate-file schema, only after the showcase measures the uplift). ✅
- **`ui-ux` critic browser policy = opportunistic in the plugin, provisioned in the showcase**: the
  shipped plugin stays **zero-provision** (the browser-free objective floor always gates; the screenshot
  critic runs only if a browser is already available, else the holistic checks downgrade to **advisory**
  with reported confidence). The **showcase eval provisions Playwright** so `ui-ux` gates at high
  confidence where the proof matters. ✅

**Adopted low-stakes defaults:** tap-target at **24×24 CSS px** (WCAG 2.2 AA 2.5.8, not 44×44 AAA);
unresolvable contrast pairs (gradients, image-behind-text, opacity stacks, unresolved tokens) marked
**advisory**, never silently passed; fail-handling **re-brief + re-run bounded N=2** then honest flag.

## 7. Risks

1. **Objective/automated PASS ≠ full conformance** — axe/pa11y catch ~30–50% of WCAG; a green suite
   proves only what it exercises. Every objective pass carries a coverage caveat; a11y/ui-ux pair with a critic.
2. **Silent degradation** — falling back to bundled criteria without `degraded:true`+lowered confidence+note
   is hidden quality loss; the no-pass-without-evidence+tier+confidence invariant must be *asserted*, not assumed.
3. **Self-grading critic drift** — judge in a fresh separate context, one pass, binary + citations.
4. **Double-counting** — contrast/alt/tap-target overlap a11y/assets/ui-ux; the decomposition layer routes each objective sub-check to a single owner.
5. **Hidden hard dependency** — requiring Playwright/a dev server flips graceful degradation into hard failure on browserless machines; the objective floor must stay browser-free and gate-capable alone.
