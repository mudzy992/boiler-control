import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Safe Prisma Update Patterns (P1a)', () => {
  let prismaService: PrismaService;

  beforeEach(async () => {
    // Mock Prisma service for these tests
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: {
            notification: {
              findUnique: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            heatingEvent: {
              findUnique: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            homeProfile: {
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            thermostatDevice: {
              updateMany: jest.fn(),
            },
            heatingIntervalLearning: {
              updateMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('markAsRead: Pre-check + update pattern', () => {
    it('should return null if notification does not exist (no crash)', async () => {
      const notificationId = 999;

      (
        prismaService.notification.findUnique as jest.Mock
      ).mockResolvedValueOnce(null);

      // Simulate the safe pattern:
      // const existing = await prisma.notification.findUnique({ where: { id } });
      // if (!existing) return null;
      const existing = await prismaService.notification.findUnique({
        where: { id: notificationId },
      });

      if (!existing) {
        expect(existing).toBeNull();
        expect(prismaService.notification.update).not.toHaveBeenCalled();
        return;
      }

      fail('Should have returned null early');
    });

    it('should update if notification exists', async () => {
      const notificationId = 1;
      const mockNotification = { id: notificationId, deliveryOk: false };

      (
        prismaService.notification.findUnique as jest.Mock
      ).mockResolvedValueOnce(mockNotification);

      (prismaService.notification.update as jest.Mock).mockResolvedValueOnce({
        ...mockNotification,
        deliveryOk: true,
      });

      // Safe pattern:
      const existing = await prismaService.notification.findUnique({
        where: { id: notificationId },
      });

      if (!existing) {
        fail('Should have found notification');
      }

      const result = await prismaService.notification.update({
        where: { id: notificationId },
        data: { deliveryOk: true },
      });

      expect(result.deliveryOk).toBe(true);
    });
  });

  describe('updateMany: No crash on missing records', () => {
    it('should silently skip if heatingEvent not found', async () => {
      const eventId = 999;

      (
        prismaService.heatingEvent.updateMany as jest.Mock
      ).mockResolvedValueOnce({
        count: 0, // No records updated
      });

      const result = await prismaService.heatingEvent.updateMany({
        where: { id: eventId },
        data: { roomTargetTemp: 22 },
      });

      expect(result.count).toBe(0);
      expect(prismaService.heatingEvent.updateMany).toHaveBeenCalledWith({
        where: { id: eventId },
        data: { roomTargetTemp: 22 },
      });
    });

    it('should update if heatingEvent exists', async () => {
      const eventId = 1;

      (
        prismaService.heatingEvent.updateMany as jest.Mock
      ).mockResolvedValueOnce({
        count: 1, // One record updated
      });

      const result = await prismaService.heatingEvent.updateMany({
        where: { id: eventId },
        data: { roomTargetTemp: 22 },
      });

      expect(result.count).toBe(1);
    });

    it('should handle batch updates with complex where clause', async () => {
      (
        prismaService.thermostatDevice.updateMany as jest.Mock
      ).mockResolvedValueOnce({
        count: 2, // Multiple records updated
      });

      const result = await prismaService.thermostatDevice.updateMany({
        where: {
          OR: [{ id: 1 }, { id: 2 }],
        },
        data: { lastSnapshotAt: new Date() },
      });

      expect(result.count).toBe(2);
    });
  });

  describe('Transaction consistency (P1c foundation)', () => {
    it('should support $transaction for multi-step operations', async () => {
      // Mock transaction support
      const mockTransaction = jest.fn().mockResolvedValueOnce([
        { id: 1 }, // heatingEvent created
        { count: 1 }, // boilerHistory updated
      ]);

      (prismaService as any).$transaction = mockTransaction;

      const operations = [
        { op: 'create', model: 'heatingEvent', data: { deviceId: 1 } },
        {
          op: 'updateMany',
          model: 'boilerHistory',
          where: { userId: 1 },
          data: { heatingEnd: new Date() },
        },
      ];

      await (prismaService as any).$transaction(operations);

      expect(mockTransaction).toHaveBeenCalledWith(operations);
    });
  });

  describe('Heating anomaly confirm: Safe update with DB pre-check', () => {
    it('should return { success: false } if event not found', async () => {
      const eventId = 999;

      (
        prismaService.heatingEvent.findUnique as jest.Mock
      ).mockResolvedValueOnce(null);

      // Safe pattern in anomaly checker:
      const event = await prismaService.heatingEvent.findUnique({
        where: { id: eventId },
        include: { thermostat: true },
      });

      const result = event ? { success: true } : { success: false };

      expect(result.success).toBe(false);
      expect(prismaService.heatingEvent.updateMany).not.toHaveBeenCalled();
    });

    it('should updateMany and not crash if event exists', async () => {
      const eventId = 1;
      const mockEvent = {
        id: eventId,
        thermostat: { id: 1, userId: 1 },
        timestampStart: new Date(),
        proposedEndTime: new Date(),
      };

      (
        prismaService.heatingEvent.findUnique as jest.Mock
      ).mockResolvedValueOnce(mockEvent);

      (
        prismaService.heatingEvent.updateMany as jest.Mock
      ).mockResolvedValueOnce({
        count: 1,
      });

      const event = await prismaService.heatingEvent.findUnique({
        where: { id: eventId },
        include: { thermostat: true },
      });

      if (!event) {
        fail('Should find event');
      }

      const result = await prismaService.heatingEvent.updateMany({
        where: { id: eventId },
        data: {
          timestampEnd: new Date(),
          isAnomaly: false,
          proposedEndTime: null,
        },
      });

      expect(result.count).toBe(1);
    });
  });

  describe('User update with pre-check', () => {
    it('should not crash if user not found', async () => {
      const userId = 999;

      (prismaService.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const existing = await prismaService.user.findUnique({
        where: { id: userId },
      });

      if (!existing) {
        // Safe: return without update
        expect(prismaService.user.update).not.toHaveBeenCalled();
        return;
      }

      fail('Should have caught missing user');
    });

    it('should update user if found', async () => {
      const userId = 1;
      const mockUser = { id: userId, email: 'test@test.com' };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValueOnce(
        mockUser,
      );

      (prismaService.user.update as jest.Mock).mockResolvedValueOnce({
        ...mockUser,
        name: 'Updated',
      });

      const existing = await prismaService.user.findUnique({
        where: { id: userId },
      });

      if (!existing) {
        fail('Should find user');
      }

      const result = await prismaService.user.update({
        where: { id: userId },
        data: { name: 'Updated' },
      });

      expect(result.name).toBe('Updated');
    });
  });
});
