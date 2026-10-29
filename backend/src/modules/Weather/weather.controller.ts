import { Controller, Get, UseGuards, Param } from '@nestjs/common';
import { throwIfStubRejected } from '../../common/stub-endpoint';
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
    // API-1 / B-002: `{}` je bilo nerazlučivo od „nema vremenskih podataka".
    // Potrošači su verificirani: frontend/mobile koriste
    // `GET /api/weather/current/:homeProfileId`, a ne ovu rutu.
    throwIfStubRejected('GET /api/weather', {
      alternative: 'GET /api/weather/current/{homeProfileId}',
    });

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
