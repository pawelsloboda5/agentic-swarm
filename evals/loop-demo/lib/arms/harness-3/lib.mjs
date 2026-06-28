// WS1 — Base-N codecs (8 exports)
// hexEncode, hexDecode, base64Encode, base64Decode,
// base32Encode, base32Decode, toRadix, fromRadix

const _ws1_HEX = "0123456789abcdef";
const _ws1_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const _ws1_B32 = "0123456789abcdefghijklmnopqrstuv";
const _ws1_RADIX = "0123456789abcdefghijklmnopqrstuvwxyz";

// Build a reverse lookup map from an alphabet string: char -> index.
function _ws1_revMap(alphabet) {
  const m = Object.create(null);
  for (let i = 0; i < alphabet.length; i++) m[alphabet[i]] = i;
  return m;
}

const _ws1_B64_REV = _ws1_revMap(_ws1_B64);
const _ws1_B32_REV = _ws1_revMap(_ws1_B32);

// ---- hex ----

export function hexEncode(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const b = s.charCodeAt(i) & 0xff;
    out += _ws1_HEX[b >> 4] + _ws1_HEX[b & 0x0f];
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

// ---- base64 (RFC 4648 §4) ----

export function base64Encode(s) {
  let out = "";
  const n = s.length;
  let i = 0;
  for (; i + 3 <= n; i += 3) {
    const b0 = s.charCodeAt(i) & 0xff;
    const b1 = s.charCodeAt(i + 1) & 0xff;
    const b2 = s.charCodeAt(i + 2) & 0xff;
    out += _ws1_B64[b0 >> 2];
    out += _ws1_B64[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += _ws1_B64[((b1 & 0x0f) << 2) | (b2 >> 6)];
    out += _ws1_B64[b2 & 0x3f];
  }
  const rem = n - i;
  if (rem === 1) {
    const b0 = s.charCodeAt(i) & 0xff;
    out += _ws1_B64[b0 >> 2];
    out += _ws1_B64[(b0 & 0x03) << 4];
    out += "==";
  } else if (rem === 2) {
    const b0 = s.charCodeAt(i) & 0xff;
    const b1 = s.charCodeAt(i + 1) & 0xff;
    out += _ws1_B64[b0 >> 2];
    out += _ws1_B64[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += _ws1_B64[(b1 & 0x0f) << 2];
    out += "=";
  }
  return out;
}

export function base64Decode(b) {
  // Strip padding; process in groups of 4 characters.
  let core = b;
  let pad = 0;
  while (core.length > 0 && core[core.length - 1] === "=") {
    core = core.slice(0, core.length - 1);
    pad++;
  }
  let out = "";
  let i = 0;
  const n = core.length;
  for (; i + 4 <= n; i += 4) {
    const c0 = _ws1_B64_REV[core[i]];
    const c1 = _ws1_B64_REV[core[i + 1]];
    const c2 = _ws1_B64_REV[core[i + 2]];
    const c3 = _ws1_B64_REV[core[i + 3]];
    out += String.fromCharCode((c0 << 2) | (c1 >> 4));
    out += String.fromCharCode(((c1 & 0x0f) << 4) | (c2 >> 2));
    out += String.fromCharCode(((c2 & 0x03) << 6) | c3);
  }
  const rem = n - i;
  if (rem === 2) {
    const c0 = _ws1_B64_REV[core[i]];
    const c1 = _ws1_B64_REV[core[i + 1]];
    out += String.fromCharCode((c0 << 2) | (c1 >> 4));
  } else if (rem === 3) {
    const c0 = _ws1_B64_REV[core[i]];
    const c1 = _ws1_B64_REV[core[i + 1]];
    const c2 = _ws1_B64_REV[core[i + 2]];
    out += String.fromCharCode((c0 << 2) | (c1 >> 4));
    out += String.fromCharCode(((c1 & 0x0f) << 4) | (c2 >> 2));
  }
  return out;
}

// ---- base32 (custom alphabet, MSB-first, no padding) ----

export function base32Encode(s) {
  let out = "";
  const n = s.length;
  let i = 0;
  // Full 5-byte groups -> 8 chars.
  for (; i + 5 <= n; i += 5) {
    const b0 = s.charCodeAt(i) & 0xff;
    const b1 = s.charCodeAt(i + 1) & 0xff;
    const b2 = s.charCodeAt(i + 2) & 0xff;
    const b3 = s.charCodeAt(i + 3) & 0xff;
    const b4 = s.charCodeAt(i + 4) & 0xff;
    out += _ws1_B32[b0 >> 3];
    out += _ws1_B32[((b0 & 0x07) << 2) | (b1 >> 6)];
    out += _ws1_B32[(b1 >> 1) & 0x1f];
    out += _ws1_B32[((b1 & 0x01) << 4) | (b2 >> 4)];
    out += _ws1_B32[((b2 & 0x0f) << 1) | (b3 >> 7)];
    out += _ws1_B32[(b3 >> 2) & 0x1f];
    out += _ws1_B32[((b3 & 0x03) << 3) | (b4 >> 5)];
    out += _ws1_B32[b4 & 0x1f];
  }
  const k = n - i;
  if (k > 0) {
    // Accumulate the k remaining bytes into a bit buffer (MSB-first), then emit
    // ceil(8k/5) chars, padding the low bits with zeros. Use arithmetic (not
    // 32-bit bitwise) because k=4 needs 35 bits, which overflows `<<`/`>>`.
    let buf = 0;
    for (let j = 0; j < k; j++) buf = buf * 256 + (s.charCodeAt(i + j) & 0xff);
    const nChars = Math.ceil((8 * k) / 5); // 1->2, 2->4, 3->5, 4->7, 5->8
    const totalBits = nChars * 5;
    buf = buf * Math.pow(2, totalBits - 8 * k); // fill trailing zero pad bits
    for (let c = nChars - 1; c >= 0; c--) {
      const v = Math.floor(buf / Math.pow(2, c * 5)) % 32;
      out += _ws1_B32[v];
    }
  }
  return out;
}

export function base32Decode(b) {
  let out = "";
  const n = b.length;
  let i = 0;
  // Full 8-char groups -> 5 bytes.
  for (; i + 8 <= n; i += 8) {
    let buf = 0;
    for (let j = 0; j < 8; j++) buf = buf * 32 + _ws1_B32_REV[b[i + j]];
    // buf is 40 bits; extract 5 bytes MSB-first using division to stay safe.
    out += String.fromCharCode(Math.floor(buf / 4294967296) & 0xff); // top 8 of 40
    const low32 = buf % 4294967296;
    out += String.fromCharCode((low32 >>> 24) & 0xff);
    out += String.fromCharCode((low32 >>> 16) & 0xff);
    out += String.fromCharCode((low32 >>> 8) & 0xff);
    out += String.fromCharCode(low32 & 0xff);
  }
  const c = n - i;
  if (c > 0) {
    // Final partial group: char count -> byte count (2->1,4->2,5->3,7->4,8->5).
    const byteCount = Math.floor((5 * c) / 8); // 2->1,4->2,5->3,7->4,8->5
    let buf = 0;
    for (let j = 0; j < c; j++) buf = buf * 32 + _ws1_B32_REV[b[i + j]];
    const totalBits = c * 5;
    // Drop the trailing pad bits, keep the high byteCount*8 bits.
    const dropBits = totalBits - byteCount * 8;
    buf = Math.floor(buf / Math.pow(2, dropBits));
    for (let bi = byteCount - 1; bi >= 0; bi--) {
      const shift = bi * 8;
      const byteVal = Math.floor(buf / Math.pow(2, shift)) & 0xff;
      out += String.fromCharCode(byteVal);
    }
  }
  return out;
}

// ---- toRadix / fromRadix (2..36) ----

export function toRadix(n, radix) {
  if (n === 0) return "0";
  let out = "";
  let v = n;
  while (v > 0) {
    out = _ws1_RADIX[v % radix] + out;
    v = Math.floor(v / radix);
  }
  return out;
}

export function fromRadix(s, radix) {
  let v = 0;
  for (let i = 0; i < s.length; i++) {
    v = v * radix + _ws1_RADIX.indexOf(s[i]);
  }
  return v;
}

// WS2 — Escaping / quoting codecs (6)
// percentEncode, percentDecode, escapeHtml, unescapeHtml, csvEscape, csvUnescape

const _ws2_HEX = "0123456789ABCDEF";

function _ws2_isUnreserved(b) {
  // A-Z (65..90), a-z (97..122), 0-9 (48..57), and - . _ ~
  return (
    (b >= 65 && b <= 90) ||
    (b >= 97 && b <= 122) ||
    (b >= 48 && b <= 57) ||
    b === 45 /* - */ ||
    b === 46 /* . */ ||
    b === 95 /* _ */ ||
    b === 126 /* ~ */
  );
}

function _ws2_hexVal(ch) {
  // ch: single-char string, upper or lower hex digit -> 0..15
  const c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) return c - 48; // 0-9
  if (c >= 65 && c <= 70) return c - 55; // A-F
  if (c >= 97 && c <= 102) return c - 87; // a-f
  return -1;
}

export function percentEncode(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const b = s.charCodeAt(i);
    if (_ws2_isUnreserved(b)) {
      out += s[i];
    } else {
      out += "%" + _ws2_HEX[(b >> 4) & 0xf] + _ws2_HEX[b & 0xf];
    }
  }
  return out;
}

export function percentDecode(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "%" && i + 2 < s.length) {
      const hi = _ws2_hexVal(s[i + 1]);
      const lo = _ws2_hexVal(s[i + 2]);
      if (hi >= 0 && lo >= 0) {
        out += String.fromCharCode((hi << 4) | lo);
        i += 2;
        continue;
      }
    }
    out += s[i];
  }
  return out;
}

export function escapeHtml(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
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
    if (s[i] === "&") {
      if (s.startsWith("&amp;", i)) {
        out += "&";
        i += 5;
        continue;
      }
      if (s.startsWith("&lt;", i)) {
        out += "<";
        i += 4;
        continue;
      }
      if (s.startsWith("&gt;", i)) {
        out += ">";
        i += 4;
        continue;
      }
      if (s.startsWith("&quot;", i)) {
        out += '"';
        i += 6;
        continue;
      }
      if (s.startsWith("&#39;", i)) {
        out += "'";
        i += 5;
        continue;
      }
    }
    out += s[i];
    i += 1;
  }
  return out;
}

export function csvEscape(field) {
  let needsQuote = false;
  for (let i = 0; i < field.length; i++) {
    const ch = field[i];
    if (ch === "," || ch === '"' || ch === "\r" || ch === "\n") {
      needsQuote = true;
      break;
    }
  }
  if (!needsQuote) return field;
  let inner = "";
  for (let i = 0; i < field.length; i++) {
    const ch = field[i];
    if (ch === '"') inner += '""';
    else inner += ch;
  }
  return '"' + inner + '"';
}

export function csvUnescape(field) {
  if (
    field.length >= 2 &&
    field[0] === '"' &&
    field[field.length - 1] === '"'
  ) {
    const inner = field.slice(1, field.length - 1);
    let out = "";
    let i = 0;
    while (i < inner.length) {
      if (inner[i] === '"' && inner[i + 1] === '"') {
        out += '"';
        i += 2;
      } else {
        out += inner[i];
        i += 1;
      }
    }
    return out;
  }
  return field;
}

// WS3 — Classical ciphers + run-length (6 exports)
// rot13, atbash, caesarEncode, caesarDecode, runLengthEncode, runLengthDecode
// Pure, deterministic, string/integer I/O only. No external deps.

// Shift one ASCII letter forward by k (0..25) within its own case; non-letters unchanged.
function _ws3_shiftLetter(code, k) {
  if (code >= 65 && code <= 90) {
    // uppercase A-Z
    return 65 + (((code - 65 + k) % 26 + 26) % 26);
  }
  if (code >= 97 && code <= 122) {
    // lowercase a-z
    return 97 + (((code - 97 + k) % 26 + 26) % 26);
  }
  return code;
}

export function rot13(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    out += String.fromCharCode(_ws3_shiftLetter(s.charCodeAt(i), 13));
  }
  return out;
}

export function atbash(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      out += String.fromCharCode(90 - (code - 65)); // A<->Z
    } else if (code >= 97 && code <= 122) {
      out += String.fromCharCode(122 - (code - 97)); // a<->z
    } else {
      out += String.fromCharCode(code);
    }
  }
  return out;
}

export function caesarEncode(s, shift) {
  const k = ((shift % 26) + 26) % 26;
  let out = "";
  for (let i = 0; i < s.length; i++) {
    out += String.fromCharCode(_ws3_shiftLetter(s.charCodeAt(i), k));
  }
  return out;
}

export function caesarDecode(s, shift) {
  return caesarEncode(s, -shift);
}

export function runLengthEncode(s) {
  if (s.length === 0) return "";
  let out = "";
  let runChar = s[0];
  let count = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === runChar) {
      count++;
    } else {
      out += count + runChar;
      runChar = s[i];
      count = 1;
    }
  }
  out += count + runChar;
  return out;
}

export function runLengthDecode(s) {
  let out = "";
  let i = 0;
  const n = s.length;
  while (i < n) {
    let numStr = "";
    while (i < n && s[i] >= "0" && s[i] <= "9") {
      numStr += s[i];
      i++;
    }
    // After digits there is exactly one literal character.
    const ch = s[i];
    i++;
    const count = parseInt(numStr, 10);
    out += ch.repeat(count);
  }
  return out;
}

// WS4 — Integer transforms (6)
// Roman (1..3999 subtractive), zigzag (signed<->nonneg), binary-reflected Gray code.

const _ws4_ROMAN = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
];

const _ws4_ROMAN_VALUE = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export function toRoman(n) {
  let out = "";
  let rem = n;
  for (let i = 0; i < _ws4_ROMAN.length; i++) {
    const value = _ws4_ROMAN[i][0];
    const sym = _ws4_ROMAN[i][1];
    while (rem >= value) {
      out += sym;
      rem -= value;
    }
  }
  return out;
}

export function fromRoman(s) {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = _ws4_ROMAN_VALUE[s.charAt(i)];
    const next = i + 1 < s.length ? _ws4_ROMAN_VALUE[s.charAt(i + 1)] : 0;
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
  // n XOR (n >> 1), kept in 32-bit unsigned range.
  return (n ^ (n >>> 1)) >>> 0;
}

export function grayDecode(g) {
  // XOR g with every right-shift of itself until the shifted term is 0.
  let n = g >>> 0;
  let shift = 1;
  while ((g >>> shift) !== 0) {
    n ^= (g >>> shift);
    shift++;
  }
  return n >>> 0;
}

// WS5 — Idempotent canonicalizers (7)
// Each is idempotent: canon(canon(x)) === canon(x).

export function canonicalizeIPv6(s) {
  const lower = s.toLowerCase();
  let groups;
  if (lower.indexOf("::") !== -1) {
    const parts = lower.split("::");
    const left = parts[0] === "" ? [] : parts[0].split(":");
    const right = parts[1] === "" ? [] : parts[1].split(":");
    const missing = 8 - (left.length + right.length);
    groups = left.concat(_ws5_zeros(missing), right);
  } else {
    groups = lower.split(":");
  }
  // Strip leading zeros per group (all-zero -> "0").
  groups = groups.map((g) => {
    const t = g.replace(/^0+/, "");
    return t === "" ? "0" : t;
  });
  // Find longest run of consecutive "0" groups (length >= 2), leftmost on tie.
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

function _ws5_zeros(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push("0");
  return out;
}

export function canonicalizeIPv4(s) {
  return s
    .split(".")
    .map((oct) => String(parseInt(oct, 10)))
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
  let sign = "";
  let i = 0;
  if (s[0] === "+") {
    i = 1;
  } else if (s[0] === "-") {
    sign = "-";
    i = 1;
  }
  const digits = s.slice(i).replace(/^0+/, "");
  if (digits === "") return "0";
  return sign + digits;
}

export function collapseWhitespace(s) {
  return s.replace(/[ \t]+/g, " ").replace(/^ | $/g, "");
}

export function normalizeNewlines(s) {
  return s.replace(/\r\n?/g, "\n");
}

// WS6 — Single-direction formatters (7)
// slugify, titleCase, ordinal, formatThousands, formatDuration, padCenter, zeroPad
// Pure, deterministic, integer/string I/O only. No external deps, no top-level side effects.

// Exact small-word list for titleCase (lowercased keys; pure data table, no call on import).
const _ws6_SMALL = {
  a: 1, an: 1, and: 1, as: 1, at: 1, but: 1, by: 1, for: 1, if: 1, in: 1,
  nor: 1, of: 1, on: 1, or: 1, per: 1, the: 1, to: 1, vs: 1, via: 1,
};

// Capitalize the first character (rest unchanged — caller has already lowercased).
function _ws6_cap(w) {
  if (w.length === 0) return w;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// Zero-pad a small nonnegative integer to exactly two digits.
function _ws6_pad2(x) {
  return x < 10 ? "0" + x : String(x);
}

export function slugify(s) {
  // Lowercase, collapse each maximal run of non-[a-z0-9] to one hyphen, trim edge hyphens.
  const lowered = s.toLowerCase();
  let out = "";
  let inGap = false; // true while inside a run of non-[a-z0-9] chars
  for (let i = 0; i < lowered.length; i++) {
    const ch = lowered[i];
    const c = lowered.charCodeAt(i);
    const isKeep = (c >= 97 && c <= 122) || (c >= 48 && c <= 57); // a-z or 0-9
    if (isKeep) {
      if (inGap && out.length > 0) out += "-"; // emit single hyphen only between kept chars
      out += ch;
      inGap = false;
    } else {
      inGap = true;
    }
  }
  return out;
}

export function titleCase(s) {
  const lower = s.toLowerCase();
  const words = lower.split(" ");
  const last = words.length - 1;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // Small words stay lowercased EXCEPT always capitalize first and last word.
    if (i !== 0 && i !== last && _ws6_SMALL[w] === 1) {
      // leave w as-is (already lowercased)
      continue;
    }
    words[i] = _ws6_cap(w);
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
      default: suffix = "th";
    }
  }
  return String(n) + suffix;
}

export function formatThousands(n) {
  const neg = n < 0;
  const digits = neg ? String(-n) : String(n);
  let out = "";
  let count = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    out = digits[i] + out;
    count++;
    if (count % 3 === 0 && i !== 0) out = "," + out;
  }
  return neg ? "-" + out : out;
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  return h + "h" + _ws6_pad2(m) + "m" + _ws6_pad2(sec) + "s";
}

export function padCenter(s, width, fill) {
  if (s.length >= width) return s;
  const p = width - s.length;
  const left = Math.floor(p / 2);
  const right = p - left; // extra goes RIGHT when p is odd (ceil)
  return fill.repeat(left) + s + fill.repeat(right);
}

export function zeroPad(n, width) {
  const neg = n < 0;
  const digits = neg ? String(-n) : String(n);
  const total = neg ? digits.length + 1 : digits.length;
  if (total >= width) {
    return neg ? "-" + digits : digits;
  }
  const zeros = width - total;
  return (neg ? "-" : "") + "0".repeat(zeros) + digits;
}
