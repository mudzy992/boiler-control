import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { Public } from '../Auth/public.decorator';
import { TvPairingService } from './tv-pairing.service';

/**
 * Uparivanje Android TV-a (`F16`).
 *
 * **Dvije grupe ruta, namjerno razdvojene:**
 *
 * | ruta | prijava | ko zove |
 * |---|---|---|
 * | `POST /api/tv-pairing/sessions` | **ne** | TV (nema korisnika) |
 * | `GET /api/tv-pairing/sessions/:code` | **ne** | TV (čeka odobrenje) |
 * | `POST /api/tv-pairing/sessions/:code/approve` | da | telefon |
 * | `POST /api/tv-pairing/sessions/:code/reject` | da | telefon |
 * | `GET /api/tv-pairing/devices` | da | telefon (prikaz uparenih) |
 *
 * TV rute ne smiju tražiti prijavu jer je poenta uparivanja da je TV **nema**.
 * Zaštita nije token nego kod: 8 znakova, 5 minuta, ograničen broj upita i
 * jednokratno preuzimanje (v. `tv-pairing.service.ts`).
 */
@ApiTags('TV pairing')
@Controller('api/tv-pairing')
export class TvPairingController {
  constructor(private readonly pairing: TvPairingService) {}

  @Public()
  @Post('sessions')
  @HttpCode(201)
  @ApiOperation({ summary: 'TV traži kod za uparivanje (bez prijave)' })
  @ApiOkResponse({ description: 'Kod, rok i interval anketiranja' })
  async create(@Body() body?: { deviceLabel?: string }) {
    return this.pairing.create(body?.deviceLabel);
  }

  /**
   * TV anketira stanje. `@Public()` jer TV još nema token.
   *
   * Vraća `status` dok se čeka, a `READY` sa tokenima tačno jednom — nakon
   * toga isti kod vraća `CLAIMED`.
   */
  @Public()
  @Get('sessions/:code')
  @ApiOperation({ summary: 'TV provjerava je li kod odobren (bez prijave)' })
  @ApiQuery({ name: 'deviceLabel', required: false, type: String })
  async poll(@Req() req, @Query('deviceLabel') _deviceLabel?: string) {
    const code = decodeURIComponent(req.params.code ?? '');
    return this.pairing.claim(code);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('sessions/:code/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Telefon odobrava kod' })
  async approve(@Req() req, @Body() body?: { deviceLabel?: string }) {
    const code = decodeURIComponent(req.params.code ?? '');
    return this.pairing.approve(req.user.userId, code, body?.deviceLabel);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('sessions/:code/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Telefon odbija kod' })
  async reject(@Req() req) {
    const code = decodeURIComponent(req.params.code ?? '');
    return this.pairing.reject(req.user.userId, code);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('devices')
  @ApiOperation({ summary: 'Upareni TV uređaji korisnika' })
  async devices(@Req() req) {
    return this.pairing.listForUser(req.user.userId);
  }
}
