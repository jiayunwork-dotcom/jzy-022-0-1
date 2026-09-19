import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { threeValueSet } from '../src/threeValue.js';

describe('three-value set', () => {
  test('n=7 pins {-1, 15, -17} with t=16', () => {
    const s = threeValueSet(7);
    assert.equal(s.t, 16);
    assert.deepEqual([...s.values].sort((a, b) => a - b), [-17, -1, 15]);
  });

  test('n=9 and n=11 formulas', () => {
    assert.deepEqual([...threeValueSet(9).values].sort((a, b) => a - b), [-33, -1, 31]);
    assert.deepEqual([...threeValueSet(11).values].sort((a, b) => a - b), [-65, -1, 63]);
  });
});
