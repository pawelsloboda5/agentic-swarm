// Run the promptfoo eval with the OpenAI key loaded from the repo-root .env.local. Writes the
// raw results to results/latest.json. Any extra args are passed through to `promptfoo eval`
// (e.g. `--filter-first-n 1` for a smoke run; see the `smoke` package script).
import { spawnSync } from "node:child_process";
import { requireKey, EVALS_DIR } from "./_env.mjs";

requireKey("OPENAI_API_KEY");

const passthrough = process.argv.slice(2);
// Run via npx so it resolves the local promptfoo whether invoked through `npm run` or directly
// (npx is on PATH with no spaces; a resolved node_modules/.bin path can contain spaces that
// break shell invocation on Windows).
const args = ["promptfoo", "eval", "-c", "promptfooconfig.yaml", "-o", "results/latest.json", ...passthrough];

console.log("> npx " + args.join(" "));
const r = spawnSync("npx", args, { cwd: EVALS_DIR, stdio: "inherit", shell: true });
if (r.error) {
  console.error("Failed to launch promptfoo. Did you run `bun install` (or `npm install`) in evals/?");
  console.error(String(r.error.message || r.error));
}
process.exit(r.status == null ? 1 : r.status);
