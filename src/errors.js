'use strict';

/**
 * Typed service errors. Every rejection carries a stable `type` string so
 * callers can branch on it programmatically.
 */
const ERROR_STATUS = {
  INVALID_REQUEST: 400,
  EMPTY_POLYNOMIAL: 400,
  DEGREE_MISMATCH: 400,
  N_OUT_OF_RANGE: 400,
  EVEN_DEGREE: 400,
  UNKNOWN_PROFILE: 404,
  NOT_PRIMITIVE: 422,
  NOT_PREFERRED_PAIR: 422,
  INTERNAL: 500,
};

class ServiceError extends Error {
  constructor(type, message) {
    super(message);
    this.name = 'ServiceError';
    this.type = type;
    this.status = ERROR_STATUS[type] || 500;
  }
}

function isServiceError(err) {
  return err instanceof ServiceError;
}

module.exports = { ServiceError, isServiceError };
