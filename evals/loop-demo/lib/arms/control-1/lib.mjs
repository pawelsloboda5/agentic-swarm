// lib.mjs — deterministic wire-format & canonical-form toolkit.
// Single self-contained, zero-dependency, fully offline ES module.
// 40 pure, deterministic named exports. String/integer I/O only.
// Importing this module has no side effects beyond defining the exports.

// ---------------------------------------------------------------------------
// WS1 — Base-N codecs (8)
// ---------------------------------------------------------------------------

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Custom base32 alphabet (index 0..31): lowercase, no padding, no aliasing.
const B32_ALPHABET = "0123456789abcdefghijklmnopqrstuv";

/** Byte string -> lowercase hex (two digits per byte, MSB nibble first). */
export function hexEncode(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const h = s.charCodeAt(i).toString(16);
    out += h.length === 1 ? "0" + h : h;
  }
  return out;
}

/** Inverse of hexEncode. Even-length lowercase hex -> byte string. */
export function hexDecode(h) {
  let out = "";
  for (let i = 0; i < h.length; i += 2) {
    out += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
  }
  return out;
}

/** Byte string -> Base64 (RFC 4648 §4, standard alphabet, '=' padding). */
export function base64Encode(s) {
  let out = "";
  for (let i = 0; i < s.length; i += 3) {
    const rem = s.length - i; // 1, 2, or >=3
    const b0 = s.charCodeAt(i);
    const b1 = rem > 1 ? s.charCodeAt(i + 1) : 0;
    const b2 = rem > 2 ? s.charCodeAt(i + 2) : 0;
    out += B64_ALPHABET[b0 >> 2];
    out += B64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += rem > 1 ? B64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] : "=";
    out += rem > 2 ? B64_ALPHABET[b2 & 0x3f] : "=";
  }
  return out;
}

/** Inverse of base64Encode (RFC 4648 §4). */
export function base64Decode(b) {
  const lookup = {};
  for (let i = 0; i < B64_ALPHABET.length; i++) lookup[B64_ALPHABET[i]] = i;
  let out = "";
  for (let i = 0; i < b.length; i += 4) {
    const c2 = b[i + 2];
    const c3 = b[i + 3];
    const n0 = lookup[b[i]];
    const n1 = lookup[b[i + 1]];
    out += String.fromCharCode((n0 << 2) | (n1 >> 4));
    if (c2 !== "=" && c2 !== undefined) {
      const n2 = lookup[c2];
      out += String.fromCharCode(((n1 & 0x0f) << 4) | (n2 >> 2));
      if (c3 !== "=" && c3 !== undefined) {
        const n3 = lookup[c3];
        out += String.fromCharCode(((n2 & 0x03) << 6) | n3);
      }
    }
  }
  return out;
}

/** Byte string -> base32 (custom alphabet, MSB-first, no padding). */
export function base32Encode(s) {
  let out = "";
  let value = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i++) {
    value = (value << 8) | s.charCodeAt(i);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += B32_ALPHABET[(value >> bits) & 0x1f];
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) {
    out += B32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

/** Inverse of base32Encode (same custom alphabet). */
export function base32Decode(b) {
  const lookup = {};
  for (let i = 0; i < B32_ALPHABET.length; i++) lookup[B32_ALPHABET[i]] = i;
  let out = "";
  let value = 0;
  let bits = 0;
  for (let i = 0; i < b.length; i++) {
    value = (value << 5) | lookup[b[i]];
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 0xff);
      value &= (1 << bits) - 1;
    }
  }
  return out;
}

/** Nonnegative integer -> representation in radix 2..36 (lowercase, no leading zeros). */
export function toRadix(n, radix) {
  return n.toString(radix);
}

/** Inverse of toRadix. Lowercase digit string -> integer value. */
export function fromRadix(s, radix) {
  return parseInt(s, radix);
}

// ---------------------------------------------------------------------------
// WS2 — Escaping / quoting codecs (6)
// ---------------------------------------------------------------------------

/** Byte string -> percent-encoding (RFC 3986; unreserved A-Za-z0-9 - . _ ~). */
export function percentEncode(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (
      (c >= "A" && c <= "Z") ||
      (c >= "a" && c <= "z") ||
      (c >= "0" && c <= "9") ||
      c === "-" ||
      c === "." ||
      c === "_" ||
      c === "~"
    ) {
      out += c;
    } else {
      const h = s.charCodeAt(i).toString(16).toUpperCase();
      out += "%" + (h.length === 1 ? "0" + h : h);
    }
  }
  return out;
}

/** Inverse: each %HH (upper/lower hex) -> byte; other chars literal. */
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

/** Escape the five HTML metacharacters (apostrophe -> &#39;). */
export function escapeHtml(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "&") out += "&amp;";
    else if (c === "<") out += "&lt;";
    else if (c === ">") out += "&gt;";
    else if (c === '"') out += "&quot;";
    else if (c === "'") out += "&#39;";
    else out += c;
  }
  return out;
}

/** Inverse of escapeHtml; only the five entities are recognized (single pass). */
export function unescapeHtml(s) {
  return s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => {
    switch (e) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      default:
        return "'"; // #39
    }
  });
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

function shiftLetters(s, shift) {
  const sh = ((shift % 26) + 26) % 26;
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 65 && c <= 90) {
      out += String.fromCharCode(((c - 65 + sh) % 26) + 65);
    } else if (c >= 97 && c <= 122) {
      out += String.fromCharCode(((c - 97 + sh) % 26) + 97);
    } else {
      out += s[i];
    }
  }
  return out;
}

/** ROT13 over ASCII letters; non-letters pass through. Self-inverse. */
export function rot13(s) {
  return shiftLetters(s, 13);
}

/** Atbash mirror within each case; non-letters unchanged. Self-inverse. */
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

/** Caesar shift forward by `shift` (normalized mod 26, negative allowed). */
export function caesarEncode(s, shift) {
  return shiftLetters(s, shift);
}

/** Inverse of caesarEncode (shift backward). */
export function caesarDecode(s, shift) {
  return shiftLetters(s, -shift);
}

/** Run-length encode (input has no ASCII digits): count then char, count always present. */
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

/** Inverse of runLengthEncode: decimal count (1+ digits) then one char. */
export function runLengthDecode(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    let j = i;
    while (j < s.length && s[j] >= "0" && s[j] <= "9") j++;
    const count = parseInt(s.slice(i, j), 10);
    out += s[j].repeat(count);
    i = j + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// WS4 — Integer transforms (6)
// ---------------------------------------------------------------------------

const ROMAN_TABLE = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** Integer 1..3999 -> Roman numeral (standard subtractive, uppercase). */
export function toRoman(n) {
  let out = "";
  for (const [value, sym] of ROMAN_TABLE) {
    while (n >= value) {
      out += sym;
      n -= value;
    }
  }
  return out;
}

/** Inverse of toRoman. Valid uppercase Roman numeral -> integer. */
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

/** ZigZag encode (Protocol Buffers): n>=0 -> 2n; n<0 -> -2n-1. */
export function zigzagEncode(n) {
  return n >= 0 ? 2 * n : -2 * n - 1;
}

/** Inverse of zigzagEncode. */
export function zigzagDecode(u) {
  return u % 2 === 0 ? u / 2 : -(u + 1) / 2;
}

/** Binary-reflected Gray code: n XOR (n >> 1). Domain 0 <= n < 2^31. */
export function grayEncode(n) {
  return n ^ (n >> 1);
}

/** Inverse of grayEncode: XOR g with every right-shift of itself. */
export function grayDecode(g) {
  let n = 0;
  while (g > 0) {
    n ^= g;
    g >>= 1;
  }
  return n;
}

// ---------------------------------------------------------------------------
// WS5 — Idempotent canonicalizers (7)
// ---------------------------------------------------------------------------

/** Canonicalize an IPv6 address (RFC 5952 §4). */
export function canonicalizeIPv6(s) {
  let groups;
  if (s.includes("::")) {
    const parts = s.split("::");
    const left = parts[0];
    const right = parts[1];
    const leftParts = left.length ? left.split(":") : [];
    const rightParts = right.length ? right.split(":") : [];
    const missing = 8 - leftParts.length - rightParts.length;
    groups = leftParts.concat(new Array(missing).fill("0"), rightParts);
  } else {
    groups = s.split(":");
  }
  // (1) lowercase + (2) strip leading zeros (all-zero group -> "0").
  groups = groups.map((g) => parseInt(g, 16).toString(16));

  // (3) longest run of consecutive all-zero groups, length >= 2, leftmost on tie.
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
    const before = groups.slice(0, bestStart).join(":");
    const after = groups.slice(bestStart + bestLen).join(":");
    return before + "::" + after;
  }
  return groups.join(":");
}

/** Canonicalize dotted-decimal IPv4: strip leading zeros per octet. */
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

/** Canonicalize a decimal integer string (drop '+', strip zeros, -0 -> "0"). */
export function canonicalizeInteger(s) {
  let neg = false;
  let body = s;
  if (body[0] === "+") {
    body = body.slice(1);
  } else if (body[0] === "-") {
    neg = true;
    body = body.slice(1);
  }
  body = body.replace(/^0+/, "");
  if (body === "" || body === "0") return "0";
  return (neg ? "-" : "") + body;
}

/** Collapse runs of space/tab to one space; strip leading/trailing such whitespace. */
export function collapseWhitespace(s) {
  return s
    .replace(/[ \t]+/g, " ")
    .replace(/^ /, "")
    .replace(/ $/, "");
}

/** Normalize all CRLF / lone CR / lone LF to a single LF. */
export function normalizeNewlines(s) {
  return s.replace(/\r\n|\r|\n/g, "\n");
}

// ---------------------------------------------------------------------------
// WS6 — Single-direction formatters (7)
// ---------------------------------------------------------------------------

/** Produce a URL slug (lowercase, non-[a-z0-9] runs -> '-', trim hyphens). */
export function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const TITLE_SMALL_WORDS = new Set(
  "a an and as at but by for if in nor of on or per the to vs via".split(" ")
);

/** Title-case a single-space-separated string (small-word list; always cap first/last). */
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

/** Nonnegative integer -> with English ordinal suffix. */
export function ordinal(n) {
  const m = n % 100;
  let suffix;
  if (m === 11 || m === 12 || m === 13) {
    suffix = "th";
  } else {
    switch (n % 10) {
      case 1:
        suffix = "st";
        break;
      case 2:
        suffix = "nd";
        break;
      case 3:
        suffix = "rd";
        break;
      default:
        suffix = "th";
    }
  }
  return n + suffix;
}

/** Safe integer -> decimal string with ',' grouping every three digits. */
export function formatThousands(n) {
  const neg = n < 0;
  const digits = Math.abs(n).toString();
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i];
  }
  return (neg ? "-" : "") + out;
}

/** Nonnegative seconds -> "{h}h{mm}m{ss}s". */
export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  const pad = (x) => (x < 10 ? "0" + x : "" + x);
  return h + "h" + pad(m) + "m" + pad(sec) + "s";
}

/** Center-pad s to width with fill; extra padding goes right when odd. */
export function padCenter(s, width, fill) {
  if (s.length >= width) return s;
  const p = width - s.length;
  const left = Math.floor(p / 2);
  const right = p - left;
  return fill.repeat(left) + s + fill.repeat(right);
}

/** Safe integer -> decimal string zero-padded to at least `width` (sign before zeros). */
export function zeroPad(n, width) {
  const neg = n < 0;
  const digits = Math.abs(n).toString();
  const need = neg ? width - 1 : width;
  const padded =
    digits.length < need ? "0".repeat(need - digits.length) + digits : digits;
  return (neg ? "-" : "") + padded;
}
