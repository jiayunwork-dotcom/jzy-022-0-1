/**
 * Preferred-pair判定.
 *
 * Two m-sequences a, b of period N = 2^n - 1 (n odd) form a Gold preferred
 * pair iff the full-period cross-correlation, over ALL relative shifts, takes
 * values only in the three-value set
 *
 *   { -1, t - 1, -t - 1 },  where t = 2^((n+1)/2),
 *
 * and — for the canonical maximal cross-correlation definition — each of the
 * three values actually occurs. Equality of the observed value set with the
 * pinned three-value set is exactly the判定 used here. It is computed from the
 * sequences rather than assumed, because two primitive polynomials do not
 * automatically sit in the preferred decimation classes.
 *
 * Note this is NOT the two-value m-sequence autocorrelation rule ({N, -1}):
 * applied to preferred-pair cross-correlation that rule would reject every
 * genuine Gold pair.
 */
import { RotationTable, crossCorrelationVector } from './correlation.js';
import { threeValueSet } from './threeValue.js';

/**
 * @returns {{isPreferred: boolean, values: number[], vector: Int32Array,
 *            expected: number[]}}
 */
export function evaluatePreferredPair(chipsA, chipsB, n) {
  const expected = threeValueSet(n).values;
  const vector = crossCorrelationVector(
    new RotationTable(chipsA),
    new RotationTable(chipsB)
  );
  const observed = new Set();
  for (let k = 0; k < vector.length; k += 1) observed.add(vector[k]);

  const values = [...observed].sort((x, y) => x - y);
  const isPreferred =
    observed.size === expected.length &&
    expected.every((v) => observed.has(v));

  return { isPreferred, values, vector, expected };
}
