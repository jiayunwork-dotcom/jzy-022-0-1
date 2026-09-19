/**
 * Typed errors for the Gold code reconciliation service.
 *
 * Every rejection carries a stable machine-readable `code` so callers can
 * distinguish an unknown preset from a non-primitive polynomial without
 * parsing prose. HTTP status lives alongside the code.
 */
export class ServiceError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.status = status;
    if (details !== undefined) this.details = details;
  }

  toJSON() {
    const body = { error: this.code, message: this.message };
    if (this.details !== undefined) body.details = this.details;
    return body;
  }
}

/** Empty/blank polynomial string or a polynomial equal to zero. */
export const EMPTY_POLYNOMIAL = (which) =>
  new ServiceError('EMPTY_POLYNOMIAL', `${which} polynomial is empty or zero`, 400);

/** Request body or field had the wrong JSON type. */
export const INVALID_REQUEST = (message, details) =>
  new ServiceError('INVALID_REQUEST', message, 400, details);

/** Unknown named preset. */
export const UNKNOWN_PRESET = (name, known) =>
  new ServiceError(
    'UNKNOWN_PRESET',
    `no registered preferred-pair preset named ${JSON.stringify(name)}`,
    404,
    { known }
  );

/** n outside the hard bounds pinned by the service. */
export const DEGREE_OUT_OF_RANGE = (n, min, max) =>
  new ServiceError(
    'DEGREE_OUT_OF_RANGE',
    `degree n=${n} is outside the supported range [${min}, ${max}]`,
    422,
    { n, min, max }
  );

/** Even n: the Gold three-value bound pinned here is only defined for odd n. */
export const EVEN_DEGREE = (n) =>
  new ServiceError(
    'EVEN_DEGREE',
    `even degree n=${n} is rejected; the three-value rule is only defined for odd n`,
    422,
    { n }
  );

/** Polynomial cannot be interpreted as a GF(2) polynomial. */
export const INVALID_POLYNOMIAL = (which, raw) =>
  new ServiceError(
    'INVALID_POLYNOMIAL',
    `${which} polynomial is not a valid GF(2) polynomial`,
    400,
    { which, raw: String(raw) }
  );

/** Polynomial degree does not match n. */
export const DEGREE_MISMATCH = (which, expected, actual) =>
  new ServiceError(
    'DEGREE_MISMATCH',
    `${which} polynomial degree ${actual} does not equal n=${expected}`,
    422,
    { which, expected, actual }
  );

/** Polynomial is not primitive (reducible or order < 2^n - 1). */
export const NOT_PRIMITIVE = (which, hex, reason) =>
  new ServiceError(
    'NOT_PRIMITIVE',
    `${which} polynomial 0x${hex} is not primitive: ${reason}`,
    422,
    { which, polynomial: `0x${hex}`, reason }
  );

/** The two primitive m-sequences do not form a preferred pair. */
export const NOT_PREFERRED_PAIR = (hexA, hexB, observed, allowed) =>
  new ServiceError(
    'NOT_PREFERRED_PAIR',
    `m-sequences from 0x${hexA} and 0x${hexB} do not form a preferred pair`,
    422,
    {
      polynomialA: `0x${hexA}`,
      polynomialB: `0x${hexB}`,
      observedCrossCorrelation: [...observed].sort((a, b) => a - b),
      expectedThreeValueSet: allowed,
    }
  );
