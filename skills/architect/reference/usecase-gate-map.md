# Use-case → gate map (Phase 0)

Default GATE-set per use-case. The orchestrator may extend this from research, but obeys one
**load-bearing rule**:

> **Anti-theater scoping.** Only **forward-couple a gate into a brief** if that gate has **shipped,
> checkable criteria** (an entry in the gate library + a runner path). Gates marked **`future /
> not-yet-built`** below may be **named in the PLAN** ("this would also want an `api-contract` gate") so
> the human sees the full quality surface, but they must **not** appear in a worker's "MUST PASS GATES"
> block — never tell a worker it must pass a gate that has no criteria and no verifier. As gates ship,
> they flip from `future` to active and start being forward-coupled.

## Gate status (MVP = v0.7.0 target)

| Gate | Status | Notes |
|---|---|---|
| **tests** | **active (MVP)** | objective: runner detected, exit 0 AND >0 tests collected, typecheck/build, diff-coverage presence. |
| **assets** | **active (MVP)** | mixed: local assets exist & >0 bytes, SVG well-formed, no placeholders; remote refs + "AI-filler" advisory. |
| **ui-ux** | **active (MVP)** | mixed: browser-free objective floor (WCAG contrast, spacing, hover+focus-visible, breakpoints, **folded cheap a11y**: alt/accessible-name/tap-target) + screenshot critic if a browser is available. |
| **a11y** (full) | **future / not-yet-built** | cheap a11y checks are folded into `ui-ux` for the MVP; the standalone axe/pa11y/Lighthouse runner + keyboard/semantics critic ships **v0.7.x**. |
| **api-contract** | **future / not-yet-built** | request/response shape, schema/contract conformance. |
| **security** | **future / not-yet-built** | secret/exposure + common-vuln checks. |
| **docs** | **future / not-yet-built** | public surface documented; examples runnable. |
| **perf** | **future / not-yet-built** | budget/Core-Web-Vitals-style checks. |
| **data-viz** | **future / not-yet-built** | chart/encoding correctness + readability for dashboards. |
| **completeness** / **source-verification** | **future / not-yet-built** | the audit/research swarm's existing patterns, formalized as gates. |

## Default map

| Use-case | Default gate-set | Active in MVP (forward-coupled now) |
|---|---|---|
| Web UI / game / frontend | `ui-ux`, `assets`, `a11y`, `tests` | `ui-ux`, `assets`, `tests` (a11y folded into `ui-ux`) |
| Landing page | `ui-ux`, `assets`, `a11y`, `perf` | `ui-ux`, `assets` (a11y folded into `ui-ux`) |
| Dashboard | `ui-ux`, `data-viz`, `a11y`, `tests` | `ui-ux`, `tests` (a11y folded into `ui-ux`) |
| API / backend / library | `api-contract`, `tests`, `security`, `docs` | `tests` |
| Data / ML pipeline | `tests`, `api-contract`, `docs` | `tests` |
| CLI | `tests`, `docs` | `tests` |
| Audit / research swarm | `completeness`, `source-verification` | *(none active yet — surface in PLAN; these are the eval's existing patterns)* |

**Reading it:** pick the row for the classified use-case; forward-couple the **"Active in MVP"** gates
into each workstream's brief (with their inlined criteria from the gate library); list the remaining
default gates in the PLAN as deferred so the human knows what's not yet enforced. This keeps the headline
novelty honest — fully realized for frontend use-cases first (where `ui-ux`/`assets`/`tests` are all
active), broadening as the gate library grows in v0.7+.
