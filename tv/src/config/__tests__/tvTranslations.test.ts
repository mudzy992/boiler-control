import { setTvLocale, translate, translateText } from '../../config';

describe('TV translations', () => {
  afterEach(() => setTvLocale('bs-BA'));

  it('localizes common labels, provider weather values and enums in Bosnian', () => {
    setTvLocale('bs-BA');
    expect(translate('gas.metricTotalConsumption')).toBe('Ukupna potrošnja');
    expect(translateText('partly cloudy')).toBe('Djelimično oblačno');
    expect(translateText('SYSTEM_ALERT')).toBe('Sistemsko upozorenje');
  });

  it('uses the selected account language for labels, weather and enums', () => {
    setTvLocale('en-US');
    expect(translate('gas.metricTotalConsumption')).toBe('Total consumption');
    expect(translateText('WMO_80')).toBe('Showers');
    expect(translateText('MONDAY')).toBe('Monday');
  });

  it('preserves unknown provider strings instead of showing an empty label', () => {
    setTvLocale('en-US');
    expect(translateText('New provider condition')).toBe('New provider condition');
  });
});
