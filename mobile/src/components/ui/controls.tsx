import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import {
  Modal as RNModal,
  PanResponder,
  Pressable as RNPressable,
  Switch as RNSwitch,
} from 'react-native';
import { useAppColorMode } from '../../theme/AppTheme';
import { colorSchemeName, resolveColor } from '../../theme/palette';
import { Box, HStack, Icon, Pressable, Spinner, Text, VStack } from './primitives';
import { buildStyle, nativeProps } from './styles';
import type { UiProps } from './styles';

function controlColors(colorScheme = 'brand', variant = 'solid', dark: boolean) {
  const scheme = colorSchemeName(colorScheme);
  const solid = resolveColor(`${scheme}.500`);
  const strongText = resolveColor(`${scheme}.${dark ? 300 : 700}`);
  if (variant === 'outline') {
    return {
      backgroundColor: 'transparent',
      borderColor: solid,
      borderWidth: 1,
      color: strongText,
    };
  }
  if (variant === 'subtle') {
    return {
      backgroundColor: resolveColor(`${scheme}.${dark ? 900 : 100}`),
      borderColor: 'transparent',
      borderWidth: 0,
      color: strongText,
    };
  }
  if (variant === 'ghost' || variant === 'link') {
    return {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      color: strongText,
    };
  }
  return {
    backgroundColor: solid,
    borderColor: solid,
    borderWidth: 1,
    color: '#ffffff',
  };
}

function buttonMetrics(size: unknown) {
  if (size === 'sm') return { px: 3, py: 1.5, fontSize: 'sm' };
  if (size === 'lg') return { px: 5, py: 3, fontSize: 'lg' };
  return { px: 4, py: 2.5, fontSize: 'md' };
}

function ButtonBase(props: UiProps) {
  const { colorMode } = useAppColorMode();
  const {
    children,
    colorScheme = 'brand',
    variant = 'solid',
    size = 'md',
    isDisabled,
    disabled,
    isLoading,
    leftIcon,
    _text,
    ...rest
  } = props;
  const colors = controlColors(colorScheme, variant, colorMode === 'dark');
  const metrics = buttonMetrics(size);
  const textProps = {
    color: colors.color,
    fontSize: metrics.fontSize,
    fontWeight: '600',
    ..._text,
  };
  return (
    <Pressable
      {...rest}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      disabled={disabled ?? isDisabled ?? isLoading}
      opacity={(disabled ?? isDisabled) ? 0.5 : rest.opacity}
      rounded={rest.rounded ?? 'md'}
      px={rest.px ?? metrics.px}
      py={rest.py ?? metrics.py}
      style={[
        colors,
        { alignItems: 'center', justifyContent: 'center' },
        buildStyle(rest, colorMode),
        rest.style,
      ]}
    >
      <HStack space={2} alignItems="center" justifyContent="center">
        {isLoading ? <Spinner size="sm" color={textProps.color} /> : leftIcon}
        {typeof children === 'string' || typeof children === 'number' ? (
          <Text {...textProps}>{children}</Text>
        ) : (
          children
        )}
      </HStack>
    </Pressable>
  );
}

function ButtonGroup(props: UiProps) {
  return <HStack {...props} />;
}

export const Button = Object.assign(ButtonBase, { Group: ButtonGroup });

export function Badge(props: UiProps) {
  const { colorMode } = useAppColorMode();
  const {
    children,
    colorScheme = 'brand',
    variant = 'subtle',
    _text,
    ...rest
  } = props;
  const colors = controlColors(colorScheme, variant, colorMode === 'dark');
  return (
    <Box
      {...rest}
      rounded={rest.rounded ?? 'md'}
      px={rest.px ?? 2}
      py={rest.py ?? 1}
      style={[colors, { alignSelf: 'flex-start' }, buildStyle(rest, colorMode), rest.style]}
    >
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text color={colors.color} fontSize="xs" fontWeight="600" {..._text}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Box>
  );
}

export function Progress(props: UiProps) {
  const { colorMode } = useAppColorMode();
  const { value = 0, colorScheme = 'brand', size = 'md', ...rest } = props;
  const height = size === 'lg' ? 12 : size === 'sm' ? 4 : 8;
  const bounded = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <Box
      {...rest}
      w={rest.w ?? '100%'}
      h={`${height}px`}
      rounded={rest.rounded ?? 'full'}
      bg={rest.bg ?? (colorMode === 'dark' ? 'gray.700' : 'gray.200')}
      overflow="hidden"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: bounded }}
    >
      <Box
        w={`${bounded}%`}
        h="100%"
        rounded={rest.rounded ?? 'full'}
        bg={resolveColor(`${colorSchemeName(colorScheme)}.500`)}
      />
    </Box>
  );
}

export function Switch(props: UiProps) {
  const {
    isChecked = false,
    isDisabled,
    disabled,
    onToggle,
    onValueChange,
    onTrackColor,
    colorScheme = 'brand',
    size = 'md',
    ...rest
  } = props;
  const scheme = colorSchemeName(colorScheme);
  const trackColor = {
    false: resolveColor(onTrackColor?.false ?? 'gray.300'),
    true: resolveColor(onTrackColor?.true ?? `${scheme}.300`),
  };
  return (
    <RNSwitch
      {...nativeProps(rest, ['isChecked', 'isDisabled', 'onToggle', 'onTrackColor', 'colorScheme', 'size'])}
      accessibilityRole="switch"
      value={isChecked}
      disabled={disabled ?? isDisabled}
      onValueChange={onValueChange ?? onToggle}
      trackColor={trackColor}
      thumbColor={isChecked ? resolveColor(`${scheme}.500`) : '#f4f3f4'}
      style={[size === 'sm' ? { transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] } : undefined, rest.style]}
    />
  );
}

export function Checkbox(props: UiProps) {
  const { isChecked = false, onChange, value: _value, isDisabled, ...rest } = props;
  void _value;
  return (
    <Pressable
      {...rest}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => onChange?.(!isChecked)}
      w="24px"
      h="24px"
      rounded="sm"
      borderWidth={2}
      borderColor={isChecked ? 'brand.500' : 'gray.400'}
      bg={isChecked ? 'brand.500' : 'transparent'}
      alignItems="center"
      justifyContent="center"
    >
      {isChecked && <Icon as={Ionicons} name="checkmark" size="16px" color="white" />}
    </Pressable>
  );
}

const FormControlContext = React.createContext({ required: false });

function FormControlBase({ isRequired = false, children, ...props }: UiProps) {
  const value = useMemo(() => ({ required: isRequired }), [isRequired]);
  return (
    <FormControlContext.Provider value={value}>
      <VStack space={1} {...props}>
        {children}
      </VStack>
    </FormControlContext.Provider>
  );
}

function FormControlLabel({ children, _text, ...props }: UiProps) {
  const { required } = React.useContext(FormControlContext);
  return (
    <Text fontSize="sm" fontWeight="600" mb={1} {...props} {..._text}>
      {children}
      {required ? ' *' : ''}
    </Text>
  );
}

export const FormControl = Object.assign(FormControlBase, {
  Label: FormControlLabel,
});

interface SelectItemProps {
  label: string;
  value: string;
}

function SelectItem(_props: SelectItemProps) {
  return null;
}

function SelectBase(props: UiProps) {
  const { colorMode } = useAppColorMode();
  const {
    children,
    selectedValue,
    onValueChange,
    placeholder = 'Select an option',
    accessibilityLabel,
    _selectedItem,
    ...rest
  } = props;
  const [open, setOpen] = useState(false);
  const options = React.Children.toArray(children)
    .filter(React.isValidElement)
    .map((child) => child.props as SelectItemProps);
  const selected = options.find((option) => option.value === selectedValue);
  const cardBg = colorMode === 'dark' ? 'dark.800' : 'white';
  const textColor = colorMode === 'dark' ? 'gray.100' : 'gray.800';

  return (
    <>
      <Pressable
        {...rest}
        accessibilityRole="combobox"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        bg={rest.bg ?? cardBg}
        borderWidth={rest.borderWidth ?? 1}
        borderColor={rest.borderColor ?? 'gray.300'}
        rounded={rest.rounded ?? 'md'}
        px={rest.px ?? 3}
        py={rest.py ?? 3}
      >
        <HStack justifyContent="space-between" alignItems="center" space={2}>
          <Text color={selected ? textColor : 'gray.500'} flex={1}>
            {selected?.label ?? placeholder}
          </Text>
          <Icon as={Ionicons} name={open ? 'chevron-up' : 'chevron-down'} size={4} color="gray.500" />
        </HStack>
      </Pressable>
      <RNModal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <RNPressable
          accessibilityLabel="Close options"
          onPress={() => setOpen(false)}
          style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)', padding: 24 }}
        >
          <RNPressable onPress={() => undefined}>
            <Box bg={cardBg} rounded="lg" p={2} maxH="80%">
              {options.map((option) => {
                const active = option.value === selectedValue;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      onValueChange?.(option.value);
                      setOpen(false);
                    }}
                    px={3}
                    py={3}
                    rounded="md"
                    bg={active ? _selectedItem?.bg ?? 'blue.100' : 'transparent'}
                  >
                    <HStack alignItems="center" justifyContent="space-between" space={2}>
                      <Text color={textColor}>{option.label}</Text>
                      {active && (_selectedItem?.endIcon ?? <Icon as={Ionicons} name="checkmark" size={5} color="brand.500" />)}
                    </HStack>
                  </Pressable>
                );
              })}
            </Box>
          </RNPressable>
        </RNPressable>
      </RNModal>
    </>
  );
}

export const Select = Object.assign(SelectBase, { Item: SelectItem });

function clampSliderValue(value: number, min: number, max: number, step: number) {
  const bounded = Math.max(min, Math.min(max, value));
  return Math.round((bounded - min) / step) * step + min;
}

function SliderBase(props: UiProps) {
  const {
    value = 0,
    minValue = 0,
    maxValue = 100,
    step = 1,
    onChange,
    children: _children,
    ...rest
  } = props;
  void _children;
  const [trackWidth, setTrackWidth] = useState(1);
  const startValue = useRef(Number(value));
  const min = Number(minValue);
  const max = Number(maxValue);
  const increment = Number(step) || 1;
  const current = clampSliderValue(Number(value), min, max, increment);
  const percentage = max === min ? 0 : ((current - min) / (max - min)) * 100;

  /* eslint-disable react-hooks/refs -- gesture callbacks mutate this ref only after render. */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          startValue.current = current;
          const next = min + (event.nativeEvent.locationX / trackWidth) * (max - min);
          onChange?.(clampSliderValue(next, min, max, increment));
        },
        onPanResponderMove: (_event, gesture) => {
          const next = startValue.current + (gesture.dx / trackWidth) * (max - min);
          onChange?.(clampSliderValue(next, min, max, increment));
        },
      }),
    [current, increment, max, min, onChange, trackWidth],
  );
  /* eslint-enable react-hooks/refs */

  return (
    <Box
      {...rest}
      h="32px"
      justifyContent="center"
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: current }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event: { nativeEvent: { actionName: string } }) => {
        const delta = event.nativeEvent.actionName === 'increment' ? increment : -increment;
        onChange?.(clampSliderValue(current + delta, min, max, increment));
      }}
      onLayout={(event: { nativeEvent: { layout: { width: number } } }) =>
        setTrackWidth(Math.max(1, event.nativeEvent.layout.width))
      }
      {...panResponder.panHandlers}
    >
      <Box h="4px" rounded="full" bg="gray.300">
        <Box w={`${percentage}%`} h="100%" rounded="full" bg="brand.500" />
      </Box>
      <Box
        position="absolute"
        left={`${percentage}%`}
        w="20px"
        h="20px"
        rounded="full"
        bg="brand.500"
        borderWidth={2}
        borderColor="white"
        style={{ transform: [{ translateX: -10 }] }}
      />
    </Box>
  );
}

function SliderPart(_props: UiProps) {
  return null;
}

export const Slider = Object.assign(SliderBase, {
  Track: SliderPart,
  FilledTrack: SliderPart,
  Thumb: SliderPart,
});
