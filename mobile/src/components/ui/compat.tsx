import type { ComponentType } from 'react';
import * as NativeBase from 'native-base';
import * as NativeWind from './nativewind';
import { useUiImplementation } from './migration';
import type { UiProps } from './styles';

function implementationComponent(
  module: Record<string, any>,
  name: string,
): ComponentType<UiProps> {
  return name
    .split('.')
    .reduce((target, part) => target?.[part], module) as ComponentType<UiProps>;
}

function compatComponent(name: string) {
  const LegacyComponent = implementationComponent(NativeBase, name);
  const NativeWindComponent = implementationComponent(NativeWind, name);
  function CompatComponent(props: UiProps) {
    const implementation = useUiImplementation();
    return implementation === 'nativewind' ? (
      <NativeWindComponent {...props} />
    ) : (
      <LegacyComponent {...props} />
    );
  }
  CompatComponent.displayName = `Compat(${name})`;
  return CompatComponent;
}

export const Box = compatComponent('Box');
export const VStack = compatComponent('VStack');
export const HStack = compatComponent('HStack');
export const Text = compatComponent('Text');
export const Heading = compatComponent('Heading');
export const Center = compatComponent('Center');
export const Circle = compatComponent('Circle');
export const Divider = compatComponent('Divider');
export const Pressable = compatComponent('Pressable');
export const ScrollView = compatComponent('ScrollView');
export const KeyboardAvoidingView = compatComponent('KeyboardAvoidingView');
export const Icon = compatComponent('Icon');
export const CheckIcon = compatComponent('CheckIcon');
export const Spinner = compatComponent('Spinner');
export const Button = Object.assign(compatComponent('Button'), {
  Group: compatComponent('Button.Group'),
});
export const Badge = compatComponent('Badge');
export const Progress = compatComponent('Progress');
export const Switch = compatComponent('Switch');
export const Checkbox = compatComponent('Checkbox');
export const Skeleton = Object.assign(compatComponent('Skeleton'), {
  Text: compatComponent('Skeleton.Text'),
});
export const FormControl = Object.assign(compatComponent('FormControl'), {
  Label: compatComponent('FormControl.Label'),
});
export const Select = Object.assign(compatComponent('Select'), {
  Item: compatComponent('Select.Item'),
});
export const Slider = Object.assign(compatComponent('Slider'), {
  Track: compatComponent('Slider.Track'),
  FilledTrack: compatComponent('Slider.FilledTrack'),
  Thumb: compatComponent('Slider.Thumb'),
});
export const Modal = Object.assign(compatComponent('Modal'), {
  Content: compatComponent('Modal.Content'),
  CloseButton: compatComponent('Modal.CloseButton'),
  Header: compatComponent('Modal.Header'),
  Body: compatComponent('Modal.Body'),
  Footer: compatComponent('Modal.Footer'),
});
export const Actionsheet = Object.assign(compatComponent('Actionsheet'), {
  Content: compatComponent('Actionsheet.Content'),
  Item: compatComponent('Actionsheet.Item'),
});

export function useColorMode() {
  // Keep both hook paths stable while a screen can switch implementations.
  const legacyColorMode = NativeBase.useColorMode();
  const nativeWindColorMode = NativeWind.useColorMode();
  const implementation = useUiImplementation();
  return implementation === 'nativewind' ? nativeWindColorMode : legacyColorMode;
}

export function useColorModeValue<T>(light: T, dark: T): T {
  const legacyValue = NativeBase.useColorModeValue(light, dark);
  const nativeWindValue = NativeWind.useColorModeValue(light, dark);
  const implementation = useUiImplementation();
  return implementation === 'nativewind' ? nativeWindValue : legacyValue;
}

export function useToast() {
  // Both hooks always run so changing a screen flag cannot change hook order.
  const legacyToast = NativeBase.useToast();
  const nativeWindToast = NativeWind.useToast();
  const implementation = useUiImplementation();
  return implementation === 'nativewind' ? nativeWindToast : legacyToast;
}
