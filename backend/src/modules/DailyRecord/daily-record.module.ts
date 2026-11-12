import { Module } from '@nestjs/common';
import { WeatherModule } from '../Weather/weather.module';
import { HomeModelModule } from '../HomeModel/home-model.module';
import { ProposalInputsService } from './proposal-inputs.service';
import { DailyRecordWriter } from './daily-record.writer';
import { DailyOutcomeService } from './daily-outcome.service';
import { ProposalShadowService } from './proposal-shadow.service';
import { ShadowReportService } from './shadow-report.service';
import { ShadowReportController } from './shadow.report.controller';
import { DailyHistoryService } from './daily-history.service';
import { DailyHistoryController } from './daily-history.controller';

/**
 * Dnevni zapis (`17` §13 koraci 1, 5 i 6). Tri pisca, sva tri namjerno i sva
 * tri sa svojim kolonama:
 *
 * - `DailyRecordWriter` — predlog u 06:00, zamrznut;
 * - `DailyOutcomeService` — samo mjerna polja, poslije ponoći;
 * - `ProposalShadowService` — shadow odluka kontrolera, uz predlog, bez uticaja
 *   na njega. Nijedan drugi modul ne piše `DailyRecord`.
 * - `ShadowReportService` — **čita** shadow kolone i pravi izvještaj (`24` §6.5);
 * - `DailyHistoryService` — **čita** cijeli zapis i kaže odakle je koji red
 *   (`31`): 301 dan je rekonstruisan, i to mora biti vidljivo, ne skriveno.
 */
@Module({
  imports: [WeatherModule, HomeModelModule],
  controllers: [ShadowReportController, DailyHistoryController],
  providers: [
    DailyRecordWriter,
    ProposalInputsService,
    DailyOutcomeService,
    ProposalShadowService,
    ShadowReportService,
    DailyHistoryService,
  ],
  exports: [
    DailyRecordWriter,
    DailyOutcomeService,
    ProposalShadowService,
    ProposalInputsService,
  ],
})
export class DailyRecordModule {}
