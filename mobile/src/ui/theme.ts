/**
 * Most između `AppTheme` konteksta i tokena.
 *
 * Komponente iz `src/ui` zovu `useTokens()` — nikad `useColorModeValue`.
 * Time tema ima jednu tačku odluke (`tokensFor`), a ne 228 rasutih parova.
 */

import { useMemo } from 'react';

import { useAppColorMode } from '../theme/AppTheme';
import { useAppFonts, resolveFontFamilies } from '../theme/fonts';
import { tokensFor, type ThemeTokens } from '../theme/tokens';
import type { ColorMode } from '../theme/palette';

export type UseTokensResult = {
  t: ThemeTokens;
  mode: ColorMode;
  fonts: ReturnType<typeof resolveFontFamilies>;
  /** `true` dok IBM Plex nije spreman — koristi se samo u testovima/skeletonima. */
  fontFallback: boolean;
};

export function useTokens(): UseTokensResult {
  const { colorMode } = useAppColorMode();
  const { fallback } = useAppFonts();
  const t = useMemo(() => tokensFor(colorMode), [colorMode]);
  const fonts = useMemo(() => resolveFontFamilies(fallback), [fallback]);

  return { t, mode: colorMode, fonts, fontFallback: fallback };
}
