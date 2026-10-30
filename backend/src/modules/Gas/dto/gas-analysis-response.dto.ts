import { ApiProperty } from '@nestjs/swagger';

/**
 * FE2-8: response šema za `GET /api/gas/analysis`, izvedena ISKLJUČIVO iz
 * `gas.reading.service.ts` `getEfficiencyAnalysis()`.
 *
 * Servis ima DVA returna i oba su pokrivena:
 * - rani return kad nema podataka: `period.from`/`period.to` su `null`,
 *   sve numeričke vrijednosti `0`, `referenceReading: null`,
 *   `priceBreakdown: []`, `efficiency.label: 'NO_DATA'`
 * - glavni return s izračunatim vrijednostima
 *
 * Zato su `period.from`/`period.to` i `referenceReading` nullable — to nije
 * defanzivno nagađanje nego doslovno ponašanje ranog returna.
 */

/** `period.mode` — union je doslovno preuzet iz deklaracije na l.376. */
export type GasAnalysisPeriodMode =
  'explicit' | 'reference_to_current' | 'last_30_days';

/**
 * `efficiency.label` — vrijednosti su iz `getEfficiencyLabel()`. Potpis metode
 * je `string`, ali tijelo vraća isključivo ovih pet literalа, pa je union
 * tačniji od `string` i ne laže: svaka grana je provjerena.
 */
export type GasEfficiencyLabel =
  'NO_DATA' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export class GasAnalysisPeriodDto {
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  from: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  to: string | null;

  @ApiProperty({
    enum: ['explicit', 'reference_to_current', 'last_30_days'],
    example: 'last_30_days',
  })
  mode: GasAnalysisPeriodMode;
}

export class GasAnalysisReferenceReadingDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ type: String, format: 'date-time' })
  readingDate: string;

  @ApiProperty({ type: Number, example: 12345.67 })
  counterValue: number;
}

export class GasPriceBreakdownRowDto {
  @ApiProperty({ type: Number, example: 0.8512 })
  priceExVat: number;

  @ApiProperty({ type: Number, example: 123.4 })
  consumptionM3: number;

  @ApiProperty({ type: Number, example: 105.04 })
  costExVat: number;

  @ApiProperty({
    type: String,
    description:
      "Izvor cijene iz `GasPriceHistory.source`. Uočene vrijednosti: 'INVOICE', 'MANUAL'. Namjerno `string`, ne enum — polje dolazi iz baze i nije ograničeno šemom.",
    example: 'MANUAL',
  })
  source: string;

  @ApiProperty({ type: String, format: 'date-time' })
  effectiveFrom: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  effectiveTo: string | null;
}

export class GasEfficiencyDto {
  @ApiProperty({ type: Number, example: 0.412 })
  m3PerHour: number;

  @ApiProperty({
    enum: ['NO_DATA', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR'],
    example: 'EXCELLENT',
  })
  label: GasEfficiencyLabel;
}

export class GasAnalysisResponseDto {
  @ApiProperty({ type: () => GasAnalysisPeriodDto })
  period: GasAnalysisPeriodDto;

  @ApiProperty({ type: Number, example: 320.15 })
  totalGas: number;

  @ApiProperty({ type: Number, example: 320.15 })
  consumptionFromReferenceM3: number;

  @ApiProperty({ type: Number, example: 412.5 })
  totalHeatingHours: number;

  @ApiProperty({ type: Number, example: 52.3 })
  avgFlowTemp: number;

  @ApiProperty({ type: Number, example: 272.13 })
  costExVat: number;

  @ApiProperty({ type: Number, example: 46.26 })
  vatAmount: number;

  @ApiProperty({ type: Number, example: 318.39 })
  costIncVat: number;

  @ApiProperty({ type: () => GasAnalysisReferenceReadingDto, nullable: true })
  referenceReading: GasAnalysisReferenceReadingDto | null;

  @ApiProperty({ type: () => [GasPriceBreakdownRowDto] })
  priceBreakdown: GasPriceBreakdownRowDto[];

  @ApiProperty({ type: () => GasEfficiencyDto })
  efficiency: GasEfficiencyDto;
}
