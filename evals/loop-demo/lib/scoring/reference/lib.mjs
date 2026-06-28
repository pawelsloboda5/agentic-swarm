// Correct reference implementation of SPEC.md (the instrument's "must score ~1.0" anchor).
// Pure, deterministic, zero-dep, string/integer I/O only. NOT a scored arm.

// ---------- WS1: Base-N codecs ----------
const HEX = '0123456789abcdef';
export function hexEncode(s) {
  let o = '';
  for (let i = 0; i < s.length; i++) { const b = s.charCodeAt(i) & 0xff; o += HEX[b >> 4] + HEX[b & 0xf]; }
  return o;
}
export function hexDecode(h) {
  let o = '';
  for (let i = 0; i < h.length; i += 2) o += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
  return o;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64Encode(s) {
  let o = '';
  for (let i = 0; i < s.length; i += 3) {
    const b0 = s.charCodeAt(i) & 0xff;
    const has1 = i + 1 < s.length, has2 = i + 2 < s.length;
    const b1 = has1 ? s.charCodeAt(i + 1) & 0xff : 0;
    const b2 = has2 ? s.charCodeAt(i + 2) & 0xff : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    o += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    o += has1 ? B64[(n >> 6) & 63] : '=';
    o += has2 ? B64[n & 63] : '=';
  }
  return o;
}
export function base64Decode(b) {
  let o = '';
  const clean = b.replace(/=+$/, '');
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64.indexOf(clean[i]), c1 = B64.indexOf(clean[i + 1]);
    const c2 = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : -1;
    const c3 = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : -1;
    const n = (c0 << 18) | (c1 << 12) | ((c2 < 0 ? 0 : c2) << 6) | (c3 < 0 ? 0 : c3);
    o += String.fromCharCode((n >> 16) & 0xff);
    if (c2 >= 0) o += String.fromCharCode((n >> 8) & 0xff);
    if (c3 >= 0) o += String.fromCharCode(n & 0xff);
  }
  return o;
}

const B32 = '0123456789abcdefghijklmnopqrstuv'; // custom, disclosed
export function base32Encode(s) {
  let bits = '', o = '';
  for (let i = 0; i < s.length; i++) bits += (s.charCodeAt(i) & 0xff).toString(2).padStart(8, '0');
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    o += B32[parseInt(chunk, 2)];
  }
  return o;
}
export function base32Decode(b) {
  let bits = '';
  for (let i = 0; i < b.length; i++) bits += B32.indexOf(b[i]).toString(2).padStart(5, '0');
  let o = '';
  for (let i = 0; i + 8 <= bits.length; i += 8) o += String.fromCharCode(parseInt(bits.slice(i, i + 8), 2));
  return o;
}

const DIGITS36 = '0123456789abcdefghijklmnopqrstuvwxyz';
export function toRadix(n, radix) {
  if (n === 0) return '0';
  let o = '';
  while (n > 0) { o = DIGITS36[n % radix] + o; n = Math.floor(n / radix); }
  return o;
}
export function fromRadix(s, radix) {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = n * radix + DIGITS36.indexOf(s[i]);
  return n;
}

// ---------- WS2: Escaping / quoting ----------
const UNRESERVED = /[A-Za-z0-9\-._~]/;
export function percentEncode(s) {
  let o = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (UNRESERVED.test(c)) o += c;
    else o += '%' + (s.charCodeAt(i) & 0xff).toString(16).toUpperCase().padStart(2, '0');
  }
  return o;
}
export function percentDecode(s) {
  let o = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '%') { o += String.fromCharCode(parseInt(s.slice(i + 1, i + 3), 16)); i += 2; }
    else o += s[i];
  }
  return o;
}

export function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export function unescapeHtml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

export function csvEscape(field) {
  if (/[",\r\n]/.test(field)) return '"' + field.replace(/"/g, '""') + '"';
  return field;
}
export function csvUnescape(field) {
  if (field.length >= 2 && field[0] === '"' && field[field.length - 1] === '"')
    return field.slice(1, -1).replace(/""/g, '"');
  return field;
}

// ---------- WS3: Ciphers + run-length ----------
function shiftLetter(c, k) {
  const code = c.charCodeAt(0);
  if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + (k % 26) + 26) % 26) + 65);
  if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + (k % 26) + 26) % 26) + 97);
  return c;
}
export function rot13(s) { let o = ''; for (const c of s) o += shiftLetter(c, 13); return o; }
export function atbash(s) {
  let o = '';
  for (const c of s) {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) o += String.fromCharCode(90 - (code - 65));
    else if (code >= 97 && code <= 122) o += String.fromCharCode(122 - (code - 97));
    else o += c;
  }
  return o;
}
export function caesarEncode(s, shift) { let o = ''; for (const c of s) o += shiftLetter(c, shift); return o; }
export function caesarDecode(s, shift) { let o = ''; for (const c of s) o += shiftLetter(c, -shift); return o; }

export function runLengthEncode(s) {
  let o = '', i = 0;
  while (i < s.length) {
    let j = i; while (j < s.length && s[j] === s[i]) j++;
    o += (j - i) + s[i]; i = j;
  }
  return o;
}
export function runLengthDecode(s) {
  let o = '', i = 0;
  while (i < s.length) {
    let num = ''; while (i < s.length && s[i] >= '0' && s[i] <= '9') { num += s[i]; i++; }
    const ch = s[i]; i++;
    o += ch.repeat(parseInt(num, 10));
  }
  return o;
}

// ---------- WS4: Integer transforms ----------
const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function toRoman(n) {
  let o = '';
  for (const [v, sym] of ROMAN) while (n >= v) { o += sym; n -= v; }
  return o;
}
export function fromRoman(s) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = map[s[i]], next = map[s[i + 1]] || 0;
    if (cur < next) n -= cur; else n += cur;
  }
  return n;
}
export function zigzagEncode(n) { return n >= 0 ? 2 * n : -2 * n - 1; }
export function zigzagDecode(u) { return u % 2 === 0 ? u / 2 : -(u + 1) / 2; }
export function grayEncode(n) { return n ^ (n >> 1); }
export function grayDecode(g) { let n = g; while (g >>= 1) n ^= g; return n; }

// ---------- WS5: Idempotent canonicalizers ----------
export function canonicalizeIPv6(s) {
  // expand to 8 groups
  let groups;
  if (s.includes('::')) {
    const [head, tail] = s.split('::');
    const h = head ? head.split(':') : [];
    const t = tail ? tail.split(':') : [];
    const mid = new Array(8 - h.length - t.length).fill('0');
    groups = [...h, ...mid, ...t];
  } else groups = s.split(':');
  groups = groups.map(g => parseInt(g || '0', 16).toString(16)); // lowercase, strip leading zeros
  // find longest run of '0' groups (>=2), leftmost on tie
  let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
  for (let i = 0; i < 8; i++) {
    if (groups[i] === '0') { if (curStart < 0) curStart = i; curLen++; if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; } }
    else { curStart = -1; curLen = 0; }
  }
  if (bestLen >= 2) {
    const before = groups.slice(0, bestStart).join(':');
    const after = groups.slice(bestStart + bestLen).join(':');
    return before + '::' + after;
  }
  return groups.join(':');
}
export function canonicalizeIPv4(s) { return s.split('.').map(o => String(parseInt(o, 10))).join('.'); }
export function canonicalizeUuid(s) { return s.toLowerCase(); }
export function canonicalizeHexColor(s) {
  let hex = s.slice(1).toLowerCase();
  if (hex.length === 3 || hex.length === 4) hex = hex.split('').map(c => c + c).join('');
  return '#' + hex;
}
export function canonicalizeInteger(s) {
  const neg = s[0] === '-';
  let digits = s.replace(/^[+-]/, '').replace(/^0+/, '');
  if (digits === '') digits = '0';
  return (neg && digits !== '0' ? '-' : '') + digits;
}
export function collapseWhitespace(s) { return s.replace(/[ \t]+/g, ' ').replace(/^ | $/g, ''); }
export function normalizeNewlines(s) { return s.replace(/\r\n|\r|\n/g, '\n'); }

// ---------- WS6: Single-direction formatters ----------
export function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'vs', 'via']);
export function titleCase(s) {
  const words = s.toLowerCase().split(' ');
  return words.map((w, i) => {
    if (i !== 0 && i !== words.length - 1 && SMALL.has(w)) return w;
    return w.length ? w[0].toUpperCase() + w.slice(1) : w;
  }).join(' ');
}
export function ordinal(n) {
  const m = n % 100;
  let suf = 'th';
  if (m < 11 || m > 13) { const d = n % 10; suf = d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'; }
  return n + suf;
}
export function formatThousands(n) {
  const neg = n < 0; const s = String(Math.abs(n));
  let o = ''; for (let i = 0; i < s.length; i++) { if (i > 0 && (s.length - i) % 3 === 0) o += ','; o += s[i]; }
  return (neg ? '-' : '') + o;
}
export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h + 'h' + String(m).padStart(2, '0') + 'm' + String(s).padStart(2, '0') + 's';
}
export function padCenter(s, width, fill) {
  if (s.length >= width) return s;
  const p = width - s.length, left = Math.floor(p / 2), right = p - left;
  return fill.repeat(left) + s + fill.repeat(right);
}
export function zeroPad(n, width) {
  const neg = n < 0; const digits = String(Math.abs(n));
  const total = neg ? width - 1 : width;
  const padded = digits.padStart(Math.max(total, digits.length), '0');
  return (neg ? '-' : '') + padded;
}
