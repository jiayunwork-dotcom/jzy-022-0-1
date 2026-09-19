'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  periodicCorrelation,
  fullAutoCorrelation,
  cyclicShift,
  invertPolarity,
} = require('../src/correlation');
const { generateMSequence } = require('../src/msequence');

test('correlation wraps around the period (no truncated linear correlation)', () => {
  const x = Int8Array.from([1, -1, 1]);
  const y = Int8Array.from([1, 1, -1]);
  // periodic at shift 1: x0*y1 + x1*y2 + x2*y0 = 1 + 1 + 1 = 3
  assert.equal(periodicCorrelation(x, y, 1), 3);
  // a truncated linear correlation would drop the wrapped term and give 2
});

test('m-sequence autocorrelation is two-valued: N at zero shift, -1 elsewhere', () => {
  const a = generateMSequence(0o211, 7);
  const N = a.length;
  const auto = fullAutoCorrelation(a);
  assert.equal(auto[0], N);
  for (let s = 1; s < N; s++) assert.equal(auto[s], -1);
});

test('polarity inversion leaves the autocorrelation sequence unchanged', () => {
  const a = generateMSequence(0o217, 7);
  const neg = invertPolarity(a);
  assert.deepEqual(fullAutoCorrelation(neg), fullAutoCorrelation(a));
});

test('cyclic shift only rotates the autocorrelation; the value set is unchanged', () => {
  const a = generateMSequence(0o211, 7);
  const shifted = cyclicShift(a, 37);
  const setOf = (arr) => [...new Set(arr)].sort((p, q) => p - q);
  assert.deepEqual(setOf(fullAutoCorrelation(shifted)), setOf(fullAutoCorrelation(a)));
});

test('zero-shift autocorrelation equals N for any +/-1 code', () => {
  const a = generateMSequence(0o211, 7);
  assert.equal(periodicCorrelation(a, a, 0), 127);
});
