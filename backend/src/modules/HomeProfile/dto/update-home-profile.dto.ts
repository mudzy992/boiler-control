import { PartialType } from '@nestjs/mapped-types';
import { CreateHomeProfileDto } from './create-home-profile.dto';

export class UpdateHomeProfileDto extends PartialType(CreateHomeProfileDto) {}
