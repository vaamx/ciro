import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { BillingService } from '../billing/billing.service';
import { TenantService } from '../../common/services/tenant.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, BillingService, TenantService],
  exports: [InvoicesService],
})
export class InvoicesModule {} 