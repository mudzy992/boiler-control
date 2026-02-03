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
  InsulationType,
  WindowType,
  HeatingType,
  SeasonMode,
} from 'src/generated/prisma/enums';

export class CreateHomeProfileDto {
  @IsOptional()
  @IsString()
  homeName?: string;

  @IsNumber()
  @Min(10)
  @Max(2000)
  floorArea: number;

  @IsNumber()
  @Min(1.8)
  @Max(5)
  ceilingHeight: number;

  @IsEnum(InsulationType)
  insulationType: InsulationType;

  @IsNumber()
  @Min(5)
  @Max(30)
  insulationThickness: number;

  @IsEnum(WindowType)
  windowType: WindowType;

  @IsEnum(HeatingType)
  heatingType: HeatingType;

  @IsInt()
  @Min(1900)
  @Max(2100)
  constructionYear: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  numberOfResidents?: number;

  @IsOptional()
  @IsString()
  boilerModel?: string;

  @IsBoolean()
  hasFloorHeating: boolean;

  @IsNumber()
  @Min(5)
  @Max(30)
  targetMorningTemp: number;

  @IsNumber()
  @Min(5)
  @Max(30)
  targetDayTemp: number;

  @IsNumber()
  @Min(5)
  @Max(30)
  targetNightTemp: number;

  @IsOptional()
  @IsString()
  preferredScheduleNotes?: string;

  @IsOptional()
  @IsEnum(SeasonMode)
  seasonMode?: SeasonMode;
}
