import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReadonlyService } from './readonly.service';
import { ReadonlyController } from './readonly.controller';

@Module({
  controllers: [ReadonlyController],
  providers: [ReadonlyService, PrismaService],
})
export class ReadonlyModule {}
