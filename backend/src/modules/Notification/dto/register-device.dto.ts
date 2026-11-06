import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

// Globalni enableImplicitConversion ne smije pretvoriti ne-string u string prije
// @IsString; originalni tip tokena mora ostati vidljiv validatoru.
const preserveRawInput = ({ obj, key }: TransformFnParams) =>
  obj[key] as unknown;

export class RegisterDeviceDTO {
  @Transform(preserveRawInput)
  @IsString()
  @IsNotEmpty()
  expoPushToken: string;

  @IsEnum(['android', 'ios'])
  platform: 'android' | 'ios';
}
