/**
 * Polynomials over GF(2), represented as BigInt bit masks.
 *
 * Bit i is the coefficient of x^i, so x^3 + x + 1 is
 * (1<<3) | (1<<1) | (1<<0) = 0b1011 = 0xB.
 *
 * Arithmetic is polynomial arithmetic modulo 2: addition/subtraction are XOR.
 */

/** Degree of a non-zero GF(2) polynomial (index of the leading set bit). */
export function degree(p) {
  if (p === 0n) return -1;
  return BigInt(p.toString(2).length - 1);
}

/** Polynomial multiplication over GF(2) (carry-less product). */
export function multiply(a, b) {
  let result = 0n;
  let shift = 0n;
  let x = b;
  while (x !== 0n) {
    if (x & 1n) result ^= a << shift;
    x >>= 1n;
    shift += 1n;
  }
  return result;
}

/**
 * Remainder of dividend modulo divisor over GF(2).
 * Uses long division (schoolbook), XOR-ing the divisor in at each leading bit.
 */
export function mod(dividend, divisor) {
  if (divisor === 0n) throw new Error('modulo zero polynomial');
  const d = degree(divisor);
  let r = dividend;
  let rd = degree(r);
  while (rd >= d) {
    r ^= divisor << (rd - d);
    rd = degree(r);
  }
  return r;
}

/**
 * Power with polynomial modulus: returns base^exp mod m over GF(2).
 * Repeated squaring keeps exponentiation cheap.
 */
export function powMod(base, exp, m) {
  let result = 1n;
  let b = mod(base, m);
  while (exp > 0n) {
    if (exp & 1n) result = mod(multiply(result, b), m);
    b = mod(multiply(b, b), m);
    exp >>= 1n;
  }
  return result;
}

/**
 * Irreducibility test over GF(2) via Rabin's test:
 *   f is irreducible over GF(2) iff
 *     f | x^(2^n) - x  (which over GF(2) is x^(2^n) + x), and
 *     gcd(f, x^(2^(n/q)) - x) = 1 for every prime divisor q of n.
 *
 * `primeDivisors(n)` must be supplied (distinct prime factors of n).
 */
export function isIrreducible(f, n, primeDivisors) {
  // Constant/linear edge cases.
  if (n === 1n) return f === 0b10n || f === 0b11n; // x or x+1
  let xn = powMod(2n, 1n << n, f); // x^(2^n) mod f (2 is the polynomial x)
  // x^(2^n) + x mod f must be 0.
  if (mod(xn ^ 2n, f) !== 0n) return false;
  for (const q of primeDivisors) {
    const xq = powMod(2n, 1n << (n / q), f);
    // gcd(f, x^(2^(n/q)) + x) must be 1.
    if (gcd(f, mod(xq ^ 2n, f)) !== 1n) return false;
  }
  return true;
}

/** Monic Euclidean gcd over GF(2) (normalization is cosmetic in GF(2)). */
export function gcd(a, b) {
  let x = a;
  let y = b;
  while (y !== 0n) {
    [x, y] = [y, mod(x, y)];
  }
  return x;
}

/**
 * Primitivity of a degree-n polynomial over GF(2):
 *   1. irreducible,
 *   2. x has multiplicative order exactly 2^n - 1 in GF(2)[x]/(f),
 *      i.e. x^N = 1 mod f and x^(N/q) != 1 mod f for every prime q | N.
 *
 * Returns { primitive: true } or { primitive: false, reason }.
 */
export function checkPrimitive(f, n) {
  const nBig = BigInt(n);
  if (f === 0n) return { primitive: false, reason: 'zero polynomial' };
  if (degree(f) !== nBig) {
    return { primitive: false, reason: `degree is ${degree(f)}, expected ${n}` };
  }
  if ((f & 1n) !== 1n) {
    return { primitive: false, reason: 'constant term is 0 (divisible by x)' };
  }
  if (((f >> nBig) & 1n) !== 1n) {
    return { primitive: false, reason: `leading coefficient at x^${n} missing` };
  }

  const primesN = distinctPrimeFactors(nBig);
  if (!isIrreducible(f, nBig, primesN)) {
    return { primitive: false, reason: 'reducible over GF(2)' };
  }

  // Order check for a primitive polynomial.
  const N = (1n << nBig) - 1n;
  if (powMod(2n, N, f) !== 1n) {
    return { primitive: false, reason: `x^(2^${n}-1) != 1 mod f` };
  }
  for (const q of distinctPrimeFactors(N)) {
    if (powMod(2n, N / q, f) === 1n) {
      return {
        primitive: false,
        reason: `order divides (2^${n}-1)/${q}, so x is not a primitive element`,
      };
    }
  }
  return { primitive: true };
}

/** Distinct prime factors of a positive integer (BigInt), via trial division. */
export function distinctPrimeFactors(value) {
  let v = value;
  const factors = [];
  const consider = (p) => {
    if (v % p === 0n) {
      factors.push(p);
      while (v % p === 0n) v /= p;
    }
  };
  consider(2n);
  for (let p = 3n; p * p <= v; p += 2n) consider(p);
  if (v > 1n) factors.push(v);
  return factors;
}
