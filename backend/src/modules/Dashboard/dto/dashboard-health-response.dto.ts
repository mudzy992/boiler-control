import { ApiProperty } from '@nestjs/swagger';

/**
 * FE2-14 (FE-010): odgovor `GET /api/dashboard/health`.
 *
 * Health score i pravila upozorenja su se prije računali na klijentima, i to
 * **različito**: web je koristio `max(0, 100 - anomalije×15)`, a mobile
 * ponderisanu formulu. Za isti ulaz davali su različit broj. Po odluci
 * vlasnika (2026-10-30) logika je preseljena ovdje, u jedan izvor.
 *
 * Sva polja dolaze iz `src/common/heating-health.ts` — NIJEDNO nije izmišljeno.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;

/** Ključevi signala koji ulaze u health score (ponderi u `HEALTH_WEIGHTS`). */
export const HEALTH_COMPONENT_KEYS = [
  'learningConfidence',
  'flowDelta',
  'thermostatFreshness',
  'anomalyRate',
] as const;

/** Tipovi upozorenja koje `buildHealthWarnings()` može vratiti. */
export const HEALTH_WARNING_TYPES = [
  'shortCycles',
  'longCycles',
  'targetShortfall',
  'targetOvershoot',
  'anomalies',
] as const;

/** Nivoi ozbiljnosti upozorenja. */
export const HEALTH_WARNING_LEVELS = ['info', 'warning', 'error'] as const;

/**
 * Jedan signal koji učestvuje u ponderisanom scoreu.
 *
 * Komponente koje nemaju podataka se **izostavljaju** iz niza (npr. nema
 * termostata → nema `thermostatFreshness`), pa se ponderi preostalih
 * normalizuju. Zato `components` može biti prazan niz.
 */
export class HealthComponentDto {
  @ApiProperty({
    enum: HEALTH_COMPONENT_KEYS,
    description: 'Koji signal ova komponenta predstavlja.',
    example: 'learningConfidence',
  })
  key!: (typeof HEALTH_COMPONENT_KEYS)[number];

  @ApiProperty({
    minimum: 0,
    maximum: 100,
    description: 'Score ovog signala, 0–100.',
    example: 82,
  })
  score!: number;

  @ApiProperty({
    description:
      'Ponder signala u ukupnom scoreu. Vrijednosti iz HEALTH_WEIGHTS.',
    example: 35,
  })
  weight!: number;
}

/**
 * Upozorenje iz pravila analize.
 *
 * `message` je zadani bosanski tekst (kao što ga je web već prikazivao);
 * klijenti koji lokalizuju mogu koristiti `type` kao ključ.
 */
export class HealthWarningDto {
  @ApiProperty({
    enum: HEALTH_WARNING_TYPES,
    description: 'Stabilan identifikator pravila, za lokalizaciju na klijentu.',
    example: 'targetShortfall',
  })
  type!: (typeof HEALTH_WARNING_TYPES)[number];

  @ApiProperty({
    enum: HEALTH_WARNING_LEVELS,
    description: 'Nivo ozbiljnosti.',
    example: 'warning',
  })
  level!: (typeof HEALTH_WARNING_LEVELS)[number];

  @ApiProperty({
    description: 'Zadani (bosanski) tekst upozorenja.',
    example: 'Ciljna temperatura se ne dostiže - prosječno zaostajanje: 2.0°C',
  })
  message!: string;
}

export class DashboardHealthResponseDto {
  @ApiProperty({
    minimum: 0,
    maximum: 100,
    description:
      'Ponderisani health score. Kad nema nijednog signala vraća ' +
      'HEALTH_NO_DATA_SCORE (50), jer nema osnove za procjenu.',
    example: 74,
  })
  score!: number;

  @ApiProperty({
    minimum: 0,
    maximum: 100,
    description:
      'Prosječno samopouzdanje učenja kao postotak. 0 kad nema intervala ' +
      'učenja — tada signal ne učestvuje u scoreu.',
    example: 82,
  })
  learningConfidence!: number;

  @ApiProperty({
    type: [HealthComponentDto],
    description:
      'Signali koji su stvarno učestvovali. Prazan niz znači da nema ' +
      'nijednog podatka, pa je `score` jednak HEALTH_NO_DATA_SCORE.',
  })
  components!: HealthComponentDto[];

  @ApiProperty({
    type: [HealthWarningDto],
    description:
      'Upozorenja iz pravila analize. `targetShortfall` i `targetOvershoot` ' +
      'su odvojena pravila sa suprotnim predznakom.',
  })
  warnings!: HealthWarningDto[];

  @ApiProperty({
    ...DATE_TIME,
    description: 'Kada je score izračunat (server vrijeme).',
  })
  computedAt!: string;
}
