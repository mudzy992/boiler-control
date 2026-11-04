import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Globalni enableImplicitConversion ne smije promijeniti raw JSON tip prije
// validacije; originalni tip mora ostati vidljiv validatoru.
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

  @ApiPropertyOptional({
    description: 'Required when password is provided.',
  })
  @Transform(preserveRawInput)
  @ValidateIf((dto) => dto.password !== undefined)
  @IsString()
  @IsNotEmpty()
  currentPassword?: string;

  @ApiPropertyOptional()
  @Transform(preserveRawInput)
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
  @Transform(preserveRawInput)
  @IsOptional()
  @IsBoolean()
  prefersDarkMode?: boolean;

  @ApiPropertyOptional()
  @Transform(preserveRawInput)
  @IsOptional()
  @IsNumber()
  @Min(0)
  gasPriceExVat?: number;

  @ApiPropertyOptional()
  @Transform(preserveRawInput)
  @IsOptional()
  @IsDateString()
  gasPriceEffectiveFrom?: string;
}
