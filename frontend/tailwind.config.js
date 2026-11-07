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
        canvas: rgb('--canvas'),
        panel: {
          DEFAULT: rgb('--panel-bg'),
          border: rgb('--panel-border'),
          header: rgb('--panel-header-bg'),
        },
        raised: rgb('--raised'),
        line: {
          DEFAULT: rgb('--line'),
          strong: rgb('--line-strong'),
        },
        ink: {
          DEFAULT: rgb('--ink'),
          muted: rgb('--ink-muted'),
          dim: rgb('--ink-dim'),
        },
        signal: rgb('--signal'),
        ok: rgb('--ok'),
        warn: rgb('--warn'),
        fault: rgb('--fault'),
        info: rgb('--info'),
        /* Temporary bridges while pages migrate off shadcn class names */
        background: rgb('--canvas'),
        foreground: rgb('--ink'),
        card: {
          DEFAULT: rgb('--panel-bg'),
          foreground: rgb('--ink'),
        },
        popover: {
          DEFAULT: rgb('--panel-bg'),
          foreground: rgb('--ink'),
        },
        primary: {
          DEFAULT: rgb('--signal'),
          foreground: rgb('--btn-primary-fg'),
        },
        secondary: {
          DEFAULT: rgb('--btn-secondary-bg'),
          foreground: rgb('--btn-secondary-fg'),
        },
        muted: {
          DEFAULT: rgb('--raised'),
          foreground: rgb('--ink-muted'),
        },
        accent: {
          DEFAULT: rgb('--warn'),
          foreground: rgb('--ink'),
        },
        destructive: {
          DEFAULT: rgb('--fault'),
          foreground: 'rgb(255 255 255 / <alpha-value>)',
        },
        border: rgb('--line'),
        ring: rgb('--signal'),

        brand: {
          DEFAULT: rgb('--signal'),
          700: rgb('--btn-primary-bg-hover'),
          900: rgb('--btn-primary-fg'),
        },
        surface: {
          DEFAULT: rgb('--panel-bg'),
          muted: rgb('--raised'),
          elevated: rgb('--raised'),
        },
        success: {
          DEFAULT: rgb('--ok'),
          50: rgb('--raised'),
          100: rgb('--raised'),
          700: rgb('--ok'),
          900: rgb('--ok'),
        },
        error: {
          DEFAULT: rgb('--fault'),
          50: rgb('--raised'),
          100: rgb('--raised'),
          700: rgb('--fault'),
          900: rgb('--fault'),
        },
        warning: rgb('--warn'),
        'dark-surface': rgb('--panel-bg'),
        'dark-surface-muted': rgb('--canvas'),
        'dark-surface-elevated': rgb('--raised'),
        'dark-border': rgb('--line'),
        'dark-text-primary': rgb('--ink'),
        'dark-text-secondary': rgb('--ink-muted'),
        'dark-text-tertiary': rgb('--ink-dim'),
        'dark-error': rgb('--fault'),
        text: {
          primary: rgb('--ink'),
          secondary: rgb('--ink-muted'),
          tertiary: rgb('--ink-dim'),
          inverse: rgb('--canvas'),
        },
        btn: {
          primary: rgb('--btn-primary-bg'),
          'primary-hover': rgb('--btn-primary-bg-hover'),
          'primary-fg': rgb('--btn-primary-fg'),
          'primary-border': rgb('--btn-primary-border'),
          secondary: rgb('--btn-secondary-bg'),
          'secondary-hover': rgb('--btn-secondary-bg-hover'),
          'secondary-fg': rgb('--btn-secondary-fg'),
          'secondary-border': rgb('--btn-secondary-border'),
          ghost: rgb('--btn-ghost-bg'),
          'ghost-hover': rgb('--btn-ghost-bg-hover'),
          'ghost-fg': rgb('--btn-ghost-fg'),
          danger: rgb('--btn-danger-bg'),
          'danger-hover': rgb('--btn-danger-bg-hover'),
          'danger-fg': rgb('--btn-danger-fg'),
          'danger-border': rgb('--btn-danger-border'),
        },
        input: {
          DEFAULT: rgb('--input-bg'),
          border: rgb('--input-border'),
          'border-hover': rgb('--input-border-hover'),
          'border-focus': rgb('--input-border-focus'),
          fg: rgb('--input-fg'),
          placeholder: rgb('--input-placeholder'),
          invalid: rgb('--input-invalid'),
        },
        hero: {
          DEFAULT: rgb('--hero-bg'),
          border: rgb('--hero-border'),
        },
      },
      borderRadius: {
        control: 'var(--radius-control)',
        panel: 'var(--radius-panel)',
      },
      height: {
        'control-sm': 'var(--control-h-sm)',
        'control-md': 'var(--control-h-md)',
        'control-lg': 'var(--control-h-lg)',
      },
      width: {
        'control-sm': 'var(--control-h-sm)',
        'control-md': 'var(--control-h-md)',
        'control-lg': 'var(--control-h-lg)',
      },
      minHeight: {
        'control-sm': 'var(--control-h-sm)',
        'control-md': 'var(--control-h-md)',
        'control-lg': 'var(--control-h-lg)',
      },

      fontSize: {
        display: ['var(--text-display)', { lineHeight: 'var(--text-display-lh)' }],
        kpi: ['var(--text-kpi)', { lineHeight: 'var(--text-kpi-lh)' }],
      },
      backgroundImage: {
        'dot-grid':
          'radial-gradient(rgb(var(--line) / 0.55) 1px, transparent 1px)',
      },
      backgroundSize: {
        'dot-grid': '16px 16px',
      },
      keyframes: {
        'status-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'status-pulse': 'status-pulse 1.6s ease-in-out infinite',
      },
      zIndex: {
        sticky: 'var(--z-sticky)',
        fixed: 'var(--z-fixed)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        modal: 'var(--z-modal)',
        popover: 'var(--z-popover)',
        tooltip: 'var(--z-tooltip)',
      },
      transitionDuration: {
        fast: '120ms',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: true,
  },
};
