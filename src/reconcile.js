/**
 * End-to-end reconciliation: validate degree and polynomials, reject before
 * generating anything unless BOTH polynomials are primitive AND the two
 * m-sequences form a preferred pair, then generate the whole family and audit
 * every periodic autocorrelation and pairwise periodic cross-correlation
 * against the three-value ruler pinned by n.
 *
 * No family is ever emitted (or marked qualified) unless it has passed.
 */
import {
  DEGREE_OUT_OF_RANGE,
  DEGREE_MISMATCH,
  EVEN_DEGREE,
  NOT_PRIMITIVE,
  NOT_PREFERRED_PAIR,
} from './errors.js';
import { checkPrimitive, degree } from './gf2.js';
import { parsePolynomial, describePolynomial } from './polynomialParser.js';
import { generateMSequence } from './msequence.js';
import { evaluatePreferredPair } from './preferredPair.js';
import { generateGoldFamily } from './family.js';
import {
  RotationTable,
  autoCorrelationVector,
  crossCorrelationVector,
} from './correlation.js';
import { threeValueSet } from './threeValue.js';

/**
 * Hard service bounds for n.
 *
 * The lower bound is pinned by the service (smaller odd n give degenerate
 * families and trivial bounds; the ruler is built for spread-spectrum use).
 * The upper bound is pinned by exhaustive-audit cost: the audit covers all
 * N+2 members against one another over every shift (~ (N+2 choose 2) * N
 * packed correlations), which is comfortably sub-second-ish for N=127 but
 * grows by roughly 64x per +2 in n. n=7 is the single pinned operating
 * point; everything outside [7,7] is rejected before generation.
 */
export const MIN_N = 7;
export const MAX_N = 7;

const MAX_REPORTED_VIOLATIONS = 50;

/** Validate n itself: integer, odd (even n is rejected outright), and in bounds. */
export function validateDegree(n) {
  if (typeof n !== 'number' || !Number.isInteger(n)) {
    throw DEGREE_OUT_OF_RANGE(Number(n), MIN_N, MAX_N);
  }
  // Even n has no three-value Gold bound under this convention and the spec
  // pins its rejection ahead of range checks.
  if (n % 2 === 0) throw EVEN_DEGREE(n);
  if (n < MIN_N || n > MAX_N) throw DEGREE_OUT_OF_RANGE(n, MIN_N, MAX_N);
}

/** Parse and fully validate one polynomial for a named slot. */
export function validatePolynomial(raw, n, which) {
  const mask = parsePolynomial(raw, which);
  if (degree(mask) !== BigInt(n)) {
    throw DEGREE_MISMATCH(which, n, Number(degree(mask)));
  }
  const prim = checkPrimitive(mask, n);
  if (!prim.primitive) {
    throw NOT_PRIMITIVE(which, mask.toString(16).toUpperCase(), prim.reason);
  }
  return mask;
}

/**
 * Run the whole reconcile for already-parsed primitive masks (preset path) or
 * for raw caller input. Validation failures reject before family generation.
 *
 * @param {object} opts
 * @param {number} opts.n
 * @param {bigint} opts.polyA
 * @param {bigint} opts.polyB
 * @param {string} [opts.source]  preset name or 'inline'
 */
export function reconcileMasks({ n, polyA, polyB, source = 'inline' }) {
  validateDegree(n);

  // Degree + primitivity gate: nothing is generated until both pass.
  let dA = degree(polyA);
  let dB = degree(polyB);
  if (dA !== BigInt(n)) throw DEGREE_MISMATCH('polynomialA', n, Number(dA));
  if (dB !== BigInt(n)) throw DEGREE_MISMATCH('polynomialB', n, Number(dB));

  const pA = checkPrimitive(polyA, n);
  if (!pA.primitive) {
    throw NOT_PRIMITIVE('polynomialA', polyA.toString(16).toUpperCase(), pA.reason);
  }
  const pB = checkPrimitive(polyB, n);
  if (!pB.primitive) {
    throw NOT_PRIMITIVE('polynomialB', polyB.toString(16).toUpperCase(), pB.reason);
  }

  const seqA = generateMSequence(polyA, n);
  const seqB = generateMSequence(polyB, n);

  // Preferred-pair gate, computed over the full-period cross-correlation.
  const pair = evaluatePreferredPair(seqA, seqB, n);
  if (!pair.isPreferred) {
    throw NOT_PREFERRED_PAIR(
      polyA.toString(16).toUpperCase(),
      polyB.toString(16).toUpperCase(),
      pair.values,
      pair.expected
    );
  }

  // Only now generate the full N+2 family and run the ruler over it.
  const family = generateGoldFamily(polyA, polyB, n);
  const audit = auditFamily(family, n);

  return buildResult({
    n,
    N: family.N,
    polyA,
    polyB,
    source,
    pairValues: pair.values,
    audit,
  });
}

/** Parse raw request polynomials then reconcile. */
export function reconcileInput({ n, polynomialA, polynomialB, source = 'inline' }) {
  // Pin the degree before touching the polynomials so an out-of-range n never
  // surfaces a confusing parser/primitivity error first.
  validateDegree(n);
  const polyA = validatePolynomial(polynomialA, n, 'polynomialA');
  const polyB = validatePolynomial(polynomialB, n, 'polynomialB');
  return reconcileMasks({ n, polyA, polyB, source });
}

/**
 * Audit every autocorrelation (all N shifts per member) and every unordered
 * pair of distinct members (full N-shift cross-correlation) against the ruler:
 *   - zero-shift autocorrelation must equal N for every member;
 *   - every non-zero autocorrelation sidelobe must be in the three-value set;
 *   - every cross-correlation value must be in the three-value set.
 *
 * Balancedness/Hamming weight is deliberately NOT a separate pass: some Gold
 * members have zero-shift still N but nonzero DC, and the ruler here is the
 * correlation three-value set only.
 */
export function auditFamily(family, n) {
  const { N, members } = family;
  const ruler = threeValueSet(n);
  const allowed = new Set(ruler.values);

  const tables = members.map((chips) => new RotationTable(chips));

  const violations = [];
  let violationCount = 0;
  const record = (violation) => {
    violationCount += 1;
    if (violations.length < MAX_REPORTED_VIOLATIONS) violations.push(violation);
  };

  let zeroShiftAllN = true;
  for (let i = 0; i < members.length; i += 1) {
    const vec = autoCorrelationVector(tables[i]);
    if (vec[0] !== N) {
      zeroShiftAllN = false;
      record({
        kind: 'autocorrelation-zero-shift',
        member: i,
        shift: 0,
        value: vec[0],
        expected: N,
      });
    }
    for (let k = 1; k < N; k += 1) {
      if (!allowed.has(vec[k])) {
        record({
          kind: 'autocorrelation-sidelobe',
          member: i,
          shift: k,
          value: vec[k],
          allowed: ruler.values,
        });
      }
    }
  }

  let crossPairsChecked = 0;
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const vec = crossCorrelationVector(tables[i], tables[j]);
      crossPairsChecked += 1;
      for (let k = 0; k < N; k += 1) {
        if (!allowed.has(vec[k])) {
          record({
            kind: 'cross-correlation',
            memberA: i,
            memberB: j,
            shift: k,
            value: vec[k],
            allowed: ruler.values,
          });
        }
      }
    }
  }

  return {
    zeroShift: N,
    zeroShiftAllN,
    familySize: members.length,
    crossPairsChecked,
    sidelobeSet: ruler.values,
    violations,
    violationCount,
    violationsTruncated: violationCount > violations.length,
  };
}

function buildResult({ n, N, polyA, polyB, source, pairValues, audit }) {
  const ruler = threeValueSet(n);
  const qualified =
    audit.zeroShiftAllN && audit.violations.length === 0;

  return {
    source,
    n,
    N,
    codeLength: N,
    threeValueSet: {
      values: ruler.values,
      t: ruler.t,
      formula: ruler.formula,
    },
    polynomials: {
      polynomialA: describePolynomial(polyA),
      polynomialB: describePolynomial(polyB),
    },
    preferredPair: {
      crossCorrelationValues: pairValues,
      matchesThreeValueSet: true,
    },
    family: {
      size: audit.familySize,
      composition: ['m_a', 'm_b', 'a * T^k b for k = 0..N-1'],
    },
    audit: {
      zeroShiftValue: audit.zeroShift,
      zeroShiftEqualsNForAllMembers: audit.zeroShiftAllN,
      sidelobeSet: audit.sidelobeSet,
      crossPairsChecked: audit.crossPairsChecked,
      outOfRangeShifts: audit.violations,
      outOfRangeShiftCount: audit.violationCount,
      outOfRangeReportTruncated: audit.violationsTruncated,
      reportLimit: MAX_REPORTED_VIOLATIONS,
    },
    qualified,
  };
}
