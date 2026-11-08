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

import { radius } from '../theme/tokens';
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
 * F9 (GAS-TABS-3) — druga popravka, poslije korisnikove snimke ekrana.
 *
 * Na snimci su „OČITANJA" i „ANALIZA" bili SLEPLJENI u jedan niz slova bez
 * ikakvog razmaka („OČITANJAANALIZA"), sa bledom pozadinom i bez vidljive
 * granice između opcija. Dva uzroka:
 *
 *  1. segment nije imao `flexBasis: 0`, pa je `flex: 1` dijelio širinu po
 *     sadržaju — dvije riječi su se sabile jedan uz drugi;
 *  2. `textTransform: 'uppercase'` na 13 px mono sa `letterSpacing` u punoj
 *     širini daje najduži mogući oblik riječi, pa se niz „zalijepi".
 *
 * Sada: svaki segment ima `flexBasis: 0` (jednake polovine), aktivni je
 * `panel` sa `signal` podvlakom 3 px i podebljanim tekstom, neaktivni je
 * `inkMuted`, a između njih je hairline razdjelnik — tri nezavisna signala
 * stanja (podloga, linija, težina), pa se vidi i bez boje (WCAG 1.4.1).
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
        { backgroundColor: t.panel, borderColor: t.lineStrong },
        style,
      ]}
    >
      {options.map((option, index) => {
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
              // Razdjelnik samo IZMEĐU segmenata, ne i na lijevoj ivici trake.
              index > 0 ? { borderLeftWidth: StyleSheet.hairlineWidth * 2, borderLeftColor: t.line } : null,
              { borderBottomColor: selected ? t.signal : 'transparent' },
              selected ? { backgroundColor: t.panel } : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: selected ? fonts.monoSemiBold : fonts.mono,
                fontSize: 13,
                // Razmak slova je smanjen: na 13 px mono veliko slovo + 0.8 px
                // razmaka je razvlačilo riječ do same ivice segmenta, pa su se
                // susjedne opcije stapale u jedan niz.
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: selected ? t.ink : t.inkMuted,
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
  /**
   * F7 (GAS-TABS-2): korisnik traži „malo veći format" za traku Očitanja/Analiza.
   * Traka je bila 44 px (minimum za dodir), ali vizuelno mala: 11 px mono tekst
   * u punoj širini ekrana. Sada je 52 px, tekst 13 px semibold, a aktivna opcija
   * ima svjetliju podlogu — pa se prepoznaje i kao tab i kao izbor.
   */
  segment: {
    // `flexBasis: 0` (ne samo `flex: 1`): bez njega se širina dijeli po
    // sadržaju, pa se dvije riječi slepe jedna uz drugu.
    flex: 1,
    flexBasis: 0,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 3,
  },
});
