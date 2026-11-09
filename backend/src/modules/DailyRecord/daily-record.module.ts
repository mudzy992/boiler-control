import { Module } from '@nestjs/common';
import { WeatherModule } from '../Weather/weather.module';
import { HomeModelModule } from '../HomeModel/home-model.module';
import { DailyRecordWriter } from './daily-record.writer';
import { DailyOutcomeService } from './daily-outcome.service';
import { ProposalShadowService } from './proposal-shadow.service';
import { ShadowReportService } from './shadow-report.service';
import { ShadowReportController } from './shadow.report.controller';

/**
 * Dnevni zapis (`17` §13 koraci 1, 5 i 6). Tri pisca, sva tri namjerno i sva
 * tri sa svojim kolonama:
 *
 * - `DailyRecordWriter` — predlog u 06:00, zamrznut;
 * - `DailyOutcomeService` — samo mjerna polja, poslije ponoći;
 * - `ProposalShadowService` — shadow odluka kontrolera, uz predlog, bez uticaja
 *   na njega. Nijedan drugi modul ne piše `DailyRecord`.
 * - `ShadowReportService` — **čita** shadow kolone i pravi izvještaj (`24` §6.5).
 */
@Module({
  imports: [WeatherModule, HomeModelModule],
  controllers: [ShadowReportController],
  providers: [
    DailyRecordWriter,
    DailyOutcomeService,
    ProposalShadowService,
    ShadowReportService,
  ],
  exports: [DailyRecordWriter, DailyOutcomeService, ProposalShadowService],
})
export class DailyRecordModule {}
