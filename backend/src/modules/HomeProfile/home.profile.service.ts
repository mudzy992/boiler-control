import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHomeProfileDto } from './dto/create-home-profile.dto';
import { UpdateHomeProfileDto } from './dto/update-home-profile.dto';

@Injectable()
export class HomeProfileService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: number) {
    return this.prisma.homeProfile.findMany({
      where: { userId },
      include: {
        thermostatDevices: true,
      },
    });
  }

  async findOne(userId: number, id: number) {
    const profile = await this.prisma.homeProfile.findFirst({
      where: { id, userId },
      include: {
        thermostatDevices: true,
        intervalLearnings: true,
      },
    });

    if (!profile) throw new NotFoundException('HomeProfile not found');
    return profile;
  }

  create(userId: number, dto: CreateHomeProfileDto) {
    const floorArea = Number(dto.squareMeters ?? dto.floorArea ?? 0);
    const ceilingHeight = Number(dto.ceilingHeight ?? 2.6);
    const insulationThickness = Number(dto.insulationThickness ?? 10);
    const constructionYear = Number(
      dto.constructionYear ?? new Date().getFullYear(),
    );

    return this.prisma.homeProfile.create({
      data: {
        homeName: dto.homeName ?? null,
        floorArea,
        ceilingHeight,
        insulationType: dto.insulationLevel ?? dto.insulationType ?? 'standard',
        insulationThickness,
        windowType: dto.windowQuality ?? dto.windowType ?? 'standard',
        heatingType: dto.radiatorType ?? dto.heatingType ?? 'radiator',
        constructionYear,
        numberOfResidents: dto.numberOfResidents ?? null,
        boilerModel: dto.boilerModel ?? null,
        hasFloorHeating: dto.hasFloorHeating ?? false,
        targetMorningTemp: dto.targetMorningTemp ?? null,
        targetDayTemp: dto.targetDayTemp ?? null,
        targetNightTemp: dto.targetNightTemp ?? null,
        preferredScheduleNotes: dto.preferredScheduleNotes ?? null,
        userId,
      },
    });
  }

  async update(userId: number, id: number, dto: UpdateHomeProfileDto) {
    await this.findOne(userId, id);

    const dtoCorrected = {
      ...(dto.homeName !== undefined && { homeName: dto.homeName ?? null }),
      ...(dto.squareMeters !== undefined && {
        floorArea: Number(dto.squareMeters),
      }),
      ...(dto.floorArea !== undefined && { floorArea: Number(dto.floorArea) }),
      ...(dto.ceilingHeight !== undefined && {
        ceilingHeight: Number(dto.ceilingHeight),
      }),
      ...(dto.insulationLevel !== undefined && {
        insulationType: dto.insulationLevel,
      }),
      ...(dto.insulationType !== undefined && {
        insulationType: dto.insulationType,
      }),
      ...(dto.insulationThickness !== undefined && {
        insulationThickness: Number(dto.insulationThickness),
      }),
      ...(dto.windowQuality !== undefined && { windowType: dto.windowQuality }),
      ...(dto.windowType !== undefined && { windowType: dto.windowType }),
      ...(dto.radiatorType !== undefined && { heatingType: dto.radiatorType }),
      ...(dto.heatingType !== undefined && { heatingType: dto.heatingType }),
      ...(dto.constructionYear !== undefined && {
        constructionYear: Number(dto.constructionYear),
      }),
      ...(dto.numberOfResidents !== undefined && {
        numberOfResidents: dto.numberOfResidents ?? null,
      }),
      ...(dto.boilerModel !== undefined && {
        boilerModel: dto.boilerModel ?? null,
      }),
      ...(dto.hasFloorHeating !== undefined && {
        hasFloorHeating: dto.hasFloorHeating,
      }),
      ...(dto.targetMorningTemp !== undefined && {
        targetMorningTemp: dto.targetMorningTemp,
      }),
      ...(dto.targetDayTemp !== undefined && {
        targetDayTemp: dto.targetDayTemp,
      }),
      ...(dto.targetNightTemp !== undefined && {
        targetNightTemp: dto.targetNightTemp,
      }),
      ...(dto.preferredScheduleNotes !== undefined && {
        preferredScheduleNotes: dto.preferredScheduleNotes ?? null,
      }),
    };

    return this.prisma.homeProfile.update({
      where: { id },
      data: dtoCorrected,
    });
  }

  async remove(userId: number, id: number) {
    await this.findOne(userId, id);

    return this.prisma.homeProfile.delete({
      where: { id },
    });
  }
}
