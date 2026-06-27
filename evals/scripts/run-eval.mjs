// Run the promptfoo eval with the OpenAI key loaded from the repo-root .env.local. Writes the
// raw results to results/latest.json. Any extra args are passed through to `promptfoo eval`
// (e.g. `--filter-first-n 1` for a smoke run; see the `smoke` package script).
import { spawnSync } from "node:child_process";
import { requireKey, EVALS_DIR } from "./_env.mjs";

requireKey("OPENAI_API_KEY");

const passthrough = process.argv.slice(2);
const args = ["eval", "-c", "promptfooconfig.yaml", "-o", "results/latest.json", ...passthrough];

console.log("> promptfoo " + args.join(" "));
const r = spawnSync("promptfoo", args, { cwd: EVALS_DIR, stdio: "inherit", shell: true });
if (r.error) {
  console.error("Failed to launch promptfoo. Did you run `bun install` (or `npm install`) in evals/?");
  console.error(String(r.error.message || r.error));
}
process.exit(r.status == null ? 1 : r.status);
