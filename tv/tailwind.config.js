const tokens = require('./src/theme/tokens.json');

module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: tokens.colors.background,
        surface: tokens.colors.surface,
        raised: tokens.colors.raised,
        line: tokens.colors.border,
        ink: tokens.colors.text,
        muted: tokens.colors.textMuted,
        dim: tokens.colors.textDim,
        accent: tokens.colors.accent,
        'on-accent': tokens.colors.onAccent,
        success: tokens.colors.success,
        warning: tokens.colors.warning,
        fault: tokens.colors.fault,
        info: tokens.colors.info,
      },
      fontFamily: {
        sans: [tokens.fonts.sans],
        medium: [tokens.fonts.sansMedium],
        semibold: [tokens.fonts.sansSemiBold],
        bold: [tokens.fonts.sansBold],
        mono: [tokens.fonts.mono],
        'mono-semibold': [tokens.fonts.monoSemiBold],
      },
      fontSize: Object.fromEntries(
        Object.entries(tokens.typeScale).map(([name, size]) => [name, `${size}px`]),
      ),
      spacing: {
        safeX: `${tokens.tvLayout.safeX}px`,
        safeY: `${tokens.tvLayout.safeY}px`,
        ...Object.fromEntries(Object.entries(tokens.spacing).map(([name, value]) => [name, `${value}px`])),
      },
      borderRadius: { tv: '18px', control: '12px' },
      borderWidth: { focus: `${tokens.tvLayout.focusBorder}px` },
      minHeight: { focus: `${tokens.tvLayout.minFocusTarget}px` },
      scale: { focus: `${tokens.tvLayout.focusScale}` },
    },
  },
  plugins: [],
};
