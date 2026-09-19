/**
 * Named preferred-pair presets.
 *
 * Loaded once at process start and read-only at runtime; the service keeps no
 * cross-request state beyond this frozen table. Every preset is validated at
 * startup (primitive + preferred) so a bad build fails fast instead of
 * serving a family whose sidelobes fall outside the three-value set.
 *
 * Preset:
 *   gold-n7-demo  n=7, N=127, f1 = x^7+x^3+1 (0x89),
 *                 f2 = x^7+x^3+x^2+x+1 (0x8F),
 *                 sidelobe set { -1, 15, -17 }  (t = 16).
 */
import { checkPrimitive } from './gf2.js';
import { generateMSequence } from './msequence.js';
import { evaluatePreferredPair } from './preferredPair.js';
import { describePolynomial } from './polynomialParser.js';

const REGISTRY = {
  'gold-n7-demo': {
    name: 'gold-n7-demo',
    n: 7,
    polyA: 0x89n, // x^7 + x^3 + 1
    polyB: 0x8fn, // x^7 + x^3 + x^2 + x + 1
    description:
      'Canonical n=7 (N=127) Gold preferred pair; three-value set {-1, 15, -17}.',
  },
};

function validatePresets() {
  for (const preset of Object.values(REGISTRY)) {
    const ca = checkPrimitive(preset.polyA, preset.n);
    if (!ca.primitive) {
      throw new Error(
        `preset ${preset.name}: polynomialA not primitive (${ca.reason})`
      );
    }
    const cb = checkPrimitive(preset.polyB, preset.n);
    if (!cb.primitive) {
      throw new Error(
        `preset ${preset.name}: polynomialB not primitive (${cb.reason})`
      );
    }
    const pair = evaluatePreferredPair(
      generateMSequence(preset.polyA, preset.n),
      generateMSequence(preset.polyB, preset.n),
      preset.n
    );
    if (!pair.isPreferred) {
      throw new Error(
        `preset ${preset.name}: not a preferred pair, observed ${pair.values}`
      );
    }
  }
}

validatePresets();

/** Frozen read-only view of the registry. */
export const presets = Object.freeze({ ...REGISTRY });

export function getPreset(name) {
  return REGISTRY[name] || null;
}

export function listPresets() {
  return Object.values(REGISTRY).map((p) => ({
    name: p.name,
    n: p.n,
    N: 2 ** p.n - 1,
    polynomialA: describePolynomial(p.polyA),
    polynomialB: describePolynomial(p.polyB),
    description: p.description,
  }));
}
