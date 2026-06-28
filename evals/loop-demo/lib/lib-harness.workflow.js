export const meta = {
  name: 'v0.10.0-harness-arm',
  description: 'Build K=3 wire-format/canonical-form libraries THROUGH the architect harness: contract -> 6 disjoint workstream slices (one focused worker each) -> gated integration (disclosed-example coverage gate, <=2 repairs). Briefs derive ONLY from SPEC.md (no held-out vector leak). Tests harness MATCH-vs-LOSS vs the single-shot ceiling.',
  phases: [
    { title: 'Contract' },
    { title: 'Workstreams' },
    { title: 'Integrate' },
  ],
}

// HELD-OUT INTEGRITY: ROOT must be an ISOLATED copy containing ONLY SPEC.md (+ arms/) -- NO scoring/,
// no vectors.json, no reference. Builder agents WILL tune to an in-repo scorer (v0.9.0 caught two).
// Finished lib.mjs files are copied into the repo's arms/ for scoring only.
const ROOT = 'C:/Users/PAWELS~1/AppData/Local/Temp/claude/C--Users-Pawel-Sloboda-Desktop-agentic-swarm/e40b67c0-fd5b-4518-9772-51d7f44dc9a0/scratchpad/arms-sandbox'
const SPEC = ROOT + '/SPEC.md'
const ISOLATE = ' Build PURELY from the SPEC: read ONLY the SPEC + the shared contract, work ONLY within your assigned directory, and do NOT search the wider filesystem or look for any test/scorer/verification harness -- there is none to consult; implement and verify from first principles + the SPEC examples.'
const BUILDS = ['harness-1', 'harness-2', 'harness-3']

const CONTRACT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { ok: { type: 'boolean' }, contract_path: { type: 'string' }, exports_total: { type: 'number' }, summary: { type: 'string' } },
  required: ['ok', 'summary'],
}
const WS_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { workstream: { type: 'string' }, file: { type: 'string' }, implemented: { type: 'array', items: { type: 'string' } }, selfcheck: { type: 'string' }, issues: { type: 'array', items: { type: 'string' } } },
  required: ['workstream', 'file', 'selfcheck'],
}
const INTEGRATE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    ok: { type: 'boolean' }, lines: { type: 'number' }, exports_present: { type: 'number' },
    disclosed_examples_pass: { type: 'boolean', description: 'every export passes its 2 SPEC happy examples' },
    repairs_done: { type: 'number' }, known_issues: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' },
  },
  required: ['ok', 'summary'],
}

// 6 DISJOINT workstreams = the SPEC's WS1..WS6 (one focused worker per slice -- the decomposition the
// completeness-under-scale hypothesis tests). Function lists are the DISCLOSED export names from SPEC.md.
const WORKSTREAMS = [
  { key: 'WS1-baseN', fns: 'hexEncode, hexDecode, base64Encode, base64Decode, base32Encode, base32Decode, toRadix, fromRadix', mission: 'the 8 Base-N codecs (hex, RFC4648 base64 with pinned padding, the CUSTOM disclosed-alphabet base32 with the exact partial-group char-count rule, and toRadix/fromRadix over radix 2-36).' },
  { key: 'WS2-escaping', fns: 'percentEncode, percentDecode, escapeHtml, unescapeHtml, csvEscape, csvUnescape', mission: 'the 6 escaping/quoting codecs (RFC3986 percent-encoding with the exact unreserved set + UPPERCASE %HH, the 5-entity HTML escape with apostrophe &#39;, and RFC4180 minimal-quote CSV field escaping).' },
  { key: 'WS3-ciphers', fns: 'rot13, atbash, caesarEncode, caesarDecode, runLengthEncode, runLengthDecode', mission: 'the 6 cipher/run-length codecs (rot13 + atbash involutions, caesar with mod-26 wraparound incl. negative shifts, and the custom decimal-count-prefix run-length scheme over non-digit input).' },
  { key: 'WS4-intxform', fns: 'toRoman, fromRoman, zigzagEncode, zigzagDecode, grayEncode, grayDecode', mission: 'the 6 integer transforms (Roman 1-3999 subtractive, zigzag signed<->nonneg via 2n/-2n-1, and binary-reflected Gray code with grayDecode the TRUE inverse of grayEncode).' },
  { key: 'WS5-canon', fns: 'canonicalizeIPv6, canonicalizeIPv4, canonicalizeUuid, canonicalizeHexColor, canonicalizeInteger, collapseWhitespace, normalizeNewlines', mission: 'the 7 idempotent canonicalizers (RFC5952 IPv6 incl. longest-run/leftmost-tie/single-zero rules, IPv4 leading-zero strip, lowercase UUID, hex-color #RGB->#rrggbb expansion, integer sign/zero normalization, space/tab collapse, newline normalization).' },
  { key: 'WS6-format', fns: 'slugify, titleCase, ordinal, formatThousands, formatDuration, padCenter, zeroPad', mission: 'the 7 single-direction formatters (slugify with the pinned [a-z0-9]/hyphen rule, titleCase with the disclosed small-word list + always-cap first/last, ordinal 11/12/13 rule, comma grouping, formatDuration NhNNmNNs, padCenter right-bias, zeroPad sign-aware).' },
]

async function buildOne(b) {
  const dir = ROOT + '/arms/' + b
  // ---- Phase 0: contract ----
  phase('Contract')
  const contractPrompt =
    'You are the ARCHITECT (Phase 0) building a deterministic, zero-dependency JavaScript "wire-format & ' +
    'canonical-form toolkit" -- ONE ES module ' + dir + '/lib.mjs exporting EXACTLY 40 named pure functions.\n' +
    'Read the FULL spec at ' + SPEC + ' and conform to it exactly.\n' +
    'Write a tight SHARED CONTRACT to ' + dir + '/.contract.md so six parallel workstreams each implement ' +
    'their disjoint slice of the 40 functions as named exports that MERGE cleanly into one lib.mjs. The ' +
    'contract MUST specify: (1) the module/file convention (each workstream writes named `export function` ' +
    'declarations to ' + dir + '/.workstreams/<key>.mjs; the integrator concatenates them into one lib.mjs); ' +
    '(2) the global rules every function obeys (pure, deterministic, string/integer I/O only, byte = code ' +
    'point 0-255, no deps, no top-level side effects); (3) the exact list of which of the 40 exports belongs ' +
    'to each of the six workstreams (WS1 base-N, WS2 escaping, WS3 ciphers, WS4 integer-transforms, WS5 ' +
    'canonicalizers, WS6 formatters). Keep it concrete. Return the schema (exports_total = 40).' + ISOLATE
  let contract = await agent(contractPrompt, { label: b + ':contract', phase: 'Contract', schema: CONTRACT_SCHEMA, effort: 'high' })
  if (!contract) { log(b + ' contract dropped; retry'); contract = await agent(contractPrompt, { label: b + ':contract:retry', phase: 'Contract', schema: CONTRACT_SCHEMA, effort: 'high' }) }
  if (!contract || !contract.ok) { log(b + ' contract failed; skipping'); return { build: b, ok: false, stage: 'contract' } }
  log(b + ' contract ok')

  // ---- Phase 2: 6 workstream workers (one wave; retry drops) ----
  phase('Workstreams')
  function runWs(w) {
    const p =
      'You are a WORKER (Phase 2) on the "' + w.key + '" workstream of a deterministic wire-format/canonical-form ' +
      'JavaScript library.\nFIRST read the shared contract at ' + dir + '/.contract.md AND the spec at ' + SPEC + '; ' +
      'conform to both EXACTLY (function names, parameter order, pinned rules + edge behavior, the 2 worked examples ' +
      'per function).\n\nMISSION: implement ' + w.mission + '\nYour exports (and ONLY these): ' + w.fns + '\n\n' +
      'Write clean self-contained JavaScript as named `export function` declarations to ' + dir + '/.workstreams/' + w.key + '.mjs. ' +
      'Pure, deterministic, integer/string I/O only, no external deps. Implement EVERY function in your slice completely ' +
      '(all edge rules the SPEC pins, not just the happy path) and self-verify each against its SPEC examples before ' +
      'returning. Return the schema (file = path written; implemented = the export names you provided; selfcheck = how ' +
      'you verified; issues = anything unresolved).' + ISOLATE
    return agent(p, { label: b + ':ws:' + w.key, phase: 'Workstreams', schema: WS_SCHEMA, effort: 'high' })
  }
  let ws = await parallel(WORKSTREAMS.map(w => () => runWs(w)))
  const failed = []
  ws.forEach((r, i) => { if (!r) failed.push(i) })
  if (failed.length) {
    log(b + ' workstream retry wave: ' + failed.length + ' dropped')
    const retried = await parallel(failed.map(i => () => runWs(WORKSTREAMS[i])))
    retried.forEach((r, j) => { if (r) ws[failed[j]] = r })
  }
  log(b + ' workstreams: ' + ws.filter(Boolean).length + '/' + WORKSTREAMS.length)

  // ---- Phase 3: gated integration (disclosed-example coverage gate; <=2 repairs) ----
  phase('Integrate')
  const integratePrompt =
    'You are the INTEGRATOR (Phase 3, gated integration) for the wire-format/canonical-form library.\n' +
    'Inputs on disk: the contract ' + dir + '/.contract.md and the six workstream slices in ' + dir + '/.workstreams/ ' +
    '(WS1-baseN.mjs, WS2-escaping.mjs, WS3-ciphers.mjs, WS4-intxform.mjs, WS5-canon.mjs, WS6-format.mjs; some may be ' +
    'partial -- be robust).\n\nTASK: assemble ONE complete, self-contained, zero-dependency ' + dir + '/lib.mjs that ' +
    'exports ALL 40 named functions exactly per the spec at ' + SPEC + '. Merge the six slices; resolve any name/format ' +
    'conflicts against the contract + spec.\n\nGATED INTEGRATION (do real verification, up to 2 repair passes): after ' +
    'writing lib.mjs, run a COVERAGE GATE -- for EVERY one of the 40 exports, confirm (a) it is present as a named ' +
    'export and (b) it passes BOTH of its 2 worked examples from the SPEC. FIX any export that is missing or fails an ' +
    'example, then re-run the gate (<=2 repair passes). Return the schema HONESTLY: exports_present = how many of 40 are ' +
    'present, disclosed_examples_pass = whether all 40 pass their 2 SPEC examples, lines = final line count, ' +
    'repairs_done = repair passes run.' + ISOLATE
  let integ = await agent(integratePrompt, { label: b + ':integrate', phase: 'Integrate', schema: INTEGRATE_SCHEMA, effort: 'high' })
  if (!integ) { log(b + ' integrate dropped; retry'); integ = await agent(integratePrompt, { label: b + ':integrate:retry', phase: 'Integrate', schema: INTEGRATE_SCHEMA, effort: 'high' }) }
  log(b + ' integrate: ok=' + (integ && integ.ok) + ' present=' + (integ && integ.exports_present) + '/40 repairs=' + (integ && integ.repairs_done))
  return { build: b, ok: !!(integ && integ.ok), contract, workstreams: ws.filter(Boolean), integrated: integ }
}

const results = []
for (const b of BUILDS) {
  log('=== building ' + b + ' ===')
  results.push(await buildOne(b))
}
return { results, builds: BUILDS }
