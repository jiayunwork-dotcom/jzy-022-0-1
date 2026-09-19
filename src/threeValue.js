/**
 * The Gold three-value sidelobe set, pinned by degree n.
 *
 * For odd n define t = 2^((n+1)/2). Every non-zero-shift periodic
 * autocorrelation sidelobe, and every periodic cross-correlation between
 * distinct Gold family members, must be one of exactly:
 *
 *     -1,  t - 1,  -t - 1
 *
 * (e.g. n = 7: t = 16 -> { -1, 15, -17 }, code length N = 127).
 *
 * Even n has no three-value Gold bound under this convention and the service
 * rejects it before any code generation happens.
 */
export function threeValueSet(n) {
  if (!Number.isInteger(n)) throw new TypeError(`n must be an integer, got ${n}`);
  const k = (n + 1) / 2;
  const t = 2 ** k;
  return {
    n,
    t,
    k,
    values: [-1, t - 1, -t - 1],
    // Formula spelled out in the result so output and implementation agree.
    formula: {
      t: 't = 2^((n+1)/2)',
      set: '{ -1, t - 1, -t - 1 }',
    },
  };
}
