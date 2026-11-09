import { Module } from '@nestjs/common';
import { WeatherModule } from '../Weather/weather.module';
import { DailyRecordWriter } from './daily-record.writer';
import { DailyOutcomeService } from './daily-outcome.service';

/**
 * Dnevni zapis (`17` §13 koraci 1 i 5). Izvoze se dva pisca, oba namjerno:
 * `DailyRecordWriter` piše predlog u 06:00, `DailyOutcomeService` piše samo
 * mjerna polja poslije ponoći. Nijedan drugi modul ne piše `DailyRecord`.
 */
@Module({
  imports: [WeatherModule],
  providers: [DailyRecordWriter, DailyOutcomeService],
  exports: [DailyRecordWriter, DailyOutcomeService],
})
export class DailyRecordModule {}
