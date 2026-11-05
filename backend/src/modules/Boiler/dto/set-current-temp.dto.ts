import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsNumber, Max, Min } from 'class-validator';

// Globalni enableImplicitConversion ne smije promijeniti raw JSON tip prije validacije.
const preserveRawInput = ({ obj, key }: TransformFnParams) => obj[key];

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
  @Transform(preserveRawInput)
  currentFlowTemp: number;
}
