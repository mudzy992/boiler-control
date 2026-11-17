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
      loading={false}
      error={null}
      updatedAt={Date.now()}
      translate={translate}
      {...overrides}
    />,
  );
}

describe('TV analitika', () => {
  it('prikazuje potrošnju i cijenu, bez nula za neizmjereno', async () => {
    await renderScreen();

    expect(screen.getByText('12.50')).toBeTruthy();
    expect(screen.getByText('25.00')).toBeTruthy();
    // `totalHeatingHours` nije poslan — kartica NE smije postojati kao 0.
    expect(screen.queryByText('gas.metricHeatingHours')).toBeNull();
  });

  it('analitika se može scrollati daljinskim i fokusira metriku', async () => {
    await renderScreen({
      analysis: {
        consumptionFromReferenceM3: 12.5,
        costIncVat: 25,
        totalHeatingHours: 10,
      },
    });

    const scroll = screen.getByTestId('tv-analytics-scroll');
    const firstMetric = screen.getByTestId('tv-metric-consumption');
    expect(scroll.props.scrollEnabled).toBe(true);
    expect(firstMetric.props.focusable).toBe(true);
    expect(firstMetric.props.hasTVPreferredFocus).toBe(true);
  });

  it('mjerenja ima ali sva su nula — prikazuje nule, ne prazno stanje', async () => {
    // 0 je mjerenje: u periodu nije potrošeno ništa. Prazno stanje ovdje bi
    // bilo laž („nema podataka") umjesto istine („nije trošeno").
    await renderScreen({ analysis: { consumptionFromReferenceM3: 0 } });

    expect(screen.getByText('0.00')).toBeTruthy();
    expect(screen.queryByText('Još nema podataka')).toBeNull();
  });

  it('prazno stanje objašnjava zašto je prazno', async () => {
    await renderScreen({ analysis: {} });

    expect(screen.getByText('Još nema podataka')).toBeTruthy();
    expect(screen.getByText(/kotao pošalje prva očitanja/)).toBeTruthy();
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
    await renderScreen({ analysis: null, error: 'mreža' });
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

    expect(screen.getByText('12.50')).toBeTruthy();
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
    expect(screen.getByText('12.50')).toBeTruthy();
  });

  it('bez nove verzije trake nema', async () => {
    await renderScreen({ updateAvailable: null });
    expect(screen.queryByTestId('tv-update-banner')).toBeNull();
  });
});
