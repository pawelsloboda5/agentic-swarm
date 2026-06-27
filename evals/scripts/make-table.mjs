// Turn results/latest.json (promptfoo's raw eval output) into results/RESULTS.md — the committed
// model x skill-uplift table that the README links to.
//
// The exact promptfoo JSON shape can shift between versions, so this parser is defensive: it
// locates the results array, classifies each row as baseline vs with-skill by its prompt label,
// pulls the llm-rubric score (headline) and the heuristic pattern score, and averages per model.
// If the shape doesn't match, it prints the top-level keys so the mapping can be adjusted.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EVALS_DIR } from "./_env.mjs";

const IN = path.join(EVALS_DIR, "results", "latest.json");
const OUT = path.join(EVALS_DIR, "results", "RESULTS.md");

let data;
try {
  data = JSON.parse(readFileSync(IN, "utf8"));
} catch (e) {
  console.error(`Could not read ${IN}. Run \`bun run eval\` first. (${e.message})`);
  process.exit(1);
}

const rows = Array.isArray(data?.results?.results)
  ? data.results.results
  : Array.isArray(data?.results)
    ? data.results
    : null;
if (!rows) {
  console.error("Unrecognized results shape. Top-level keys: " + Object.keys(data || {}).join(", "));
  console.error("Adjust make-table.mjs to point at the results array for this promptfoo version.");
  process.exit(1);
}

const variantOf = (row) => {
  const label = row?.prompt?.label || row?.prompt?.id || row?.prompt?.raw || JSON.stringify(row?.prompt || "");
  return /with[-_ ]?skill/i.test(label) ? "withSkill" : "baseline";
};
const modelOf = (row) => row?.provider?.id || row?.provider?.label || String(row?.provider ?? "unknown");

const scoresOf = (row) => {
  const comps = row?.gradingResult?.componentResults || [];
  const byType = (frag) => comps.find((c) => (c?.assertion?.type || "").includes(frag));
  const rubric = byType("rubric")?.score;
  const pattern = byType("javascript")?.score;
  const overall = typeof row?.score === "number" ? row.score : undefined;
  // Per-pattern namedScores live inside componentResults (row.namedScores is often empty).
  const named = {};
  for (const c of comps) {
    for (const [k, v] of Object.entries(c?.namedScores || {})) {
      if (typeof v === "number") named[k] = v;
    }
  }
  if (!Object.keys(named).length && row?.namedScores) {
    for (const [k, v] of Object.entries(row.namedScores)) if (typeof v === "number") named[k] = v;
  }
  return {
    rubric: typeof rubric === "number" ? rubric : overall,
    pattern: typeof pattern === "number" ? pattern : overall,
    named,
    // "ok" = the row produced a usable score. NOTE: a low-scoring row that *fails*
    // an assertion is still valid data — promptfoo puts the failure reason in
    // row.error, so DO NOT filter on row.error (that would drop every baseline row).
    ok: typeof rubric === "number" || typeof pattern === "number" || typeof overall === "number",
  };
};

// model -> variant -> { rubric:[], pattern:[], named:{name:[]} }
const agg = {};
for (const row of rows) {
  const s = scoresOf(row);
  if (!s.ok) continue;
  const model = modelOf(row);
  const variant = variantOf(row);
  const a = (agg[model] ??= { baseline: blank(), withSkill: blank() })[variant];
  if (typeof s.rubric === "number") a.rubric.push(s.rubric);
  if (typeof s.pattern === "number") a.pattern.push(s.pattern);
  for (const [k, v] of Object.entries(s.named)) (a.named[k] ??= []).push(v);
}
function blank() {
  return { rubric: [], pattern: [], named: {} };
}
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (x) => (x == null ? "—" : `${Math.round(x * 100)}%`);

const models = Object.keys(agg).sort();
const nTasks = models.length ? Math.round(rows.length / (models.length * 2)) : 0;
const evalId = data?.evalId || "n/a";

let md = "# Eval results — safe-swarm skill uplift\n\n";
md += `> ${rows.length} results · ${models.length} models · ${nTasks} fan-out tasks · 2 variants ` +
  "(baseline vs with-skill) · judge: GPT-5.5\n";
md += "> Headline = the GPT-5.5 `llm-rubric` (0–1): how safe-by-construction the generated Workflow " +
  "script is.\n";
md += `> Run \`${evalId}\` · regenerate with \`bun run table\`. Numbers shift run-to-run (LLM sampling).\n\n`;
md += "## Skill uplift (rubric score: baseline → with-skill)\n\n";
md += "| Model | Baseline | With skill | Δ uplift |\n|---|---|---|---|\n";
for (const m of models) {
  const b = mean(agg[m].baseline.rubric);
  const w = mean(agg[m].withSkill.rubric);
  const d = b == null || w == null ? null : w - b;
  const sign = d == null ? "" : d >= 0 ? "+" : "";
  md += `| \`${m}\` | ${pct(b)} | ${pct(w)} | ${d == null ? "—" : sign + pct(d)} |\n`;
}

md += "\n## Heuristic per-pattern score (with skill)\n\n";
md += "Mean of the programmatic pattern checks under the with-skill variant (breakdown, not the\n";
md += "headline). 100% = all 8 patterns detected on every task.\n\n";
md += "| Model | Pattern score (baseline → with skill) |\n|---|---|\n";
for (const m of models) {
  const b = mean(agg[m].baseline.pattern);
  const w = mean(agg[m].withSkill.pattern);
  md += `| \`${m}\` | ${pct(b)} → ${pct(w)} |\n`;
}

// Per-pattern coverage across all models (baseline vs with-skill mean of each namedScore).
const patternNames = new Set();
for (const m of models)
  for (const variant of ["baseline", "withSkill"])
    for (const k of Object.keys(agg[m][variant].named)) patternNames.add(k);
const sortedPatterns = [...patternNames].sort();
if (sortedPatterns.length) {
  md += "\n## Per-pattern coverage (heuristic mean across all models)\n\n";
  md += "Each safe-swarm pattern's mean programmatic score, baseline vs with-skill.\n\n";
  md += "| Pattern | Baseline | With skill |\n|---|---|---|\n";
  for (const p of sortedPatterns) {
    const bvals = models.flatMap((m) => agg[m].baseline.named[p] || []);
    const wvals = models.flatMap((m) => agg[m].withSkill.named[p] || []);
    md += `| ${p} | ${pct(mean(bvals))} | ${pct(mean(wvals))} |\n`;
  }
}

md += "\n> **Reading this honestly.** The rubric is the headline; the per-pattern numbers are a regex\n";
md += "> heuristic (approximate). `ScheduleWakeup` reads low partly because it's armed at the agent\n";
md += "> level, not inside the script body, so a model writing only the script can legitimately omit\n";
md += "> it. This eval measures whether the skill makes models *write* safer orchestration — it does\n";
md += "> not exercise the live runtime.\n";

md += "\n_Reproduce: see [`evals/README.md`](../README.md)._\n";

writeFileSync(OUT, md);
console.log("Wrote " + OUT);
console.log(md);
