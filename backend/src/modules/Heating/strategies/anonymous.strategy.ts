import { FlowTempInput } from '../engine/types';
import { BaseHeatingStrategy } from './base.strategy';

export class AnonymousStrategy extends BaseHeatingStrategy {
  protected calculateOffsets(input: FlowTempInput) {
    return {
      total: 0,
      details: { home: 0, interval: 0, events: 0 },
    };
  }

  protected calculateFactors(input: FlowTempInput): number {
    return 0; // standard dimensions assumed
  }

  protected getInsulationFactor(input: FlowTempInput): number {
    return 1;
  }

  protected calculateConfidence(input: FlowTempInput): number {
    return 0;
  }
}
