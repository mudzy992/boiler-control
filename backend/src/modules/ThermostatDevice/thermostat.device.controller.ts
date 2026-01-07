import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { ThermostatDeviceService } from './thermostat.device.service';
import { CreateThermostatDeviceDto } from './dto/create-thermostat-device.dto';
import { UpdateThermostatDeviceDto } from './dto/update-thermostat-device.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/thermostats')
export class ThermostatDeviceController {
  constructor(private readonly service: ThermostatDeviceService) {}

  @Get()
  findAll(@Req() req) {
    return this.service.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.service.findOne(req.user.userId, +id);
  }

  @Post()
  create(@Req() req, @Body() dto: CreateThermostatDeviceDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateThermostatDeviceDto,
  ) {
    return this.service.update(req.user.userId, +id, dto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.service.remove(req.user.userId, +id);
  }
}
