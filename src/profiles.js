'use strict';

const fs = require('fs');
const { ServiceError } = require('./errors');
const { isPrimitive } = require('./gf2');
const { parsePolynomial, describePolynomial } = require('./polynomialParser');
const { generateMSequence } = require('./msequence');
const { checkPreferredPair } = require('./preferredPair');
const { validateDegree } = require('./reconcile');

/**
 * Registry of named preferred pairs ("优选对档"). Loaded once at startup
 * from JSON, validated eagerly (degree rules, primitivity, and the
 * preferred-pair property itself — a profile that does not verify refuses
 * the service to start), then frozen: read-only at runtime, no database.
 */
function loadProfiles(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(raw)) {
    throw new Error(`profiles file ${filePath} must contain a JSON array`);
  }
  const profiles = new Map();
  for (const entry of raw) {
    const profile = validateProfile(entry);
    if (profiles.has(profile.name)) {
      throw new Error(`duplicate profile name "${profile.name}"`);
    }
    profiles.set(profile.name, profile);
  }
  return {
    list() {
      return [...profiles.values()].map(publicView);
    },
    get(name) {
      const profile = profiles.get(name);
      if (!profile) {
        throw new ServiceError('UNKNOWN_PROFILE', `unknown preferred-pair profile "${name}"`);
      }
      return profile;
    },
  };
}

function validateProfile(entry) {
  if (!entry || typeof entry.name !== 'string' || entry.name.trim() === '') {
    throw new Error('every profile needs a non-empty "name"');
  }
  validateDegree(entry.n);
  const maskA = parsePolynomial(entry.first, entry.n, `${entry.name}.first`);
  const maskB = parsePolynomial(entry.second, entry.n, `${entry.name}.second`);
  if (!isPrimitive(maskA, entry.n)) {
    throw new Error(`profile "${entry.name}": first polynomial is not primitive`);
  }
  if (!isPrimitive(maskB, entry.n)) {
    throw new Error(`profile "${entry.name}": second polynomial is not primitive`);
  }
  const gate = checkPreferredPair(
    generateMSequence(maskA, entry.n),
    generateMSequence(maskB, entry.n),
    entry.n,
  );
  if (!gate.preferred) {
    throw new Error(`profile "${entry.name}": registered pair is not a preferred pair`);
  }
  const profile = {
    name: entry.name,
    n: entry.n,
    N: 2 ** entry.n - 1,
    first: entry.first,
    second: entry.second,
    description: entry.description || '',
  };
  return Object.freeze(profile);
}

function publicView(profile) {
  return {
    name: profile.name,
    n: profile.n,
    N: profile.N,
    first: profile.first,
    second: profile.second,
    description: profile.description,
  };
}

module.exports = { loadProfiles };
