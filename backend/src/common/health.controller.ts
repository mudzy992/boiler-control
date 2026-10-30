import { Controller, Get } from '@nestjs/common';
import { Public } from '../modules/Auth/public.decorator';
import { ApiTags } from '@nestjs/swagger';
import { RedisHealthService, RedisHealthStatus } from './redis-health.service';

/**
 * Health check endpoint for monitoring and orchestration
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly redisHealth: RedisHealthService) {}

  /**
   * GET /health
   * Returns 200 OK if the service is healthy.
   *
   * MAINT-2: `redis` polje se dodaje SAMO kad je `REDIS_URL` postavljen, pa
   * potrošači bez Redis-a (uključujući instalirane mobilne verzije) dobijaju
   * IDENTIČNO tijelo kao prije. `status` ostaje `'ok'` i kad Redis nije
   * dostupan — aplikacija radi ispravno bez njega, Redis je opciona
   * infrastruktura, pa gašenje Redis-a ne smije označiti aplikaciju
   * nezdravom. Stanje Redis-a je u `redis.connected`.
   *
   * Ugovor nije dirnut: `/health` u `contracts/openapi.json` nema response
   * šemu (`responses.200` = samo `description`), pa novo polje ne mijenja
   * generisani ugovor ni frontend tipove.
   */
  @Public()
  @Get()
  async getHealth(): Promise<
    { status: string; timestamp: string } & {
      redis?: Omit<RedisHealthStatus, 'enabled'>;
    }
  > {
    const base = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };

    if (!this.redisHealth.enabled) {
      return base;
    }

    const status = await this.redisHealth.ping();
    return {
      ...base,
      redis: {
        connected: status.connected,
        pong: status.pong,
        latencyMs: status.latencyMs,
        error: status.error,
      },
    };
  }
}
