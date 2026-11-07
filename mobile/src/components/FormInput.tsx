import React from 'react';
import { TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Box, useColorModeValue } from './ui/nativewind';

export type FormInputProps = TextInputProps & {
  isDisabled?: boolean;
};

/**
 * F4 (UX-06): labela je ranije bila samo `Text` iznad polja, bez programske
 * veze. Kad pozivalac ne proslijedi `accessibilityLabel`, koristi se
 * `placeholder` (koji je i sam preveden), pa čitač ekrana nikad ne kaže samo
 * „tekstualno polje".
 */
export const FormInput: React.FC<FormInputProps> = ({ isDisabled, style, ...props }) => {
  const bg = useColorModeValue('white', '#0f172a');
  const border = useColorModeValue('#e2e8f0', '#1e293b');
  const text = useColorModeValue('#1f2937', '#f1f5f9');
  const placeholder = useColorModeValue('#94a3b8', '#64748b');

  return (
    <Box
      borderWidth={1}
      borderColor={border}
      bg={bg}
      rounded="md"
      px={3}
      py={2}
      opacity={isDisabled ? 0.6 : 1}
    >
      <TextInput
        accessibilityLabel={props.accessibilityLabel ?? props.placeholder}
        accessibilityState={isDisabled ? { disabled: true } : undefined}
        {...props}
        editable={!isDisabled}
        placeholderTextColor={placeholder}
        style={[styles.input, { color: text }, style]}
      />
    </Box>
  );
};

const styles = StyleSheet.create({
  input: {
    fontSize: 16,
    paddingVertical: 2,
  },
});
