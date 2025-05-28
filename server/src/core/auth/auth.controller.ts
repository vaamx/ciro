import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Request
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GetUser } from './get-user.decorator';
import { SafeUser } from '../database/prisma-types';
import { Logger } from '@nestjs/common';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<SafeUser> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(loginDto);
    
    // Return multiple token format options to ensure compatibility with frontend
    return { 
      accessToken: result.accessToken,
      token: result.accessToken, // Alternative property name
      user: {
        email: loginDto.email
      }
    };
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    if (!token) throw new UnauthorizedException('Verification token is missing');
    return this.authService.verifyEmail(token);
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() requestDto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(requestDto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetDto.token, resetDto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getCurrentUser(@GetUser() user: SafeUser) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@GetUser() user: SafeUser) {
    this.logger.log(`Logout request received for user ID: ${user?.id}`);
    if (!user || typeof user.id !== 'number') {
        this.logger.error('User ID not found or invalid in request for logout');
        throw new UnauthorizedException('Invalid user information for logout');
    }
    await this.authService.logout(user.id.toString());
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @GetUser() user: SafeUser,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    return this.authService.changePassword(
      user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword
    );
  }
} 