import { baseTvLayout, colors, contentScale, tvLayout, typeScale } from '../index';

function luminance(hex: string): number {
  const [r, g, b] = hex.match(/[\da-f]{2}/gi)!.map((part) => parseInt(part, 16) / 255);
  const linear = [r, g, b].map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('TV UI contrast tokens', () => {
  const textColors = [
    colors.text,
    colors.textMuted,
    colors.textDim,
    colors.accentText,
    colors.success,
    colors.warning,
    colors.fault,
    colors.info,
  ];
  const surfaces = [colors.background, colors.surface, colors.raised];

  it.each(textColors.flatMap((foreground) =>
    surfaces.map((background) => [foreground, background] as const),
  ))('garantuje kontrast najmanje 7:1 (%s na %s)', (foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(7);
  });

  it('garantuje 7:1 za tekst na primarnom dugmetu', () => {
    expect(contrastRatio(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(7);
  });

  it('skalira sadržaj na 75%, zadržavajući čitljivost teksta i ciljeve fokusa', () => {
    expect(contentScale).toBe(0.75);
    expect(typeScale.hero).toBe(27);
    expect(typeScale.body).toBe(12);
    expect(typeScale.micro).toBe(12);
    expect(tvLayout.minFocusTarget).toBeGreaterThanOrEqual(48);
    expect(tvLayout.bottomNavHeight).toBe(48);
  });

  it('ostavlja dimenzije zaglavlja nepromijenjene', () => {
    expect(tvLayout.topBarHeight).toBe(baseTvLayout.topBarHeight);
    expect(baseTvLayout.topBarHeight).toBe(64);
  });
});
