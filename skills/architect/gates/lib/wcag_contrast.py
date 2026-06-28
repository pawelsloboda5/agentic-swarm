#!/usr/bin/env python3
"""Zero-dependency WCAG 2.x contrast-ratio util — the objective-floor primitive for the `ui-ux` gate.

Pure Python stdlib. Importable (ratio/passes/luminance/parse_hex) AND runnable as a machine check:

    python wcag_contrast.py <fg> <bg> [normal|large|ui]
    # prints {"ratio": .., "pass": bool, "threshold": ..}; exit 0 if pass, 1 if fail, 2 on bad input.

The formula is the fixed W3C standard (no library, nothing to version):
  cs = c/255; lin = cs/12.92 if cs <= 0.03928 else ((cs+0.055)/1.055)**2.4
  L = 0.2126*R + 0.7152*G + 0.0722*B
  ratio = (L_light + 0.05) / (L_dark + 0.05)
Thresholds (AA): normal text >= 4.5; large text (>=24px, or >=18.66px/14pt bold) >= 3.0;
UI components / graphics >= 3.0.
"""
import json
import sys

THRESHOLDS = {"normal": 4.5, "large": 3.0, "ui": 3.0}


def parse_hex(value):
    """'#rgb' or '#rrggbb' (case-insensitive, leading '#' optional) -> (r, g, b) ints 0-255."""
    if not isinstance(value, str):
        raise ValueError("color must be a string, got %r" % type(value).__name__)
    s = value.strip().lstrip("#").lower()
    if len(s) == 3:
        s = "".join(ch * 2 for ch in s)
    if len(s) != 6 or any(ch not in "0123456789abcdef" for ch in s):
        raise ValueError("invalid hex color: %r" % value)
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def _lin(channel):
    cs = channel / 255.0
    return cs / 12.92 if cs <= 0.03928 else ((cs + 0.055) / 1.055) ** 2.4


def luminance(rgb):
    r, g, b = rgb
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def ratio(fg, bg):
    """Contrast ratio between two colors (hex strings or (r,g,b) tuples). Symmetric; 1.0 .. 21.0."""
    lf = luminance(parse_hex(fg) if isinstance(fg, str) else fg)
    lb = luminance(parse_hex(bg) if isinstance(bg, str) else bg)
    lo, hi = sorted((lf, lb))
    return (hi + 0.05) / (lo + 0.05)


def passes(contrast_ratio, size="normal"):
    """True iff contrast_ratio meets the AA threshold for the given text/element size."""
    if size not in THRESHOLDS:
        raise ValueError("size must be one of %s, got %r" % (sorted(THRESHOLDS), size))
    return contrast_ratio >= THRESHOLDS[size]


def _main(argv):
    if len(argv) < 2:
        sys.stderr.write("usage: wcag_contrast.py <fg> <bg> [normal|large|ui]\n")
        return 2
    fg, bg = argv[0], argv[1]
    size = argv[2] if len(argv) > 2 else "normal"
    try:
        # Decide the verdict on the UNROUNDED ratio; round only for display. (Rounding before the
        # compare would let a true fail like 4.4962 round up to 4.50 and silently pass the gate.)
        raw = ratio(fg, bg)
        ok = passes(raw, size)
        r = round(raw, 2)
    except ValueError as exc:
        sys.stderr.write("error: %s\n" % exc)
        return 2
    # ASCII-only output (cp1252-safe).
    sys.stdout.write(json.dumps({"ratio": r, "pass": ok, "threshold": THRESHOLDS[size]}) + "\n")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
