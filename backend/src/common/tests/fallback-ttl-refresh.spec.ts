/**
 * REL-5 / B-022 — regresija za TTL fallback cachea.
 *
 * Nalaz: `cacheSensorReading` zakazuje bezuslovni `delete(key)` bez otkazivanja
 * prethodnog timera istog ključa, pa nakon drugog upisa PRVI timer može
 * izbrisati još svježu zamjensku vrijednost. `clearCache()` također nije
 * otkazivao timere, pa je stari timer mogao obrisati vrijednost upisanu NAKON
 * clear-a.
 *
 * Ovi testovi su napisani PRIJE izmjene koda i tad su padali; postojeći
 * `fallback-strategy.service.spec.ts` je namjerno ostavljen netaknut kao dokaz
 * da ugovor za postojeće potrošače nije promijenjen.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { FallbackStrategyService } from '../fallback-strategy.service';
import { MetricsService } from '../metrics.service';
import { StructuredLogger } from '../structured-logger';

const MINUTE = 60 * 1000;

describe('B-022: TTL fallback cachea (REL-5)', () => {
  let service: FallbackStrategyService;
  let savedFlag: string | undefined;

  async function buildService(): Promise<FallbackStrategyService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FallbackStrategyService,
        {
          provide: MetricsService,
          useValue: {
            incrementCounter: jest.fn(),
            exportPrometheus: jest.fn(() => ''),
          },
        },
        {
          provide: StructuredLogger,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();
    return module.get<FallbackStrategyService>(FallbackStrategyService);
  }

  beforeEach(async () => {
    savedFlag = process.env.FALLBACK_STRICT_TTL_ENABLED;
    delete process.env.FALLBACK_STRICT_TTL_ENABLED;
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-01-01T00:00:00Z'));
    service = await buildService();
  });

  afterEach(() => {
    service.clearCache();
    jest.clearAllTimers();
    jest.useRealTimers();
    if (savedFlag === undefined) delete process.env.FALLBACK_STRICT_TTL_ENABLED;
    else process.env.FALLBACK_STRICT_TTL_ENABLED = savedFlag;
  });

  describe('osvježavanje istog ključa prije isteka', () => {
    it('stari timer NE briše novu vrijednost (jezgro B-022)', () => {
      service.cacheSensorReading('tuya_temp_1', 50, 10);
      jest.advanceTimersByTime(5 * MINUTE);
      service.cacheSensorReading('tuya_temp_1', 51, 10);

      // Prije ispravke: u 10. minuti prvi timer briše vrijednost staru 5 minuta.
      jest.advanceTimersByTime(5 * MINUTE);

      const result = service.getTuyaFallback(1, 100);
      expect(result.usedCache).toBe(true);
      expect(result.fallbackValue).toBe(51);
    });

    it('duži TTL nakon kraćeg poštuje novi, duži rok', () => {
      service.cacheSensorReading('tuya_temp_1', 50, 10);
      jest.advanceTimersByTime(5 * MINUTE);
      service.cacheSensorReading('tuya_temp_1', 51, 20);

      // Novi zapis ističe tek u 25. minuti, ne u 10.
      jest.advanceTimersByTime(7 * MINUTE);
      expect(service.getTuyaFallback(1, 100).fallbackValue).toBe(51);

      jest.advanceTimersByTime(13 * MINUTE);
      expect(service.getTuyaFallback(1, 100).usedCache).toBe(false);
    });

    it('kraći TTL nakon dužeg skraćuje životni vijek', () => {
      service.cacheSensorReading('tuya_temp_1', 50, 20);
      jest.advanceTimersByTime(5 * MINUTE);
      service.cacheSensorReading('tuya_temp_1', 51, 5);

      jest.advanceTimersByTime(5 * MINUTE);
      expect(service.getTuyaFallback(1, 100).usedCache).toBe(false);
    });

    it('isti bug vrijedi i za weather ključ', () => {
      service.cacheSensorReading('weather_NYC', { temperature: 10 }, 600);
      jest.advanceTimersByTime(300 * MINUTE);
      service.cacheSensorReading('weather_NYC', { temperature: 12 }, 600);

      jest.advanceTimersByTime(300 * MINUTE);
      const result = service.getWeatherFallback(100, 'NYC');
      expect(result.usedCache).toBe(true);
      expect(result.fallbackValue).toEqual({ temperature: 12 });
    });
  });

  describe('clear i ponovni upis', () => {
    it('clearCache otkazuje timere, pa kasniji upis preživljava stari TTL', () => {
      service.cacheSensorReading('tuya_temp_1', 50, 10);
      jest.advanceTimersByTime(1 * MINUTE);
      service.clearCache();
      service.cacheSensorReading('tuya_temp_1', 51, 10);

      // Prije ispravke: timer iz prvog upisa puca u 10. minuti i briše novi zapis.
      jest.advanceTimersByTime(9 * MINUTE);
      expect(service.getTuyaFallback(1, 100).fallbackValue).toBe(51);

      jest.advanceTimersByTime(1 * MINUTE);
      expect(service.getTuyaFallback(1, 100).usedCache).toBe(false);
    });

    it('clearCache ne ostavlja aktivne timere', () => {
      service.cacheSensorReading('tuya_temp_1', 50, 10);
      service.cacheSensorReading('tuya_temp_2', 51, 10);
      service.clearCache();

      expect(service.getCacheStats().pendingTimers).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('tačna granica isteka', () => {
    it('vrijednost je dostupna do posljednje milisekunde TTL-a', () => {
      service.cacheSensorReading('tuya_temp_1', 50, 10);

      jest.advanceTimersByTime(10 * MINUTE - 1);
      expect(service.getTuyaFallback(1, 100).usedCache).toBe(true);

      jest.advanceTimersByTime(1);
      expect(service.getTuyaFallback(1, 100).usedCache).toBe(false);
    });
  });

  describe('opterećenje i broj timera', () => {
    it('ponovljeni upisi istog ključa ne gomilaju timere', () => {
      for (let i = 0; i < 50; i += 1) {
        service.cacheSensorReading('tuya_temp_1', i, 10);
      }
      expect(service.getCacheStats().pendingTimers).toBe(1);
      expect(jest.getTimerCount()).toBe(1);
      expect(service.getTuyaFallback(1, 100).fallbackValue).toBe(49);
    });

    it('mnogo ključeva ostaje međusobno nezavisno', () => {
      const keys = 200;
      for (let i = 1; i <= keys; i += 1) {
        service.cacheSensorReading(`tuya_temp_${i}`, 40 + i, 10);
      }
      expect(service.getCacheStats().pendingTimers).toBe(keys);

      for (let i = 1; i <= keys; i += 1) {
        expect(service.getTuyaFallback(i, 100).fallbackValue).toBe(40 + i);
      }

      jest.advanceTimersByTime(10 * MINUTE);
      for (let i = 1; i <= keys; i += 1) {
        expect(service.getTuyaFallback(i, 100).usedCache).toBe(false);
      }
      expect(service.getCacheStats().entries).toBe(0);
    });
  });

  describe('poštivanje TTL-a pri čitanju (zastavica)', () => {
    it('zadano (off) zadržava naslijeđeni prag od 30 minuta', () => {
      service.cacheSensorReading('tuya_temp_1', 50, 60);

      jest.advanceTimersByTime(45 * MINUTE);
      expect(service.getTuyaFallback(1, 100).usedCache).toBe(false);
    });

    it('uključeno poštuje stvarni TTL zapisa', async () => {
      process.env.FALLBACK_STRICT_TTL_ENABLED = 'on';
      const strict = await buildService();

      strict.cacheSensorReading('tuya_temp_1', 50, 60);
      jest.advanceTimersByTime(45 * MINUTE);
      expect(strict.getTuyaFallback(1, 100).usedCache).toBe(true);
      expect(strict.getTuyaFallback(1, 100).fallbackValue).toBe(50);

      jest.advanceTimersByTime(15 * MINUTE);
      expect(strict.getTuyaFallback(1, 100).usedCache).toBe(false);

      strict.clearCache();
    });

    it('nepoznata vrijednost zastavice pada na zadano off', async () => {
      process.env.FALLBACK_STRICT_TTL_ENABLED = 'možda';
      const svc = await buildService();

      svc.cacheSensorReading('tuya_temp_1', 50, 60);
      jest.advanceTimersByTime(45 * MINUTE);
      expect(svc.getTuyaFallback(1, 100).usedCache).toBe(false);

      svc.clearCache();
    });
  });

  describe('sigurnosna oznaka zadane vrijednosti', () => {
    it('safe default je označen kao nestručno potvrđen', () => {
      const result = service.getTuyaFallback(999, 100);
      expect(result.fallbackValue).toBe(60);
      expect(result.safeDefaultValidated).toBe(false);
    });

    it('vrijednost iz cachea nije označena kao nepotvrđeni default', () => {
      service.cacheSensorReading('tuya_temp_1', 50, 10);
      const result = service.getTuyaFallback(1, 100);
      expect(result.usedCache).toBe(true);
      expect(result.safeDefaultValidated).toBeUndefined();
    });
  });
});
