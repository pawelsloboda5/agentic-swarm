// Programmatic, HEURISTIC scorer for the 8 safe-swarm patterns. Each pattern becomes a
// namedScore (0..1); the overall score is their mean. These checks are deliberately objective
// but imperfect — they are the per-pattern *breakdown*. The headline verdict is the GPT-5.5
// llm-rubric (see promptfooconfig.yaml). Returning componentResults gives promptfoo a clean
// per-pattern view in its web report.
//
// Signature: module.exports = (output, context) => GradingResult   (per promptfoo JS assertions)

module.exports = (output, _context) => {
  const text = String(output == null ? "" : output);
  const t = text; // case-sensitive token search where it matters
  const has = (re) => re.test(text);

  // 1. Bounded waves (6-8), not one mega-barrier.
  const wavesKeyword = /\b(wave|chunk|batch)\b/i.test(t);
  const iterates = /\b(for\s*\(|for\s+\w+\s+of|while\s*\(|\.forEach\s*\()/.test(t);
  const boundedWaves = wavesKeyword && iterates ? 1 : wavesKeyword ? 0.5 : 0;

  // 2. Per-agent retry wrapper / null tolerance.
  const retry = /\bretry\b/i.test(t) || /\bfailed\b/.test(t);
  const nullTolerant = /filter\(\s*Boolean\s*\)/.test(t) || /===?\s*null|!==?\s*null|\?\s*[^:]*:\s*null/.test(t);
  const retryWrapper = retry ? 1 : nullTolerant ? 0.5 : 0;

  // 3. No single hard barrier over all items (accumulate per wave / use pipeline).
  const barrierCalls = (t.match(/\b(parallel|pipeline)\s*\(/g) || []).length;
  const fullSetBarrier = /\b(parallel|pipeline)\s*\(\s*(ITEMS|items?|tasks|sources|files|subtopics|documents|docs|sites|tests)\b/i.test(t);
  const accumulates = /\b(done|results)\b[^\n]*\.push\(/.test(t) || boundedWaves === 1;
  const noSingleBarrier = accumulates ? 1 : (barrierCalls <= 1 && fullSetBarrier) ? 0 : 0.5;

  // 4. ScheduleWakeup watchdog (the non-negotiable one).
  const watchdog = /ScheduleWakeup/i.test(t) ? 1 : 0;

  // 5. Resume designed in / cache-stable.
  const resumeMention = /\bresume\b|resumeFromRunId|scriptPath|\brunId\b/i.test(t);
  const stableMention = /\bstable\b|cache|JSON\.stringify\(\s*\[?\.{0,3}\s*done/i.test(t);
  const resumeStable = resumeMention ? 1 : stableMention ? 0.5 : 0;

  // 6. Lean outputs (schema + caps).
  const usesSchema = /\bschema\b/i.test(t);
  const caps = /(at most|<=\s*\d|≤\s*\d|top\s*\d|\bcap\b|slice\(\s*0\s*,|max(imum)?\b[^.\n]*\d)/i.test(t);
  const leanOutputs = usesSchema && caps ? 1 : usesSchema ? 0.5 : 0;

  // 7. Partial synthesis / explicit gap flagging.
  const gaps = /\b(missing|gap|gaps|not\s+(verified|found)|partial)\b/i.test(t);
  const synthesizes = /\b(synth|synthesi|final report|deliverable)/i.test(t);
  const partialSynthesis = gaps && synthesizes ? 1 : gaps || /filter\(\s*Boolean\s*\)/.test(t) ? 0.5 : 0;

  // 8. Instability backoff.
  const backoffKeyword = /\b(backoff|back off|instabilit|spike)\b/i.test(t);
  const nullRate = /(nulls?|failed)\s*\.?\s*length?\s*\/\s*\w+/.test(t) || /\/\s*(batch|wave)[^\n]*length/.test(t);
  const instabilityBackoff = backoffKeyword ? 1 : nullRate ? 0.5 : 0;

  const patterns = [
    ["1. bounded waves", boundedWaves],
    ["2. retry wrapper", retryWrapper],
    ["3. no single barrier", noSingleBarrier],
    ["4. watchdog (ScheduleWakeup)", watchdog],
    ["5. resume / cache-stable", resumeStable],
    ["6. lean outputs", leanOutputs],
    ["7. partial synthesis", partialSynthesis],
    ["8. instability backoff", instabilityBackoff],
  ];

  const overall = patterns.reduce((s, [, v]) => s + v, 0) / patterns.length;
  const componentResults = patterns.map(([name, v]) => ({
    pass: v >= 0.5,
    score: v,
    reason: `${name}: ${v}`,
    namedScores: { [name]: v },
  }));

  const hit = patterns.filter(([, v]) => v >= 1).length;
  return {
    pass: overall >= 0.5,
    score: overall,
    reason: `safe-swarm patterns (heuristic): ${hit}/8 fully present; overall ${(overall * 100).toFixed(0)}%`,
    componentResults,
  };
};
