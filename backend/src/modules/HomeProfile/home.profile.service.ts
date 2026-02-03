import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHomeProfileDto } from './dto/create-home-profile.dto';
import { UpdateHomeProfileDto } from './dto/update-home-profile.dto';

@Injectable()
export class HomeProfileService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: number) {
    // Get user's location
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { homeLocation: true },
    });

    const profiles = await this.prisma.homeProfile.findMany({
      where: { userId },
      include: {
        thermostatDevices: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Map to include computed fields with actual data
    return profiles.map((profile, index) => ({
      id: profile.id,
      userId: profile.userId,
      homeName: profile.homeName,
      floorArea: profile.floorArea,
      ceilingHeight: profile.ceilingHeight,
      insulationType: profile.insulationType,
      insulationThickness: profile.insulationThickness,
      windowType: profile.windowType,
      heatingType: profile.heatingType,
      constructionYear: profile.constructionYear,
      numberOfResidents: profile.numberOfResidents,
      boilerModel: profile.boilerModel,
      hasFloorHeating: profile.hasFloorHeating,
      targetMorningTemp: profile.targetMorningTemp,
      targetDayTemp: profile.targetDayTemp,
      targetNightTemp: profile.targetNightTemp,
      preferredScheduleNotes: profile.preferredScheduleNotes,
      learningOffset: profile.learningOffset,
      learningConfidence: profile.learningConfidence,
      seasonMode: profile.seasonMode,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      // Mobile app expected fields
      isActive: index === 0, // For now, first profile is active
      thermostats: profile.thermostatDevices.length,
      name: profile.homeName || 'Unnamed Home',
      location: user?.homeLocation || 'No location set',
      thermostatDevices: profile.thermostatDevices,
    }));
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
    return this.prisma.homeProfile.create({
      data: {
        homeName: dto.homeName ?? null,
        floorArea: dto.floorArea,
        ceilingHeight: dto.ceilingHeight,
        insulationType: dto.insulationType,
        insulationThickness: dto.insulationThickness,
        windowType: dto.windowType,
        heatingType: dto.heatingType,
        constructionYear: dto.constructionYear,
        numberOfResidents: dto.numberOfResidents ?? null,
        boilerModel: dto.boilerModel ?? null,
        hasFloorHeating: dto.hasFloorHeating,
        targetMorningTemp: dto.targetMorningTemp,
        targetDayTemp: dto.targetDayTemp,
        targetNightTemp: dto.targetNightTemp,
        preferredScheduleNotes: dto.preferredScheduleNotes ?? null,
        seasonMode: dto.seasonMode ?? 'WINTER',
        userId,
      },
    });
  }

  async update(userId: number, id: number, dto: UpdateHomeProfileDto) {
    await this.findOne(userId, id);

    const updateData: any = {};

    if (dto.homeName !== undefined) updateData.homeName = dto.homeName ?? null;
    if (dto.floorArea !== undefined) updateData.floorArea = dto.floorArea;
    if (dto.ceilingHeight !== undefined)
      updateData.ceilingHeight = dto.ceilingHeight;
    if (dto.insulationType !== undefined)
      updateData.insulationType = dto.insulationType;
    if (dto.insulationThickness !== undefined)
      updateData.insulationThickness = dto.insulationThickness;
    if (dto.windowType !== undefined) updateData.windowType = dto.windowType;
    if (dto.heatingType !== undefined) updateData.heatingType = dto.heatingType;
    if (dto.constructionYear !== undefined)
      updateData.constructionYear = dto.constructionYear;
    if (dto.numberOfResidents !== undefined)
      updateData.numberOfResidents = dto.numberOfResidents ?? null;
    if (dto.boilerModel !== undefined)
      updateData.boilerModel = dto.boilerModel ?? null;
    if (dto.hasFloorHeating !== undefined)
      updateData.hasFloorHeating = dto.hasFloorHeating;
    if (dto.targetMorningTemp !== undefined)
      updateData.targetMorningTemp = dto.targetMorningTemp;
    if (dto.targetDayTemp !== undefined)
      updateData.targetDayTemp = dto.targetDayTemp;
    if (dto.targetNightTemp !== undefined)
      updateData.targetNightTemp = dto.targetNightTemp;
    if (dto.preferredScheduleNotes !== undefined)
      updateData.preferredScheduleNotes = dto.preferredScheduleNotes ?? null;
    if (dto.seasonMode !== undefined) updateData.seasonMode = dto.seasonMode;

    return this.prisma.homeProfile.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(userId: number, id: number) {
    await this.findOne(userId, id);

    return this.prisma.homeProfile.delete({
      where: { id },
    });
  }

  async activate(userId: number, id: number) {
    // Verify ownership
    await this.findOne(userId, id);

    // Get user's location
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { homeLocation: true },
    });

    // TODO: When User has activeHomeProfileId field, update it here
    // For now, just return the profile with isActive: true
    const profile = await this.prisma.homeProfile.findUnique({
      where: { id },
      include: {
        thermostatDevices: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('HomeProfile not found');
    }

    return {
      ...profile,
      isActive: true,
      thermostats: profile.thermostatDevices.length,
      name: profile.homeName || 'Unnamed Home',
      location: user?.homeLocation || 'No location set',
    };
  }
}
