import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// `src/generated/prisma` je gitignored build artefakt (`.gitignore:51`) koji u CI-ju
// nastaje preko `npm run generate:prisma`. Ovdje mock-ujemo SAMO sloj baze i pusha,
// da test ne zavisi od generisanog klijenta — `NotificationsService.markAsRead`
// ostaje STVARNI kod koji se izvršava.
jest.mock('src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('src/modules/ExpoPush/expo.push.notification.service', () => ({
  ExpoPushService: class ExpoPushService {},
}));

import { NotificationsService } from 'src/modules/Notification/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExpoPushService } from 'src/modules/ExpoPush/expo.push.notification.service';

/**
 * SEC-1 regresijski test — IDOR na POST /api/notifications/:id/read.
 *
 * Prijašnja implementacija je tražila notifikaciju samo po `id` i onda je
 * ažurirala po `id`, bez ikakve provjere vlasništva. Bilo koji prijavljeni
 * korisnik je mogao označiti tuđu notifikaciju kao pročitanu pogađanjem ID-a.
 *
 * Za razliku od `test/unit/prisma-safe-updates.spec.ts` (koji reinplementira
 * obrazac inline nad mockovima i time NE izvršava produkcijski kod), ovi
 * testovi pozivaju stvarni `NotificationsService.markAsRead`.
 */
describe('SEC-1: markAsRead vlasništvo (IDOR)', () => {
  let service: NotificationsService;
  let updateMany: jest.Mock;
  let findUnique: jest.Mock;

  const OWNER_ID = 1;
  const ATTACKER_ID = 2;
  const NOTIFICATION_ID = 42;

  beforeEach(async () => {
    updateMany = jest.fn();
    findUnique = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: {
            notification: { updateMany, findUnique },
          },
        },
        { provide: ExpoPushService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
  });

  it('označava vlastitu notifikaciju i filtrira po id+userId', async () => {
    const own = { id: NOTIFICATION_ID, userId: OWNER_ID, isRead: true };
    updateMany.mockResolvedValueOnce({ count: 1 });
    findUnique.mockResolvedValueOnce(own);

    const result = await service.markAsRead(NOTIFICATION_ID, OWNER_ID);

    expect(updateMany).toHaveBeenCalledTimes(1);
    // Ključna asertacija: oba uslova moraju biti u istom atomskom upitu.
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: NOTIFICATION_ID, userId: OWNER_ID },
      data: { isRead: true },
    });
    expect(result).toEqual(own);
  });

  it('odbija tuđu notifikaciju i NE mijenja je', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.markAsRead(NOTIFICATION_ID, ATTACKER_ID),
    ).rejects.toThrow(NotFoundException);

    // Upit je morao biti ograničen na napadačev userId — inače bi tuđi zapis
    // bio izmijenjen.
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: NOTIFICATION_ID, userId: ATTACKER_ID },
      data: { isRead: true },
    });
    // Nakon neuspjeha se ne čita i ne vraća tuđi zapis.
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('daje IDENTIČAN odgovor za tuđi i za nepostojeći ID (bez enumeracije)', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    // Napadač ne smije moći razlikovati "postoji ali nije tvoje" od "ne postoji".
    const otherUser = service.markAsRead(NOTIFICATION_ID, ATTACKER_ID).then(
      () => 'resolved',
      (e: unknown) =>
        `${(e as Error).constructor.name}:${(e as Error).message}`,
    );
    const missing = service.markAsRead(999999, ATTACKER_ID).then(
      () => 'resolved',
      (e: unknown) =>
        `${(e as Error).constructor.name}:${(e as Error).message}`,
    );

    const [a, b] = await Promise.all([otherUser, missing]);
    expect(a).toBe(b);
    expect(a).toBe('NotFoundException:Notification not found');
  });

  it('nije ranjiv na stari obrazac: ne postoji put koji ažurira bez userId', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.markAsRead(NOTIFICATION_ID, ATTACKER_ID),
    ).rejects.toThrow(NotFoundException);

    const where = updateMany.mock.calls[0][0].where;
    expect(where).toHaveProperty('userId');
    expect(where.userId).toBe(ATTACKER_ID);
  });
});
