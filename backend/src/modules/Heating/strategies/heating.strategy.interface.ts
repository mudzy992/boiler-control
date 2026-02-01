import { FlowTempInput, FlowTempResult } from '../engine/types';

export interface HeatingCalculationStrategy {
  calculate(input: FlowTempInput): FlowTempResult;
}
