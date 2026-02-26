import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { GasReadingService } from './gas.reading.service';
import { CreateGasReadingDto } from './dto/create-gas-reading.dto';
import { JwtAuthGuard } from '../Auth/jwt-auth.guard';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  IMAGE_MAX_SIZE_BYTES,
  PDF_MAX_SIZE_BYTES,
} from '../../common/file-storage.service';
import { UpdateGasReferenceDto } from './dto/update-gas-reference.dto';
import { UploadInvoiceDto } from './dto/upload-invoice.dto';

@ApiTags('Gas Utilities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/gas')
export class GasReadingController {
  constructor(private readonly service: GasReadingService) {}

  @Post('reading')
  @UseInterceptors(
    FileInterceptor('meterImage', {
      limits: { fileSize: IMAGE_MAX_SIZE_BYTES },
    }),
  )
  create(
    @Req() req,
    @Body() dto: CreateGasReadingDto,
    @UploadedFile() meterImage?: any,
  ) {
    return this.service.create(req.user.userId, dto, meterImage);
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

  @Patch('reading/:id/reference')
  updateReference(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateGasReferenceDto,
  ) {
    return this.service.updateReference(req.user.userId, +id, dto);
  }

  @Post('reading/:id/meter-image')
  @UseInterceptors(
    FileInterceptor('meterImage', {
      limits: { fileSize: IMAGE_MAX_SIZE_BYTES },
    }),
  )
  uploadMeterImage(
    @Req() req,
    @Param('id') id: string,
    @UploadedFile() meterImage: any,
  ) {
    return this.service.uploadMeterImage(req.user.userId, +id, meterImage);
  }

  @Post('reading/:id/invoice')
  @UseInterceptors(
    FileInterceptor('invoicePdf', {
      limits: { fileSize: PDF_MAX_SIZE_BYTES },
    }),
  )
  uploadInvoice(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UploadInvoiceDto,
    @UploadedFile() invoicePdf: any,
  ) {
    return this.service.uploadInvoice(req.user.userId, +id, dto, invoicePdf);
  }

  @Delete('reading/:id/invoice')
  deleteInvoice(@Req() req, @Param('id') id: string) {
    return this.service.deleteInvoice(req.user.userId, +id);
  }

  @Get('reading/:id/meter-image')
  async getMeterImage(
    @Req() req,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.getMeterImageStream(req.user.userId, +id);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${result.fileName.replace(/"/g, '')}"`,
    );
    return new StreamableFile(result.stream);
  }

  @Get('reading/:id/invoice')
  async getInvoice(
    @Req() req,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.getInvoiceStream(req.user.userId, +id);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${result.fileName.replace(/"/g, '')}"`,
    );
    return new StreamableFile(result.stream);
  }

  @Get('analysis')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getAnalysis(
    @Req() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const startDate = from ? new Date(from) : undefined;
    const endDate = to ? new Date(to) : undefined;
    return this.service.getEfficiencyAnalysis(req.user.userId, startDate, endDate);
  }
}
