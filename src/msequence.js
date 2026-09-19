'use strict';

/**
 * m-sequence generation from a primitive degree-n polynomial.
 *
 * Fibonacci LFSR whose characteristic polynomial is
 *   p(x) = x^n + c_{n-1} x^{n-1} + ... + c_1 x + c_0   (c_0 = 1)
 * giving the recurrence  s_t = sum_{i=0}^{n-1} c_i * s_{t-n+i}  over GF(2).
 *
 * The register is seeded with the fixed non-zero state 1; any other non-zero
 * seed only cyclically shifts the same m-sequence, which leaves both the
 * generated Gold family (as a set of correlation properties) and every
 * audit result unchanged.
 */

/** Raw 0/1 bits of the m-sequence, one full period N = 2^n - 1. */
function generateMSequenceBits(polyMask, n) {
  const N = 2 ** n - 1;
  const taps = polyMask & ((1 << n) - 1); // c_0 .. c_{n-1}
  let state = 1;
  const bits = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    bits[i] = state & 1;
    // feedback = parity(state & taps)
    let x = state & taps;
    x ^= x >>> 16;
    x ^= x >>> 8;
    x ^= x >>> 4;
    x ^= x >>> 2;
    x ^= x >>> 1;
    const feedback = x & 1;
    state = (state >>> 1) | (feedback << (n - 1));
  }
  return bits;
}

/** ±1 chips of the m-sequence: bit 0 -> +1, bit 1 -> -1. */
function generateMSequence(polyMask, n) {
  const bits = generateMSequenceBits(polyMask, n);
  const chips = new Int8Array(bits.length);
  for (let i = 0; i < bits.length; i++) {
    chips[i] = bits[i] === 0 ? 1 : -1;
  }
  return chips;
}

module.exports = { generateMSequenceBits, generateMSequence };
