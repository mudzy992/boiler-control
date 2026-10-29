import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { HomeProfileService } from './home.profile.service';
import { CreateHomeProfileDto } from './dto/create-home-profile.dto';
import { UpdateHomeProfileDto } from './dto/update-home-profile.dto';
import { ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard)
@ApiTags('Home Profile')
@Controller('api/home-profile')
export class HomeProfileSingleController {
  constructor(private readonly service: HomeProfileService) {}

  private mapProfile(profile: any) {
    if (!profile) return null;
    return {
      ...profile,
      squareMeters: profile.floorArea,
      insulationLevel: profile.insulationType,
      windowQuality: profile.windowType,
      radiatorType: profile.heatingType,
    };
  }

  @Get()
  async findFirst(@Req() req) {
    const profiles = await this.service.findAll(req.user.userId);
    return profiles.length > 0 ? this.mapProfile(profiles[0]) : null;
  }

  @Post()
  create(@Req() req, @Body() dto: CreateHomeProfileDto) {
    return this.service
      .create(req.user.userId, dto)
      .then((profile) => this.mapProfile(profile));
  }

  @Patch(':id')
  update(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateHomeProfileDto,
  ) {
    return this.service
      .update(req.user.userId, Number(id), dto)
      .then((profile) => this.mapProfile(profile));
  }
}
