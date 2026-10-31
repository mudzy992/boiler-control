import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsDateString,
  IsIn,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetHeatingEventsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  homeProfileId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deviceId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hvacAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty()
  @IsDateString()
  from: string;

  @ApiProperty()
  @IsDateString()
  to: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 20;
}

export class GetHeatingStatsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  homeProfileId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deviceId?: number;

  @ApiProperty()
  @IsDateString()
  from: string;

  @ApiProperty()
  @IsDateString()
  to: string;

  @ApiProperty({ enum: ['hour', 'day'] })
  @IsEnum(['hour', 'day'])
  bucket: 'hour' | 'day';
}

export class GetHeatingSummaryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  homeProfileId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deviceId?: number;

  @ApiProperty()
  @IsDateString()
  from: string;

  @ApiProperty()
  @IsDateString()
  to: string;

  @ApiPropertyOptional({ enum: ['hour', 'day'] })
  @IsOptional()
  @IsEnum(['hour', 'day'])
  bucket?: 'hour' | 'day';
}

export class GetLearningTrendsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  homeProfileId: number;

  @ApiProperty()
  @IsDateString()
  from: string;

  @ApiProperty()
  @IsDateString()
  to: string;
}

export class ExportAnalyticsDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  homeProfileId: number;

  @ApiProperty({
    description:
      'V1 prihvata ISO datum; v2 zahtijeva eksplicitan Z ili UTC offset.',
  })
  @IsDateString()
  from: string;

  @ApiProperty({
    description:
      'V1 prihvata ISO datum; v2 zahtijeva eksplicitan Z ili UTC offset.',
  })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({ enum: ['hour', 'day'], default: 'day' })
  @IsOptional()
  @IsEnum(['hour', 'day'])
  bucket?: 'hour' | 'day';

  @ApiPropertyOptional({
    enum: [1, 2],
    default: 1,
    description: 'V2 je opt-in i traži ANALYTICS_EXPORT_V2_ENABLED=on.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  version?: 1 | 2;

  @ApiPropertyOptional({
    enum: ['csv', 'json'],
    default: 'csv',
    description: 'Samo za version=2.',
  })
  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json';

  @ApiPropertyOptional({
    default: 'UTC',
    description: 'IANA vremenska zona, samo za version=2.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timeZone?: string;
}
