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
import {
  parsePage,
  setTotalCount,
  TOTAL_COUNT_HEADER,
} from '../../common/pagination';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { GasReadingResponseDto } from './dto/gas-reading-response.dto';
import { GasAnalysisResponseDto } from './dto/gas-analysis-response.dto';
import { GetGasAnalysisDto } from './dto/gas-analysis-query.dto';
import {
  IMAGE_MAX_SIZE_BYTES,
  PDF_MAX_SIZE_BYTES,
} from '../../common/file-storage.service';
import { UpdateGasReferenceDto } from './dto/update-gas-reference.dto';
import { UploadInvoiceDto } from './dto/upload-invoice.dto';
import { PositiveIntPipe } from './positive-int.pipe';

@ApiTags('Gas Utilities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/gas')
export class GasReadingController {
  constructor(private readonly service: GasReadingService) {}

  @Post('reading')
  @ApiCreatedResponse({ type: GasReadingResponseDto })
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
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiOkResponse({
    type: [GasReadingResponseDto],
    description: `Ukupan broj redova je u \`${TOTAL_COUNT_HEADER}\` zaglavlju.`,
  })
  async findAll(
    @Req() req,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Prije: svi redovi u jednom odgovoru. Očitanja rastu svaki mjesec, pa je to
    // jedina lista koja s vremenom sigurno postaje prevelika.
    const page = parsePage(
      { limit, offset },
      { defaultLimit: 100, maxLimit: 500 },
    );
    const { rows, total } = await this.service.findAll(req.user.userId, {
      ...page,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    setTotalCount(res, total);
    return rows;
  }

  @Get('latest')
  @ApiOkResponse({ type: GasReadingResponseDto, nullable: true })
  getLatest(@Req() req) {
    return this.service.getLatest(req.user.userId);
  }

  @Delete('reading/:id')
  @ApiParam({ name: 'id', schema: { type: 'number', minimum: 1 } })
  delete(@Req() req, @Param('id', PositiveIntPipe) id: number) {
    return this.service.delete(req.user.userId, id);
  }

  @Patch('reading/:id/reference')
  @ApiOkResponse({ type: GasReadingResponseDto })
  @ApiParam({ name: 'id', schema: { type: 'number', minimum: 1 } })
  updateReference(
    @Req() req,
    @Param('id', PositiveIntPipe) id: number,
    @Body() dto: UpdateGasReferenceDto,
  ) {
    return this.service.updateReference(req.user.userId, id, dto);
  }

  @Post('reading/:id/meter-image')
  @ApiCreatedResponse({ type: GasReadingResponseDto })
  @ApiParam({ name: 'id', schema: { type: 'number', minimum: 1 } })
  @UseInterceptors(
    FileInterceptor('meterImage', {
      limits: { fileSize: IMAGE_MAX_SIZE_BYTES },
    }),
  )
  uploadMeterImage(
    @Req() req,
    @Param('id', PositiveIntPipe) id: number,
    @UploadedFile() meterImage: any,
  ) {
    return this.service.uploadMeterImage(req.user.userId, id, meterImage);
  }

  @Post('reading/:id/invoice')
  @ApiCreatedResponse({ type: GasReadingResponseDto })
  @ApiParam({ name: 'id', schema: { type: 'number', minimum: 1 } })
  @UseInterceptors(
    FileInterceptor('invoicePdf', {
      limits: { fileSize: PDF_MAX_SIZE_BYTES },
    }),
  )
  uploadInvoice(
    @Req() req,
    @Param('id', PositiveIntPipe) id: number,
    @Body() dto: UploadInvoiceDto,
    @UploadedFile() invoicePdf: any,
  ) {
    return this.service.uploadInvoice(req.user.userId, id, dto, invoicePdf);
  }

  @Delete('reading/:id/invoice')
  @ApiOkResponse({ type: GasReadingResponseDto })
  @ApiParam({ name: 'id', schema: { type: 'number', minimum: 1 } })
  deleteInvoice(@Req() req, @Param('id', PositiveIntPipe) id: number) {
    return this.service.deleteInvoice(req.user.userId, id);
  }

  @Get('reading/:id/meter-image')
  @ApiParam({ name: 'id', schema: { type: 'number', minimum: 1 } })
  async getMeterImage(
    @Req() req,
    @Param('id', PositiveIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.getMeterImageStream(req.user.userId, id);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${result.fileName.replace(/"/g, '')}"`,
    );
    return new StreamableFile(result.stream);
  }

  @Get('reading/:id/invoice')
  @ApiParam({ name: 'id', schema: { type: 'number', minimum: 1 } })
  async getInvoice(
    @Req() req,
    @Param('id', PositiveIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.getInvoiceStream(req.user.userId, id);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${result.fileName.replace(/"/g, '')}"`,
    );
    return new StreamableFile(result.stream);
  }

  @Get('analysis')
  @ApiOkResponse({ type: GasAnalysisResponseDto })
  getAnalysis(@Req() req, @Query() query: GetGasAnalysisDto) {
    const startDate = query.from ? new Date(query.from) : undefined;
    const endDate = query.to ? new Date(query.to) : undefined;
    return this.service.getEfficiencyAnalysis(
      req.user.userId,
      startDate,
      endDate,
    );
  }
}
