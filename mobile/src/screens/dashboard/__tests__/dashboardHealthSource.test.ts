import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * MO2-12 static regression: health score and alert thresholds must stay in the
 * backend. The mobile dashboard may render the backend response, but it must
 * not reintroduce the old local formula or threshold constants.
 */
describe('MO2-12 dashboard health source contract', () => {
  const dashboardSource = readFileSync(join(__dirname, '../DashboardScreen.tsx'), 'utf8');
  const alertsSource = readFileSync(join(__dirname, '../../../components/AlertsCard.tsx'), 'utf8');

  it('dashboard reads backend health and has no local health formula', () => {
    expect(dashboardSource).toContain('getDashboardHealth');
    expect(dashboardSource).not.toContain('calculateSystemHealthMetrics');
    expect(dashboardSource).not.toContain('12.5');
    expect(dashboardSource).not.toContain('flowDelta');
  });

  it('AlertsCard renders backend warnings and has no local alert thresholds', () => {
    expect(alertsSource).toContain('mapHealthWarningsToAlerts');
    expect(alertsSource).not.toContain('tempDiff > 5');
    expect(alertsSource).not.toContain('avgConfidence < 0.3');
    expect(alertsSource).not.toContain('hoursSinceLastSeen > 24');
  });
});
