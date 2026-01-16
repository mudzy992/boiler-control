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
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(userId: number, dto: UpdateUserDto) {
    const dataToUpdate: any = { ...dto }; // kopiramo dto da ne mutiramo original

    // Ako je poslana nova lozinka, hashiramo je i dodajemo u data
    if (dto.password) {
      const hashed = await bcrypt.hash(dto.password, 12);
      dataToUpdate.passwordHash = hashed;
    } else {
      // Ako password nije poslan, uklonimo ga da se ne updejtuje na null ili undefined
      delete dataToUpdate.passwordHash;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        homeLocation: true,
        updatedAt: true,
      },
    });
  }
}
