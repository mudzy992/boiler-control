import { ApiProperty } from '@nestjs/swagger';

/**
 * FE2-8: response šema izvedena ISKLJUČIVO iz stvarnog koda.
 *
 * Jedinstveni izvor istine je `gas.reading.service.ts` `mapGasReading()`,
 * koji koriste `create`, `findAll`, `getLatest`, `updateReference`,
 * `uploadMeterImage`, `uploadInvoice` i `deleteInvoice`.
 *
 * Tipovi i nullable-ost su iz `prisma/schema.prisma` model `GasReading`:
 * `counterValue Float`, `consumption Float?`, `readingDate DateTime`,
 * `createdAt DateTime`, `isInvoiceReference Boolean @default(false)`,
 * `referenceMonth DateTime?`, `invoiceUploadedAt DateTime?`,
 * `invoiceGasPriceExVat Float?`.
 *
 * `hasMeterImage` i `hasInvoicePdf` NISU polja iz baze — izvedeni su kao
 * `!!reading.meterImagePath` odnosno `!!reading.invoicePdfPath`. Sirove
 * putanje (`meterImagePath`, `invoicePdfPath`) se namjerno NE izlažu: to su
 * interne lokacije na disku i njihovo curenje bi bilo sigurnosni problem.
 */
export class GasReadingResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ type: Number, example: 12345.67 })
  counterValue: number;

  @ApiProperty({ type: String, format: 'date-time' })
  readingDate: string;

  @ApiProperty({ type: Number, nullable: true, example: 123.4 })
  consumption: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: Boolean, example: false })
  isInvoiceReference: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  referenceMonth: string | null;

  @ApiProperty({
    type: Boolean,
    description: 'Izvedeno iz meterImagePath; sirova putanja se ne izlaže.',
  })
  hasMeterImage: boolean;

  @ApiProperty({
    type: Boolean,
    description: 'Izvedeno iz invoicePdfPath; sirova putanja se ne izlaže.',
  })
  hasInvoicePdf: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  invoiceUploadedAt: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 0.85 })
  invoiceGasPriceExVat: number | null;
}
