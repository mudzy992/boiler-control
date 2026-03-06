import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, Max, Min } from 'class-validator';

export class SetCurrentTempDto {
  @ApiProperty({
    description: 'User confirmed current boiler flow temperature (°C)',
    example: 52.5,
    minimum: 48,
    maximum: 55,
  })
  @IsNumber({ maxDecimalPlaces: 1 })
  @IsNotEmpty()
  @Min(48)
  @Max(55)
  @Transform(({ value }) => Number(value))
  currentFlowTemp: number;
}
