import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { HomeProfileService } from './home.profile.service';
import { CreateHomeProfileDto } from './dto/create-home-profile.dto';
import { UpdateHomeProfileDto } from './dto/update-home-profile.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/home-profiles')
export class HomeProfileController {
  constructor(private readonly service: HomeProfileService) {}

  @Get()
  findAll(@Req() req) {
    return this.service.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.service.findOne(req.user.userId, +id);
  }

  @Post()
  create(@Req() req, @Body() dto: CreateHomeProfileDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateHomeProfileDto,
  ) {
    return this.service.update(req.user.userId, +id, dto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.service.remove(req.user.userId, +id);
  }
}

@UseGuards(JwtAuthGuard)
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
