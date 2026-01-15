import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { BoilerService } from '../Boiler/boiler.service';
import { WeatherModule } from '../Weather/weather.module';

@Module({
  imports: [WeatherModule],
  controllers: [DashboardController],
  providers: [DashboardService, PrismaService, BoilerService],
})
export class DashboardModule {}
