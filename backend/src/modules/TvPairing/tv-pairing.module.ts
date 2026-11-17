import { Module } from '@nestjs/common';
import { AuthModule } from '../Auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { TvPairingController } from './tv-pairing.controller';
import { TvPairingService } from './tv-pairing.service';

/**
 * Uparivanje TV-a.
 *
 * `AuthModule` se uvozi zbog `AuthService` (izdaje access token) i
 * `RefreshTokenService` (izdaje i opoziva refresh token). Iste servise koristi
 * i normalna prijava, pa TV sesija nije poseban mehanizam — samo drugi način da
 * se dođe do iste sesije.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TvPairingController],
  providers: [TvPairingService],
  exports: [TvPairingService],
})
export class TvPairingModule {}
