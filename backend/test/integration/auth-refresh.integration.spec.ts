import { UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RefreshTokenService } from '../../src/modules/Auth/refresh-token.service';

/**
 * SEC-4: stvarni Prisma/PostgreSQL dokaz rotacije i reuse detekcije.
 *
 * Ovo je servisni, ne HTTP/browser test. Token vrijednosti se ne ispisuju.
 */
describe('Integration: SEC-4 refresh token rotation', () => {
  let prisma: PrismaService;
  let firstService: RefreshTokenService;
  let secondService: RefreshTokenService;
  let ownerId: number;
  let otherId: number;
  const userIds: number[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    firstService = new RefreshTokenService(prisma);
    secondService = new RefreshTokenService(prisma);
    const suffix = randomUUID();
    const owner = await prisma.user.create({
      data: {
        email: `sec4-owner-${suffix}@example.test`,
        username: `sec4-owner-${suffix}`,
        passwordHash: 'synthetic-not-a-real-hash',
      },
    });
    const other = await prisma.user.create({
      data: {
        email: `sec4-other-${suffix}@example.test`,
        username: `sec4-other-${suffix}`,
        passwordHash: 'synthetic-not-a-real-hash',
      },
    });
    ownerId = owner.id;
    otherId = other.id;
    userIds.push(ownerId, otherId);
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
  });

  afterAll(async () => {
    if (prisma) {
      if (userIds.length) {
        await prisma.refreshToken.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      await prisma.$disconnect();
    }
  });

  it('sequential reuse opoziva sve vlasnikove sesije, ali ne i tuđe', async () => {
    const original = await firstService.issue(ownerId);
    await firstService.rotate(original.token);
    await firstService.issue(otherId);

    await expect(secondService.rotate(original.token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const ownerRows = await prisma.refreshToken.findMany({
      where: { userId: ownerId },
    });
    expect(ownerRows).toHaveLength(2);
    expect(ownerRows.every((row) => row.revokedAt !== null)).toBe(true);
    expect(
      await prisma.refreshToken.count({
        where: { userId: otherId, revokedAt: null },
      }),
    ).toBe(1);
  });

  it('konkurentna rotacija ima jedan claim i ne ostavlja dva aktivna nasljednika', async () => {
    const original = await firstService.issue(ownerId);
    await firstService.issue(otherId);

    // Oba stvarna DB čitanja završe prije nego što ijedan poziv smije nastaviti
    // prema updateu. Tako test ne ovisi o slučajnom redoslijedu HTTP zahtjeva.
    const delegate = prisma.refreshToken;
    const originalFindUnique = delegate.findUnique.bind(delegate);
    let arrivals = 0;
    let releaseReads!: () => void;
    const bothReads = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });
    const findUniqueMock = jest.fn(
      async (args: Parameters<typeof originalFindUnique>[0]) => {
        const row = await originalFindUnique(args);
        arrivals += 1;
        if (arrivals === 2) releaseReads();
        await bothReads;
        return row;
      },
    );
    const findUniqueSpy = jest
      .spyOn(delegate, 'findUnique')
      // PrismaPromise ima nominalni tip koji Jest mock ne može direktno
      // izraziti; stvarni poziv i rezultat i dalje idu kroz originalni delegate.
      .mockImplementation(findUniqueMock as never);

    try {
      const results = await Promise.allSettled([
        firstService.rotate(original.token),
        secondService.rotate(original.token),
      ]);

      expect(results.map((result) => result.status).sort()).toEqual([
        'fulfilled',
        'rejected',
      ]);
      const rejected = results.find((result) => result.status === 'rejected');
      expect(rejected?.status).toBe('rejected');
      if (rejected?.status === 'rejected') {
        expect(rejected.reason).toBeInstanceOf(UnauthorizedException);
      }

      const ownerRows = await prisma.refreshToken.findMany({
        where: { userId: ownerId },
      });
      expect(ownerRows).toHaveLength(2);
      // Reuse mora opozvati i novi token tog korisnika.
      expect(ownerRows.every((row) => row.revokedAt !== null)).toBe(true);
      expect(
        await prisma.refreshToken.count({
          where: { userId: otherId, revokedAt: null },
        }),
      ).toBe(1);
    } finally {
      findUniqueSpy.mockRestore();
    }
  });
});
