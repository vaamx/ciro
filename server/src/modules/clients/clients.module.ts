import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { TenantService } from '../../common/services/tenant.service';

@Module({
  controllers: [ClientsController],
  providers: [ClientsService, TenantService],
  exports: [ClientsService],
})
export class ClientsModule {} 