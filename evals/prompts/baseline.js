// BASELINE prompt (the control). The model gets a fair, neutral Workflow API reference and the
// task — but NOT the safe-swarm skill. This isolates the skill as the only difference vs
// with-skill.js, so any score delta is attributable to the skill.
const fs = require("node:fs");
const path = require("node:path");

const API = fs.readFileSync(path.join(__dirname, "workflow-api.md"), "utf8");

module.exports = async function ({ vars }) {
  const system =
    "You are an expert at writing Claude Code `Workflow` orchestration scripts.\n\n" +
    "Use this Workflow API:\n\n" +
    API +
    "\n\nWrite ONE complete, production-quality JavaScript Workflow script that accomplishes " +
    "the task below. Output only the script (a ```js code block is fine).";
  return [
    { role: "system", content: system },
    { role: "user", content: vars.task },
  ];
};
