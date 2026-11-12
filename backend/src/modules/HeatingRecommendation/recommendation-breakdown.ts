import type { FlowCalcMode, FlowTempResult } from '../Heating/engine/types';

/**
 * FE2-10: additive, read-only snapshot of the engine breakdown.
 *
 * This does not recalculate or change the recommendation. It only captures the
 * values already produced by FlowTemperatureEngine so clients can explain the
 * recommendation without reconstructing the formula.
 */
export type RecommendationBreakdownSnapshot = {
  /**
   * `2` od F4.3: snapshot nosi `engine` i (kad je model) članove izraza.
   * Klijent koji čita `1` i dalje radi — polja su aditivna — ali verzija
   * kaže šta smije očekivati, a ne da pretpostavlja po prisustvu polja.
   */
  version: 1 | 2;
  /**
   * F4.3: koji je motor dao broj. `null` za redove zapisane prije F4.3 —
   * namjerno, a ne `'curve'`: stari red ne tvrdi koji ga je motor dao.
   */
  engine: 'curve' | 'model' | null;
  mode: FlowCalcMode;
  intervalKey: string | null;
  /**
   * F4.4: kad je motor `model`, krive nema — polje je `null`. `0` bi bio
   * izmišljen broj, a klijent bi prikazao „0,00 °C".
   */
  baseCurveTemp: number | null;
  weightedExternalTemp: number | null;
  appliedOffsets: {
    home: number;
    interval: number;
    events: number;
  } | null;
  finalTemp: number;
  confidence: number;
  samples: number | null;
  expectedHeatTimeMin: number | null;
  /**
   * F4.3: članovi ravnotežnog izraza — samo kad je motor `model`. Bez ovoga
   * klijent ne može objasniti broj bez rekonstrukcije formule, a to je i bio
   * razlog postojanja breakdown-a.
   */
  model: {
    slopeS: number | null;
    slopeSource: 'CI_HIGH' | 'POINT' | null;
    internalGainC: number;
    dayGainC: number;
    outdoorRefC: number | null;
    outdoorRefSource: 'NIGHT' | 'NIGHT_DAY_BLEND' | null;
    /** Ravnotežna polazna prije kontrolera; kontroler je može podići/spustiti. */
    equilibriumFlowC: number | null;
    reasons: string[];
  } | null;
};

export interface RecommendationBreakdownMeta {
  /** F4.3: motor koji je dao `finalTemp`. */
  engine?: 'curve' | 'model' | null;
  /** F4.3: članovi modela, kad je motor `model`. */
  model?: RecommendationBreakdownSnapshot['model'];
  mode: FlowCalcMode;
  intervalKey?: string | null;
  samples?: number | null;
  expectedHeatTimeMin?: number | null;
}

export function buildRecommendationBreakdown(
  result: FlowTempResult,
  meta: RecommendationBreakdownMeta,
): RecommendationBreakdownSnapshot {
  const engine = meta.engine ?? null;

  return {
    version: 2,
    engine,
    mode: meta.mode,
    intervalKey: meta.intervalKey ?? null,
    // F4.4: modelski put nema krivu. `null` je tvrdnja „krive nema" i klijent
    // je prikazuje kao odsustvo, dok bi `0` bio izmišljen broj („0,00 °C").
    baseCurveTemp: engine === 'model' ? null : result.baseCurveTemp,
    weightedExternalTemp: engine === 'model' ? null : result.weightedExternalTemp,
    appliedOffsets:
      engine === 'model'
        ? null
        : {
            home: result.appliedOffsets.home,
            interval: result.appliedOffsets.interval,
            events: result.appliedOffsets.events,
          },
    finalTemp: result.finalTemp,
    confidence: result.confidence,
    samples: meta.samples ?? null,
    expectedHeatTimeMin: meta.expectedHeatTimeMin ?? null,
    model: engine === 'model' ? (meta.model ?? null) : null,
  };
}
