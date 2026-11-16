import { ApiProperty } from '@nestjs/swagger';

import { DAILY_METRIC_FIELDS } from '../daily-metrics.service';

/**
 * ODGOVOR ŠEME za `GET /api/daily-record/metrics` (C1).
 *
 * Bez ovoga bi ugovor imao `200` **bez šeme**, pa bi `api.d.ts` generisao
 * `content?: never` — klijent bi dobio odgovor koji ne može tipizirati i
 * morao bi ga ponovo izmišljati kao `Record<string, unknown>` (isti kvar zbog
 * kojeg su gas metrike imale `?? 0`, v. D2). Polja su tačno
 * `DAILY_METRIC_FIELDS`; nijedno nije izmišljeno.
 */

/**
 * Jedan dan. **Mjerna polja su opciona, ne nullable.**
 *
 * `DailyMetricsService` izostavlja `null` umjesto da ga pošalje kao `0` (B1),
 * pa polje ili nosi mjerenje ili ga nema — treće stanje ne postoji. `nullable`
 * bi tvrdio da `null` znači „nije mjereno", a ovdje „nije mjereno" znači
 * „ključa nema".
 *
 * `localDate` je `YYYY-MM-DD` string, ne `date-time`: to je lokalni dan doma i
 * pretvaranje u trenutak bi ga pomjerilo preko ponoći.
 */
export class DailyMetricRowDto {
  @ApiProperty({
    description: 'DB kolona `localDate`, `YYYY-MM-DD` (lokalni dan doma).',
    example: '2026-11-08',
  })
  localDate!: string;

  @ApiProperty({
    required: false,
    description:
      'Procenat vremena pod gorionikom. Izostaje kad nije mjereno — izostanak nije nula.',
  })
  dutyPercent?: number;

  @ApiProperty({ required: false, description: 'DB kolona `medianCycleMin`.' })
  medianCycleMin?: number;

  @ApiProperty({
    required: false,
    description: 'Prebačaj iznad cilja, K. `0` je mjerenje, izostanak nije.',
  })
  overshootC?: number;

  @ApiProperty({ required: false, description: 'Podbačaj ispod cilja, K.' })
  undershootC?: number;

  @ApiProperty({ required: false, description: 'Histereza, K.' })
  hysteresisK?: number;

  @ApiProperty({
    required: false,
    description: 'Asimetrija histereze, K. Razlika gornje i donje granice.',
  })
  hysteresisAsymmetryK?: number;

  @ApiProperty({
    required: false,
    description: 'Brzina zagrijavanja, K/h — mjeri ponašanje kotla.',
  })
  heatRateCPerHour?: number;

  @ApiProperty({ required: false, description: 'Noćni podbačaj, K.' })
  nightUndershootC?: number;

  @ApiProperty({
    required: false,
    description: 'Najniža **izmjerena** vanjska temperatura noću, °C.',
  })
  nightMinOutdoorMeasuredC?: number;

  @ApiProperty({
    required: false,
    description: 'Noćna polazna temperatura, °C.',
  })
  nightFlowC?: number;

  @ApiProperty({
    required: false,
    description: 'Zadata polazna temperatura, °C.',
  })
  flowSetC?: number;

  @ApiProperty({ required: false, description: 'Stepen-sati u danu.' })
  degreeHours?: number;
}

/**
 * Pokrivenost **po koloni** — ovo je dio odgovora, ne dijagnostika.
 *
 * Mjerenje (M3, run `43851109488`) kaže 5/86 dana ima metrike. Bez ovoga
 * klijent ne može razlikovati „tog dana nije mjereno" od „ekran ne radi", a
 * ekran koji je prazan na 81 od 86 dana izgleda kao kvar.
 */
export class DailyMetricsCoverageDto {
  @ApiProperty({ description: 'Broj dana u prozoru (redova u `DailyRecord`).' })
  days!: number;

  @ApiProperty({ description: 'Koliko dana ima `outcomeAt` — obračunato.' })
  withOutcome!: number;

  @ApiProperty({
    description:
      'Po koloni: na koliko dana ima vrijednost. Ključevi su tačno `DAILY_METRIC_FIELDS`.',
    example: Object.fromEntries(DAILY_METRIC_FIELDS.map((f) => [f, 0])),
  })
  byField!: Record<string, number>;

  @ApiProperty({
    description:
      'Najbolje pokrivena kolona u procentima — broj po kojem se odlučuje ima li ekran smisla (prag 25 %).',
    example: 5.8,
  })
  bestFieldShare!: number;
}

export class DailyMetricsResponseDto {
  @ApiProperty()
  homeProfileId!: number;

  @ApiProperty({
    // `type` mora biti izričit: bez njega generator iz `string | null` pročita
    // samo `null` i u `api.d.ts` upiše `Record<string, never>`.
    type: String,
    nullable: true,
    description: 'Početak prozora ili `null` ako nije zadat.',
    example: '2026-01-01',
  })
  from!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Kraj prozora ili `null`.',
  })
  to!: string | null;

  @ApiProperty({ type: [DailyMetricRowDto] })
  rows!: DailyMetricRowDto[];

  @ApiProperty({ type: DailyMetricsCoverageDto })
  coverage!: DailyMetricsCoverageDto;
}
