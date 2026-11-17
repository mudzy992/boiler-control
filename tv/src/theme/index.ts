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

/** Veći razmaci nego na mobilnom, zbog gledanja sa nekoliko metara. */
export const fonts = {
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemiBold: 'IBMPlexSans_600SemiBold',
  sansBold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const;

export const spacing = {
  sm: 12,
  md: 24,
  lg: 40,
  xl: 64,
} as const;
