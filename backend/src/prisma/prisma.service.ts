import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly hasDb: boolean;

  constructor() {
    const poolSize = Number(process.env.DATABASE_POOL_SIZE) || 10;

    const hasDb = !!(
      process.env.DATABASE_HOST &&
      process.env.DATABASE_USER &&
      process.env.DATABASE_PASSWORD &&
      process.env.DATABASE_NAME
    );

    if (hasDb) {
      const connectTimeout =
        Number(process.env.DATABASE_CONNECT_TIMEOUT_MS) || 5000;
      super({
        adapter: new PrismaPg({
          host: process.env.DATABASE_HOST!,
          port: Number(process.env.DATABASE_PORT) || 5432,
          user: process.env.DATABASE_USER!,
          password: process.env.DATABASE_PASSWORD!,
          database: process.env.DATABASE_NAME!,
          max: poolSize,
          connectionTimeoutMillis: connectTimeout,
        }),
      });
    } else {
      // Create PrismaClient without adapter to avoid attempting DB ops when env is missing
      // PrismaClient constructor expects an options argument; pass an empty object.
      super({} as any);
    }

    // Now it's safe to assign to `this`
    this.hasDb = hasDb;
  }

  async onModuleInit(): Promise<void> {
    // If DB env is missing or explicit skip flag set, avoid connecting during tests
    if (!this.hasDb || process.env.SKIP_DB_CONNECT === '1') {
      return;
    }

    // Attempt to connect and surface any immediate connection errors
    try {
      await this.$connect();
    } catch (err) {
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
