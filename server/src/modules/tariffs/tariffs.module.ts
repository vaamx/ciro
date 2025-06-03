import { Module } from '@nestjs/common';
import { TariffsService } from './tariffs.service';
import { TariffsController } from './tariffs.controller';
import { TenantService } from '../../common/services/tenant.service';

@Module({
  controllers: [TariffsController],
  providers: [TariffsService, TenantService],
  exports: [TariffsService],
})
export class TariffsModule {} 