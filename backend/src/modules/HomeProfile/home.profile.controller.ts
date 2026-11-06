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
import { PositiveIntPipe } from './positive-int.pipe';
import { ApiParam, ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard)
@ApiTags('Home Profiles')
@Controller('api/home-profiles')
export class HomeProfileController {
  constructor(private readonly service: HomeProfileService) {}

  @Get()
  findAll(@Req() req) {
    return this.service.findAll(req.user.userId);
  }

  @Get('active')
  findActive(@Req() req) {
    return this.service.findActive(req.user.userId);
  }

  @Get(':id')
  @ApiParam({ name: 'id', schema: { type: 'number', minimum: 1 } })
  findOne(@Req() req, @Param('id', PositiveIntPipe) id: number) {
    return this.service.findOne(req.user.userId, id);
  }

  @Post()
  create(@Req() req, @Body() dto: CreateHomeProfileDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', schema: { type: 'number', minimum: 1 } })
  update(
    @Req() req,
    @Param('id', PositiveIntPipe) id: number,
    @Body() dto: UpdateHomeProfileDto,
  ) {
    return this.service.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', schema: { type: 'number', minimum: 1 } })
  remove(@Req() req, @Param('id', PositiveIntPipe) id: number) {
    return this.service.remove(req.user.userId, id);
  }

  @Patch(':id/activate')
  @ApiParam({ name: 'id', schema: { type: 'number', minimum: 1 } })
  activate(@Req() req, @Param('id', PositiveIntPipe) id: number) {
    return this.service.activate(req.user.userId, id);
  }
}

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
      location: profile.location,
      isActive: profile.isActive ?? false,
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
  @ApiParam({ name: 'id', schema: { type: 'number', minimum: 1 } })
  update(
    @Req() req,
    @Param('id', PositiveIntPipe) id: number,
    @Body() dto: UpdateHomeProfileDto,
  ) {
    return this.service
      .update(req.user.userId, id, dto)
      .then((profile) => this.mapProfile(profile));
  }
}
