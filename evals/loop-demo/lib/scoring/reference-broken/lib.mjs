// Deliberately INCOMPLETE reference (the instrument's "must drop clearly below the correct ref" anchor).
// 8 exports STUBBED (fail their disclosed happy example -> not delivered -> OMISSION drops to ~0.80) and
// 6 exports EDGE-BOTCHED (pass happy, fail a held-out edge -> COMPLETENESS drops further). Proves the
// ruler measures COVERAGE, not schema-matching. NOT a scored arm.

// --- 26 unchanged exports re-used verbatim from the correct reference ---
export {
  hexDecode, base64Encode, base64Decode, base32Decode, toRadix, fromRadix,
  escapeHtml, unescapeHtml, csvUnescape, rot13, atbash, caesarDecode,
  runLengthEncode, runLengthDecode, fromRoman, zigzagDecode, grayEncode, grayDecode,
  canonicalizeIPv4, canonicalizeUuid, canonicalizeHexColor, collapseWhitespace,
  normalizeNewlines, formatDuration, padCenter, zeroPad,
} from '../reference/lib.mjs';

// --- 8 STUBS (fail the disclosed happy example -> dropped on the omission axis) ---
export function base32Encode(s) { return ''; }
export function toRoman(n) { return ''; }
export function canonicalizeIPv6(s) { return s; }
export function slugify(s) { return s; }
export function zigzagEncode(n) { return n; }
export function percentEncode(s) { return s; }
export function formatThousands(n) { return String(n); }
export function csvEscape(field) { return field; }

// --- 6 EDGE-BOTCHED (pass happy, fail held-out edges) ---
const HEX = '0123456789abcdef';
export function hexEncode(s) { // no zero-padding: \x0f -> "f" not "0f"
  let o = ''; for (let i = 0; i < s.length; i++) o += (s.charCodeAt(i) & 0xff).toString(16); return o;
}
export function ordinal(n) { // missing the 11/12/13 special case
  const d = n % 10; const suf = d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'; return n + suf;
}
export function caesarEncode(s, shift) { // no negative-shift normalization
  let o = '';
  for (const c of s) {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) o += String.fromCharCode((code - 65 + shift) % 26 + 65);
    else if (code >= 97 && code <= 122) o += String.fromCharCode((code - 97 + shift) % 26 + 97);
    else o += c;
  }
  return o;
}
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'vs', 'via']);
export function titleCase(s) { // does NOT force the last word to be capitalized
  const words = s.toLowerCase().split(' ');
  return words.map((w, i) => (i !== 0 && SMALL.has(w)) ? w : (w.length ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}
export function canonicalizeInteger(s) { // strips '-' but not a leading '+'
  const neg = s[0] === '-';
  let digits = (neg ? s.slice(1) : s).replace(/^0+/, '');
  if (digits === '') digits = '0';
  return (neg && digits !== '0' ? '-' : '') + digits;
}
export function percentDecode(s) { // only decodes UPPERCASE %HH
  let o = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '%' && /^[0-9A-F]{2}$/.test(s.slice(i + 1, i + 3))) { o += String.fromCharCode(parseInt(s.slice(i + 1, i + 3), 16)); i += 2; }
    else o += s[i];
  }
  return o;
}
