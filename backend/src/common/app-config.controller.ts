import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../modules/Auth/public.decorator';
import { AppConfigService } from './app-config.service';
// `AppConfig` je tip, ne vrijednost: uz `isolatedModules` + `emitDecoratorMetadata`
// povratni tip dekorisane metode mora biti `import type` (inače TS1272).
import type { AppConfig } from './app-config.service';

/**
 * MO2-2: javna konfiguracija za mobilne klijente.
 *
 * Rutu nosi `api/` prefiks kao i ostali domenski kontroleri (`main.ts` nema
 * `setGlobalPrefix`), pa mobilni klijent s `BASE_URL=.../api` zove
 * `${BASE_URL}/app/config`.
 *
 * Endpoint je namjerno **bez autentifikacije**: version gate mora moći
 * odlučiti hoće li blokirati korisnika PRIJE nego što se korisnik prijavi,
 * inače bi zaključana aplikacija tražila login koji ne može završiti.
 */
@ApiTags('App')
@Controller('api/app')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Public()
  @Get('config')
  @ApiOperation({
    summary: 'Mobilna version-gate konfiguracija (javno, bez tokena)',
  })
  @ApiOkResponse({ type: Object })
  getConfig(): AppConfig {
    return this.appConfigService.getAppConfig();
  }
}
