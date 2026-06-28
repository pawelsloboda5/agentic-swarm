# Gate: `ui-ux`

Run via [`../reference/gate-runner.md`](../reference/gate-runner.md). Mixed tier: a **browser-free
objective floor that always gates**, plus a screenshot **critic rung** that runs at high confidence only
if a browser is available (else it downgrades to advisory with reported confidence). Cheap a11y checks are
**folded in here** (the standalone `a11y` gate is deferred to v0.7.x).

## Definition

- **id:** `ui-ux`
- **applies_when:** the workstream renders UI (HTML/CSS/JS components, pages, a game canvas, etc.).
- **tier:** `mixed` (objective floor + critic rung)
- **criteria:**
  - **Objective floor (browser-free, statically checkable — these GATES):**
    1. **WCAG AA contrast** on every token pair / text-on-background used — computed with
       [`lib/wcag_contrast.py`](lib/wcag_contrast.py): `python gates/lib/wcag_contrast.py <fg> <bg> <size>`
       (run from the skill root; **exit 0 = pass**). Normal ≥4.5, large (≥24px or ≥18.66px bold) ≥3.0, UI
       components ≥3.0. Unresolvable pairs (gradients, image-behind-text, opacity stacks, unresolved
       tokens) are **advisory**, never silently passed; the floor must retain **at least one enforced,
       machine-checked contrast result** — if none is resolvable (or the majority are unresolvable), the
       floor is not satisfied ⇒ `flag`, not pass.
    2. **Consistent spacing scale** — spacing values come from a small defined scale, not arbitrary px.
    3. **Interaction states present** — `:hover` AND `:focus-visible` defined for interactive elements.
    4. **Breakpoints present** — responsive breakpoints / media queries are defined (static check).
    5. **Folded cheap a11y** — alt text on images, an accessible name on every control, tap targets
       **≥24×24 CSS px** (WCAG 2.2 AA 2.5.8).
  - **Critic rung (separate context — render / judgment checks; the `verifier`):**
    6. A screenshot critic at **3 breakpoints**, **if a browser is available** (the showcase provisions
       Playwright; the shipped plugin stays zero-provision), covering the checks that need a render or a
       judgment: **no horizontal overflow** at the standard widths, and the **anti-AI-default heuristic**
       (an intentional type scale + rhythm, not the generic framework default). Binary per-criterion,
       **one** grounded pass, citations. If **no browser**, these checks **downgrade to `advisory`** with
       a lowered, reported confidence — the objective floor (1–5) still gates on its own.
- **verifier:** the critic prompt — judge the rendered UI for criterion 6 (overflow + anti-AI-default,
  plus a visual re-check of 1–5) in a fresh context; the producer never grades itself; no re-score loop.
- **confidence:** high when the objective floor passes with a real screenshot critic; **reduced + 
  `degraded: true`** when the critic is downgraded to advisory (no browser) so the holistic judgment isn't
  silently skipped.
- **backing_skill:** `responsive-ui-audit`, `ui-ux-pro-max`, `web-design-guidelines`, `frontend-design`,
  `wcag-aa-contrast-remediation` — **optional enhancers only**; the bundled floor + WCAG util stand alone.

## Evidence required for a pass

The per-pair contrast results (ratios + pass/fail from the util), the spacing/states/breakpoint checks,
the folded-a11y checks, and — when available — the critic's per-criterion booleans with citations. A
holistic "looks good" with no evidence is not a pass (anti-theater invariant).

## On fail

Re-brief with the exact unmet criteria (e.g. "`--muted-foreground` on `--bg` = 3.1:1, fails AA normal";
"no `:focus-visible`"), bounded N=2; then honest `flag`. No browser ⇒ critic downgraded to advisory (note
it) — the objective floor verdict still stands.
