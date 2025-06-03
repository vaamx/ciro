import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { TenantService } from '../../common/services/tenant.service';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, TenantService],
  exports: [CustomersService],
})
export class CustomersModule {} 