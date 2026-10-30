/**
 * SEC-4 — `/auth/refresh` i `/auth/logout`.
 *
 * Dokazuje dual-mode ugovor:
 *  - dok je `AUTH_COOKIE_REFRESH_ENABLED` off, login NE postavlja cookie i
 *    postojeći Bearer tok je nepromijenjen;
 *  - kad je on, login postavlja httpOnly refresh cookie, `/auth/refresh` ga
 *    rotira i vraća novi access token, a `/auth/logout` opoziva i čisti cookie;
 *  - refresh bez cookie-a daje 401, ne 500.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { RefreshTokenService } from '../refresh-token.service';
import { REFRESH_COOKIE_NAME } from '../auth-cookie';

function fakeRes() {
  const cookies: Array<{ name: string; value?: string; options: any }> = [];
  const cleared: Array<{ name: string; options: any }> = [];
  return {
    cookies,
    cleared,
    cookie(name: string, value: string, options: any) {
      cookies.push({ name, value, options });
    },
    clearCookie(name: string, options: any) {
      cleared.push({ name, options });
    },
  };
}

describe('SEC-4: auth cookie rute', () => {
  let controller: AuthController;
  let refreshTokenService: {
    issue: jest.Mock;
    rotate: jest.Mock;
    revoke: jest.Mock;
  };
  let savedFlag: string | undefined;

  beforeEach(async () => {
    savedFlag = process.env.AUTH_COOKIE_REFRESH_ENABLED;
    refreshTokenService = {
      issue: jest.fn(() =>
        Promise.resolve({
          token: 'rt-1',
          expiresAt: new Date(Date.now() + 1000),
        }),
      ),
      rotate: jest.fn(() =>
        Promise.resolve({
          userId: 7,
          token: 'rt-2',
          expiresAt: new Date(Date.now() + 1000),
        }),
      ),
      revoke: jest.fn(() => Promise.resolve(true)),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(() =>
              Promise.resolve({
                user: { id: 7, email: 'a@b.c' },
                token: 'access-1',
              }),
            ),
            register: jest.fn(() =>
              Promise.resolve({ user: { id: 7 }, token: 'access-1' }),
            ),
            me: jest.fn(),
            changePassword: jest.fn(),
            issueAccessToken: jest.fn(() => 'access-2'),
          },
        },
        { provide: RefreshTokenService, useValue: refreshTokenService },
        // JwtAuthGuard je dekorator na `me`/`change-password`, pa ga Nest mora
        // moći instancirati iako ga ovi testovi ne koriste.
        {
          provide: JwtService,
          useValue: { sign: jest.fn(), verify: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: { user: { findUnique: jest.fn() } },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    if (savedFlag === undefined) delete process.env.AUTH_COOKIE_REFRESH_ENABLED;
    else process.env.AUTH_COOKIE_REFRESH_ENABLED = savedFlag;
  });

  describe('zastavica isključena (zadano)', () => {
    it('login NE postavlja cookie i NE izdaje refresh token', async () => {
      delete process.env.AUTH_COOKIE_REFRESH_ENABLED;
      const res = fakeRes();

      const result = await controller.login(
        { identifier: 'a@b.c', password: 'x' },
        res as never,
      );

      expect(result.token).toBe('access-1');
      expect(res.cookies).toHaveLength(0);
      expect(refreshTokenService.issue).not.toHaveBeenCalled();
    });
  });

  describe('zastavica uključena', () => {
    beforeEach(() => {
      process.env.AUTH_COOKIE_REFRESH_ENABLED = 'on';
    });

    it('login postavlja httpOnly refresh cookie', async () => {
      const res = fakeRes();

      await controller.login(
        { identifier: 'a@b.c', password: 'x' },
        res as never,
      );

      expect(res.cookies).toHaveLength(1);
      expect(res.cookies[0].name).toBe(REFRESH_COOKIE_NAME);
      expect(res.cookies[0].value).toBe('rt-1');
      expect(res.cookies[0].options.httpOnly).toBe(true);
    });

    it('refresh rotira token, postavlja novi cookie i vraća novi access token', async () => {
      const res = fakeRes();
      const req = {
        headers: { cookie: `${REFRESH_COOKIE_NAME}=rt-stari` },
      } as never;

      const result = await controller.refresh(req, res as never);

      expect(refreshTokenService.rotate).toHaveBeenCalledWith(
        'rt-stari',
        expect.objectContaining({}),
      );
      expect(result.token).toBeDefined();
      expect(res.cookies[0].name).toBe(REFRESH_COOKIE_NAME);
      expect(res.cookies[0].value).toBe('rt-2');
    });

    it('refresh bez cookie-a daje 401, ne 500', async () => {
      const res = fakeRes();
      const req = { headers: {} } as never;

      await expect(
        controller.refresh(req, res as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokenService.rotate).not.toHaveBeenCalled();
    });

    it('logout opoziva token i čisti cookie', async () => {
      const res = fakeRes();
      const req = {
        headers: { cookie: `${REFRESH_COOKIE_NAME}=rt-1` },
      } as never;

      await controller.logout(req, res as never);

      expect(refreshTokenService.revoke).toHaveBeenCalledWith('rt-1');
      expect(res.cleared[0].name).toBe(REFRESH_COOKIE_NAME);
    });

    it('login s refreshTransport=body NE postavlja cookie a vraća token u tijelu (Android/RN)', async () => {
      const res = fakeRes();

      const result = await controller.login(
        {
          identifier: 'a@b.c',
          password: 'x',
          refreshTransport: 'body',
        } as never,
        res as never,
      );

      // RN nema browser cookie jar, pa cookie ovdje NE smije biti postavljen —
      // umjesto toga klijent dobija token i čuva ga u Android Keystore.
      expect(res.cookies).toHaveLength(0);
      expect((result as { refreshToken?: string }).refreshToken).toBe('rt-1');
    });

    it('login bez refreshTransport NE izlaže token u tijelu (web ostaje httpOnly)', async () => {
      const res = fakeRes();

      const result = await controller.login(
        { identifier: 'a@b.c', password: 'x' },
        res as never,
      );

      expect(res.cookies).toHaveLength(1);
      expect(
        (result as { refreshToken?: string }).refreshToken,
      ).toBeUndefined();
    });

    it('refresh prihvata token iz tijela kad cookie ne postoji', async () => {
      const res = fakeRes();
      const req = { headers: {} } as never;

      const result = await controller.refresh(req, res as never, {
        refreshToken: 'rt-iz-tijela',
      });

      expect(refreshTokenService.rotate).toHaveBeenCalledWith(
        'rt-iz-tijela',
        expect.objectContaining({}),
      );
      expect(result.token).toBeDefined();
      // transport ostaje isti kao ulazni: tijelo, ne cookie
      expect(res.cookies).toHaveLength(0);
    });

    it('cookie ima prednost nad tijelom (web klijent ne može podvaliti stari token)', async () => {
      const res = fakeRes();
      const req = {
        headers: { cookie: `${REFRESH_COOKIE_NAME}=rt-cookie` },
      } as never;

      await controller.refresh(req, res as never, {
        refreshToken: 'rt-tijelo',
      });

      expect(refreshTokenService.rotate).toHaveBeenCalledWith(
        'rt-cookie',
        expect.objectContaining({}),
      );
    });

    it('logout prihvata token iz tijela (Android/RN)', async () => {
      const res = fakeRes();
      const req = { headers: {} } as never;

      await controller.logout(req, res as never, { refreshToken: 'rt-tijelo' });

      expect(refreshTokenService.revoke).toHaveBeenCalledWith('rt-tijelo');
    });

    it('logout bez cookie-a ne baca', async () => {
      const res = fakeRes();
      const req = { headers: {} } as never;

      await expect(controller.logout(req, res as never)).resolves.toBeDefined();
      expect(refreshTokenService.revoke).not.toHaveBeenCalled();
    });
  });
});
