import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @IsString()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  identifier?: string;

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
