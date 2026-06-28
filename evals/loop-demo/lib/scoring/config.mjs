// HELD-OUT instrument config: per-export kind, A1-property generator, disclosed happy examples,
// and the held-out EDGE INPUTS (the pinned-but-unexemplified cases). Expected EDGE OUTPUTS are
// computed from the correct reference by gen-vectors.mjs (-> vectors.json) and independently
// confirmed by a blind SPEC-only ambiguity scrubber. This file MUST NOT be reachable in any build
// sandbox.
//
// kinds: 'pair' (forward codec, partner is the inverse; scored by forward vectors, round-trip reported)
//        'involution' (f(f(x))===x; reference-free, per-export)
//        'canon' (idempotent canon(canon(x))===canon(x); reference-free, per-export)
//        'fmt' (single-direction; forward vectors only)
// gen: name of the A1 input generator (for pairs: source-side inputs; involution/canon: valid inputs)

// ---- seeded PRNG (deterministic; the scorer must be reproducible) ----
export function mkRng(seed) {
  let s = (seed | 0) || 1;
  return (n) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return n > 0 ? s % n : 0; };
}

// ---- A1 input generators: each returns {core:[args...], edge:[args...]} given an rng ----
// 'core' = typical non-edge inputs (the omission/"basically works" check); 'edge' = boundary inputs.
function byteStr(rng, n) { let o = ''; for (let i = 0; i < n; i++) o += String.fromCharCode(rng(256)); return o; }
function asciiStr(rng, n) { let o = ''; for (let i = 0; i < n; i++) o += String.fromCharCode(32 + rng(95)); return o; }
function letterStr(rng, n) { let o = ''; for (let i = 0; i < n; i++) { const k = rng(52); o += String.fromCharCode(k < 26 ? 65 + k : 97 + k - 26); } return o; }
function nonDigitStr(rng, n) { let o = ''; for (let i = 0; i < n; i++) { let c; do { c = 32 + rng(95); } while (c >= 48 && c <= 57); o += String.fromCharCode(c); } return o; }

export const GENERATORS = {
  byteString: (rng) => ({
    core: [1, 2, 3, 6, 9].map(n => [byteStr(rng, n)]),
    edge: [[''], ['\x00'], ['\xff'], ['\x00\xff\x7f'], [byteStr(rng, 17)]],
  }),
  asciiText: (rng) => ({
    core: [1, 3, 5, 8].map(n => [asciiStr(rng, n)]),
    edge: [[''], ['<>&"\''], ['a,b"c\r\nd'], [asciiStr(rng, 20)]],
  }),
  letterText: (rng) => ({
    core: [1, 3, 5, 8].map(n => [letterStr(rng, n)]),
    edge: [[''], ['Zz'], ['Aa Mm'], [letterStr(rng, 20)]],
  }),
  nonDigitText: (rng) => ({
    core: [1, 3, 5, 8].map(n => [nonDigitStr(rng, n)]),
    edge: [[''], ['a'], [nonDigitStr(rng, 1).repeat(11)], [nonDigitStr(rng, 20)]],
  }),
  caesarArgs: (rng) => ({
    core: [3, 5, 8].map(n => [letterStr(rng, n), 1 + rng(25)]),
    edge: [['', 3], ['abcXYZ', 1], ['Hello', 25], [letterStr(rng, 12), 13]],
  }),
  nonNegInt: (rng) => ({
    core: [rng(100), rng(1000), rng(50)].map(n => [n]),
    edge: [[0], [1], [255], [rng(1000000) + 1000]],
  }),
  signedInt: (rng) => ({
    core: [rng(200) - 100, rng(2000) - 1000].map(n => [n]),
    edge: [[0], [-1], [1], [rng(1000000) - 500000]],
  }),
  radixArgs: (rng) => ({
    core: [[rng(100000), 2 + rng(35)], [rng(100000), 2 + rng(35)], [rng(1000), 10]],
    edge: [[0, 2], [0, 36], [1, 2], [rng(1000000), 36]],
  }),
  // canonicalizer generators produce VALID inputs (for idempotence); edges authored explicitly below
  ipv6In: (rng) => { const grp = () => rng(65536).toString(16); return { core: [[`${grp()}:${grp()}:0:0:0:0:${grp()}:${grp()}`], [`${grp()}:${grp()}:${grp()}:${grp()}:${grp()}:${grp()}:${grp()}:${grp()}`]], edge: [['::'], ['::1'], ['0:0:0:0:0:0:0:0']] }; },
  ipv4In: (rng) => ({ core: [[`${rng(256)}.${rng(256)}.${rng(256)}.${rng(256)}`], [`0${rng(10)}.${rng(256)}.0${rng(10)}.${rng(256)}`]], edge: [['0.0.0.0'], ['255.255.255.255']] }),
  uuidIn: (rng) => { const h = (n) => { let o = ''; for (let i = 0; i < n; i++) o += '0123456789abcdef'[rng(16)]; return o; }; return { core: [[`${h(8)}-${h(4)}-${h(4)}-${h(4)}-${h(12)}`]], edge: [['00000000-0000-0000-0000-000000000000']] }; },
  hexColorIn: (rng) => { const h = (n) => { let o = ''; for (let i = 0; i < n; i++) o += '0123456789abcdef'[rng(16)]; return o; }; return { core: [['#' + h(6)], ['#' + h(3)]], edge: [['#000'], ['#ffffff']] }; },
  intStrIn: (rng) => ({ core: [[String(rng(100000))], [String(-rng(100000))]], edge: [['0'], ['-0'], ['007']] }),
  wsIn: (rng) => ({ core: [['a b c'], ['x  y']], edge: [[''], ['   '], ['a\tb']] }),
  nlIn: (rng) => ({ core: [['a\nb'], ['x\ny\nz']], edge: [[''], ['a\r\nb'], ['\r']] }),
  none: () => ({ core: [], edge: [] }),
};

// ---- the 40-export config. happy = the 2 DISCLOSED examples (must match SPEC.md exactly, non-edge).
//      edgeInputs = held-out probes (arg arrays). Expected outputs are computed by gen-vectors.mjs. ----
export const CFG = {
  // WS1
  hexEncode: { ws: 'WS1', kind: 'pair', partner: 'hexDecode', gen: 'byteString', happy: [[['fo'], '666f'], [[''], '']], edgeInputs: [['\x00'], ['\xff'], ['\xab\xcd'], ['\x0f'], ['A\x00B']] },
  hexDecode: { ws: 'WS1', kind: 'pair', partner: 'hexEncode', gen: 'byteString', happy: [[['666f'], 'fo'], [[''], '']], edgeInputs: [['00'], ['ff'], ['abcd'], ['0f']] },
  base64Encode: { ws: 'WS1', kind: 'pair', partner: 'base64Decode', gen: 'byteString', happy: [[['foo'], 'Zm9v'], [['f'], 'Zg==']], edgeInputs: [['fo'], ['foob'], ['foobar'], ['\x00'], ['\x00\x00'], ['\xff\xff\xff']] },
  base64Decode: { ws: 'WS1', kind: 'pair', partner: 'base64Encode', gen: 'byteString', happy: [[['Zm9v'], 'foo'], [['Zg=='], 'f']], edgeInputs: [['Zm8='], ['Zm9vYg=='], ['Zm9vYmFy'], ['AA==']] },
  base32Encode: { ws: 'WS1', kind: 'pair', partner: 'base32Decode', gen: 'byteString', happy: [[['A'], '84'], [[''], '']], edgeInputs: [['fo'], ['foo'], ['foob'], ['fooba'], ['\x00'], ['\xff']] },
  base32Decode: { ws: 'WS1', kind: 'pair', partner: 'base32Encode', gen: 'byteString', happy: [[['84'], 'A'], [[''], '']], edgeInputs: [['cpng'], ['00'], ['cpnmu']] },
  toRadix: { ws: 'WS1', kind: 'pair', partner: 'fromRadix', gen: 'radixArgs', happy: [[[255, 16], 'ff'], [[0, 2], '0']], edgeInputs: [[35, 36], [1000, 2], [7, 8], [4095, 16], [1, 36]] },
  fromRadix: { ws: 'WS1', kind: 'pair', partner: 'toRadix', gen: 'radixArgs', happy: [[['ff', 16], 255], [['0', 2], 0]], edgeInputs: [['z', 36], ['1111111111', 2], ['10', 8], ['fff', 16]] },
  // WS2
  percentEncode: { ws: 'WS2', kind: 'pair', partner: 'percentDecode', gen: 'asciiText', happy: [[['a b'], 'a%20b'], [['100%'], '100%25']], edgeInputs: [['/'], ['~'], ['a~b-c.d_e'], ['A B&C'], ['\xff'], ['?#[]@']] },
  percentDecode: { ws: 'WS2', kind: 'pair', partner: 'percentEncode', gen: 'asciiText', happy: [[['a%20b'], 'a b'], [['100%25'], '100%']], edgeInputs: [['%2f'], ['%7E'], ['%FF'], ['a%20%21b']] },
  escapeHtml: { ws: 'WS2', kind: 'pair', partner: 'unescapeHtml', gen: 'asciiText', happy: [[['a<b'], 'a&lt;b'], [['Tom & Jerry'], 'Tom &amp; Jerry']], edgeInputs: [["'"], ['"'], ['<>&"\''], ['a&b<c']] },
  unescapeHtml: { ws: 'WS2', kind: 'pair', partner: 'escapeHtml', gen: 'asciiText', happy: [[['a&lt;b'], 'a<b'], [['Tom &amp; Jerry'], 'Tom & Jerry']], edgeInputs: [['&#39;'], ['&quot;'], ['&amp;lt;'], ['&lt;&gt;&amp;']] },
  csvEscape: { ws: 'WS2', kind: 'pair', partner: 'csvUnescape', gen: 'asciiText', happy: [[['John'], 'John'], [['Smith, John'], '"Smith, John"']], edgeInputs: [['a"b'], ['a\r\nb'], ['"already"'], ['no,quote']] },
  csvUnescape: { ws: 'WS2', kind: 'pair', partner: 'csvEscape', gen: 'asciiText', happy: [[['John'], 'John'], [['"Smith, John"'], 'Smith, John']], edgeInputs: [['"a""b"'], ['"a,b"'], ['"""x"""'], ['plain']] },
  // WS3
  rot13: { ws: 'WS3', kind: 'involution', gen: 'letterText', happy: [[['Hello'], 'Uryyb'], [['abc'], 'nop']], edgeInputs: [['Hello, World!'], ['NOP'], ['m'], ['Zz']] },
  atbash: { ws: 'WS3', kind: 'involution', gen: 'letterText', happy: [[['abc'], 'zyx'], [['Hello'], 'Svool']], edgeInputs: [['az'], ['AZ'], ['m'], ['Hello, World!']] },
  caesarEncode: { ws: 'WS3', kind: 'pair', partner: 'caesarDecode', gen: 'caesarArgs', happy: [[['abc', 3], 'def'], [['xyz', 3], 'abc']], edgeInputs: [['abc', -1], ['ABC', 26], ['Hello, World!', 13], ['a', 27]] },
  caesarDecode: { ws: 'WS3', kind: 'pair', partner: 'caesarEncode', gen: 'caesarArgs', happy: [[['def', 3], 'abc'], [['abc', 3], 'xyz']], edgeInputs: [['def', -1], ['abc', 26], ['Uryyb, Jbeyq!', 13], ['b', 27]] },
  runLengthEncode: { ws: 'WS3', kind: 'pair', partner: 'runLengthDecode', gen: 'nonDigitText', happy: [[['aaab'], '3a1b'], [['abc'], '1a1b1c']], edgeInputs: [['aaaaaaaaaaa'], ['zzzzzzzzzz'], ['a'], ['  ']] },
  runLengthDecode: { ws: 'WS3', kind: 'pair', partner: 'runLengthEncode', gen: 'nonDigitText', happy: [[['3a1b'], 'aaab'], [['1a1b1c'], 'abc']], edgeInputs: [['11a'], ['10z'], ['3a'], ['2 ']] },
  // WS4
  toRoman: { ws: 'WS4', kind: 'pair', partner: 'fromRoman', gen: 'none', happy: [[[4], 'IV'], [[1994], 'MCMXCIV']], edgeInputs: [[9], [40], [90], [400], [900], [3888], [3999], [3000]] },
  fromRoman: { ws: 'WS4', kind: 'pair', partner: 'toRoman', gen: 'none', happy: [[['IV'], 4], [['MCMXCIV'], 1994]], edgeInputs: [['IX'], ['XL'], ['XC'], ['CD'], ['CM'], ['MMMCMXCIX'], ['MMM']] },
  zigzagEncode: { ws: 'WS4', kind: 'pair', partner: 'zigzagDecode', gen: 'signedInt', happy: [[[0], 0], [[-1], 1]], edgeInputs: [[1], [-2], [2], [2147483647], [-2147483648]] },
  zigzagDecode: { ws: 'WS4', kind: 'pair', partner: 'zigzagEncode', gen: 'nonNegInt', happy: [[[0], 0], [[1], -1]], edgeInputs: [[2], [3], [4], [4294967294], [4294967295]] },
  grayEncode: { ws: 'WS4', kind: 'pair', partner: 'grayDecode', gen: 'nonNegInt', happy: [[[0], 0], [[2], 3]], edgeInputs: [[1], [3], [4], [7], [8], [255]] },
  grayDecode: { ws: 'WS4', kind: 'pair', partner: 'grayEncode', gen: 'nonNegInt', happy: [[[3], 2], [[0], 0]], edgeInputs: [[1], [2], [6], [12], [255]] },
  // WS5
  canonicalizeIPv6: { ws: 'WS5', kind: 'canon', gen: 'ipv6In', happy: [[['2001:0DB8:0000:0000:0000:0000:0000:0001'], '2001:db8::1'], [['::1'], '::1']], edgeInputs: [['2001:db8:0:0:1:0:0:1'], ['2001:db8:0:1:1:1:1:1'], ['0:0:0:0:0:0:0:0'], ['1:0:0:2:0:0:0:3'], ['FE80:0:0:0:0:0:0:1']] },
  canonicalizeIPv4: { ws: 'WS5', kind: 'canon', gen: 'ipv4In', happy: [[['192.168.001.001'], '192.168.1.1'], [['10.0.0.1'], '10.0.0.1']], edgeInputs: [['010.0.0.1'], ['00.0.0.0'], ['255.255.255.255'], ['1.02.003.4']] },
  canonicalizeUuid: { ws: 'WS5', kind: 'canon', gen: 'uuidIn', happy: [[['F81D4FAE-7DEC-11D0-A765-00A0C91E6BF6'], 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6'], [['00000000-0000-0000-0000-000000000000'], '00000000-0000-0000-0000-000000000000']], edgeInputs: [['ABCDEF12-3456-7890-ABCD-EF1234567890'], ['ffffffff-ffff-ffff-ffff-ffffffffffff']] },
  canonicalizeHexColor: { ws: 'WS5', kind: 'canon', gen: 'hexColorIn', happy: [[['#ABC'], '#aabbcc'], [['#FF0000'], '#ff0000']], edgeInputs: [['#abcd'], ['#AABBCCDD'], ['#000'], ['#123456']] },
  canonicalizeInteger: { ws: 'WS5', kind: 'canon', gen: 'intStrIn', happy: [[['007'], '7'], [['-0'], '0']], edgeInputs: [['+42'], ['-007'], ['000'], ['+0'], ['-100']] },
  collapseWhitespace: { ws: 'WS5', kind: 'canon', gen: 'wsIn', happy: [[['a  b'], 'a b'], [['  x\ty  '], 'x y']], edgeInputs: [['a\t\tb'], ['   '], ['nochange'], [' lead']] },
  normalizeNewlines: { ws: 'WS5', kind: 'canon', gen: 'nlIn', happy: [[['a\r\nb'], 'a\nb'], [['a\rb'], 'a\nb']], edgeInputs: [['\r\n\r\n'], ['x\r\ny\rz\n'], ['a\nb'], ['\r']] },
  // WS6
  slugify: { ws: 'WS6', kind: 'fmt', gen: 'none', happy: [[['Hello, World!'], 'hello-world'], [['  Foo_Bar  '], 'foo-bar']], edgeInputs: [['a&b'], ['---'], ['100% pure'], ['UPPER lower'], ['a__b--c']] },
  titleCase: { ws: 'WS6', kind: 'fmt', gen: 'none', happy: [[['the lord of the rings'], 'The Lord of the Rings'], [['a tale of two cities'], 'A Tale of Two Cities']], edgeInputs: [['what are you waiting for'], ['to be or not to be'], ['the cat in the hat']] },
  ordinal: { ws: 'WS6', kind: 'fmt', gen: 'none', happy: [[[1], '1st'], [[2], '2nd']], edgeInputs: [[11], [12], [13], [21], [111], [113], [0], [101]] },
  formatThousands: { ws: 'WS6', kind: 'fmt', gen: 'none', happy: [[[1000], '1,000'], [[-1234567], '-1,234,567']], edgeInputs: [[0], [999], [1000000], [-100], [12345]] },
  formatDuration: { ws: 'WS6', kind: 'fmt', gen: 'none', happy: [[[3661], '1h01m01s'], [[0], '0h00m00s']], edgeInputs: [[90061], [59], [3600], [86399], [3599]] },
  padCenter: { ws: 'WS6', kind: 'fmt', gen: 'none', happy: [[['ab', 6, '*'], '**ab**'], [['x', 4, '-'], '-x--']], edgeInputs: [['ab', 5, '*'], ['abc', 2, '*'], ['', 4, '-'], ['ab', 3, '.']] },
  zeroPad: { ws: 'WS6', kind: 'fmt', gen: 'none', happy: [[[7, 4], '0007'], [[-7, 4], '-007']], edgeInputs: [[42, 2], [-1, 1], [0, 3], [123, 2], [-42, 5]] },
};

export const EXPORT_NAMES = Object.keys(CFG);
