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
  inkDim: '#828d9e',
  signal: '#ff6b3d',
  signalInk: '#ff8a5f',
  onSignal: '#0b0f16',
  ok: '#22c55e',
  warn: '#f5a524',
  /* A11Y 2026-11-21: 239 68 68 je na `faultSoft` dao 4,19:1 — ispod AA. */
  fault: '#f87171',
  info: '#38bdf8',
  signalSoft: 'rgba(255, 107, 61, 0.14)',
  okSoft: 'rgba(34, 197, 94, 0.14)',
  warnSoft: 'rgba(245, 165, 36, 0.14)',
  faultSoft: 'rgba(239, 68, 68, 0.14)',
  infoSoft: 'rgba(56, 189, 248, 0.12)',
  scrim: 'rgba(3, 5, 8, 0.66)',
};

/**
 * Svijetla tema je „daylight" mapiranje istih imena, ne drugi sistem.
 *
 * F6 (A11Y-01): vrijednosti su korigovane da svaki tekstualni token prolazi
 * **WCAG 2.2 AA na sve tri podloge** (`panel`, `canvas`, `raised`), a ne samo na
 * bijeloj. Prije je `ok` (#16a34a) imao 3,30:1 na panelu — dakle padao i AA za
 * veliki tekst — a `signal` (#e85223) 3,71:1, pa je i tekst na dugmetu
 * (`onSignal` #ffffff na signal) bio ispod granice. Nove vrijednosti:
 *   signal #b43a0c (5,79 / 5,54 / 5,32), ok #146e34 (5,71 / 5,43 / 5,23),
 *   fault #b91c1c (6,47 / 6,04 / 5,82), info #0369a1 (5,93 / 5,54 / 5,34),
 *   inkDim #59616e (6,25 / 5,84 / 5,63).
 *
 * 2026-11-21 (A11Y mjerenje i na tintu): iste boje se koriste kao tekst **na
 * vlastitoj 10% podlozi** (`okSoft`, `warnSoft`…). Tu su `ok`, `warn` i `signal`
 * davali 4,07–4,14:1 — ispod AA. Zato su `signal` (#c2410c → #b43a0c), `ok`
 * (#15803d → #146e34) i `warn` (#b45309 → #9e4808) potamnjene; tekst na tintu
 * sada ima 4,61–4,97:1. Vrijednosti su **iste kao u web tokenima**
 * (`frontend/src/design/tokens.css`), a to poredi `frontend/src/design/__tests__/contrast.test.ts`.
 * Tamna tema je prolazila, osim `inkDim` (#6b7788 → 4,22:1); sada je #828d9e
 * (5,71 / 6,00 / 5,34), pa su i mikro-labele AAA za veliki tekst.
 * Kontrast se mjeri u `src/ui/__tests__/a11yContrast.test.ts`, da ga sljedeća
 * izmjena palete ne može tiho pokvariti.
 */
export const lightTokens: ThemeTokens = {
  canvas: '#f6f7fb',
  panel: '#ffffff',
  raised: '#f1f3f7',
  line: '#dce0e8',
  lineStrong: '#c3cad6',
  ink: '#111827',
  inkMuted: '#4b5563',
  inkDim: '#59616e',
  signal: '#b43a0c',
  signalInk: '#b43a0c',
  onSignal: '#ffffff',
  ok: '#146e34',
  warn: '#9e4808',
  fault: '#b91c1c',
  info: '#0369a1',
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

/**
 * Tipografska skala.
 *
 * F6 (A11Y-14): minimalna veličina je podignuta sa 9 na 11 px.
 *
 * Prije: `label` 9 px i `meta` 10 px — mikro-labele su bile ispod svake granice
 * čitljivosti, a pošto su `MonoLabel`/`MonoMeta` najčešći elementi u
 * aplikaciji (svaki panel, svaki KPI, svaki red), to je bio najveći
 * pojedinačni problem pristupačnosti u UI-ju. WCAG 2.2 1.4.4 traži da se tekst
 * može uvećati do 200% bez gubitka sadržaja; na 9 px to praktično nije moguće.
 *
 * Sada: 11 / 12 / 13 / 15 / 16 / 22 / 28 / 40. Skala ostaje ne-linearna (isti
 * odnos kao prije), pa se hijerarhija ne mijenja — samo je osnova podignuta.
 * Kod koji je pisao `fontSize: 9` ručno sada koristi `fontSize.label`, da
 * sljedeća izmjena skale ne zaobiđe taj fajl.
 */
export const fontSize = {
  /** Mono mikro-labela (uppercase, tracking). */
  label: 11,
  /** Mala meta. */
  meta: 12,
  /** Tijelo — sekundarno. */
  body: 13,
  /** Tijelo — primarno. */
  bodyLg: 15,
  /** Naslov ekrana. */
  title: 22,
  /** Naslov sekcije. */
  section: 16,
  /** Readout L. */
  readoutLg: 28,
  /** Readout XL. */
  readoutXl: 40,
} as const;

/** Visina reda po veličini — 1,35 × veličina, za tekst tijela. */
export function lineHeightFor(size: number): number {
  return Math.round(size * 1.35);
}

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
