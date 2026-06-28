export const meta = {
  name: 'v0.10.0-completeness-design-swarm',
  description: 'Phase-0 design swarm for the completeness-under-scale showcase: 5 perspective-diverse lenses each recommend a task design, a synthesis reconciles them into ONE concrete task+metric+decision-rule, then an adversarial measurement-integrity critic stress-tests it and returns blockers. Mirrors the v0.9.0 Phase-0 pattern.',
  phases: [
    { title: 'Lenses' },
    { title: 'Synthesize' },
    { title: 'Critic' },
  ],
}

const CONTEXT =
  'PROJECT: agentic-swarm, a Claude Code plugin. Its "architect harness" turns a goal into output via ' +
  'decomposition into gated workstreams -> safe parallel fan-out (one focused worker per workstream) -> ' +
  'gated integration with bounded repair. We are designing the NEXT measured showcase comparing the ' +
  'HARNESS against a FAIR SINGLE-SHOT CONTROL (one general worker, one shot, given the IDENTICAL spec).\n\n' +
  'THE ACCUMULATED FINDING (two honest NULLs so far): on a Three.js game (v0.8.0) and a deterministic sim ' +
  'engine (v0.9.0), the harness added NO measurable artifact-quality uplift over a fair single shot -- strong ' +
  'single shots produce fully-correct moderate artifacts; the harness merely matched them at ~5x the token ' +
  'cost. Both showcases tested CORRECTNESS OF ONE MODERATE ARTIFACT, which single shots handle very well.\n\n' +
  'THE ONE UNTESTED DIMENSION (this milestone): COMPLETENESS UNDER SCALE. Hypothesis: a task with MANY ' +
  '(~30-50) MUTUALLY-INDEPENDENT, automatically-checkable requirements may exceed a single shot\'s finite ' +
  'attention/context so it SILENTLY DROPS some (implements 35/40, stubs or subtly-botches the rest), whereas ' +
  'the harness gives each worker a DISJOINT SLICE of requirements (full attention per slice) + gated ' +
  'integration -> it could directly close the coverage gap. This is the harness\'s STRONGEST theoretical case ' +
  'and the honest v1.0-deciding experiment.\n\n' +
  'DESIGN CONSTRAINTS (hard):\n' +
  '1. The artifact is a SINGLE self-contained, zero-dependency, offline JS module (e.g. one ES module ' +
  'lib.mjs exposing ~40 named exports, OR an index.html exposing window.LIB). Pure functions preferred.\n' +
  '2. ~40 requirements that are MUTUALLY INDEPENDENT (dropping one does not break others -- this is the ' +
  'mechanism), each AUTOMATICALLY + OBJECTIVELY checkable by a held-out test.\n' +
  '3. UNAMBIGUOUS: each requirement must have exactly ONE correct output, fully pinned by the SPEC (prose + ' +
  'disclosed examples), so a held-out failure means a REAL drop/bug, NOT a defensible different design choice. ' +
  'Spec ambiguity is the #1 instrument-artifact risk here.\n' +
  '4. NO fragile external oracle, NO float/NaN/Infinity marshaling (prefer integer + string I/O). Held-out ' +
  'scoring is either pure self-consistency (round-trip identity) or spec-derived exact vectors.\n' +
  '5. The requirements must partition cleanly into ~4-6 DISJOINT workstreams (harness-mechanism fit), each a ' +
  'coherent group a single worker owns end-to-end.\n' +
  '6. HELD-OUT: the SPEC discloses each requirement + a couple examples (symmetric to both arms); the SPECIFIC ' +
  'test vectors + edge cases + the fact-of-measurement live ONLY in the held-out scorer (SWE-bench-style ' +
  'hidden conformance). Builders build in an ISOLATED sandbox with NO scorer reachable.\n\n' +
  'THE THREE HARD LESSONS (each cost a prior session real pain):\n' +
  '(A) BOTH-ACE CEILING: single shots are VERY capable; if the task is easy/in-distribution they ace all 40 ' +
  '-> degenerate ceiling null (the v0.8.0/v0.9.0 outcome). The design must size requirement COUNT and ' +
  'per-requirement DEPTH so one-pass attention genuinely drops some. A LOAD-BEARING PRE-FLIGHT (build ~2 ' +
  'throwaway single-shots, score them, confirm control completeness < 1.0) precedes locking the metric; if ' +
  'single shots ace it, HARDEN (more/deeper/independent requirements) or honestly report a ceiling-null.\n' +
  '(B) INSTRUMENT ARTIFACTS: a scorer coupled to a reference\'s own field/format choices measures "did you ' +
  'match my schema," not the property. Validate the instrument against a CORRECT reference (must score ~1.0) ' +
  'AND a deliberately-INCOMPLETE reference (must score clearly lower, e.g. 8 functions missing -> ~0.80).\n' +
  '(C) SCORER LEAKAGE: builder agents WILL find + tune to an in-repo scorer; build every scored arm in ' +
  'isolation with only the SPEC.\n\n' +
  'CANDIDATE DOMAINS to consider (and you may propose a better one):\n' +
  'A) String/data utility stdlib (~40 independent pure fns: case conversions, pad, slug, truncate, wordWrap, ' +
  'escapeHtml, parseQueryString, formatBytes, pluralize, ordinal, etc.)\n' +
  'B) Integer-algorithms library (gcd, lcm, isPrime, primeFactors, fib, collatz, digitSum, toRoman/fromRoman, ' +
  'toBase, popcount, etc.) -- most unambiguous + integer-only, but risk of being too easy/in-distribution.\n' +
  'C) Codec/format library (base64/hex/url encode+decode, rot13, caesar, runLength, morse, binary, csvEscape) ' +
  '-- many are ROUND-TRIPPABLE (encode then decode == identity: pure self-consistency, no oracle), a strong ' +
  'held-out property; but round-trip alone misses a consistent-but-wrong codec, so pair with vectors.\n' +
  'D) Validation library (~40 validators: email/ipv4/ipv6/luhn/isbn/uuid/hexColor/cron/semver) -- ' +
  'unambiguous IF the exact grammar is pinned per validator; non-trivial (real edge cases).\n' +
  'E) A spec-driven mini-parser / format-converter -- MANY behaviors but they tend to be INTERDEPENDENT, ' +
  'which WEAKENS the mutual-independence mechanism; treat skeptically.\n' +
  'F) Date/time + duration library over integer epochs (format codes, parse durations, add/diff) -- many ' +
  'mostly-unambiguous codes, integer-friendly.\n'

const LENS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    lens: { type: 'string' },
    recommended_domain: { type: 'string', description: 'A/B/C/D/E/F or a named novel proposal' },
    task_sketch: { type: 'string', description: 'concrete: what the library is + the kind of ~40 requirements' },
    requirement_count: { type: 'number' },
    requirement_groups: { type: 'array', items: { type: 'string' }, description: 'the ~4-6 disjoint workstream groups' },
    discrimination_argument: { type: 'string', description: 'why a single shot will DROP some while a reference covers all' },
    both_ace_risk: { type: 'string', enum: ['low', 'medium', 'high'] },
    ambiguity_risk: { type: 'string', enum: ['low', 'medium', 'high'] },
    anti_artifact_measures: { type: 'array', items: { type: 'string' } },
    held_out_scoring_approach: { type: 'string', description: 'self-consistency / spec-vectors / hybrid + how' },
    key_risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['lens', 'recommended_domain', 'task_sketch', 'requirement_count', 'discrimination_argument', 'both_ace_risk', 'ambiguity_risk', 'held_out_scoring_approach'],
}

const LENSES = [
  { key: 'discrimination-maximizer', q: 'PERSPECTIVE: maximize the chance a single shot DROPS requirements. Which design (count, per-requirement depth, independence) most reliably exhausts one-pass attention so the control scores < 1.0 while a careful reference scores ~1.0? Argue concretely about token-budget / attention exhaustion -- recall single shots are VERY capable, so easy+few requirements will NOT discriminate (the both-ace trap that nulled v0.8.0/v0.9.0). Recommend the requirement count + depth that creates a REAL coverage gap.' },
  { key: 'unambiguity-purist', q: 'PERSPECTIVE: eliminate the spec-ambiguity artifact. Which domain lets the SPEC pin exactly ONE correct output per requirement (formal grammar / mathematical definition / round-trip identity), so a held-out failure is a real drop/bug and never a defensible different choice? Rank the candidate domains by ambiguity risk and say which requirement TYPES to avoid (anything with multiple defensible outputs).' },
  { key: 'held-out-scorability', q: 'PERSPECTIVE: cleanest held-out scoring with NO fragile oracle and NO float/NaN marshaling. Which design scores best by pure self-consistency (round-trip identity) and/or spec-derived exact integer/string vectors? How do we make the scorer pure-node (import the arm module, call functions, compare) and robust to a MISSING export (a dropped requirement -> calling undefined throws -> that requirement scores 0, which is exactly the signal we want)? How do we guard against an arm that hangs or has import-time side effects?' },
  { key: 'both-ace-skeptic', q: 'PERSPECTIVE: assume this milestone will ALSO null (the base rate is two nulls). Where is the both-ace ceiling risk highest, and what makes a single shot ACTUALLY drop requirements vs just bang out 40 short functions in one pass? Be brutally honest: is 40 independent functions enough to exhaust attention, or do we need per-function depth (real edge cases, multi-step logic) so the total work genuinely overflows? Specify the PRE-FLIGHT protocol that would catch a non-discriminating task BEFORE we lock the prereg, and the honest fallback if single-shots ace it.' },
  { key: 'harness-mechanism-fit', q: 'PERSPECTIVE: make the harness mechanism (decomposition: one worker per disjoint requirement group + gated integration) DIRECTLY able to help. Which design partitions ~40 requirements into ~4-6 clean disjoint workstreams a worker can own end-to-end, such that per-slice focus plausibly beats one-pass coverage? How should gated integration verify COVERAGE (every required export present + behaving) without leaking the held-out vectors? Note the honest risk: if the harness integrator just re-bundles slices, does it actually verify completeness, or could it ALSO drop?' },
]

phase('Lenses')
function runLens(L) {
  const p =
    'You are a senior eval-design reviewer with FRESH context. ' + CONTEXT + '\n\n' +
    'YOUR SINGLE LENS (' + L.key + '): ' + L.q + '\n\n' +
    'Recommend a CONCRETE design from your lens. Be specific and skeptical -- this is the v1.0-deciding ' +
    'experiment and the project\'s #1 value is "measured, not asserted" (a null is a fine, honest outcome; ' +
    'a manufactured win is the cardinal sin). Return the schema.'
  return agent(p, { label: 'lens:' + L.key, phase: 'Lenses', schema: LENS_SCHEMA, effort: 'high' })
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
log('lenses: ' + done.length + '/' + LENSES.length)

phase('Synthesize')
const SYNTH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    chosen_domain: { type: 'string' },
    artifact_description: { type: 'string', description: 'exact: the single module, its export style, zero-dep/offline' },
    total_requirements: { type: 'number' },
    requirement_groups: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          group: { type: 'string' },
          count: { type: 'number' },
          examples: { type: 'array', items: { type: 'string' }, description: 'representative requirement names in this group' },
        },
        required: ['group', 'count'],
      },
    },
    metric_definition: { type: 'string', description: 'the held-out COMPLETENESS metric: how a requirement "passes" + how the fraction is computed' },
    decision_rule: { type: 'string', description: 'binary: harness-wins / null / loss, with degenerate guards' },
    thresholds: { type: 'string', description: 'margin delta + harness-min + floor + ceiling/floor degenerate guards (note: calibrate exact numbers from the pilot)' },
    held_out_design: { type: 'string', description: 'what is disclosed in SPEC vs held out in the scorer; anti-leak tokens to grep' },
    anti_artifact_design: { type: 'string', description: 'how spec-ambiguity + field/format coupling + over-strictness are prevented; the correct + broken reference anchors' },
    pilot_protocol: { type: 'string', description: 'the load-bearing pre-flight: build N throwaway single-shots, validate instrument, confirm discrimination, the harden-or-null fallback' },
    isolation_design: { type: 'string', description: 'how arms are built with no scorer reachable + moved in for scoring' },
    why_discriminates: { type: 'string' },
    open_risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['chosen_domain', 'artifact_description', 'total_requirements', 'requirement_groups', 'metric_definition', 'decision_rule', 'held_out_design', 'anti_artifact_design', 'pilot_protocol', 'isolation_design', 'why_discriminates'],
}
const synth = await agent(
  'You are the lead eval designer synthesizing the Phase-0 lenses into ONE concrete, buildable design for ' +
  'the completeness-under-scale showcase. ' + CONTEXT + '\n\n' +
  'Reconcile the five lens recommendations below into a SINGLE final design. Pick the domain that best ' +
  'satisfies ALL constraints (independence, unambiguity, held-out scorability, harness-mechanism fit) while ' +
  'minimizing the both-ace ceiling risk. Make every field concrete and buildable -- this becomes the SPEC + ' +
  'the held-out scorer + the pre-registration. Honor "measured, not asserted": design the PRE-FLIGHT to be ' +
  'capable of returning a ceiling-null, and say so.\n\nLENS FINDINGS:\n' + JSON.stringify(done),
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTH_SCHEMA, effort: 'high' }
)
log('synthesis: domain=' + (synth && synth.chosen_domain) + ' reqs=' + (synth && synth.total_requirements))

phase('Critic')
const CRITIC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    blockers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          issue: { type: 'string' },
          why_it_invalidates: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['issue', 'why_it_invalidates', 'fix'],
      },
    },
    ambiguity_assessment: { type: 'string' },
    both_ace_risk_assessment: { type: 'string' },
    held_out_honesty_assessment: { type: 'string' },
    independence_assessment: { type: 'string', description: 'are the ~40 requirements TRULY mutually independent?' },
    concerns: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string', enum: ['proceed', 'revise'] },
    summary: { type: 'string' },
  },
  required: ['blockers', 'ambiguity_assessment', 'both_ace_risk_assessment', 'held_out_honesty_assessment', 'independence_assessment', 'verdict', 'summary'],
}
const critic = await agent(
  'You are an ADVERSARIAL measurement-INTEGRITY critic with FRESH context, auditing the proposed design for ' +
  'the completeness-under-scale showcase BEFORE it is built. Your job is to BREAK it. ' + CONTEXT + '\n\n' +
  'THE PROPOSED DESIGN:\n' + JSON.stringify(synth) + '\n\n' +
  'Attack every integrity surface: (1) AMBIGUITY -- find requirements where two competent builders could ' +
  'produce DIFFERENT defensible outputs (that is a false-drop artifact); (2) BOTH-ACE -- argue why single ' +
  'shots might still ace this -> ceiling null, and whether the design + pre-flight honestly handle that; ' +
  '(3) HELD-OUT HONESTY -- is the "disclosed requirement vs held-out vectors" framing honest, or is the ' +
  'measured thing actually secret/unfair? (4) INDEPENDENCE -- are the requirements REALLY mutually ' +
  'independent, or do hidden couplings mean a single drop cascades (which would confound the coverage ' +
  'signal)? (5) INSTRUMENT BIAS -- could the scorer systematically favor one arm, or be coupled to a ' +
  'reference\'s own choices? A BLOCKER is a flaw that would make the result misleading or invalid if we ' +
  'built it as-is; cite the specific design element and give a concrete fix. Do NOT invent blockers to look ' +
  'thorough; if a surface is genuinely sound, say so. verdict="proceed" iff zero real blockers remain ' +
  '(concerns are fine). Return the schema.',
  { label: 'critic', phase: 'Critic', schema: CRITIC_SCHEMA, effort: 'xhigh' }
)
log('critic verdict: ' + (critic && critic.verdict) + '; blockers: ' + (critic && critic.blockers ? critic.blockers.length : 'n/a'))

return { lenses: done, synthesis: synth, critic }
