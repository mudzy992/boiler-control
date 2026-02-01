import { Module } from '@nestjs/common';
import { GasReadingController } from './gas.reading.controller';
import { GasReadingService } from './gas.reading.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GasReadingController],
  providers: [GasReadingService],
  exports: [GasReadingService],
})
export class GasReadingModule {}
