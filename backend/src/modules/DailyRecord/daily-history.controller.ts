import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DailyHistoryService,
  MAX_HISTORY_ROWS,
} from './daily-history.service';
import { validatedWindow } from './shadow.report.controller';

/**
 * Historija dnevnih zapisa (`31`, `32`).
 *
 * `GET /api/daily-record/history?homeProfileId=1&from=2026-01-01&to=2026-11-08&limit=60`
 *
 * Svaki red kaže odakle je (`origin`: `LIVE` ili `BACKFILL`) i koje grupe
 * mjerenja stvarno nosi. Bez toga bi rekonstruisan dan izgledao kao izmjeren.
 */
@ApiTags('Daily record')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/daily-record')
export class DailyHistoryController {
  constructor(
    private readonly history: DailyHistoryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('history')
  // Svi parametri su opcioni: bez `homeProfileId` uzima se aktivni dom, bez
  // perioda cijela historija, bez `limit` 60. Generator bi ih bez ovoga proglasio
  // obaveznim, pa bi ugovor tvrdio nešto što server ne traži.
  @ApiQuery({ name: 'homeProfileId', required: false, type: Number })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ description: 'Dnevni zapisi za dom i period, sa porijeklom' })
  async dailyHistory(
    @Req() req,
    @Query('homeProfileId') homeProfileId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const homeId = homeProfileId
      ? Number(homeProfileId)
      : await this.activeHomeProfileId(req.user.userId);

    if (!Number.isInteger(homeId) || homeId <= 0) {
      throw new BadRequestException('homeProfileId mora biti pozitivan cio broj');
    }

    return this.history.forHome(req.user.userId, homeId, {
      ...validatedWindow({ from, to }),
      limit: validatedLimit(limit),
    });
  }

  private async activeHomeProfileId(userId: number): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeHomeProfileId: true },
    });

    if (!user?.activeHomeProfileId) {
      throw new BadRequestException('Nema aktivnog doma — pošalji homeProfileId');
    }
    return user.activeHomeProfileId;
  }
}

/** `limit` je opcija, ali mora biti cijeli broj u granicama odgovora. */
export function validatedLimit(raw?: string): number {
  if (raw == null || raw === '') return 60;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > MAX_HISTORY_ROWS) {
    throw new BadRequestException(
      `limit mora biti cijeli broj 1..${MAX_HISTORY_ROWS}`,
    );
  }
  return value;
}
