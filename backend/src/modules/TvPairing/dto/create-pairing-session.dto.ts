import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// Isti razlog kao u `RegisterDeviceDTO`: globalni `enableImplicitConversion`
// ne smije pretvoriti ne-string u string prije `@IsString`.
const preserveRawInput = ({ obj, key }: TransformFnParams) =>
  obj[key] as unknown;

/**
 * Zahtjev TV-a za kod za uparivanje.
 *
 * **Ovo je jedini POST koji TV aplikacija šalje** (v. `tv/src/services/api`).
 * Zato nosi i push token: TV ne smije imati drugi upis, a bez tokena ne bi
 * dobijao notifikacije — a notifikacije su glavna svrha TV aplikacije.
 *
 * Oba polja su opciona: bez `tvPushToken` uparivanje radi, samo bez push-a;
 * bez `deviceLabel` TV se zove „Android TV".
 */
export class CreatePairingSessionDTO {
  /*
   * Eksplicitni `@ApiPropertyOptional`, ne samo class-validator dekoratori.
   * Izmjereno: bez njih generator ugovora upiše `properties: {}` — pa TV i
   * mobilna aplikacija iz `contracts/openapi.json` ne vide da polja postoje.
   * (`RegisterDeviceDTO` ima isti problem; nije popravljan ovdje da se ne
   * miješa sa F16.)
   */
  @ApiPropertyOptional({
    description: 'Naziv uređaja koji korisnik vidi u listi uparenih TV-a',
    maxLength: 64,
  })
  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  @MaxLength(64)
  deviceLabel?: string;

  /**
   * Oblik Expo tokena. Provjerava se i u bazi (`CHECK` constraint u migraciji)
   * jer je ruta javna — DTO se može zaobići, constraint ne.
   */
  @ApiPropertyOptional({
    description:
      'Expo push token TV-a. Dolazi uz zahtjev za kod jer je ovo jedini POST ' +
      'koji TV smije poslati; server ga upisuje tek kad telefon odobri.',
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  })
  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  @Matches(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/)
  tvPushToken?: string;
}
