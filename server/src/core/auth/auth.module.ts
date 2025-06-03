import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../database/prisma.module';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard, AnyPermissionsGuard } from './permissions.guard';
import { TenantScopeGuard } from './tenant-scope.guard';
import { UserManagementController } from './user-management.controller';
import { EmailService } from './email/email.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    ConfigModule,
  ],
  controllers: [AuthController, UserManagementController],
  providers: [
    AuthService, 
    JwtStrategy,
    RolesGuard,
    PermissionsGuard,
    AnyPermissionsGuard,
    TenantScopeGuard,
    EmailService,
  ],
  exports: [
    AuthService,
    RolesGuard,
    PermissionsGuard,
    AnyPermissionsGuard,
    TenantScopeGuard,
  ],
})
export class AuthModule {} 