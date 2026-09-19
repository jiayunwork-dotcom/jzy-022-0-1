'use strict';

const { ServiceError } = require('./errors');
const { polyDeg } = require('./gf2');

/**
 * Parses the polynomial representations accepted by the API into a GF(2)
 * bitmask (bit i = coefficient of x^i). Exactly one form must be given:
 *
 *   { "octal": "211" }        classic register-tap notation, incl. x^n and 1
 *   { "binary": "10001001" }  MSB = coefficient of x^n
 *   { "hex": "0x89" }
 *   { "decimal": 137 }
 *   { "exponents": [7, 3, 0] } exponents with coefficient 1
 *
 * The parsed polynomial must have degree exactly n and a non-zero constant
 * term (a polynomial divisible by x can never be primitive).
 */
function parsePolynomial(spec, n, field) {
  const label = field || 'polynomial';
  if (spec === null || spec === undefined || spec === '') {
    throw new ServiceError('EMPTY_POLYNOMIAL', `${label}: polynomial spec is empty`);
  }

  let mask;
  if (typeof spec === 'number') {
    mask = spec;
  } else if (typeof spec === 'object') {
    const forms = ['octal', 'binary', 'hex', 'decimal', 'exponents'].filter(
      (k) => spec[k] !== undefined && spec[k] !== null && spec[k] !== '',
    );
    if (forms.length === 0) {
      throw new ServiceError('EMPTY_POLYNOMIAL', `${label}: polynomial spec is empty`);
    }
    if (forms.length > 1) {
      throw new ServiceError(
        'INVALID_REQUEST',
        `${label}: give exactly one of octal/binary/hex/decimal/exponents, got ${forms.join(', ')}`,
      );
    }
    mask = parseForm(spec, forms[0], label);
  } else {
    throw new ServiceError(
      'INVALID_REQUEST',
      `${label}: polynomial spec must be an object with one of octal/binary/hex/decimal/exponents`,
    );
  }

  if (!Number.isInteger(mask) || mask <= 0) {
    throw new ServiceError('INVALID_REQUEST', `${label}: polynomial does not encode a valid GF(2) polynomial`);
  }
  const deg = polyDeg(mask);
  if (deg !== n) {
    throw new ServiceError(
      'DEGREE_MISMATCH',
      `${label}: polynomial degree is ${deg}, expected ${n} for this request`,
    );
  }
  return mask;
}

function parseForm(spec, form, label) {
  const value = spec[form];
  switch (form) {
    case 'octal': {
      const s = String(value).trim();
      if (!/^[0-7]+$/.test(s)) {
        throw new ServiceError('INVALID_REQUEST', `${label}: "${s}" is not valid octal`);
      }
      return parseInt(s, 8);
    }
    case 'binary': {
      const s = String(value).trim();
      if (!/^[01]+$/.test(s)) {
        throw new ServiceError('INVALID_REQUEST', `${label}: "${s}" is not a binary string`);
      }
      return parseInt(s, 2);
    }
    case 'hex': {
      const s = String(value).trim().replace(/^0x/i, '');
      if (!/^[0-9a-f]+$/i.test(s)) {
        throw new ServiceError('INVALID_REQUEST', `${label}: "${value}" is not valid hex`);
      }
      return parseInt(s, 16);
    }
    case 'decimal': {
      if (!Number.isInteger(value)) {
        throw new ServiceError('INVALID_REQUEST', `${label}: decimal form must be an integer`);
      }
      return value;
    }
    case 'exponents': {
      if (!Array.isArray(value) || value.length === 0) {
        throw new ServiceError('EMPTY_POLYNOMIAL', `${label}: exponents list is empty`);
      }
      let mask = 0;
      for (const e of value) {
        if (!Number.isInteger(e) || e < 0 || e > 30) {
          throw new ServiceError('INVALID_REQUEST', `${label}: bad exponent ${e}`);
        }
        mask |= 1 << e;
      }
      return mask;
    }
    default:
      throw new ServiceError('INVALID_REQUEST', `${label}: unsupported polynomial form "${form}"`);
  }
}

/** Human-readable echoes of a polynomial bitmask for responses. */
function describePolynomial(mask) {
  const deg = polyDeg(mask);
  const exponents = [];
  for (let i = deg; i >= 0; i--) {
    if ((mask >> i) & 1) exponents.push(i);
  }
  return {
    octal: mask.toString(8),
    binary: mask.toString(2),
    exponents,
    polynomial: exponents.map((e) => (e === 0 ? '1' : e === 1 ? 'x' : `x^${e}`)).join(' + '),
  };
}

module.exports = { parsePolynomial, describePolynomial };
