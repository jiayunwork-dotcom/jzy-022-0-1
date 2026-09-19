import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkPrimitive, mod, multiply } from '../src/gf2.js';

describe('GF(2) primitives', () => {
  test('known primitive polynomials are recognized', () => {
    const cases = [
      [2, 0x7n], // x^2+x+1
      [3, 0xbn], // x^3+x+1
      [4, 0x13n], // x^4+x+1
      [5, 0x25n], // x^5+x^2+1
      [6, 0x43n], // x^6+x+1
      [7, 0x83n],
      [7, 0x89n],
      [7, 0x8fn],
    ];
    for (const [n, p] of cases) {
      assert.equal(checkPrimitive(p, n).primitive, true, `0x${p.toString(16)} n=${n}`);
    }
  });

  test('all 18 degree-7 primitive polynomials of the table count', () => {
    let count = 0;
    for (let p = 0x80; p < 0x100; p += 1) {
      if (checkPrimitive(BigInt(p), 7).primitive) count += 1;
    }
    // phi(2^7-1)/7 = 126/7 = 18.
    assert.equal(count, 18);
  });

  test('reducible polynomial is not primitive', () => {
    // (x+1)(x^6+x+1) = (x+1)(0x43) = 0x43 XOR (0x43<<1) = 0xC5
    const f = 0xc5n;
    const r = checkPrimitive(f, 7);
    assert.equal(r.primitive, false);
    assert.match(r.reason, /reducible/);
  });

  test('zero constant term is rejected (divisible by x)', () => {
    const r = checkPrimitive(0x8an, 7); // x^7+x^3+x
    assert.equal(r.primitive, false);
  });

  test('wrong degree rejected', () => {
    const r = checkPrimitive(0x13n, 7); // primitive but degree 4
    assert.equal(r.primitive, false);
  });

  test('irreducible but non-primitive is caught', () => {
    // x^4+x^3+x^2+x+1 = 0x1F: irreducible, but its root has order 5, not 15.
    const r = checkPrimitive(0x1fn, 4);
    assert.equal(r.primitive, false);
  });

  test('polynomial multiply and mod sanity', () => {
    assert.equal(multiply(0b11n, 0b11n), 0b101n); // (x+1)^2 = x^2+1 over GF(2)
    assert.equal(mod(0b1110n, 0b1011n), 0b101n);
  });
});
