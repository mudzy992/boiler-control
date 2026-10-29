import { Test, TestingModule } from '@nestjs/testing';
import {
  FallbackStrategyService,
  FallbackType,
} from '../fallback-strategy.service';
import { MetricsService } from '../metrics.service';
import { StructuredLogger } from '../structured-logger';

describe('FallbackStrategyService', () => {
  let service: FallbackStrategyService;
  let metricsService: MetricsService;

  beforeEach(async () => {
    jest.useFakeTimers();
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
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FallbackStrategyService>(FallbackStrategyService);
    metricsService = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    service.clearCache();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('getTuyaFallback', () => {
    it('should return cached value if available and not expired (<30min)', () => {
      const cachedValue = 68;
      service.cacheSensorReading('tuya_temp_1', cachedValue, 30);

      const result = service.getTuyaFallback(1, 100);

      expect(result.triggered).toBe(true);
      expect(result.fallbackValue).toEqual(cachedValue);
      expect(result.fallbackType).toBe(FallbackType.CACHED_STATE);
      expect(result.usedCache).toBe(true);
    });

    it('should return safe default (60°C) if no cached value', () => {
      const result = service.getTuyaFallback(999, 100);

      expect(result.triggered).toBe(true);
      expect(result.fallbackValue).toBe(60);
      expect(result.fallbackType).toBe(FallbackType.SAFE_DEFAULT);
      expect(result.usedCache).toBe(false);
    });

    it('should return lastKnownValue if provided', () => {
      const result = service.getTuyaFallback(1, 100, 72);

      expect(result.triggered).toBe(true);
      expect(result.fallbackValue).toBe(72);
      expect(result.fallbackType).toBe(FallbackType.SAFE_DEFAULT);
    });
  });

  describe('getWeatherFallback', () => {
    it('should return cached weather if available and not expired (<24h)', () => {
      const cachedWeather = { temperature: 15, humidity: 65, windSpeed: 10 };
      service.cacheSensorReading('weather_NYC', cachedWeather, 1440);

      const result = service.getWeatherFallback(100, 'NYC');

      expect(result.triggered).toBe(true);
      expect(result.fallbackValue).toEqual(cachedWeather);
      expect(result.fallbackType).toBe(FallbackType.CACHED_STATE);
      expect(result.usedCache).toBe(true);
    });

    it('should return yesterday data if cache expired', () => {
      const yesterdayData = { temperature: 12, humidity: 70, windSpeed: 5 };

      const result = service.getWeatherFallback(100, 'NYC', yesterdayData);

      expect(result.triggered).toBe(true);
      expect(result.fallbackValue).toEqual(yesterdayData);
      expect(result.fallbackType).toBe(FallbackType.SAFE_DEFAULT);
    });

    it('should return safe default weather if no other data', () => {
      const result = service.getWeatherFallback(100, 'UNKNOWN');

      expect(result.triggered).toBe(true);
      expect(result.fallbackValue).toEqual({
        temperature: 15,
        humidity: 60,
        windSpeed: 10,
        condition: 'moderate',
      });
      expect(result.fallbackType).toBe(FallbackType.SAFE_DEFAULT);
    });
  });

  describe('cacheSensorReading', () => {
    it('should cache sensor reading with TTL', () => {
      const reading = 68;
      service.cacheSensorReading('tuya_temp_1', reading, 30);

      const result = service.getTuyaFallback(1, 100);

      expect(result.usedCache).toBe(true);
      expect(result.fallbackValue).toEqual(reading);
    });

    it('should handle multiple different sensors', () => {
      const reading1 = 68;
      const reading2 = 72;

      service.cacheSensorReading('tuya_temp_1', reading1, 30);
      service.cacheSensorReading('tuya_temp_2', reading2, 30);

      const result1 = service.getTuyaFallback(1, 100);
      const result2 = service.getTuyaFallback(2, 100);

      expect(result1.fallbackValue).toEqual(reading1);
      expect(result2.fallbackValue).toEqual(reading2);
    });
  });

  describe('shouldTriggerFallback', () => {
    it('should return true for TimeoutError', () => {
      const error = new Error('Request timeout');
      error.name = 'TimeoutError';

      const result = service.shouldTriggerFallback(error);

      expect(result).toBe(true);
    });

    it('should return true for ECONNREFUSED after retries', () => {
      const error = new Error('Connection refused');
      Object.assign(error, { code: 'ECONNREFUSED' });

      const result = service.shouldTriggerFallback(error, 2);

      expect(result).toBe(true);
    });

    it('should return true for circuit breaker message', () => {
      const error = new Error('circuit breaker is open');

      const result = service.shouldTriggerFallback(error);

      expect(result).toBe(true);
    });

    it('should return false for non-fallback errors', () => {
      const error = new Error('Some other error');

      const result = service.shouldTriggerFallback(error);

      expect(result).toBe(false);
    });

    it('should return false for null/undefined error', () => {
      expect(service.shouldTriggerFallback(null)).toBe(false);
      expect(service.shouldTriggerFallback(undefined)).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached values', () => {
      service.cacheSensorReading('tuya_temp_1', 68, 30);
      service.cacheSensorReading('tuya_temp_2', 72, 30);

      service.clearCache();

      const result1 = service.getTuyaFallback(1, 100);
      const result2 = service.getTuyaFallback(2, 100);

      expect(result1.fallbackValue).toBe(60);
      expect(result2.fallbackValue).toBe(60);
      expect(result1.usedCache).toBe(false);
      expect(result2.usedCache).toBe(false);
    });
  });

  describe('Integration: Sensor failure scenario', () => {
    it('should use cached state when adapter fails', () => {
      const deviceId = 1;
      const userId = 100;
      const sensorReading = 68;

      service.cacheSensorReading('tuya_temp_1', sensorReading, 30);

      const error = new Error('Connection refused');
      Object.assign(error, { code: 'ECONNREFUSED' });

      const shouldFallback = service.shouldTriggerFallback(error, 2);
      expect(shouldFallback).toBe(true);

      const result = service.getTuyaFallback(deviceId, userId);
      expect(result.usedCache).toBe(true);
      expect(result.fallbackValue).toEqual(sensorReading);
      expect(result.fallbackType).toBe(FallbackType.CACHED_STATE);
    });

    it('should fallback to safe default when cache expired', () => {
      const deviceId = 1;
      const userId = 100;

      service.cacheSensorReading('tuya_temp_1', 68, 0.1);
      jest.advanceTimersByTime(5999);
      expect(service.getTuyaFallback(deviceId, userId).usedCache).toBe(true);
      jest.advanceTimersByTime(1);

      const result = service.getTuyaFallback(deviceId, userId);
      expect(result.fallbackType).toBe(FallbackType.SAFE_DEFAULT);
      expect(result.fallbackValue).toBe(60);
      expect(result.usedCache).toBe(false);
    });
  });
});
