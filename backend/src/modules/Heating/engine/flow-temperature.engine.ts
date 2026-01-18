// heating/engine/flow-temperature.engine.ts

import { FlowTempInput, FlowTempResult } from './types';

export class FlowTemperatureEngine {
  static calculate(input: FlowTempInput): FlowTempResult {
    // 1️⃣ Weighted external temp
    const weightedExternalTemp =
      0.7 * (input.weather.tempMin ?? 0) + 0.3 * (input.weather.tempMax ?? 0);
    const ext = Math.max(-15, Math.min(10, weightedExternalTemp));

    // 2️⃣ Base curve (statistički)
    const baseCurveTemp = this.calculateCurve(ext);

    // 3️⃣ Home profile adaptive offset
    let homeOffset = (input.homeProfile?.learningOffset ?? 0) || 0;
    let confidence = input.homeProfile?.confidence ?? 0.1;
    if (input.mode === 'PROFILE_ONLY') confidence *= 0.8;
    homeOffset *= confidence;

    // 4️⃣ Interval learning adaptive offset
    let intervalOffset = 0;
    if (input.mode === 'FULL' && input.intervalLearning) {
      const overshootCorrection = input.intervalLearning.avgOvershoot ?? 0;
      const reachTimeCorrection = input.intervalLearning.avgReachTimeMin
        ? this.reachTimeAdjustment(input.intervalLearning.avgReachTimeMin)
        : 0;

      intervalOffset =
        (input.intervalLearning.offset ?? 0) +
        overshootCorrection * 0.5 +
        reachTimeCorrection * 0.2;

      // Morning-specific adjustment
      if (input.intervalKey?.includes('morning')) intervalOffset *= 0.6;
    }

    // 5️⃣ Recent heating events adaptive
    let eventOffset = 0;
    if (input.mode === 'FULL' && input.recentEvents?.length) {
      eventOffset = input.recentEvents.reduce((acc, e, idx) => {
        const weight = e.active ? 0.15 : 0.05;
        const decay = Math.exp(-0.25 * idx); // više težine novijim događajima
        return acc + e.delta * weight * decay;
      }, 0);
      if (input.intervalKey?.includes('morning')) eventOffset *= 0.5;
    }

    // 6️⃣ Home-specific factors
    const areaFactor =
      Math.max(0, 150 - (input.homeProfile?.floorArea ?? 150)) * 0.02;
    const heightFactor =
      ((input.homeProfile?.ceilingHeight ?? 230) - 230) * 0.02;
    let insulationFactor = 1.0;
    if (input.homeProfile?.insulationType === 'EPS') insulationFactor = 0.9;
    else if (input.homeProfile?.insulationType === 'Wool')
      insulationFactor = 0.85;
    insulationFactor = Math.max(0.7, Math.min(1, insulationFactor));
    let windowFactor = 0;
    if (input.homeProfile?.windowType === 'TRIPLE') windowFactor = -1;
    else if (input.homeProfile?.windowType === 'DOUBLE') windowFactor = 0;
    const heatingFactor = input.homeProfile?.heatingType === 'podno' ? -2 : 0;

    // 7️⃣ Compute final flow temperature
    let finalTemp =
      baseCurveTemp +
      (homeOffset +
        intervalOffset +
        eventOffset +
        areaFactor +
        heightFactor +
        windowFactor +
        heatingFactor) *
        insulationFactor;

    // 8️⃣ Clamp final temperature
    finalTemp = Math.max(35, Math.min(56, finalTemp));

    return {
      baseCurveTemp,
      weightedExternalTemp: ext,
      appliedOffsets: {
        home: homeOffset,
        interval: intervalOffset,
        events: eventOffset,
      },
      confidence,
      finalTemp: Number(finalTemp.toFixed(2)),
    };
  }

  /** Convert average reach time to small adaptive correction */
  private static reachTimeAdjustment(avgReachTimeMin: number): number {
    // brže grijanje -> smanji temp, sporije -> povisi
    const targetTime = 30; // cilj u minutama za normalni interval
    return Math.max(-1, Math.min(1, (targetTime - avgReachTimeMin) * 0.05));
  }

  private static calculateCurve(ext: number): number {
    if (ext >= 10) return 45;
    if (ext <= -15) return 56;
    return 51 - ext * 0.3;
  }
}
