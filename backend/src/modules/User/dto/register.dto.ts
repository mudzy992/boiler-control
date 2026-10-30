// src/User/dto/register.dto.ts
import { Transform } from 'class-transformer';
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
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

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
