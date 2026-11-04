import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

// Globalni enableImplicitConversion ne smije pretvoriti ne-string u string prije
// @IsString; originalni tip lozinke mora ostati vidljiv validatoru.
const preserveRawInput = ({ obj, key }: TransformFnParams) =>
  obj[key] as unknown;

export class ChangePasswordDto {
  @Transform(preserveRawInput)
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @Transform(preserveRawInput)
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
