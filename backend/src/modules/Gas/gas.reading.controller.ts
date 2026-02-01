import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { GasReadingService } from './gas.reading.service';
import { CreateGasReadingDto } from './dto/create-gas-reading.dto';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';

@ApiTags('Gas Utilities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/gas')
export class GasReadingController {
  constructor(private readonly service: GasReadingService) {}

  @Post('reading')
  create(@Req() req, @Body() dto: CreateGasReadingDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Get('readings')
  findAll(@Req() req) {
    return this.service.findAll(req.user.userId);
  }

  @Get('latest')
  getLatest(@Req() req) {
    return this.service.getLatest(req.user.userId);
  }

  @Delete('reading/:id')
  delete(@Req() req, @Param('id') id: string) {
    return this.service.delete(req.user.userId, +id);
  }

  @Get('analysis')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getAnalysis(
    @Req() req,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    // Default to last 30 days if not provided
    const endDate = to ? new Date(to) : new Date();
    const startDate = from ? new Date(from) : new Date(new Date().setDate(endDate.getDate() - 30));

    return this.service.getEfficiencyAnalysis(req.user.userId, startDate, endDate);
  }
}
