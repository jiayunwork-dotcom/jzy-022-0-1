import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileMasks, reconcileInput } from '../src/reconcile.js';
import { getPreset } from '../src/presets.js';
import { generateGoldFamily } from '../src/family.js';
import {
  RotationTable,
  autoCorrelationVector,
  crossCorrelationVector,
} from '../src/correlation.js';
import { negateChips, rotateChips } from '../src/msequence.js';
import { ServiceError } from '../src/errors.js';

const expectReject = (fn, code) => {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof ServiceError, `expected ServiceError got ${err}`);
    assert.equal(err.code, code, `expected code ${code} got ${err.code}`);
    return true;
  });
};

describe('demo preset full reconciliation', () => {
  test('N=127, three-value set {-1,15,-17}, qualified, zero shift = N', () => {
    const p = getPreset('gold-n7-demo');
    const r = reconcileMasks({ n: 7, polyA: p.polyA, polyB: p.polyB, source: 'preset:gold-n7-demo' });
    assert.equal(r.N, 127);
    assert.equal(r.codeLength, 127);
    assert.deepEqual(r.threeValueSet.values, [-1, 15, -17]);
    assert.equal(r.threeValueSet.t, 16);
    assert.equal(r.audit.zeroShiftValue, 127);
    assert.equal(r.audit.zeroShiftEqualsNForAllMembers, true);
    assert.equal(r.audit.outOfRangeShifts.length, 0);
    assert.equal(r.qualified, true);
    assert.equal(r.family.size, 129); // N + 2
  });

  test('zero-shift autocorrelation equals N for every family member', () => {
    const family = generateGoldFamily(0x89n, 0x8fn, 7);
    for (const member of family.members) {
      const vec = autoCorrelationVector(new RotationTable(member));
      assert.equal(vec[0], 127);
    }
  });
});

describe('Gold family ruler invariances', () => {
  const family = generateGoldFamily(0x89n, 0x8fn, 7);
  const allowed = new Set([-1, 15, -17]);

  test('all non-zero autocorrelation sidelobes lie in the three-value set', () => {
    for (const member of family.members) {
      const vec = autoCorrelationVector(new RotationTable(member));
      for (let k = 1; k < 127; k += 1) {
        assert.ok(allowed.has(vec[k]), `sidelobe ${vec[k]} at k=${k}`);
      }
    }
  });

  test('every distinct member pair cross-correlation lies in the set', () => {
    const tables = family.members.map((m) => new RotationTable(m));
    // Exhaustive check is done in reconcile; here sample broad coverage.
    for (let i = 0; i < family.members.length; i += 8) {
      for (let j = i + 3; j < family.members.length; j += 11) {
        const vec = crossCorrelationVector(tables[i], tables[j]);
        for (let k = 0; k < 127; k += 1) {
          assert.ok(allowed.has(vec[k]), `(${i},${j}) k=${k} value ${vec[k]}`);
        }
      }
    }
  });

  test('negating every chip of a member leaves autocorrelation sequence identical', () => {
    const member = family.members[50];
    const v1 = autoCorrelationVector(new RotationTable(member));
    const v2 = autoCorrelationVector(new RotationTable(negateChips(member)));
    for (let k = 0; k < 127; k += 1) assert.equal(v1[k], v2[k]);
  });

  test('cyclic shift of a member only rotates its autocorrelation, value set unchanged', () => {
    const member = family.members[50];
    const v1 = new Set(autoCorrelationVector(new RotationTable(member)));
    const v2 = new Set(autoCorrelationVector(new RotationTable(rotateChips(member, 63))));
    assert.deepEqual([...v1].sort((a, b) => a - b), [...v2].sort((a, b) => a - b));
  });

  test('cross-correlation with another pair of family members still in the same set', () => {
    const tables = family.members.map((m) => new RotationTable(m));
    const vec = crossCorrelationVector(tables[10], tables[120]);
    for (let k = 0; k < 127; k += 1) assert.ok(allowed.has(vec[k]));
  });
});

describe('rejections happen before generation', () => {
  test('even n is rejected (EVEN_DEGREE)', () => {
    expectReject(() => reconcileInput({ n: 8, polynomialA: '0x11d', polynomialB: '0x171' }), 'EVEN_DEGREE');
  });

  test('n out of hard bounds (DEGREE_OUT_OF_RANGE)', () => {
    // Degree gate fires before polynomials are parsed/checked.
    expectReject(() => reconcileInput({ n: 5, polynomialA: 'x', polynomialB: 'x' }), 'DEGREE_OUT_OF_RANGE');
    expectReject(() => reconcileInput({ n: 9, polynomialA: 'x', polynomialB: 'x' }), 'DEGREE_OUT_OF_RANGE');
    expectReject(() => reconcileInput({ n: 13, polynomialA: 'x', polynomialB: 'x' }), 'DEGREE_OUT_OF_RANGE');
  });

  test('empty polynomial rejected (EMPTY_POLYNOMIAL)', () => {
    expectReject(() => reconcileInput({ n: 7, polynomialA: '', polynomialB: '0x8f' }), 'EMPTY_POLYNOMIAL');
  });

  test('reducible polynomial rejected (NOT_PRIMITIVE)', () => {
    // 0xC5 = (x+1)(x^6+x+1), reducible; degree is still 7.
    expectReject(() => reconcileInput({ n: 7, polynomialA: '0xc5', polynomialB: '0x8f' }), 'NOT_PRIMITIVE');
  });

  test('degree mismatch rejected (DEGREE_MISMATCH)', () => {
    expectReject(() => reconcileInput({ n: 7, polynomialA: '0x13', polynomialB: '0x8f' }), 'DEGREE_MISMATCH');
  });

  test('two primitive polys that are not a preferred pair are rejected', () => {
    // 0x83 and 0x9d are both primitive; their cross-correlation set has 7 values.
    expectReject(() => reconcileInput({ n: 7, polynomialA: '0x83', polynomialB: '0x9d' }), 'NOT_PREFERRED_PAIR');
  });

  test('inline preferred pair succeeds via text-form polynomials', () => {
    const r = reconcileInput({
      n: 7,
      polynomialA: 'x^7+x^3+1',
      polynomialB: 'x^7+x^3+x^2+x+1',
    });
    assert.equal(r.qualified, true);
  });

  test('rejection result never marks qualified and reports observed values', () => {
    try {
      reconcileInput({ n: 7, polynomialA: '0x83', polynomialB: '0x9d' });
      assert.fail('should have thrown');
    } catch (err) {
      assert.equal(err.code, 'NOT_PREFERRED_PAIR');
      assert.ok(Array.isArray(err.details.observedCrossCorrelation));
      assert.deepEqual(err.details.expectedThreeValueSet, [-1, 15, -17]);
    }
  });
});
