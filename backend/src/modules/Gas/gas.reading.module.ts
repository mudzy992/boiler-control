import { Module } from '@nestjs/common';
import { GasReadingController } from './gas.reading.controller';
import { GasReadingService } from './gas.reading.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [GasReadingController],
  providers: [GasReadingService],
  exports: [GasReadingService],
})
export class GasReadingModule {}
