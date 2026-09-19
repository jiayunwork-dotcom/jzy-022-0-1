'use strict';

const express = require('express');
const { reconcile } = require('./reconcile');
const { ServiceError, isServiceError } = require('./errors');

/**
 * HTTP surface. Handlers are pure functions of the request body plus the
 * immutable profile registry; nothing is kept between requests.
 */
function buildRouter(profiles) {
  const router = express.Router();

  router.get('/profiles', (req, res) => {
    res.json({ profiles: profiles.list() });
  });

  router.get('/profiles/:name', (req, res, next) => {
    try {
      res.json(profiles.get(req.params.name));
    } catch (err) {
      next(err);
    }
  });

  router.post('/reconcile', (req, res, next) => {
    try {
      const body = req.body || {};
      const hasProfile = body.profile !== undefined && body.profile !== null;
      const hasExplicit = body.polynomials !== undefined && body.polynomials !== null;
      if (hasProfile === hasExplicit) {
        throw new ServiceError('INVALID_REQUEST', 'give exactly one of "profile" or "polynomials"');
      }

      let result;
      if (hasProfile) {
        const profile = profiles.get(body.profile);
        result = reconcile(profile.n, profile.first, profile.second, { profile: profile.name });
      } else {
        if (body.n === undefined) {
          throw new ServiceError('INVALID_REQUEST', '"n" is required with explicit polynomials');
        }
        const polys = body.polynomials || {};
        result = reconcile(body.n, polys.first, polys.second, {
          polynomials: { first: polys.first, second: polys.second },
        });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (isServiceError(err)) {
    res.status(err.status).json({ error: { type: err.type, message: err.message } });
    return;
  }
  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: { type: 'INVALID_REQUEST', message: 'request body is not valid JSON' } });
    return;
  }
  res.status(500).json({ error: { type: 'INTERNAL', message: 'internal error' } });
}

module.exports = { buildRouter, errorHandler };
