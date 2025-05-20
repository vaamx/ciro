import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { ServicesModule } from '../../services.module';

@Module({
  imports: [
    ServicesModule
  ],
  controllers: [ProxyController],
  providers: [
    // Add ProxyService or other providers when they are created
  ],
  exports: [
    // Export services if they need to be used in other modules
  ]
})
export class ProxyModule {} 