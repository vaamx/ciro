import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SandboxManagerService } from './sandbox-manager.service';

@Module({
  imports: [ConfigModule],
  providers: [SandboxManagerService],
  exports: [SandboxManagerService],
})
export class SandboxModule {} 