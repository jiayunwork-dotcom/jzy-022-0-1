/**
 * Periodic (circular) correlation of bipolar ±1 sequences.
 *
 * For two length-N chips sequences a, b the periodic cross-correlation at
 * shift k is, over one FULL period,
 *
 *   C_ab(k) = sum_{i=0}^{N-1} a[i] * b[(i+k) mod N].
 *
 * No truncation: the index always wraps, so this is the periodic — not the
 * linear — correlation. Truncating to the overlap region would smear the
 * sidelobe set and must never be used here.
 *
 * Performance: chips are packed one-per-bit (chip -1 -> bit 1, chip +1 -> 0).
 * For equal-length words, a[i]*b[i] = 1 - 2*(aBit XOR bBit), hence
 *
 *   C_ab(k) = N - 2 * popcount( pack(a) XOR rotateRight(pack(b), k) )
 *
 * where the bit rotation performs the cyclic chip shift. All N rotations of
 * each family member are precomputed once (N BigInts, tiny at the supported
 * n), so the pairwise pass only does XOR + popcount.
 */

/** Pack +1/-1 chips into a BigInt: -1 becomes a set bit, +1 a clear bit. */
export function packChips(chips) {
  let bits = 0n;
  for (let i = 0; i < chips.length; i += 1) {
    if (chips[i] === -1) bits |= 1n << BigInt(i);
  }
  return bits;
}

const POPCOUNT_TABLE = (() => {
  const table = new Uint16Array(65536);
  for (let x = 1; x < 65536; x += 1) {
    table[x] = table[x >> 1] + (x & 1);
  }
  return table;
})();

/** Number of set bits in a BigInt, using a 16-bit lookup table. */
export function popcountBigInt(bits) {
  let count = 0;
  let x = bits;
  while (x !== 0n) {
    count += POPCOUNT_TABLE[Number(x & 65535n)];
    x >>= 16n;
  }
  return count;
}

/** Cyclic right rotation of a width-N bit word by k positions. */
export function rotateRightBits(bits, k, N) {
  const shift = ((k % N) + N) % N;
  if (shift === 0) return bits;
  const s = BigInt(shift);
  const w = BigInt(N);
  const mask = (1n << w) - 1n;
  return ((bits >> s) | (bits << (w - s))) & mask;
}

/**
 * Precomputed table of all N cyclic right rotations of one packed sequence.
 * rotation(k) is the packed b with chip at position (i+k) aligned to bit i.
 */
export class RotationTable {
  constructor(chips) {
    this.N = chips.length;
    this.bits = packChips(chips);
    this._rotations = null;
  }

  /** Materialize rotations lazily; shared across every pairing of a member. */
  rotations() {
    if (this._rotations === null) {
      const { N, bits } = this;
      const rot = new Array(N);
      rot[0] = bits;
      for (let k = 1; k < N; k += 1) {
        rot[k] = rotateRightBits(bits, k, N);
      }
      this._rotations = rot;
    }
    return this._rotations;
  }
}

/**
 * Full periodic correlation vector C_ab(k) for k = 0..N-1.
 * `tableA` is only needed for its bits; tableB supplies all rotations.
 */
export function crossCorrelationVector(tableA, tableB) {
  const { N } = tableA;
  const a = tableA.bits;
  const rotationsB = tableB.rotations();
  const out = new Int32Array(N);
  for (let k = 0; k < N; k += 1) {
    out[k] = N - 2 * popcountBigInt(a ^ rotationsB[k]);
  }
  return out;
}

/**
 * Periodic autocorrelation vector for k = 0..N-1.
 * Real-sequence symmetry C(k) = C(N-k) lets us compute half the shifts;
 * the full vector is returned for shift-wise reporting.
 */
export function autoCorrelationVector(table) {
  const { N, bits } = table;
  const rotations = table.rotations();
  const out = new Int32Array(N);
  out[0] = N;
  const half = N >> 1;
  for (let k = 1; k <= half; k += 1) {
    const value = N - 2 * popcountBigInt(bits ^ rotations[k]);
    out[k] = value;
    out[N - k] = value;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Scalar reference implementations: slow but obviously correct, used */
/* by tests to cross-check the packed-bit engine.                     */
/* ------------------------------------------------------------------ */

export function scalarPeriodicCorrelation(a, b, shift) {
  const N = a.length;
  const k = ((shift % N) + N) % N;
  let sum = 0;
  for (let i = 0; i < N; i += 1) {
    sum += a[i] * b[(i + k) % N];
  }
  return sum;
}

export function scalarCorrelationVector(a, b) {
  const N = a.length;
  const out = new Int32Array(N);
  for (let k = 0; k < N; k += 1) out[k] = scalarPeriodicCorrelation(a, b, k);
  return out;
}
