import mockReact from 'react';
import { Text as mockNativeText } from 'react-native';
import { render } from '@testing-library/react-native';

import { HeatingProgressBar } from '../HeatingProgressBar';
import { AppThemeProvider } from '../../theme/AppTheme';
import { heatingProgress } from '../../lib/heating-progress';

/**
 * `36` — traka ciklusa grijanja: zelena do predviđenog, žuta do 120 min,
 * crvena preko. Model se testira odvojeno (`lib/__tests__`), ovdje se provjerava
 * da komponenta stvarno nacrta zonu, marker i a11y vrijednost.
 *
 * Namjerno se NE renderuje cijeli `DashboardScreen`: svaki render tog ekrana
 * ostavlja otvoren handle u jest okruženju (`Jest did not exit one second after
 * the test run has completed`), a taj problem postoji i bez ove izmjene.
 */
jest.mock('@expo/vector-icons', () => {
  const createIcon = () => (props: { name: string }) =>
    mockReact.createElement(mockNativeText, { accessibilityLabel: `icon-${props.name}` }, props.name);
  return { Ionicons: createIcon(), MaterialCommunityIcons: createIcon() };
});

const renderBar = async (model: ReturnType<typeof heatingProgress>, label?: string) => {
  return render(
    <AppThemeProvider colorMode="light">
      <HeatingProgressBar model={model} accessibilityLabel={label} testID="bar" />
    </AppThemeProvider>,
  );
};

const now = new Date('2026-11-08T12:00:00.000Z').getTime();

describe('HeatingProgressBar (`36`)', () => {
  it('u zelenoj zoni crta traku bez markera granice idealnog', async () => {
    const model = heatingProgress({
      startedAt: '2026-11-08T11:20:00.000Z', // 40 min od 45
      now,
      predictedMin: 45,
    });
    const { getByTestId, queryByTestId } = await renderBar(model);

    expect(getByTestId('bar')).toBeTruthy();
    // Marker procjene postoji uvijek kad procjena postoji.
    expect(getByTestId('heating-progress-predicted')).toBeTruthy();
    // Granica 120 min se ne crta dok je skala tačno 120 — to je desna ivica.
    expect(queryByTestId('heating-progress-ideal')).toBeNull();
  });

  it('preko 120 min skala raste i granica idealnog je vidljiva', async () => {
    const model = heatingProgress({
      startedAt: '2026-11-08T09:30:00.000Z', // 150 min
      now,
      predictedMin: 45,
    });
    const { getByTestId } = await renderBar(model);

    expect(model.zone).toBe('beyond');
    expect(getByTestId('heating-progress-ideal')).toBeTruthy();
  });

  it('bez procjene nema markera, ali traka i dalje pokazuje proteklo', async () => {
    const model = heatingProgress({ startedAt: '2026-11-08T11:20:00.000Z', now });
    const { getByTestId, queryByTestId } = await renderBar(model, 'Grijanje');

    expect(queryByTestId('heating-progress-predicted')).toBeNull();
    expect(getByTestId('bar')).toBeTruthy();
  });

  it('čitač ekrana dobija „od 0 do skale, sada proteklo"', async () => {
    const model = heatingProgress({
      startedAt: '2026-11-08T10:40:00.000Z', // 80 min
      now,
      predictedMin: 45,
    });
    const { getByTestId } = await renderBar(model, 'Grijanje u toku');

    const bar = getByTestId('bar');
    expect(bar.props.accessibilityRole).toBe('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 120, now: 80 });
    expect(bar.props.accessibilityLabel).toBe('Grijanje u toku');
  });

  it('bez labele traka se skriva od čitača ekrana', async () => {
    const model = heatingProgress({ startedAt: '2026-11-08T11:20:00.000Z', now, predictedMin: 45 });
    const { getByTestId } = await renderBar(model);

    expect(getByTestId('bar').props.accessibilityRole).toBeUndefined();
  });
});
