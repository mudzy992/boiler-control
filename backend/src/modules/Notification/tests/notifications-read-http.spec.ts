import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../Auth/jwt-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { GasReminderService } from '../../Schedule/gas.reminder.service';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';

describe('Notifications markAsRead HTTP kompatibilnost', () => {
  let app: INestApplication;
  const markAsRead = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: { markAsRead },
        },
        { provide: PrismaService, useValue: {} },
        { provide: GasReminderService, useValue: {} },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{
            user?: { userId: number };
          }>();
          req.user = { userId: 42 };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    markAsRead.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/notifications/:id/read path ID (S-002)', () => {
    it('zadržava numeric ID, response i servisne argumente', async () => {
      const notification = {
        id: 17,
        userId: 42,
        type: 'SYSTEM_ALERT',
        title: 'Synthetic owner title',
        message: 'Synthetic owner message',
        data: { marker: 'owner-only' },
        sourceRef: 's002-read-path',
        isRead: true,
      };
      markAsRead.mockResolvedValue(notification);

      const response = await request(app.getHttpServer()).post(
        '/api/notifications/17/read',
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual(notification);
      expect(markAsRead).toHaveBeenCalledTimes(1);
      expect(markAsRead).toHaveBeenCalledWith(17, 42);
    });

    it('odbija ne-brojčani ID prije servisnog poziva', async () => {
      markAsRead.mockResolvedValue({ id: 17, userId: 42, isRead: true });

      const response = await request(app.getHttpServer()).post(
        '/api/notifications/not-a-number/read',
      );

      expect(response.status).toBe(400);
      expect(markAsRead).not.toHaveBeenCalled();
    });
  });
});
