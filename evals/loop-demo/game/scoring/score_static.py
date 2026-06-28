#!/usr/bin/env python3
"""score_static.py -- deterministic STATIC scorecard for one Three.js-game index.html.

Stdlib only (regex + html.parser) plus the repo's `wcag_contrast` objective-floor util.
Prints ONE JSON object to stdout, ASCII-only (cp1252-safe console: no non-ASCII in prints).

  python score_static.py <path/to/index.html>

=== HONESTY / SCOPE OF WHAT THIS MEASURES (read before trusting a number) ===
This is a *measured-showcase comparison* instrument, not a full design/QA audit. Every
metric below is a heuristic with documented blind spots. The ONLY claim it makes is that
the SAME heuristic is applied UNIFORMLY to every arm, so cross-arm deltas are comparable
even where an absolute number is an under- or over-count.

  * contrast : we only check CSS rule blocks that EXPLICITLY co-declare a `color:` and a
    flat `background`/`background-color:` in the SAME block, where both resolve to a single
    solid color. This UNDER-COUNTS real-world contrast: text that inherits its background
    from an ancestor (the common case) is invisible to a static parser, and translucent
    panels are approximated by their own RGB channels (alpha is IGNORED -- we do not
    composite over what's behind them). Gradient / image backgrounds are skipped (no single
    color). So `pairs_checked` is a floor, not the true number of text surfaces. Applied
    identically to every arm.
  * features / robustness : keyword + regex booleans over the combined HTML+JS+CSS text.
    A keyword can appear in a comment or dead code (false positive) and a feature can be
    implemented without the expected keyword (false negative). These are *signals*, not
    proofs that a feature works -- the runtime scorer is what actually exercises the game.
"""
import html
import json
import os
import re
import sys

# Repo WCAG objective-floor util (the same primitive the ui-ux gate uses).
sys.path.insert(0, r"C:/Users/Pawel Sloboda/Desktop/agentic-swarm/skills/architect/gates/lib")
import wcag_contrast  # noqa: E402


# --------------------------------------------------------------------------- #
# small parsing helpers
# --------------------------------------------------------------------------- #
def read_text(path):
    with open(path, "rb") as fh:
        raw = fh.read()
    # decode tolerantly; the games are ASCII+emoji UTF-8.
    return raw.decode("utf-8", errors="replace"), raw


def extract_style_blocks(text):
    """Return the concatenated contents of every <style>...</style> block."""
    return "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", text, re.S | re.I))


def strip_css_comments(css):
    return re.sub(r"/\*.*?\*/", " ", css, flags=re.S)


# --------------------------------------------------------------------------- #
# color resolution  (hex | rgb()/rgba() | var(--token))  ->  (r,g,b) tuple
# alpha is intentionally ignored; documented in the module docstring.
# --------------------------------------------------------------------------- #
_RGB_RE = re.compile(r"rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)", re.I)
_HEX_RE = re.compile(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b")
_VAR_RE = re.compile(r"var\(\s*(--[a-zA-Z0-9_-]+)\s*\)")


def _rgb_to_hex(rgb):
    return "#%02x%02x%02x" % rgb


def build_token_map(css):
    """Parse :root{ --name: value; } declarations into {name: raw_value_string}."""
    tokens = {}
    for body in re.findall(r":root\s*\{([^}]*)\}", css, re.S):
        for name, value in re.findall(r"(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);", body):
            tokens[name.strip()] = value.strip()
    return tokens


def resolve_color(value, tokens, _depth=0):
    """Resolve a raw CSS color expression to an (r,g,b) tuple, or None if not a flat color.

    Handles: var(--token) (recursively), rgb()/rgba() (alpha dropped), #hex.
    Returns None for gradients, url(), `transparent`, `currentColor`, non-color tokens.
    """
    if value is None or _depth > 8:
        return None
    v = value.strip()
    if not v:
        return None
    low = v.lower()
    if "gradient" in low or "url(" in low:
        return None
    if low in ("transparent", "currentcolor", "inherit", "initial", "unset", "none"):
        return None
    m = _VAR_RE.search(v)
    if m:
        token = m.group(1)
        if token in tokens:
            return resolve_color(tokens[token], tokens, _depth + 1)
        return None
    m = _RGB_RE.search(v)
    if m:
        try:
            return tuple(int(round(float(x))) for x in m.groups())
        except ValueError:
            return None
    m = _HEX_RE.search(v)
    if m:
        try:
            return wcag_contrast.parse_hex(m.group(0))
        except ValueError:
            return None
    return None


def score_contrast(css, tokens):
    """Find every rule block co-declaring color + flat background; compute AA ratios.

    HEURISTIC: explicit same-block color+background pairs only (see module docstring).
    """
    css = strip_css_comments(css)
    details = []
    # Match `<selector> { <body-without-braces> }`. Nested @media/@keyframes wrappers
    # contribute only their (color/bg-free) preamble and are harmlessly skipped; their
    # inner rule blocks still match individually.
    for body in re.findall(r"\{([^{}]*)\}", css):
        cm = re.search(r"(?<![-\w])color\s*:\s*([^;]+)", body, re.I)
        bm = re.search(r"background(?:-color)?\s*:\s*([^;]+)", body, re.I)
        if not cm or not bm:
            continue
        fg_raw, bg_raw = cm.group(1).strip(), bm.group(1).strip()
        fg = resolve_color(fg_raw, tokens)
        bg = resolve_color(bg_raw, tokens)
        if fg is None or bg is None:
            continue
        r = wcag_contrast.ratio(fg, bg)  # accepts (r,g,b) tuples
        details.append({
            "fg": fg_raw,
            "bg": bg_raw,
            "ratio": round(r, 2),
            "pass": bool(wcag_contrast.passes(r, "normal")),
        })
    passing = sum(1 for d in details if d["pass"])
    return {
        "pairs_checked": len(details),
        "pairs_passing": passing,
        "details": details,
    }


# --------------------------------------------------------------------------- #
# static UI/UX signals
# --------------------------------------------------------------------------- #
def score_uiux_static(css):
    css_nc = strip_css_comments(css)
    tokens = build_token_map(css_nc)
    # spacing-scale signal: >=4 distinct custom props that look like a spacing/size scale,
    # OR an explicit scale comment. (Both demos inline px values, so expect False -- fine,
    # the check is applied uniformly.)
    spacing_props = [n for n in tokens
                     if re.search(r"(space|spacing|gap|gutter|inset|^--s\d|^--sp(ace)?-?\d)",
                                  n, re.I)]
    has_scale_comment = bool(re.search(r"spacing\s*scale|space\s*scale", css, re.I))
    return {
        "has_hover": ":hover" in css_nc,
        "has_focus_visible": ":focus-visible" in css_nc,
        "has_spacing_scale": (len(set(spacing_props)) >= 4) or has_scale_comment,
        "has_breakpoint": "@media" in css_nc,
    }


# --------------------------------------------------------------------------- #
# assets  (placeholder content + external asset refs)
# --------------------------------------------------------------------------- #
# Known dummy/placeholder image hosts -- a strong "unfinished asset" signal.
_PLACEHOLDER_HOSTS = re.compile(
    r"(via\.placeholder\.com|placehold(er)?\.co|placekitten|picsum\.photos|"
    r"dummyimage|loremflickr|lorempixel|placeimg|baconmockup|placebear)", re.I)
# CDN host(s) that legitimately serve the three.js module/importmap -- allowed.
_THREE_CDN = re.compile(r"(cdn\.jsdelivr\.net/npm/three|unpkg\.com/three|"
                        r"esm\.sh/three|cdnjs\.cloudflare\.com/ajax/libs/three)", re.I)
_ASSET_EXT = re.compile(r"\.(png|jpe?g|gif|webp|svg|bmp|ico|mp3|wav|ogg|m4a|aac|"
                        r"glb|gltf|fbx|obj|mp4|webm)(\?|#|$)", re.I)


def score_assets(text):
    body_markup = text  # whole document; refs live in markup + importmap
    placeholder_hits = 0
    placeholder_hits += len(_PLACEHOLDER_HOSTS.findall(body_markup))
    placeholder_hits += len(re.findall(r"lorem\s+ipsum", body_markup, re.I))
    placeholder_hits += len(re.findall(r"\b(TODO|FIXME)\b", body_markup))
    placeholder_hits += len(re.findall(r"\bsrc\s*=\s*([\"'])\s*\1", body_markup, re.I))

    # External asset refs: any src=/href= (incl. <link>) that is NOT a data: URI, NOT a
    # pure fragment/anchor, and NOT the allowed three CDN. A local relative file path
    # (e.g. ./hero.png) counts as external (a real downloaded asset).
    external = 0
    asset_files_referenced = False
    for url in re.findall(r"\b(?:src|href)\s*=\s*[\"']([^\"']+)[\"']", body_markup, re.I):
        u = url.strip()
        if not u or u.startswith(("data:", "#", "javascript:", "mailto:", "blob:")):
            continue
        if _THREE_CDN.search(u):
            continue
        external += 1
        if _ASSET_EXT.search(u):
            asset_files_referenced = True

    # Procedural-only = no external image/audio/model asset *files* anywhere in the doc
    # (covers refs that aren't via src/href too, e.g. TextureLoader('x.png'), new Audio()).
    loader_asset = bool(re.search(r"(TextureLoader|AudioLoader|GLTFLoader|FBXLoader|"
                                  r"OBJLoader|ImageLoader|new\s+Audio\s*\()", text)) \
        and bool(_ASSET_EXT.search(text))
    asset_files_referenced = asset_files_referenced or bool(_ASSET_EXT.search(text)) or loader_asset

    favicon = bool(re.search(r"<link[^>]+rel\s*=\s*[\"'][^\"']*icon", text, re.I))

    return {
        "placeholder_hits": placeholder_hits,
        "external_asset_refs": external,
        "favicon_present": favicon,
        "procedural_only": not asset_files_referenced,
    }


# --------------------------------------------------------------------------- #
# gameplay features  (HEURISTIC keyword/regex booleans -- see docstring)
# --------------------------------------------------------------------------- #
def score_features(text):
    t = text
    def has(*pats):
        return all(re.search(p, t, re.I) for p in pats)

    f = {
        "enemies_spawn": has(r"spawn", r"enem|creep|mob|monster"),
        "path_follow": has(r"path|waypoint|lane|route",
                           r"follow|waypoint|PATH_LEN|pathPoint|path\b.*length|along.*path|"
                           r"nextPoint|t\s*\+=|progress"),
        "tower_placement": bool(re.search(r"placeTower|placeAt|buildTower|place.*tower|"
                                          r"addTower|tower.*place", t, re.I)),
        "shooting": bool(re.search(r"fireTower|fire\s*\(|shoot|projectile|bullet|muzzle", t, re.I)),
        "wave_escalation": has(r"wave",
                               r"escal|hpScale|difficulty|wave\s*\+\+|wave\s*[-+*].*\d|"
                               r"\bwave\b.*\*|scal.*wave|wave.*scal|nextWave|waveNum"),
        "hud_score_lives_gold": has(r"score", r"liv(es|e)\b", r"gold|coin|money|gems?"),
        "tower_buy_upgrade": has(r"tower|turret",
                                 r"upgrade|upg\b|buy|purchase|cost|price"),
    }
    out = {k: bool(v) for k, v in f.items()}
    out["features_count"] = sum(out.values())
    return out


# --------------------------------------------------------------------------- #
# runtime-static robustness  (binary + one-phrase reason; HEURISTIC)
# --------------------------------------------------------------------------- #
def score_robustness(text):
    t = text

    # try/catch blocks (non-greedy) so we can ask WHAT each one wraps.
    try_blocks = re.findall(r"try\s*\{(.*?)\}\s*catch", t, re.S)

    webgl_ctx = bool(re.search(r"webglcontextlost|loseContext|isWebGLAvailable|"
                               r"WEBGL\.isWebGL|getContext\(\s*[\"']webgl", t, re.I))
    # graceful render/load failure message tied to init (fallback overlay / 'not supported').
    graceful = bool(re.search(r"loadErr|could ?n.?t (load|start|render)|not support|"
                              r"webgl.*(unavailable|not)|failed to (load|init)", t, re.I))
    webgl_guard = webgl_ctx or graceful
    webgl_why = ("context-loss/feature-detect present" if webgl_ctx
                 else ("graceful load/render failure message present" if graceful
                       else "no WebGL feature-detect, context-loss handler, or fallback message"))

    disposes = bool(re.search(r"\.dispose\s*\(|scene\.remove\s*\(|\.removeFromParent\s*\(", t))
    disp_why = ("calls .dispose()/scene.remove() on objects" if disposes
                else "no .dispose()/scene.remove() of dead objects found")

    # delta clamp: a Math.min cap applied to a frame-delta variable, or THREE.Clock + a cap.
    # Tolerant of arithmetic between the delta token and the numeric cap, e.g.
    # `Math.min((now-last)/1000, 0.05)` -- match within one statement (no `;`/newline).
    clamp_delta = bool(re.search(
        r"Math\.min\([^;\n]*(dt|delta|gdt|getDelta|now\s*-\s*last)[^;\n]*,\s*[\d.]+",
        t, re.I))
    clock_capped = bool(re.search(r"getDelta\s*\(", t)) and bool(re.search(r"Math\.min\(", t))
    delta_clamped = clamp_delta or clock_capped
    delta_why = ("frame delta clamped via Math.min cap" if clamp_delta
                 else ("THREE.Clock getDelta with a Math.min cap" if clock_capped
                       else "unbounded delta -- no Math.min/clamp cap on the frame step"))

    # init wrapped: a try/catch whose body actually runs init/boot/renderer so a throw is visible.
    init_wrapped = any(re.search(r"\binit\s*\(|\bboot\b|\banimate\s*\(|\bmain\s*\(|"
                                 r"new\s+THREE\.WebGLRenderer|\bstart\s*\(", b, re.I)
                       for b in try_blocks)
    init_why = ("init/render wrapped in try/catch (throw surfaces)" if init_wrapped
                else "init not wrapped in try/catch -- a throw fails silently")

    items = {
        "webgl_guard": {"value": webgl_guard, "why": webgl_why},
        "disposes_objects": {"value": disposes, "why": disp_why},
        "delta_clamped_loop": {"value": delta_clamped, "why": delta_why},
        "init_wrapped": {"value": init_wrapped, "why": init_why},
    }
    items["score"] = sum(1 for k, v in items.items() if isinstance(v, dict) and v["value"])
    return items


# --------------------------------------------------------------------------- #
def main(argv):
    if len(argv) < 1:
        sys.stderr.write("usage: score_static.py <index.html>\n")
        return 2
    path = argv[0]
    if not os.path.isfile(path):
        sys.stdout.write(json.dumps({"error": "file not found: %s" % path}) + "\n")
        return 0
    text, raw = read_text(path)
    css = extract_style_blocks(text)
    tokens = build_token_map(strip_css_comments(css))

    out = {
        "meta": {"lines": len(text.splitlines()), "bytes": len(raw)},
        "contrast": score_contrast(css, tokens),
        "uiux_static": score_uiux_static(css),
        "assets": score_assets(text),
        "features": score_features(text),
        "runtime_static_robustness": score_robustness(text),
    }
    sys.stdout.write(json.dumps(out) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
