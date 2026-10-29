import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGasReadingDto } from './dto/create-gas-reading.dto';
import { UpdateGasReferenceDto } from './dto/update-gas-reference.dto';
import { UploadInvoiceDto } from './dto/upload-invoice.dto';
import { FileStorageService } from '../../common/file-storage.service';

const VAT_RATE = 0.17;

@Injectable()
export class GasReadingService {
  constructor(
    private prisma: PrismaService,
    private fileStorage: FileStorageService,
  ) {}

  async create(userId: number, dto: CreateGasReadingDto, meterImage?: any) {
    const readingDate = new Date(dto.readingDate);
    if (Number.isNaN(readingDate.getTime())) {
      throw new BadRequestException('Invalid reading date');
    }

    const [user, existingReading] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
      this.findReadingForSameDay(userId, readingDate),
    ]);

    if (!user) throw new NotFoundException('User not found');

    if (existingReading) {
      throw new ConflictException(
        'A gas reading for this date already exists. Please update the existing entry.',
      );
    }

    const lastReading = await this.prisma.gasReading.findFirst({
      where: { userId },
      orderBy: { readingDate: 'desc' },
    });

    let consumption = 0;
    if (lastReading) {
      if (dto.counterValue < lastReading.counterValue) {
        throw new BadRequestException(
          'Novo stanje brojila ne može biti manje od prethodnog.',
        );
      }
      consumption = dto.counterValue - lastReading.counterValue;
    }

    // Reference state is managed only from the readings list action.
    const created = await this.prisma.gasReading.create({
      data: {
        userId,
        readingDate,
        counterValue: dto.counterValue,
        consumption: Number(consumption.toFixed(2)),
        isInvoiceReference: false,
        referenceMonth: null,
      },
    });

    let fileInfo: {
      relativePath: string;
      mimeType: string;
      originalName: string;
    } | null = null;

    if (meterImage) {
      fileInfo = await this.fileStorage.storeGasReadingImage(created.id, {
        buffer: meterImage.buffer,
        mimetype: meterImage.mimetype,
        size: meterImage.size,
        originalname: meterImage.originalname,
      });

      await this.prisma.gasReading.update({
        where: { id: created.id },
        data: {
          meterImagePath: fileInfo.relativePath,
          meterImageMime: fileInfo.mimeType,
          meterImageOriginalName: fileInfo.originalName,
        },
      });
    }

    const finalReading = await this.prisma.gasReading.findUnique({
      where: { id: created.id },
    });

    return this.mapGasReading(finalReading!);
  }

  async findAll(userId: number) {
    const readings = await this.prisma.gasReading.findMany({
      where: { userId },
      orderBy: { readingDate: 'desc' },
    });
    return readings.map((reading) => this.mapGasReading(reading));
  }

  async getLatest(userId: number) {
    const reading = await this.prisma.gasReading.findFirst({
      where: { userId },
      orderBy: { readingDate: 'desc' },
    });
    return reading ? this.mapGasReading(reading) : null;
  }

  async delete(userId: number, id: number) {
    const reading = await this.prisma.gasReading.findFirst({
      where: { id, userId },
    });

    if (!reading) {
      throw new NotFoundException('Očitavanje nije pronađeno.');
    }

    await this.fileStorage.deleteFile(reading.meterImagePath);
    await this.fileStorage.deleteFile(reading.invoicePdfPath);

    return this.prisma.gasReading.delete({
      where: { id },
    });
  }

  async updateReference(
    userId: number,
    readingId: number,
    dto: UpdateGasReferenceDto,
  ) {
    const reading = await this.prisma.gasReading.findFirst({
      where: { id: readingId, userId },
      include: {
        user: { select: { timezone: true } },
      },
    });

    if (!reading) {
      throw new NotFoundException('Gas reading not found');
    }

    const referenceMonth = this.getReferenceMonthKey(
      reading.readingDate,
      reading.user.timezone,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isReference) {
        await tx.gasReading.updateMany({
          where: { userId, referenceMonth, id: { not: readingId } },
          data: { isInvoiceReference: false, referenceMonth: null },
        });

        return tx.gasReading.update({
          where: { id: readingId },
          data: {
            isInvoiceReference: true,
            referenceMonth,
          },
        });
      }

      return tx.gasReading.update({
        where: { id: readingId },
        data: {
          isInvoiceReference: false,
          referenceMonth: null,
        },
      });
    });

    return this.mapGasReading(updated);
  }

  async uploadMeterImage(userId: number, readingId: number, meterImage: any) {
    if (!meterImage) {
      throw new BadRequestException('Meter image file is required');
    }

    const reading = await this.prisma.gasReading.findFirst({
      where: { id: readingId, userId },
      select: { id: true, meterImagePath: true },
    });

    if (!reading) {
      throw new NotFoundException('Gas reading not found');
    }

    const storedFile = await this.fileStorage.storeGasReadingImage(readingId, {
      buffer: meterImage.buffer,
      mimetype: meterImage.mimetype,
      size: meterImage.size,
      originalname: meterImage.originalname,
    });

    if (reading.meterImagePath) {
      await this.fileStorage.deleteFile(reading.meterImagePath);
    }

    const updated = await this.prisma.gasReading.update({
      where: { id: readingId },
      data: {
        meterImagePath: storedFile.relativePath,
        meterImageMime: storedFile.mimeType,
        meterImageOriginalName: storedFile.originalName,
      },
    });

    return this.mapGasReading(updated);
  }

  async uploadInvoice(
    userId: number,
    readingId: number,
    dto: UploadInvoiceDto,
    invoicePdf: any,
  ) {
    if (!invoicePdf) {
      throw new BadRequestException('Invoice PDF file is required');
    }

    const reading = await this.prisma.gasReading.findFirst({
      where: { id: readingId, userId },
      include: { user: { select: { timezone: true } } },
    });
    if (!reading) throw new NotFoundException('Gas reading not found');
    if (!reading.isInvoiceReference) {
      throw new BadRequestException(
        'Invoice can only be attached to a reference reading',
      );
    }

    const storedFile = await this.fileStorage.storeGasInvoicePdf(readingId, {
      buffer: invoicePdf.buffer,
      mimetype: invoicePdf.mimetype,
      size: invoicePdf.size,
      originalname: invoicePdf.originalname,
    });

    if (reading.invoicePdfPath) {
      await this.fileStorage.deleteFile(reading.invoicePdfPath);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedReading = await tx.gasReading.update({
        where: { id: readingId },
        data: {
          invoicePdfPath: storedFile.relativePath,
          invoicePdfMime: storedFile.mimeType,
          invoicePdfOriginalName: storedFile.originalName,
          invoiceUploadedAt: new Date(),
          invoiceGasPriceExVat: dto.invoiceGasPriceExVat ?? null,
        },
      });

      if (dto.invoiceGasPriceExVat !== undefined) {
        const effectiveFrom =
          updatedReading.referenceMonth ??
          this.getReferenceMonthKey(
            updatedReading.readingDate,
            reading.user.timezone,
          );

        await tx.gasPriceHistory.updateMany({
          where: { userId, effectiveTo: null },
          data: { effectiveTo: effectiveFrom },
        });

        await tx.gasPriceHistory.create({
          data: {
            userId,
            gasReadingId: readingId,
            priceExVat: dto.invoiceGasPriceExVat,
            vatRate: VAT_RATE,
            effectiveFrom,
            source: 'INVOICE',
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { gasPriceExVat: dto.invoiceGasPriceExVat },
        });
      }

      return updatedReading;
    });

    return this.mapGasReading(updated);
  }

  async deleteInvoice(userId: number, readingId: number) {
    const reading = await this.prisma.gasReading.findFirst({
      where: { id: readingId, userId },
    });
    if (!reading) throw new NotFoundException('Gas reading not found');

    await this.fileStorage.deleteFile(reading.invoicePdfPath);

    const updated = await this.prisma.gasReading.update({
      where: { id: readingId },
      data: {
        invoicePdfPath: null,
        invoicePdfMime: null,
        invoicePdfOriginalName: null,
        invoiceUploadedAt: null,
      },
    });

    return this.mapGasReading(updated);
  }

  async getMeterImageStream(userId: number, readingId: number) {
    const reading = await this.prisma.gasReading.findFirst({
      where: { id: readingId, userId },
      select: {
        meterImagePath: true,
        meterImageMime: true,
        meterImageOriginalName: true,
      },
    });

    if (!reading || !reading.meterImagePath) {
      throw new NotFoundException('Meter image not found');
    }

    return {
      stream: this.fileStorage.createPrivateReadStream(reading.meterImagePath),
      mimeType: reading.meterImageMime || 'application/octet-stream',
      fileName: reading.meterImageOriginalName || 'meter-image',
    };
  }

  async getInvoiceStream(userId: number, readingId: number) {
    const reading = await this.prisma.gasReading.findFirst({
      where: { id: readingId, userId },
      select: {
        invoicePdfPath: true,
        invoicePdfMime: true,
        invoicePdfOriginalName: true,
      },
    });

    if (!reading || !reading.invoicePdfPath) {
      throw new NotFoundException('Invoice PDF not found');
    }

    return {
      stream: this.fileStorage.createPrivateReadStream(reading.invoicePdfPath),
      mimeType: reading.invoicePdfMime || 'application/pdf',
      fileName: reading.invoicePdfOriginalName || 'invoice.pdf',
    };
  }

  async getEfficiencyAnalysis(userId: number, from?: Date, to?: Date) {
    const now = new Date();
    const latestReading = await this.prisma.gasReading.findFirst({
      where: { userId },
      orderBy: { readingDate: 'desc' },
    });

    const latestReference = await this.prisma.gasReading.findFirst({
      where: { userId, isInvoiceReference: true },
      orderBy: { readingDate: 'desc' },
    });

    let periodMode: 'explicit' | 'reference_to_current' | 'last_30_days' =
      'explicit';
    let startDate = from;
    let endDate = to;

    if (!startDate || !endDate) {
      if (latestReference && latestReading) {
        periodMode = 'reference_to_current';
        startDate = latestReference.readingDate;
        endDate = latestReading.readingDate;
      } else {
        periodMode = 'last_30_days';
        endDate = latestReading?.readingDate || now;
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    if (!startDate || !endDate) {
      return {
        period: {
          from: null,
          to: null,
          mode: periodMode,
        },
        totalGas: 0,
        consumptionFromReferenceM3: 0,
        totalHeatingHours: 0,
        avgFlowTemp: 0,
        costExVat: 0,
        vatAmount: 0,
        costIncVat: 0,
        referenceReading: null,
        priceBreakdown: [],
        efficiency: {
          m3PerHour: 0,
          label: 'NO_DATA',
        },
      };
    }

    const readings = await this.prisma.gasReading.findMany({
      where: {
        userId,
        readingDate: { gte: startDate, lte: endDate },
      },
      orderBy: { readingDate: 'asc' },
    });

    let totalGas = 0;
    const intervals: Array<{ endDate: Date; consumption: number }> = [];
    for (let i = 1; i < readings.length; i++) {
      const previous = readings[i - 1];
      const current = readings[i];
      const consumption = current.counterValue - previous.counterValue;
      if (consumption >= 0) {
        totalGas += consumption;
        intervals.push({ endDate: current.readingDate, consumption });
      }
    }

    const referenceReading =
      latestReference &&
      latestReading &&
      latestReference.readingDate >= startDate &&
      latestReference.readingDate <= endDate
        ? latestReference
        : null;

    const consumptionFromReferenceM3 =
      referenceReading && latestReading
        ? Math.max(
            0,
            latestReading.counterValue - referenceReading.counterValue,
          )
        : totalGas;

    const history = await this.prisma.boilerHistory.findMany({
      where: {
        userId,
        heatingStart: { gte: startDate },
        heatingEnd: { lte: endDate, not: null },
      },
    });

    let totalMinutes = 0;
    let weightedTempSum = 0;

    for (const h of history) {
      if (h.heatingStart && h.heatingEnd) {
        const duration =
          (h.heatingEnd.getTime() - h.heatingStart.getTime()) / 60000;
        totalMinutes += duration;
        weightedTempSum +=
          duration * (h.actualFlowTemp ?? h.suggestedFlowTemp ?? 0);
      }
    }

    const avgFlowTemp = totalMinutes > 0 ? weightedTempSum / totalMinutes : 0;
    const totalHours = totalMinutes / 60;
    const m3PerHour = totalHours > 0 ? totalGas / totalHours : 0;

    const [user, prices] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { gasPriceExVat: true },
      }),
      this.prisma.gasPriceHistory.findMany({
        where: {
          userId,
          effectiveFrom: { lte: endDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: startDate } }],
        },
        orderBy: { effectiveFrom: 'asc' },
      }),
    ]);

    const fallbackPrice = user?.gasPriceExVat ?? 0;
    let costExVat = 0;
    const breakdownMap = new Map<
      string,
      {
        priceExVat: number;
        consumptionM3: number;
        costExVat: number;
        source: string;
        effectiveFrom: Date | null;
        effectiveTo: Date | null;
      }
    >();

    for (const interval of intervals) {
      const activePrice = this.findPriceForDate(prices, interval.endDate);
      const priceExVat = activePrice?.priceExVat ?? fallbackPrice;
      const cost = interval.consumption * priceExVat;
      costExVat += cost;

      const key = activePrice
        ? `${activePrice.id}:${activePrice.effectiveFrom.toISOString()}`
        : 'fallback';
      const current = breakdownMap.get(key) ?? {
        priceExVat,
        consumptionM3: 0,
        costExVat: 0,
        source: activePrice?.source ?? 'MANUAL',
        effectiveFrom: activePrice?.effectiveFrom ?? null,
        effectiveTo: activePrice?.effectiveTo ?? null,
      };
      current.consumptionM3 += interval.consumption;
      current.costExVat += cost;
      breakdownMap.set(key, current);
    }

    const vatAmount = costExVat * VAT_RATE;
    const costIncVat = costExVat + vatAmount;

    return {
      period: {
        from: startDate,
        to: endDate,
        mode: periodMode,
      },
      totalGas: Number(totalGas.toFixed(2)),
      consumptionFromReferenceM3: Number(consumptionFromReferenceM3.toFixed(2)),
      totalHeatingHours: Number(totalHours.toFixed(1)),
      avgFlowTemp: Number(avgFlowTemp.toFixed(1)),
      costExVat: Number(costExVat.toFixed(2)),
      vatAmount: Number(vatAmount.toFixed(2)),
      costIncVat: Number(costIncVat.toFixed(2)),
      referenceReading: referenceReading
        ? {
            id: referenceReading.id,
            readingDate: referenceReading.readingDate,
            counterValue: referenceReading.counterValue,
          }
        : null,
      priceBreakdown: Array.from(breakdownMap.values()).map((row) => ({
        priceExVat: Number(row.priceExVat.toFixed(4)),
        consumptionM3: Number(row.consumptionM3.toFixed(2)),
        costExVat: Number(row.costExVat.toFixed(2)),
        source: row.source,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
      })),
      efficiency: {
        m3PerHour: Number(m3PerHour.toFixed(3)),
        label: this.getEfficiencyLabel(m3PerHour),
      },
    };
  }

  private findPriceForDate(
    prices: Array<{
      id: number;
      priceExVat: number;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      source: string;
    }>,
    date: Date,
  ) {
    return prices.find((price) => {
      if (price.effectiveFrom > date) return false;
      if (!price.effectiveTo) return true;
      return price.effectiveTo >= date;
    });
  }

  private async findReadingForSameDay(userId: number, readingDate: Date) {
    const dayStart = new Date(readingDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(readingDate);
    dayEnd.setUTCHours(23, 59, 59, 999);
    return this.prisma.gasReading.findFirst({
      where: {
        userId,
        readingDate: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });
  }

  private mapGasReading(reading: any) {
    return {
      id: reading.id,
      userId: reading.userId,
      counterValue: reading.counterValue,
      readingDate: reading.readingDate,
      consumption: reading.consumption,
      createdAt: reading.createdAt,
      isInvoiceReference: reading.isInvoiceReference,
      referenceMonth: reading.referenceMonth,
      hasMeterImage: !!reading.meterImagePath,
      hasInvoicePdf: !!reading.invoicePdfPath,
      invoiceUploadedAt: reading.invoiceUploadedAt,
      invoiceGasPriceExVat: reading.invoiceGasPriceExVat,
    };
  }

  private getReferenceMonthKey(readingDate: Date, timezone?: string | null) {
    if (!timezone) {
      return new Date(
        Date.UTC(readingDate.getUTCFullYear(), readingDate.getUTCMonth(), 1),
      );
    }

    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
      }).formatToParts(readingDate);
      const year = Number(parts.find((p) => p.type === 'year')?.value);
      const month = Number(parts.find((p) => p.type === 'month')?.value);
      if (Number.isNaN(year) || Number.isNaN(month)) {
        throw new Error('Invalid timezone date');
      }
      return new Date(Date.UTC(year, month - 1, 1));
    } catch {
      return new Date(
        Date.UTC(readingDate.getUTCFullYear(), readingDate.getUTCMonth(), 1),
      );
    }
  }

  private getEfficiencyLabel(m3ph: number): string {
    if (m3ph === 0) return 'NO_DATA';
    if (m3ph < 0.5) return 'EXCELLENT';
    if (m3ph < 1.0) return 'GOOD';
    if (m3ph < 1.5) return 'FAIR';
    return 'POOR';
  }
}
