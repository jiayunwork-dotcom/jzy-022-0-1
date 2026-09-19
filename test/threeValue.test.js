'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { threeValueSet, isInThreeValueSet } = require('../src/threeValue');

test('three-value set is {-1, -1 +/- 2^((n+1)/2)} for odd n', () => {
  assert.deepEqual(threeValueSet(5), [-9, -1, 7]); // 2^3 = 8
  assert.deepEqual(threeValueSet(7), [-17, -1, 15]); // 2^4 = 16
  assert.deepEqual(threeValueSet(9), [-33, -1, 31]); // 2^5 = 32
  assert.deepEqual(threeValueSet(11), [-65, -1, 63]);
  assert.deepEqual(threeValueSet(13), [-129, -1, 127]);
});

test('membership check', () => {
  const set = threeValueSet(7);
  assert.equal(isInThreeValueSet(-17, set), true);
  assert.equal(isInThreeValueSet(-1, set), true);
  assert.equal(isInThreeValueSet(15, set), true);
  assert.equal(isInThreeValueSet(127, set), false);
  assert.equal(isInThreeValueSet(7, set), false);
});
