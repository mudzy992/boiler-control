import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../modules/Auth/public.decorator';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { readBackupStatus, BackupStatus } from './backup-status';
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
   *
   * `backup` (34): dodaje se SAMO kad je `BACKUP_DIR` postavljen, istim
   * pravilom kao `redis`. Zastario backup NE mijenja `status` — aplikacija je
   * zdrava i kad backup kasni; polje postoji da se to vidi, a ne da obori
   * readiness. Provjera je čitanje dva mala JSON fajla, bez I/O prema bazi.
   */
  @Public()
  @Get()
  async getHealth(): Promise<
    { status: string; timestamp: string } & {
      redis?: Omit<RedisHealthStatus, 'enabled'>;
      backup?: Omit<BackupStatus, 'configured'>;
    }
  > {
    const base = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };

    const backupStatus = readBackupStatus();
    const backup = backupStatus.configured
      ? {
          lastBackupAt: backupStatus.lastBackupAt,
          ageHours: backupStatus.ageHours,
          stale: backupStatus.stale,
          dumpBytes: backupStatus.dumpBytes,
          uploadsIncluded: backupStatus.uploadsIncluded,
          lastError: backupStatus.lastError,
        }
      : undefined;

    if (!this.redisHealth.enabled) {
      return backup ? { ...base, backup } : base;
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
      ...(backup ? { backup } : {}),
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
