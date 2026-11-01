import {
  buildRecommendationBreakdown,
  type RecommendationBreakdownSnapshot,
} from '../recommendation-breakdown';
import type { FlowTempResult } from '../../Heating/engine/types';

/**
 * FE2-10: the breakdown is an additive snapshot of the engine result.
 * It must not recalculate, round, clamp, or otherwise change the recommendation.
 */
describe('FE2-10 recommendation breakdown snapshot', () => {
  const result: FlowTempResult = {
    baseCurveTemp: 51.123456,
    weightedExternalTemp: -2.5,
    appliedOffsets: {
      home: 0.25,
      interval: -0.5,
      events: 0.125,
    },
    finalTemp: 50.998456,
    confidence: 0.72,
  };

  it('copies the engine result without changing numeric values', () => {
    const snapshot = buildRecommendationBreakdown(result, {
      mode: 'FULL',
      intervalKey: 'weekday_morning',
      samples: 8,
      expectedHeatTimeMin: 27.5,
    });

    expect(snapshot).toEqual<RecommendationBreakdownSnapshot>({
      version: 1,
      mode: 'FULL',
      intervalKey: 'weekday_morning',
      baseCurveTemp: 51.123456,
      weightedExternalTemp: -2.5,
      appliedOffsets: {
        home: 0.25,
        interval: -0.5,
        events: 0.125,
      },
      finalTemp: 50.998456,
      confidence: 0.72,
      samples: 8,
      expectedHeatTimeMin: 27.5,
    });
    expect(snapshot.finalTemp).toBe(result.finalTemp);
  });

  it('uses null for optional metadata that the caller does not have', () => {
    const snapshot = buildRecommendationBreakdown(result, {
      mode: 'PROFILE_ONLY',
    });

    expect(snapshot.intervalKey).toBeNull();
    expect(snapshot.samples).toBeNull();
    expect(snapshot.expectedHeatTimeMin).toBeNull();
    expect(snapshot.mode).toBe('PROFILE_ONLY');
  });

  it('does not mutate the engine result or expose extra identity fields', () => {
    const before = JSON.stringify(result);
    const snapshot = buildRecommendationBreakdown(result, {
      mode: 'ANONYMOUS',
      intervalKey: null,
      samples: 0,
      expectedHeatTimeMin: 0,
    });

    expect(JSON.stringify(result)).toBe(before);
    expect(Object.keys(snapshot).sort()).toEqual([
      'appliedOffsets',
      'baseCurveTemp',
      'confidence',
      'expectedHeatTimeMin',
      'finalTemp',
      'intervalKey',
      'mode',
      'samples',
      'version',
      'weightedExternalTemp',
    ]);
    expect(snapshot).not.toHaveProperty('userId');
    expect(snapshot).not.toHaveProperty('deviceId');
    expect(snapshot).not.toHaveProperty('homeProfileId');
  });
});
