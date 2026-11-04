import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Globalni enableImplicitConversion ne smije pretvoriti ne-string u string prije
// @IsString; originalni tip mora ostati vidljiv validatoru.
const preserveRawInput = ({ obj, key }: TransformFnParams) =>
  obj[key] as unknown;

const normalizeProfileUsername = (params: TransformFnParams) => {
  const value = preserveRawInput(params);
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
};

export class UpdateUserDto {
  @ApiPropertyOptional()
  @Transform(preserveRawInput)
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message:
      'Username may only contain letters, numbers, underscore, dot, and dash',
  })
  @Transform(normalizeProfileUsername)
  username?: string;

  @ApiPropertyOptional()
  @Transform(preserveRawInput)
  @IsOptional()
  @IsString()
  homeLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional()
  @Transform(preserveRawInput)
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional()
  @Transform(preserveRawInput)
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @Transform(preserveRawInput)
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  prefersDarkMode?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  gasPriceExVat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  gasPriceEffectiveFrom?: string;
}
