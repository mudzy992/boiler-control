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
        { backgroundColor: t.panel, borderColor: t.line },
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
              selected
                ? { backgroundColor: t.raised, borderBottomColor: t.signal, borderBottomWidth: 2 }
                : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.mono,
                fontSize: 10,
                letterSpacing: 0.9,
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
    minHeight: MIN_TOUCH - 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
});
