// Self-test stub: 39 correct exports + ONE export (toRoman) that infinite-loops.
// Proves blocker-1 isolation: the hang costs exactly 1/40, the other 39 still score.
export {
  hexEncode, hexDecode, base64Encode, base64Decode, base32Encode, base32Decode, toRadix, fromRadix,
  percentEncode, percentDecode, escapeHtml, unescapeHtml, csvEscape, csvUnescape, rot13, atbash,
  caesarEncode, caesarDecode, runLengthEncode, runLengthDecode, fromRoman, zigzagEncode,
  zigzagDecode, grayEncode, grayDecode, canonicalizeIPv6, canonicalizeIPv4, canonicalizeUuid,
  canonicalizeHexColor, canonicalizeInteger, collapseWhitespace, normalizeNewlines, slugify,
  titleCase, ordinal, formatThousands, formatDuration, padCenter, zeroPad,
} from '../reference/lib.mjs';
export function toRoman(n) { while (true) { /* hang */ } }
