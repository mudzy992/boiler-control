import { Module } from '@nestjs/common';
import { HomeProfileController } from './home.profile.controller';
import { HomeProfileService } from './home.profile.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HomeProfileController],
  providers: [HomeProfileService],
})
export class HomeProfileModule {}
