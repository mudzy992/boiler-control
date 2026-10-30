/**
 * SEC-3 / R-004 — masovni testni endpoint mora biti zaštićen.
 *
 * `POST /api/notifications/test-trigger-all-gas-reminders` poziva
 * `GasReminderService.triggerDailyReminders()`, koji šalje push obavijest
 * **svim** registrovanim korisnicima. Bez admin role to je vektor za spam /
 * uznemiravanje, i to preko autentificiranog naloga.
 *
 * `RolesGuard` i `Roles()` već postoje u `src/modules/Auth/`, ali ih nijedan
 * kontroler nije koristio. `JwtAuthGuard` već stavlja `role` na request
 * (jwt-auth.guard.ts:52-54), pa guard ne treba dodatne podatke.
 */
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';
import { GasReminderService } from '../../Schedule/gas.reminder.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RolesGuard } from '../../Auth/role.guard';
import { JwtAuthGuard } from '../../Auth/jwt-auth.guard';
import { ROLES_KEY } from '../../Auth/roles.decorator';
import request from 'supertest';

/**
 * Referenca na handler samo da bi se pročitala njegova metadata. Metoda se
 * nikad ne poziva, pa `unbound-method` ovdje nije stvarni problem.
 */
function handlerRef(
  name: 'testTriggerAllReminders' | 'testGasReminder',
): unknown {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  return NotificationsController.prototype[name];
}

function contextWithUser(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => NotificationsController,
  } as unknown as ExecutionContext;
}

describe('SEC-3 / R-004: admin guard na masovnom testnom endpointu', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  afterEach(() => jest.restoreAllMocks());

  it('metoda testTriggerAllReminders je dekorisana traženim rolama', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      handlerRef('testTriggerAllReminders'),
    );
    expect(roles).toBeDefined();
    expect(roles).toContain('ADMIN');
  });

  it('metoda testGasReminder (pojedinačni, sam sebi) NE traži admina', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, handlerRef('testGasReminder'));
    expect(roles ?? []).not.toContain('ADMIN');
  });

  it('RolesGuard pušta samo ADMIN; SUPPORT, USER i anonimni su blokirani', () => {
    // Guard čita metadata preko Reflector-a; ovdje ga hranimo onim što
    // stvarni `@Roles(UserRole.ADMIN)` upisuje na metodu.
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      handlerRef('testTriggerAllReminders'),
    );
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

    expect(
      guard.canActivate(contextWithUser({ userId: 1, role: 'ADMIN' })),
    ).toBe(true);
    // Masovni push svim korisnicima je administrativna akcija: SUPPORT ga
    // ne dobija, jer `@Roles(UserRole.ADMIN)` traži isključivo ADMIN.
    expect(
      guard.canActivate(contextWithUser({ userId: 2, role: 'SUPPORT' })),
    ).toBe(false);
    expect(
      guard.canActivate(contextWithUser({ userId: 3, role: 'USER' })),
    ).toBe(false);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(false);
  });

  it('HTTP: običan korisnik dobija 403, admin prolazi', async () => {
    const triggerDailyReminders = jest
      .fn()
      .mockResolvedValue({ sent: 1, total: 1 });

    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: {} },
        { provide: GasReminderService, useValue: { triggerDailyReminders } },
        { provide: PrismaService, useValue: {} },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
      ],
    })
      // `JwtAuthGuard` je na klasi; overridamo ga jer stvarni traži token.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const app = moduleRef.createNestApplication({ logger: false });
    // `JwtAuthGuard` je overridan; middleware postavlja `req.user` onako kako
    // to radi stvarni guard (jwt-auth.guard.ts:52-54).
    let role = 'USER';
    app.use((req: any, _res: any, next: any) => {
      req.user = { userId: 1, role, plan: 'free' };
      next();
    });
    await app.init();

    const forbidden = await request(app.getHttpServer()).post(
      '/api/notifications/test-trigger-all-gas-reminders',
    );
    expect(forbidden.status).toBe(403);
    expect(triggerDailyReminders).not.toHaveBeenCalled();

    role = 'ADMIN';
    const allowed = await request(app.getHttpServer()).post(
      '/api/notifications/test-trigger-all-gas-reminders',
    );
    expect(allowed.status).toBe(201);
    expect(triggerDailyReminders).toHaveBeenCalledTimes(1);

    await app.close();
  });
});
