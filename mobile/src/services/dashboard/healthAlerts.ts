import type { HealthWarning, HealthWarningLevel, HealthWarningType } from '../../types/Dashboard';

/**
 * MO2-12: backend `GET /api/dashboard/health` is the single source of truth.
 * The mobile client only maps the returned warnings to a view model; it does
 * not recompute thresholds or messages.
 */
export type HealthAlertSeverity = 'critical' | 'warning' | 'info';

export interface HealthAlertViewModel {
  id: string;
  severity: HealthAlertSeverity;
  titleKey: string;
  message: string;
  icon: string;
}

const LEVEL_TO_SEVERITY: Record<HealthWarningLevel, HealthAlertSeverity> = {
  error: 'critical',
  warning: 'warning',
  info: 'info',
};

const WARNING_ICONS: Record<HealthWarningType, string> = {
  shortCycles: 'timer-alert-outline',
  longCycles: 'timer-sand',
  targetShortfall: 'thermometer-chevron-down',
  targetOvershoot: 'thermometer-chevron-up',
  anomalies: 'alert-circle-outline',
};

export function mapHealthWarningsToAlerts(
  warnings: readonly HealthWarning[] = []
): HealthAlertViewModel[] {
  return warnings.map((warning, index) => ({
    id: `${warning.type}-${index}`,
    severity: LEVEL_TO_SEVERITY[warning.level] ?? 'info',
    titleKey: `healthWarnings.${warning.type}`,
    message: warning.message,
    icon: WARNING_ICONS[warning.type] ?? 'alert-circle-outline',
  }));
}
