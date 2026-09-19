/**
 * Express application: generation + reconciliation only, over HTTP.
 *
 *   GET  /health                       liveness probe
 *   GET  /presets                      list registered read-only presets
 *   POST /reconcile                    reconcile a preset or inline polynomials
 *
 * Each request builds and audits its OWN family: nothing (LFSR state, packed
 * words, correlation values) is carried from one request to the next.
 */
import express from 'express';
import { ServiceError, INVALID_REQUEST, UNKNOWN_PRESET } from './errors.js';
import { getPreset, listPresets } from './presets.js';
import { reconcileInput, reconcileMasks, MIN_N, MAX_N } from './reconcile.js';

export function createApp() {
  const app = express();
  app.use(express.json({ strict: false, limit: '64kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/presets', (_req, res) => {
    res.json({ presets: listPresets() });
  });

  app.post('/reconcile', (req, res, next) => {
    try {
      const body = req.body;
      if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw INVALID_REQUEST('request body must be a JSON object');
      }

      const hasPreset = body.preset !== undefined;
      const hasInline =
        body.n !== undefined ||
        body.polynomialA !== undefined ||
        body.polynomialB !== undefined;

      let result;
      if (hasPreset && hasInline) {
        throw INVALID_REQUEST(
          'provide either "preset" or inline "n/polynomialA/polynomialB", not both'
        );
      } else if (hasPreset) {
        if (typeof body.preset !== 'string' || body.preset.trim() === '') {
          throw INVALID_REQUEST('"preset" must be a non-empty string');
        }
        const preset = getPreset(body.preset);
        if (!preset) {
          throw UNKNOWN_PRESET(body.preset, listPresets().map((p) => p.name));
        }
        result = reconcileMasks({
          n: preset.n,
          polyA: preset.polyA,
          polyB: preset.polyB,
          source: `preset:${preset.name}`,
        });
      } else {
        if (
          body.n === undefined ||
          body.polynomialA === undefined ||
          body.polynomialB === undefined
        ) {
          throw INVALID_REQUEST(
            'inline reconciliation requires n, polynomialA and polynomialB'
          );
        }
        if (typeof body.n !== 'number' || !Number.isInteger(body.n)) {
          throw INVALID_REQUEST('"n" must be an integer');
        }
        result = reconcileInput({
          n: body.n,
          polynomialA: body.polynomialA,
          polynomialB: body.polynomialB,
          source: 'inline',
        });
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // 404 for anything else.
  app.use((req, res) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: `cannot ${req.method} ${req.path}`,
    });
  });

  // Typed error sink.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof ServiceError) {
      res.status(err.status).json(err.toJSON());
      return;
    }
    if (err && err.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'INVALID_JSON', message: 'body is not valid JSON' });
      return;
    }
    res.status(500).json({ error: 'INTERNAL', message: 'internal error' });
  });

  return app;
}

export { MIN_N, MAX_N };
