/**
 * IBM Plex fontovi — self-host, bez mrežnog CDN-a.
 *
 * Zašto ovako, a ne `@expo-google-fonts/*` ili Google Fonts link:
 *  - `expo-font` je već instaliran (`~58.0.11`), a ttf-ovi su u repou
 *    (`mobile/assets/fonts`), pa nema nove zavisnosti ni mrežnog poziva na startu;
 *  - iste familije kao web (`frontend/src/design/tokens.css`: IBM Plex Sans / Mono),
 *    pa su brojevi i tekst vizuelno isti na obje platforme;
 *  - ako učitavanje padne, `useAppFonts` vraća `loaded: true` i komponente
 *    koriste `systemFontFamily` — tekst ostaje čitljiv, aplikacija ne pada.
 *
 * Licenca: SIL Open Font License 1.1 — `mobile/assets/fonts/OFL.txt`.
 */

import { useFonts } from 'expo-font';

import { fontFamily, systemFontFamily } from './tokens';

/** Maper imena iz `tokens.fontFamily` → require(ttf). */
const fontAssets = {
  [fontFamily.sans]: require('../../assets/fonts/IBMPlexSans_400Regular.ttf'),
  [fontFamily.sansMedium]: require('../../assets/fonts/IBMPlexSans_500Medium.ttf'),
  [fontFamily.sansSemiBold]: require('../../assets/fonts/IBMPlexSans_600SemiBold.ttf'),
  [fontFamily.sansBold]: require('../../assets/fonts/IBMPlexSans_700Bold.ttf'),
  [fontFamily.mono]: require('../../assets/fonts/IBMPlexMono_400Regular.ttf'),
  [fontFamily.monoMedium]: require('../../assets/fonts/IBMPlexMono_500Medium.ttf'),
  [fontFamily.monoSemiBold]: require('../../assets/fonts/IBMPlexMono_600SemiBold.ttf'),
} as const;

export type AppFontResult = {
  /** `true` kad su fontovi spremni ILI kad je fallback aktivan — nikad ne blokira UI. */
  loaded: boolean;
  /** `true` kada se koriste sistemske familije (učitavanje palo ili još traje). */
  fallback: boolean;
  error: Error | null;
};

/**
 * Učitava IBM Plex. Namjerno ne baca i ne blokira render: aplikacija se crta
 * odmah sa sistemskim fontom, a prelazak na Plex je neprimjetan (isti metrici
 * okviri, bez layout skoka).
 */
export function useAppFonts(): AppFontResult {
  const [loaded, error] = useFonts(fontAssets);

  return {
    // Fallback je spreman čim padne ili dok traje — `loaded` je zato uvijek `true`
    // za potrošače koji samo žele znati da li smiju crtati.
    loaded: true,
    fallback: !loaded,
    error: error ?? null,
  };
}

/**
 * Vraća familije koje treba koristiti u datom trenutku.
 * Komponente zovu ovo, a ne `fontFamily` direktno, da testovi i prvi frame
 * ne traže nepostojeći font.
 */
export function resolveFontFamilies(fallback: boolean) {
  return fallback ? systemFontFamily : fontFamily;
}

export { fontAssets };
