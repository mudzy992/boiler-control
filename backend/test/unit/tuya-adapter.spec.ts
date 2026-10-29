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
          result: { status: Object.entries(mockStatus).map(([code, value]) => ({ code, value })) },
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
      jest.spyOn(axios, 'get').mockRejectedValueOnce(new Error('Network error'));

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
      jest
        .spyOn(adapter as any, 'fetchStatus')
        .mockRejectedValue(new Error('Test failure'));

      // Simulate 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await adapter.fetchSnapshot(`test-device`);
        } catch (e) {
          // Expected
        }
      }

      // Fourth attempt should fail immediately due to circuit breaker
      try {
        await adapter.fetchSnapshot(`test-device`);
      } catch (e) {
        expect(e.message).toContain('Circuit breaker open');
      }

      const metrics = adapter.getMetrics();
      expect(metrics.circuitBreakerTrips).toBeGreaterThan(0);
    });

    it('should reset circuit breaker after timeout', async () => {
      jest
        .spyOn(adapter as any, 'fetchStatus')
        .mockRejectedValue(new Error('Test failure'));

      // Trigger 3 failures to open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await adapter.fetchSnapshot('test-device');
        } catch (e) {
          // Expected
        }
      }

      // Advance time beyond CB_RESET_TIME (60 seconds)
      jest.advanceTimersByTime(65000);

      // Mock a successful response after reset
      const mockStatus = { TempCurrent: 40, TempSet: 44, Power: true };
      jest
        .spyOn(adapter as any, 'fetchStatus')
        .mockResolvedValueOnce(mockStatus);

      (
        mockPrismaService.thermostatDevice.findFirst as jest.Mock
      ).mockResolvedValueOnce({
        id: 1,
        deviceId: 'test-device',
      } as any);

      (
        mockPrismaService.thermostatProgram.findFirst as jest.Mock
      ).mockResolvedValueOnce(null);

      // Should now succeed after timeout reset
      const snapshot = await adapter.fetchSnapshot('test-device');
      expect(snapshot).toBeDefined();
    });
  });

  describe('Snapshot Cache (5s TTL)', () => {
    it('should cache snapshot for 5 seconds', async () => {
      const mockStatus = {
        TempCurrent: 40,
        TempSet: 44,
        Power: true,
      };

      jest.spyOn(adapter as any, 'fetchStatus').mockResolvedValue(mockStatus);

      (
        mockPrismaService.thermostatDevice.findFirst as jest.Mock
      ).mockResolvedValue({
        id: 1,
        deviceId: 'test-device',
      } as any);

      (
        mockPrismaService.thermostatProgram.findFirst as jest.Mock
      ).mockResolvedValue(null);

      // First call should fetch
      await adapter.fetchSnapshot('test-device-cache');

      // Mock should have been called once
      const initialCallCount = (mockTuyaAuthService.getAccessToken as jest.Mock)
        .mock.calls.length;

      // Second call within 5s should use cache
      await adapter.fetchSnapshot('test-device-cache');

      // Advance time beyond 5s
      jest.advanceTimersByTime(6000);

      // This should invalidate cache
      await adapter.fetchSnapshot('test-device-cache');

      // Verify cache behavior (getAccessToken called again after cache expired)
      const finalCallCount = (mockTuyaAuthService.getAccessToken as jest.Mock)
        .mock.calls.length;

      expect(finalCallCount).toBeGreaterThan(initialCallCount);
    });
  });

  describe('Budget Monitoring', () => {
    it('should track if usage exceeds 70% of daily budget (~1,600 calls)', () => {
      const dailyBudget = 1600;
      const alertThreshold = dailyBudget * 0.7; // ~1120 calls

      adapter.resetMetrics();

      // Simulate requests approaching threshold
      for (let i = 0; i < 1100; i++) {
        (adapter as any).requestMetrics.totalRequests++;
        (adapter as any).requestMetrics.successfulRequests++;
      }

      const metrics = adapter.getMetrics();
      const usagePercent = (metrics.totalRequests / dailyBudget) * 100;

      expect(usagePercent).toBeGreaterThan(70);
    });
  });

  describe('Timeout Handling', () => {
    it('should fail fast on timeout', async () => {
      jest
        .spyOn(adapter as any, 'fetchStatus')
        .mockImplementationOnce(async () => {
          // Simulate a timeout by throwing
          throw new Error('timeout of 10000ms exceeded');
        });

      (
        mockPrismaService.thermostatDevice.findFirst as jest.Mock
      ).mockResolvedValueOnce({
        id: 1,
        deviceId: 'test-device',
      } as any);

      try {
        await adapter.fetchSnapshot('test-device');
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e.message).toContain('timeout');
        const metrics = adapter.getMetrics();
        expect(metrics.failedRequests).toBe(1);
      }
    });
  });
});
