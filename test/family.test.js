'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateMSequence } = require('../src/msequence');
const { generateGoldFamily } = require('../src/family');
const { periodicCorrelation, cyclicShift } = require('../src/correlation');

test('Gold family has N + 2 members: a, b and a * T^k b', () => {
  const a = generateMSequence(0o211, 7);
  const b = generateMSequence(0o217, 7);
  const N = a.length;
  const members = generateGoldFamily(a, b);
  assert.equal(members.length, N + 2);
  assert.deepEqual([...members[0]], [...a]);
  assert.deepEqual([...members[1]], [...b]);
  // member 2 + k equals a * T^k b chip by chip
  const k = 5;
  const shiftedB = cyclicShift(b, k);
  for (let i = 0; i < N; i++) {
    assert.equal(members[2 + k][i], a[i] * shiftedB[i]);
  }
});

test('every family member is a +/-1 code with zero-shift autocorrelation N', () => {
  const a = generateMSequence(0o211, 7);
  const b = generateMSequence(0o217, 7);
  const members = generateGoldFamily(a, b);
  for (const m of members) {
    for (const chip of m) assert.ok(chip === 1 || chip === -1);
    assert.equal(periodicCorrelation(m, m, 0), 127);
  }
});

test('unbalanced members exist and are kept (no Hamming-weight ruler)', () => {
  const a = generateMSequence(0o211, 7);
  const b = generateMSequence(0o217, 7);
  const members = generateGoldFamily(a, b);
  const dcValues = new Set(members.map((m) => m.reduce((s, c) => s + c, 0)));
  // Gold families at n=7 contain members with DC in {+/-1, +/-15, +/-17};
  // the audit must not condemn them for it.
  assert.ok(dcValues.size > 1);
});
