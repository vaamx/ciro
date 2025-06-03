import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { TenantService } from '../../common/services/tenant.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, TenantService],
  exports: [BillingService],
})
export class BillingModule {} 