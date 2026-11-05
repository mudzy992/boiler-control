import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UploadInvoiceDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw === undefined || raw === null || raw === '') return undefined;
    if (typeof raw !== 'number' && typeof raw !== 'string') return raw;
    return Number(raw);
  })
  invoiceGasPriceExVat?: number;
}
