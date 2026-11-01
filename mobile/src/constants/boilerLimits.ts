/**
 * MO2-15: current flow temperature limits must stay aligned with backend
 * `SetCurrentTempDto` / `BoilerService` (48–55 °C). The API does not expose
 * these limits in the recommendation payload, so the mobile client keeps one
 * shared constant instead of duplicating literals in screens.
 */
export const MIN_CURRENT_FLOW_TEMP = 48;
export const MAX_CURRENT_FLOW_TEMP = 55;

export function isWithinCurrentFlowTempRange(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_CURRENT_FLOW_TEMP && value <= MAX_CURRENT_FLOW_TEMP;
}
