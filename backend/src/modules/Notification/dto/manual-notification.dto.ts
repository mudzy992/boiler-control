import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { NotificationType } from 'src/generated/prisma';

// Globalni enableImplicitConversion bi number/object pretvorio u string prije
// @IsString. Vraćanje originalnog root polja zadržava stvarnu provjeru tipa.
const preserveRawInput = ({ obj, key }: TransformFnParams) =>
  obj[key] as unknown;

/** Runtime ulaz za POST /api/notifications/manual. */
export class ManualNotificationDTO {
  /**
   * Legacy klijenti smiju poslati ovo polje, ali controller ga ne čita:
   * primalac je uvijek korisnik iz JWT-a.
   */
  @ApiPropertyOptional({
    description: 'Legacy polje; primalac dolazi isključivo iz JWT-a.',
  })
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty()
  @Transform(preserveRawInput)
  @IsString()
  title: string;

  @ApiProperty()
  @Transform(preserveRawInput)
  @IsString()
  message: string;

  @ApiPropertyOptional({ type: Object, additionalProperties: true })
  @IsOptional()
  data?: any;
}
