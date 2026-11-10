import { FlowTempInput, FlowTempResult } from '../engine/types';
import { HeatingCalculationStrategy } from './heating.strategy.interface';

/**
 * Sistemski raspon motora. Donja je 46 jer ispod toga kriva prestaje da ima
 * smisla za radijatore; dom je može podići (`minFlowC`), nikad spustiti ispod.
 */
export const SYSTEM_MIN_FLOW_C = 46;
export const SYSTEM_MAX_FLOW_C = 55;

export abstract class BaseHeatingStrategy implements HeatingCalculationStrategy {
  calculate(input: FlowTempInput): FlowTempResult {
    // 1. Weighted External Temp
    const weightedExternalTemp =
      0.7 * (input.weather.tempMin ?? 0) + 0.3 * (input.weather.tempMax ?? 0);
    const ext = Math.max(-15, Math.min(10, weightedExternalTemp));

    // 2. Base Curve
    const baseCurveTemp = this.calculateCurve(ext);

    // 3. Strategy specific components
    const offsets = this.calculateOffsets(input);
    const factors = this.calculateFactors(input);
    const insulationFactor = this.getInsulationFactor(input);

    // 4. Combine
    // original: base + (offsets + factors) * insulation
    const totalModifiers = (offsets.total + factors) * insulationFactor;
    let finalTemp = baseCurveTemp + totalModifiers;

    // 5. Clamp
    //
    // F13: donja granica nije više tvrda 46 nego granica DOMA (`minFlowC`), a
    // sistemska 46 ostaje kao pod. Gornja je `maxFlowC` doma, najviše 55.
    // Redoslijed je namjeran: prvo se uzima šira od dvije donje granice, pa se
    // rezultat ne može naći ispod onoga što dom dozvoljava; gornja se uvijek
    // siječe sa 55, pa neispravan zapis u bazi ne može podići polaznu iznad
    // fizičke granice kotla.
    const homeMin = input.homeProfile?.minFlowC;
    const homeMax = input.homeProfile?.maxFlowC;
    const lowerBound = Number.isFinite(homeMin)
      ? Math.max(SYSTEM_MIN_FLOW_C, homeMin as number)
      : SYSTEM_MIN_FLOW_C;
    const upperBound = Number.isFinite(homeMax)
      ? Math.min(SYSTEM_MAX_FLOW_C, Math.max(lowerBound, homeMax as number))
      : SYSTEM_MAX_FLOW_C;
    finalTemp = Math.max(lowerBound, Math.min(upperBound, finalTemp));

    return {
      baseCurveTemp,
      weightedExternalTemp: ext,
      appliedOffsets: offsets.details,
      confidence: this.calculateConfidence(input),
      finalTemp: Number(finalTemp.toFixed(2)),
    };
  }

  protected calculateCurve(ext: number): number {
    if (ext >= 10) return 45;
    if (ext <= -15) return 56;
    return 51 - ext * 0.3;
  }

  protected abstract calculateOffsets(input: FlowTempInput): {
    total: number;
    details: { home: number; interval: number; events: number };
  };

  protected abstract calculateFactors(input: FlowTempInput): number;

  protected abstract getInsulationFactor(input: FlowTempInput): number;

  protected abstract calculateConfidence(input: FlowTempInput): number;
}
