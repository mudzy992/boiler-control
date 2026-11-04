// src/User/dto/register.dto.ts
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Globalni enableImplicitConversion ne smije pretvoriti ne-string u string prije
// @IsString; originalni tip mora ostati vidljiv validatoru.
const preserveRawInput = ({ obj, key }: TransformFnParams) =>
  obj[key] as unknown;

const normalizeRegisterUsername = (params: TransformFnParams) => {
  const value = preserveRawInput(params);
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
};

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message:
      'Username may only contain letters, numbers, underscore, dot, and dash',
  })
  @Transform(normalizeRegisterUsername)
  username: string;

  @Transform(preserveRawInput)
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @Transform(preserveRawInput)
  @IsOptional()
  @IsString()
  name?: string;

  @Transform(preserveRawInput)
  @IsOptional()
  @IsString()
  homeLocation?: string;

  /**
   * SEC-4 (faza 3): isto značenje kao u `LoginDto` — `cookie` (zadano, web)
   * ili `body` (React Native bez browser cookie jar-a).
   */
  @ApiPropertyOptional({ enum: ['cookie', 'body'], default: 'cookie' })
  @IsOptional()
  @IsIn(['cookie', 'body'])
  refreshTransport?: 'cookie' | 'body';
}
