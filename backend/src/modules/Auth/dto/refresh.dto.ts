import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * SEC-4 (faza 3): tijelo za `POST /auth/refresh` i `POST /auth/logout`.
 *
 * Oba polja su opcionalna jer web klijent NE šalje ništa — njegov refresh
 * token dolazi automatski u httpOnly cookie-ju. React Native klijent, koji
 * nema browser cookie jar, šalje token iz Android Keystore-a.
 *
 * Cookie ima prednost nad tijelom (vidi `auth.controller.ts`), pa web klijent
 * ne može podvaliti stari token preko tijela.
 */
export class RefreshDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
