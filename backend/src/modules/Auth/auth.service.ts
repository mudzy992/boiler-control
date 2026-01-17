// src/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from '../User/dto/register.dto';

interface JwtPayload {
  userId: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(data: RegisterDto) {
    if (!data.email) throw new BadRequestException('Email is required');
    if (!data.password) throw new BadRequestException('Password is required');

    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) throw new BadRequestException('Email already in use');

    const hashed = await bcrypt.hash(data.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: hashed,
        name: data.name,
        homeLocation: data.homeLocation,
      },
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

    return {
      user,
      token: this.signToken(user.id),
    };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        homeLocation: user.homeLocation,
        role: user.role,
        plan: user.plan,
        avatarUrl: user.avatarUrl,
        timezone: user.timezone,
        locale: user.locale,
        prefersDarkMode: user.prefersDarkMode,
      },
      token: this.signToken(user.id),
    };
  }

  async me(userId: number) {
    return this.prisma.user.findUnique({
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
  }

  private signToken(userId: number): string {
    const payload: JwtPayload = { userId };
    return this.jwtService.sign(payload);
  }
}
