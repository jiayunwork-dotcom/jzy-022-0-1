'use strict';

/**
 * GF(2) polynomial arithmetic on bitmasks.
 *
 * A polynomial p(x) = sum c_i x^i over GF(2) is stored as a non-negative
 * integer whose bit i is c_i. Degree stays well below 2^31 for every degree
 * this service supports (n <= 13), so plain 32-bit integer ops are exact.
 */

/** Degree of a non-zero polynomial bitmask (-1 for zero). */
function polyDeg(p) {
  return 31 - Math.clz32(p);
}

/** a mod p over GF(2). */
function polyMod(a, p) {
  const dp = polyDeg(p);
  let da = polyDeg(a);
  while (da >= dp) {
    a ^= p << (da - dp);
    da = polyDeg(a);
  }
  return a;
}

/** (a * b) mod p over GF(2), with a, b already reduced mod p. */
function polyMulMod(a, b, p) {
  const dp = polyDeg(p);
  let result = 0;
  let aa = a;
  let bb = b;
  while (bb !== 0) {
    if (bb & 1) result ^= aa;
    bb >>>= 1;
    aa <<= 1;
    if (polyDeg(aa) >= dp) aa = polyMod(aa, p);
  }
  return result;
}

/** (base^exp) mod p over GF(2), square-and-multiply. */
function polyPowMod(base, exp, p) {
  let result = 1;
  let b = polyMod(base, p);
  let e = exp;
  while (e > 0) {
    if (e & 1) result = polyMulMod(result, b, p);
    e >>>= 1;
    if (e > 0) b = polyMulMod(b, b, p);
  }
  return result;
}

/** Distinct prime factors of m (trial division; m <= 2^13 - 1 here). */
function primeFactors(m) {
  const factors = [];
  let rest = m;
  for (let d = 2; d * d <= rest; d++) {
    if (rest % d === 0) {
      factors.push(d);
      while (rest % d === 0) rest /= d;
    }
  }
  if (rest > 1) factors.push(rest);
  return factors;
}

/**
 * Primitivity test for a degree-n polynomial over GF(2).
 *
 * p is primitive iff x has multiplicative order exactly N = 2^n - 1 modulo
 * p, i.e. x^N === 1 (mod p) and x^(N/q) !== 1 (mod p) for every prime q | N.
 * If x attains the maximal order N then p must be irreducible (the unit
 * group of GF(2)[x]/(p) would otherwise be smaller than N), so this single
 * order check is a complete primitivity test.
 */
function isPrimitive(polyMask, n) {
  if (!Number.isInteger(polyMask) || polyMask <= 0) return false;
  if (polyDeg(polyMask) !== n) return false;
  if ((polyMask & 1) === 0) return false; // divisible by x
  const N = 2 ** n - 1;
  if (polyPowMod(2, N, polyMask) !== 1) return false;
  for (const q of primeFactors(N)) {
    if (polyPowMod(2, N / q, polyMask) === 1) return false;
  }
  return true;
}

module.exports = { polyDeg, polyMod, polyMulMod, polyPowMod, primeFactors, isPrimitive };
