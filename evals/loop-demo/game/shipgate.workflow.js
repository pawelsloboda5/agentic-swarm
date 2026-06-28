export const meta = {
  name: 'v0.8.0-shipgate',
  description: 'Adversarial ship-gate for the v0.8.0 measured showcase (a NULL result): verify the measurement is honest + rigorous, not spun',
  phases: [{ title: 'ShipGate', detail: 'five fresh-context lenses stress-test the measurement integrity' }],
}

const REPO = 'C:/Users/Pawel Sloboda/Desktop/agentic-swarm'
const G = REPO + '/evals/loop-demo/game'

const CONTEXT =
  'You are ship-gating a BUILT, COMMITTED measured-showcase on branch feat/v0.8.0-measured-showcase of the agentic-swarm plugin. ' +
  'The headline result is a NULL: the architect harness did NOT beat a fair single-shot control given the same rubric. ' +
  'Your job is NOT to find a win — it is to verify the MEASUREMENT is HONEST and RIGOROUS (or find where it is not). Hunt for: a rigged/unfair comparison, a spun null, an overclaim, a biased or gameable instrument, an undisclosed confound, or a non-reproducible determinism claim.\n\n' +
  'Files to review (absolute paths):\n' +
  '- ' + G + '/PREREGISTRATION.md   (the metric committed BEFORE any build)\n' +
  '- ' + G + '/RESULTS.md            (the writeup + the honest null)\n' +
  '- ' + G + '/scoring/scorecards.json  (raw per-arm scores)\n' +
  '- ' + G + '/scoring/score_static.py  + ' + G + '/scoring/score_runtime.mjs  + ' + G + '/scoring/aggregate.py  (the instrument)\n' +
  '- the four games: ' + G + '/index.html (harness), ' + G + '/baseline-fair/index.html (fair control), ' + REPO + '/evals/loop-demo/baseline/index.html, ' + REPO + '/evals/loop-demo/agentic-swarm/index.html\n' +
  '- ' + REPO + '/CHANGELOG.md  (the [0.8.0] entry)  and the reconciled plan ' + REPO + '/docs/plans/2026-06-28-v0.8.0-measured-showcase.md (note: file may be dated 2026-06-27).\n' +
  'You may run things (e.g. re-run python ' + G + '/scoring/aggregate.py to check the static numbers reproduce; git log/show to confirm PREREGISTRATION was committed before the builds). Cite file:line.\n'

const VERDICT = {
  type: 'object',
  properties: {
    lens: { type: 'string' },
    ship: { type: 'string', enum: ['yes', 'yes-with-nits', 'no'] },
    blockers: { type: 'array', items: { type: 'object', properties: { where: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['problem'] } },
    nits: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['lens', 'ship', 'blockers'],
}

const LENSES = [
  {
    key: 'measurement-honesty',
    brief: 'Lens: MEASUREMENT-HONESTY. Is the comparison FAIR and the null HONESTLY reported? Verify: (a) the fair_control arm genuinely got the SAME rubric in-prompt and was single-shot with no gate-repair (read its build conditions vs the harness); (b) the PRIMARY metric is genuinely HELD-OUT (appears in NO brief) and was pre-committed BEFORE the builds (check git: PREREGISTRATION committed before the game files); (c) the decision rule + null definition in RESULTS match PREREGISTRATION verbatim and were NOT changed after seeing results; (d) every confound + the retry-asymmetry is disclosed; (e) the null is reported plainly and NOT spun into a win anywhere. "ship: no" = a rigged comparison, a post-hoc metric change, or a spun null.',
  },
  {
    key: 'scorer-integrity',
    brief: 'Lens: SCORER-INTEGRITY. The runtime scorer was edited (a canvas-poll fix) during the run. Verify this was a LEGITIMATE, fairness-preserving bug fix and NOT result-massaging: read the fix in score_runtime.mjs, confirm it only stops penalizing a late-but-present canvas (it does not advantage any specific arm), and reason about whether it changed the primary outcome direction. Also: do the deterministic scorers actually measure what RESULTS claims? Re-run aggregate.py and confirm the static numbers reproduce. Is any metric gameable or biased toward an arm? Is the a11y partition (a11y_report) applied consistently? "ship: no" = a scorer that biases the result or a determinism claim that does not reproduce.',
  },
  {
    key: 'design-fidelity',
    brief: 'Lens: DESIGN-FIDELITY. Does the executed showcase match the reconciled plan ' + REPO + '/docs/plans/2026-06-28-v0.8.0-measured-showcase.md (try the 2026-06-27 date if 28 is absent)? Specifically: pre-registration committed first; a fair criteria-matched second arm; a held-out primary; determinism scoped to objective metrics only (NOT the LLM critics/builds); confounds named; Playwright+axe provisioned showcase-only (plugin stays zero-provision). Flag any part of the plan that was skipped or done differently without disclosure. "ship: no" = a material deviation from the reconciled plan that is not disclosed.',
  },
  {
    key: 'honesty-overclaim',
    brief: 'Lens: HONESTY / OVERCLAIM. Read RESULTS.md + the CHANGELOG [0.8.0]. Does anything OVERCLAIM or UNDERCLAIM? Is the null stated as a null (not buried)? Is the harness given FAIR credit (its engineering-robustness edge) WITHOUT inflating it into "a better game"? Is the v1.0 implication ("the uplift gate is not met by this n=1") stated honestly and not overstated into "the harness is useless"? Are the instrument blind-spots disclosed (so the null is not overclaimed as "the harness definitively has no value")? "ship: no" = a dishonest over- or under-claim in the writeup.',
  },
  {
    key: 'reproducibility-rigor',
    brief: 'Lens: REPRODUCIBILITY + RIGOR. Re-run python ' + G + '/scoring/aggregate.py and confirm the static columns in scorecards.json/RESULTS reproduce bit-identically (the runtime/primary is live so it may vary — RESULTS must say so). Is the determinism claim correctly SCOPED to the objective scorers only (not the builds or the LLM critics)? Is n=1 / uncontrolled stated? Does RESULTS avoid implying the deterministic ruler is evidence of an effect? Is the harness-arm build actually reproducible (harness-arm.workflow.js committed)? "ship: no" = a reproducibility/rigor claim that is false or overstated.',
  },
]

phase('ShipGate')

function runLens(l) {
  const p = CONTEXT + '\n' + l.brief + '\n\nBe adversarial; try to find a reason the MEASUREMENT should not ship as honest. Set lens to "' + l.key + '". "ship: no" only for a REAL integrity defect (enumerate where/problem/fix); "yes-with-nits" if sound with cheap improvements; "yes" if genuinely honest+rigorous. Your output IS data.'
  return agent(p, { label: 'ship:' + l.key, phase: 'ShipGate', schema: VERDICT, effort: 'high' })
}

let results = await parallel(LENSES.map(l => () => runLens(l)))
const failedIdx = []
results.forEach((r, i) => { if (!r) failedIdx.push(i) })
if (failedIdx.length) {
  log('retry wave: ' + failedIdx.length + ' dropped')
  const retried = await parallel(failedIdx.map(i => () => runLens(LENSES[i])))
  retried.forEach((r, j) => { if (r) results[failedIdx[j]] = r })
}
const verdicts = results.filter(Boolean)
const missing = LENSES.filter((l, i) => !results[i]).map(l => l.key)
const blocking = verdicts.filter(v => v.ship === 'no')
log('ship-gate done: ' + verdicts.length + '/' + LENSES.length + ' lenses; ' + blocking.length + ' ship:no; missing=[' + missing.join(', ') + ']')
return { verdicts, missing }
