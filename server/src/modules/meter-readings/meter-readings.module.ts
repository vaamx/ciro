import { Module } from '@nestjs/common';
import { MeterReadingsService } from './meter-readings.service';
import { MeterReadingsController } from './meter-readings.controller';
import { TenantService } from '../../common/services/tenant.service';

@Module({
  controllers: [MeterReadingsController],
  providers: [MeterReadingsService, TenantService],
  exports: [MeterReadingsService],
})
export class MeterReadingsModule {} 