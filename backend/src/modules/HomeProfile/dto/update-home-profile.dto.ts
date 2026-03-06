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
import {
  HomeProfile_insulationType,
  HomeProfile_windowType,
  HomeProfile_heatingType,
  SeasonMode,
} from 'src/generated/prisma';

export class UpdateHomeProfileDto {
  @IsOptional()
  @IsString()
  homeName?: string;

  @IsOptional()
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
  @IsString()
  preferredScheduleNotes?: string;

  @IsOptional()
  @IsEnum(SeasonMode)
  seasonMode?: SeasonMode;
}
