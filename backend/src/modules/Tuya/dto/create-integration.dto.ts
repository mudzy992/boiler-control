// src/modules/Tuya/dto/create-integration.dto.ts
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateIntegrationDto {
  @IsString()
  @IsNotEmpty()
  vendor: string; // npr. 'TUYA'

  @IsString()
  @IsNotEmpty()
  userCode: string; // user code koji dobiješ iz Smart Life / Tuya app

  @IsNumber()
  @IsNotEmpty()
  userId: number; // obavezno
}
