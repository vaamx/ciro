import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HubSpotService } from './connectors/hubspot/HubSpotService';

@Module({
  imports: [ConfigModule],
  providers: [HubSpotService],
  exports: [HubSpotService],
})
export class DataSourceProvidersModule {} 