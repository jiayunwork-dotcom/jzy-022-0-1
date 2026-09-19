import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMSequence,
  multiplyChips,
  rotateChips,
  negateChips,
} from '../src/msequence.js';
import {
  RotationTable,
  autoCorrelationVector,
  crossCorrelationVector,
  packChips,
  rotateRightBits,
  scalarCorrelationVector,
  scalarPeriodicCorrelation,
} from '../src/correlation.js';
import { evaluatePreferredPair } from '../src/preferredPair.js';

describe('m-sequence', () => {
  test('period is N, chips are ±1', () => {
    const s = generateMSequence(0x89n, 7);
    assert.equal(s.length, 127);
    for (const c of s) assert.ok(c === 1 || c === -1);
  });

  test('two-value periodic autocorrelation {N, -1}', () => {
    const s = generateMSequence(0x89n, 7);
    const vec = autoCorrelationVector(new RotationTable(s));
    assert.equal(vec[0], 127);
    const values = new Set();
    for (let k = 1; k < 127; k += 1) {
      assert.equal(vec[k], -1);
      values.add(vec[k]);
    }
    assert.deepEqual([...values], [-1]);
  });

  test('n=3 minimal case: 0xB gives length-7 m-sequence with {7,-1}', () => {
    const s = generateMSequence(0xbn, 3);
    const vec = autoCorrelationVector(new RotationTable(s));
    assert.equal(vec[0], 7);
    for (let k = 1; k < 7; k += 1) assert.equal(vec[k], -1);
  });
});

describe('packed correlation engine matches scalar reference', () => {
  test('rotation direction matches chip rotation', () => {
    const a = generateMSequence(0x89n, 7);
    const b = generateMSequence(0x8fn, 7);
    const packedB = packChips(b);
    for (const k of [0, 1, 7, 42, 126]) {
      // Rebuild expected packed sequence from a chip-level rotation.
      const expected = packChips(rotateChips(b, k));
      assert.equal(rotateRightBits(packedB, k, 127), expected, `k=${k}`);
    }
    void a;
  });

  test('full cross-correlation vector equals scalar periodic correlation', () => {
    const a = generateMSequence(0x89n, 7);
    const b = generateMSequence(0x8fn, 7);
    const fast = crossCorrelationVector(new RotationTable(a), new RotationTable(b));
    const slow = scalarCorrelationVector(a, b);
    assert.equal(fast.length, slow.length);
    for (let k = 0; k < 127; k += 1) assert.equal(fast[k], slow[k], `k=${k}`);
  });

  test('full autocorrelation vector equals scalar reference', () => {
    const a = generateMSequence(0x83n, 7);
    const fast = autoCorrelationVector(new RotationTable(a));
    for (let k = 0; k < 127; k += 1) {
      assert.equal(fast[k], scalarPeriodicCorrelation(a, a, k), `k=${k}`);
    }
  });

  test('random chip words: packed agrees with scalar', () => {
    for (const n of [5, 6, 7]) {
      const N = 2 ** n - 1;
      const a = new Int8Array(N);
      const b = new Int8Array(N);
      let seed = 1234567 + n;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      for (let i = 0; i < N; i += 1) {
        a[i] = rnd() < 0.5 ? -1 : 1;
        b[i] = rnd() < 0.5 ? -1 : 1;
      }
      const fast = crossCorrelationVector(new RotationTable(a), new RotationTable(b));
      const slow = scalarCorrelationVector(a, b);
      for (let k = 0; k < N; k += 1) assert.equal(fast[k], slow[k]);
    }
  });

  test('chipwise product of ±1 chips equals XOR-domain mapping', () => {
    const a = generateMSequence(0x89n, 7);
    const b = generateMSequence(0x8fn, 7);
    const c = multiplyChips(a, b);
    // c = +1 iff bits equal, which is 1 - 2*(bitA XOR bitB).
    for (let i = 0; i < 127; i += 1) {
      const bitA = a[i] === -1 ? 1 : 0;
      const bitB = b[i] === -1 ? 1 : 0;
      assert.equal(c[i], 1 - 2 * (bitA ^ bitB));
    }
  });
});

describe('preferred pair evaluation', () => {
  test('0x89 / 0x8F yields exactly {-17,-1,15}', () => {
    const r = evaluatePreferredPair(
      generateMSequence(0x89n, 7),
      generateMSequence(0x8fn, 7),
      7
    );
    assert.equal(r.isPreferred, true);
    assert.deepEqual(r.values, [-17, -1, 15]);
  });

  test('non-preferred primitive pair rejected (0x83/0x9d has 7 values)', () => {
    const r = evaluatePreferredPair(
      generateMSequence(0x83n, 7),
      generateMSequence(0x9dn, 7),
      7
    );
    assert.equal(r.isPreferred, false);
    assert.notDeepEqual(r.values, [-17, -1, 15]);
  });

  test('identical m-sequences are not a preferred pair (two-value {N,-1})', () => {
    const s = generateMSequence(0x89n, 7);
    const r = evaluatePreferredPair(s, s, 7);
    assert.equal(r.isPreferred, false);
  });
});

describe('polarity/shift invariance sanity', () => {
  test('negating all chips leaves autocorrelation unchanged', () => {
    const s = generateMSequence(0x89n, 7);
    const v1 = autoCorrelationVector(new RotationTable(s));
    const v2 = autoCorrelationVector(new RotationTable(negateChips(s)));
    for (let k = 0; k < 127; k += 1) assert.equal(v1[k], v2[k]);
  });

  test('cyclic shift only rotates the autocorrelation, value set invariant', () => {
    const s = generateMSequence(0x89n, 7);
    const shifted = rotateChips(s, 37);
    const v1 = new Set(autoCorrelationVector(new RotationTable(s)));
    const v2 = new Set(autoCorrelationVector(new RotationTable(shifted)));
    assert.deepEqual([...v1].sort((a, b) => a - b), [...v2].sort((a, b) => a - b));
  });
});
