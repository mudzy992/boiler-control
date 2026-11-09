import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * `36` — gdje je traka grijanja uključena.
 *
 * Zašto izvor, a ne render: svaki render `DashboardScreen`-a ostavlja otvoren
 * handle u jest okruženju (`Jest did not exit one second after the test run has
 * completed`) i to postoji i bez ove izmjene — dokazano tako što je dodatni
 * render dodat na nepromijenjen ekran i proces i dalje nije izašao. Zato se
 * ponašanje modela mjeri testovima (`lib/__tests__/heating-progress`), traka
 * renderuje u `ui/__tests__/heatingProgressBar`, a ovdje se čuva da je
 * povezivanje na ekranima na mjestu.
 */
describe('Heating progress source contracts (`36`)', () => {
  const dashboard = readFileSync(join(__dirname, '../dashboard/DashboardScreen.tsx'), 'utf8');
  const heating = readFileSync(join(__dirname, '../heating/HeatingScreen.tsx'), 'utf8');

  it('Početna prikazuje traku samo dok grijanje traje', () => {
    expect(dashboard).toContain('HeatingProgressBar');
    expect(dashboard).toContain('{isHeating ? (');
    expect(dashboard).toContain('testID="dashboard-heating-progress"');
  });

  it('Početna ne izmišlja procjenu: preporuka, pa medijana stvarnih ciklusa', () => {
    expect(dashboard).toContain('expectedHeatTimeMin');
    expect(dashboard).toContain('medianCycleMinutes');
    expect(dashboard).toContain("t('boiler.noPrediction')");
  });

  it('Grijanje prikazuje traku ciklusa po uređaju sa otvorenim događajem', () => {
    expect(heating).toContain('HeatingProgressBar');
    expect(heating).toContain('activeSinceByDevice');
    expect(heating).toContain('thermostat-heating-progress-');
    // Bez poznatog početka nema izmišljenih minuta — ostaje sobna traka.
    expect(heating).toContain('{isHeating && activeSince ? (');
  });

  it('sat se osvježava samo dok nešto grije', () => {
    expect(dashboard).toContain('if (!boilerIsHeating) return;');
    expect(heating).toContain('if (!anyHeating) return;');
  });
});
