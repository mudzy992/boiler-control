import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { NotificationType } from 'src/generated/prisma';

export class CreateNotificationDTO {
  @IsNumber()
  userId: number;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  data?: any;
}
