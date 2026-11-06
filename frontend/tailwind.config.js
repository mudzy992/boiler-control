/** @type {import('tailwindcss').Config} */
const rgb = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        brand: {
          DEFAULT: rgb('--brand'),
          50: rgb('--brand-50'),
          100: rgb('--brand-100'),
          600: rgb('--brand-600'),
          700: rgb('--brand-700'),
          900: rgb('--brand-900'),
        },
        surface: {
          DEFAULT: rgb('--surface'),
          muted: rgb('--surface-muted'),
          elevated: rgb('--surface-elevated'),
        },
        text: {
          primary: rgb('--text-primary'),
          secondary: rgb('--text-secondary'),
          tertiary: rgb('--text-tertiary'),
          inverse: rgb('--text-inverse'),
        },
        success: {
          DEFAULT: rgb('--success'),
          50: rgb('--success-50'),
          100: rgb('--success-100'),
          700: rgb('--success-700'),
          900: rgb('--success-900'),
        },
        error: {
          DEFAULT: rgb('--error'),
          50: rgb('--error-50'),
          100: rgb('--error-100'),
          700: rgb('--error-700'),
          900: rgb('--error-900'),
        },
        warning: {
          DEFAULT: rgb('--warning'),
        },
        info: {
          DEFAULT: rgb('--info'),
        },
        'dark-surface': rgb('--dark-surface'),
        'dark-surface-muted': rgb('--dark-surface-muted'),
        'dark-surface-elevated': rgb('--dark-surface-elevated'),
        'dark-border': rgb('--dark-border'),
        'dark-text-primary': rgb('--dark-text-primary'),
        'dark-text-secondary': rgb('--dark-text-secondary'),
        'dark-text-tertiary': rgb('--dark-text-tertiary'),
        'dark-error': rgb('--error'),
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      zIndex: {
        dropdown: 'var(--z-dropdown)',
        sticky: 'var(--z-sticky)',
        fixed: 'var(--z-fixed)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        modal: 'var(--z-modal)',
        popover: 'var(--z-popover)',
        tooltip: 'var(--z-tooltip)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
