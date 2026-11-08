import { Module } from '@nestjs/common';
import { WeatherModule } from '../Weather/weather.module';
import { DailyRecordWriter } from './daily-record.writer';

/**
 * Dnevni zapis (`17` §13 korak 1). Izvozi samo pisca: nijedan drugi modul ne
 * smije pisati `DailyRecord`, pa se i ne izlaže ništa osim njega.
 */
@Module({
  imports: [WeatherModule],
  providers: [DailyRecordWriter],
  exports: [DailyRecordWriter],
})
export class DailyRecordModule {}
