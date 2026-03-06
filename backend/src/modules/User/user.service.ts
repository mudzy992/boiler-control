// src/User/user.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

const GAS_PRICE_VAT_RATE = 0.17;

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        homeLocation: true,
        gasPriceExVat: true,
        role: true,
        plan: true,
        avatarUrl: true,
        timezone: true,
        locale: true,
        prefersDarkMode: true,
        createdAt: true,
        updatedAt: true,
        GasPriceHistory: {
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          select: {
            effectiveFrom: true,
            source: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return this.mapUserResponse(user);
  }

  async updateMe(userId: number, dto: UpdateUserDto) {
    const dataToUpdate: any = { ...dto };
    delete dataToUpdate.gasPriceEffectiveFrom;

    if (dto.password) {
      const hashed = await bcrypt.hash(dto.password, 12);
      dataToUpdate.passwordHash = hashed;
    }
    delete dataToUpdate.password; // uklonimo plain password

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing) return null;

    if (dto.username && dto.username !== existing.username) {
      const usernameTaken = await this.prisma.user.findUnique({
        where: { username: dto.username },
        select: { id: true },
      });
      if (usernameTaken && usernameTaken.id !== userId) {
        throw new BadRequestException('Username already in use');
      }
    }

    const shouldUpdateGasPrice = dto.gasPriceExVat !== undefined;
    const gasPriceEffectiveFrom = dto.gasPriceEffectiveFrom
      ? new Date(dto.gasPriceEffectiveFrom)
      : new Date();

    if (shouldUpdateGasPrice && Number.isNaN(gasPriceEffectiveFrom.getTime())) {
      throw new BadRequestException('Invalid gasPriceEffectiveFrom');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      if (shouldUpdateGasPrice) {
        await tx.gasPriceHistory.updateMany({
          where: { userId, effectiveTo: null },
          data: { effectiveTo: gasPriceEffectiveFrom },
        });

        await tx.gasPriceHistory.create({
          data: {
            userId,
            priceExVat: dto.gasPriceExVat!,
            vatRate: GAS_PRICE_VAT_RATE,
            effectiveFrom: gasPriceEffectiveFrom,
            source: 'MANUAL',
          },
        });

        dataToUpdate.gasPriceExVat = dto.gasPriceExVat;
      }

      return tx.user.update({
        where: { id: userId },
        data: dataToUpdate,
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          homeLocation: true,
          gasPriceExVat: true,
          role: true,
          plan: true,
          avatarUrl: true,
          timezone: true,
          locale: true,
          prefersDarkMode: true,
          updatedAt: true,
          GasPriceHistory: {
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
            select: {
              effectiveFrom: true,
              source: true,
              createdAt: true,
            },
          },
        },
      });
    });

    return this.mapUserResponse(user);
  }

  private mapUserResponse(user: any) {
    const latestHistory = user.GasPriceHistory?.[0] || null;
    const { GasPriceHistory, ...rest } = user;
    const gasPriceIncVat =
      user.gasPriceExVat === null || user.gasPriceExVat === undefined
        ? null
        : Number((user.gasPriceExVat * (1 + GAS_PRICE_VAT_RATE)).toFixed(4));

    return {
      ...rest,
      gasPriceVatRate: GAS_PRICE_VAT_RATE,
      gasPriceIncVat,
      gasPriceLastUpdatedAt: latestHistory?.effectiveFrom ?? null,
      gasPriceSource: latestHistory?.source ?? null,
    };
  }
}
