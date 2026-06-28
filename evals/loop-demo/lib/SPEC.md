# Build spec — `lib.mjs`: a deterministic wire-format & canonical-form toolkit

Build a single self-contained, **zero-dependency, fully offline** ES module **`lib.mjs`** that exports
**exactly 40 named pure functions**. A held-out driver imports your module as `import * as lib from
'./lib.mjs'` and calls each function **by its exact name**. The 40 functions are the deliverable.

## Global contract (applies to every function)

- **Pure & deterministic.** No side effects, no global state, no `Math.random`, no `Date`/time, no I/O,
  no network, no external dependencies, no top-level side effects (importing the module must do nothing
  but define exports). Same input → same output, always.
- **Each function is a named export:** `export function hexEncode(s) { ... }` etc. Use the exact names
  and parameter order below. A missing or misnamed export is a missing requirement.
- **I/O is STRING and INTEGER only.** No floats, no `NaN`/`Infinity`, no typed arrays. Where a function
  takes/returns a "byte string", each character's code point is one byte in `0..255`; you need not
  handle code points `> 255` (out of domain). Where a function takes/returns an integer, it is a safe
  integer.
- **Edge behavior is pinned in prose below.** The 2 worked examples per function are **happy-path**; the
  full rule (including edges) is stated in words and you must implement it. Empty-string input maps to
  empty-string output for every string codec unless stated otherwise.
- **Out-of-domain input is not tested.** Unless a function explicitly defines behavior on
  malformed/out-of-range input, you may assume inputs are well-formed per this spec (e.g. a decoder
  receives only strings its encoder could produce, or strings valid per the stated grammar). Never hang;
  never throw on in-domain input.
- **Quality bar:** clean, readable, self-contained code. The whole point is to implement **all 40**
  correctly and completely.

---

## WS1 — Base-N codecs (8)

### `hexEncode(s) -> string`
Byte string `s` → lowercase hexadecimal: each byte becomes exactly two hex digits (`0-9a-f`), most-
significant nibble first, concatenated. Empty → `""`.
Examples: `hexEncode("fo") -> "666f"`, `hexEncode("") -> ""`.

### `hexDecode(h) -> string`
Inverse of `hexEncode`. `h` is a lowercase hex string of even length → the byte string.
Examples: `hexDecode("666f") -> "fo"`, `hexDecode("") -> ""`.

### `base64Encode(s) -> string`
Byte string `s` → Base64 per **RFC 4648 §4**, alphabet `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/`,
padding character `=`. **Padding rule by `s.length mod 3`:** `0` → no `=`; `1` → `==`; `2` → `=`. Output
length is always a multiple of 4 (empty → `""`).
Examples: `base64Encode("foo") -> "Zm9v"`, `base64Encode("f") -> "Zg=="`.

### `base64Decode(b) -> string`
Inverse of `base64Encode` (RFC 4648 §4 alphabet + padding).
Examples: `base64Decode("Zm9v") -> "foo"`, `base64Decode("Zg==") -> "f"`.

### `base32Encode(s) -> string`
Byte string `s` → base32 over this **exact custom alphabet** (index 0..31), **lowercase, NO padding,
NO aliasing**:
```
0 1 2 3 4 5 6 7 8 9 a b c d e f g h i j k l m n o p q r s t u v
```
(i.e. `alphabet[v]` = the v-th character of `"0123456789abcdefghijklmnopqrstuv"`.) Process bytes
most-significant-bit first in groups of 5 bytes (40 bits → 8 chars). For a final partial group of `k`
bytes (`k` = 1..5), zero-pad the trailing bits up to the next 5-bit boundary and emit exactly
`ceil(8*k/5)` characters — i.e. **1 byte → 2 chars, 2 → 4, 3 → 5, 4 → 7, 5 → 8**. **No `=` padding.**
Empty → `""`.
Examples: `base32Encode("A") -> "84"`, `base32Encode("") -> ""`.

### `base32Decode(b) -> string`
Inverse of `base32Encode` (same custom alphabet; the character count of the final group determines the
trailing byte count: 2 chars → 1 byte, 4 → 2, 5 → 3, 7 → 4, 8 → 5).
Examples: `base32Decode("84") -> "A"`, `base32Decode("") -> ""`.

### `toRadix(n, radix) -> string`
Nonnegative integer `n` → its representation in `radix` (an integer in `2..36`), digits `0-9` then
lowercase `a-z`, **no leading zeros** (the value `0` is the single character `"0"`).
Examples: `toRadix(255, 16) -> "ff"`, `toRadix(0, 2) -> "0"`.

### `fromRadix(s, radix) -> integer`
Inverse of `toRadix`. `s` is a lowercase string of valid digits for `radix` → the integer value.
Examples: `fromRadix("ff", 16) -> 255`, `fromRadix("0", 2) -> 0`.

---

## WS2 — Escaping / quoting codecs (6)

### `percentEncode(s) -> string`
Byte string `s` → percent-encoding per **RFC 3986**. The **unreserved set** is left literal:
`A-Z`, `a-z`, `0-9`, and the four characters `- . _ ~`. **Every other byte** is encoded as `%` followed
by exactly **two UPPERCASE hex digits**. (In particular a space becomes `%20`, never `+`.)
Examples: `percentEncode("a b") -> "a%20b"`, `percentEncode("100%") -> "100%25"`.

### `percentDecode(s) -> string`
Inverse: each `%HH` (two hex digits, upper or lower case accepted) → the byte; all other characters are
literal.
Examples: `percentDecode("a%20b") -> "a b"`, `percentDecode("100%25") -> "100%"`.

### `escapeHtml(s) -> string`
Replace these five characters with these exact entities: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`,
`"` → `&quot;`, `'` → `&#39;`. (Use `&#39;` for the apostrophe, not `&apos;`.) No other characters
change.
Examples: `escapeHtml("a<b") -> "a&lt;b"`, `escapeHtml("Tom & Jerry") -> "Tom &amp; Jerry"`.

### `unescapeHtml(s) -> string`
Inverse of `escapeHtml`: convert exactly those five entities back to their characters (`&lt;`→`<`,
`&gt;`→`>`, `&quot;`→`"`, `&#39;`→`'`, `&amp;`→`&`). No other entities are recognized.
Examples: `unescapeHtml("a&lt;b") -> "a<b"`, `unescapeHtml("Tom &amp; Jerry") -> "Tom & Jerry"`.

### `csvEscape(field) -> string`
Escape one CSV field per **RFC 4180**, **minimal quoting**: if `field` contains a comma `,`, a double
quote `"`, a carriage return `\r`, or a line feed `\n`, then wrap the whole field in double quotes and
replace every embedded `"` with `""`. Otherwise return `field` unchanged.
Examples: `csvEscape("John") -> "John"`, `csvEscape("Smith, John") -> "\"Smith, John\""`.

### `csvUnescape(field) -> string`
Inverse of `csvEscape`: if `field` begins and ends with a double quote, remove those outer quotes and
replace every `""` with `"`; otherwise return it unchanged.
Examples: `csvUnescape("John") -> "John"`, `csvUnescape("\"Smith, John\"") -> "Smith, John"`.

---

## WS3 — Classical ciphers + run-length (6)

### `rot13(s) -> string`
Shift every ASCII letter by 13 within its case (`A-Z` and `a-z` wrap within their own alphabet); all
non-letter characters pass through unchanged. (`rot13` is its own inverse.)
Examples: `rot13("Hello") -> "Uryyb"`, `rot13("abc") -> "nop"`.

### `atbash(s) -> string`
Map each ASCII letter to its mirror within its case (`A↔Z`, `B↔Y`, …, `a↔z`); non-letters unchanged.
(`atbash` is its own inverse.)
Examples: `atbash("abc") -> "zyx"`, `atbash("Hello") -> "Svool"`.

### `caesarEncode(s, shift) -> string`
Shift every ASCII letter forward by `shift` positions within its case, wrapping around; non-letters
unchanged. `shift` is any integer (normalize modulo 26; negative shifts move backward).
Examples: `caesarEncode("abc", 3) -> "def"`, `caesarEncode("xyz", 3) -> "abc"`.

### `caesarDecode(s, shift) -> string`
Inverse of `caesarEncode` (shift backward by `shift`).
Examples: `caesarDecode("def", 3) -> "abc"`, `caesarDecode("abc", 3) -> "xyz"`.

### `runLengthEncode(s) -> string`
Run-length encode the byte string `s`, which is guaranteed to contain **no ASCII digit characters**
(`0`–`9` are out of domain for the input). For each maximal run of an identical character `c` of length
`L`, emit the **decimal count `L` immediately followed by the single character `c`** (the count is
always emitted, even when `L == 1`). Empty → `""`.
Examples: `runLengthEncode("aaab") -> "3a1b"`, `runLengthEncode("abc") -> "1a1b1c"`.

### `runLengthDecode(s) -> string`
Inverse of `runLengthEncode`: read a decimal count (one or more digits) then exactly one character,
repeating; expand each to `count` copies of the character.
Examples: `runLengthDecode("3a1b") -> "aaab"`, `runLengthDecode("1a1b1c") -> "abc"`.

---

## WS4 — Integer transforms (6)

### `toRoman(n) -> string`
Integer `n` in `1..3999` → its Roman numeral using the standard subtractive system. Greedily subtract
over this table (value → symbol): `1000→M, 900→CM, 500→D, 400→CD, 100→C, 90→XC, 50→L, 40→XL, 10→X,
9→IX, 5→V, 4→IV, 1→I`. Output is uppercase.
Examples: `toRoman(4) -> "IV"`, `toRoman(1994) -> "MCMXCIV"`.

### `fromRoman(s) -> integer`
Inverse of `toRoman`. `s` is a valid uppercase Roman numeral (1..3999) → the integer.
Examples: `fromRoman("IV") -> 4`, `fromRoman("MCMXCIV") -> 1994`.

### `zigzagEncode(n) -> integer`
Map a signed integer to a nonnegative integer (ZigZag, as in Protocol Buffers): `n >= 0` → `2*n`;
`n < 0` → `-2*n - 1`.
Examples: `zigzagEncode(0) -> 0`, `zigzagEncode(-1) -> 1`.

### `zigzagDecode(u) -> integer`
Inverse of `zigzagEncode`. Nonnegative `u`: if even → `u/2`; if odd → `-(u + 1)/2`.
Examples: `zigzagDecode(0) -> 0`, `zigzagDecode(1) -> -1`.

### `grayEncode(n) -> integer`
Nonnegative integer `n` (domain `0 <= n < 2^31`) → its binary-reflected Gray code: `n XOR (n >> 1)`.
Examples: `grayEncode(0) -> 0`, `grayEncode(2) -> 3`.

### `grayDecode(g) -> integer`
Inverse of `grayEncode` (domain `0 <= g < 2^31`): XOR `g` with **every** right-shift of itself, i.e.
`n = g ^ (g>>1) ^ (g>>2) ^ (g>>3) ^ ...` continuing until the shifted term is `0`. (`grayDecode` must
satisfy `grayDecode(grayEncode(n)) === n`.)
Examples: `grayDecode(3) -> 2`, `grayDecode(0) -> 0`.

---

## WS5 — Idempotent canonicalizers (7)
*(Each must be idempotent: `canon(canon(x)) === canon(x)`.)*

### `canonicalizeIPv6(s) -> string`
Canonicalize a textual IPv6 address per **RFC 5952 §4**. Input is a valid IPv6 in conventional form:
either 8 colon-separated 16-bit hex groups, or a form using one `::`; hex digits may be upper/lower case
and may have leading zeros. (Out of domain — you need not handle: embedded IPv4 like `::ffff:1.2.3.4`,
zone IDs like `%eth0`, surrounding brackets `[...]`, ports, or `/prefix`.) Rules: **(1)** lowercase all
hex digits; **(2)** suppress leading zeros in each group (an all-zero group becomes `0`); **(3)** replace
the **longest run of consecutive all-zero groups** with `::` — the run must be **two or more** groups
(`::` MUST NOT shorten a single `0` group), and on a **tie in length** compress the **leftmost** run.
Examples: `canonicalizeIPv6("2001:0DB8:0000:0000:0000:0000:0000:0001") -> "2001:db8::1"`,
`canonicalizeIPv6("::1") -> "::1"`.

### `canonicalizeIPv4(s) -> string`
Canonicalize a dotted-decimal IPv4 address: four octets (each `0..255`) separated by `.`; **strip leading
zeros** from each octet (decimal interpretation; an all-zero octet becomes `0`).
Examples: `canonicalizeIPv4("192.168.001.001") -> "192.168.1.1"`, `canonicalizeIPv4("10.0.0.1") -> "10.0.0.1"`.

### `canonicalizeUuid(s) -> string`
Canonicalize a UUID given as 32 hex digits in the hyphenated `8-4-4-4-12` form (upper or lower case; no
surrounding braces, no `urn:uuid:` prefix). Output: **lowercase**, same hyphenation.
Examples: `canonicalizeUuid("F81D4FAE-7DEC-11D0-A765-00A0C91E6BF6") -> "f81d4fae-7dec-11d0-a765-00a0c91e6bf6"`,
`canonicalizeUuid("00000000-0000-0000-0000-000000000000") -> "00000000-0000-0000-0000-000000000000"`.

### `canonicalizeHexColor(s) -> string`
Canonicalize a CSS hex color: `#` followed by 3, 4, 6, or 8 hex digits (any case). Expand the short forms
by **doubling each digit** (`#RGB` → `#RRGGBB`, `#RGBA` → `#RRGGBBAA`); 6- and 8-digit forms keep their
length. **Lowercase** all hex digits. Output always starts with `#`.
Examples: `canonicalizeHexColor("#ABC") -> "#aabbcc"`, `canonicalizeHexColor("#FF0000") -> "#ff0000"`.

### `canonicalizeInteger(s) -> string`
Canonicalize a decimal integer string: optional leading `+` or `-`, then decimal digits. Drop a leading
`+`; strip leading zeros; keep a single `-` for negative values; **`-0` (and `-000`, `+0`, `000`)
canonicalize to `"0"`**.
Examples: `canonicalizeInteger("007") -> "7"`, `canonicalizeInteger("-0") -> "0"`.

### `collapseWhitespace(s) -> string`
Replace every maximal run of ASCII **space (`0x20`) and/or tab (`0x09`)** with a single space, and strip
leading and trailing such whitespace. (Only space and tab — do not touch newlines.)
Examples: `collapseWhitespace("a  b") -> "a b"`, `collapseWhitespace("  x\ty  ") -> "x y"`.

### `normalizeNewlines(s) -> string`
Convert every CRLF (`\r\n`), every lone CR (`\r`), and every lone LF (`\n`) to a single LF (`\n`).
Examples: `normalizeNewlines("a\r\nb") -> "a\nb"`, `normalizeNewlines("a\rb") -> "a\nb"`.

---

## WS6 — Single-direction formatters (7)

### `slugify(s) -> string`
Produce a URL slug: **lowercase** the input, then replace every maximal run of characters that are **not**
in `[a-z0-9]` (after lowercasing) with a single hyphen `-`, then strip any leading/trailing hyphen. **No
transliteration** (a non-ASCII or accented letter is not in `[a-z0-9]`, so it becomes part of a hyphen
run); `&` is **not** special-cased (it is just a non-`[a-z0-9]` character). An input with no `[a-z0-9]`
characters produces `""`.
Examples: `slugify("Hello, World!") -> "hello-world"`, `slugify("  Foo_Bar  ") -> "foo-bar"`.

### `titleCase(s) -> string`
Title-case a single-space-separated string. Procedure: **lowercase the entire string**, split on single
ASCII spaces, then capitalize the first letter of each word **except** words in the small-word list
below — but **always** capitalize the **first and last** word regardless. "Capitalize" means uppercase
the first character (the rest stay lowercased). The **exact small-word list** is:
```
a an and as at but by for if in nor of on or per the to vs via
```
Examples: `titleCase("the lord of the rings") -> "The Lord of the Rings"`,
`titleCase("a tale of two cities") -> "A Tale of Two Cities"`.

### `ordinal(n) -> string`
Nonnegative integer `n` → `n` followed by its English ordinal suffix. Let `m = n % 100`: if `m` is `11`,
`12`, or `13` → suffix `"th"`; otherwise by `n % 10`: `1`→`"st"`, `2`→`"nd"`, `3`→`"rd"`, anything else
→ `"th"`.
Examples: `ordinal(1) -> "1st"`, `ordinal(2) -> "2nd"`.

### `formatThousands(n) -> string`
Safe integer `n` → its decimal string with `,` grouping every three digits from the right; prepend `-`
for negative values (values with fewer than 4 digits are unchanged).
Examples: `formatThousands(1000) -> "1,000"`, `formatThousands(-1234567) -> "-1,234,567"`.

### `formatDuration(seconds) -> string`
Nonnegative integer `seconds` → `"{h}h{mm}m{ss}s"` where `h = floor(seconds / 3600)` printed with **no
leading zero and no upper cap** (e.g. `25h`), `mm` = the minutes component `0..59` **zero-padded to two
digits**, and `ss` = the seconds component `0..59` **zero-padded to two digits**. All three components
are always present.
Examples: `formatDuration(3661) -> "1h01m01s"`, `formatDuration(0) -> "0h00m00s"`.

### `padCenter(s, width, fill) -> string`
If `s.length >= width`, return `s` unchanged. Otherwise pad `s` with the single character `fill` to total
length `width`, centered, putting the **extra** padding character on the **right** when the total padding
is odd. (Total padding `p = width - s.length`; left = `floor(p/2)`, right = `ceil(p/2)`.)
Examples: `padCenter("ab", 6, "*") -> "**ab**"`, `padCenter("x", 4, "-") -> "-x--"`.

### `zeroPad(n, width) -> string`
Safe integer `n` → its decimal string zero-padded to total length at least `width`. For **negative** `n`,
the leading `-` counts toward `width` and the zeros go **after** the sign (e.g. `zeroPad(-7, 4) -> "-007"`).
If the natural decimal string is already at least `width` long, return it unchanged.
Examples: `zeroPad(7, 4) -> "0007"`, `zeroPad(-7, 4) -> "-007"`.

---

## The 40 exports (the complete checklist)

`hexEncode, hexDecode, base64Encode, base64Decode, base32Encode, base32Decode, toRadix, fromRadix,
percentEncode, percentDecode, escapeHtml, unescapeHtml, csvEscape, csvUnescape, rot13, atbash,
caesarEncode, caesarDecode, runLengthEncode, runLengthDecode, toRoman, fromRoman, zigzagEncode,
zigzagDecode, grayEncode, grayDecode, canonicalizeIPv6, canonicalizeIPv4, canonicalizeUuid,
canonicalizeHexColor, canonicalizeInteger, collapseWhitespace, normalizeNewlines, slugify, titleCase,
ordinal, formatThousands, formatDuration, padCenter, zeroPad`

The deliverable is **`lib.mjs`** exporting all 40, each implemented completely and correctly per the
rules above.
