import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  Text as RNText,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppColorMode } from '../../theme/AppTheme';
import { resolveColor } from '../../theme/palette';
import {
  borderRadius,
  buildStyle,
  dimension,
  gapStyle,
  iconSize,
  nativeProps,
} from './styles';
import type { UiProps } from './styles';

export function Box(props: UiProps) {
  const { colorMode } = useAppColorMode();
  const { children, className, safeArea, ...rest } = props;
  const style = buildStyle(rest, colorMode);
  const hostProps = nativeProps(rest);
  if (safeArea) {
    return (
      <SafeAreaView {...hostProps} className={className} style={style}>
        {children}
      </SafeAreaView>
    );
  }
  return (
    <View {...hostProps} className={className} style={style}>
      {children}
    </View>
  );
}

function interleaveDivider(children: React.ReactNode, divider: React.ReactNode) {
  if (!divider) return children;
  const items = React.Children.toArray(children);
  return items.flatMap((child, index) => {
    const result: React.ReactNode[] = [child];
    if (index < items.length - 1) {
      result.push(
        React.isValidElement(divider)
          ? React.cloneElement(divider, { key: `divider-${index}` } as never)
          : divider,
      );
    }
    return result;
  });
}

export function VStack(props: UiProps) {
  const { children, space, divider, className, ...rest } = props;
  return (
    <Box
      {...rest}
      className={['flex flex-col', className].filter(Boolean).join(' ')}
      style={[gapStyle(space), rest.style]}
    >
      {interleaveDivider(children, divider)}
    </Box>
  );
}

export function HStack(props: UiProps) {
  const { children, space, className, ...rest } = props;
  return (
    <Box
      {...rest}
      className={['flex flex-row', className].filter(Boolean).join(' ')}
      style={[gapStyle(space), rest.style]}
    >
      {children}
    </Box>
  );
}

export function Center(props: UiProps) {
  return <Box alignItems="center" justifyContent="center" {...props} />;
}

export function Text(props: UiProps) {
  const { colorMode } = useAppColorMode();
  const { children, className, ...rest } = props;
  return (
    <RNText
      {...nativeProps(rest)}
      className={className}
      style={buildStyle(rest, colorMode, { text: true })}
    >
      {children}
    </RNText>
  );
}

export function Heading(props: UiProps) {
  const { colorMode } = useAppColorMode();
  const { children, className, size = 'lg', ...rest } = props;
  return (
    <RNText
      {...nativeProps(rest, ['size'])}
      className={className}
      accessibilityRole="header"
      style={buildStyle({ fontWeight: '700', ...rest, size }, colorMode, {
        text: true,
        heading: true,
      })}
    >
      {children}
    </RNText>
  );
}

export function Divider(props: UiProps) {
  const { colorMode } = useAppColorMode();
  const { className, ...rest } = props;
  return (
    <View
      {...nativeProps(rest)}
      className={className}
      style={[
        { height: 1, width: '100%', backgroundColor: resolveColor('gray.200') },
        buildStyle(rest, colorMode),
      ]}
    />
  );
}

export function Circle(props: UiProps) {
  const { size = '40px', ...rest } = props;
  const diameter = dimension(size);
  return (
    <Box
      {...rest}
      style={[
        {
          width: diameter,
          height: diameter,
          borderRadius:
            typeof diameter === 'number' ? diameter / 2 : borderRadius(size),
        },
        rest.style,
      ]}
    />
  );
}

export function Pressable(props: UiProps) {
  const { colorMode } = useAppColorMode();
  const { children, className, disabled, isDisabled, ...rest } = props;
  return (
    <RNPressable
      {...nativeProps(rest, ['isDisabled'])}
      className={className}
      disabled={disabled ?? isDisabled}
      style={({ pressed }) => [
        buildStyle(rest, colorMode),
        pressed && rest._pressed ? buildStyle(rest._pressed, colorMode) : undefined,
      ]}
    >
      {children}
    </RNPressable>
  );
}

export function ScrollView(props: UiProps) {
  const { colorMode } = useAppColorMode();
  const { children, className, contentContainerStyle, ...rest } = props;
  return (
    <RNScrollView
      {...nativeProps(rest)}
      className={className}
      style={buildStyle(rest, colorMode)}
      contentContainerStyle={contentContainerStyle}
    >
      {children}
    </RNScrollView>
  );
}

export function KeyboardAvoidingView(props: UiProps) {
  const { colorMode } = useAppColorMode();
  const { children, className, ...rest } = props;
  return (
    <RNKeyboardAvoidingView
      {...nativeProps(rest)}
      className={className}
      style={buildStyle(rest, colorMode)}
    >
      {children}
    </RNKeyboardAvoidingView>
  );
}

export function Icon(props: UiProps) {
  const { colorMode } = useAppColorMode();
  const { as: IconComponent = Ionicons, name, size = 5, color, ...rest } = props;
  return (
    <IconComponent
      {...nativeProps(rest, ['as'])}
      name={name}
      size={iconSize(size)}
      color={resolveColor(color ?? rest.color ?? 'gray.500')}
      style={buildStyle(rest, colorMode)}
    />
  );
}

export function CheckIcon(props: UiProps) {
  return <Icon as={Ionicons} name="checkmark" {...props} />;
}

export function Spinner(props: UiProps) {
  const { colorMode } = useAppColorMode();
  const { size = 'md', color = 'brand.500', ...rest } = props;
  const nativeSize = size === 'lg' || size === 'large' ? 'large' : 'small';
  return (
    <ActivityIndicator
      {...nativeProps(rest, ['size'])}
      accessibilityRole="progressbar"
      size={nativeSize}
      color={resolveColor(color)}
      style={buildStyle(rest, colorMode)}
    />
  );
}

function SkeletonBase(props: UiProps) {
  const { colorMode } = useAppColorMode();
  const { children, isLoaded = false, ...rest } = props;
  if (isLoaded) return <>{children}</>;
  return (
    <Box
      {...rest}
      bg={rest.bg ?? (colorMode === 'dark' ? 'gray.700' : 'gray.200')}
      accessibilityRole="progressbar"
    />
  );
}

function SkeletonText({ lines = 3, w = '100%', ...props }: UiProps) {
  return (
    <VStack space={2} w={w} {...props}>
      {Array.from({ length: Number(lines) }, (_, index) => (
        <Skeleton key={index} h="12px" rounded="md" w={index === lines - 1 ? '70%' : '100%'} />
      ))}
    </VStack>
  );
}

export const Skeleton = Object.assign(SkeletonBase, { Text: SkeletonText });
