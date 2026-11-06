/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        transparent: 'transparent',
        current: 'currentColor',
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          soft: 'rgb(var(--border-soft) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
          inverse: 'rgb(var(--text-inverse) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          light: 'rgb(var(--success-light) / <alpha-value>)',
          dark: 'rgb(var(--success-dark) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          light: 'rgb(var(--warning-light) / <alpha-value>)',
          dark: 'rgb(var(--warning-dark) / <alpha-value>)',
        },
        error: {
          DEFAULT: 'rgb(var(--error) / <alpha-value>)',
          light: 'rgb(var(--error-light) / <alpha-value>)',
          dark: 'rgb(var(--error-dark) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--info) / <alpha-value>)',
          light: 'rgb(var(--info-light) / <alpha-value>)',
          dark: 'rgb(var(--info-dark) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        xs: ['var(--text-xs)', { lineHeight: 'var(--text-xs-lh)' }],
        sm: ['var(--text-sm)', { lineHeight: 'var(--text-sm-lh)' }],
        base: ['var(--text-base)', { lineHeight: 'var(--text-base-lh)' }],
        lg: ['var(--text-lg)', { lineHeight: 'var(--text-lg-lh)' }],
        xl: ['var(--text-xl)', { lineHeight: 'var(--text-xl-lh)' }],
        '2xl': ['var(--text-2xl)', { lineHeight: 'var(--text-2xl-lh)' }],
        '3xl': ['var(--text-3xl)', { lineHeight: 'var(--text-3xl-lh)' }],
        '4xl': ['var(--text-4xl)', { lineHeight: 'var(--text-4xl-lh)' }],
      },
      fontWeight: {
        normal: 'var(--font-weight-normal)',
        medium: 'var(--font-weight-medium)',
        semibold: 'var(--font-weight-semibold)',
        bold: 'var(--font-weight-bold)',
      },
      spacing: {
        0: 'var(--space-0)',
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      transitionTimingFunction: {
        'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        DEFAULT: '200ms',
        slow: '300ms',
      },
      zIndex: {
        dropdown: '1000',
        sticky: '1100',
        fixed: '1200',
        'modal-backdrop': '1300',
        modal: '1400',
        popover: '1500',
        tooltip: '1600',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
