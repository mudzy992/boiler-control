import { Injectable, Logger } from '@nestjs/common';
import { HttpAdapter } from '../../common/adapters/http-adapter';
import { MetricsService } from '../../common/metrics.service';
import { StructuredLogger } from '../../common/structured-logger';

/**
 * Weather API-specific HTTP adapter with 10s timeout and circuit breaker protection.
 * Wraps all Weather/Open-Meteo API calls with timeout and failure resilience.
 */

/**
 * Timeout jednog Open-Meteo poziva, u milisekundama.
 *
 * **Zašto nije samo broj 10000.** Ugovorni i integracioni testovi dižu pun
 * `AppModule` (nema mock-a mreže), a `GET /api/dashboard` zove
 * `calculateFlowTemp` koji ide po prognozu. Kad je Open-Meteo spor, **jedan**
 * zahtjev traje do 10 s, a `dashboard` je u tom lancu **tri puta** — pa suite
 * pređe `testTimeout: 30000` i padne kao „Test suite failed to run —
 * exceeded timeout", iako test nije pogrešan.
 *
 * Mjereno: commit `865d2f8` je bio zelen (`43322082372`), a isti commit crven
 * kasnije — dakle nije regresija u kodu nego vrijeme. Zato je timeout
 * **podesiv** umjesto da se prag podiže naslijepo: CI ga spusti, produkcija
 * ostaje na 10 s.
 *
 * Vrijednost se čita iz `WEATHER_HTTP_TIMEOUT_MS`. Neispravan ili nepozitivan
 * broj se **ignoriše** (ostaje zadano), jer timeout od 0 ili `NaN` ne bi
 * puknuo na očit — pretvorio bi se u beskonačno čekanje.
 */
export function weatherHttpTimeoutMs(
  raw: string | undefined = process.env.WEATHER_HTTP_TIMEOUT_MS,
): number {
  const DEFAULT_MS = 10_000;
  if (raw === undefined || raw.trim() === '') return DEFAULT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MS;
  return Math.floor(parsed);
}
@Injectable()
export class WeatherHttpAdapter extends HttpAdapter {
  protected readonly logger = new Logger(WeatherHttpAdapter.name);

  constructor(metricsService: MetricsService) {
    // Avoid requiring StructuredLogger in DI for test modules; create a
    // local instance for adapter-level structured logs.
    const structuredLogger = new StructuredLogger('WeatherHttpAdapter');

    super(
      {
        name: 'weather-api',
        // Podesivo (v. weatherHttpTimeoutMs): testovi ne smiju ici u mrezu 3 x 10 s.
        timeout: weatherHttpTimeoutMs(),
        failureThreshold: 3, // Lower threshold for weather (non-critical)
        recoveryTimeout: 30000,
        retryAttempts: 1,
        retryDelay: 1000,
      },
      metricsService,
      structuredLogger,
    );
  }

  /** Count every logical geocoder/forecast call, including direct SDK calls. */
  async executeWithCircuitBreaker<T>(
    requestFn: () => Promise<T>,
    context?: { runId?: string; endpoint?: string },
  ): Promise<T> {
    this.metricsService?.incrementCounter('weather_requests_total');
    try {
      const result = await super.executeWithCircuitBreaker(requestFn, context);
      this.metricsService?.incrementCounter('weather_requests_success');
      return result;
    } catch (error) {
      this.metricsService?.incrementCounter('weather_requests_failed');
      if (error instanceof Error && error.message.includes('timeout')) {
        this.metricsService?.incrementCounter('weather_timeout_errors');
      }
      throw error;
    }
  }
}
