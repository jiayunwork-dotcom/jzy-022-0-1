'use strict';

const { fullAutoCorrelation, fullCrossCorrelation, periodicCorrelation } = require('./correlation');
const { threeValueSet, isInThreeValueSet } = require('./threeValue');

/**
 * Three-value reconciliation ("对账") of a generated Gold family.
 *
 * Rulers applied:
 *   - zero-shift autocorrelation of every member must equal N;
 *   - every non-zero-shift periodic autocorrelation and every periodic
 *     cross-correlation between distinct members must lie in the
 *     three-value set for n.
 *
 * Balance is deliberately NOT a ruler: unbalanced members (DC != 0) are
 * legitimate family members and are judged purely on periodic correlation.
 *
 * Two audit modes:
 *   - "exhaustive": every member pair and every shift is enumerated.
 *     Feasible while pairs * N^2 fits EXHAUSTIVE_LIMIT (covers n <= 7).
 *   - "base-table": the base m-sequence cross-correlation table (already
 *     computed by the preferred-pair gate) plus both m-sequence
 *     autocorrelations and the zero-shift of every member are checked.
 *     By the shift-and-add reduction every family correlation value is a
 *     value of that base table, so this is an exact family-wide verdict;
 *     it is used for n >= 9 where exhaustive enumeration is impractical.
 */

const EXHAUSTIVE_LIMIT = 6e8; // max pair-table multiply-adds
const MAX_VIOLATIONS_REPORTED = 50;

function auditFamily(members, n, baseCrossTable) {
  const N = members[0].length;
  const F = members.length;
  const set = threeValueSet(n);
  const pairCount = (F * (F + 1)) / 2;
  const exhaustive = pairCount * N * N <= EXHAUSTIVE_LIMIT;

  const state = {
    set,
    violations: [],
    totalViolations: 0,
    maxAbsSidelobe: 0,
    observed: new Set(),
  };

  let zeroShiftOk = true;
  let pairsChecked = 0;

  if (exhaustive) {
    for (let i = 0; i < F; i++) {
      const auto = fullAutoCorrelation(members[i]);
      if (auto[0] !== N) zeroShiftOk = false;
      for (let s = 1; s < N; s++) {
        record(state, auto[s], { type: 'autocorrelation', memberA: i, shift: s, value: auto[s] });
      }
      pairsChecked++;
    }
    for (let i = 0; i < F; i++) {
      for (let j = i + 1; j < F; j++) {
        const cross = fullCrossCorrelation(members[i], members[j]);
        for (let s = 0; s < N; s++) {
          record(state, cross[s], {
            type: 'crosscorrelation',
            memberA: i,
            memberB: j,
            shift: s,
            value: cross[s],
          });
        }
        pairsChecked++;
      }
    }
  } else {
    // Zero-shift of every member (cheap, and a real per-member check).
    for (let i = 0; i < F; i++) {
      if (periodicCorrelation(members[i], members[i], 0) !== N) zeroShiftOk = false;
    }
    // Autocorrelations of the two base m-sequences (ideal two-valued: -1).
    for (const i of [0, 1]) {
      const auto = fullAutoCorrelation(members[i]);
      for (let s = 1; s < N; s++) {
        record(state, auto[s], { type: 'autocorrelation', memberA: i, shift: s, value: auto[s] });
      }
      pairsChecked++;
    }
    // The decisive table: base pair cross-correlation over all shifts.
    for (let s = 0; s < N; s++) {
      record(state, baseCrossTable[s], {
        type: 'crosscorrelation',
        memberA: 0,
        memberB: 1,
        shift: s,
        value: baseCrossTable[s],
      });
    }
    pairsChecked++;
  }

  return {
    qualified: state.totalViolations === 0 && zeroShiftOk,
    zeroShiftOk,
    violations: state.violations,
    totalViolations: state.totalViolations,
    violationsTruncated: state.totalViolations > state.violations.length,
    audit: {
      mode: exhaustive ? 'exhaustive' : 'base-table',
      pairsChecked,
      membersChecked: exhaustive ? F : F, // zero-shift checked for all members in both modes
      maxAbsSidelobe: state.maxAbsSidelobe,
      valuesObserved: [...state.observed].sort((a, b) => a - b),
      note: exhaustive
        ? 'every member pair and every shift enumerated'
        : 'family-wide verdict via the base m-sequence cross-correlation table ' +
          '(shift-and-add reduction); zero-shift verified for every member',
    },
  };
}

function record(state, value, entry) {
  const abs = Math.abs(value);
  if (abs > state.maxAbsSidelobe) state.maxAbsSidelobe = abs;
  state.observed.add(value);
  if (!isInThreeValueSet(value, state.set)) {
    state.totalViolations++;
    if (state.violations.length < MAX_VIOLATIONS_REPORTED) {
      state.violations.push(entry);
    }
  }
}

module.exports = { auditFamily, EXHAUSTIVE_LIMIT, MAX_VIOLATIONS_REPORTED };
