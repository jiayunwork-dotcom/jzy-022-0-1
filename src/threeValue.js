'use strict';

/**
 * The three-valued correlation bound for Gold families at odd degree n.
 *
 * With t = 2^((n+1)/2), every non-zero-shift autocorrelation and every
 * cross-correlation of a Gold family built from a preferred pair takes its
 * values in
 *   { -1,  -1 + t,  -1 - t }.
 *
 * This is NOT the two-valued {-1} ideal of a lone m-sequence: applying the
 * m-sequence standard to a Gold family would condemn the whole family.
 */

function threeValueSet(n) {
  const t = 2 ** ((n + 1) / 2);
  return [-1 - t, -1, t - 1];
}

function threeValueFormula(n) {
  return `{-1, -1 + 2^((n+1)/2), -1 - 2^((n+1)/2)} with n=${n}`;
}

function isInThreeValueSet(value, set) {
  return value === set[0] || value === set[1] || value === set[2];
}

module.exports = { threeValueSet, threeValueFormula, isInThreeValueSet };
