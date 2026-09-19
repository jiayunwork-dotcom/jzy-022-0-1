'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcile } = require('../src/reconcile');
const { ServiceError } = require('../src/errors');

const DEMO = { first: { octal: '211' }, second: { octal: '217' } };

test('demo pair reconciles: N, three-value set, zero shift, qualified', () => {
  const r = reconcile(7, DEMO.first, DEMO.second, { test: true });
  assert.equal(r.n, 7);
  assert.equal(r.N, 127);
  assert.equal(r.familySize, 129);
  assert.deepEqual(r.threeValueSet, [-17, -1, 15]);
  assert.equal(r.zeroShift, 127);
  assert.equal(r.zeroShiftOk, true);
  assert.equal(r.qualified, true);
  assert.equal(r.totalViolations, 0);
  assert.equal(r.audit.mode, 'exhaustive');
  // every observed sidelobe value lies in the three-value set
  for (const v of r.audit.valuesObserved) {
    assert.ok(r.threeValueSet.includes(v), `unexpected sidelobe value ${v}`);
  }
});

test('same preferred pair via exponents form reconciles identically', () => {
  const r = reconcile(7, { exponents: [7, 3, 0] }, { exponents: [7, 3, 2, 1, 0] }, { test: true });
  assert.equal(r.qualified, true);
  assert.equal(r.N, 127);
});

test('non-preferred pair is rejected before generation', () => {
  // identical polynomials: cross-correlation collapses to the autocorrelation
  assert.throws(
    () => reconcile(7, DEMO.first, DEMO.first, {}),
    (err) => err instanceof ServiceError && err.type === 'NOT_PREFERRED_PAIR',
  );
  // two distinct primitive polynomials that are not a preferred pair
  assert.throws(
    () => reconcile(7, { octal: '203' }, { octal: '235' }, {}),
    (err) => err instanceof ServiceError && err.type === 'NOT_PREFERRED_PAIR',
  );
});

test('non-primitive polynomials are rejected before generation', () => {
  assert.throws(
    () => reconcile(7, { octal: '377' }, DEMO.second, {}), // (x+1)^7
    (err) => err instanceof ServiceError && err.type === 'NOT_PRIMITIVE',
  );
  assert.throws(
    () => reconcile(7, DEMO.first, { octal: '210' }, {}), // divisible by x
    (err) => err instanceof ServiceError && err.type === 'NOT_PRIMITIVE',
  );
});

test('empty polynomial is rejected with a typed error', () => {
  for (const empty of [undefined, null, '', {}, { exponents: [] }]) {
    assert.throws(
      () => reconcile(7, empty, DEMO.second, {}),
      (err) => err instanceof ServiceError && err.type === 'EMPTY_POLYNOMIAL',
      `expected EMPTY_POLYNOMIAL for ${JSON.stringify(empty)}`,
    );
  }
});

test('degree out of range and even degree are rejected', () => {
  assert.throws(
    () => reconcile(3, { octal: '13' }, { octal: '15' }, {}),
    (err) => err.type === 'N_OUT_OF_RANGE',
  );
  assert.throws(
    () => reconcile(17, { octal: '1' }, { octal: '1' }, {}),
    (err) => err.type === 'N_OUT_OF_RANGE',
  );
  assert.throws(
    () => reconcile(6, { octal: '103' }, { octal: '147' }, {}),
    (err) => err.type === 'EVEN_DEGREE',
  );
});

test('polynomial degree mismatch with n is rejected', () => {
  assert.throws(
    () => reconcile(7, { octal: '45' }, DEMO.second, {}), // degree 5 polynomial
    (err) => err.type === 'DEGREE_MISMATCH',
  );
});

test('larger odd degrees reconcile in base-table mode', () => {
  const r = reconcile(9, { octal: '1021' }, { octal: '1131' }, { test: true });
  assert.equal(r.N, 511);
  assert.equal(r.qualified, true);
  assert.equal(r.audit.mode, 'base-table');
  assert.deepEqual(r.threeValueSet, [-33, -1, 31]);
});
