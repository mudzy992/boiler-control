import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  isGasStrictValidationEnabled,
  parseStrictBoolean,
} from '../../../common/gas-input';

/**
 * PATCH `/api/gas/reading/:id/reference`.
 *
 * B-015: stari `@Transform(({ value }) => value === true || value === 'true')`
 * je gledao već implicitno konvertovanu vrijednost, pa je string `'false'`
 * postajao `true` (jer `Boolean('false')` === true). Sada se čita SIROVA
 * vrijednost iz `obj[key]` i parsira strogo.
 *
 * `isReference` je obavezno polje (nema `@IsOptional`), pa `null`/`undefined`
 * i dalje odbija `@IsBoolean()` s 400 — ranije je `null` tiho postajao
 * `false`.
 */
export class UpdateGasReferenceDto {
  @ApiProperty({
    description:
      'Da li je ovo očitanje referentno za mjesečni obračun. Prima boolean ili string "true"/"false"; sve ostalo se odbija s 400.',
    example: true,
  })
  @IsBoolean()
  @Transform(({ value, obj, key }) => {
    if (!isGasStrictValidationEnabled()) {
      // Rollback put: identično starom ponašanju.
      return value === true || value === 'true';
    }
    // `obj` je izvorni plain objekt, pa `obj[key]` daje vrijednost PRIJE
    // implicitne konverzije — jedini način da se `'false'` razlikuje od
    // `true`.
    return parseStrictBoolean((obj as Record<string, unknown>)[key]);
  })
  isReference: boolean;
}
