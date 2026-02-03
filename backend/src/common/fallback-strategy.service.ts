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
  private fallbackCache: Map<string, { value: any; timestamp: Date }> =
    new Map();

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
    if (cached && Date.now() - cached.timestamp.getTime() < 30 * 60 * 1000) {
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
      reason: 'Tuya adapter timeout - using safe default (60°C)',
      fallbackValue: safeDefault,
      fallbackType: FallbackType.SAFE_DEFAULT,
      usedCache: false,
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
    if (
      cached &&
      Date.now() - cached.timestamp.getTime() < 24 * 60 * 60 * 1000
    ) {
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
    };
  }

  /**
   * Cache a successful sensor reading for fallback use
   */
  cacheSensorReading(key: string, value: any, ttlMinutes: number = 30): void {
    this.fallbackCache.set(key, {
      value,
      timestamp: new Date(),
    });

    // Auto-expire cache after TTL
    setTimeout(() => this.fallbackCache.delete(key), ttlMinutes * 60 * 1000);
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
    this.fallbackCache.clear();
  }
}
