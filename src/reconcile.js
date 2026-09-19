'use strict';

const { ServiceError } = require('./errors');
const { isPrimitive } = require('./gf2');
const { parsePolynomial, describePolynomial } = require('./polynomialParser');
const { generateMSequence } = require('./msequence');
const { generateGoldFamily } = require('./family');
const { checkPreferredPair } = require('./preferredPair');
const { auditFamily } = require('./audit');
const { threeValueSet, threeValueFormula } = require('./threeValue');

/** Degree bounds pinned by the service. Only odd n in [MIN_N, MAX_N]. */
const MIN_N = 5;
const MAX_N = 13;

function validateDegree(n) {
  if (!Number.isInteger(n)) {
    throw new ServiceError('INVALID_REQUEST', `n must be an integer, got ${JSON.stringify(n)}`);
  }
  if (n < MIN_N || n > MAX_N) {
    throw new ServiceError(
      'N_OUT_OF_RANGE',
      `n=${n} is out of range; this service supports ${MIN_N} <= n <= ${MAX_N}`,
    );
  }
  if (n % 2 === 0) {
    throw new ServiceError('EVEN_DEGREE', `n=${n} is even; this service only reconciles odd-degree Gold families`);
  }
}

/**
 * Runs one full reconciliation for a degree-n pair of primitive polynomials
 * given as API specs. Pure and request-scoped: every sequence, family and
 * correlation table lives in locals, so concurrent reconciliations never
 * share state.
 *
 * Rejects BEFORE family generation when a polynomial is not primitive or
 * the two m-sequences do not form a preferred pair — it never marks an
 * out-of-bound family as qualified.
 */
function reconcile(n, polySpecA, polySpecB, source) {
  validateDegree(n);

  const maskA = parsePolynomial(polySpecA, n, 'polynomials.first');
  const maskB = parsePolynomial(polySpecB, n, 'polynomials.second');

  if (!isPrimitive(maskA, n)) {
    throw new ServiceError(
      'NOT_PRIMITIVE',
      `polynomials.first (${describePolynomial(maskA).polynomial}) is not a primitive degree-${n} polynomial`,
    );
  }
  if (!isPrimitive(maskB, n)) {
    throw new ServiceError(
      'NOT_PRIMITIVE',
      `polynomials.second (${describePolynomial(maskB).polynomial}) is not a primitive degree-${n} polynomial`,
    );
  }

  const chipsA = generateMSequence(maskA, n);
  const chipsB = generateMSequence(maskB, n);

  const gate = checkPreferredPair(chipsA, chipsB, n);
  if (!gate.preferred) {
    const sample = gate.violations.slice(0, 5).map((v) => `shift ${v.shift}: ${v.value}`).join(', ');
    throw new ServiceError(
      'NOT_PREFERRED_PAIR',
      `the two m-sequences do not form a preferred pair: base cross-correlation leaves the ` +
        `three-value set at ${gate.violations.length} shift(s) (${sample}${gate.violations.length > 5 ? ', ...' : ''})`,
    );
  }

  const N = 2 ** n - 1;
  const members = generateGoldFamily(chipsA, chipsB);
  const verdict = auditFamily(members, n, gate.table);

  return {
    source,
    n,
    N,
    familySize: members.length,
    polynomials: { first: describePolynomial(maskA), second: describePolynomial(maskB) },
    threeValueSet: threeValueSet(n),
    threeValueFormula: threeValueFormula(n),
    zeroShift: N,
    zeroShiftOk: verdict.zeroShiftOk,
    qualified: verdict.qualified,
    violations: verdict.violations,
    totalViolations: verdict.totalViolations,
    violationsTruncated: verdict.violationsTruncated,
    audit: verdict.audit,
  };
}

module.exports = { reconcile, validateDegree, MIN_N, MAX_N };
