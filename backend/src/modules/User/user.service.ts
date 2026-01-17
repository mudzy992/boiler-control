// src/User/user.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        homeLocation: true,
        role: true,
        plan: true,
        avatarUrl: true,
        timezone: true,
        locale: true,
        prefersDarkMode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(userId: number, dto: UpdateUserDto) {
    const dataToUpdate: any = { ...dto };

    if (dto.password) {
      const hashed = await bcrypt.hash(dto.password, 12);
      dataToUpdate.passwordHash = hashed;
    }
    delete dataToUpdate.password; // uklonimo plain password

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        homeLocation: true,
        role: true,
        plan: true,
        avatarUrl: true,
        timezone: true,
        locale: true,
        prefersDarkMode: true,
        updatedAt: true,
      },
    });

    return user;
  }
}
