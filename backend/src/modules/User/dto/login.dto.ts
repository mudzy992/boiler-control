import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Globalni enableImplicitConversion ne smije pretvoriti ne-string u string prije
// @IsString; originalni tip mora ostati vidljiv validatoru.
const preserveRawInput = ({ obj, key }: TransformFnParams) =>
  obj[key] as unknown;

const normalizeLoginIdentifier = (params: TransformFnParams) => {
  const value = preserveRawInput(params);
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
};

export class LoginDto {
  @IsString()
  @IsOptional()
  @Transform(normalizeLoginIdentifier)
  email?: string;

  @IsString()
  @IsOptional()
  @Transform(normalizeLoginIdentifier)
  identifier?: string;

  @Transform(preserveRawInput)
  @IsString()
  @IsNotEmpty()
  password: string;

  /**
   * SEC-4 (faza 3): kako klijent želi primiti refresh token.
   *
   * - `cookie` (zadano) — httpOnly cookie; token nikad nije vidljiv JS-u.
   *   Ovo je ispravno za web.
   * - `body` — token se vraća u tijelu odgovora. Namijenjeno React Native
   *   klijentima koji **nemaju browser cookie jar**, pa ga čuvaju u Android
   *   Keystore (`expo-secure-store`).
   *
   * Neispravna vrijednost se odbija s 400 (`@IsIn`), jer bi tiho vraćanje na
   * `cookie` ostavilo mobilnog klijenta bez mogućnosti osvježavanja sesije.
   */
  @ApiPropertyOptional({ enum: ['cookie', 'body'], default: 'cookie' })
  @IsOptional()
  @IsIn(['cookie', 'body'])
  refreshTransport?: 'cookie' | 'body';
}
