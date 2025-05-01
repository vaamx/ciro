import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SendGridService } from './email.service';

@Module({
  imports: [ConfigModule],
  providers: [SendGridService],
  exports: [SendGridService],
})
export class EmailModule {} 