import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

// Globalni enableImplicitConversion ne smije pretvoriti ne-string u string prije
// @IsString; originalni tip tokena mora ostati vidljiv validatoru.
const preserveRawInput = ({ obj, key }: TransformFnParams) =>
  obj[key] as unknown;

export class RegisterDeviceDTO {
  @Transform(preserveRawInput)
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  expoPushToken: string;

  @IsEnum(['android', 'ios'])
  platform: 'android' | 'ios';

  // Older mobile builds omit this field; the server treats those as PHONE.
  @IsOptional()
  @IsEnum(['PHONE', 'TV'])
  kind?: 'PHONE' | 'TV';
}
