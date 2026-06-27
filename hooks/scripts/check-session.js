#!/usr/bin/env node
"use strict";

/**
 * agentic-swarm — SessionStart hook.
 *
 * Two jobs, both NON-BLOCKING and FAILING SILENTLY:
 *   1. First-run nudge: on the very first session after install, tell the user
 *      to run `/agentic-swarm:as-new-project`. Persisted so it fires only once.
 *   2. Update check: compare the installed plugin version against the latest
 *      GitHub release of pawelsloboda5/agentic-swarm; if newer, nudge to update.
 *      Throttled to at most once per 24h, degrades silently when offline.
 *
 * Contract: ALWAYS print exactly one JSON object to stdout and ALWAYS exit 0.
 * A startup hook must never block or crash the session, so every path is
 * wrapped and the worst case is `{"continue":true}` + exit 0.
 *
 * Zero external dependencies — Node built-ins only (Node >=18 for global fetch).
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");

const REPO = "pawelsloboda5/agentic-swarm";
const RELEASES_URL = "https://api.github.com/repos/" + REPO + "/releases/latest";
const UPDATE_CHECK_TTL_MS = 24 * 60 * 60 * 1000; // throttle: at most once / 24h
const FETCH_TIMEOUT_MS = 2500; // hard cap on the network call

// -------------------------------------------------------------------------
// Single exit path. Guarantees exactly one JSON object on stdout + exit 0.
// -------------------------------------------------------------------------
let finished = false;

function finish(messages) {
  if (finished) return;
  finished = true;

  const combined = (messages || []).filter(Boolean).join("\n\n");
  const out = combined
    ? {
        continue: true,
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: combined,
        },
      }
    : { continue: true };

  let payload;
  try {
    payload = JSON.stringify(out);
  } catch (_) {
    payload = '{"continue":true}';
  }

  // Write synchronously to fd 1. fs.writeSync avoids the async stdout pipe
  // handle that can trip a libuv teardown assertion on Windows when we exit.
  try {
    fs.writeSync(1, payload + "\n");
  } catch (_) {
    // stdout unavailable — nothing more we can do; still exit 0.
  }
  process.exit(0);
}

// Last-resort safety nets — a startup hook must never throw.
process.on("uncaughtException", function () {
  if (!finished) finish([]);
});
process.on("unhandledRejection", function () {
  if (!finished) finish([]);
});

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

// Drain stdin (the SessionStart JSON). We don't require any field — just read
// it defensively so the pipe is consumed.
function readStdin() {
  try {
    fs.readFileSync(0, "utf8");
  } catch (_) {
    // No stdin / EOF / EBADF — irrelevant, we don't use the content.
  }
}

function getStateDir() {
  const fromEnv =
    process.env.CLAUDE_PLUGIN_DATA && process.env.CLAUDE_PLUGIN_DATA.trim();
  // CLAUDE_PLUGIN_DATA is newer / less stable — fall back when unset.
  const dir = fromEnv
    ? process.env.CLAUDE_PLUGIN_DATA
    : path.join(os.homedir(), ".agentic-swarm");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readInstalledVersion() {
  try {
    const root = process.env.CLAUDE_PLUGIN_ROOT;
    if (!root) return null;
    const manifest = path.join(root, ".claude-plugin", "plugin.json");
    const json = JSON.parse(fs.readFileSync(manifest, "utf8"));
    return typeof json.version === "string" ? json.version : null;
  } catch (_) {
    return null;
  }
}

// Parse "v1.2.3-beta.1+build" -> [1, 2, 3] (release core only).
function parseSemver(v) {
  const core = String(v)
    .trim()
    .replace(/^v/i, "")
    .split("+")[0]
    .split("-")[0];
  const parts = core.split(".");
  return [
    parseInt(parts[0], 10) || 0,
    parseInt(parts[1], 10) || 0,
    parseInt(parts[2], 10) || 0,
  ];
}

function isNewer(latest, current) {
  const a = parseSemver(latest);
  const b = parseSemver(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

// Returns (via Promise):
//   string    -> latest tag (leading "v" stripped) when a release exists
//   null      -> definitive "no release" (404 / missing tag_name)
//   undefined -> unknown (offline, timeout, rate-limited, parse error)
// Uses node:https with `agent: false` so the socket closes cleanly after the
// response — no undici keep-alive handle lingering at exit (which trips a
// libuv assertion on Windows). Output is written via fs.writeSync for the same
// reason, so process.exit(0) never races with a closing async handle.
function fetchLatestTag() {
  return new Promise(function (resolve) {
    let settled = false;
    function done(v) {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    }
    let req;
    try {
      req = https.get(
        RELEASES_URL,
        {
          agent: false, // no keep-alive pooling; close the socket after response
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "agentic-swarm-plugin",
          },
        },
        function (res) {
          const status = res.statusCode || 0;
          if (status === 404) {
            res.resume();
            return done(null); // no releases published yet
          }
          if (status < 200 || status >= 300) {
            res.resume();
            return done(undefined); // rate limited / server error -> unknown
          }
          let body = "";
          res.setEncoding("utf8");
          res.on("data", function (chunk) {
            body += chunk;
            if (body.length > 1000000) req.destroy(); // guard against huge bodies
          });
          res.on("end", function () {
            try {
              const data = JSON.parse(body);
              const tag =
                data && typeof data.tag_name === "string" ? data.tag_name : null;
              done(tag ? tag.replace(/^v/i, "") : null);
            } catch (_) {
              done(undefined);
            }
          });
        }
      );
      req.setTimeout(FETCH_TIMEOUT_MS, function () {
        req.destroy();
        done(undefined); // offline / slow -> unknown
      });
      req.on("error", function () {
        done(undefined);
      });
    } catch (_) {
      done(undefined);
    }
  });
}

// -------------------------------------------------------------------------
// Job 1: first-run nudge
// -------------------------------------------------------------------------
function firstRunMessage(stateDir) {
  const marker = path.join(stateDir, "first-run-done");
  if (fs.existsSync(marker)) return null;

  try {
    fs.writeFileSync(marker, new Date().toISOString() + "\n");
  } catch (_) {
    // If we can't persist the marker we still nudge once this session.
  }

  return [
    "agentic-swarm is installed and ready.",
    "First-time setup: run `/agentic-swarm:as-new-project` to profile this repo",
    "and scaffold the parallel-subagent swarm rails (waves, watchdog, resume).",
  ].join(" ");
}

// -------------------------------------------------------------------------
// Job 2: throttled update check
// -------------------------------------------------------------------------
async function updateCheckMessage(stateDir, currentVersion) {
  if (!currentVersion) return null;

  const cachePath = path.join(stateDir, "update-check.json");
  let cache = null;
  try {
    cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch (_) {
    cache = null;
  }

  const now = Date.now();
  let latest =
    cache && typeof cache.latest === "string" ? cache.latest : null;
  const lastCheck =
    cache && typeof cache.lastCheck === "number" ? cache.lastCheck : 0;
  const throttled = now - lastCheck < UPDATE_CHECK_TTL_MS;

  if (!throttled) {
    const fetched = await fetchLatestTag();
    // Only overwrite the cached value on a definitive answer (string or null);
    // keep the prior value when the network call was inconclusive (undefined).
    if (fetched !== undefined) latest = fetched;
    // Always stamp lastCheck so we honor "at most once per 24h" even on failure.
    try {
      fs.writeFileSync(
        cachePath,
        JSON.stringify({ lastCheck: now, latest: latest })
      );
    } catch (_) {
      // Cache write failed — non-fatal; we just won't throttle next time.
    }
  }

  if (latest && isNewer(latest, currentVersion)) {
    return [
      "agentic-swarm update available: v" +
        latest +
        " (installed v" +
        currentVersion +
        ").",
      "Update with `/plugin marketplace update`, then reinstall agentic-swarm",
      "from the `/plugin` menu.",
    ].join(" ");
  }
  return null;
}

// -------------------------------------------------------------------------
// Main — every section isolated so one failure never suppresses the other.
// -------------------------------------------------------------------------
(async function main() {
  const messages = [];
  try {
    readStdin();
    const stateDir = getStateDir();

    try {
      messages.push(firstRunMessage(stateDir));
    } catch (_) {
      // first-run nudge unavailable — continue
    }

    try {
      const version = readInstalledVersion();
      messages.push(await updateCheckMessage(stateDir, version));
    } catch (_) {
      // update check unavailable — continue
    }
  } catch (_) {
    // State dir unavailable etc. — fall through to a bare {"continue":true}.
  }
  finish(messages);
})().catch(function () {
  if (!finished) finish([]);
});
