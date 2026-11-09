import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  HomeProfile_insulationType,
  HomeProfile_windowType,
  HomeProfile_heatingType,
  SeasonMode,
} from 'src/generated/prisma';

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

  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
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
