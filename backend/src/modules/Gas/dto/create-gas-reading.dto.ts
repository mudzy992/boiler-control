import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  isGasStrictValidationEnabled,
  parseStrictBoolean,
  parseStrictCounterValue,
} from '../../../common/gas-input';

/**
 * POST `/api/gas/reading` (JSON ili multipart).
 *
 * B-016: `Number('')` je `0`, pa je prazan `counterValue` prolazio kao
 * očitanje 0 m3 i upisivao se u bazu. Negativan prvi unos je također
 * prolazio jer nije bilo `@Min(0)`.
 *
 * String ulaz je LEGITIMAN i mora ostati podržan: oba klijenta šalju
 * `counterValue` kroz multipart kao string
 * (`frontend/src/services/api.ts:149`,
 *  `mobile/src/services/api/client.ts:152`). Zato se i dalje parsira
 * `Number`, samo se prazan/whitespace i `NaN`/`Infinity` više ne
 * progutaju.
 */
export class CreateGasReadingDto {
  @ApiProperty({ description: 'Stanje brojila u m3', example: 12345.67 })
  @IsNumber()
  @IsNotEmpty()
  // `@Min(0)` se primjenjuje samo u strogom načinu, da rollback put ostane
  // doslovno staro ponašanje.
  @ValidateIf(() => isGasStrictValidationEnabled())
  @Min(0)
  @Transform(({ value, obj, key }) => {
    if (!isGasStrictValidationEnabled()) {
      // Rollback put: identično starom ponašanju (`Number('')` -> 0).
      return Number(value);
    }
    // Sirova vrijednost iz `obj[key]` — vidi napomenu u `common/gas-input.ts`
    // o tome zašto `value` nije pouzdan kad je `enableImplicitConversion`
    // uključen.
    return parseStrictCounterValue((obj as Record<string, unknown>)[key]);
  })
  counterValue: number;

  @ApiProperty({
    description: 'Datum očitavanja',
    example: '2023-10-27T10:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  readingDate: string;

  /**
   * OTVORENI NALAZ (nije dio FEAT-7): servis pri kreiranju NAMJERNO ne čita
   * ovo polje — `gas.reading.service.ts:59-67` upisuje
   * `isInvoiceReference: false, referenceMonth: null` bez obzira na ulaz, pa
   * je polje trenutno inertno. Referentnost se postavlja isključivo kroz
   * PATCH `/api/gas/reading/:id/reference`.
   *
   * Polje se NE uklanja iz DTO-a: globalni pipe ima
   * `forbidNonWhitelisted: true` (`main.ts:32`), pa bi uklanjanje značilo da
   * svaki klijent koji ga pošalje dobije 400 — to bi bila nekompatibilna
   * promjena za nepoznate/starije mobilne verzije. Umjesto toga se barem
   * parsira strogo, da ne dijeli B-015 bug.
   *
   * Verificirano: nijedan poznati potrošač ga ne šalje
   * (`api.ts:144-150`, `client.ts:141-152` šalju samo `counterValue` i
   * `readingDate`).
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value, obj, key }) => {
    if (!isGasStrictValidationEnabled()) {
      return value === true || value === 'true';
    }
    return parseStrictBoolean((obj as Record<string, unknown>)[key]);
  })
  markAsReference?: boolean;
}
