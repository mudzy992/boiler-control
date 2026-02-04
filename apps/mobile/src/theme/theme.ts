import { extendTheme } from 'native-base';

const config = {
  initialColorMode: 'light' as const,
  useSystemColorMode: false,
};

export const theme = extendTheme({
  config,
  colors: {
    brand: {
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
    },
    dark: {
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
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
    Input: {
      baseStyle: {
        _focus: {
          outlineWidth: 0,
        },
      },
    },
  },
});

export type AppTheme = typeof theme;
