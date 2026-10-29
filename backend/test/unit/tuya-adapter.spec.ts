import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { TuyaAdapter } from '../../src/modules/Boiler/adapter/tuya.adapter';
import { TuyaAuthService } from '../../src/modules/Tuya/tuya.auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ProgramSyncService } from '../../src/modules/Boiler/adapter/program.sync.service';
import { ThermostatSnapshot } from '../../src/modules/Boiler/adapter/thermostat-adapter.interface';

describe('TuyaAdapter (P1b: Tuya Safety)', () => {
  let adapter: TuyaAdapter;
  let mockTuyaAuthService: jest.Mocked<TuyaAuthService>;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockProgramSyncService: jest.Mocked<ProgramSyncService>;
  let mockAxios: any;

  beforeEach(async () => {
    // Mock axios
    mockAxios = {
      get: jest.fn(),
    };

    // Mock services
    mockTuyaAuthService = {
      getAccessToken: jest.fn().mockResolvedValue('test-token'),
    } as any;

    mockPrismaService = {
      thermostatDevice: {
        findFirst: jest.fn(),
      },
      thermostatProgram: {
        findFirst: jest.fn(),
      },
    } as any;

    mockProgramSyncService = {
      syncProgram: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TuyaAdapter,
        {
          provide: TuyaAuthService,
          useValue: mockTuyaAuthService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ProgramSyncService,
          useValue: mockProgramSyncService,
        },
      ],
    }).compile();

    adapter = module.get<TuyaAdapter>(TuyaAdapter);
    adapter.resetMetrics();

    // Stub axios for this test
    jest.mock('axios');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('Request Accounting & Metrics', () => {
    it('should increment totalRequests counter on successful fetch', async () => {
      const mockStatus = {
        TempCurrent: 40,
        TempSet: 44,
        Power: true,
      };

      // Exercise the real accounting path while isolating external HTTP and signing.
      jest.spyOn(adapter as any, 'generateHeaders').mockResolvedValueOnce({});
      jest.spyOn(axios, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          result: {
            status: Object.entries(mockStatus).map(([code, value]) => ({
              code,
              value,
            })),
          },
        },
      });

      (
        mockPrismaService.thermostatDevice.findFirst as jest.Mock
      ).mockResolvedValueOnce({
        id: 1,
        deviceId: 'test-device',
      } as any);

      (
        mockPrismaService.thermostatProgram.findFirst as jest.Mock
      ).mockResolvedValueOnce(null);

      const snapshot = await adapter.fetchSnapshot('test-device');

      const metrics = adapter.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
    });

    it('should increment failedRequests counter on error', async () => {
      jest.spyOn(adapter as any, 'generateHeaders').mockResolvedValueOnce({});
      jest
        .spyOn(axios, 'get')
        .mockRejectedValueOnce(new Error('Network error'));

      (
        mockPrismaService.thermostatDevice.findFirst as jest.Mock
      ).mockResolvedValueOnce({
        id: 1,
        deviceId: 'test-device',
      } as any);

      try {
        await adapter.fetchSnapshot('test-device');
      } catch (e) {
        // Expected to fail
      }

      const metrics = adapter.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.failedRequests).toBe(1);
    });

    it('should reset metrics on resetMetrics()', () => {
      const metrics = adapter.getMetrics();
      expect(metrics.totalRequests).toBe(0);

      adapter.resetMetrics();
      const metricsAfterReset = adapter.getMetrics();
      expect(metricsAfterReset.totalRequests).toBe(0);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after 3 consecutive failures', async () => {
      jest.spyOn(adapter as any, 'generateHeaders').mockResolvedValue({});
      const get = jest
        .spyOn(axios, 'get')
        .mockRejectedValue(new Error('Network error'));
      for (let i = 0; i < 3; i++) {
        await expect(adapter.fetchSnapshot('test-device')).rejects.toThrow(
          'Network error',
        );
      }
      await expect(adapter.fetchSnapshot('test-device')).rejects.toThrow(
        'Circuit breaker open',
      );
      expect(get).toHaveBeenCalledTimes(3);
      expect(adapter.getMetrics().circuitBreakerTrips).toBe(1);
    });

    it('should reset circuit breaker after timeout', async () => {
      jest.useFakeTimers();
      jest.spyOn(adapter as any, 'generateHeaders').mockResolvedValue({});
      const get = jest
        .spyOn(axios, 'get')
        .mockRejectedValue(new Error('Network error'));
      for (let i = 0; i < 3; i++) {
        await expect(adapter.fetchSnapshot('test-device')).rejects.toThrow(
          'Network error',
        );
      }
      jest.advanceTimersByTime(65000);
      get.mockResolvedValueOnce({
        data: { success: true, result: { status: [] } },
      });
      (
        mockPrismaService.thermostatDevice.findFirst as jest.Mock
      ).mockResolvedValueOnce({ id: 1 });
      await expect(adapter.fetchSnapshot('test-device')).resolves.toBeDefined();
      expect(get).toHaveBeenCalledTimes(4);
    });
  });

  describe('Snapshot Cache (5s TTL)', () => {
    it('should preserve snapshot values within TTL and refetch after expiry', async () => {
      jest.useFakeTimers();
      jest.spyOn(adapter as any, 'generateHeaders').mockResolvedValue({});
      const get = jest.spyOn(axios, 'get').mockResolvedValue({
        data: {
          success: true,
          result: {
            status: [
              { code: 'TempCurrent', value: 40 },
              { code: 'TempSet', value: 44 },
              { code: 'Power', value: true },
            ],
          },
        },
      });
      (
        mockPrismaService.thermostatDevice.findFirst as jest.Mock
      ).mockResolvedValue({ id: 1 });
      const first = await adapter.fetchSnapshot('test-device-cache');
      jest.advanceTimersByTime(4999);
      const cached = await adapter.fetchSnapshot('test-device-cache');
      expect(cached).toEqual(first);
      expect(get).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      const refreshed = await adapter.fetchSnapshot('test-device-cache');
      expect(refreshed.currentTemp).toBe(first.currentTemp);
      expect(refreshed.targetTemp).toBe(first.targetTemp);
      expect(refreshed.powerOn).toBe(first.powerOn);
      expect(get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Budget Monitoring', () => {
    it('should track if usage exceeds 70% of daily budget (~1,600 calls)', () => {
      const dailyBudget = 1600;
      const alertThreshold = dailyBudget * 0.7; // ~1120 calls

      adapter.resetMetrics();

      // Simulate requests above the threshold
      for (let i = 0; i < 1200; i++) {
        (adapter as any).requestMetrics.totalRequests++;
        (adapter as any).requestMetrics.successfulRequests++;
      }

      const metrics = adapter.getMetrics();
      const usagePercent = (metrics.totalRequests / dailyBudget) * 100;

      expect(usagePercent).toBeGreaterThan(70);
    });
  });

  describe('Timeout Handling', () => {
    it('should count and propagate a request timeout', async () => {
      jest.spyOn(adapter as any, 'generateHeaders').mockResolvedValueOnce({});
      jest
        .spyOn(axios, 'get')
        .mockRejectedValueOnce(new Error('timeout of 10000ms exceeded'));
      await expect(adapter.fetchSnapshot('test-device')).rejects.toThrow(
        'timeout',
      );
      expect(adapter.getMetrics().failedRequests).toBe(1);
    });
  });
});
