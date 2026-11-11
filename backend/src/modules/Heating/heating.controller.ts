import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiQuery } from '@nestjs/swagger';
import {
  parsePage,
  setTotalCount,
  TOTAL_COUNT_HEADER,
} from '../../common/pagination';
import { throwIfStubRejected } from '../../common/stub-endpoint';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HeatingService } from './heating.service';
import { CreateHeatingEventDto } from './dto/create-heating-event.dto';

/**
 * Heating Events Controller (P2a)
 * Provides endpoints for managing heating events
 */
@ApiTags('Heating Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/heating-events')
export class HeatingController {
  constructor(private heatingService: HeatingService) {}

  /**
   * Create a heating event (manual creation for testing)
   */
  @Post()
  createHeatingEvent(@Req() req, @Body() body: CreateHeatingEventDto) {
    // API-1 / B-001: ovo je bio stub koji je vraćao IZMIŠLJENI
    // `Math.floor(Math.random() * 10000)` ID i NIŠTA nije upisivao u bazu —
    // klijent je mislio da je zapis kreiran. Potrošači su verificirani:
    // nijedan `.post()` u frontend/ ni mobile/ ne zove heating-events.
    // `legacy` režim vraća staro ponašanje kao rollback put.
    throwIfStubRejected('POST /api/heating-events');

    return {
      id: Math.floor(Math.random() * 10000),
      deviceId: body.deviceId,
      timestampStart: new Date().toISOString(),
      roomCurrentTemp: body.roomCurrentTemp,
      roomTargetTemp: body.roomTargetTemp,
      roomFlowTemp: body.roomFlowTemp,
      userId: req.user.userId,
    };
  }

  /**
   * Događaji grijanja za prijavljenog korisnika — straničeno (`36`).
   *
   * Ugovor: niz u tijelu + ukupan broj u `X-Total-Count`, isto kao
   * `/gas/readings` i `/recommendations`.
   */
  @Get()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'deviceId', required: false, type: Number })
  async getHeatingEvents(
    @Req() req,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('deviceId') deviceId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const page = parsePage(
      { limit, offset },
      { defaultLimit: 50, maxLimit: 500 },
    );
    const { rows, total } = await this.heatingService.getHeatingEvents(
      req.user.userId,
      {
        ...page,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        deviceId: deviceId ? Number(deviceId) : undefined,
      },
    );
    setTotalCount(res, total);
    return rows;
  }
}
