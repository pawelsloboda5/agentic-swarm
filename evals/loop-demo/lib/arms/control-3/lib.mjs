// lib.mjs — deterministic wire-format & canonical-form toolkit.
// Zero-dependency, fully offline ES module. 40 pure, deterministic named exports.
// I/O is STRING and INTEGER only. A "byte string" has each char's code point in 0..255.
// Importing this module has no side effects; it only defines the exports below.

// ---------------------------------------------------------------------------
// WS1 — Base-N codecs (8)
// ---------------------------------------------------------------------------

const HEX_DIGITS = "0123456789abcdef";

/** Byte string -> lowercase hex (two digits per byte, MSB nibble first). */
export function hexEncode(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out += HEX_DIGITS[(c >> 4) & 0xf] + HEX_DIGITS[c & 0xf];
  }
  return out;
}

/** Inverse of hexEncode. Even-length lowercase hex -> byte string. */
export function hexDecode(h) {
  let out = "";
  for (let i = 0; i < h.length; i += 2) {
    out += String.fromCharCode(parseInt(h.substr(i, 2), 16));
  }
  return out;
}

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Byte string -> Base64 (RFC 4648 §4, '=' padding). */
export function base64Encode(s) {
  let out = "";
  for (let i = 0; i < s.length; i += 3) {
    const has1 = i + 1 < s.length;
    const has2 = i + 2 < s.length;
    const b0 = s.charCodeAt(i);
    const b1 = has1 ? s.charCodeAt(i + 1) : 0;
    const b2 = has2 ? s.charCodeAt(i + 2) : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += B64_ALPHABET[(triple >> 18) & 63];
    out += B64_ALPHABET[(triple >> 12) & 63];
    out += has1 ? B64_ALPHABET[(triple >> 6) & 63] : "=";
    out += has2 ? B64_ALPHABET[triple & 63] : "=";
  }
  return out;
}

const B64_REVERSE = (() => {
  const m = new Array(128).fill(-1);
  for (let i = 0; i < B64_ALPHABET.length; i++) m[B64_ALPHABET.charCodeAt(i)] = i;
  return m;
})();

/** Inverse of base64Encode. */
export function base64Decode(b) {
  let out = "";
  let bits = 0;
  let value = 0;
  for (let i = 0; i < b.length; i++) {
    const c = b.charCodeAt(i);
    if (c === 61 /* '=' */) break;
    const idx = B64_REVERSE[c];
    if (idx < 0) continue;
    value = (value << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >>> bits) & 0xff);
      value &= (1 << bits) - 1;
    }
  }
  return out;
}

// Custom base32 alphabet: index v -> v-th char of this string.
const B32_ALPHABET = "0123456789abcdefghijklmnopqrstuv";

const B32_REVERSE = (() => {
  const m = new Array(128).fill(-1);
  for (let i = 0; i < B32_ALPHABET.length; i++) m[B32_ALPHABET.charCodeAt(i)] = i;
  return m;
})();

/** Byte string -> base32 (custom lowercase alphabet, no padding, MSB first). */
export function base32Encode(s) {
  let out = "";
  let bits = 0;
  let value = 0;
  for (let i = 0; i < s.length; i++) {
    value = (value << 8) | s.charCodeAt(i);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += B32_ALPHABET[(value >>> bits) & 31];
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) {
    out += B32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

/** Inverse of base32Encode (final-group char count determines trailing bytes). */
export function base32Decode(b) {
  let out = "";
  let bits = 0;
  let value = 0;
  for (let i = 0; i < b.length; i++) {
    const idx = B32_REVERSE[b.charCodeAt(i)];
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >>> bits) & 0xff);
      value &= (1 << bits) - 1;
    }
  }
  return out;
}

const RADIX_DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Nonnegative integer -> base-`radix` string (digits 0-9a-z, no leading zeros). */
export function toRadix(n, radix) {
  if (n === 0) return "0";
  let out = "";
  while (n > 0) {
    out = RADIX_DIGITS[n % radix] + out;
    n = Math.floor(n / radix);
  }
  return out;
}

/** Inverse of toRadix. Lowercase digit string -> integer value. */
export function fromRadix(s, radix) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    n = n * radix + RADIX_DIGITS.indexOf(s[i]);
  }
  return n;
}

// ---------------------------------------------------------------------------
// WS2 — Escaping / quoting codecs (6)
// ---------------------------------------------------------------------------

const PERCENT_UNRESERVED = /[A-Za-z0-9\-._~]/;

/** Byte string -> percent-encoding (RFC 3986). Unreserved set left literal. */
export function percentEncode(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (PERCENT_UNRESERVED.test(c)) {
      out += c;
    } else {
      out += "%" + s.charCodeAt(i).toString(16).toUpperCase().padStart(2, "0");
    }
  }
  return out;
}

/** Inverse: each %HH (upper or lower hex) -> byte; other chars literal. */
export function percentDecode(s) {
  return s.replace(/%([0-9A-Fa-f]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16))
  );
}

/** Escape the five HTML special characters. */
export function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Inverse of escapeHtml: only those five entities are recognized. */
export function unescapeHtml(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Escape one CSV field (RFC 4180, minimal quoting). */
export function csvEscape(field) {
  if (/[",\r\n]/.test(field)) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

/** Inverse of csvEscape. */
export function csvUnescape(field) {
  if (
    field.length >= 2 &&
    field[0] === '"' &&
    field[field.length - 1] === '"'
  ) {
    return field.slice(1, -1).replace(/""/g, '"');
  }
  return field;
}

// ---------------------------------------------------------------------------
// WS3 — Classical ciphers + run-length (6)
// ---------------------------------------------------------------------------

/** ROT13: shift each ASCII letter by 13 within its case. */
export function rot13(s) {
  return s.replace(/[A-Za-z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

/** Atbash: mirror each ASCII letter within its case (A<->Z, a<->z). */
export function atbash(s) {
  return s.replace(/[A-Za-z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base));
  });
}

/** Caesar shift forward by `shift` (normalized mod 26; negatives go backward). */
export function caesarEncode(s, shift) {
  const sh = (((shift % 26) + 26) % 26);
  return s.replace(/[A-Za-z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + sh) % 26) + base);
  });
}

/** Inverse of caesarEncode. */
export function caesarDecode(s, shift) {
  return caesarEncode(s, -shift);
}

/** Run-length encode: each maximal run -> decimal count then the char. */
export function runLengthEncode(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    let j = i;
    while (j < s.length && s[j] === s[i]) j++;
    out += (j - i) + s[i];
    i = j;
  }
  return out;
}

/** Inverse of runLengthEncode: read decimal count then one char, repeat. */
export function runLengthDecode(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    let num = "";
    while (i < s.length && s[i] >= "0" && s[i] <= "9") {
      num += s[i];
      i++;
    }
    const ch = s[i];
    i++;
    out += ch.repeat(parseInt(num, 10));
  }
  return out;
}

// ---------------------------------------------------------------------------
// WS4 — Integer transforms (6)
// ---------------------------------------------------------------------------

const ROMAN_TABLE = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

/** Integer 1..3999 -> uppercase Roman numeral (standard subtractive system). */
export function toRoman(n) {
  let out = "";
  for (let k = 0; k < ROMAN_TABLE.length; k++) {
    const v = ROMAN_TABLE[k][0];
    const sym = ROMAN_TABLE[k][1];
    while (n >= v) {
      out += sym;
      n -= v;
    }
  }
  return out;
}

const ROMAN_VALUES = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

/** Inverse of toRoman. Valid uppercase Roman numeral -> integer. */
export function fromRoman(s) {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = ROMAN_VALUES[s[i]];
    const next = i + 1 < s.length ? ROMAN_VALUES[s[i + 1]] : 0;
    if (cur < next) total -= cur;
    else total += cur;
  }
  return total;
}

/** ZigZag encode: n>=0 -> 2n; n<0 -> -2n-1. */
export function zigzagEncode(n) {
  return n >= 0 ? 2 * n : -2 * n - 1;
}

/** Inverse of zigzagEncode: even -> u/2; odd -> -(u+1)/2. */
export function zigzagDecode(u) {
  return u % 2 === 0 ? u / 2 : -(u + 1) / 2;
}

/** Binary-reflected Gray code: n XOR (n >> 1). Domain 0 <= n < 2^31. */
export function grayEncode(n) {
  return (n ^ (n >>> 1)) >>> 0;
}

/** Inverse of grayEncode: XOR g with every right-shift of itself. */
export function grayDecode(g) {
  let n = g;
  let mask = g >>> 1;
  while (mask !== 0) {
    n ^= mask;
    mask >>>= 1;
  }
  return n >>> 0;
}

// ---------------------------------------------------------------------------
// WS5 — Idempotent canonicalizers (7)
// ---------------------------------------------------------------------------

/** Canonicalize a textual IPv6 address per RFC 5952 §4. */
export function canonicalizeIPv6(s) {
  let groups;
  if (s.indexOf("::") !== -1) {
    const parts = s.split("::");
    const left = parts[0] === "" ? [] : parts[0].split(":");
    const right = parts[1] === "" ? [] : parts[1].split(":");
    const missing = 8 - left.length - right.length;
    groups = left.concat(new Array(missing).fill("0"), right);
  } else {
    groups = s.split(":");
  }
  // (1) lowercase + (2) strip leading zeros (all-zero group -> "0").
  groups = groups.map((g) => parseInt(g, 16).toString(16));

  // (3) longest run of consecutive all-zero groups (>= 2), leftmost on tie.
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === "0") {
      if (curStart === -1) {
        curStart = i;
        curLen = 1;
      } else {
        curLen++;
      }
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }

  if (bestLen >= 2) {
    const before = groups.slice(0, bestStart);
    const after = groups.slice(bestStart + bestLen);
    return before.join(":") + "::" + after.join(":");
  }
  return groups.join(":");
}

/** Canonicalize a dotted-decimal IPv4 address (strip leading zeros). */
export function canonicalizeIPv4(s) {
  return s
    .split(".")
    .map((o) => parseInt(o, 10).toString())
    .join(".");
}

/** Canonicalize a hyphenated UUID: lowercase, same hyphenation. */
export function canonicalizeUuid(s) {
  return s.toLowerCase();
}

/** Canonicalize a CSS hex color: expand short forms, lowercase. */
export function canonicalizeHexColor(s) {
  let hex = s.slice(1).toLowerCase();
  if (hex.length === 3 || hex.length === 4) {
    let expanded = "";
    for (let i = 0; i < hex.length; i++) expanded += hex[i] + hex[i];
    hex = expanded;
  }
  return "#" + hex;
}

/** Canonicalize a decimal integer string. */
export function canonicalizeInteger(s) {
  let i = 0;
  let sign = "";
  if (s[0] === "+") {
    i = 1;
  } else if (s[0] === "-") {
    sign = "-";
    i = 1;
  }
  let digits = s.slice(i).replace(/^0+/, "");
  if (digits === "") digits = "0";
  if (digits === "0") return "0";
  return sign + digits;
}

/** Collapse runs of space/tab to a single space and trim such whitespace. */
export function collapseWhitespace(s) {
  return s.replace(/[ \t]+/g, " ").replace(/^ | $/g, "");
}

/** Convert CRLF, lone CR, and lone LF all to a single LF. */
export function normalizeNewlines(s) {
  return s.replace(/\r\n|\r|\n/g, "\n");
}

// ---------------------------------------------------------------------------
// WS6 — Single-direction formatters (7)
// ---------------------------------------------------------------------------

/** Produce a URL slug (lowercase; non [a-z0-9] runs -> '-'; trim hyphens). */
export function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const TITLE_SMALL_WORDS = new Set(
  "a an and as at but by for if in nor of on or per the to vs via".split(" ")
);

/** Title-case a single-space-separated string. */
export function titleCase(s) {
  const words = s.toLowerCase().split(" ");
  const last = words.length - 1;
  return words
    .map((w, i) => {
      if (i !== 0 && i !== last && TITLE_SMALL_WORDS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/** Nonnegative integer -> number + English ordinal suffix. */
export function ordinal(n) {
  const m = n % 100;
  if (m === 11 || m === 12 || m === 13) return n + "th";
  switch (n % 10) {
    case 1:
      return n + "st";
    case 2:
      return n + "nd";
    case 3:
      return n + "rd";
    default:
      return n + "th";
  }
}

/** Safe integer -> decimal string with ',' grouping every three digits. */
export function formatThousands(n) {
  const neg = n < 0;
  const digits = Math.abs(n).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return neg ? "-" + grouped : grouped;
}

/** Nonnegative integer seconds -> "{h}h{mm}m{ss}s". */
export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  return (
    h +
    "h" +
    String(mm).padStart(2, "0") +
    "m" +
    String(ss).padStart(2, "0") +
    "s"
  );
}

/** Center `s` to `width` with `fill`; extra padding goes on the right. */
export function padCenter(s, width, fill) {
  if (s.length >= width) return s;
  const p = width - s.length;
  const left = Math.floor(p / 2);
  const right = Math.ceil(p / 2);
  return fill.repeat(left) + s + fill.repeat(right);
}

/** Safe integer -> zero-padded decimal string (sign counts toward width). */
export function zeroPad(n, width) {
  const neg = n < 0;
  const sign = neg ? "-" : "";
  const digits = Math.abs(n).toString();
  const targetDigits = width - sign.length;
  const padded =
    digits.length >= targetDigits
      ? digits
      : "0".repeat(targetDigits - digits.length) + digits;
  return sign + padded;
}
