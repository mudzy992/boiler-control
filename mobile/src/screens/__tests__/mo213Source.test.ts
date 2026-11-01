import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * MO2-13 static regressions: one dashboard cache key, lifecycle-aware polling,
 * and a virtualized gas readings list.
 */
describe('MO2-13 source contracts', () => {
  const dashboard = readFileSync(join(__dirname, '../dashboard/DashboardScreen.tsx'), 'utf8');
  const heating = readFileSync(join(__dirname, '../heating/HeatingScreen.tsx'), 'utf8');
  const gas = readFileSync(join(__dirname, '../gas/GasReadingsScreen.tsx'), 'utf8');

  it('Dashboard and Heating share one dashboard query key', () => {
    expect(dashboard).toContain('DASHBOARD_QUERY_KEY');
    expect(heating).toContain('DASHBOARD_QUERY_KEY');
    expect(heating).not.toContain('dashboard-heating');
  });

  it('Heating polling follows AppState', () => {
    expect(heating).toContain('useAppState');
    expect(heating).toContain('dashboardRefetchInterval(appState)');
  });

  it('Gas readings list is virtualized with a stable key extractor', () => {
    expect(gas).toContain('<FlatList');
    expect(gas).toContain('keyExtractor={(item) => String(item.id)}');
    expect(gas).toContain('renderItem={renderReadingItem}');
    expect(gas).not.toContain('filteredReadings.map((reading, idx)');
  });
});
