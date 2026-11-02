export type ColorMode = 'light' | 'dark';

type Scale = Record<number, string>;

const gray: Scale = {
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
};

const blue: Scale = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
};

const red: Scale = {
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
  800: '#991b1b',
  900: '#7f1d1d',
};

const orange: Scale = {
  50: '#fff7ed',
  100: '#ffedd5',
  200: '#fed7aa',
  300: '#fdba74',
  400: '#fb923c',
  500: '#f97316',
  600: '#ea580c',
  700: '#c2410c',
  800: '#9a3412',
  900: '#7c2d12',
};

const green: Scale = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
};

const purple: Scale = {
  50: '#faf5ff',
  100: '#f3e8ff',
  200: '#e9d5ff',
  300: '#d8b4fe',
  400: '#c084fc',
  500: '#a855f7',
  600: '#9333ea',
  700: '#7e22ce',
  800: '#6b21a8',
  900: '#581c87',
};

const amber: Scale = {
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
};

export const brand: Scale = {
  50: '#fff1ec',
  100: '#ffd9c8',
  200: '#ffb39c',
  300: '#ff8c6f',
  400: '#ff6b3d',
  500: '#e85223',
  600: '#c1411c',
  700: '#993316',
  800: '#70240f',
  900: '#471607',
};

export const dark: Scale = {
  50: '#f8fafc',
  100: '#e2e8f0',
  200: '#cbd5f5',
  300: '#94a3b8',
  400: '#64748b',
  500: '#475569',
  600: '#334155',
  700: '#1e293b',
  800: '#0f172a',
  900: '#0b0f1a',
};

const scales: Record<string, Scale> = {
  gray,
  coolGray: gray,
  blue,
  red,
  orange,
  green,
  purple,
  amber,
  brand,
  dark,
};

const schemeNames: Record<string, string> = {
  success: 'green',
  warning: 'orange',
  danger: 'red',
  error: 'red',
  info: 'blue',
  muted: 'gray',
  coolGray: 'gray',
};

export function colorSchemeName(value?: string): string {
  if (!value) return 'brand';
  return schemeNames[value] ?? value;
}

export function resolveColor(value: unknown, fallback = '#000000'): string {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  if (value === 'white') return '#ffffff';
  if (value === 'black') return '#000000';
  if (value === 'transparent') return 'transparent';

  const [rawName, rawShade] = value.split('.');
  const name = colorSchemeName(rawName);
  const scale = scales[name];
  if (!scale) return value;

  const shade = Number(rawShade ?? 500);
  return scale[shade] ?? fallback;
}

export const themeColors = {
  light: {
    background: gray[50],
    card: '#ffffff',
    text: gray[800],
    muted: gray[600],
    border: gray[200],
  },
  dark: {
    background: dark[900],
    card: dark[800],
    text: gray[100],
    muted: gray[400],
    border: gray[700],
  },
} as const;
