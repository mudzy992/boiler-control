import { FlowTempInput } from '../engine/types';
import { BaseHeatingStrategy } from './base.strategy';

export class ProfileStrategy extends BaseHeatingStrategy {
  protected calculateOffsets(input: FlowTempInput) {
    let homeOffset = (input.homeProfile?.learningOffset ?? 0) || 0;
    let confidence = input.homeProfile?.confidence ?? 0.1;
    // In PROFILE_ONLY mode, confidence is slightly reduced
    confidence *= 0.8;
    homeOffset *= confidence;

    return {
      total: homeOffset,
      details: { home: homeOffset, interval: 0, events: 0 },
    };
  }

  protected calculateFactors(input: FlowTempInput): number {
    const areaFactor =
      Math.max(0, 150 - (input.homeProfile?.floorArea ?? 150)) * 0.02;
    const heightFactor =
      ((input.homeProfile?.ceilingHeight ?? 230) - 230) * 0.02;

    let windowFactor = 0;
    if (input.homeProfile?.windowType === 'TRIPLE') windowFactor = -1;
    else if (input.homeProfile?.windowType === 'DOUBLE') windowFactor = 0;

    const heatingFactor = input.homeProfile?.heatingType === 'podno' ? -2 : 0;

    return areaFactor + heightFactor + windowFactor + heatingFactor;
  }

  protected getInsulationFactor(input: FlowTempInput): number {
    let insulationFactor = 1.0;
    if (input.homeProfile?.insulationType === 'EPS') insulationFactor = 0.9;
    else if (input.homeProfile?.insulationType === 'Wool') insulationFactor = 0.85;
    return Math.max(0.7, Math.min(1, insulationFactor));
  }

  protected calculateConfidence(input: FlowTempInput): number {
    return (input.homeProfile?.confidence ?? 0.1) * 0.8;
  }
}
