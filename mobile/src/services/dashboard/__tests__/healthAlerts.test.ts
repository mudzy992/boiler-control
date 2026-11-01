import { mapHealthWarningsToAlerts } from '../healthAlerts';
import type {
  HealthWarning,
  HealthWarningLevel,
  HealthWarningType,
} from '../../../types/Dashboard';

/**
 * MO2-12: the mobile client must display backend health warnings, not rebuild
 * them from local thresholds. These fixtures cover every backend warning type
 * and level, plus duplicate types in one response.
 */
const TYPES: HealthWarningType[] = [
  'shortCycles',
  'longCycles',
  'targetShortfall',
  'targetOvershoot',
  'anomalies',
];

const LEVELS: HealthWarningLevel[] = ['error', 'warning', 'info'];

function fixtureWarnings(): HealthWarning[] {
  const warnings: HealthWarning[] = [];
  for (let i = 0; i < 20; i += 1) {
    const type = TYPES[i % TYPES.length];
    const level = LEVELS[i % LEVELS.length];
    warnings.push({
      type,
      level,
      message: `backend-message-${i}`,
    });
  }
  return warnings;
}

describe('MO2-12 mapHealthWarningsToAlerts', () => {
  it('maps 20 backend fixtures without changing type-specific messages', () => {
    const warnings = fixtureWarnings();
    const alerts = mapHealthWarningsToAlerts(warnings);

    expect(alerts).toHaveLength(20);
    alerts.forEach((alert, index) => {
      expect(alert.message).toBe(`backend-message-${index}`);
      expect(alert.titleKey).toBe(`healthWarnings.${warnings[index].type}`);
      expect(alert.id).toBe(`${warnings[index].type}-${index}`);
    });
    expect(new Set(alerts.map((alert) => alert.id)).size).toBe(20);
  });

  it('maps backend levels to UI severity', () => {
    const alerts = mapHealthWarningsToAlerts([
      { type: 'anomalies', level: 'error', message: 'e' },
      { type: 'targetShortfall', level: 'warning', message: 'w' },
      { type: 'longCycles', level: 'info', message: 'i' },
    ]);

    expect(alerts.map((alert) => alert.severity)).toEqual(['critical', 'warning', 'info']);
  });

  it('returns an empty list for missing or empty warnings', () => {
    expect(mapHealthWarningsToAlerts()).toEqual([]);
    expect(mapHealthWarningsToAlerts([])).toEqual([]);
  });

  it('does not mutate the backend response', () => {
    const warnings = fixtureWarnings();
    const snapshot = JSON.stringify(warnings);
    mapHealthWarningsToAlerts(warnings);
    expect(JSON.stringify(warnings)).toBe(snapshot);
  });
});
