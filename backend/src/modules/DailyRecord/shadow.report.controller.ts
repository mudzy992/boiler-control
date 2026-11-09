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
  ShadowReportService,
  type ShadowReportWindow,
} from './shadow-report.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shadow izvještaj (`24` §6.5). Bez njega bi jedini način da se vidi koliko se
 * odluka razlikuje od formule bio ručni SQL — a od tog broja zavisi da li se
 * odluka pušta korisniku.
 *
 * `GET /api/daily-record/shadow-report?homeProfileId=1&from=2026-11-01&to=2026-11-30`
 */
@ApiTags('Daily record')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/daily-record')
export class ShadowReportController {
  constructor(
    private readonly reports: ShadowReportService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('shadow-report')
  // Opcioni parametri, kao i kod `history` — inače ugovor tvrdi da su obavezni.
  @ApiQuery({ name: 'homeProfileId', required: false, type: Number })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiOkResponse({ description: 'Shadow izvještaj za dom i period' })
  async shadowReport(
    @Req() req,
    @Query('homeProfileId') homeProfileId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const homeId = homeProfileId
      ? Number(homeProfileId)
      : await this.activeHomeProfileId(req.user.userId);

    if (!Number.isInteger(homeId) || homeId <= 0) {
      throw new BadRequestException('homeProfileId mora biti pozitivan cio broj');
    }

    return this.reports.forHome(
      req.user.userId,
      homeId,
      validatedWindow({ from, to }),
    );
  }

  /** Bez `homeProfileId` uzima se aktivni dom korisnika; bez njega nema odgovora. */
  private async activeHomeProfileId(userId: number): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeHomeProfileId: true },
    });

    if (!user?.activeHomeProfileId) {
      throw new BadRequestException(
        'Nema aktivnog doma — pošalji homeProfileId',
      );
    }
    return user.activeHomeProfileId;
  }
}

/** Datumi su `YYYY-MM-DD` jer se tako i čuva `localDate`; `from > to` je greška. */
export function validatedWindow(input: {
  from?: string;
  to?: string;
}): ShadowReportWindow {
  const window: ShadowReportWindow = {};

  for (const [name, value] of [
    ['from', input.from],
    ['to', input.to],
  ] as const) {
    if (value == null || value === '') continue;
    if (!DATE_RE.test(value)) {
      throw new BadRequestException(`${name} mora biti u formatu YYYY-MM-DD`);
    }
    window[name] = value;
  }

  if (window.from && window.to && window.from > window.to) {
    throw new BadRequestException('from ne smije biti poslije to');
  }

  return window;
}
