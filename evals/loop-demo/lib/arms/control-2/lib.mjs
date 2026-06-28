// lib.mjs — deterministic wire-format & canonical-form toolkit.
// Zero-dependency, fully offline ES module. 40 pure named exports.
// I/O is string/integer only. Bytes are code points 0..255. Same input -> same output.

// ---------------------------------------------------------------------------
// Shared lookup tables (pure data; defining these has no side effects).
// ---------------------------------------------------------------------------

const HEX_DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz"; // radix digits up to 36

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_REV = (() => {
  const m = Object.create(null);
  for (let i = 0; i < B64_ALPHABET.length; i++) m[B64_ALPHABET[i]] = i;
  return m;
})();

// Custom base32 alphabet (index 0..31), lowercase, no padding, no aliasing.
const B32_ALPHABET = "0123456789abcdefghijklmnopqrstuv";
const B32_REV = (() => {
  const m = Object.create(null);
  for (let i = 0; i < B32_ALPHABET.length; i++) m[B32_ALPHABET[i]] = i;
  return m;
})();

// ===========================================================================
// WS1 — Base-N codecs (8)
// ===========================================================================

export function hexEncode(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    out += s.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return out;
}

export function hexDecode(h) {
  let out = "";
  for (let i = 0; i < h.length; i += 2) {
    out += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
  }
  return out;
}

export function base64Encode(s) {
  let out = "";
  for (let i = 0; i < s.length; i += 3) {
    const rem = s.length - i;
    const b0 = s.charCodeAt(i);
    const b1 = rem > 1 ? s.charCodeAt(i + 1) : 0;
    const b2 = rem > 2 ? s.charCodeAt(i + 2) : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    const c0 = (n >> 18) & 63;
    const c1 = (n >> 12) & 63;
    const c2 = (n >> 6) & 63;
    const c3 = n & 63;
    if (rem === 1) {
      out += B64_ALPHABET[c0] + B64_ALPHABET[c1] + "==";
    } else if (rem === 2) {
      out += B64_ALPHABET[c0] + B64_ALPHABET[c1] + B64_ALPHABET[c2] + "=";
    } else {
      out += B64_ALPHABET[c0] + B64_ALPHABET[c1] + B64_ALPHABET[c2] + B64_ALPHABET[c3];
    }
  }
  return out;
}

export function base64Decode(b) {
  const body = b.replace(/=+$/, "");
  let out = "";
  for (let i = 0; i < body.length; i += 4) {
    const chunk = body.length - i;
    const c0 = B64_REV[body[i]];
    const c1 = B64_REV[body[i + 1]];
    const c2 = chunk > 2 ? B64_REV[body[i + 2]] : 0;
    const c3 = chunk > 3 ? B64_REV[body[i + 3]] : 0;
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    out += String.fromCharCode((n >> 16) & 255);
    if (chunk > 2) out += String.fromCharCode((n >> 8) & 255);
    if (chunk > 3) out += String.fromCharCode(n & 255);
  }
  return out;
}

export function base32Encode(s) {
  let out = "";
  let bits = 0;
  let nbits = 0;
  for (let i = 0; i < s.length; i++) {
    bits = (bits << 8) | s.charCodeAt(i);
    nbits += 8;
    while (nbits >= 5) {
      nbits -= 5;
      out += B32_ALPHABET[(bits >> nbits) & 31];
    }
  }
  if (nbits > 0) {
    out += B32_ALPHABET[(bits << (5 - nbits)) & 31];
  }
  return out;
}

export function base32Decode(b) {
  let out = "";
  let bits = 0;
  let nbits = 0;
  for (let i = 0; i < b.length; i++) {
    bits = (bits << 5) | B32_REV[b[i]];
    nbits += 5;
    while (nbits >= 8) {
      nbits -= 8;
      out += String.fromCharCode((bits >> nbits) & 255);
    }
  }
  return out;
}

export function toRadix(n, radix) {
  if (n === 0) return "0";
  let out = "";
  let v = n;
  while (v > 0) {
    out = HEX_DIGITS[v % radix] + out;
    v = Math.floor(v / radix);
  }
  return out;
}

export function fromRadix(s, radix) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    n = n * radix + HEX_DIGITS.indexOf(s[i]);
  }
  return n;
}

// ===========================================================================
// WS2 — Escaping / quoting codecs (6)
// ===========================================================================

export function percentEncode(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const ch = s[i];
    const unreserved =
      (c >= 0x41 && c <= 0x5a) || // A-Z
      (c >= 0x61 && c <= 0x7a) || // a-z
      (c >= 0x30 && c <= 0x39) || // 0-9
      ch === "-" || ch === "." || ch === "_" || ch === "~";
    if (unreserved) {
      out += ch;
    } else {
      out += "%" + c.toString(16).toUpperCase().padStart(2, "0");
    }
  }
  return out;
}

export function percentDecode(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "%") {
      out += String.fromCharCode(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out += s[i];
    }
  }
  return out;
}

export function escapeHtml(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    switch (ch) {
      case "&": out += "&amp;"; break;
      case "<": out += "&lt;"; break;
      case ">": out += "&gt;"; break;
      case '"': out += "&quot;"; break;
      case "'": out += "&#39;"; break;
      default: out += ch;
    }
  }
  return out;
}

export function unescapeHtml(s) {
  return s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => {
    switch (e) {
      case "amp": return "&";
      case "lt": return "<";
      case "gt": return ">";
      case "quot": return '"';
      case "#39": return "'";
    }
  });
}

export function csvEscape(field) {
  if (/[",\r\n]/.test(field)) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

export function csvUnescape(field) {
  if (field.length >= 2 && field[0] === '"' && field[field.length - 1] === '"') {
    return field.slice(1, -1).replace(/""/g, '"');
  }
  return field;
}

// ===========================================================================
// WS3 — Classical ciphers + run-length (6)
// ===========================================================================

export function rot13(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 65 && c <= 90) out += String.fromCharCode(((c - 65 + 13) % 26) + 65);
    else if (c >= 97 && c <= 122) out += String.fromCharCode(((c - 97 + 13) % 26) + 97);
    else out += s[i];
  }
  return out;
}

export function atbash(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 65 && c <= 90) out += String.fromCharCode(90 - (c - 65));
    else if (c >= 97 && c <= 122) out += String.fromCharCode(122 - (c - 97));
    else out += s[i];
  }
  return out;
}

export function caesarEncode(s, shift) {
  const sh = (((shift % 26) + 26) % 26);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 65 && c <= 90) out += String.fromCharCode(((c - 65 + sh) % 26) + 65);
    else if (c >= 97 && c <= 122) out += String.fromCharCode(((c - 97 + sh) % 26) + 97);
    else out += s[i];
  }
  return out;
}

export function caesarDecode(s, shift) {
  return caesarEncode(s, -shift);
}

export function runLengthEncode(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    let j = i + 1;
    while (j < s.length && s[j] === s[i]) j++;
    out += (j - i) + s[i];
    i = j;
  }
  return out;
}

export function runLengthDecode(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    let j = i;
    while (j < s.length && s[j] >= "0" && s[j] <= "9") j++;
    const count = parseInt(s.slice(i, j), 10);
    const ch = s[j];
    out += ch.repeat(count);
    i = j + 1;
  }
  return out;
}

// ===========================================================================
// WS4 — Integer transforms (6)
// ===========================================================================

const ROMAN_TABLE = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(n) {
  let v = n;
  let out = "";
  for (const [val, sym] of ROMAN_TABLE) {
    while (v >= val) {
      out += sym;
      v -= val;
    }
  }
  return out;
}

export function fromRoman(s) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = map[s[i]];
    const next = i + 1 < s.length ? map[s[i + 1]] : 0;
    if (cur < next) total -= cur;
    else total += cur;
  }
  return total;
}

export function zigzagEncode(n) {
  return n >= 0 ? 2 * n : -2 * n - 1;
}

export function zigzagDecode(u) {
  return u % 2 === 0 ? u / 2 : -(u + 1) / 2;
}

export function grayEncode(n) {
  return (n ^ (n >> 1)) >>> 0;
}

export function grayDecode(g) {
  let n = g;
  let sh = g;
  while (sh > 0) {
    sh = sh >>> 1;
    n ^= sh;
  }
  return n >>> 0;
}

// ===========================================================================
// WS5 — Idempotent canonicalizers (7)
// ===========================================================================

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
  // Normalize each group: lowercase hex, strip leading zeros (all-zero -> "0").
  const norm = groups.map((g) => parseInt(g, 16).toString(16));

  // Longest run of all-zero groups, length >= 2, leftmost on tie.
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < norm.length; i++) {
    if (norm[i] === "0") {
      if (curStart < 0) {
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

  if (bestLen < 2) {
    return norm.join(":");
  }
  const before = norm.slice(0, bestStart);
  const after = norm.slice(bestStart + bestLen);
  return before.join(":") + "::" + after.join(":");
}

export function canonicalizeIPv4(s) {
  return s
    .split(".")
    .map((octet) => String(parseInt(octet, 10)))
    .join(".");
}

export function canonicalizeUuid(s) {
  return s.toLowerCase();
}

export function canonicalizeHexColor(s) {
  let hex = s.slice(1).toLowerCase();
  if (hex.length === 3 || hex.length === 4) {
    let expanded = "";
    for (let i = 0; i < hex.length; i++) expanded += hex[i] + hex[i];
    hex = expanded;
  }
  return "#" + hex;
}

export function canonicalizeInteger(s) {
  let neg = false;
  let i = 0;
  if (s[0] === "+") {
    i = 1;
  } else if (s[0] === "-") {
    neg = true;
    i = 1;
  }
  let digits = s.slice(i).replace(/^0+/, "");
  if (digits === "" || digits === "0") return "0";
  return (neg ? "-" : "") + digits;
}

export function collapseWhitespace(s) {
  return s
    .replace(/[ \t]+/g, " ")
    .replace(/^ /, "")
    .replace(/ $/, "");
}

export function normalizeNewlines(s) {
  return s.replace(/\r\n|\r|\n/g, "\n");
}

// ===========================================================================
// WS6 — Single-direction formatters (7)
// ===========================================================================

export function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const TITLE_SMALL_WORDS = new Set(
  "a an and as at but by for if in nor of on or per the to vs via".split(" ")
);

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

export function ordinal(n) {
  const m = n % 100;
  let suffix;
  if (m >= 11 && m <= 13) {
    suffix = "th";
  } else {
    const d = n % 10;
    suffix = d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th";
  }
  return n + suffix;
}

export function formatThousands(n) {
  const neg = n < 0;
  const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + digits;
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const p2 = (x) => String(x).padStart(2, "0");
  return `${h}h${p2(m)}m${p2(s)}s`;
}

export function padCenter(s, width, fill) {
  if (s.length >= width) return s;
  const p = width - s.length;
  const left = Math.floor(p / 2);
  const right = p - left;
  return fill.repeat(left) + s + fill.repeat(right);
}

export function zeroPad(n, width) {
  if (n < 0) {
    return "-" + String(-n).padStart(width - 1, "0");
  }
  return String(n).padStart(width, "0");
}
