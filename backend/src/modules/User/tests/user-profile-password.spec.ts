import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserService } from '../user.service';

const CURRENT_PASSWORD = 'current-profile-secret';
const NEW_PASSWORD = 'new-profile-secret';

type ProfilePasswordDto = UpdateUserDto & { currentPassword?: string };

describe('UserService profile password potvrda (S-003)', () => {
  let service: UserService;
  let user: any;
  let update: jest.Mock;

  beforeEach(async () => {
    user = {
      id: 42,
      email: 'profile@example.test',
      username: 'profile_user',
      name: 'Prije promjene',
      homeLocation: 'Sarajevo',
      gasPriceExVat: null,
      role: 'USER',
      plan: 'FREE',
      avatarUrl: null,
      timezone: 'Europe/Sarajevo',
      locale: 'bs-BA',
      prefersDarkMode: false,
      updatedAt: new Date('2026-11-04T00:00:00.000Z'),
      passwordHash: await bcrypt.hash(CURRENT_PASSWORD, 4),
    };
    update = jest.fn(({ data, select }) => {
      Object.assign(user, data);
      return Promise.resolve(
        Object.fromEntries(
          Object.entries(select)
            .filter(([, selected]) => selected === true)
            .map(([key]) => [key, user[key]]),
        ),
      );
    });
    const prisma: any = {
      user: {
        findUnique: jest.fn(({ where }) =>
          Promise.resolve(where.id === user.id ? { ...user } : null),
        ),
        update,
      },
    };
    prisma.$transaction = jest.fn((callback) =>
      Promise.resolve(callback(prisma)),
    );
    service = new UserService(prisma as PrismaService);
  });

  it('password bez currentPassword ne mijenja hash niti ostala profilna polja', async () => {
    const originalHash = user.passwordHash;
    const dto: ProfilePasswordDto = {
      name: 'Ne smije se sačuvati',
      password: NEW_PASSWORD,
    };

    await expect(service.updateMe(42, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(update).not.toHaveBeenCalled();
    expect(user.passwordHash).toBe(originalHash);
    expect(user.name).toBe('Prije promjene');
  });

  it('netačan currentPassword odbija cijeli update', async () => {
    const originalHash = user.passwordHash;
    const dto: ProfilePasswordDto = {
      name: 'Ne smije se sačuvati',
      currentPassword: 'wrong-profile-secret',
      password: NEW_PASSWORD,
    };

    await expect(service.updateMe(42, dto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(update).not.toHaveBeenCalled();
    expect(user.passwordHash).toBe(originalHash);
    expect(user.name).toBe('Prije promjene');
  });

  it('tačan currentPassword mijenja hash bez prosljeđivanja tajnih polja Prisma updateu', async () => {
    const originalHash = user.passwordHash;
    const dto: ProfilePasswordDto = {
      name: 'Nakon promjene',
      currentPassword: CURRENT_PASSWORD,
      password: NEW_PASSWORD,
    };

    const response = await service.updateMe(42, dto);

    expect(update).toHaveBeenCalledTimes(1);
    const updateData = update.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('password');
    expect(updateData).not.toHaveProperty('currentPassword');
    expect(updateData).not.toHaveProperty('passwordHash', originalHash);
    expect(user.name).toBe('Nakon promjene');
    expect(await bcrypt.compare(NEW_PASSWORD, user.passwordHash)).toBe(true);
    expect(response).not.toHaveProperty('password');
    expect(response).not.toHaveProperty('currentPassword');
    expect(response).not.toHaveProperty('passwordHash');
  });

  it('običan profilni update bez password polja ostaje nepromijenjen', async () => {
    const originalHash = user.passwordHash;

    const response = await service.updateMe(42, { name: 'Samo profil' });

    expect(response.name).toBe('Samo profil');
    expect(user.passwordHash).toBe(originalHash);
    const updateData = update.mock.calls[0][0].data;
    expect(updateData).toEqual({ name: 'Samo profil' });
  });
});
