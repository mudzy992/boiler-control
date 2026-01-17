import { IsEnum, IsString } from 'class-validator';

export class RegisterDeviceDTO {
  @IsString()
  expoPushToken: string;

  @IsEnum(['android', 'ios'])
  platform: 'android' | 'ios';
}
