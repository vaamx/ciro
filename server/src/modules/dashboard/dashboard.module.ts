import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AuthModule } from '../../core/auth/auth.module';

@Module({
  imports: [
    // Import AuthModule to make JwtAuthGuard available
    AuthModule,
  ],
  controllers: [DashboardController],
  providers: [
    DashboardService,
  ],
  exports: [
    DashboardService
  ]
})
export class DashboardModule {} 