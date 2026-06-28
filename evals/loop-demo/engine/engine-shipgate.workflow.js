export const meta = {
  name: 'v0.9.0-shipgate-integrity',
  description: 'Measurement-INTEGRITY ship-gate: 5 fresh-context adversarial lenses scrutinize the v0.9.0 showcase (fair comparison? primary truly held out? discriminator not rigged? scorer unbiased? result not spun + reproduces?), then synthesis -> blockers. Loop to 0 blockers.',
  phases: [
    { title: 'Integrity lenses' },
    { title: 'Synthesize blockers' },
  ],
}

const DIR = 'C:/Users/Pawel Sloboda/Desktop/agentic-swarm/evals/loop-demo/engine'
const ARTIFACTS =
  'Read these committed artifacts before judging:\n' +
  '- ' + DIR + '/PREREGISTRATION.md (the locked metric + decision rule + held-out guarantee + anti-leak gate)\n' +
  '- ' + DIR + '/SPEC.md (the shared contract both arms received)\n' +
  '- ' + DIR + '/RESULTS.md (the reported outcome + caveats)\n' +
  '- ' + DIR + '/PILOT.md (the disclosed calibration that preceded the prereg)\n' +
  '- ' + DIR + '/scoring/invariants.mjs (the held-out scorer) and ' + DIR + '/scoring/verdict.py (the mechanical rule)\n' +
  '- ' + DIR + '/scoring/results.json (the raw per-arm scores) and the arms under ' + DIR + '/arms/\n' +
  '- ' + DIR + '/arms/control.prompt.md and ' + DIR + '/engine-harness.workflow.js (build provenance for both arms)\n'

const LENS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    lens: { type: 'string' },
    blockers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          issue: { type: 'string' },
          why_it_invalidates: { type: 'string' },
          fix: { type: 'string' },
          evidence: { type: 'string', description: 'cited file:line or quote' },
        },
        required: ['issue', 'why_it_invalidates', 'fix'],
      },
    },
    concerns: { type: 'array', items: { type: 'string' }, description: 'non-blocking, worth noting' },
    verdict: { type: 'string', enum: ['pass', 'block'] },
  },
  required: ['lens', 'blockers', 'concerns', 'verdict'],
}

const LENSES = [
  { key: 'fair-comparison', q: 'Is harness-vs-fair-control an apples-to-apples comparison? Same SPEC.md to both? Same instrument applied identically? Is the retry asymmetry (harness <=2 repairs, control one shot) disclosed AND conservative against the harness? Is the build-method symmetric (both subagent-built)? Flag anything that makes the delta measure something other than "decomposition + gated integration + repair".' },
  { key: 'held-out', q: 'Did the held-out guarantee actually hold? The builders must NOT have seen the scorer (invariants.mjs) or its adversarial vectors. Verify: arms were built in an isolated sandbox with no scorer reachable; the anti-leak grep of every harness brief + the control prompt is clean; the "disclosed requirement vs held-out vectors/measurement" framing in PREREGISTRATION.md sec 4 is honest, not an overclaim. NOTE: a contamination incident was caught mid-run (an in-repo control build read invariants.mjs) and ALL arms were rebuilt in isolation -- verify that remediation is real and complete (no contaminated arm survived into results.json).' },
  { key: 'discriminator', q: 'Is F_FID a REAL, meaningful discriminator and is the decision rule fair (not rigged toward a harness win)? Is the primary genuinely held out and not just "did you match the reference"? Are the thresholds (delta 0.25 / Fh>=0.67 / floor 0.90 / degenerate guards) calibrated honestly from the pilot and not tuned post-hoc to manufacture the reported verdict? Does the single-dimension nature get disclosed (not spun as broad superiority)?' },
  { key: 'scorer', q: 'Is the instrument unbiased and correct? It must measure every arm by the SAME self-consistency checks (no external oracle), with integer state (no float/NaN marshaling) and no field-name coupling (the pilot caught + fixed that). Could the scorer systematically favor one arm? Does it validate at F_FID=1.0 on the reference (fair + achievable) and discriminate the pilot single-shots? Re-derive 1-2 assertions by hand against invariants.mjs and confirm they are correct, not vacuous.' },
  { key: 'not-spun', q: 'Does RESULTS.md report the result EXACTLY as the mechanical verdict.py output, with no spin? If the verdict is NULL or a harness LOSS, is it stated plainly (not buried or reframed)? Are ALL caveats present (n=small, no statistical inference, disclosed criterion, single dimension, retry asymmetry, the contamination-and-fix)? Does the reported number reproduce from results.json? Is any claim made that the data does not support?' },
]

phase('Integrity lenses')
function runLens(L) {
  const p =
    'You are an ADVERSARIAL measurement-INTEGRITY reviewer with FRESH context, auditing the agentic-swarm ' +
    'v0.9.0 discriminating showcase. Your single lens: ' + L.q + '\n\n' + ARTIFACTS + '\n' +
    'A BLOCKER is an integrity flaw that would make the reported result misleading or invalid if shipped -- ' +
    'be skeptical and specific, cite evidence, and propose a concrete fix. Do NOT invent blockers to look ' +
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
  type: 'object',
  additionalProperties: false,
  properties: {
    blocker_count: { type: 'number' },
    blockers: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { issue: { type: 'string' }, fix: { type: 'string' }, lens: { type: 'string' } }, required: ['issue', 'fix'] } },
    dismissed: { type: 'array', items: { type: 'string' }, description: 'raised but not real, with why' },
    verdict: { type: 'string', enum: ['ship', 'fix-required'] },
    summary: { type: 'string' },
  },
  required: ['blocker_count', 'blockers', 'verdict', 'summary'],
}
const synth = await agent(
  'You are the ship-gate synthesizer for the v0.9.0 measurement-integrity review. Below are the five lenses ' +
  'findings. Dedup overlapping blockers, drop any that are not genuine integrity flaws (say why in dismissed), ' +
  'and produce the FINAL blocker list (the things that MUST be fixed before this showcase can ship honestly). ' +
  'verdict = "ship" iff zero real blockers remain.\n\nLENS FINDINGS: ' + JSON.stringify(done),
  { label: 'synthesize', phase: 'Synthesize blockers', schema: SYNTH_SCHEMA, effort: 'high' }
)
return { lenses: done, synthesis: synth }
