import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  HomeProfile_insulationType,
  HomeProfile_windowType,
  HomeProfile_heatingType,
  SeasonMode,
} from 'src/generated/prisma';
import { BOILER_FAMILY_IDS } from '../../BoilerCatalog/boiler-catalog';

// Globalni enableImplicitConversion ne smije promijeniti raw JSON tip prije validacije.
const preserveRawInput = ({ obj, key }: TransformFnParams) => obj[key];

export class CreateHomeProfileDto {
  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  homeName?: string;

  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  location?: string;

  @Transform(preserveRawInput)
  @IsNumber()
  @Min(10)
  @Max(2000)
  floorArea: number;

  @Transform(preserveRawInput)
  @IsNumber()
  @Min(1.8)
  @Max(5)
  ceilingHeight: number;

  @IsEnum(HomeProfile_insulationType)
  insulationType: HomeProfile_insulationType;

  @Transform(preserveRawInput)
  @IsNumber()
  @Min(5)
  @Max(30)
  insulationThickness: number;

  @IsEnum(HomeProfile_windowType)
  windowType: HomeProfile_windowType;

  @IsEnum(HomeProfile_heatingType)
  heatingType: HomeProfile_heatingType;

  @Transform(preserveRawInput)
  @IsInt()
  @Min(1900)
  @Max(2100)
  constructionYear: number;

  @IsOptional()
  @Transform(preserveRawInput)
  @IsInt()
  @Min(1)
  @Max(20)
  numberOfResidents?: number;

  /**
   * Zapis iz kataloga bojlera (`19` §1). Slobodan tekst je zamijenjen
   * katalogom, jer se iz teksta ne može znati jesu li grijanje i PTV odvojeni
   * — a o tome zavisi smije li se polazna savjetovati snižavati.
   */
  @IsOptional()
  @Transform(preserveRawInput)
  @IsIn(BOILER_FAMILY_IDS as string[])
  boilerCatalogId?: string;

  /**
   * Snaga odabrane izvedbe, iz `outputsKw` te porodice u katalogu.
   *
   * Namjerno **nije** slobodan broj: dopušten je samo onaj koji katalog
   * navodi za odabranu porodicu (`HomeProfileService.validateBoilerSelection`).
   * Slobodan broj bi izgledao kao potvrda proizvođača, a bio bi unos.
   */
  @IsOptional()
  @Transform(preserveRawInput)
  @IsNumber()
  @Min(3)
  @Max(40)
  boilerOutputKw?: number;

  /**
   * @deprecated Zamijenjeno sa `boilerCatalogId`. Prima se još samo da stari
   * klijenti ne puknu; **nijedna odluka se na njega ne oslanja**.
   */
  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  @MaxLength(100)
  boilerModel?: string;

  @Transform(preserveRawInput)
  @IsBoolean()
  hasFloorHeating: boolean;

  /**
   * Najviša polazna koju sistem dozvoljava (`19` §2). Opciono: bez nje se
   * koristi granica kotla. Raspon je isti kao za predlog — 30–55 — jer polje
   * ne smije proširiti ono što je već zaključano.
   */
  @IsOptional()
  @Transform(preserveRawInput)
  @IsNumber()
  @Min(30)
  @Max(55)
  maxHeatingFlowC?: number;

  /**
   * Donja granica polazne za **ovaj** dom (`F13`).
   *
   * Postoji jer je 48 bila tvrda i u klijentu i u servisu: motor je predlagao
   * 46 °C (fizički izvodljivo za taj kotao), a unos je odbijao sve ispod 48.
   * Granica je fizička i zavisi od kotla i načina grijanja, pa pripada domu.
   *
   * Raspon je isti kao apsolutni (30–55) — polje samo **sužava**, nikad ne
   * proširuje ono što `flow-bounds.ts` već zaključava.
   */
  @IsOptional()
  @Transform(preserveRawInput)
  @IsNumber()
  @Min(30)
  @Max(55)
  minHeatingFlowC?: number;

  @Transform(preserveRawInput)
  @IsNumber()
  @Min(5)
  @Max(30)
  targetMorningTemp: number;

  @Transform(preserveRawInput)
  @IsNumber()
  @Min(5)
  @Max(30)
  targetDayTemp: number;

  @Transform(preserveRawInput)
  @IsNumber()
  @Min(5)
  @Max(30)
  targetNightTemp: number;

  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  preferredScheduleNotes?: string;

  @IsOptional()
  @IsEnum(SeasonMode)
  seasonMode?: SeasonMode;
}
