// lib.mjs — assembled wire-format & canonical-form toolkit (40 exports)
// Integrator build: concatenation of WS1..WS6 slices.

// WS1 — Base-N codecs
// Exports: hexEncode, hexDecode, base64Encode, base64Decode,
//          base32Encode, base32Decode, toRadix, fromRadix
// Pure, deterministic, string/integer I/O only, zero deps.

const _WS1_HEX = "0123456789abcdef";
const _WS1_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const _WS1_B32 = "0123456789abcdefghijklmnopqrstuv";
const _WS1_RDX = "0123456789abcdefghijklmnopqrstuvwxyz";

// ---- hex ----

export function hexEncode(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const b = s.charCodeAt(i) & 0xff;
    out.push(_WS1_HEX[(b >>> 4) & 0xf], _WS1_HEX[b & 0xf]);
  }
  return out.join("");
}

export function hexDecode(h) {
  const out = [];
  for (let i = 0; i < h.length; i += 2) {
    const hi = _WS1_HEX.indexOf(h[i]);
    const lo = _WS1_HEX.indexOf(h[i + 1]);
    out.push(String.fromCharCode((hi << 4) | lo));
  }
  return out.join("");
}

// ---- base64 (RFC 4648 §4) ----

export function base64Encode(s) {
  const out = [];
  const len = s.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = s.charCodeAt(i) & 0xff;
    const has1 = i + 1 < len;
    const has2 = i + 2 < len;
    const b1 = has1 ? s.charCodeAt(i + 1) & 0xff : 0;
    const b2 = has2 ? s.charCodeAt(i + 2) & 0xff : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out.push(_WS1_B64[(n >>> 18) & 0x3f]);
    out.push(_WS1_B64[(n >>> 12) & 0x3f]);
    out.push(has1 ? _WS1_B64[(n >>> 6) & 0x3f] : "=");
    out.push(has2 ? _WS1_B64[n & 0x3f] : "=");
  }
  return out.join("");
}

export function base64Decode(b) {
  if (b.length === 0) return "";
  const out = [];
  for (let i = 0; i < b.length; i += 4) {
    const c0 = b[i];
    const c1 = b[i + 1];
    const c2 = b[i + 2];
    const c3 = b[i + 3];
    const pad2 = c2 === "=";
    const pad3 = c3 === "=";
    const n =
      (_WS1_B64.indexOf(c0) << 18) |
      (_WS1_B64.indexOf(c1) << 12) |
      ((pad2 ? 0 : _WS1_B64.indexOf(c2)) << 6) |
      (pad3 ? 0 : _WS1_B64.indexOf(c3));
    out.push(String.fromCharCode((n >>> 16) & 0xff));
    if (!pad2) out.push(String.fromCharCode((n >>> 8) & 0xff));
    if (!pad3) out.push(String.fromCharCode(n & 0xff));
  }
  return out.join("");
}

// ---- base32 (custom alphabet, MSB-first, no padding) ----

export function base32Encode(s) {
  const out = [];
  let bits = 0;
  let nbits = 0;
  for (let i = 0; i < s.length; i++) {
    bits = (bits << 8) | (s.charCodeAt(i) & 0xff);
    nbits += 8;
    while (nbits >= 5) {
      nbits -= 5;
      out.push(_WS1_B32[(bits >>> nbits) & 0x1f]);
    }
  }
  if (nbits > 0) {
    // zero-pad trailing bits up to the next 5-bit boundary
    out.push(_WS1_B32[(bits << (5 - nbits)) & 0x1f]);
  }
  return out.join("");
}

export function base32Decode(b) {
  const out = [];
  let bits = 0;
  let nbits = 0;
  for (let i = 0; i < b.length; i++) {
    bits = (bits << 5) | (_WS1_B32.indexOf(b[i]) & 0x1f);
    nbits += 5;
    if (nbits >= 8) {
      nbits -= 8;
      out.push(String.fromCharCode((bits >>> nbits) & 0xff));
    }
  }
  // leftover (<8) bits are zero padding; discard
  return out.join("");
}

// ---- arbitrary radix 2..36 ----

export function toRadix(n, radix) {
  if (n === 0) return "0";
  const out = [];
  let v = n;
  while (v > 0) {
    out.push(_WS1_RDX[v % radix]);
    v = Math.floor(v / radix);
  }
  out.reverse();
  return out.join("");
}

export function fromRadix(s, radix) {
  let v = 0;
  for (let i = 0; i < s.length; i++) {
    v = v * radix + _WS1_RDX.indexOf(s[i]);
  }
  return v;
}

// WS2 — Escaping / quoting codecs
// percentEncode, percentDecode, escapeHtml, unescapeHtml, csvEscape, csvUnescape

const _WS2_HEX = "0123456789ABCDEF";

// Returns true if a byte code point is in the RFC3986 unreserved set:
// A-Z (65..90), a-z (97..122), 0-9 (48..57), and - . _ ~
function _ws2_isUnreserved(c) {
  return (
    (c >= 65 && c <= 90) ||
    (c >= 97 && c <= 122) ||
    (c >= 48 && c <= 57) ||
    c === 45 || // -
    c === 46 || // .
    c === 95 || // _
    c === 126   // ~
  );
}

// Parse a single hex digit (upper or lower case) to its value, or -1 if invalid.
function _ws2_hexVal(ch) {
  const c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) return c - 48;       // 0-9
  if (c >= 65 && c <= 70) return c - 65 + 10;  // A-F
  if (c >= 97 && c <= 102) return c - 97 + 10; // a-f
  return -1;
}

export function percentEncode(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (_ws2_isUnreserved(c)) {
      out.push(s[i]);
    } else {
      out.push("%", _WS2_HEX[(c >> 4) & 0xf], _WS2_HEX[c & 0xf]);
    }
  }
  return out.join("");
}

export function percentDecode(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "%" && i + 2 < s.length) {
      const hi = _ws2_hexVal(s[i + 1]);
      const lo = _ws2_hexVal(s[i + 2]);
      if (hi >= 0 && lo >= 0) {
        out.push(String.fromCharCode((hi << 4) | lo));
        i += 2;
        continue;
      }
    }
    out.push(s[i]);
  }
  return out.join("");
}

export function escapeHtml(s) {
  // Order matters: replace & FIRST so the & in inserted entities is not re-escaped.
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function unescapeHtml(s) {
  // Order matters: replace &amp; LAST so e.g. "&amp;lt;" -> "&lt;" (not "<").
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function csvEscape(field) {
  let needsQuote = false;
  for (let i = 0; i < field.length; i++) {
    const c = field.charCodeAt(i);
    if (c === 44 /* , */ || c === 34 /* " */ || c === 13 /* \r */ || c === 10 /* \n */) {
      needsQuote = true;
      break;
    }
  }
  if (!needsQuote) return field;
  return '"' + field.replace(/"/g, '""') + '"';
}

export function csvUnescape(field) {
  if (
    field.length >= 2 &&
    field.charCodeAt(0) === 34 &&
    field.charCodeAt(field.length - 1) === 34
  ) {
    return field.slice(1, -1).replace(/""/g, '"');
  }
  return field;
}

// WS3 — Classical ciphers + run-length (6 exports)
// rot13, atbash, caesarEncode, caesarDecode, runLengthEncode, runLengthDecode
// Pure, deterministic, string/integer I/O only. No external deps.

// Shift a single char code by `shift` within its ASCII-letter case; non-letters returned as-is.
// `shift` is assumed already normalized to 0..25.
function _ws3_shiftCode(code, shift) {
  if (code >= 65 && code <= 90) {
    return 65 + ((code - 65 + shift) % 26);
  }
  if (code >= 97 && code <= 122) {
    return 97 + ((code - 97 + shift) % 26);
  }
  return code;
}

// Apply a normalized forward shift across a whole string.
function _ws3_caesarShift(s, shift) {
  const norm = ((shift % 26) + 26) % 26;
  if (norm === 0) return s;
  const out = [];
  for (let i = 0; i < s.length; i++) {
    out.push(String.fromCharCode(_ws3_shiftCode(s.charCodeAt(i), norm)));
  }
  return out.join("");
}

export function rot13(s) {
  return _ws3_caesarShift(s, 13);
}

export function atbash(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 65 && c <= 90) {
      out.push(String.fromCharCode(155 - c)); // 65+90 - c
    } else if (c >= 97 && c <= 122) {
      out.push(String.fromCharCode(219 - c)); // 97+122 - c
    } else {
      out.push(s.charAt(i));
    }
  }
  return out.join("");
}

export function caesarEncode(s, shift) {
  return _ws3_caesarShift(s, shift);
}

export function caesarDecode(s, shift) {
  return _ws3_caesarShift(s, -shift);
}

export function runLengthEncode(s) {
  if (s.length === 0) return "";
  const out = [];
  let i = 0;
  while (i < s.length) {
    const ch = s.charAt(i);
    let run = 1;
    while (i + run < s.length && s.charAt(i + run) === ch) {
      run++;
    }
    out.push(String(run));
    out.push(ch);
    i += run;
  }
  return out.join("");
}

export function runLengthDecode(s) {
  if (s.length === 0) return "";
  const out = [];
  let i = 0;
  while (i < s.length) {
    let j = i;
    while (j < s.length) {
      const d = s.charCodeAt(j);
      if (d < 48 || d > 57) break;
      j++;
    }
    const count = parseInt(s.slice(i, j), 10);
    const ch = s.charAt(j);
    for (let k = 0; k < count; k++) {
      out.push(ch);
    }
    i = j + 1;
  }
  return out.join("");
}

// WS4 — Integer transforms
// Exports: toRoman, fromRoman, zigzagEncode, zigzagDecode, grayEncode, grayDecode

const _WS4_ROMAN = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

const _WS4_ROMAN_VALUE = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export function toRoman(n) {
  const out = [];
  let rem = n;
  for (let i = 0; i < _WS4_ROMAN.length; i++) {
    const value = _WS4_ROMAN[i][0];
    const symbol = _WS4_ROMAN[i][1];
    while (rem >= value) {
      out.push(symbol);
      rem -= value;
    }
  }
  return out.join("");
}

export function fromRoman(s) {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = _WS4_ROMAN_VALUE[s[i]];
    const next = i + 1 < s.length ? _WS4_ROMAN_VALUE[s[i + 1]] : 0;
    if (cur < next) {
      total -= cur;
    } else {
      total += cur;
    }
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
  return (n ^ (n >>> 1)) >>> 0;
}

export function grayDecode(g) {
  let n = g >>> 0;
  let shifted = n >>> 1;
  while (shifted !== 0) {
    n ^= shifted;
    shifted >>>= 1;
  }
  return n >>> 0;
}

// WS5 — Idempotent canonicalizers
// Each function is idempotent: canon(canon(x)) === canon(x).

// --- private helpers (prefixed _ws5_ to avoid concat collisions) ---

// Strip leading zeros from a digit string; empty result -> "0".
function _ws5_stripLeadingZeros(digits) {
  let i = 0;
  while (i < digits.length - 1 && digits.charCodeAt(i) === 48) i++;
  return digits.slice(i);
}

// --- exports ---

export function canonicalizeIPv6(s) {
  let groups;
  const dbl = s.indexOf("::");
  if (dbl !== -1) {
    const leftHalf = s.slice(0, dbl);
    const rightHalf = s.slice(dbl + 2);
    const left = leftHalf === "" ? [] : leftHalf.split(":");
    const right = rightHalf === "" ? [] : rightHalf.split(":");
    const missing = 8 - left.length - right.length;
    const zeros = [];
    for (let i = 0; i < missing; i++) zeros.push("0");
    groups = left.concat(zeros, right);
  } else {
    groups = s.split(":");
  }

  // (1) lowercase, (2) suppress leading zeros (all-zero -> "0")
  for (let i = 0; i < groups.length; i++) {
    let g = groups[i].toLowerCase();
    let j = 0;
    while (j < g.length - 1 && g.charCodeAt(j) === 48) j++;
    groups[i] = g.slice(j);
  }

  // (3) find LONGEST run of >=2 consecutive "0" groups, leftmost on tie
  let bestStart = -1, bestLen = 0;
  let curStart = -1, curLen = 0;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === "0") {
      if (curStart === -1) { curStart = i; curLen = 1; }
      else curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else {
      curStart = -1; curLen = 0;
    }
  }

  if (bestLen >= 2) {
    const left = groups.slice(0, bestStart).join(":");
    const right = groups.slice(bestStart + bestLen).join(":");
    return left + "::" + right;
  }
  return groups.join(":");
}

export function canonicalizeIPv4(s) {
  const parts = s.split(".");
  for (let i = 0; i < parts.length; i++) {
    parts[i] = _ws5_stripLeadingZeros(parts[i]);
  }
  return parts.join(".");
}

export function canonicalizeUuid(s) {
  return s.toLowerCase();
}

export function canonicalizeHexColor(s) {
  let hex = s.slice(1).toLowerCase();
  if (hex.length === 3 || hex.length === 4) {
    let out = "";
    for (let i = 0; i < hex.length; i++) {
      out += hex[i] + hex[i];
    }
    hex = out;
  }
  return "#" + hex;
}

export function canonicalizeInteger(s) {
  let neg = false;
  let body = s;
  if (s.charCodeAt(0) === 45) { // '-'
    neg = true;
    body = s.slice(1);
  } else if (s.charCodeAt(0) === 43) { // '+'
    body = s.slice(1);
  }
  const digits = _ws5_stripLeadingZeros(body);
  if (digits === "0") return "0";
  return neg ? "-" + digits : digits;
}

export function collapseWhitespace(s) {
  let r = s.replace(/[ \t]+/g, " ");
  r = r.replace(/^ +/, "").replace(/ +$/, "");
  return r;
}

export function normalizeNewlines(s) {
  return s.replace(/\r\n|\r|\n/g, "\n");
}

// WS6 — Single-direction formatters (7)
// Exports: slugify, titleCase, ordinal, formatThousands, formatDuration, padCenter, zeroPad
// Pure, deterministic, string/integer I/O only. No external deps.

// Exact small-word list for titleCase (lowercase forms).
const _WS6_SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "if", "in",
  "nor", "of", "on", "or", "per", "the", "to", "vs", "via",
]);

// True for code points of [a-z0-9].
function _ws6_isSlugChar(code) {
  return (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
}

// Uppercase the first character; leave the rest unchanged.
function _ws6_capFirst(word) {
  if (word.length === 0) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function slugify(s) {
  const lower = s.toLowerCase();
  const out = [];
  let inGap = false; // whether we are currently in a run of non-slug chars
  for (let i = 0; i < lower.length; i++) {
    const code = lower.charCodeAt(i);
    if (_ws6_isSlugChar(code)) {
      if (inGap && out.length > 0) out.push("-");
      inGap = false;
      out.push(lower.charAt(i));
    } else {
      // Mark a gap; emit a hyphen only when followed by a slug char.
      inGap = true;
    }
  }
  return out.join("");
}

export function titleCase(s) {
  const lower = s.toLowerCase();
  const words = lower.split(" ");
  const last = words.length - 1;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const isEdge = i === 0 || i === last;
    if (isEdge || !_WS6_SMALL_WORDS.has(w)) {
      words[i] = _ws6_capFirst(w);
    }
    // small words that are not first/last stay lowercased (already lowercase)
  }
  return words.join(" ");
}

export function ordinal(n) {
  const m = n % 100;
  let suffix;
  if (m === 11 || m === 12 || m === 13) {
    suffix = "th";
  } else {
    switch (n % 10) {
      case 1: suffix = "st"; break;
      case 2: suffix = "nd"; break;
      case 3: suffix = "rd"; break;
      default: suffix = "th"; break;
    }
  }
  return String(n) + suffix;
}

export function formatThousands(n) {
  const neg = n < 0;
  const digits = String(Math.abs(n));
  const parts = [];
  let end = digits.length;
  while (end > 3) {
    parts.unshift(digits.slice(end - 3, end));
    end -= 3;
  }
  parts.unshift(digits.slice(0, end));
  return (neg ? "-" : "") + parts.join(",");
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  const mm = m < 10 ? "0" + m : String(m);
  const ss = sec < 10 ? "0" + sec : String(sec);
  return String(h) + "h" + mm + "m" + ss + "s";
}

export function padCenter(s, width, fill) {
  if (s.length >= width) return s;
  const p = width - s.length;
  const left = Math.floor(p / 2);
  const right = p - left; // ceil(p/2): extra goes right when odd
  return fill.repeat(left) + s + fill.repeat(right);
}

export function zeroPad(n, width) {
  const neg = n < 0;
  let digits = String(Math.abs(n));
  if (neg) {
    while (1 + digits.length < width) digits = "0" + digits;
    return "-" + digits;
  }
  while (digits.length < width) digits = "0" + digits;
  return digits;
}
