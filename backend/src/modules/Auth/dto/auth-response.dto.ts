import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserPlan, UserRole } from 'src/generated/prisma';

/**
 * FE2-8: response šeme izvedene ISKLJUČIVO iz stvarnog koda.
 *
 * Izvor istine za svako polje:
 * - `auth.service.ts` `register()` — prisma `select` s 13 polja + `token`
 * - `auth.service.ts` `login()`    — eksplicitni objekt s 11 polja + `token`
 * - `auth.service.ts` `me()`       — prisma `select` s 13 polja (bez omotača)
 * - `auth.service.ts` `changePassword()` — `{ message }`
 *
 * Tipovi i nullable-ost su iz `prisma/schema.prisma` model `User`:
 * `name String?`, `username String? @unique`, `homeLocation String?`,
 * `avatarUrl String?`, `timezone String?`, `locale String?`,
 * `prefersDarkMode Boolean?`, `createdAt DateTime`, `updatedAt DateTime`,
 * `role UserRole @default(USER)`, `plan UserPlan @default(FREE)`.
 *
 * `register` i `login` NAMJERNO imaju različit shape: `login` ne vraća
 * `createdAt`/`updatedAt`. To je postojeće ponašanje i ovdje je vjerno
 * opisano, a ne "upeglano" — FE-016 je upravo upozoravao da UI ne smije
 * pretpostavljati jedan oblik za obje rute.
 */
export class AuthUserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'korisnik@example.ba' })
  email: string;

  @ApiProperty({ type: String, nullable: true, example: 'korisnik' })
  username: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Ime Prezime' })
  name: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Visoko' })
  homeLocation: string | null;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role: UserRole;

  @ApiProperty({ enum: UserPlan, example: UserPlan.FREE })
  plan: UserPlan;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Europe/Sarajevo' })
  timezone: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'bs' })
  locale: string | null;

  @ApiProperty({ type: Boolean, nullable: true, example: false })
  prefersDarkMode: boolean | null;
}

/**
 * `register()` i `me()` vraćaju i vremenske oznake (13 polja u `select`-u).
 */
export class AuthUserWithTimestampsDto extends AuthUserDto {
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: string;
}

/** `POST /api/auth/login` */
export class LoginResponseDto {
  @ApiProperty({ type: () => AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ type: String, description: 'JWT access token' })
  token: string;

  /**
   * SEC-4 (faza 3): prisutno SAMO kad je klijent u zahtjevu tražio
   * `refreshTransport: 'body'` (React Native bez browser cookie jar-a) i kad je
   * backend zastavica uključena. Web klijent ovo polje nikad ne dobija —
   * njegov refresh token ostaje u httpOnly cookie-ju.
   */
  @ApiPropertyOptional({ type: String })
  refreshToken?: string;
}

/** `POST /api/auth/register` */
export class RegisterResponseDto {
  @ApiProperty({ type: () => AuthUserWithTimestampsDto })
  user: AuthUserWithTimestampsDto;

  @ApiProperty({ type: String, description: 'JWT access token' })
  token: string;

  /**
   * SEC-4 (faza 3): prisutno SAMO kad je klijent u zahtjevu tražio
   * `refreshTransport: 'body'` (React Native bez browser cookie jar-a) i kad je
   * backend zastavica uključena. Web klijent ovo polje nikad ne dobija —
   * njegov refresh token ostaje u httpOnly cookie-ju.
   */
  @ApiPropertyOptional({ type: String })
  refreshToken?: string;
}

/**
 * `POST /api/auth/change-password`.
 * Poruka je doslovno prenesena iz `auth.service.ts` (`'Password updated
 * successfully'`), ali je tipizirana kao `string` a ne literal — ako se tekst
 * promijeni, ugovor ne laže.
 */
export class MessageResponseDto {
  @ApiProperty({ type: String, example: 'Password updated successfully' })
  message: string;
}
