import { Platform, StyleSheet } from 'react-native';
import { resolveColor } from '../../theme/palette';
import type { ColorMode } from '../../theme/palette';

export type UiValue = number | string;
export type UiProps = {
  children?: React.ReactNode;
  style?: any;
  className?: string;
  [key: string]: any;
};

const fontSizes: Record<string, number> = {
  '2xs': 10,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
};

const headingSizes: Record<string, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
  '2xl': 36,
};

const radii: Record<string, number> = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
};

export function spacing(value: unknown): unknown {
  if (typeof value === 'number') return value * 4;
  if (typeof value !== 'string') return value;
  if (value.endsWith('px')) return Number.parseFloat(value);
  if (value.endsWith('%')) return value;
  if (value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return value;
}

export function dimension(value: unknown): unknown {
  return spacing(value);
}

export function iconSize(value: unknown): number {
  if (typeof value === 'number') return value * 4;
  if (typeof value === 'string') {
    if (value.endsWith('px')) return Number.parseFloat(value);
    if (Number.isFinite(Number(value))) return Number(value) * 4;
    if (value === 'sm') return 16;
    if (value === 'md') return 20;
    if (value === 'lg') return 24;
  }
  return 20;
}

export function fontSize(value: unknown, heading = false): unknown {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return undefined;
  const table = heading ? headingSizes : fontSizes;
  if (table[value] !== undefined) return table[value];
  if (value.endsWith('px')) return Number.parseFloat(value);
  if (Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

export function borderRadius(value: unknown): unknown {
  if (typeof value === 'string' && radii[value] !== undefined) return radii[value];
  if (typeof value === 'number') return value;
  return spacing(value);
}

function shadowStyle(value: unknown) {
  if (value === 'none' || value === 0) {
    return {
      shadowOpacity: 0,
      elevation: 0,
    };
  }
  const level = typeof value === 'number' ? value : Number(value) || 1;
  return {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: Math.max(1, level) },
    shadowOpacity: Math.min(0.08 + level * 0.03, 0.24),
    shadowRadius: Math.max(1, level * 1.5),
    elevation: Platform.OS === 'android' ? Math.max(1, level * 2) : 0,
  };
}

const styleKeys = new Set([
  'alignItems',
  'alignSelf',
  'backgroundColor',
  'bg',
  'borderBottomColor',
  'borderBottomWidth',
  'borderColor',
  'borderLeftColor',
  'borderLeftWidth',
  'borderRadius',
  'borderRightColor',
  'borderRightWidth',
  'borderTopColor',
  'borderTopWidth',
  'borderWidth',
  'bottom',
  'color',
  'elevation',
  'flex',
  'flexDirection',
  'flexGrow',
  'flexShrink',
  'flexWrap',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'h',
  'height',
  'italic',
  'justifyContent',
  'left',
  'letterSpacing',
  'lineHeight',
  'm',
  'margin',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginTop',
  'maxH',
  'maxHeight',
  'maxW',
  'maxWidth',
  'mb',
  'minH',
  'minHeight',
  'minW',
  'minWidth',
  'ml',
  'mr',
  'mt',
  'mx',
  'my',
  'opacity',
  'overflow',
  'p',
  'padding',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'pb',
  'pl',
  'position',
  'pr',
  'pt',
  'px',
  'py',
  'right',
  'rounded',
  'shadow',
  'space',
  'textAlign',
  'textTransform',
  'top',
  'w',
  'width',
  'zIndex',
]);

function assignSpacings(style: Record<string, unknown>, props: UiProps) {
  const mappings: [string, string][] = [
    ['m', 'margin'],
    ['mt', 'marginTop'],
    ['mb', 'marginBottom'],
    ['ml', 'marginLeft'],
    ['mr', 'marginRight'],
    ['p', 'padding'],
    ['pt', 'paddingTop'],
    ['pb', 'paddingBottom'],
    ['pl', 'paddingLeft'],
    ['pr', 'paddingRight'],
  ];
  for (const [prop, target] of mappings) {
    if (props[prop] !== undefined) style[target] = spacing(props[prop]);
  }
  if (props.mx !== undefined) {
    style.marginLeft = spacing(props.mx);
    style.marginRight = spacing(props.mx);
  }
  if (props.my !== undefined) {
    style.marginTop = spacing(props.my);
    style.marginBottom = spacing(props.my);
  }
  if (props.px !== undefined) {
    style.paddingLeft = spacing(props.px);
    style.paddingRight = spacing(props.px);
  }
  if (props.py !== undefined) {
    style.paddingTop = spacing(props.py);
    style.paddingBottom = spacing(props.py);
  }
}

function applyStyleObject(
  style: Record<string, unknown>,
  props: UiProps,
  mode: ColorMode,
  text: boolean,
) {
  assignSpacings(style, props);

  const dimensions: [string, string][] = [
    ['w', 'width'],
    ['h', 'height'],
    ['width', 'width'],
    ['height', 'height'],
    ['minW', 'minWidth'],
    ['minWidth', 'minWidth'],
    ['maxW', 'maxWidth'],
    ['maxWidth', 'maxWidth'],
    ['minH', 'minHeight'],
    ['minHeight', 'minHeight'],
    ['maxH', 'maxHeight'],
    ['maxHeight', 'maxHeight'],
    ['top', 'top'],
    ['right', 'right'],
    ['bottom', 'bottom'],
    ['left', 'left'],
  ];
  for (const [prop, target] of dimensions) {
    if (props[prop] !== undefined) style[target] = dimension(props[prop]);
  }

  const direct = [
    'alignItems',
    'alignSelf',
    'flex',
    'flexDirection',
    'flexGrow',
    'flexShrink',
    'flexWrap',
    'justifyContent',
    'opacity',
    'overflow',
    'position',
    'zIndex',
    'borderWidth',
    'borderTopWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'borderRightWidth',
  ];
  for (const key of direct) {
    if (props[key] !== undefined) style[key] = props[key];
  }

  if (props.bg !== undefined || props.backgroundColor !== undefined) {
    style.backgroundColor = resolveColor(props.bg ?? props.backgroundColor, 'transparent');
  }
  const colorKeys = [
    'borderColor',
    'borderTopColor',
    'borderBottomColor',
    'borderLeftColor',
    'borderRightColor',
  ];
  for (const key of colorKeys) {
    if (props[key] !== undefined) style[key] = resolveColor(props[key], 'transparent');
  }
  if (props.rounded !== undefined || props.borderRadius !== undefined) {
    style.borderRadius = borderRadius(props.rounded ?? props.borderRadius);
  }
  if (props.shadow !== undefined) Object.assign(style, shadowStyle(props.shadow));

  if (text) {
    if (props.color !== undefined) style.color = resolveColor(props.color);
    if (props.fontSize !== undefined) style.fontSize = fontSize(props.fontSize);
    if (props.fontWeight !== undefined) style.fontWeight = String(props.fontWeight);
    if (props.fontFamily !== undefined) style.fontFamily = props.fontFamily;
    if (props.textAlign !== undefined) style.textAlign = props.textAlign;
    if (props.textTransform !== undefined) style.textTransform = props.textTransform;
    if (props.letterSpacing !== undefined) {
      style.letterSpacing = Number(props.letterSpacing);
    }
    if (props.lineHeight !== undefined) {
      style.lineHeight = fontSize(props.lineHeight) ?? Number(props.lineHeight);
    }
    if (props.italic) style.fontStyle = 'italic';
  }

  if (mode === 'dark' && props._dark) {
    applyStyleObject(style, props._dark, mode, text);
  }
}

export function buildStyle(
  props: UiProps,
  mode: ColorMode,
  options: { text?: boolean; heading?: boolean } = {},
) {
  const style: Record<string, unknown> = {};
  applyStyleObject(style, props, mode, options.text ?? false);
  if (options.heading && props.size !== undefined) {
    style.fontSize = fontSize(props.size, true);
  }
  return StyleSheet.flatten([style, props.style]) as any;
}

export function gapStyle(space: unknown) {
  return space === undefined ? undefined : { gap: Number(spacing(space)) };
}

export function nativeProps(props: UiProps, extraOmit: string[] = []) {
  const omitted = new Set([...styleKeys, ...extraOmit, 'safeArea']);
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(props)) {
    if (omitted.has(key) || key.startsWith('_')) continue;
    result[key] = value;
  }
  return result;
}
