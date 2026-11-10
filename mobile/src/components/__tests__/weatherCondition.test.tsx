import { render } from '@testing-library/react-native';

import { WeatherRow } from '../WeatherRow';
import { AppThemeProvider } from '../../theme/AppTheme';
import i18n from '../../locales/config';

/**
 * F8 (HOME-05): backend šalje stanje vremena na engleskom („Cloudy"), pa je u
 * bosanskom UI-ju stajalo engleski. Test provjerava da se POZNATA stanja
 * prevode i da „osjećaj" stoji uz trenutnu temperaturu.
 */
const weather = {
  temp: 8.4,
  feelsLike: 5.6,
  condition: 'Cloudy',
  humidity: 70,
  windSpeed: 12,
  pressure: 1013,
};

async function renderRow() {
  return render(
    <AppThemeProvider colorMode="dark">
      <WeatherRow weather={weather as never} />
    </AppThemeProvider>,
  );
}

describe('F8 prevod stanja vremena', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en-US');
  });

  it('prevodi poznato stanje na bosanski', async () => {
    await i18n.changeLanguage('bs-BS');
    const result = await renderRow();
    expect(result.getByText('Oblačno')).toBeTruthy();
    expect(result.queryByText('Cloudy')).toBeNull();
    await result.unmount();
  });

  it('prikazuje osjećaj uz trenutnu temperaturu', async () => {
    const result = await renderRow();
    expect(result.getByText('Feels like 6°C')).toBeTruthy();
    await result.unmount();
  });

  /*
   * F13 (treći krug): ranije je nepoznat tekst išao na ekran kako je stigao.
   * To je značilo i da `WMO_80` — identifikator, ne naziv — završi pred
   * korisnikom. Sada se prikazuje čitljiv tekst.
   */
  it('nepoznato stanje daje čitljiv tekst, ne sirov identifikator', async () => {
    // `render` u ovoj verziji testing-library-ja vraća promise.
    const result = await render(
      <AppThemeProvider colorMode="dark">
        <WeatherRow weather={{ ...weather, condition: 'Volcanic ash' } as never} />
      </AppThemeProvider>,
    );
    expect(result.getByText('Unknown conditions')).toBeTruthy();
    expect(result.queryByText('Volcanic ash')).toBeNull();
    await result.unmount();
  });

  it('WMO_80 iz snimke se prevodi, nikad ne piše na ekranu', async () => {
    await i18n.changeLanguage('bs-BS');
    const result = await render(
      <AppThemeProvider colorMode="dark">
        <WeatherRow weather={{ ...weather, condition: 'WMO_80' } as never} />
      </AppThemeProvider>,
    );

    expect(result.queryByText('WMO_80')).toBeNull();
    // `weather.condition.slight_rain_showers` u bosanskom = „Slabi pljuskovi".
    expect(result.getByText('Slabi pljuskovi')).toBeTruthy();
    await result.unmount();
  });

  it('oznaka mjerenja je kratka (duga se lomila iznad broja)', async () => {
    await i18n.changeLanguage('bs-BS');
    const result = await render(
      <AppThemeProvider colorMode="dark">
        <WeatherRow weather={weather as never} />
      </AppThemeProvider>,
    );

    expect(result.getByText('Trenutno')).toBeTruthy();
    expect(result.queryByText('Trenutna prognoza vremena')).toBeNull();
    await result.unmount();
  });
});
