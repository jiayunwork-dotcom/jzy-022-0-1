'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isPrimitive, primeFactors } = require('../src/gf2');

test('primitive polynomials are accepted', () => {
  assert.equal(isPrimitive(0b1011, 3), true); // x^3 + x + 1
  assert.equal(isPrimitive(0b10011, 4), true); // x^4 + x + 1
  assert.equal(isPrimitive(0o211, 7), true); // x^7 + x^3 + 1 (demo profile)
  assert.equal(isPrimitive(0o217, 7), true); // x^7 + x^3 + x^2 + x + 1 (demo profile)
});

test('irreducible but non-primitive polynomial is rejected', () => {
  // x^4 + x^3 + x^2 + x + 1 is irreducible but x has order 5, not 15.
  assert.equal(isPrimitive(0b11111, 4), false);
});

test('reducible polynomials are rejected', () => {
  assert.equal(isPrimitive(0b10101, 4), false); // (x^2+x+1)^2
  assert.equal(isPrimitive(0o377, 7), false); // x^7+...+x+1 = (x+1)^7
  assert.equal(isPrimitive(0o210, 7), false); // x^7+x^3, divisible by x
});

test('wrong degree is rejected', () => {
  assert.equal(isPrimitive(0b10011, 5), false); // degree 4 polynomial, n=5
});

test('primeFactors', () => {
  assert.deepEqual(primeFactors(31), [31]);
  assert.deepEqual(primeFactors(511), [7, 73]);
  assert.deepEqual(primeFactors(2047), [23, 89]);
});
