export const meta = {
  name: 'v0.8.0-harness-arm',
  description: 'Build a Three.js tower-defense game THROUGH the architect harness: research+contract, gated workstream drafts, gated integration',
  phases: [
    { title: 'Contract', detail: 'research what GOOD looks like + define the shared contract' },
    { title: 'Workstreams', detail: 'parallel gate-aware drafts: engine, gameplay, ui-ux+a11y, art+audio' },
    { title: 'Integrate', detail: 'assemble one working self-contained index.html + run objective gates' },
  ],
}

const REPO = 'C:/Users/Pawel Sloboda/Desktop/agentic-swarm'
const GAME = REPO + '/evals/loop-demo/game'
const WCAG = 'python ' + REPO + '/skills/architect/gates/lib/wcag_contrast.py <fg> <bg> normal  (exit 0 = pass, ratio >= 4.5)'

const SHARED_PROMPT = 'Create a Three.js 3D tower-defense game in a single self-contained index.html: enemies spawn and follow a path toward your base, you place towers on buildable tiles to shoot them, waves escalate in difficulty, and a HUD shows score, lives, and gold for buying/upgrading towers. Make it playable and visually polished. Use Three.js from a CDN (importmap); procedural geometry only (no external art assets). The entry file MUST be index.html.'

phase('Contract')

const CONTRACT_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    summary: { type: 'string' },
    token_pairs: { type: 'array', items: { type: 'object', properties: { fg: { type: 'string' }, bg: { type: 'string' }, ratio: { type: 'number' } }, required: ['fg', 'bg'] } },
    modules: { type: 'array', items: { type: 'string' } },
  },
  required: ['ok', 'summary'],
}

const contractPrompt =
  'You are the ARCHITECT (Phase 0) for a showcase that builds a polished Three.js tower-defense game.\n' +
  'The build goal (shared with every other arm): ' + SHARED_PROMPT + '\n\n' +
  'Your job: research what GOOD looks like for this genre and WRITE a tight SHARED CONTRACT to ' + GAME + '/.contract.md ' +
  'so four parallel workstreams can build coherent pieces that integrate into ONE self-contained index.html. The contract MUST specify:\n' +
  '1. The single Three.js CDN importmap to use (pin a current three version; module build path).\n' +
  '2. The global GameState object shape (fields: lives, gold, score, wave, phase, enemies, towers, etc.).\n' +
  '3. Module boundaries + the exact functions each exposes (engine, gameplay, ui/HUD, art-audio) and how they call each other (a tiny init/update/event contract, e.g. a window.GAME namespace).\n' +
  '4. The HUD DOM structure (ids/classes) + the canvas mount.\n' +
  '5. A design-token palette as CSS custom properties with WCAG-AA-PASSING text-on-background pairs. ' +
  'VERIFY each text/bg pair with the bundled util, run from the repo root: ' + WCAG + ' and keep only passing pairs. Record the verified ratios.\n' +
  'Keep it concrete and implementable. After writing .contract.md, return the schema (token_pairs = the verified WCAG pairs; modules = the module names).'

let contract = await agent(contractPrompt, { label: 'phase0:contract', phase: 'Contract', schema: CONTRACT_SCHEMA, effort: 'high' })
if (!contract) {
  log('contract dropped (connection); inline retry')
  contract = await agent(contractPrompt, { label: 'phase0:contract-retry', phase: 'Contract', schema: CONTRACT_SCHEMA, effort: 'high' })
}

if (!contract || !contract.ok) {
  log('contract stage failed after retry; aborting harness build (resume to try again)')
  return { stage: 'contract', contract, integrated: null }
}
log('contract written: ' + ((contract.token_pairs || []).length) + ' verified WCAG pairs; modules=' + ((contract.modules || []).join(',')))

phase('Workstreams')

const WS_SCHEMA = {
  type: 'object',
  properties: {
    workstream: { type: 'string' },
    file: { type: 'string' },
    implemented: { type: 'array', items: { type: 'string' } },
    gate_selfcheck: { type: 'string' },
    issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['workstream', 'file', 'gate_selfcheck'],
}

const WORKSTREAMS = [
  {
    key: 'engine',
    gates: 'tests (initializes and runs without throwing)',
    mission: 'Core engine: Three.js scene/camera/renderer/lights, a tile grid with a fixed enemy PATH to the base, the global GameState, the main requestAnimationFrame update+render loop (delta-clamped), and pointer raycasting to select buildable tiles. Provide robust init that feature-detects WebGL and fails gracefully (a visible message, not a white screen). Remove and dispose objects you create when they die (no unbounded growth).',
  },
  {
    key: 'gameplay',
    gates: 'tests (logic is internally consistent)',
    mission: 'Gameplay: enemy types with health that spawn and follow the path (lose a life at the base), tower types placeable on buildable tiles with targeting + projectiles + damage + an upgrade path, a wave manager that escalates difficulty, and the economy (gold on kill, costs, score, lives, win/lose). Wire into GameState per the contract.',
  },
  {
    key: 'uiux',
    gates: 'ui-ux (WCAG-AA contrast via the verified tokens; :hover AND :focus-visible on every control; a spacing scale; at least one responsive breakpoint; not a generic AI-default look) + a11y (semantic HUD landmarks/headings; accessible names on controls; a keyboard affordance to select or buy a tower; remember PASS is not conformance)',
    mission: 'UI/UX + a11y: the HUD overlay (score/lives/gold/wave), the tower shop with buy/upgrade controls, start/pause/game-over states, all styled with the contract design tokens. Real :hover AND :focus-visible, a consistent spacing scale, a responsive breakpoint, semantic structure with accessible names, and a keyboard path to the core actions. Intentional visual design, not the generic default.',
  },
  {
    key: 'artaudio',
    gates: 'assets (procedural only, no placeholders, no external files)',
    mission: 'Art + audio: procedural geometry + materials for enemies, towers, projectiles, terrain tiles, the path, and the base; lighting mood + a simple hit/particle FX; and procedural WebAudio SFX (shoot, hit, place, wave-start) created in code (no audio files). All procedural, zero external assets.',
  },
]

function runWorkstream(w) {
  const p =
    'You are a WORKER (Phase 2) on the "' + w.key + '" workstream of a Three.js tower-defense game.\n' +
    'FIRST read the shared contract at ' + GAME + '/.contract.md and conform to it EXACTLY (importmap, GameState shape, module function names, HUD DOM ids, design tokens).\n\n' +
    'MISSION: ' + w.mission + '\n\n' +
    'YOU MUST PASS THESE GATES (self-verify before returning): ' + w.gates + '. The bundled WCAG util can verify any color pair, run from the repo root: ' + WCAG + '. ' +
    'Procedural geometry only; Three.js via the contract importmap; no external assets.\n\n' +
    'Write your section as clean, self-contained JavaScript (and any CSS/HTML fragment it needs) to ' +
    GAME + '/.workstreams/' + w.key + '.js with a short header comment listing the contract functions you implement. ' +
    'Make it real, working code the integrator can drop in. Return the schema (file = the path you wrote; implemented = the contract functions you provided; gate_selfcheck = how you verified your gates; issues = anything unresolved).'
  return agent(p, { label: 'ws:' + w.key, phase: 'Workstreams', schema: WS_SCHEMA, effort: 'high' })
}

let ws = await parallel(WORKSTREAMS.map(w => () => runWorkstream(w)))
const failedIdx = []
ws.forEach((r, i) => { if (!r) failedIdx.push(i) })
if (failedIdx.length) {
  log('workstream retry wave: ' + failedIdx.length + ' dropped')
  const retried = await parallel(failedIdx.map(i => () => runWorkstream(WORKSTREAMS[i])))
  retried.forEach((r, j) => { if (r) ws[failedIdx[j]] = r })
}
const wsDone = ws.filter(Boolean)
log('workstreams done: ' + wsDone.length + '/' + WORKSTREAMS.length + ' (' + wsDone.map(w => w.workstream).join(', ') + ')')

phase('Integrate')

const INTEGRATE_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    lines: { type: 'number' },
    feature_checklist: {
      type: 'object',
      properties: {
        enemies_spawn_and_pathfind: { type: 'boolean' }, tower_placement: { type: 'boolean' },
        shooting: { type: 'boolean' }, wave_escalation: { type: 'boolean' },
        hud_score_lives_gold: { type: 'boolean' }, tower_buy_upgrade: { type: 'boolean' },
      },
    },
    gates: {
      type: 'object',
      properties: {
        contrast_pairs_passing: { type: 'number' }, hover_focus_present: { type: 'boolean' },
        procedural_only_no_placeholders: { type: 'boolean' }, runs_without_obvious_error: { type: 'boolean' },
      },
    },
    known_issues: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['ok', 'summary'],
}

const integratePrompt =
  'You are the INTEGRATOR (Phase 3, gated integration) for the Three.js tower-defense game.\n' +
  'Inputs on disk: the contract ' + GAME + '/.contract.md and the four workstream drafts in ' + GAME + '/.workstreams/ ' +
  '(engine.js, gameplay.js, uiux.js, artaudio.js; some may be missing or partial, so be robust and fill gaps yourself).\n\n' +
  'TASK: assemble ONE complete, self-contained, WORKING ' + GAME + '/index.html (the entry file at the game/ root). It must:\n' +
  '- load Three.js via the contract CDN importmap; be a single file; procedural geometry only; no external assets;\n' +
  '- reconcile the workstream sections against the contract into a coherent, PLAYABLE game implementing every feature in the shared goal: ' + SHARED_PROMPT + '\n' +
  '- be robust: feature-detect WebGL and fail gracefully (no silent white screen); a delta-clamped loop; dispose dead objects; wrap init so a throw is visible;\n' +
  '- keep WCAG-AA design tokens (re-verify the final text/bg pairs with: ' + WCAG + '), real :hover + :focus-visible, a semantic HUD + accessible names.\n\n' +
  'GATED INTEGRATION (do real work, up to about 2 repair passes): after writing index.html, re-read it and CHECK each objective gate, contrast pairs passing, hover/focus present, procedural-only (no placeholder hosts/lorem/empty src/external files), and that the JS has no obvious reference or syntax error (sanity-check structure with grep or a node parse). Fix what fails, then write the final file. ' +
  'Return the schema HONESTLY, set the gates and feature flags to what is ACTUALLY true in the file you wrote (do not claim a feature you did not implement). known_issues = anything still rough.'

const integrated = await agent(integratePrompt, { label: 'phase3:integrate', phase: 'Integrate', schema: INTEGRATE_SCHEMA, effort: 'high' })

log('integration: ok=' + (integrated && integrated.ok) + '; lines=' + (integrated && integrated.lines) + '; ' + (integrated && integrated.summary))
return { contract, workstreams: wsDone, integrated }
