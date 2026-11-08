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

  it('nepoznato stanje prikazuje kako je stiglo, bez izmišljanja prijevoda', async () => {
    const result = render(
      <AppThemeProvider colorMode="dark">
        <WeatherRow weather={{ ...weather, condition: 'Volcanic ash' } as never} />
      </AppThemeProvider>,
    );
    expect((await result).getByText('Volcanic ash')).toBeTruthy();
    await (await result).unmount();
  });
});
