import { Module } from '@nestjs/common';
import { HomeModelService } from './home-model.service';

/**
 * Model kuće (`17` §13 koraci 3–4). Izvozi servis jer će kontroler (korak 6)
 * čitati `slopeS` iz njega; nijedan drugi modul ga ne piše.
 */
@Module({
  providers: [HomeModelService],
  exports: [HomeModelService],
})
export class HomeModelModule {}
