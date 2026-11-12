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
      version: 2,
      // F4.3: bez `engine` u meta, snimak ne tvrdi koji je motor dao broj.
      engine: null,
      model: null,
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
    // F4.3: `engine` i `model` su nova polja ugovora. Skup se i dalje
    // zaključava tačno — aditivno ne znači „bilo šta smije ući".
    expect(Object.keys(snapshot).sort()).toEqual([
      'appliedOffsets',
      'baseCurveTemp',
      'confidence',
      'engine',
      'expectedHeatTimeMin',
      'finalTemp',
      'intervalKey',
      'mode',
      'model',
      'samples',
      'version',
      'weightedExternalTemp',
    ]);
    expect(snapshot).not.toHaveProperty('userId');
    expect(snapshot).not.toHaveProperty('deviceId');
    expect(snapshot).not.toHaveProperty('homeProfileId');
  });

  describe('F4.3/F4.4 modelski put', () => {
    const modelMeta = {
      mode: 'FULL' as const,
      intervalKey: 'weekday_morning',
      engine: 'model' as const,
      model: {
        slopeS: 0.94,
        slopeSource: 'CI_HIGH' as const,
        internalGainC: 1.02,
        dayGainC: 0,
        outdoorRefC: -3.4,
        outdoorRefSource: 'NIGHT_DAY_BLEND' as const,
        equilibriumFlowC: 44.04,
        reasons: [],
      },
    };

    it('kriva nije izmišljena kad je motor model — polja su null, ne 0', () => {
      const snapshot = buildRecommendationBreakdown(result, modelMeta);

      // `0` bi klijentu dao „0,00 °C"; `null` mu kaže „prikaži model".
      expect(snapshot.baseCurveTemp).toBeNull();
      expect(snapshot.weightedExternalTemp).toBeNull();
      expect(snapshot.appliedOffsets).toBeNull();
      expect(snapshot.engine).toBe('model');
    });

    it('nosi članove izraza, da se broj može objasniti bez rekonstrukcije', () => {
      const snapshot = buildRecommendationBreakdown(result, modelMeta);
      expect(snapshot.model).toEqual(modelMeta.model);
      expect(snapshot.model?.equilibriumFlowC).toBe(44.04);
      expect(snapshot.model?.outdoorRefSource).toBe('NIGHT_DAY_BLEND');
    });

    it('model je null kad motor nije model — ne mijenja se ugovor za krivu', () => {
      const snapshot = buildRecommendationBreakdown(result, {
        ...modelMeta,
        engine: 'curve',
      });
      expect(snapshot.model).toBeNull();
      expect(snapshot.baseCurveTemp).toBe(51.123456);
    });

    it('finalTemp i confidence se ne mijenjaju zbog motora', () => {
      // Breakdown je **snimak**, ne proračun: motor mijenja šta je u njemu,
      // ne broj koji je već izračunat.
      const asCurve = buildRecommendationBreakdown(result, {
        ...modelMeta,
        engine: 'curve',
      });
      const asModel = buildRecommendationBreakdown(result, modelMeta);
      expect(asModel.finalTemp).toBe(asCurve.finalTemp);
      expect(asModel.confidence).toBe(asCurve.confidence);
    });
  });
});
