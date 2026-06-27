// Load environment variables from the repo-root .env.local (gitignored via .env.*). Minimal,
// dependency-free .env parser — the key is only read into this process and only ever sent to the
// model provider. Returns the repo root + evals dir for convenience.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const EVALS_DIR = path.resolve(here, "..");
export const REPO_ROOT = path.resolve(EVALS_DIR, "..");

export function loadRootEnv() {
  const file = path.join(REPO_ROOT, ".env.local");
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  } catch {
    // No .env.local — fall back to the ambient environment.
  }
}

export function requireKey(name = "OPENAI_API_KEY") {
  loadRootEnv();
  if (!process.env[name]) {
    console.error(
      `${name} not found.\n` +
        `Put it in ${path.join(REPO_ROOT, ".env.local")} (gitignored):\n` +
        `  ${name}=...\n`
    );
    process.exit(1);
  }
  return process.env[name];
}
