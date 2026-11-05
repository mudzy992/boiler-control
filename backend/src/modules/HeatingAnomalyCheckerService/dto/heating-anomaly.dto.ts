import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional } from 'class-validator';

// Globalni enableImplicitConversion ne smije promijeniti raw JSON tip prije validacije.
const preserveRawInput = ({ obj, key }: TransformFnParams) => obj[key];

/**
 * `PATCH /api/anomalies/:eventId`.
 *
 * SEC-2 (B-010): prije ove izmjene klasa nije imala nijedan dekorator, a
 * `main.ts` koristi `whitelist: true` + `forbidNonWhitelisted: true`. Bez
 * metapodataka class-validator je skidao sva polja, pa je **svaki** legitimni
 * zahtjev dobijao 400.
 *
 * Vlasništvo se NE postavlja ovdje: `userId` dolazi isključivo iz JWT-a u
 * controlleru, pa ga tijelo zahtjeva ne može podvaliti (`forbidNonWhitelisted`
 * takvo polje odbija s 400).
 */
export class UpdateHeatingAnomalyDto {
  /** Korisnik može promijeniti predloženi završetak. */
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  proposedEndTime?: Date;

  /** Ako je `true`, korisnik potvrđuje trenutni predlog. */
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(preserveRawInput)
  @IsBoolean()
  confirm?: boolean;
}
