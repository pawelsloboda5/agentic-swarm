// lib.mjs — deterministic wire-format & canonical-form toolkit (40 pure exports)
// Auto-assembled from WS1..WS6 slices. Zero-dependency, fully offline ES module.

// ===== WS1 — Base-N codecs =====
// WS1 — Base-N codecs (8): hex, RFC4648 base64, custom base32, toRadix/fromRadix.
// Pure, deterministic, string+integer I/O only. No imports, no side effects.

// ---- shared (prefixed, non-exported) helpers ----
const _ws1_HEX = "0123456789abcdef";
const _ws1_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const _ws1_B32 = "0123456789abcdefghijklmnopqrstuv";
const _ws1_DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

function _ws1_b64val(c) {
  // reverse lookup for base64 alphabet
  if (c >= 65 && c <= 90) return c - 65;        // A-Z -> 0..25
  if (c >= 97 && c <= 122) return c - 97 + 26;  // a-z -> 26..51
  if (c >= 48 && c <= 57) return c - 48 + 52;   // 0-9 -> 52..61
  if (c === 43) return 62;                       // '+'
  if (c === 47) return 63;                       // '/'
  return -1;
}

function _ws1_b32val(c) {
  // custom alphabet "0123456789abcdefghijklmnopqrstuv"
  if (c >= 48 && c <= 57) return c - 48;        // 0-9 -> 0..9
  if (c >= 97 && c <= 118) return c - 97 + 10;  // a-v -> 10..31
  return -1;
}

function _ws1_radixVal(c) {
  if (c >= 48 && c <= 57) return c - 48;        // 0-9
  if (c >= 97 && c <= 122) return c - 97 + 10;  // a-z
  return -1;
}

// ---- exports ----

export function hexEncode(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const b = s.charCodeAt(i) & 0xff;
    out += _ws1_HEX[(b >> 4) & 0xf] + _ws1_HEX[b & 0xf];
  }
  return out;
}

export function hexDecode(h) {
  let out = "";
  for (let i = 0; i < h.length; i += 2) {
    const hi = _ws1_HEX.indexOf(h[i]);
    const lo = _ws1_HEX.indexOf(h[i + 1]);
    out += String.fromCharCode((hi << 4) | lo);
  }
  return out;
}

export function base64Encode(s) {
  let out = "";
  const n = s.length;
  for (let i = 0; i < n; i += 3) {
    const b0 = s.charCodeAt(i) & 0xff;
    const has1 = i + 1 < n;
    const has2 = i + 2 < n;
    const b1 = has1 ? (s.charCodeAt(i + 1) & 0xff) : 0;
    const b2 = has2 ? (s.charCodeAt(i + 2) & 0xff) : 0;
    out += _ws1_B64[b0 >> 2];
    out += _ws1_B64[((b0 & 0x3) << 4) | (b1 >> 4)];
    out += has1 ? _ws1_B64[((b1 & 0xf) << 2) | (b2 >> 6)] : "=";
    out += has2 ? _ws1_B64[b2 & 0x3f] : "=";
  }
  return out;
}

export function base64Decode(b) {
  let out = "";
  let bits = 0, nbits = 0;
  for (let i = 0; i < b.length; i++) {
    const c = b.charCodeAt(i);
    if (c === 61) break; // '=' padding ends data
    const v = _ws1_b64val(c);
    bits = (bits << 6) | v;
    nbits += 6;
    if (nbits >= 8) {
      nbits -= 8;
      out += String.fromCharCode((bits >> nbits) & 0xff);
      bits &= (1 << nbits) - 1;
    }
  }
  return out;
}

export function base32Encode(s) {
  let out = "";
  let bits = 0, nbits = 0;
  for (let i = 0; i < s.length; i++) {
    bits = (bits << 8) | (s.charCodeAt(i) & 0xff);
    nbits += 8;
    while (nbits >= 5) {
      nbits -= 5;
      out += _ws1_B32[(bits >> nbits) & 0x1f];
      bits &= (1 << nbits) - 1;
    }
  }
  if (nbits > 0) {
    out += _ws1_B32[(bits << (5 - nbits)) & 0x1f];
  }
  return out;
}

export function base32Decode(b) {
  let out = "";
  let bits = 0, nbits = 0;
  for (let i = 0; i < b.length; i++) {
    const v = _ws1_b32val(b.charCodeAt(i));
    bits = (bits << 5) | v;
    nbits += 5;
    if (nbits >= 8) {
      nbits -= 8;
      out += String.fromCharCode((bits >> nbits) & 0xff);
      bits &= (1 << nbits) - 1;
    }
  }
  return out;
}

export function toRadix(n, radix) {
  if (n === 0) return "0";
  let out = "";
  let v = n;
  while (v > 0) {
    out = _ws1_DIGITS[v % radix] + out;
    v = Math.floor(v / radix);
  }
  return out;
}

export function fromRadix(s, radix) {
  let v = 0;
  for (let i = 0; i < s.length; i++) {
    v = v * radix + _ws1_radixVal(s.charCodeAt(i));
  }
  return v;
}

// ===== WS2 — Escaping / quoting codecs =====
// WS2 — Escaping / quoting codecs (6)
// percentEncode, percentDecode, escapeHtml, unescapeHtml, csvEscape, csvUnescape

const _ws2_HEX = "0123456789ABCDEF";

// Hex nibble value for an ASCII hex char code (upper or lower); -1 if not hex.
function _ws2_hexVal(c) {
  if (c >= 48 && c <= 57) return c - 48;        // 0-9
  if (c >= 65 && c <= 70) return c - 65 + 10;   // A-F
  if (c >= 97 && c <= 102) return c - 97 + 10;  // a-f
  return -1;
}

// Is byte b in the RFC 3986 unreserved set: A-Z a-z 0-9 - . _ ~
function _ws2_isUnreserved(b) {
  if (b >= 65 && b <= 90) return true;   // A-Z
  if (b >= 97 && b <= 122) return true;  // a-z
  if (b >= 48 && b <= 57) return true;   // 0-9
  return b === 45 || b === 46 || b === 95 || b === 126; // - . _ ~
}

export function percentEncode(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const b = s.charCodeAt(i);
    if (_ws2_isUnreserved(b)) {
      out += s.charAt(i);
    } else {
      out += "%" + _ws2_HEX.charAt((b >> 4) & 0xf) + _ws2_HEX.charAt(b & 0xf);
    }
  }
  return out;
}

export function percentDecode(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 37 && i + 2 < s.length) { // '%' with two following chars
      const hi = _ws2_hexVal(s.charCodeAt(i + 1));
      const lo = _ws2_hexVal(s.charCodeAt(i + 2));
      if (hi >= 0 && lo >= 0) {
        out += String.fromCharCode((hi << 4) | lo);
        i += 2;
        continue;
      }
    }
    out += s.charAt(i);
  }
  return out;
}

export function escapeHtml(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    if (ch === "&") out += "&amp;";
    else if (ch === "<") out += "&lt;";
    else if (ch === ">") out += "&gt;";
    else if (ch === '"') out += "&quot;";
    else if (ch === "'") out += "&#39;";
    else out += ch;
  }
  return out;
}

export function unescapeHtml(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s.charCodeAt(i) === 38) { // '&'
      if (s.startsWith("&amp;", i)) { out += "&"; i += 5; continue; }
      if (s.startsWith("&lt;", i)) { out += "<"; i += 4; continue; }
      if (s.startsWith("&gt;", i)) { out += ">"; i += 4; continue; }
      if (s.startsWith("&quot;", i)) { out += '"'; i += 6; continue; }
      if (s.startsWith("&#39;", i)) { out += "'"; i += 5; continue; }
    }
    out += s.charAt(i);
    i += 1;
  }
  return out;
}

export function csvEscape(field) {
  let needsQuote = false;
  for (let i = 0; i < field.length; i++) {
    const c = field.charCodeAt(i);
    if (c === 44 || c === 34 || c === 13 || c === 10) { // , " \r \n
      needsQuote = true;
      break;
    }
  }
  if (!needsQuote) return field;
  let inner = "";
  for (let i = 0; i < field.length; i++) {
    const ch = field.charAt(i);
    inner += ch === '"' ? '""' : ch;
  }
  return '"' + inner + '"';
}

export function csvUnescape(field) {
  if (
    field.length >= 2 &&
    field.charCodeAt(0) === 34 &&
    field.charCodeAt(field.length - 1) === 34
  ) {
    const inner = field.slice(1, field.length - 1);
    let out = "";
    let i = 0;
    while (i < inner.length) {
      if (inner.charCodeAt(i) === 34 && inner.charCodeAt(i + 1) === 34) {
        out += '"';
        i += 2;
      } else {
        out += inner.charAt(i);
        i += 1;
      }
    }
    return out;
  }
  return field;
}

// ===== WS3 — Classical ciphers + run-length =====
// WS3 — Classical ciphers + run-length (6)
// Exports: rot13, atbash, caesarEncode, caesarDecode, runLengthEncode, runLengthDecode

// ---- helpers (prefixed, non-exported) ----
function _ws3_isUpper(c) { return c >= 65 && c <= 90; }   // A-Z
function _ws3_isLower(c) { return c >= 97 && c <= 122; }  // a-z

// Shift a single ASCII letter forward by `k` (0..25) within its case.
// Non-letters returned unchanged. `k` must already be normalized to 0..25.
function _ws3_shiftChar(c, k) {
  if (_ws3_isUpper(c)) return String.fromCharCode(((c - 65 + k) % 26) + 65);
  if (_ws3_isLower(c)) return String.fromCharCode(((c - 97 + k) % 26) + 97);
  return String.fromCharCode(c);
}

// Shift an entire string by a normalized amount k (0..25).
function _ws3_shiftString(s, k) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    out += _ws3_shiftChar(s.charCodeAt(i), k);
  }
  return out;
}

// ---- exports ----

export function rot13(s) {
  return _ws3_shiftString(s, 13);
}

export function atbash(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (_ws3_isUpper(c)) out += String.fromCharCode(90 - (c - 65));       // A<->Z
    else if (_ws3_isLower(c)) out += String.fromCharCode(122 - (c - 97)); // a<->z
    else out += String.fromCharCode(c);
  }
  return out;
}

export function caesarEncode(s, shift) {
  const k = (((shift % 26) + 26) % 26);
  return _ws3_shiftString(s, k);
}

export function caesarDecode(s, shift) {
  // Inverse of caesarEncode: shift backward by `shift`.
  const k = ((((-shift) % 26) + 26) % 26);
  return _ws3_shiftString(s, k);
}

export function runLengthEncode(s) {
  if (s.length === 0) return "";
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    let count = 1;
    while (i + count < s.length && s[i + count] === c) count++;
    out += count + c;
    i += count;
  }
  return out;
}

export function runLengthDecode(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    let num = "";
    while (i < s.length && s[i] >= "0" && s[i] <= "9") {
      num += s[i];
      i++;
    }
    // After the digits, exactly one character is the run's character.
    const c = s[i];
    i++;
    const count = parseInt(num, 10);
    out += c.repeat(count);
  }
  return out;
}

// ===== WS4 — Integer transforms =====
// WS4 — Integer transforms (6)
// Exports: toRoman, fromRoman, zigzagEncode, zigzagDecode, grayEncode, grayDecode

const _ws4_ROMAN_TABLE = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

// Single-char Roman symbol -> value, for fromRoman.
const _ws4_ROMAN_VALUES = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export function toRoman(n) {
  let value = n;
  let out = "";
  for (let i = 0; i < _ws4_ROMAN_TABLE.length; i++) {
    const v = _ws4_ROMAN_TABLE[i][0];
    const sym = _ws4_ROMAN_TABLE[i][1];
    while (value >= v) {
      out += sym;
      value -= v;
    }
  }
  return out;
}

export function fromRoman(s) {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = _ws4_ROMAN_VALUES[s[i]];
    const next = i + 1 < s.length ? _ws4_ROMAN_VALUES[s[i + 1]] : 0;
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
  let shift = g >>> 0;
  while (shift > 0) {
    shift = shift >>> 1;
    n = n ^ shift;
  }
  return n >>> 0;
}

// ===== WS5 — Idempotent canonicalizers =====
// WS5 — Idempotent canonicalizers (7)
// canonicalizeIPv6, canonicalizeIPv4, canonicalizeUuid, canonicalizeHexColor,
// canonicalizeInteger, collapseWhitespace, normalizeNewlines
//
// Pure, deterministic, string I/O only. Each function is idempotent.

// --- helpers (prefixed to stay collision-free after concatenation) ---

// Strip leading zeros from a hex group, lowercase; all-zero -> "0".
function _ws5_normHexGroup(g) {
  let h = g.toLowerCase();
  let i = 0;
  while (i < h.length - 1 && h.charCodeAt(i) === 48 /* '0' */) i++;
  return h.slice(i);
}

// Expand an IPv6 (possibly containing "::") into exactly 8 hex group strings.
function _ws5_expandIPv6(s) {
  const dbl = s.indexOf("::");
  if (dbl === -1) {
    return s.split(":");
  }
  const leftStr = s.slice(0, dbl);
  const rightStr = s.slice(dbl + 2);
  const left = leftStr.length ? leftStr.split(":") : [];
  const right = rightStr.length ? rightStr.split(":") : [];
  const missing = 8 - left.length - right.length;
  const mid = [];
  for (let i = 0; i < missing; i++) mid.push("0");
  return left.concat(mid, right);
}

// --- exports ---

export function canonicalizeIPv6(s) {
  // (1) expand any "::" to 8 groups; (2) lowercase + strip leading zeros;
  // (3) compress the longest run (>=2) of all-zero groups, leftmost on tie.
  const raw = _ws5_expandIPv6(s);
  const groups = [];
  for (let i = 0; i < raw.length; i++) groups.push(_ws5_normHexGroup(raw[i]));

  // Find the longest run of consecutive "0" groups (length >= 2), leftmost wins ties.
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === "0") {
      if (curLen === 0) curStart = i;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curLen = 0;
    }
  }

  if (bestLen >= 2) {
    const head = groups.slice(0, bestStart).join(":");
    const tail = groups.slice(bestStart + bestLen).join(":");
    return head + "::" + tail;
  }
  return groups.join(":");
}

export function canonicalizeIPv4(s) {
  const octets = s.split(".");
  const out = [];
  for (let i = 0; i < octets.length; i++) {
    const o = octets[i];
    let j = 0;
    while (j < o.length - 1 && o.charCodeAt(j) === 48 /* '0' */) j++;
    out.push(o.slice(j));
  }
  return out.join(".");
}

export function canonicalizeUuid(s) {
  return s.toLowerCase();
}

export function canonicalizeHexColor(s) {
  const digits = s.slice(1).toLowerCase(); // drop leading '#'
  if (digits.length === 3 || digits.length === 4) {
    let expanded = "";
    for (let i = 0; i < digits.length; i++) {
      expanded += digits[i] + digits[i];
    }
    return "#" + expanded;
  }
  return "#" + digits;
}

export function canonicalizeInteger(s) {
  let sign = "";
  let body = s;
  const first = s.charCodeAt(0);
  if (first === 43 /* '+' */) {
    body = s.slice(1);
  } else if (first === 45 /* '-' */) {
    sign = "-";
    body = s.slice(1);
  }
  // strip leading zeros from body
  let i = 0;
  while (i < body.length - 1 && body.charCodeAt(i) === 48 /* '0' */) i++;
  const stripped = body.slice(i);
  if (stripped === "0") return "0"; // -0, +0, 000, -000 -> "0"
  return sign + stripped;
}

export function collapseWhitespace(s) {
  // runs of space/tab -> single space; strip leading/trailing space/tab only.
  let collapsed = s.replace(/[ \t]+/g, " ");
  collapsed = collapsed.replace(/^[ \t]+/, "");
  collapsed = collapsed.replace(/[ \t]+$/, "");
  return collapsed;
}

export function normalizeNewlines(s) {
  // CRLF or lone CR or lone LF -> single LF.
  return s.replace(/\r\n?|\n/g, "\n");
}

// ===== WS6 — Single-direction formatters =====
// WS6 — Single-direction formatters (7)
// slugify, titleCase, ordinal, formatThousands, formatDuration, padCenter, zeroPad

const _ws6_SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "if", "in", "nor",
  "of", "on", "or", "per", "the", "to", "vs", "via",
]);

function _ws6_isLowerAlnum(code) {
  // a-z (97..122) or 0-9 (48..57)
  return (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
}

export function slugify(s) {
  const lower = s.toLowerCase();
  let out = "";
  let inRun = false; // currently emitting a hyphen run (deferred trimming)
  let started = false; // have we emitted any alnum yet
  for (let i = 0; i < lower.length; i++) {
    const c = lower[i];
    if (_ws6_isLowerAlnum(c.charCodeAt(0))) {
      if (inRun && started) out += "-";
      out += c;
      inRun = false;
      started = true;
    } else {
      // non-alnum: mark that a hyphen run is pending (only emitted before next alnum)
      if (started) inRun = true;
    }
  }
  return out;
}

export function titleCase(s) {
  const lower = s.toLowerCase();
  const words = lower.split(" ");
  const last = words.length - 1;
  const result = words.map((word, idx) => {
    if (word.length === 0) return word;
    const isEdge = idx === 0 || idx === last;
    if (!isEdge && _ws6_SMALL_WORDS.has(word)) {
      return word;
    }
    return word[0].toUpperCase() + word.slice(1);
  });
  return result.join(" ");
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
  let digits = String(Math.abs(n));
  let out = "";
  let count = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    out = digits[i] + out;
    count++;
    if (count % 3 === 0 && i > 0) {
      out = "," + out;
    }
  }
  return neg ? "-" + out : out;
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  const pad2 = (v) => (v < 10 ? "0" + v : String(v));
  return String(h) + "h" + pad2(mm) + "m" + pad2(ss) + "s";
}

export function padCenter(s, width, fill) {
  if (s.length >= width) return s;
  const p = width - s.length;
  const left = Math.floor(p / 2);
  const right = Math.ceil(p / 2);
  return fill.repeat(left) + s + fill.repeat(right);
}

export function zeroPad(n, width) {
  const neg = n < 0;
  const digits = String(Math.abs(n));
  if (neg) {
    // '-' counts toward width; zeros after the sign
    const natural = "-" + digits;
    if (natural.length >= width) return natural;
    const zeros = width - 1 - digits.length;
    return "-" + "0".repeat(zeros) + digits;
  } else {
    if (digits.length >= width) return digits;
    return "0".repeat(width - digits.length) + digits;
  }
}
