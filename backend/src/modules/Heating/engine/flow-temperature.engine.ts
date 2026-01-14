// heating/engine/flow-temperature.engine.ts

import { FlowTempInput, FlowTempResult } from './types';

export class FlowTemperatureEngine {
  static calculate(input: FlowTempInput): FlowTempResult {
    // 1️⃣ Weighted external temp
    const weightedExternalTemp =
      0.7 * input.weather.tempMin + 0.3 * input.weather.tempMax;
    const ext = Math.max(-15, Math.min(10, weightedExternalTemp));

    // 2️⃣ Base curve
    const baseCurveTemp = this.calculateCurve(ext);

    // 3️⃣ Home profile offsets
    const home = input.homeProfile;
    let homeOffset = home.learningOffset ?? 0;
    let confidence = home.confidence ?? 0.1;
    if (input.mode === 'PROFILE_ONLY') confidence *= 0.8;
    homeOffset *= confidence;

    // 4️⃣ Interval learning
    let intervalOffset = 0;
    if (input.mode === 'FULL' && input.intervalLearning) {
      const isMorning = input.intervalKey?.includes('morning') ?? false;
      const morningWeight = isMorning ? 0.4 : 1.0;
      intervalOffset = input.intervalLearning.offset * morningWeight;
    }

    // 5️⃣ Recent heating events
    let eventOffset = 0;
    if (input.mode === 'FULL' && input.recentEvents?.length) {
      const isMorning = input.intervalKey?.includes('morning') ?? false;
      eventOffset = input.recentEvents.reduce((acc, e) => {
        const weight = e.active ? 0.1 : 0.05;
        return acc + e.delta * weight;
      }, 0);
      if (isMorning) eventOffset *= 0.5;
    }

    // 6️⃣ Floor area adjustment
    const areaFactor =
      home.floorArea >= 150 ? 0 : (150 - home.floorArea) * 0.02;

    // 7️⃣ Ceiling height adjustment
    const heightFactor = ((home.ceilingHeight ?? 230) - 230) * 0.02;

    // 8️⃣ Insulation adjustment
    let insulationFactor = 1.0;
    if (home.insulationType === 'EPS') insulationFactor = 0.9;
    else if (home.insulationType === 'Wool') insulationFactor = 0.85;
    if (home.insulationThickness) {
      // linear adjustment: deblja izolacija smanjuje temp
      insulationFactor *= 1 - (15 - home.insulationThickness) * 0.01;
    }

    // 9️⃣ Window adjustment
    let windowFactor = 0;
    if (home.windowType === 'TRIPLE') windowFactor = -1;
    else if (home.windowType === 'DOUBLE') windowFactor = 0;

    // 🔟 Heating type adjustment
    let heatingFactor = 0;
    if (home.heatingType === 'podno') heatingFactor = -2;

    // 11️⃣ Final temperature
    let finalTemp =
      baseCurveTemp +
      homeOffset +
      intervalOffset +
      eventOffset +
      areaFactor +
      heightFactor +
      windowFactor +
      heatingFactor;

    finalTemp *= insulationFactor; // primjena faktora izolacije

    // Clamp između 35 i 56
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

  private static calculateCurve(ext: number): number {
    if (ext >= 10) return 45;
    if (ext <= -15) return 56;
    return 51 - ext * 0.3;
  }
}
