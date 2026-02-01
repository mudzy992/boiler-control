import { IsNumber, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGasReadingDto {
  @ApiProperty({ description: 'Stanje brojila u m3', example: 12345.67 })
  @IsNumber()
  @IsNotEmpty()
  counterValue: number;

  @ApiProperty({ description: 'Datum očitavanja', example: '2023-10-27T10:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  readingDate: string;
}
