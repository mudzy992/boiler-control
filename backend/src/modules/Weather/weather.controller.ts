import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { throwIfStubRejected } from '../../common/stub-endpoint';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WeatherService } from './weather.service';
import { WeatherV2Service } from './weather-v2.service';
import { ConfirmWeatherLocationDto } from './dto/confirm-weather-location.dto';
import { WeatherLocationQueryDto } from './dto/weather-location-query.dto';
import {
  ConfirmWeatherLocationResponseDto,
  WeatherLocationCandidatesResponseDto,
  WeatherV2ResponseDto,
} from './dto/weather-v2-response.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '../Auth/user.decorator';
import { PositiveIntPipe } from './positive-int.pipe';

/**
 * Weather Controller (P2a)
 * Provides endpoints for weather data
 */
@ApiTags('Weather')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/weather')
export class WeatherController {
  constructor(
    private readonly weatherService: WeatherService,
    private readonly weatherV2Service: WeatherV2Service,
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
  @ApiParam({ name: 'homeProfileId', schema: { type: 'number', minimum: 1 } })
  async getCurrentWeather(
    @User() userId: number,
    @Param('homeProfileId', PositiveIntPipe) homeProfileId: number,
  ) {
    const profile = await this.prisma.homeProfile.findFirst({
      where: { id: homeProfileId, userId },
      select: { location: true },
    });

    if (!profile?.location) {
      return null;
    }

    return this.weatherService.getTodayWeather(profile.location);
  }

  @Get('v2/current/:homeProfileId')
  @ApiParam({ name: 'homeProfileId', schema: { type: 'number', minimum: 1 } })
  @ApiResponse({ status: 200, type: WeatherV2ResponseDto })
  @ApiResponse({
    status: 503,
    description: 'No forecast or last-good data is available.',
  })
  getCurrentWeatherV2(
    @User() userId: number,
    @Param('homeProfileId', PositiveIntPipe) homeProfileId: number,
  ) {
    return this.weatherV2Service.getWeather(userId, homeProfileId);
  }

  @Get('v2/locations/:homeProfileId')
  @ApiParam({ name: 'homeProfileId', schema: { type: 'number', minimum: 1 } })
  @ApiQuery({ name: 'query', required: true, type: String })
  @ApiResponse({ status: 200, type: WeatherLocationCandidatesResponseDto })
  getWeatherLocationCandidates(
    @User() userId: number,
    @Param('homeProfileId', PositiveIntPipe) homeProfileId: number,
    @Query() query: WeatherLocationQueryDto,
  ) {
    return this.weatherV2Service.getLocationCandidates(
      userId,
      homeProfileId,
      query.query,
    );
  }

  @Post('v2/locations/:homeProfileId/confirm')
  @ApiParam({ name: 'homeProfileId', schema: { type: 'number', minimum: 1 } })
  @HttpCode(200)
  @ApiBody({ type: ConfirmWeatherLocationDto })
  @ApiResponse({ status: 200, type: ConfirmWeatherLocationResponseDto })
  confirmWeatherLocation(
    @User() userId: number,
    @Param('homeProfileId', PositiveIntPipe) homeProfileId: number,
    @Body() dto: ConfirmWeatherLocationDto,
  ) {
    return this.weatherV2Service.confirmLocation(
      userId,
      homeProfileId,
      dto.query,
      dto.candidateId,
    );
  }
}
