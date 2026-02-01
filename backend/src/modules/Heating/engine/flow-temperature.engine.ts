import { FlowTempInput, FlowTempResult } from './types';
import { HeatingCalculationStrategy } from '../strategies/heating.strategy.interface';
import { AnonymousStrategy } from '../strategies/anonymous.strategy';
import { ProfileStrategy } from '../strategies/profile.strategy';
import { FullStrategy } from '../strategies/full.strategy';

export class FlowTemperatureEngine {
  static calculate(input: FlowTempInput): FlowTempResult {
    let strategy: HeatingCalculationStrategy;

    switch (input.mode) {
      case 'FULL':
        strategy = new FullStrategy();
        break;
      case 'PROFILE_ONLY':
        strategy = new ProfileStrategy();
        break;
      case 'ANONYMOUS':
      default:
        strategy = new AnonymousStrategy();
        break;
    }

    return strategy.calculate(input);
  }
}
