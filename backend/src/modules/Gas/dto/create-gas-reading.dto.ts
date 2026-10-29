import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGasReadingDto {
  @ApiProperty({ description: 'Stanje brojila u m3', example: 12345.67 })
  @IsNumber()
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  counterValue: number;

  @ApiProperty({
    description: 'Datum očitavanja',
    example: '2023-10-27T10:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  readingDate: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  markAsReference?: boolean;
}
