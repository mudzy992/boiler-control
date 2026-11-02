import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const DATABASE_READINESS_TIMEOUT_MS = 1000;

type DatabaseQuery = Pick<PrismaService, '$queryRaw'>;

/**
 * OBS-1: bounded readiness probe. Errors stay at this boundary and are never
 * exposed through the public health response.
 */
export async function databaseIsReady(
  prisma: DatabaseQuery,
  timeoutMs = DATABASE_READINESS_TIMEOUT_MS,
): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;

  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Database readiness timeout')),
        timeoutMs,
      );
    });

    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Injectable()
export class DatabaseHealthService {
  constructor(private readonly prisma: PrismaService) {}

  isReady(): Promise<boolean> {
    return databaseIsReady(this.prisma);
  }
}
