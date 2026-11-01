import type { FlowCalcMode, FlowTempResult } from '../Heating/engine/types';

/**
 * FE2-10: additive, read-only snapshot of the engine breakdown.
 *
 * This does not recalculate or change the recommendation. It only captures the
 * values already produced by FlowTemperatureEngine so clients can explain the
 * recommendation without reconstructing the formula.
 */
export interface RecommendationBreakdownSnapshot {
  version: 1;
  mode: FlowCalcMode;
  intervalKey: string | null;
  baseCurveTemp: number;
  weightedExternalTemp: number;
  appliedOffsets: {
    home: number;
    interval: number;
    events: number;
  };
  finalTemp: number;
  confidence: number;
  samples: number | null;
  expectedHeatTimeMin: number | null;
}

export interface RecommendationBreakdownMeta {
  mode: FlowCalcMode;
  intervalKey?: string | null;
  samples?: number | null;
  expectedHeatTimeMin?: number | null;
}

export function buildRecommendationBreakdown(
  result: FlowTempResult,
  meta: RecommendationBreakdownMeta,
): RecommendationBreakdownSnapshot {
  return {
    version: 1,
    mode: meta.mode,
    intervalKey: meta.intervalKey ?? null,
    baseCurveTemp: result.baseCurveTemp,
    weightedExternalTemp: result.weightedExternalTemp,
    appliedOffsets: {
      home: result.appliedOffsets.home,
      interval: result.appliedOffsets.interval,
      events: result.appliedOffsets.events,
    },
    finalTemp: result.finalTemp,
    confidence: result.confidence,
    samples: meta.samples ?? null,
    expectedHeatTimeMin: meta.expectedHeatTimeMin ?? null,
  };
}
