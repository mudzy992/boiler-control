import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  homeLocation?: string;

  @IsString()
  @MinLength(6)
  password?: string;
}
