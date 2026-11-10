import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsNumber, Max, Min } from 'class-validator';

// Globalni enableImplicitConversion ne smije promijeniti raw JSON tip prije validacije.
const preserveRawInput = ({ obj, key }: TransformFnParams) => obj[key];

/**
 * F13: `@Min`/`@Max` su **apsolutni** raspon (30–55), a stvarni raspon daje
 * `BoilerService.flowTempRange()` iz doma (`minHeatingFlowC`/`maxHeatingFlowC`).
 *
 * Zašto se DTO ne može vezati na dom: `class-validator` u ovoj aplikaciji
 * validira prije nego što servis vidi zahtjev, pa dom nije dostupan. Zato DTO
 * čuva samo ono što je fizički nemoguće (`< 30`, `> 55`), a servis radi pravu
 * provjeru nad rasponom doma. Prije ovoga je DTO imao tvrdu 48, koja je bila
 * *uža* od onoga što motor predlaže — i to je bio uzrok odbijanja predloga.
 */
export class SetCurrentTempDto {
  @ApiProperty({
    description:
      'User confirmed current boiler flow temperature (°C). Effective range is set per home (HomeProfile.minHeatingFlowC..maxHeatingFlowC) and is within 30–55.',
    example: 52.5,
    minimum: 30,
    maximum: 55,
  })
  @IsNumber({ maxDecimalPlaces: 1 })
  @IsNotEmpty()
  @Min(30)
  @Max(55)
  @Transform(preserveRawInput)
  currentFlowTemp: number;
}
