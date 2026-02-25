// src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto } from '../User/dto/register.dto';
import { LoginDto } from '../User/dto/login.dto';

interface JwtRequest extends Request {
  user: {
    userId: number;
  };
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto) {
    const identifier = body.identifier ?? body.email;
    return this.authService.login(identifier, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: JwtRequest) {
    return await this.authService.me(req.user.userId);
  }
}
