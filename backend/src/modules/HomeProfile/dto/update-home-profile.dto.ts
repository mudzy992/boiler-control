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

export class UpdateHomeProfileDto {
  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  homeName?: string;

  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(2000)
  floorArea?: number;

  @IsOptional()
  @IsNumber()
  @Min(1.8)
  @Max(5)
  ceilingHeight?: number;

  @IsOptional()
  @IsEnum(HomeProfile_insulationType)
  insulationType?: HomeProfile_insulationType;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(30)
  insulationThickness?: number;

  @IsOptional()
  @IsEnum(HomeProfile_windowType)
  windowType?: HomeProfile_windowType;

  @IsOptional()
  @IsEnum(HomeProfile_heatingType)
  heatingType?: HomeProfile_heatingType;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  constructionYear?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  numberOfResidents?: number;

  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  boilerModel?: string;

  @IsOptional()
  @IsBoolean()
  hasFloorHeating?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(30)
  targetMorningTemp?: number;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(30)
  targetDayTemp?: number;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(30)
  targetNightTemp?: number;

  @IsOptional()
  @Transform(preserveRawInput)
  @IsString()
  preferredScheduleNotes?: string;

  @IsOptional()
  @IsEnum(SeasonMode)
  seasonMode?: SeasonMode;
}
