// Turn results/latest.json into human-readable, committed artifacts so anyone can inspect EXACTLY
// what was sent and what each model produced — without running anything:
//   results/transcripts/<task>__<model>.md   one per task x model: baseline vs with-skill output
//                                            + the GPT-5.5 judge's score and reasoning for each
//   results/transcripts/README.md            an index
//   prompts/rendered/baseline.example.md     the exact rendered baseline prompt (one task)
//   prompts/rendered/with-skill.example.md   the exact rendered with-skill prompt (shows SKILL.md)
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { EVALS_DIR } from "./_env.mjs";

const data = JSON.parse(readFileSync(path.join(EVALS_DIR, "results", "latest.json"), "utf8"));
const rows = data?.results?.results || [];
if (!rows.length) {
  console.error("No results in results/latest.json — run `bun run eval` first.");
  process.exit(1);
}

const TX_DIR = path.join(EVALS_DIR, "results", "transcripts");
const RENDERED_DIR = path.join(EVALS_DIR, "prompts", "rendered");
rmSync(TX_DIR, { recursive: true, force: true });
mkdirSync(TX_DIR, { recursive: true });
mkdirSync(RENDERED_DIR, { recursive: true });

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const model = (r) => ((r?.provider?.id || "?").split(":").pop());
const variant = (r) =>
  /with[-_ ]?skill/i.test((r?.prompt?.label || "").replace(/\\/g, "/")) ? "with-skill" : "baseline";
const taskName = (r) => r?.testCase?.description || slug((r?.vars?.task || "").slice(0, 40)) || "task";
const taskText = (r) => r?.vars?.task || "";

function outputText(r) {
  const resp = r?.response;
  if (typeof resp === "string") return resp;
  return resp?.output ?? resp?.raw ?? resp?.text ?? r?.output ?? "";
}
function comps(r) {
  return r?.gradingResult?.componentResults || [];
}
const compBy = (r, frag) => comps(r).find((c) => (c?.assertion?.type || "").includes(frag));
const pct = (x) => (typeof x === "number" ? `${Math.round(x * 100)}%` : "—");

// Fence the model output safely even if it contains its own ``` fences.
function asCode(out, lang = "js") {
  let s = String(out || "").trim();
  const m = s.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  if (m) s = m[1];
  const longest = (s.match(/`+/g) || []).reduce((a, b) => Math.max(a, b.length), 0);
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${lang}\n${s}\n${fence}`;
}

function renderPromptRaw(raw) {
  if (raw == null) return "(prompt not recorded)";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((m) => `### role: ${m.role}\n\n${m.content}`).join("\n\n");
    }
  } catch {
    /* not JSON — fall through */
  }
  return String(raw);
}

// Group rows by task -> model -> variant.
const groups = {};
for (const r of rows) {
  const t = taskName(r);
  const mdl = model(r);
  ((groups[t] ??= {})[mdl] ??= {})[variant(r)] = r;
}

const tasks = Object.keys(groups).sort();
const indexRows = [];

for (const t of tasks) {
  for (const mdl of Object.keys(groups[t]).sort()) {
    const g = groups[t][mdl];
    const b = g["baseline"];
    const w = g["with-skill"];
    const ref = b || w;
    const file = `${slug(t)}__${slug(mdl)}.md`;

    const section = (r, title) => {
      if (!r) return `## ${title}\n\n_(no result)_\n`;
      const rub = compBy(r, "rubric");
      const pat = compBy(r, "javascript");
      let out = `## ${title} — rubric ${pct(rub?.score)}, patterns ${pct(pat?.score)}\n\n`;
      out += asCode(outputText(r)) + "\n\n";
      if (rub?.reason) out += `> **GPT-5.5 judge:** ${String(rub.reason).replace(/\n+/g, " ").trim()}\n`;
      return out;
    };

    let md = `# ${t} — \`${mdl}\`\n\n`;
    md +=
      "> **Prompt** = the shared [Workflow API reference](../../prompts/workflow-api.md) + the task " +
      "below. The **with-skill** variant additionally injects the live " +
      "[`SKILL.md`](../../../skills/agentic-swarm/SKILL.md). Exact rendered prompts: " +
      "[baseline](../../prompts/rendered/baseline.example.md) · " +
      "[with-skill](../../prompts/rendered/with-skill.example.md). Judge: GPT-5.5.\n\n";
    md += `**Task**\n\n> ${taskText(ref).replace(/\n+/g, " ").trim()}\n\n---\n\n`;
    md += section(b, "Baseline (no skill)") + "\n";
    md += section(w, "With skill") + "\n";
    writeFileSync(path.join(TX_DIR, file), md);

    const rb = compBy(b, "rubric")?.score;
    const rw = compBy(w, "rubric")?.score;
    const d = typeof rb === "number" && typeof rw === "number" ? rw - rb : null;
    indexRows.push({ t, mdl, file, rb, rw, d });
  }
}

// Transcripts index.
let idx = "# Eval transcripts\n\n";
idx +=
  "Exactly what each model produced for each task, **baseline** (no skill) vs **with-skill**, with " +
  "the GPT-5.5 judge's score and reasoning. This is the raw evidence behind " +
  "[`../RESULTS.md`](../RESULTS.md). The prompts are in [`../../prompts/`](../../prompts/) " +
  "(rendered examples under [`rendered/`](../../prompts/rendered/)).\n\n";
idx += "| Task | Model | Baseline | With skill | Δ | Transcript |\n|---|---|---|---|---|---|\n";
for (const r of indexRows.sort((a, b) => a.t.localeCompare(b.t) || a.mdl.localeCompare(b.mdl))) {
  const d = r.d == null ? "—" : (r.d >= 0 ? "+" : "") + pct(r.d);
  idx += `| ${r.t} | \`${r.mdl}\` | ${pct(r.rb)} | ${pct(r.rw)} | ${d} | [${r.file}](${r.file}) |\n`;
}
writeFileSync(path.join(TX_DIR, "README.md"), idx);

// Rendered prompt examples from the first task's baseline + with-skill rows.
const firstTask = tasks[0];
const anyModel = Object.keys(groups[firstTask])[0];
const bRow = groups[firstTask][anyModel]["baseline"];
const wRow = groups[firstTask][anyModel]["with-skill"];
const header = (kind) =>
  `# Rendered ${kind} prompt — example (task: ${firstTask})\n\n` +
  `> The EXACT prompt sent to the model for the \`${firstTask}\` task under the **${kind}** variant, ` +
  `generated by [\`../${kind}.js\`](../${kind}.js). Other tasks differ only in the task text.\n\n`;
if (bRow) writeFileSync(path.join(RENDERED_DIR, "baseline.example.md"), header("baseline") + renderPromptRaw(bRow?.prompt?.raw) + "\n");
if (wRow) writeFileSync(path.join(RENDERED_DIR, "with-skill.example.md"), header("with-skill") + renderPromptRaw(wRow?.prompt?.raw) + "\n");

console.log(`Wrote ${indexRows.length} transcripts to results/transcripts/ + rendered prompt examples.`);
