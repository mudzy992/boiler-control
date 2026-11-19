import tokens from './tokens.json';

/** Shared tokens are imported by both React Native and NativeWind/Tailwind. */
export const colors = tokens.colors;
export const fonts = tokens.fonts;
export const contentScale = tokens.tvLayout.contentScale;
export const scaleContent = (value: number): number => Math.round(value * contentScale);

/**
 * Content is intentionally 25% more compact for 4K living-room displays.
 * Keep the smallest text at 12 dp and D-pad targets at 48 dp so compactness
 * does not make secondary information or controls impractical at a distance.
 */
export const baseTypeScale = tokens.typeScale;
export const typeScale = Object.fromEntries(
  Object.entries(tokens.typeScale).map(([key, value]) => [key, Math.max(12, scaleContent(value))]),
) as typeof tokens.typeScale;
export const baseTvLayout = tokens.tvLayout;
export const tvLayout = {
  ...tokens.tvLayout,
  safeX: scaleContent(tokens.tvLayout.safeX),
  safeY: scaleContent(tokens.tvLayout.safeY),
  bottomNavHeight: scaleContent(tokens.tvLayout.bottomNavHeight),
  minFocusTarget: tokens.tvLayout.minFocusTarget,
};
export const baseSpacing = tokens.spacing;
export const spacing = Object.fromEntries(
  Object.entries(tokens.spacing).map(([key, value]) => [key, scaleContent(value)]),
) as typeof tokens.spacing;
