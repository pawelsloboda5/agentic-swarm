# Gate: `tests`

Run via [`../reference/gate-runner.md`](../reference/gate-runner.md). Objective tier: a green, meaningful
test suite — not "tests exist."

## Definition

- **id:** `tests`
- **applies_when:** the workstream produces runnable code (a detectable test runner exists, or changed
  source files have a natural test home).
- **tier:** `objective`
- **criteria:** (all bundled, zero-dep)
  1. **Runner detected** from manifests — `package.json` scripts.test / `pyproject.toml` / `pytest.ini` /
     `Cargo.toml` / `go.mod` / `Makefile` test target.
  2. **Suite passes AND collects > 0 tests** — exit 0 *and* a non-zero collected/ran count. **Zero
     collected tests = FAIL** (the #1 test theater: a green run that ran nothing).
  3. **Typecheck / build is clean** where the stack has one (`tsc --noEmit`, `mypy` if configured,
     `cargo build`, `go build`).
  4. **Diff-coverage presence** — every changed source file has at least one associated test (by
     convention/path or by appearing in coverage). Coverage **percentage** is asserted only if a baseline
     exists (don't invent a number).
- **verifier:** a separate-context check that the suite actually **exercises the changed code** (the new
  tests reference the new behavior), not merely that the command exits 0. Binary per-criterion; cite the
  test names that cover each changed unit.
- **confidence:** high when the runner is detected and tests are collected and tied to the diff; lower
  (and `degraded: true`) if no runner is detectable (then this gate can only `flag`, never silently pass).
- **backing_skill:** `gsd-add-tests` (auto-generate missing tests for uncovered changes),
  `superpowers:test-driven-development`, `vercel:react-best-practices` — **optional enhancers only**.

## Evidence required for a pass

The runner command + its output showing **exit 0 and the collected count**, plus the
changed-file→test mapping. No pass without that evidence (anti-theater invariant).

## On fail

Re-brief with the exact gaps (e.g. "file X changed but no test references it"; "suite collected 0 tests")
and re-run, bounded N=2; then honest `flag` listing `unmet_criteria`. Missing runner ⇒ `flag` with
"no test runner detected; cannot objectively verify" — never a silent pass.
