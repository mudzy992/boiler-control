import { Controller, Get, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WeatherService } from './weather.service';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '../Auth/user.decorator';

/**
 * Weather Controller (P2a)
 * Provides endpoints for weather data
 * Full implementation deferred to later phases
 */
@ApiTags('Weather')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/weather')
export class WeatherController {
  constructor(
    private readonly weatherService: WeatherService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get weather data for the authenticated user
   */
  @Get()
  getWeatherData() {
    // Stub: return empty object or null
    // Full implementation: fetch from weather service and return current/forecast
    return {};
  }

  /**
   * Get current weather for a home profile
   */
  @Get('current/:homeProfileId')
  async getCurrentWeather(
    @User() userId: number,
    @Param('homeProfileId') homeProfileId: string,
  ) {
    const profile = await this.prisma.homeProfile.findFirst({
      where: { id: Number(homeProfileId), userId },
      select: { location: true },
    });

    if (!profile?.location) {
      return null;
    }

    return this.weatherService.getTodayWeather(profile.location);
  }
}
