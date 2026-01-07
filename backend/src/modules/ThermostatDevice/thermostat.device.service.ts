import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateThermostatDeviceDto } from './dto/create-thermostat-device.dto';
import { UpdateThermostatDeviceDto } from './dto/update-thermostat-device.dto';

@Injectable()
export class ThermostatDeviceService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: number) {
    return this.prisma.thermostatDevice.findMany({
      where: { userId },
      include: {
        homeProfile: true,
      },
    });
  }

  async findOne(userId: number, id: number) {
    const device = await this.prisma.thermostatDevice.findUnique({
      where: { id },
      include: {
        homeProfile: true,
        heatingEvents: true,
      },
    });

    if (!device) throw new NotFoundException('Thermostat not found');
    if (device.userId !== userId) throw new ForbiddenException('Access denied');

    return device;
  }

  async create(userId: number, dto: CreateThermostatDeviceDto) {
    const homeProfile = await this.prisma.homeProfile.findFirst({
      where: {
        id: dto.homeProfileId,
        userId,
      },
    });

    if (!homeProfile) throw new ForbiddenException('Invalid HomeProfile');

    return this.prisma.thermostatDevice.create({
      data: {
        userId,
        vendor: dto.vendor,
        deviceId: dto.deviceId,
        alias: dto.alias,
        mode: dto.mode,
        homeProfileId: dto.homeProfileId,
      },
    });
  }

  async update(userId: number, id: number, dto: UpdateThermostatDeviceDto) {
    const device = await this.prisma.thermostatDevice.findUnique({
      where: { id },
    });

    if (!device) throw new NotFoundException('Thermostat not found');
    if (device.userId !== userId) throw new ForbiddenException('Access denied');

    if (dto.homeProfileId) {
      const homeProfile = await this.prisma.homeProfile.findFirst({
        where: {
          id: dto.homeProfileId,
          userId,
        },
      });

      if (!homeProfile) throw new ForbiddenException('Invalid HomeProfile');
    }

    return this.prisma.thermostatDevice.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: number, id: number) {
    const device = await this.prisma.thermostatDevice.findUnique({
      where: { id },
    });

    if (!device) throw new NotFoundException('Thermostat not found');
    if (device.userId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.thermostatDevice.delete({
      where: { id },
    });
  }
}
