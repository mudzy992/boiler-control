import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGasReadingDto } from './dto/create-gas-reading.dto';

@Injectable()
export class GasReadingService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, dto: CreateGasReadingDto) {
    // 1. Find previous reading to calculate consumption
    const lastReading = await this.prisma.gasReading.findFirst({
      where: { userId },
      orderBy: { readingDate: 'desc' },
    });

    let consumption = 0;
    if (lastReading) {
      if (dto.counterValue < lastReading.counterValue) {
        throw new Error('Novo stanje brojila ne može biti manje od prethodnog.');
      }
      consumption = dto.counterValue - lastReading.counterValue;
    }

    // 2. Create new reading
    return this.prisma.gasReading.create({
      data: {
        userId,
        readingDate: new Date(dto.readingDate),
        counterValue: dto.counterValue,
        consumption: Number(consumption.toFixed(2)),
      },
    });
  }

  async findAll(userId: number) {
    return this.prisma.gasReading.findMany({
      where: { userId },
      orderBy: { readingDate: 'desc' },
    });
  }

  async getLatest(userId: number) {
    return this.prisma.gasReading.findFirst({
      where: { userId },
      orderBy: { readingDate: 'desc' },
    });
  }

  async delete(userId: number, id: number) {
    const reading = await this.prisma.gasReading.findFirst({
      where: { id, userId },
    });

    if (!reading) {
      throw new NotFoundException('Očitavanje nije pronađeno.');
    }

    return this.prisma.gasReading.delete({
      where: { id },
    });
  }

  async getEfficiencyAnalysis(userId: number, from: Date, to: Date) {
    const readings = await this.prisma.gasReading.findMany({
      where: {
        userId,
        readingDate: { gte: from, lte: to },
      },
    });

    const totalGas = readings.reduce((acc, r) => acc + (r.consumption || 0), 0);

    const history = await this.prisma.boilerHistory.findMany({
      where: {
        userId,
        heatingStart: { gte: from },
        heatingEnd: { lte: to, not: null },
      },
    });

    let totalMinutes = 0;
    let weightedTempSum = 0;

    history.forEach((h) => {
      if (h.heatingStart && h.heatingEnd) {
        const duration = (h.heatingEnd.getTime() - h.heatingStart.getTime()) / 60000;
        totalMinutes += duration;
<<<<<<< Updated upstream
        weightedTempSum += duration * (h.actualFlowTemp || h.suggestedFlowTemp || 0);
=======
        weightedTempSum +=
          duration * (h.actualFlowTemp ?? h.suggestedFlowTemp ?? 0);
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
      }
    });

    const avgFlowTemp = totalMinutes > 0 ? weightedTempSum / totalMinutes : 0;
    const totalHours = totalMinutes / 60;

    // m3 per hour of active heating
    const m3PerHour = totalHours > 0 ? totalGas / totalHours : 0;

    return {
      period: { from, to },
      totalGas: Number(totalGas.toFixed(2)),
      totalHeatingHours: Number(totalHours.toFixed(1)),
      avgFlowTemp: Number(avgFlowTemp.toFixed(1)),
      efficiency: {
        m3PerHour: Number(m3PerHour.toFixed(3)),
        label: this.getEfficiencyLabel(m3PerHour),
      },
    };
  }

  private getEfficiencyLabel(m3ph: number): string {
    if (m3ph === 0) return 'NO_DATA';
    if (m3ph < 0.5) return 'EXCELLENT';
    if (m3ph < 1.0) return 'GOOD';
    if (m3ph < 1.5) return 'FAIR';
    return 'POOR';
  }
}
