import { PrismaService } from '../../prisma/prisma.service';
import { databaseIsReady } from '../database-health';

function prismaWith(queryRaw: jest.Mock): Pick<PrismaService, '$queryRaw'> {
  return { $queryRaw: queryRaw };
}

describe('databaseIsReady (OBS-1)', () => {
  it('returns true when SELECT 1 succeeds', async () => {
    const queryRaw = jest.fn().mockResolvedValue([1]);

    await expect(databaseIsReady(prismaWith(queryRaw))).resolves.toBe(true);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns false without exposing a database error', async () => {
    const queryRaw = jest
      .fn()
      .mockRejectedValue(new Error('synthetic connection details'));

    await expect(databaseIsReady(prismaWith(queryRaw))).resolves.toBe(false);
  });

  it('returns false within the configured bound when the query hangs', async () => {
    const queryRaw = jest.fn().mockReturnValue(new Promise(() => undefined));

    await expect(databaseIsReady(prismaWith(queryRaw), 5)).resolves.toBe(false);
  });
});
