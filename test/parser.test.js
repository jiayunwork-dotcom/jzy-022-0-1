import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parsePolynomial, describePolynomial } from '../src/polynomialParser.js';
import { ServiceError } from '../src/errors.js';

describe('polynomial parser', () => {
  test('numeric and mask literals', () => {
    assert.equal(parsePolynomial(137, 'p'), 0x89n);
    assert.equal(parsePolynomial('137', 'p'), 0x89n);
    assert.equal(parsePolynomial('0x89', 'p'), 0x89n);
    assert.equal(parsePolynomial('0b10001001', 'p'), 0x89n);
    assert.equal(parsePolynomial('0o211', 'p'), 0x89n);
  });

  test('expression forms', () => {
    assert.equal(parsePolynomial('x^7+x^3+1', 'p'), 0x89n);
    assert.equal(parsePolynomial('x7 + x3 + 1', 'p'), 0x89n);
    assert.equal(parsePolynomial('1 + x^3 + x^7', 'p'), 0x89n);
    assert.equal(parsePolynomial('x^7+x^3+x^2+x+1', 'p'), 0x8fn);
    assert.equal(parsePolynomial('1*x^7 + 1*x^3 + 1', 'p'), 0x89n);
    // minus is addition in GF(2), and duplicate terms cancel by XOR.
    assert.equal(parsePolynomial('x^7+x^3+1+x^3', 'p'), 0x81n);
  });

  test('empty and junk rejected with typed errors', () => {
    assert.throws(() => parsePolynomial('   ', 'p'), (e) => e instanceof ServiceError && e.code === 'EMPTY_POLYNOMIAL');
    assert.throws(() => parsePolynomial('', 'p'), (e) => e.code === 'EMPTY_POLYNOMIAL');
    assert.throws(() => parsePolynomial(null, 'p'), (e) => e.code === 'EMPTY_POLYNOMIAL');
    assert.throws(() => parsePolynomial('banana', 'p'), (e) => e.code === 'INVALID_POLYNOMIAL');
    assert.throws(() => parsePolynomial('x^-1', 'p'), (e) => e.code === 'INVALID_POLYNOMIAL');
  });

  test('describe round trip', () => {
    const d = describePolynomial(0x89n);
    assert.equal(d.mask, '0x89');
    assert.equal(d.expression, 'x^7 + x^3 + 1');
  });
});
