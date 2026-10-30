// src/common/fallback-strategy.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { StructuredLogger } from './structured-logger';

/**
 * Fallback strategy result
 */
export interface FallbackResult {
  triggered: boolean;
  reason: string;
  fallbackValue: any;
  fallbackType: FallbackType;
  usedCache: boolean;
  /**
   * REL-5 / B-022: `false` samo kod hardkodirane zadane vrijednosti. Brojka
   * (60 °C) NIJE stručno potvrđena kao sigurna za konkretan kotao i ne treba je
   * primjenjivati kao komandu bez provjere. Kod stvarnih podataka (cache,
   * posljednja poznata vrijednost) polje je izostavljeno.
   */
  safeDefaultValidated?: boolean;
}

/**
 * REL-5 / B-022: zapis u fallback cacheu. `version` raste pri svakom upisu istog
 * ključa, pa timer može provjeriti da li još pripada svom zapisu; `expiresAt`
 * omogućava poštivanje stvarnog TTL-a iza zastavice.
 */
interface FallbackCacheEntry {
  value: any;
  timestamp: Date;
  expiresAt: number;
  version: number;
}

/**
 * REL-5 / B-022: `on` uključi poštivanje stvarnog TTL-a zapisa pri čitanju.
 * Zadano `off` jer mijenja efektivni životni vijek cachea (naslijeđeni prag je
 * 30 min za Tuya, 24 h za weather, bez obzira na proslijeđeni `ttlMinutes`).
 */
const STRICT_TTL_FLAG = 'FALLBACK_STRICT_TTL_ENABLED';

function strictTtlEnabled(logger: Logger): boolean {
  const raw = (process.env[STRICT_TTL_FLAG] ?? '').trim().toLowerCase();
  if (raw === '' || raw === 'off') return false;
  if (raw === 'on') return true;
  logger.warn(
    `[${STRICT_TTL_FLAG}] nepoznata vrijednost; koristi se zadano off`,
  );
  return false;
}

/**
 * Types of fallback strategies
 */
export enum FallbackType {
  SENSOR_FAILURE = 'sensor_failure',
  ADAPTER_TIMEOUT = 'adapter_timeout',
  CACHED_STATE = 'cached_state',
  SAFE_DEFAULT = 'safe_default',
}

@Injectable()
export class FallbackStrategyService {
  private readonly logger = new Logger(FallbackStrategyService.name);
  private readonly structuredLogger = new StructuredLogger(
    FallbackStrategyService.name,
  );

  // Simple in-memory cache for fallback values (can be extended to Redis)
  private fallbackCache: Map<string, FallbackCacheEntry> = new Map();

  /**
   * REL-5 / B-022: po jedan timer PO KLJUČU. Prije ovoga svaki upis je zakazivao
   * novi bezuslovni `delete`, pa je stariji timer mogao obrisati noviji zapis.
   */
  private expiryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(private metricsService: MetricsService) {}

  /**
   * Get fallback value for boiler temperature when Tuya adapter fails
   */
  getTuyaFallback(
    deviceId: number,
    userId: number,
    lastKnownValue?: number,
  ): FallbackResult {
    const cacheKey = `tuya_temp_${deviceId}`;
    const cached = this.fallbackCache.get(cacheKey);

    // Use cached value if available and not too old (< 30 minutes)
    if (this.isCacheUsable(cached, 30 * 60 * 1000)) {
      this.recordFallback(
        FallbackType.CACHED_STATE,
        'Tuya temperature from cache',
        deviceId,
        userId,
      );
      return {
        triggered: true,
        reason: 'Tuya adapter timeout - using cached state',
        fallbackValue: cached.value,
        fallbackType: FallbackType.CACHED_STATE,
        usedCache: true,
      };
    }

    // Use last known value if provided
    if (lastKnownValue !== undefined) {
      this.recordFallback(
        FallbackType.SAFE_DEFAULT,
        `Tuya temperature fallback: ${lastKnownValue}°C`,
        deviceId,
        userId,
      );
      return {
        triggered: true,
        reason: 'Tuya adapter timeout - using last known value',
        fallbackValue: lastKnownValue,
        fallbackType: FallbackType.SAFE_DEFAULT,
        usedCache: false,
      };
    }

    // Safe default: 60°C (middle-range boiler temperature)
    const safeDefault = 60;
    this.recordFallback(
      FallbackType.SAFE_DEFAULT,
      `Tuya temperature safe default: ${safeDefault}°C`,
      deviceId,
      userId,
    );
    return {
      triggered: true,
      reason:
        'Tuya adapter timeout - using unvalidated safe default (60°C, not expert-confirmed)',
      fallbackValue: safeDefault,
      fallbackType: FallbackType.SAFE_DEFAULT,
      usedCache: false,
      safeDefaultValidated: false,
    };
  }

  /**
   * Get fallback value for weather data when Weather adapter fails
   */
  getWeatherFallback(
    userId: number,
    location: string,
    yesterday?: any,
  ): FallbackResult {
    const cacheKey = `weather_${location}`;
    const cached = this.fallbackCache.get(cacheKey);

    // Use cached value if available and not too old (< 24 hours for weather)
    if (this.isCacheUsable(cached, 24 * 60 * 60 * 1000)) {
      this.recordFallback(
        FallbackType.CACHED_STATE,
        'Weather data from cache',
        undefined,
        userId,
      );
      return {
        triggered: true,
        reason: 'Weather adapter timeout - using cached state',
        fallbackValue: cached.value,
        fallbackType: FallbackType.CACHED_STATE,
        usedCache: true,
      };
    }

    // Use yesterday's data if provided
    if (yesterday) {
      this.recordFallback(
        FallbackType.SAFE_DEFAULT,
        'Weather data from yesterday',
        undefined,
        userId,
      );
      return {
        triggered: true,
        reason: "Weather adapter timeout - using yesterday's data",
        fallbackValue: yesterday,
        fallbackType: FallbackType.SAFE_DEFAULT,
        usedCache: false,
      };
    }

    // Safe default: moderate conditions
    const safeDefault = {
      temperature: 15,
      humidity: 60,
      windSpeed: 10,
      condition: 'moderate',
    };
    this.recordFallback(
      FallbackType.SAFE_DEFAULT,
      'Weather data safe default',
      undefined,
      userId,
    );
    return {
      triggered: true,
      reason: 'Weather adapter timeout - using safe default weather',
      fallbackValue: safeDefault,
      fallbackType: FallbackType.SAFE_DEFAULT,
      usedCache: false,
      safeDefaultValidated: false,
    };
  }

  /**
   * Cache a successful sensor reading for fallback use
   */
  cacheSensorReading(key: string, value: any, ttlMinutes: number = 30): void {
    const now = Date.now();
    const version = (this.fallbackCache.get(key)?.version ?? 0) + 1;

    this.fallbackCache.set(key, {
      value,
      timestamp: new Date(now),
      expiresAt: now + ttlMinutes * 60 * 1000,
      version,
    });

    // B-022: otkazati prethodni timer ISTOG ključa prije zakazivanja novog.
    // Bez ovoga prvi timer briše ovaj, još svježi zapis.
    const previous = this.expiryTimers.get(key);
    if (previous) clearTimeout(previous);

    const timer = setTimeout(
      () => {
        // Dvostruka zaštita: obrisati samo ako je zapis i dalje naše verzije.
        const current = this.fallbackCache.get(key);
        if (current && current.version === version) {
          this.fallbackCache.delete(key);
        }
        if (this.expiryTimers.get(key) === timer) {
          this.expiryTimers.delete(key);
        }
      },
      ttlMinutes * 60 * 1000,
    );

    this.expiryTimers.set(key, timer);
  }

  /**
   * REL-5 / B-022: je li zapis upotrebljiv. Sa zastavicom `on` poštuje stvarni
   * `expiresAt` zapisa; bez nje zadržava naslijeđeni fiksni prag po tipu
   * podatka, jer ga postojeći potrošači očekuju.
   */
  private isCacheUsable(
    cached: FallbackCacheEntry | undefined,
    legacyMaxAgeMs: number,
  ): cached is FallbackCacheEntry {
    if (!cached) return false;
    if (strictTtlEnabled(this.logger)) return Date.now() < cached.expiresAt;
    return Date.now() - cached.timestamp.getTime() < legacyMaxAgeMs;
  }

  /**
   * REL-5 / B-022: opservabilnost — broj zapisa i stvarno zakazanih timera.
   * Služi i kao dokaz da ponovljeni upisi istog ključa ne gomilaju timere.
   */
  getCacheStats(): { entries: number; pendingTimers: number } {
    return {
      entries: this.fallbackCache.size,
      pendingTimers: this.expiryTimers.size,
    };
  }

  /**
   * Check if a sensor/adapter failure should trigger fallback
   */
  shouldTriggerFallback(error: any, retryAttempts: number = 0): boolean {
    // Trigger on timeout errors
    if (error?.name === 'TimeoutError') {
      return true;
    }

    // Trigger on circuit breaker open
    if (error?.message?.includes('circuit breaker')) {
      return true;
    }

    // Trigger on network errors after retries
    if (
      retryAttempts > 0 &&
      (error?.code === 'ECONNREFUSED' ||
        error?.code === 'ENOTFOUND' ||
        error?.code === 'ETIMEDOUT')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Record fallback usage in metrics
   */
  private recordFallback(
    type: FallbackType,
    reason: string,
    deviceId?: number,
    userId?: number,
  ): void {
    this.metricsService.incrementCounter('fallback_triggered_total');

    switch (type) {
      case FallbackType.SENSOR_FAILURE:
        this.metricsService.incrementCounter('fallback_sensor_failure_total');
        break;
      case FallbackType.ADAPTER_TIMEOUT:
        this.metricsService.incrementCounter('fallback_adapter_timeout_total');
        break;
      case FallbackType.CACHED_STATE:
        this.metricsService.incrementCounter('fallback_cached_state_total');
        break;
      case FallbackType.SAFE_DEFAULT:
        // Already counted in trigger_total
        break;
    }

    this.structuredLogger.log('Fallback strategy triggered', {
      deviceId,
      userId,
      module: 'fallback-strategy',
      action: 'fallback_triggered',
      fallbackType: type,
      reason,
    });

    this.logger.warn(
      `[Fallback] Type=${type} | Reason=${reason} | Device=${deviceId}`,
    );
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    // B-022: bez otkazivanja bi timer iz obrisanog zapisa mogao obrisati
    // vrijednost upisanu NAKON clear-a.
    for (const timer of this.expiryTimers.values()) clearTimeout(timer);
    this.expiryTimers.clear();
    this.fallbackCache.clear();
  }
}
