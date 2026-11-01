import {
  MAX_CURRENT_FLOW_TEMP,
  MIN_CURRENT_FLOW_TEMP,
  isWithinCurrentFlowTempRange,
} from '../boilerLimits';

/** MO2-15: mobile limits must match backend SetCurrentTempDto/BoilerService. */
describe('MO2-15 boiler current flow temperature limits', () => {
  it('uses the backend-aligned 48–55 range', () => {
    expect(MIN_CURRENT_FLOW_TEMP).toBe(48);
    expect(MAX_CURRENT_FLOW_TEMP).toBe(55);
  });

  it.each([
    [47.9, false],
    [48, true],
    [52.5, true],
    [55, true],
    [55.1, false],
    [Number.NaN, false],
  ])('validates %s as %s', (value, expected) => {
    expect(isWithinCurrentFlowTempRange(value)).toBe(expected);
  });
});
