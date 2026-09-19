/**
 * Parsing caller-supplied primitive-polynomial conventions into GF(2) bit masks.
 *
 * Accepted forms:
 *   - non-negative integer (JSON number), e.g. 137          (bit mask)
 *   - "0x89" / "0b10001001" / "0o211" / "137"               (mask literals)
 *   - polynomial text: "x^7+x^3+1", "1 + x3 + x7", "x7+x3+1"
 *
 * In bit-mask form bit i is the coefficient of x^i (0x89 = x^7 + x^3 + 1).
 * In expression text '+' and '-' are the same (XOR over GF(2)).
 */
import { EMPTY_POLYNOMIAL, INVALID_POLYNOMIAL } from './errors.js';

const MASK_LITERAL = /^\s*(0x[0-9a-fA-F]+|0b[01]+|0o[0-7]+|\d+)\s*$/;

/**
 * Parse one polynomial value for a named slot ("polynomialA"/"polynomialB").
 * Returns BigInt. Throws ServiceError on empty/unparseable input.
 */
export function parsePolynomial(raw, which) {
  if (raw === undefined || raw === null) throw EMPTY_POLYNOMIAL(which);
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || raw < 0) throw INVALID_POLYNOMIAL(which, raw);
    return BigInt(raw);
  }
  if (typeof raw !== 'string') throw INVALID_POLYNOMIAL(which, raw);

  const text = raw.trim();
  if (text === '') throw EMPTY_POLYNOMIAL(which);

  if (MASK_LITERAL.test(text)) return parseMaskLiteral(text);
  return parseExpression(text, which, raw);
}

function parseMaskLiteral(text) {
  const t = text.trim().toLowerCase();
  if (t.startsWith('0x')) return BigInt(t);
  if (t.startsWith('0b')) return BigInt(t);
  if (t.startsWith('0o')) return BigInt(t);
  return BigInt(t); // decimal
}

/**
 * Parse a sum of monomials such as x^7 + x^3 + 1.
 * Allowed monomials:
 *   constant:  "0", "1" (0 contributes nothing)
 *   variable:  "x", "x^k", "xk", optionally with a 0/1 coefficient
 *              ("1*x^3", "0*x" etc.) and '*' between coefficient and x.
 */
function parseExpression(text, which, raw) {
  // Split on + or -; both are addition in GF(2). Reject anything else odd.
  const termTexts = text.split(/\s*[+\-]\s*/).filter((t) => t !== '');
  if (termTexts.length === 0) throw INVALID_POLYNOMIAL(which, raw);

  let mask = 0n;
  for (const termText of termTexts) {
    const t = termText.replace(/\s+/g, '');
    if (t === '') throw INVALID_POLYNOMIAL(which, raw);

    // Pure constant 0 or 1.
    if (/^[01]$/.test(t)) {
      if (t === '1') mask ^= 1n;
      continue;
    }

    const m = t.match(/^([01])?\*?x(?:\^?(\d+))?$/i);
    if (!m) throw INVALID_POLYNOMIAL(which, raw);
    const coefficient = m[1] === undefined ? 1 : Number(m[1]);
    const exponent = m[2] === undefined ? 1 : Number(m[2]);
    if (exponent > 1_000_000) throw INVALID_POLYNOMIAL(which, raw);
    if (coefficient === 1) mask ^= 1n << BigInt(exponent);
  }
  if (mask === 0n) throw EMPTY_POLYNOMIAL(which);
  return mask;
}

/** Canonical rendering of a GF(2) mask as "0x.." plus the x^k form. */
export function describePolynomial(mask) {
  const hex = '0x' + mask.toString(16).toUpperCase();
  const terms = [];
  for (let k = 0; (1n << BigInt(k)) <= mask; k += 1) {
    if ((mask >> BigInt(k)) & 1n) {
      if (k === 0) terms.push('1');
      else if (k === 1) terms.push('x');
      else terms.push(`x^${k}`);
    }
  }
  return { mask: hex, expression: terms.reverse().join(' + ') || '0' };
}
