import { TextInput, View } from 'react-native';

import { useTokens } from '../../ui/theme';
import { Text } from '../../ui/Text';
import { radius, space } from '../../theme/tokens';

/**
 * Unos brojila — jedno veliko mono polje.
 *
 * F9 (GAS-REFACTOR): ovo je najvažniji unos na ekranu (broj sa brojila), a bio
 * je običan `FormInput` iz starog sloja: 14 px tekst, isti vizuelni rang kao
 * „Napomena". Sada je `readoutLg` mono sa tabularnim ciframa, 56 px visok, sa
 * tastaturom koja ima decimalni zarez — i prihvata i „1234,56" i „1234.56"
 * (u bs-BS se decimalni zarez kuca zarezom, a parser je do sada padao na to).
 */
export function GasNumberField({
  value,
  onChangeText,
  label,
  placeholder,
  editable = true,
  testID,
}: {
  value: string;
  onChangeText: (next: string) => void;
  label: string;
  placeholder?: string;
  editable?: boolean;
  testID?: string;
}) {
  const { t: tokens, fonts } = useTokens();

  return (
    <View style={{ gap: space.sm }}>
      <Text size="bodyLg" weight="medium">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.inkDim}
        editable={editable}
        keyboardType="decimal-pad"
        inputMode="decimal"
        accessibilityLabel={label}
        testID={testID}
        style={{
          fontFamily: fonts.monoSemiBold,
          fontSize: 24,
          color: tokens.ink,
          backgroundColor: tokens.raised,
          borderColor: tokens.line,
          borderWidth: 1,
          borderRadius: radius.control,
          paddingHorizontal: space.md,
          minHeight: 56,
        }}
      />
    </View>
  );
}
