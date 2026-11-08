/**
 * `Segmented` — jedna traka, jedan nivo navigacije.
 *
 * Zašto: Plin danas ima **dva tab bara** jedan iznad drugog (nalaz UX-03), jer je
 * `GasScreen` bottom-tab navigator unutar bottom-tab navigatora. Segmented kontrola
 * u zaglavlju rješava isti posao bez drugog nivoa navigacije.
 *
 * Pristupačnost: `tablist` / `tab` role + `accessibilityState.selected`, pa
 * TalkBack izgovara „Analiza, tab, 2 od 2".
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, MIN_TOUCH } from '../theme/tokens';
import { useTokens } from './theme';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Dodatna meta u zagradi, npr. broj zapisa. */
  meta?: string;
};

export type SegmentedProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Labela grupe za čitač ekrana, npr. „Vremenski period". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * F7 (GAS-TABS): traka se NIJE prepoznavala kao tab meni.
 *
 * Prije: `borderWidth: 1` na `panel` podlozi, segment visok 36 px, tekst 10 px
 * mono sa razmakom slova, i aktivni segment označen samo 2 px linijom ispod.
 * Na ekranu je to izgledalo kao dvije labele u okviru — bez ijednog znaka koji
 * kaže „ovo je prekidač". Dodatno je visina (36) bila ispod `MIN_TOUCH` (44),
 * pa je i fizički bila pod WCAG 2.5.8.
 *
 * Sada: traka je `raised` (ista podloga kao segmenti u ostatku aplikacije),
 * svaki segment je 44 px, aktivni ima `panel` podlogu + `signal` liniju 2 px +
 * podebljan tekst u `ink`, a neaktivni je `inkDim`. Razlika između stanja je
 * trostruka (boja podloge, linija, težina teksta), dakle vidljiva i bez boje.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  style,
  testID,
}: SegmentedProps<T>) {
  const { t, fonts } = useTokens();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.container,
        { backgroundColor: t.raised, borderColor: t.line },
        style,
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityLabel={option.meta ? `${option.label}, ${option.meta}` : option.label}
            accessibilityState={{ selected }}
            noHitSlop
            testID={testID ? `${testID}-${option.value}` : undefined}
            style={[
              styles.segment,
              { borderBottomColor: selected ? t.signal : 'transparent' },
              selected ? { backgroundColor: t.panel } : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: selected ? fonts.monoSemiBold : fonts.mono,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: selected ? t.ink : t.inkDim,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.control,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 2,
  },
});
