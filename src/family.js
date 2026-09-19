/**
 * Gold code family generation.
 *
 * For a preferred pair of m-sequences a, b of period N = 2^n - 1, the Gold
 * family is the set of N + 2 bipolar sequences:
 *
 *   { a, b,  a * T^k b   for k = 0 .. N-1 }
 *
 * where T^k b is b cyclically shifted by k and '*' is chipwise multiplication.
 * Since chips are +1/-1 images of GF(2) bits (chip = (-1)^bit), chipwise
 * multiplication is exactly XOR in the 0/1 domain followed by remapping.
 *
 * The two m-sequences themselves are members too. Negating one m-sequence does
 * not produce a shift of it (an m-sequence contains 2^(n-1) ones, its
 * complement 2^(n-1)-1, so it is not a cyclic shift), which is why the family
 * is N+2, not 2N+2; the negation-only property used in reconciliation is
 * polarity invariance of correlation, tested separately.
 */
import { generateMSequence, multiplyChips, rotateChips } from './msequence.js';

/**
 * @param {bigint} polyA primitive polynomial mask for m-sequence a
 * @param {bigint} polyB primitive polynomial mask for m-sequence b
 * @param {number} n
 * @returns {{ n:number, N:number, members: Int8Array[], memberNames:string[] }}
 */
export function generateGoldFamily(polyA, polyB, n) {
  const N = 2 ** n - 1;
  const a = generateMSequence(polyA, n);
  const b = generateMSequence(polyB, n);

  const members = new Array(N + 2);
  const memberNames = new Array(N + 2);

  members[0] = a;
  memberNames[0] = 'm_a';
  members[1] = b;
  memberNames[1] = 'm_b';

  for (let k = 0; k < N; k += 1) {
    members[k + 2] = multiplyChips(a, rotateChips(b, k));
    memberNames[k + 2] = `a*xor_shift_b(k=${k})`;
  }

  return { n, N, members, memberNames };
}
