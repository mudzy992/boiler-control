import { BaseHeatingStrategy } from './base.strategy';

export class AnonymousStrategy extends BaseHeatingStrategy {
  protected calculateOffsets() {
    return {
      total: 0,
      details: { home: 0, interval: 0, events: 0 },
    };
  }

  protected calculateFactors(): number {
    return 0; // standard dimensions assumed
  }

  protected getInsulationFactor(): number {
    return 1;
  }

  protected calculateConfidence(): number {
    return 0;
  }
}
