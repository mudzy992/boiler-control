import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsBoolean, IsEnum } from 'class-validator';
import { NotificationType } from 'src/generated/prisma';

// Globalni enableImplicitConversion bi string poput "false" pretvorio u
// boolean prije @IsBoolean. Originalno root polje mora ostati vidljivo validatoru.
const preserveRawInput = ({ obj, key }: TransformFnParams) =>
  obj[key] as unknown;

/** Runtime ulaz za PATCH /api/notifications/preferences. */
export class UpdateNotificationPreferenceDTO {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty()
  @Transform(preserveRawInput)
  @IsBoolean()
  enabled: boolean;
}
