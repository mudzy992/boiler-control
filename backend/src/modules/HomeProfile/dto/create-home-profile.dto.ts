import { IsNumber, IsString } from 'class-validator';

export class CreateHomeProfileDto {
  @IsNumber()
  floorArea: number;

  @IsNumber()
  ceilingHeight: number;

  @IsString()
  insulationType: string;

  @IsNumber()
  insulationThickness: number;

  @IsString()
  windowType: string;

  @IsString()
  heatingType: string;

  @IsNumber()
  constructionYear: number;
}
