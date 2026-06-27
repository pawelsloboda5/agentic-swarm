// WITH-SKILL prompt (the treatment). Identical to baseline.js EXCEPT it also injects the real,
// current agentic-swarm SKILL.md. Reading the live file (rather than a copy) means the eval
// always measures the skill as it actually ships — edit the skill, re-run, see the new number.
const fs = require("node:fs");
const path = require("node:path");

const API = fs.readFileSync(path.join(__dirname, "workflow-api.md"), "utf8");
const SKILL = fs.readFileSync(
  path.join(__dirname, "..", "..", "skills", "agentic-swarm", "SKILL.md"),
  "utf8"
);

module.exports = async function ({ vars }) {
  const system =
    "You are an expert at writing Claude Code `Workflow` orchestration scripts.\n\n" +
    "Use this Workflow API:\n\n" +
    API +
    "\n\n--- The following safe-swarm skill is in effect; follow it ---\n\n" +
    SKILL +
    "\n\n--- end skill ---\n\n" +
    "Write ONE complete, production-quality JavaScript Workflow script that accomplishes " +
    "the task below. Output only the script (a ```js code block is fine).";
  return [
    { role: "system", content: system },
    { role: "user", content: vars.task },
  ];
};
