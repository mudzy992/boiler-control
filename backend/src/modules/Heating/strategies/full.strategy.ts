import { FlowTempInput } from '../engine/types';
import { ProfileStrategy } from './profile.strategy';

export class FullStrategy extends ProfileStrategy {
  protected calculateOffsets(input: FlowTempInput) {
    // 1. Home Offset (reused logic but full confidence)
    let homeOffset = (input.homeProfile?.learningOffset ?? 0) || 0;
    const confidence = input.homeProfile?.confidence ?? 0.1;
    // No 0.8 reduction here
    homeOffset *= confidence;

    // 2. Interval Offset
    let intervalOffset = 0;
    if (input.intervalLearning) {
      const overshootCorrection = input.intervalLearning.avgOvershoot ?? 0;
      const reachTimeCorrection = input.intervalLearning.avgReachTimeMin
        ? this.reachTimeAdjustment(input.intervalLearning.avgReachTimeMin)
        : 0;

      intervalOffset =
        (input.intervalLearning.offset ?? 0) +
        overshootCorrection * 0.5 +
        reachTimeCorrection * 0.2;

      if (input.intervalKey?.includes('morning')) intervalOffset *= 0.6;
    }

    // 3. Events Offset
    let eventOffset = 0;
    if (input.recentEvents?.length) {
      eventOffset = input.recentEvents.reduce((acc, e, idx) => {
        const weight = e.active ? 0.15 : 0.05;
        const decay = Math.exp(-0.25 * idx);
        return acc + e.delta * weight * decay;
      }, 0);
      if (input.intervalKey?.includes('morning')) eventOffset *= 0.5;
    }

    return {
      total: homeOffset + intervalOffset + eventOffset,
      details: { home: homeOffset, interval: intervalOffset, events: eventOffset },
    };
  }

  protected calculateConfidence(input: FlowTempInput): number {
    return input.homeProfile?.confidence ?? 0.1;
  }

  private reachTimeAdjustment(avgReachTimeMin: number): number {
    const targetTime = 30;
    return Math.max(-1, Math.min(1, (targetTime - avgReachTimeMin) * 0.05));
  }
}
