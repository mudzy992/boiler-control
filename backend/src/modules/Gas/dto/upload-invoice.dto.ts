import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UploadInvoiceDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value),
  )
  invoiceGasPriceExVat?: number;
}
