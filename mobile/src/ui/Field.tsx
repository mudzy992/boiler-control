/**
 * `Field` — jedan obrazac za tekstualni unos u cijeloj aplikaciji.
 *
 * F10 (FORM-THEME): „Moji domovi" i „Izmjena doma" su još koristili
 * `FormInput` iz starog NativeWind sloja: bijela kutija, `#e2e8f0` ivica i
 * `#f1f5f9` tekst — tri hex vrijednosti koje ne dolaze iz teme. Na tamnoj temi
 * su ta polja bila svjetlija od panela, a na svjetloj su imala drugu nijansu
 * sive od svake druge kontrole. Isto polje sada ima `raised` podlogu, hairline
 * ivicu i 52 px visinu, dakle isti rang kao `Button`.
 *
 * `Field` ne zna kako se zove, šta znači ni da li je obavezno — to je posao
 * `Field` roditelja (`FieldGroup`); polje samo izgleda isto na svakom ekranu.
 */

import React from 'react';
import {
  PanResponder,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { radius, space } from '../theme/tokens';
import { useTokens } from './theme';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type FieldProps = Omit<TextInputProps, 'style'> & {
  /** Labela iznad polja (vidljiva, ne samo placeholder). */
  label?: string;
  /** Pomoćni tekst ispod polja. */
  hint?: string;
  /** Monospace cifre i veći font — za brojeve koji se čitaju sa uređaja. */
  numeric?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Field({
  label,
  hint,
  numeric = false,
  editable = true,
  style,
  testID,
  accessibilityLabel,
  ...rest
}: FieldProps) {
  const { t, fonts } = useTokens();

  return (
    <View style={[{ gap: space.xs }, style]}>
      {label ? (
        <Text size="body" weight="medium" tone={editable ? 'ink' : 'muted'}>
          {label}
        </Text>
      ) : null}
      <TextInput
        {...rest}
        editable={editable}
        accessibilityLabel={accessibilityLabel ?? label ?? rest.placeholder}
        accessibilityState={editable ? undefined : { disabled: true }}
        placeholderTextColor={t.inkDim}
        testID={testID}
        style={{
          fontFamily: numeric ? fonts.monoSemiBold : fonts.sans,
          fontSize: numeric ? 18 : 15,
          color: editable ? t.ink : t.inkMuted,
          backgroundColor: t.raised,
          borderColor: t.line,
          borderWidth: 1,
          borderRadius: radius.control,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          minHeight: 52,
          opacity: editable ? 1 : 0.6,
        }}
      />
      {hint ? (
        <Text size="meta" tone="dim">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * `FieldGroup` — labela + obavezno polje + poruka o grešci, sa `*` koji nije
 * jedini nosilac značenja (čitač ekrana dobija „obavezno" u labeli).
 */
export function FieldGroup({
  label,
  required = false,
  error,
  children,
  style,
}: {
  label?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap: space.xs }, style]}>
      {label ? (
        <Text
          size="body"
          weight="medium"
          accessibilityLabel={required ? `${label}, ${'obavezno'}` : label}
        >
          {required ? `${label} *` : label}
        </Text>
      ) : null}
      {children}
      {error ? (
        <Text size="meta" tone="fault">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * `Toggle` — prekidač (bilo/ne bilo), 52 px red, cijeli red je dodirna meta.
 *
 * F10 (FORM-THEME): „Podno grijanje" je bio `Checkbox` 24×24 px — meta ispod
 * WCAG 2.5.8 i vizuelno najmanji element na ekranu, iako mijenja proračun
 * cijelog profila. Sada je red sa labelom lijevo i stanjem desno, pa se čita
 * i kao tekst („Uključeno"/„Isključeno"), ne samo po boji.
 */
export function Toggle({
  label,
  value,
  onChange,
  disabled = false,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const { t } = useTokens();
  return (
    <PressableRow
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      onPress={() => {
        if (!disabled) onChange(!value);
      }}
      disabled={disabled}
      testID={testID}
    >
      <Text size="body" weight="medium" style={{ flex: 1 }}>
        {label}
      </Text>
      <View
        style={{
          width: 44,
          height: 26,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: value ? t.signal : t.lineStrong,
          backgroundColor: value ? t.signal : t.raised,
          justifyContent: 'center',
          paddingHorizontal: 3,
          alignItems: value ? 'flex-end' : 'flex-start',
        }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: radius.pill,
            backgroundColor: value ? t.onSignal : t.inkDim,
          }}
        />
      </View>
    </PressableRow>
  );
}

/**
 * `SliderField` — labela sa TRENUTNOM vrijednošću + traka + minimum/maksimum.
 *
 * F10 (FORM-THEME): tri temperature su bile tri `Slider`-a starog sloja sa
 * ružičastim `brand.500` punjenjem i bijelim okvirom oko kuglice — boje kojih u
 * temi nema. Sada: signalna traka 4 px, kuglica 20 px u `ink` boji sa hairline
 * ivicom, i brojka gore desno (prije je bila u zagradi u labeli).
 *
 * Klizač radi povlačenjem (PanResponder) i akcijama čitača ekrana
 * (`increment`/`decrement`), pa je upotrebljiv i bez vida i bez preciznog
 * dodira.
 */
export function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
  disabled = false,
  testID,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (next: number) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const { t, fonts } = useTokens();
  const [trackWidth, setTrackWidth] = React.useState(1);
  const startValue = React.useRef(value);

  const clamp = (next: number) =>
    Math.min(max, Math.max(min, Math.round((next - min) / step) * step + min));
  const current = clamp(value);
  const percentage = max === min ? 0 : ((current - min) / (max - min)) * 100;

  /* eslint-disable react-hooks/refs -- ref se mijenja samo u gesture callbacku. */
  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (event: { nativeEvent: { locationX: number } }) => {
          startValue.current = current;
          onChange(clamp(min + (event.nativeEvent.locationX / trackWidth) * (max - min)));
        },
        onPanResponderMove: (_event: unknown, gesture: { dx: number }) => {
          onChange(clamp(startValue.current + (gesture.dx / trackWidth) * (max - min)));
        },
      }),
    // `clamp` je čist; zavisnosti su vrijednosti koje ulaze u izračun.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, disabled, max, min, step, trackWidth, onChange],
  );
  /* eslint-enable react-hooks/refs */

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text size="body" weight="medium">
          {label}
        </Text>
        <Text size="body" weight="monoSemiBold" tone="signal">
          {`${current}${unit}`}
        </Text>
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: current }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event: { nativeEvent: { actionName: string } }) => {
          onChange(clamp(current + (event.nativeEvent.actionName === 'increment' ? step : -step)));
        }}
        onLayout={(event: { nativeEvent: { layout: { width: number } } }) =>
          setTrackWidth(Math.max(1, event.nativeEvent.layout.width))
        }
        testID={testID}
        style={{ height: 34, justifyContent: 'center' }}
        {...responder.panHandlers}
      >
        <View style={{ height: 4, backgroundColor: t.raised, borderRadius: radius.pill, overflow: 'hidden' }}>
          <View
            style={{ width: `${percentage}%`, height: '100%', backgroundColor: t.signal }}
          />
        </View>
        <View
          style={{
            position: 'absolute',
            left: `${percentage}%`,
            width: 20,
            height: 20,
            marginLeft: -10,
            borderRadius: radius.pill,
            backgroundColor: t.panel,
            borderWidth: 2,
            borderColor: t.signal,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: t.inkDim }}>{`${min}${unit}`}</Text>
        <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: t.inkDim }}>{`${max}${unit}`}</Text>
      </View>
    </View>
  );
}

/**
 * Red koji je i vizuelno i programski dodirna meta. Namjerno `ui/Pressable`
 * (a ne `Switch` iz RN-a) da bi izgled i visina reda došli iz teme.
 */
function PressableRow({
  children,
  onPress,
  disabled,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
  testID,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  accessibilityRole?: 'switch' | 'button';
  accessibilityLabel?: string;
  accessibilityState?: Record<string, boolean | undefined>;
  testID?: string;
}) {
  const { t } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: 52,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        backgroundColor: t.raised,
        borderColor: t.line,
        borderWidth: 1,
        borderRadius: radius.control,
      }}
    >
      {children}
    </Pressable>
  );
}
