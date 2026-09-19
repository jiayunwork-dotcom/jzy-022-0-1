'use strict';

const { fullCrossCorrelation } = require('./correlation');
const { threeValueSet, isInThreeValueSet } = require('./threeValue');

/**
 * Preferred-pair determination.
 *
 * Two m-sequences form a preferred pair iff their periodic cross-correlation
 * takes only the three values {-1, -1 + t, -1 - t} with t = 2^((n+1)/2).
 * The check is empirical and exact: the full cross-correlation table over
 * all N shifts is computed and compared against the three-value set.
 *
 * By the shift-and-add property of m-sequences, every autocorrelation and
 * cross-correlation of the whole Gold family reduces to a value of this
 * same base table (or to the m-sequence two-valued autocorrelation), so
 * this check is also the decisive gate for the entire family.
 */
function checkPreferredPair(chipsA, chipsB, n) {
  const set = threeValueSet(n);
  const table = fullCrossCorrelation(chipsA, chipsB);
  const violations = [];
  for (let shift = 0; shift < table.length; shift++) {
    if (!isInThreeValueSet(table[shift], set)) {
      violations.push({ shift, value: table[shift] });
    }
  }
  return { preferred: violations.length === 0, table, violations };
}

module.exports = { checkPreferredPair };
