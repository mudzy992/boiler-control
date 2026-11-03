import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { NotificationType } from 'src/generated/prisma';

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
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional({ type: Object, additionalProperties: true })
  @IsOptional()
  data?: any;
}
