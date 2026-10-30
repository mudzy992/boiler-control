// src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RefreshTokenService } from './refresh-token.service';
import { RefreshDto } from './dto/refresh.dto';
import {
  authCookieEnabled,
  clearRefreshCookie,
  readCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
} from './auth-cookie';
import { RegisterDto } from '../User/dto/register.dto';
import { LoginDto } from '../User/dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  AuthUserWithTimestampsDto,
  LoginResponseDto,
  MessageResponseDto,
  RegisterResponseDto,
} from './dto/auth-response.dto';

interface JwtRequest extends Request {
  user: {
    userId: number;
  };
}

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /**
   * SEC-4: postavlja httpOnly refresh cookie, ali SAMO kad je zastavica
   * uključena. Dok je `off`, ponašanje je doslovno ono prije ove promjene —
   * odgovor ostaje isti i nikakav cookie se ne šalje.
   */
  private async issueRefresh(
    res: Response,
    userId: number,
    transport: 'cookie' | 'body' | undefined,
  ): Promise<string | undefined> {
    if (!authCookieEnabled()) return undefined;
    const issued = await this.refreshTokenService.issue(userId);

    // `body` je za React Native klijente bez browser cookie jar-a; oni čuvaju
    // token u Android Keystore. Web ostaje na httpOnly cookie-ju, pa token
    // nikad ne izlazi u tijelo odgovora.
    if (transport === 'body') return issued.token;

    setRefreshCookie(
      res as never,
      issued.token,
      issued.expiresAt.getTime() - Date.now(),
    );
    return undefined;
  }

  @Post('register')
  @ApiCreatedResponse({ type: RegisterResponseDto })
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(body);
    const refreshToken = await this.issueRefresh(
      res,
      result.user.id,
      body.refreshTransport,
    );
    return refreshToken ? { ...result, refreshToken } : result;
  }

  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: LoginResponseDto })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const identifier = body.identifier ?? body.email;
    const result = await this.authService.login(identifier, body.password);
    const refreshToken = await this.issueRefresh(
      res,
      result.user.id,
      body.refreshTransport,
    );
    return refreshToken ? { ...result, refreshToken } : result;
  }

  /**
   * SEC-4: rotira refresh token iz httpOnly cookie-ja i vraća novi access
   * token. Access token namjerno ostaje u tijelu odgovora (kratka života),
   * pa `JwtAuthGuard` i postojeći Bearer klijenti ostaju nepromijenjeni.
   */
  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: LoginResponseDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: RefreshDto,
  ) {
    if (!authCookieEnabled()) {
      throw new UnauthorizedException('Refresh token flow is not enabled');
    }
    // Cookie ima prednost: web klijent ga šalje automatski i ne može ga
    // zaobići tijelom. RN klijent nema cookie, pa pada na tijelo.
    const cookieToken = readCookie(req.headers.cookie, REFRESH_COOKIE_NAME);
    const token = cookieToken ?? body?.refreshToken;
    if (!token) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const rotated = await this.refreshTokenService.rotate(token, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    const accessToken = this.authService.issueAccessToken(rotated.userId);

    // Transport ostaje onaj kojim je token i stigao.
    if (cookieToken) {
      setRefreshCookie(
        res as never,
        rotated.token,
        rotated.expiresAt.getTime() - Date.now(),
      );
      return { token: accessToken };
    }
    return { token: accessToken, refreshToken: rotated.token };
  }

  /** SEC-4: opoziva refresh token i čisti cookie. Bez cookie-a ne baca. */
  @Post('logout')
  @HttpCode(200)
  @ApiOkResponse({ type: MessageResponseDto })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: RefreshDto,
  ) {
    const token =
      readCookie(req.headers.cookie, REFRESH_COOKIE_NAME) ?? body?.refreshToken;
    if (token) {
      await this.refreshTokenService.revoke(token);
    }
    clearRefreshCookie(res as never);
    return { message: 'Logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOkResponse({ type: AuthUserWithTimestampsDto })
  async me(@Req() req: JwtRequest) {
    return await this.authService.me(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(200)
  @ApiOkResponse({ type: MessageResponseDto })
  async changePassword(
    @Req() req: JwtRequest,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      req.user.userId,
      body.currentPassword,
      body.newPassword,
    );
  }
}
