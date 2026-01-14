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
    return this.prisma.homeProfile.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async update(userId: number, id: number, dto: UpdateHomeProfileDto) {
    await this.findOne(userId, id);

    const dtoCorrected = {
      ...dto,
      floorArea: Number(dto.floorArea),
      ceilingHeight: Number(dto.ceilingHeight),
      insulationThickness: Number(dto.insulationThickness),
      constructionYear: Number(dto.constructionYear),
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
