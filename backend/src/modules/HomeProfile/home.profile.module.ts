import { Module } from '@nestjs/common';
import {
  HomeProfileController,
  HomeProfileSingleController,
} from './home.profile.controller';
import { HomeProfileService } from './home.profile.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HomeProfileController, HomeProfileSingleController],
  providers: [HomeProfileService],
})
export class HomeProfileModule {}
