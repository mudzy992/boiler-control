import { describe, expect, it } from 'vitest';
import {
  computeHeatingProgress,
  resolveExpectedHeatTimeMin,
  resolveOpenHeatingStartedAt,
} from '../compute-heating-progress';

describe('computeHeatingProgress', () => {
  const startedAt = '2026-11-07T10:00:00.000Z';
  const now = Date.parse('2026-11-07T10:15:00.000Z');

  it('returns idle when heating is off', () => {
    const actual = computeHeatingProgress({
      now,
      startedAt,
      expectedHeatTimeMin: 30,
      isHeatingActive: false,
    });
    expect(actual.mode).toBe('idle');
    expect(actual.ratio).toBe(0);
  });

  it('returns running mid-cycle ratio', () => {
    const actual = computeHeatingProgress({
      now,
      startedAt,
      expectedHeatTimeMin: 30,
      isHeatingActive: true,
    });
    expect(actual.mode).toBe('running');
    expect(actual.elapsedMin).toBe(15);
    expect(actual.expectedMin).toBe(30);
    expect(actual.ratio).toBeCloseTo(0.5);
    expect(actual.overtimeMin).toBe(0);
  });

  it('returns overtime when elapsed exceeds estimate', () => {
    const overtimeNow = Date.parse('2026-11-07T10:40:00.000Z');
    const actual = computeHeatingProgress({
      now: overtimeNow,
      startedAt,
      expectedHeatTimeMin: 30,
      isHeatingActive: true,
    });
    expect(actual.mode).toBe('overtime');
    expect(actual.ratio).toBe(1);
    expect(actual.overtimeMin).toBe(10);
  });

  it('returns no-estimate when expected time missing', () => {
    const actual = computeHeatingProgress({
      now,
      startedAt,
      expectedHeatTimeMin: null,
      isHeatingActive: true,
    });
    expect(actual.mode).toBe('no-estimate');
    expect(actual.elapsedMin).toBe(15);
    expect(actual.ratio).toBe(0);
  });
});

describe('resolveOpenHeatingStartedAt', () => {
  it('picks the open event startedAt', () => {
    const actual = resolveOpenHeatingStartedAt([
      { startedAt: 'a', endedAt: 'b' },
      { startedAt: 'open-start', endedAt: null },
    ]);
    expect(actual).toBe('open-start');
  });
});

describe('resolveExpectedHeatTimeMin', () => {
  it('prefers top-level then breakdown', () => {
    expect(
      resolveExpectedHeatTimeMin({
        expectedHeatTimeMin: 20,
        breakdown: { expectedHeatTimeMin: 40 },
      }),
    ).toBe(20);
    expect(
      resolveExpectedHeatTimeMin({
        expectedHeatTimeMin: 0,
        breakdown: { expectedHeatTimeMin: 40 },
      }),
    ).toBe(40);
  });
});
