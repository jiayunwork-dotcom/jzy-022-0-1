'use strict';

/**
 * Gold family generation.
 *
 * Given the ±1 chips of two m-sequences a and b of period N, the Gold family
 * is the N + 2 sequences
 *   a,  b,  a * T^k b   for k = 0 .. N-1
 * where T^k b is b cyclically shifted by k and "*" is chip-by-chip
 * multiplication (equivalently XOR in the 0/1 domain, mapped back to ±1).
 *
 * Member layout: index 0 = a, index 1 = b, index 2 + k = a * T^k b.
 */
function generateGoldFamily(chipsA, chipsB) {
  const N = chipsA.length;
  const members = new Array(N + 2);
  members[0] = chipsA;
  members[1] = chipsB;
  for (let k = 0; k < N; k++) {
    const member = new Int8Array(N);
    let j = k;
    for (let i = 0; i < N; i++) {
      member[i] = chipsA[i] * chipsB[j];
      if (++j === N) j = 0;
    }
    members[2 + k] = member;
  }
  return members;
}

module.exports = { generateGoldFamily };
