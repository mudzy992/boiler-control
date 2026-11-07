/**
 * Semantički dizajn tokeni — jedna tačka istine za obje teme.
 *
 * Pravilo: hex postoji SAMO u ovom fajlu. Nijedan ekran i nijedna komponenta
 * ne smije sadržavati hex vrijednost ni `useColorModeValue('gray.800', ...)`.
 * Komponente traže token po imenu, a tema odlučuje koju vrijednost daje.
 *
 * Imena su semantička, ne vizuelna: `canvas` je podloga, `panel` je površina,
 * `ink` je tekst. Zato dark → light nije prepisivanje ekrana, nego druga
 * vrijednost istog imena.
 *
 * Vrijednosti su usklađene sa web instrument panelom:
 * `frontend/src/design/tokens.css` (isti `--signal: 255 107 61`).
 */

import type { ColorMode } from './palette';

/** Boje koje tema daje. Svaka postoji u obje varijante. */
export type ThemeTokens = {
  /** Podloga ekrana. */
  canvas: string;
  /** Površina panela / kartice. */
  panel: string;
  /** Uzdignuta površina unutar panela (polja, pločice). */
  raised: string;
  /** Hairline ivica. */
  line: string;
  /** Jača ivica: fokus, aktivna kontrola. */
  lineStrong: string;
  /** Primarni tekst. */
  ink: string;
  /** Sekundarni tekst. */
  inkMuted: string;
  /** Tercijarni tekst: meta, jedinice, vremenske oznake. */
  inkDim: string;
  /** Brand signal — samo akcija, fokus i živo stanje. */
  signal: string;
  /** Signal na tamnoj podlozi kao tekst (za kontrast). */
  signalInk: string;
  /** Tekst na signalnoj podlozi (dugme). */
  onSignal: string;
  /** Uspjeh / u toleranciji. */
  ok: string;
  /** Upozorenje / odstupanje. */
  warn: string;
  /** Greška / kvar. */
  fault: string;
  /** Informativo. */
  info: string;
  /** Prozirna podloga za LED „sjaj" i slično. */
  signalSoft: string;
  okSoft: string;
  warnSoft: string;
  faultSoft: string;
  infoSoft: string;
  /** Overlay ispod bottom sheeta i modala. */
  scrim: string;
};

/**
 * Dark je default (odluka vlasnika 2026-11-07: „default da bude dark kao na webu").
 * Vrijednosti su iste kao `html.dark` u web tokenima.
 */
export const darkTokens: ThemeTokens = {
  canvas: '#05070b',
  panel: '#0b0f16',
  raised: '#111723',
  line: '#1f2733',
  lineStrong: '#2c3746',
  ink: '#e8edf4',
  inkMuted: '#9aa6b6',
  inkDim: '#6b7788',
  signal: '#ff6b3d',
  signalInk: '#ff8a5f',
  onSignal: '#0b0f16',
  ok: '#22c55e',
  warn: '#f5a524',
  fault: '#ef4444',
  info: '#38bdf8',
  signalSoft: 'rgba(255, 107, 61, 0.14)',
  okSoft: 'rgba(34, 197, 94, 0.14)',
  warnSoft: 'rgba(245, 165, 36, 0.14)',
  faultSoft: 'rgba(239, 68, 68, 0.14)',
  infoSoft: 'rgba(56, 189, 248, 0.12)',
  scrim: 'rgba(3, 5, 8, 0.66)',
};

/** Svijetla tema je „daylight" mapiranje istih imena, ne drugi sistem. */
export const lightTokens: ThemeTokens = {
  canvas: '#f6f7fb',
  panel: '#ffffff',
  raised: '#f1f3f7',
  line: '#dce0e8',
  lineStrong: '#c3cad6',
  ink: '#111827',
  inkMuted: '#4b5563',
  inkDim: '#6b7280',
  signal: '#e85223',
  signalInk: '#c1411c',
  onSignal: '#ffffff',
  ok: '#16a34a',
  warn: '#b45309',
  fault: '#dc2626',
  info: '#0284c7',
  signalSoft: 'rgba(232, 82, 35, 0.10)',
  okSoft: 'rgba(22, 163, 74, 0.10)',
  warnSoft: 'rgba(180, 83, 9, 0.10)',
  faultSoft: 'rgba(220, 38, 38, 0.10)',
  infoSoft: 'rgba(2, 132, 199, 0.10)',
  scrim: 'rgba(17, 24, 39, 0.45)',
};

export const themeTokens: Record<ColorMode, ThemeTokens> = {
  dark: darkTokens,
  light: lightTokens,
};

/** Razmaci — 4px baza, ista skala kao web (`--space-*`). */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Radijusi — 2 za oznake, 3 za kontrole, 4 za panele. Nema „pill" osim za LED. */
export const radius = {
  tag: 2,
  control: 3,
  panel: 4,
  pill: 999,
} as const;

/** Tipografija — IBM Plex, imena familija kako ih `useAppFonts` registruje. */
export const fontFamily = {
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemiBold: 'IBMPlexSans_600SemiBold',
  sansBold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const;

/**
 * Fallback familije: koriste se dok se fontovi učitavaju i u testovima
 * (jest ne učitava ttf). Ista imena polja, pa pozivni kod ne zna razliku.
 */
export const systemFontFamily = {
  sans: undefined,
  sansMedium: undefined,
  sansSemiBold: undefined,
  sansBold: undefined,
  mono: 'monospace',
  monoMedium: 'monospace',
  monoSemiBold: 'monospace',
} as const;

export const fontSize = {
  /** Mono mikro-labela (uppercase, tracking). */
  label: 9,
  /** Mala meta. */
  meta: 10,
  /** Tijelo — sekundarno. */
  body: 12,
  /** Tijelo — primarno. */
  bodyLg: 13,
  /** Naslov ekrana. */
  title: 21,
  /** Naslov sekcije. */
  section: 14,
  /** Readout L. */
  readoutLg: 26,
  /** Readout XL. */
  readoutXl: 40,
} as const;

/** Trajanja animacija — 150–200 ms, `ease-out`. */
export const motion = {
  fast: 120,
  base: 170,
} as const;

/** Dodirna zona — minimum za svaku interaktivnu površinu. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const MIN_TOUCH = 44;

/** Helper: tokeni za datu temu. */
export function tokensFor(mode: ColorMode): ThemeTokens {
  return themeTokens[mode] ?? darkTokens;
}
