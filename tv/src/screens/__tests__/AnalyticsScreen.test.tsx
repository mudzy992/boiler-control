import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { AnalyticsScreen } from '../AnalyticsScreen';

/**
 * Ekran analitike.
 *
 * Najvažnija tvrdnja: **nedostajuće mjerenje se ne prikazuje kao nula**, i
 * prazno stanje **kaže zašto** je prazno. Bez toga TV izgleda kao kvar.
 */

const translate = (key: string) => key;

function renderScreen(
  overrides: Partial<React.ComponentProps<typeof AnalyticsScreen>> = {},
) {
  return render(
    <AnalyticsScreen
      analysis={{ consumptionFromReferenceM3: 12.5, costIncVat: 25 }}
      dashboard={{
        system: {
          weather: { temp: 6.5 },
          boiler: { actualFlowTemp: 48 },
        },
        homes: [
          { thermostats: [{ roomCurrentTemp: 20.5, roomTargetTemp: 22 }] },
        ],
      }}
      loading={false}
      error={null}
      updatedAt={Date.now()}
      translate={translate}
      {...overrides}
    />,
  );
}

describe('TV analitika', () => {
  it('prikazuje četiri tražene vrijednosti u dogovorenom redoslijedu', async () => {
    await renderScreen();

    expect(screen.getByText('weather.currentShort')).toBeTruthy();
    expect(screen.getByText('thermostat.title')).toBeTruthy();
    expect(screen.getByText('Cilj: 22.0 °C')).toBeTruthy();
    expect(screen.getByText('boiler.flowTemp')).toBeTruthy();
    expect(screen.getByText('gas.metricCostIncVat')).toBeTruthy();
    expect(screen.getByText('6.5')).toBeTruthy();
    expect(screen.getByText('20.5')).toBeTruthy();
    expect(screen.getByText('48.0')).toBeTruthy();
    expect(screen.getByText('25.00')).toBeTruthy();

    expect(
      screen.getAllByTestId(/^tv-metric-/).map((card) => card.props.testID),
    ).toEqual([
      'tv-metric-outside',
      'tv-metric-thermostat',
      'tv-metric-flow',
      'tv-metric-cost',
    ]);
  });

  it('analitika se može scrollati daljinskim i fokusira prvu karticu', async () => {
    await renderScreen();

    const scroll = screen.getByTestId('tv-analytics-scroll');
    const firstMetric = screen.getByTestId('tv-metric-outside');
    expect(scroll.props.scrollEnabled).toBe(true);
    expect(firstMetric.props.focusable).toBe(true);
    expect(firstMetric.props.hasTVPreferredFocus).toBe(true);
    expect(screen.getByTestId('tv-metric-thermostat').props.focusable).toBe(
      true,
    );
  });

  it('mjerenja ima ali sva su nula — prikazuje nule, ne prazno stanje', async () => {
    // 0 je mjerenje: u periodu nije potrošeno ništa. Prazno stanje ovdje bi
    // bilo laž („nema podataka") umjesto istine („nije trošeno").
    await renderScreen({ analysis: { costIncVat: 0 } });

    expect(screen.getByText('0.00')).toBeTruthy();
    expect(screen.queryByText('Još nema podataka')).toBeNull();
  });

  it('nedostajuće senzore prikazuje kao crtice, ne kao izmišljene nule', async () => {
    await renderScreen({ analysis: null, dashboard: null });

    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.queryByText('Još nema podataka')).toBeNull();
  });

  it('zastarjeli podatak je vidljiv, ne skriven', async () => {
    // TV bez mreže prikazuje iste brojeve kao TV koji radi — bez ove oznake
    // korisnik vjeruje zastarjelim podacima.
    await renderScreen({ updatedAt: Date.now() - 60 * 60 * 1000 });

    expect(screen.getByText('podaci nisu osvježeni')).toBeTruthy();
  });

  it('svjež podatak nosi oznaku ažurnosti', async () => {
    await renderScreen();
    expect(screen.getByText('ažurno')).toBeTruthy();
  });

  it('greška bez podataka kaže da analitika nije dostupna', async () => {
    await renderScreen({ analysis: null, dashboard: null, error: 'mreža' });
    expect(screen.getByText('Analitika nije dostupna')).toBeTruthy();
  });

  it('greška uz postojeće podatke ne briše podatke sa ekrana', async () => {
    // TV u kuhinji koji izgubi vezu ne smije ostati prazan: zadnji poznati
    // brojevi su korisniji od praznog ekrana, uz oznaku da nisu osvježeni.
    await renderScreen({
      analysis: { consumptionFromReferenceM3: 12.5 },
      error: 'mreža',
      updatedAt: Date.now() - 60 * 60 * 1000,
    });

    expect(screen.getByText('6.5')).toBeTruthy();
    expect(screen.getByText(/Neki podaci nisu osvježeni: mreža/)).toBeTruthy();
    expect(screen.getByText('podaci nisu osvježeni')).toBeTruthy();
  });

  it('obavijest o novoj verziji je vidljiva, ali NE blokira analitiku', async () => {
    /*
     * TV ne instalira sam (traži sistemsku potvrdu preko cijelog ekrana i
     * daljinski), pa obavijest ne smije skloniti podatke niti tražiti akciju.
     */
    await renderScreen({ updateAvailable: { version: '1.2.0' } });

    expect(screen.getByTestId('tv-update-banner')).toBeTruthy();
    expect(screen.getByText(/v1\.2\.0/)).toBeTruthy();
    // Metrike su i dalje tu — obavijest je traka, ne prepreka.
    expect(screen.getByText('6.5')).toBeTruthy();
  });

  it('bez nove verzije trake nema', async () => {
    await renderScreen({ updateAvailable: null });
    expect(screen.queryByTestId('tv-update-banner')).toBeNull();
  });
});
