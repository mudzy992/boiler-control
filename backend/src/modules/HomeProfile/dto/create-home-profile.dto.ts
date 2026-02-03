import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateHomeProfileDto {
  @IsOptional()
  @IsString()
  homeName?: string;

  @IsNumber()
  @Min(10)
  @Max(2000)
  squareMeters: number;

  @IsString()
  insulationLevel: string;

  @IsString()
  windowQuality: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  numberOfResidents?: number;

  @IsOptional()
  @IsString()
  boilerModel?: string;

  @IsString()
  radiatorType: string;

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
  @IsNumber()
  ceilingHeight?: number;

  @IsOptional()
  @IsNumber()
  insulationThickness?: number;

  @IsOptional()
  @IsNumber()
  constructionYear?: number;

  @IsOptional()
  @IsNumber()
  floorArea?: number;

  @IsOptional()
  @IsString()
  insulationType?: string;

  @IsOptional()
  @IsString()
  windowType?: string;

  @IsOptional()
  @IsString()
  heatingType?: string;
}
