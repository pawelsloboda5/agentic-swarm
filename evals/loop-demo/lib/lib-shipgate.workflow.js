export const meta = {
  name: 'v0.10.0-shipgate-integrity',
  description: 'Measurement-INTEGRITY ship-gate: 5 fresh-context adversarial lenses scrutinize the v0.10.0 completeness-under-scale showcase (fair comparison? primary truly held out? the DECOMPOSED metric honest + the omission/edge/cascade attribution correct? scorer unbiased + per-export isolation sound? result not spun + reproduces from verdict.py?), then synthesis -> blockers. Loop to 0 blockers.',
  phases: [
    { title: 'Integrity lenses' },
    { title: 'Synthesize blockers' },
  ],
}

const DIR = 'C:/Users/Pawel Sloboda/Desktop/agentic-swarm/evals/loop-demo/lib'
const ARTIFACTS =
  'Read these committed artifacts before judging:\n' +
  '- ' + DIR + '/PREREGISTRATION.md (the locked DECOMPOSED metric + per-axis decision rule + held-out guarantee + anti-leak gate + frozen hashes)\n' +
  '- ' + DIR + '/SPEC.md (the shared contract both arms received)\n' +
  '- ' + DIR + '/RESULTS.md (the reported outcome + caveats)\n' +
  '- ' + DIR + '/PILOT.md + ' + DIR + '/SCRUB.md (the disclosed pre-flight: instrument validation, ambiguity-scrub, the CEILING discrimination check)\n' +
  '- ' + DIR + '/CRITIQUE.md (the Phase-0 adversarial critic: 3 blockers + their resolutions) + ' + DIR + '/DESIGN.md\n' +
  '- ' + DIR + '/scoring/{config.mjs,score-one.mjs,vectors.json,aggregate.py,verdict.py} (the held-out scorer) and ' + DIR + '/scoring/reference{,-broken}/lib.mjs (the anchors) and ' + DIR + '/scoring/instrument-validation.json\n' +
  '- ' + DIR + '/scoring/results.json (raw per-arm scores) and the arms under ' + DIR + '/arms/\n' +
  '- ' + DIR + '/arms/control.prompt.md and ' + DIR + '/lib-harness.workflow.js (build provenance for both arms)\n'

const LENS_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    lens: { type: 'string' },
    blockers: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { issue: { type: 'string' }, why_it_invalidates: { type: 'string' }, fix: { type: 'string' }, evidence: { type: 'string' } }, required: ['issue', 'why_it_invalidates', 'fix'] } },
    concerns: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string', enum: ['pass', 'block'] },
  },
  required: ['lens', 'blockers', 'concerns', 'verdict'],
}

const LENSES = [
  { key: 'fair-comparison', q: 'Is harness-vs-fair-control apples-to-apples? Same frozen SPEC.md to both? Same per-export-isolated instrument applied identically? Is the retry asymmetry (harness <=2 repairs, control one shot) disclosed AND conservative against the harness? Build-method symmetric (both subagent-built in isolated SPEC-only sandboxes)? Is the VOID rule (truncated/malformed control build re-run, never scored as incomplete) honored? Flag anything that makes the delta measure something other than decomposition + gated integration + repair.' },
  { key: 'held-out', q: 'Did the held-out guarantee hold? Builders must NOT have seen the scorer (config.mjs/vectors.json/score-one.mjs) or its edge vectors. Verify: arms built in isolated sandboxes with no scoring/ reachable; the anti-leak grep of every harness brief + the control prompt is clean; the "disclosed requirement + 2 happy examples vs held-out edge vectors/measurement" framing in PREREGISTRATION sec 4/7 is honest, not an overclaim. The harness coverage gate uses disclosed examples ONLY -- confirm no held-out leakage into harness machinery.' },
  { key: 'discriminator-decomposed', q: 'Is the DECOMPOSED metric honest and is the attribution correct (CRITIQUE.md blocker 3)? Confirm OMISSION-completeness is the ONLY axis carrying the "completeness under scale" claim, and that EDGE-correctness + CASCADE-isolation are reported as SEPARATE findings, never relabeled as completeness-under-scale. Is the ceiling-null reported honestly (the OMISSION axis at ceiling = "single shots did not drop; mechanism had nothing to act on")? Are the thresholds (MARGIN 0.10, CEIL 0.975) calibrated honestly from the pilot, not tuned post-hoc? Is hardening-declined justified, not p-hacking-avoidance theater?' },
  { key: 'scorer-isolation', q: 'Is the instrument unbiased + correct, and is the per-export isolation (CRITIQUE.md blocker 1) real? It must measure every arm by the SAME checks, integer/string only (no float/NaN), no field-name coupling, exports accessed by name. Confirm: a hang/crash in one export costs exactly 1/40 (re-derive from score-one.mjs + aggregate.py per-export subprocess + 8s timeout; the selftest-hang anchor scores 0.975). Confirm the ambiguity-scrubber (blocker 2) is a real independent SPEC-only check, not author-self-consistent. Re-derive 1-2 vectors by hand against SPEC.md + vectors.json and confirm they are correct + uniquely determined.' },
  { key: 'not-spun', q: 'Does RESULTS.md report EXACTLY the mechanical verdict.py output, no spin? If NULL (ceiling) or a harness LOSS, is it stated plainly (not buried/reframed as a win)? Are ALL caveats present (n=small, no inference, enumeration-defeats-omission, single task family, retry asymmetry, the grayDecode pre-freeze fix, ~5x cost)? Do the reported numbers reproduce from scoring/results.json + verdict.py? Is any claim made that the data does not support -- e.g. claiming a completeness-under-scale finding from an edge/cascade signal?' },
]

phase('Integrity lenses')
function runLens(L) {
  const p =
    'You are an ADVERSARIAL measurement-INTEGRITY reviewer with FRESH context, auditing the agentic-swarm ' +
    'v0.10.0 completeness-under-scale showcase. Your single lens: ' + L.q + '\n\n' + ARTIFACTS + '\n' +
    'A BLOCKER is an integrity flaw that would make the reported result misleading or invalid if shipped -- ' +
    'be skeptical and specific, cite evidence, propose a concrete fix. Do NOT invent blockers to look ' +
    'thorough; if the lens is genuinely clean, say so (verdict pass, empty blockers). Return the schema.'
  return agent(p, { label: 'lens:' + L.key, phase: 'Integrity lenses', schema: LENS_SCHEMA, effort: 'high' })
}
let lens = await parallel(LENSES.map(L => () => runLens(L)))
const failed = []
lens.forEach((r, i) => { if (!r) failed.push(i) })
if (failed.length) {
  log('lens retry wave: ' + failed.length + ' dropped')
  const retried = await parallel(failed.map(i => () => runLens(LENSES[i])))
  retried.forEach((r, j) => { if (r) lens[failed[j]] = r })
}
const done = lens.filter(Boolean)
const allBlockers = done.flatMap(r => (r.blockers || []).map(b => Object.assign({ lens: r.lens }, b)))
log('lenses: ' + done.length + '/' + LENSES.length + '; raw blockers: ' + allBlockers.length)

phase('Synthesize blockers')
const SYNTH_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    blocker_count: { type: 'number' },
    blockers: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { issue: { type: 'string' }, fix: { type: 'string' }, lens: { type: 'string' } }, required: ['issue', 'fix'] } },
    dismissed: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string', enum: ['ship', 'fix-required'] },
    summary: { type: 'string' },
  },
  required: ['blocker_count', 'blockers', 'verdict', 'summary'],
}
const synth = await agent(
  'You are the ship-gate synthesizer for the v0.10.0 measurement-integrity review. Below are the five ' +
  'lenses\' findings. Dedup overlapping blockers, drop any that are not genuine integrity flaws (say why in ' +
  'dismissed), and produce the FINAL blocker list (things that MUST be fixed before this showcase ships ' +
  'honestly). verdict = "ship" iff zero real blockers remain.\n\nLENS FINDINGS: ' + JSON.stringify(done),
  { label: 'synthesize', phase: 'Synthesize blockers', schema: SYNTH_SCHEMA, effort: 'high' }
)
log('synth verdict: ' + (synth && synth.verdict) + '; blockers: ' + (synth && synth.blocker_count))
return { lenses: done, synthesis: synth }
