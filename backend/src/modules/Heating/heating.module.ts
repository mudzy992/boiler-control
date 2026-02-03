import { Module } from '@nestjs/common';
import { HeatingController } from './heating.controller';
import { HeatingService } from './heating.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HeatingController],
  providers: [HeatingService],
})
export class HeatingModule {}
