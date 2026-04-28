import { FlowTempInput, FlowTempResult } from '../engine/types';
import { HeatingCalculationStrategy } from './heating.strategy.interface';

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
    finalTemp = Math.max(46, Math.min(55, finalTemp));

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
