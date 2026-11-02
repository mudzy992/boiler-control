import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../modules/Auth/public.decorator';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DatabaseHealthService } from './database-health';
import { RedisHealthService, RedisHealthStatus } from './redis-health.service';

/**
 * Health check endpoint for monitoring and orchestration
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly redisHealth: RedisHealthService,
    private readonly databaseHealth: DatabaseHealthService,
  ) {}

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

  /** Liveness ne zavisi od baze ni opcione infrastrukture. */
  @Public()
  @Get('live')
  getLiveness(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness provjerava samo obaveznu bazu, uz ograničeno čekanje. */
  @Public()
  @Get('ready')
  @ApiOkResponse({ description: 'Database readiness check passed' })
  @ApiServiceUnavailableResponse({
    description: 'Database readiness check failed',
  })
  async getReadiness(): Promise<{ status: string; timestamp: string }> {
    const base = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };

    if (await this.databaseHealth.isReady()) return base;
    throw new ServiceUnavailableException({ ...base, status: 'error' });
  }
}
