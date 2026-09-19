'use strict';

/**
 * Periodic (cyclic) correlation over ±1 chip sequences.
 *
 * The periodic cross-correlation of x and y at shift k is
 *   C(x, y, k) = sum_{i=0}^{N-1} x[i] * y[(i + k) mod N]
 * i.e. the sum runs over the whole period with wrap-around. A truncated
 * linear correlation is NOT a substitute: it would not reproduce the
 * three-valued sidelobe set of a Gold family.
 */

function periodicCorrelation(x, y, shift) {
  const n = x.length;
  let sum = 0;
  let j = shift % n;
  for (let i = 0; i < n; i++) {
    sum += x[i] * y[j];
    if (++j === n) j = 0;
  }
  return sum;
}

/** Full periodic autocorrelation table, shifts 0 .. N-1. */
function fullAutoCorrelation(x) {
  const n = x.length;
  const out = new Array(n);
  for (let s = 0; s < n; s++) out[s] = periodicCorrelation(x, x, s);
  return out;
}

/** Full periodic cross-correlation table, shifts 0 .. N-1. */
function fullCrossCorrelation(x, y) {
  const n = x.length;
  const out = new Array(n);
  for (let s = 0; s < n; s++) out[s] = periodicCorrelation(x, y, s);
  return out;
}

/** Cyclic shift by k positions: out[i] = seq[(i + k) mod N]. */
function cyclicShift(seq, k) {
  const n = seq.length;
  const out = new Int8Array(n);
  let j = ((k % n) + n) % n;
  for (let i = 0; i < n; i++) {
    out[i] = seq[j];
    if (++j === n) j = 0;
  }
  return out;
}

/** Polarity inversion: every chip multiplied by -1. */
function invertPolarity(seq) {
  const out = new Int8Array(seq.length);
  for (let i = 0; i < seq.length; i++) out[i] = -seq[i];
  return out;
}

module.exports = {
  periodicCorrelation,
  fullAutoCorrelation,
  fullCrossCorrelation,
  cyclicShift,
  invertPolarity,
};
