/**
 * `FilterMenu` — filter kao STVARNI meni, a ne kao red pilula.
 *
 * F7 (GAS-FILTER): korisnik je rekao „meni filtera se takođe ne prepoznaje kao
 * meni". Bio je u pravu: pet pilula (Sedmica / Mjesec / Godina / Sve / Raspon)
 * stajalo je u redu iznad liste, vizuelno identično trakama tabova ispod, pa je
 * ekran imao dva reda gotovo istih elemenata i nijedan nije izgledao kao
 * kontrola koja otvara nešto. Filter koji nudi pet opcija troši ~150 px visine
 * ekrana prije prvog očitanja.
 *
 * Sada: jedan red visok `MIN_TOUCH` koji kaže TRENUTNI period i ima ševron —
 * dakle izgleda kao padajući meni i ponaša se kao jedan. Dodir otvara `Sheet`
 * sa radio-listom (isti primitiv kao sve ostale odluke u aplikaciji), gdje je
 * svaka opcija visoka 48 px sa kvačicom na aktivnoj.
 *
 * Pristupačnost (WCAG 2.2 AA):
 *  - SC 1.3.1 — kontrola je grupa `radio` opcija (`PanelRow` sa
 *    `accessibilityRole="radio"` i `accessibilityState.checked`), ne pet dugmadi
 *    bez međusobne veze;
 *  - SC 2.5.8 / 2.5.5 — red i svaka opcija su ≥ 44 px;
 *  - SC 4.1.2 — najavljena vrijednost: „Period, Sve, otvara meni".
 */

import { Pressable, View } from 'react-native';

import { useTranslation } from '../hooks/useTranslation';
import { MIN_TOUCH } from '../theme/tokens';
import { useTokens } from './theme';
import { Text } from './Text';
import { Ionicons } from '@expo/vector-icons';

export type FilterMenuOption<T extends string> = {
  value: T;
  label: string;
  /** Kratko objašnjenje ispod labele u listi (npr. broj zapisa). */
  description?: string;
};

export type FilterMenuTriggerProps<T extends string> = {
  label: string;
  value: T;
  options: readonly FilterMenuOption<T>[];
  onPress: () => void;
  testID?: string;
};

/** Zatvoreno stanje: pokazuje IZABRANO, ne sve opcije. */
export function FilterMenuTrigger<T extends string>({
  label,
  value,
  options,
  onPress,
  testID,
}: FilterMenuTriggerProps<T>) {
  const { t } = useTranslation();
  const { t: tokens, fonts } = useTokens();
  const active = options.find((option) => option.value === value) ?? options[0];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text size="label" weight="mono" tone="dim" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
        {`${label}:`}
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${active?.label ?? ''}`}
        accessibilityHint={t('gas.filterMenuHint')}
        accessibilityState={{ expanded: false }}
        testID={testID}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          minHeight: MIN_TOUCH,
          paddingHorizontal: 12,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: tokens.line,
          backgroundColor: tokens.panel,
        }}
      >
        <Text
          size="bodyLg"
          weight="medium"
          style={{ fontFamily: fonts.sansMedium, color: tokens.ink }}
          numberOfLines={1}
        >
          {active?.label ?? ''}
        </Text>
        <Ionicons name="chevron-down" size={16} color={tokens.inkMuted} />
      </Pressable>
    </View>
  );
}

export type FilterMenuSheetContentProps<T extends string> = {
  value: T;
  options: readonly FilterMenuOption<T>[];
  onSelect: (value: T) => void;
};

/**
 * Sadržaj otvorenog menija. Namjerno nije `<Panel>` sa sopstvenom ivicom —
 * `Sheet` već nosi okvir, pa bi unutrašnja ivica bila dvostruki okvir.
 */
export function FilterMenuOptions<T extends string>({
  value,
  options,
  onSelect,
}: FilterMenuSheetContentProps<T>) {
  const { t } = useTranslation();
  const { t: tokens } = useTokens();

  return (
    <View accessibilityRole="radiogroup" testID="gas-filter-options">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.description ? `${option.label}, ${option.description}` : option.label}
            testID={`gas-filter-option-${option.value}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              minHeight: 48,
              paddingVertical: 10,
              paddingHorizontal: 4,
              borderBottomWidth: 1,
              borderBottomColor: tokens.line,
            }}
          >
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={selected ? tokens.signal : tokens.inkDim}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text size="bodyLg" weight={selected ? 'medium' : 'regular'} tone={selected ? 'ink' : 'muted'}>
                {option.label}
              </Text>
              {option.description ? (
                <Text size="meta" tone="dim">
                  {option.description}
                </Text>
              ) : null}
            </View>
            {selected ? (
              <Text size="label" weight="mono" tone="signal" style={{ letterSpacing: 1 }}>
                {t('gas.filterActive')}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
