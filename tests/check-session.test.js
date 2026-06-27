"use strict";

/**
 * Black-box tests for the SessionStart hook (hooks/scripts/check-session.js).
 *
 * The hook's hard contract: ALWAYS exit 0 and ALWAYS print exactly one valid JSON
 * object with `continue: true` — a startup hook must never block or crash the
 * session. These tests run the real script as a subprocess (the faithful path,
 * incl. the Windows-safe fs.writeSync + node:https exit behavior) across the
 * scenarios the handoff calls out: fresh / second-run / update-available / offline.
 *
 * Hermetic by construction:
 *   - CLAUDE_PLUGIN_DATA points at a throwaway temp dir per test (state isolation).
 *   - AGENTIC_SWARM_RELEASES_URL is pinned to an unreachable host so NO test ever
 *     touches real GitHub; throttle-seeded tests skip the fetch entirely.
 *
 * Run with: node --test tests/
 */
const { test } = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.dirname(__dirname);
const HOOK = path.join(REPO_ROOT, "hooks", "scripts", "check-session.js");
// Discard port on loopback: connection refused fast -> exercises offline degrade.
const UNREACHABLE = "https://127.0.0.1:9/releases/latest";

function freshDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "as-hook-"));
}

function runHook(opts) {
  opts = opts || {};
  const env = Object.assign({}, process.env, {
    CLAUDE_PLUGIN_ROOT: REPO_ROOT,
    CLAUDE_PLUGIN_DATA: opts.dataDir,
    AGENTIC_SWARM_RELEASES_URL: opts.releasesUrl || UNREACHABLE,
  });
  return spawnSync(process.execPath, [HOOK], {
    input: opts.stdin != null ? opts.stdin : "{}",
    encoding: "utf8",
    env: env,
    timeout: 15000,
  });
}

// Assert the universal contract and return the parsed single JSON object.
function parseContract(res) {
  assert.strictEqual(res.status, 0, "hook must exit 0; stderr=" + res.stderr);
  const lines = res.stdout.trim().split("\n").filter(Boolean);
  assert.strictEqual(lines.length, 1, "expected exactly one JSON line: " + res.stdout);
  const out = JSON.parse(lines[0]);
  assert.strictEqual(out.continue, true);
  return out;
}

function context(out) {
  return (out.hookSpecificOutput && out.hookSpecificOutput.additionalContext) || "";
}

function seedThrottle(dataDir, latest) {
  fs.writeFileSync(
    path.join(dataDir, "update-check.json"),
    JSON.stringify({ lastCheck: Date.now(), latest: latest == null ? null : latest })
  );
}

function markFirstRunDone(dataDir) {
  fs.writeFileSync(path.join(dataDir, "first-run-done"), new Date().toISOString());
}

test("fresh install: exit 0, valid JSON, nudges as-new-project, writes marker", () => {
  const dataDir = freshDataDir();
  seedThrottle(dataDir, null); // throttle the update check -> no network
  const out = parseContract(runHook({ dataDir }));
  assert.match(context(out), /\/agentic-swarm:as-new-project/);
  assert.ok(fs.existsSync(path.join(dataDir, "first-run-done")), "marker should be written");
});

test("second run: marker present -> no first-run nudge, still exit 0", () => {
  const dataDir = freshDataDir();
  markFirstRunDone(dataDir);
  seedThrottle(dataDir, null);
  const out = parseContract(runHook({ dataDir }));
  assert.doesNotMatch(context(out), /First-time setup/);
});

test("update available: throttled cache with newer version -> hints update, no network", () => {
  const dataDir = freshDataDir();
  markFirstRunDone(dataDir); // isolate the update message
  seedThrottle(dataDir, "99.0.0");
  const out = parseContract(runHook({ dataDir }));
  assert.match(context(out), /update available/i);
  assert.match(context(out), /99\.0\.0/);
});

test("up to date: throttled cache with older version -> no update hint", () => {
  const dataDir = freshDataDir();
  markFirstRunDone(dataDir);
  seedThrottle(dataDir, "0.0.1"); // older than the installed plugin version
  const out = parseContract(runHook({ dataDir }));
  assert.ok(!out.hookSpecificOutput, "no messages expected when up to date");
});

test("offline: real fetch to unreachable host degrades silently, exit 0", () => {
  const dataDir = freshDataDir();
  markFirstRunDone(dataDir);
  // No update-check.json -> not throttled -> a real fetch is attempted and fails.
  const out = parseContract(runHook({ dataDir }));
  assert.ok(!out.hookSpecificOutput, "offline run must not emit an update hint");
});

test("empty stdin still yields valid JSON + exit 0", () => {
  const dataDir = freshDataDir();
  markFirstRunDone(dataDir);
  seedThrottle(dataDir, null);
  parseContract(runHook({ dataDir, stdin: "" }));
});
