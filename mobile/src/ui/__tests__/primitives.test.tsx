import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';

import { AppThemeProvider } from '../../theme/AppTheme';
import { Screen, ScreenBody, ScreenHeader } from '../Screen';
import { Panel, HeroPanel, PanelRow } from '../Panel';
import { Button, IconButton } from '../Button';
import { Readout, Kpi } from '../Readout';
import { GaugeBar } from '../GaugeBar';
import { Led, StatusDot } from '../Led';
import { Segmented } from '../Segmented';
import { InlineBanner } from '../InlineBanner';
import { AsyncState, ErrorState, EmptyState, SkeletonRows } from '../AsyncState';
import { Sheet } from '../Sheet';

// Ikonice se mockaju na `Text` da bi `accessibilityLabel` bio čitljiv u stablu.
jest.mock('@expo/vector-icons', () => {
  const mockReact = require('react');
  const mockRN = require('react-native');
  const createIcon = () => (props: { name: string }) =>
    mockReact.createElement(mockRN.Text, { accessibilityLabel: props.name }, props.name);
  return { Ionicons: createIcon(), MaterialCommunityIcons: createIcon() };
});

/**
 * RNTL 14 vraća promise iz `render` — renderovanje mora biti await-ano, inače
 * `screen` nije povezan i upiti pucaju sa „`render` function has not been called".
 */
const wrap = (
  ui: React.ReactElement,
  mode: 'light' | 'dark' = 'dark',
) =>
  render(ui, {
    wrapper: ({ children }) => <AppThemeProvider colorMode={mode}>{children}</AppThemeProvider>,
  });

/**
 * F0 ugovor primitiva. Testovi ne provjeravaju piksele, nego tri stvari koje
 * su danas nedosljedne u 15 ekrana i koje refaktor mora garantovati:
 *
 *  1. pristupačnost (labela i role postoje tamo gdje ih treba);
 *  2. ponašanje (nazad, akcija, selekcija, retry);
 *  3. sadržaj (naslov se renderuje — nalaz UX-14 za `title` koji se nikad ne prikaže).
 */
describe('ScreenHeader', () => {
  it('renderuje naslov i podnaslov', async () => {
    const { getByText } = await wrap(<ScreenHeader title="Grijanje" subtitle="3 termostata" />);
    expect(getByText('Grijanje')).toBeTruthy();
    expect(getByText('3 termostata')).toBeTruthy();
  });

  it('prikazuje nazad dugme sa labelom i poziva onBack', async () => {
    const onBack = jest.fn();
    const { getByLabelText } = await wrap(<ScreenHeader title="Analitika" onBack={onBack} />);
    await fireEvent.press(getByLabelText('Nazad'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('bez onBack ne renderuje nazad dugme (npr. tab root)', async () => {
    const { queryByLabelText } = await wrap(<ScreenHeader title="Početna" />);
    expect(queryByLabelText('Nazad')).toBeNull();
  });

  it('akcija nosi labelu i poziva se', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await wrap(
      <ScreenHeader title="Plin" action={{ icon: 'add', label: 'Dodaj očitanje', onPress }} />,
    );
    await fireEvent.press(getByLabelText('Dodaj očitanje'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Screen / Panel', () => {
  it('Screen i ScreenBody renderuju sadržaj bez obzira na temu', async () => {
    for (const mode of ['light', 'dark'] as const) {
      const { getByText } = await wrap(
        <Screen>
          <ScreenBody>
            <HeroPanel>
              <PanelRow divider={false}>
                <RNText>sadržaj-{mode}</RNText>
              </PanelRow>
            </HeroPanel>
          </ScreenBody>
        </Screen>,
        mode,
      );
      expect(getByText(`sadržaj-${mode}`)).toBeTruthy();
    }
  });

  it('Panel prima accessibilityLabel kao jednu cjelinu', async () => {
    const { getByLabelText } = await wrap(
      <Panel accessibilityLabel="Sažetak mjeseca">
        <RNText>sadržaj</RNText>
      </Panel>,
    );
    expect(getByLabelText('Sažetak mjeseca')).toBeTruthy();
  });
});

describe('Readout / Kpi', () => {
  it('ispisuje vrijednost i jedinicu', async () => {
    const { getByText } = await wrap(<Readout value="52.4" unit="°C" />);
    expect(getByText('52.4')).toBeTruthy();
    expect(getByText('°C')).toBeTruthy();
  });

  it('KPI nosi labelu, broj i metu', async () => {
    const { getByText } = await wrap(<Kpi label="Vanjska" value="−2.1" unit="°C" meta="osjećaj −5" />);
    expect(getByText('Vanjska')).toBeTruthy();
    expect(getByText('−2.1')).toBeTruthy();
    expect(getByText('osjećaj −5')).toBeTruthy();
  });
});

describe('GaugeBar', () => {
  it('izlaže progres čitaču ekrana', async () => {
    const { getByRole } = await wrap(<GaugeBar value={0.61} accessibilityLabel="Polazna voda" />);
    const bar = getByRole('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 61 });
  });

  it('klampuje vrijednost van raspona', async () => {
    const { getByRole } = await wrap(<GaugeBar value={4} accessibilityLabel="Test" />);
    expect(getByRole('progressbar').props.accessibilityValue.now).toBe(100);
  });

  it('bez labele nema role progressbar (dekorativna traka se preskače)', async () => {
    const { queryByRole } = await wrap(<GaugeBar value={0.2} />);
    expect(queryByRole('progressbar')).toBeNull();
  });
});

describe('Led / StatusDot', () => {
  it('StatusDot izgovara stanje kao jednu rečenicu', async () => {
    const { getByLabelText } = await wrap(<StatusDot state="on" label="Grije" meta="01:12" />);
    expect(getByLabelText('Grije, 01:12')).toBeTruthy();
  });

  it('Led se renderuje za svako stanje', async () => {
    for (const state of ['on', 'ok', 'warn', 'fault', 'off'] as const) {
      const { toJSON } = await wrap(<Led state={state} />);
      expect(toJSON()).toBeTruthy();
    }
  });
});

describe('Segmented', () => {
  const options = [
    { value: 'readings', label: 'Očitanja' },
    { value: 'analysis', label: 'Analiza' },
  ] as const;

  it('označava aktivnu opciju i mijenja vrijednost', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await wrap(
      <Segmented options={options} value="readings" onChange={onChange} testID="gas-tabs" />,
    );
    await fireEvent.press(getByTestId('gas-tabs-analysis'));
    expect(onChange).toHaveBeenCalledWith('analysis');
  });

  it('ima grupu sa labelom i tačan selected state', async () => {
    const { getByLabelText, getAllByRole } = await wrap(
      <Segmented
        options={options}
        value="analysis"
        onChange={() => undefined}
        accessibilityLabel="Prikaz plina"
      />,
    );
    expect(getByLabelText('Prikaz plina')).toBeTruthy();
    const tabs = getAllByRole('tab');
    expect(tabs[1].props.accessibilityState).toEqual({ selected: true });
    expect(tabs[0].props.accessibilityState).toEqual({ selected: false });
  });
});

describe('Button / IconButton', () => {
  it('disabled blokira onPress', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await wrap(<Button label="Sačuvaj" onPress={onPress} disabled />);
    await fireEvent.press(getByLabelText('Sačuvaj'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('loading prijavljuje busy stanje', async () => {
    const { getByLabelText } = await wrap(<Button label="Sačuvaj" onPress={() => undefined} loading />);
    expect(getByLabelText('Sačuvaj').props.accessibilityState).toMatchObject({ busy: true });
  });

  it('IconButton zahtijeva i izlaže labelu', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await wrap(
      <IconButton accessibilityLabel="Osvježi" icon={<RNText>r</RNText>} onPress={onPress} />,
    );
    await fireEvent.press(getByLabelText('Osvježi'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('InlineBanner', () => {
  it('ima role alert i čitljivu labelu', async () => {
    const { getByRole } = await wrap(
      <InlineBanner tone="warn" title="Kratki ciklusi grijanja" meta="14 ciklusa" />,
    );
    expect(getByRole('alert').props.accessibilityLabel).toBe('Kratki ciklusi grijanja. 14 ciklusa');
  });

  it('akcija radi i nosi labelu', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await wrap(
      <InlineBanner tone="fault" title="Nema veze" action={{ label: 'Pokušaj', onPress }} />,
    );
    await fireEvent.press(getByLabelText('Pokušaj'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('AsyncState', () => {
  it('loading prikazuje skeleton umjesto sadržaja', async () => {
    const { queryByText, toJSON } = await wrap(
      <AsyncState loading skeleton={<SkeletonRows count={2} />}>
        <RNText>sadržaj</RNText>
      </AsyncState>,
    );
    expect(queryByText('sadržaj')).toBeNull();
    expect(toJSON()).toBeTruthy();
  });

  it('greška nudi retry i ne prikazuje sadržaj', async () => {
    const onRetry = jest.fn();
    const { getByLabelText, queryByText } = await wrap(
      <AsyncState error={new Error('mreža')} onRetry={onRetry}>
        <RNText>sadržaj</RNText>
      </AsyncState>,
    );
    expect(queryByText('sadržaj')).toBeNull();
    await fireEvent.press(getByLabelText('Pokušaj ponovo'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('keepContentOnError zadržava stare podatke iznad greške', async () => {
    const { getByText, getByRole } = await wrap(
      <AsyncState error={new Error('mreža')} keepContentOnError onRetry={() => undefined}>
        <RNText>zadnji poznati podatak</RNText>
      </AsyncState>,
    );
    expect(getByText('zadnji poznati podatak')).toBeTruthy();
    expect(getByRole('alert')).toBeTruthy();
  });

  it('empty prikazuje empty state sa akcijom', async () => {
    const onPress = jest.fn();
    const { getByText, getByLabelText } = await wrap(
      <AsyncState
        empty
        emptyState={<EmptyState title="Nema očitania" action={{ label: 'Dodaj', onPress }} />}
      >
        <RNText>skriveno</RNText>
      </AsyncState>,
    );
    expect(getByText('Nema očitania')).toBeTruthy();
    await fireEvent.press(getByLabelText('Dodaj'));
    expect(onPress).toHaveBeenCalled();
  });

  it('ErrorState i EmptyState se renderuju samostalno', async () => {
    const err = await wrap(<ErrorState title="Greška" message="detalj" />);
    expect(err.getByText('Greška')).toBeTruthy();
    const empty = await wrap(<EmptyState title="Prazno" />);
    expect(empty.getByText('Prazno')).toBeTruthy();
  });
});

/**
 * F7 (SHEET-02): `Modal` se ne smije skloniti u istom trenutku kad `isOpen`
 * padne na `false` — inače animacija zatvaranja nema gdje da se odigra, jer je
 * cijeli list već izvan stabla. Redoslijed koji mora da važi:
 *
 *   1. `isOpen: true`  → list je montiran i vidljiv;
 *   2. `isOpen: false` → list je JOŠ montiran (animacija teče);
 *   3. index padne na -1 (ili istekne sigurnosni timer) → list se sklanja.
 *
 * Ovaj test je jedini koji pokriva korak 2; snapshotovi uvijek snimaju samo
 * stabilno stanje, pa bi regresija ovdje prošla nezapaženo.
 *
 * Harness je na modulskom nivou (ne unutar testa): komponenta definisana unutar
 * komponente bi se pri svakom rendeu pravila iznova i izgubila stanje —
 * `react-hooks/static-components`.
 */
function SheetHarness({ startOpen }: { startOpen: boolean }) {
  const [isOpen, setIsOpen] = React.useState(startOpen);
  return (
    <>
      <RNText onPress={() => setIsOpen(false)}>zatvori-lista</RNText>
      <Sheet isOpen={isOpen} onClose={() => setIsOpen(false)} title="Naslov">
        <RNText>sadržaj-lista</RNText>
      </Sheet>
    </>
  );
}

describe('Sheet — prozor za animaciju zatvaranja (SHEET-02)', () => {
  it('drži sadržaj montiranim kratko nakon zatvaranja, pa ga skloni', async () => {
    const { getByText, queryByText } = await wrap(<SheetHarness startOpen />);
    expect(queryByText('sadržaj-lista')).toBeTruthy();

    fireEvent.press(getByText('zatvori-lista'));
    // Animacija još traje — sadržaj NIJE nestao u istom frejmu.
    expect(queryByText('sadržaj-lista')).toBeTruthy();

    // Sigurnosni timer (400 ms) sklanja `Modal` i kad gorhom ne javi `onChange`.
    await waitFor(() => expect(queryByText('sadržaj-lista')).toBeNull(), { timeout: 2000 });
  });
});
