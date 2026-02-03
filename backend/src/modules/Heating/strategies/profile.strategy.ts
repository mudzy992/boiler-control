import {
  WindowType,
  HeatingType,
  InsulationType,
} from 'src/generated/prisma/enums';
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
    switch (input.homeProfile?.windowType) {
      case WindowType.TRIPLE_GLAZED:
        windowFactor = -1;
        break;
      case WindowType.DOUBLE_GLAZED:
        windowFactor = 0;
        break;
      case WindowType.SINGLE_GLAZED:
        windowFactor = 2;
        break;
    }

    const heatingFactor =
      input.homeProfile?.heatingType === HeatingType.UNDERFLOOR ? -2 : 0;

    return areaFactor + heightFactor + windowFactor + heatingFactor;
  }

  protected getInsulationFactor(input: FlowTempInput): number {
    let insulationFactor = 1.0;
    switch (input.homeProfile?.insulationType) {
      case InsulationType.ADVANCED:
        insulationFactor = 0.8;
        break;
      case InsulationType.MINERAL_WOOL:
        insulationFactor = 0.85;
        break;
      case InsulationType.EPS:
        insulationFactor = 0.9;
        break;
      case InsulationType.STANDARD:
        insulationFactor = 0.95;
        break;
      default:
        insulationFactor = 1.0;
    }
    return Math.max(0.7, Math.min(1, insulationFactor));
  }

  protected calculateConfidence(input: FlowTempInput): number {
    return (input.homeProfile?.confidence ?? 0.1) * 0.8;
  }
}
