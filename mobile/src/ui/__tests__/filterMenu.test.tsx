import { fireEvent, render } from '@testing-library/react-native';

import { FilterMenuOptions, FilterMenuTrigger } from '../FilterMenu';

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@expo/vector-icons', () => {
  const mockReact = require('react');
  const mockRN = require('react-native');
  const icon = (props: { name: string }) =>
    mockReact.createElement(mockRN.Text, { accessibilityLabel: props.name }, props.name);
  return { Ionicons: icon, MaterialCommunityIcons: icon };
});

const OPTIONS = [
  { value: 'week' as const, label: 'Sedmica' },
  { value: 'all' as const, label: 'Sve' },
];

/**
 * F7 (GAS-FILTER): filter mora biti PREPOZNATLJIV kao meni, ne kao red pilula.
 * Testovi provjeravaju ono što korisnik vidi i čita:
 *  - zatvoren meni pokazuje IZABRANO, ne svih pet opcija;
 *  - hint kaže da otvara listu;
 *  - u listi su radio opcije sa `checked` stanjem.
 */
describe('FilterMenuTrigger', () => {
  it('prikazuje samo izabranu opciju i hint da otvara listu', async () => {
    const onPress = jest.fn();
    const { getByTestId, getByText, queryByText } = await render(
      <FilterMenuTrigger
        label="Period"
        value="all"
        options={OPTIONS}
        onPress={onPress}
        testID="gas-filter-menu"
      />,
    );

    expect(getByText('Sve')).toBeTruthy();
    // Neaktivne opcije se NE ispisuju na ekranu — to je razlika od pilula.
    expect(queryByText('Sedmica')).toBeNull();

    const trigger = getByTestId('gas-filter-menu');
    expect(trigger.props.accessibilityLabel).toContain('Sve');
    expect(trigger.props.accessibilityHint).toBe('gas.filterMenuHint');

    fireEvent.press(trigger);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('FilterMenuOptions', () => {
  it('renders radio grupu sa označenom aktivnom opcijom', async () => {
    const onSelect = jest.fn();
    const { getByTestId, getByText } = await render(
      <FilterMenuOptions value="week" options={OPTIONS} onSelect={onSelect} />,
    );

    expect(getByText('gas.filterActive')).toBeTruthy();
    expect(getByTestId('gas-filter-option-week').props.accessibilityState).toEqual({
      checked: true,
    });
    expect(getByTestId('gas-filter-option-all').props.accessibilityState).toEqual({
      checked: false,
    });

    fireEvent.press(getByTestId('gas-filter-option-all'));
    expect(onSelect).toHaveBeenCalledWith('all');
  });
});
