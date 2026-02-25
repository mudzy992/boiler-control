import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class UpdateGasReferenceDto {
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isReference: boolean;
}
