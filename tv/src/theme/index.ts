/**
 * Zajednička mobilna dark paleta (`mobile/src/theme/tokens.ts`).
 * TV zadržava veću skalu i razmake za gledanje iz daljine, ali koristi iste
 * brand boje, podloge, tekst i semantičke statuse kao mobilna aplikacija.
 */
export const colors = {
  background: '#05070b',
  surface: '#0b0f16',
  raised: '#111723',
  border: '#1f2733',
  text: '#e8edf4',
  textMuted: '#9aa6b6',
  textDim: '#828d9e',
  accent: '#ff6b3d',
  onAccent: '#0b0f16',
  success: '#22c55e',
  warning: '#f5a524',
  fault: '#f87171',
} as const;

/** Tipografija ostaje čitljiva iz daljine. */
export const fonts = {
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemiBold: 'IBMPlexSans_600SemiBold',
  sansBold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const;

/** Jedinstvena skala tipografije za kanonski TV prikaz (dp). */
export const typeScale = {
  hero: 36,
  title: 28,
  section: 18,
  body: 16,
  small: 14,
  micro: 12,
} as const;

/** Kanonske margine sigurne zone i pravila interakcije za Android TV. */
export const tvLayout = {
  safeX: 48,
  safeY: 27,
  focusScale: 1.05,
  minFocusTarget: 48,
  focusBorder: 2,
  topBarHeight: 64,
  bottomNavHeight: 64,
} as const;

/** Umjereni TV razmaci: čitljivi iz daljine bez guranja sadržaja van ekrana. */
export const spacing = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
