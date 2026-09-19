'use strict';

/**
 * Development tool: finds preferred pairs for each supported odd degree n
 * using Gold decimations d = 2^k + 1 (gcd(k, n) = 1). The decimated
 * m-sequence's minimal polynomial is recovered with Berlekamp-Massey, and
 * every candidate is verified empirically against the three-value set.
 *
 * Usage: node scripts/find-preferred-pairs.js
 */

const { isPrimitive } = require('../src/gf2');
const { generateMSequenceBits, generateMSequence } = require('../src/msequence');
const { checkPreferredPair } = require('../src/preferredPair');

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Berlekamp-Massey over GF(2): shortest linear recurrence for bits. */
function berlekampMassey(bits) {
  let C = [1];
  let B = [1];
  let L = 0;
  let m = 1;
  for (let n = 0; n < bits.length; n++) {
    let d = bits[n];
    for (let i = 1; i <= L; i++) d ^= (C[i] || 0) & bits[n - i];
    if (d === 1) {
      const T = C.slice();
      while (C.length < B.length + m) C.push(0);
      for (let i = 0; i < B.length; i++) C[i + m] ^= B[i];
      if (2 * L <= n) {
        L = n + 1 - L;
        B = T;
        m = 1;
      } else {
        m++;
      }
    } else {
      m++;
    }
  }
  return { C, L };
}

/** Connection polynomial C from BM -> characteristic polynomial bitmask. */
function connectionToPoly(C, L) {
  // recurrence s_t = sum_{i=1..L} C[i] s_{t-i}  <=>  p(x) = x^L + sum_i C[i] x^{L-i}
  let mask = 1 << L;
  for (let i = 1; i <= L; i++) {
    if (C[i]) mask |= 1 << (L - i);
  }
  return mask;
}

function firstPrimitivePoly(n) {
  for (let mask = (1 << n) | 1; mask < 1 << (n + 1); mask += 2) {
    if (isPrimitive(mask, n)) return mask;
  }
  throw new Error(`no primitive polynomial of degree ${n}?`);
}

function allPrimitivePolys(n) {
  const out = [];
  for (let mask = (1 << n) | 1; mask < 1 << (n + 1); mask += 2) {
    if (isPrimitive(mask, n)) out.push(mask);
  }
  return out;
}

function findPreferredPair(n) {
  const N = 2 ** n - 1;
  const p1 = firstPrimitivePoly(n);
  const bitsA = generateMSequenceBits(p1, n);
  for (let k = 1; k < n; k++) {
    if (gcd(k, n) !== 1) continue;
    const d = 2 ** k + 1;
    if (gcd(d, N) !== 1) continue;
    const decimated = new Uint8Array(N);
    for (let i = 0; i < N; i++) decimated[i] = bitsA[(d * i) % N];
    const { C, L } = berlekampMassey(Array.from(decimated.slice(0, 2 * n + 2)));
    if (L !== n) continue;
    const p2 = connectionToPoly(C, n);
    if (p2 === p1 || !isPrimitive(p2, n)) continue;
    const gate = checkPreferredPair(generateMSequence(p1, n), generateMSequence(p2, n), n);
    if (gate.preferred) return { p1, p2, decimation: d };
  }
  throw new Error(`no preferred pair found for n=${n}`);
}

function findNonPreferredPair(n) {
  const polys = allPrimitivePolys(n);
  const p1 = polys[0];
  const chipsA = generateMSequence(p1, n);
  for (let i = 1; i < polys.length; i++) {
    const gate = checkPreferredPair(chipsA, generateMSequence(polys[i], n), n);
    if (!gate.preferred) return { p1, p2: polys[i] };
  }
  throw new Error(`all pairs preferred for n=${n}?`);
}

const oct = (m) => m.toString(8);

for (const n of [5, 7, 9, 11, 13]) {
  const { p1, p2, decimation } = findPreferredPair(n);
  console.log(`n=${n}: preferred pair octal ${oct(p1)} / ${oct(p2)} (decimation ${decimation})`);
}

// Classic n=7 pair from Gold's tables.
const gate217 = checkPreferredPair(generateMSequence(0o211, 7), generateMSequence(0o217, 7), 7);
console.log(`n=7 classic 211/217 octal preferred: ${gate217.preferred}`);

// A distinct non-preferred pair at n=7 (for rejection tests).
const bad = findNonPreferredPair(7);
console.log(`n=7 non-preferred pair: octal ${oct(bad.p1)} / ${oct(bad.p2)}`);
