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
  ValidateIf,
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

export class UpdateHomeProfileDto {
  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  homeName?: string;

  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  location?: string;

  @ValidateIf((_dto, value) => value !== undefined)
  @Transform(preserveRawInput)
  @IsNumber()
  @Min(10)
  @Max(2000)
  floorArea?: number;

  @ValidateIf((_dto, value) => value !== undefined)
  @Transform(preserveRawInput)
  @IsNumber()
  @Min(1.8)
  @Max(5)
  ceilingHeight?: number;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsEnum(HomeProfile_insulationType)
  insulationType?: HomeProfile_insulationType;

  @ValidateIf((_dto, value) => value !== undefined)
  @Transform(preserveRawInput)
  @IsNumber()
  @Min(5)
  @Max(30)
  insulationThickness?: number;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsEnum(HomeProfile_windowType)
  windowType?: HomeProfile_windowType;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsEnum(HomeProfile_heatingType)
  heatingType?: HomeProfile_heatingType;

  @ValidateIf((_dto, value) => value !== undefined)
  @Transform(preserveRawInput)
  @IsInt()
  @Min(1900)
  @Max(2100)
  constructionYear?: number;

  @IsOptional()
  @Transform(preserveRawInput)
  @IsInt()
  @Min(1)
  @Max(20)
  numberOfResidents?: number;

  /** Zapis iz kataloga bojlera; `null` briše odabir. */
  @IsOptional()
  @Transform(preserveRawInput)
  @IsIn(BOILER_FAMILY_IDS as string[])
  boilerCatalogId?: string | null;

  /** @deprecated Zamijenjeno sa `boilerCatalogId`; prima se samo zbog starih klijenata. */
  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  @MaxLength(100)
  boilerModel?: string;

  @ValidateIf((_dto, value) => value !== undefined)
  @Transform(preserveRawInput)
  @IsBoolean()
  hasFloorHeating?: boolean;

  /** Najviša polazna koju sistem dozvoljava; `null` je dozvoljeno (briše se). */
  @IsOptional()
  @Transform(preserveRawInput)
  @IsNumber()
  @Min(30)
  @Max(55)
  maxHeatingFlowC?: number | null;

  @IsOptional()
  @Transform(preserveRawInput)
  @IsNumber()
  @Min(5)
  @Max(30)
  targetMorningTemp?: number;

  @IsOptional()
  @Transform(preserveRawInput)
  @IsNumber()
  @Min(5)
  @Max(30)
  targetDayTemp?: number;

  @IsOptional()
  @Transform(preserveRawInput)
  @IsNumber()
  @Min(5)
  @Max(30)
  targetNightTemp?: number;

  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  preferredScheduleNotes?: string;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsEnum(SeasonMode)
  seasonMode?: SeasonMode;
}
