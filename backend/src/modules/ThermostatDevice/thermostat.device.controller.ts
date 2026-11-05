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
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { PositiveIntPipe } from './positive-int.pipe';

@ApiTags('Thermostats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/devices')
export class ThermostatDeviceController {
  constructor(private readonly service: ThermostatDeviceService) {}

  @Get()
  findAll(@Req() req) {
    return this.service.findAll(req.user.userId);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: Number, minimum: 1 })
  findOne(@Req() req, @Param('id', PositiveIntPipe) id: number) {
    return this.service.findOne(req.user.userId, id);
  }

  @Get(':id/programs')
  @ApiParam({ name: 'id', type: Number, minimum: 1 })
  getPrograms(@Req() req, @Param('id', PositiveIntPipe) id: number) {
    return this.service.getPrograms(req.user.userId, id);
  }

  @Post()
  create(@Req() req, @Body() dto: CreateThermostatDeviceDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: Number, minimum: 1 })
  update(
    @Req() req,
    @Param('id', PositiveIntPipe) id: number,
    @Body() dto: UpdateThermostatDeviceDto,
  ) {
    return this.service.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: Number, minimum: 1 })
  remove(@Req() req, @Param('id', PositiveIntPipe) id: number) {
    return this.service.remove(req.user.userId, id);
  }
}
