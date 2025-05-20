import { Module, Logger } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { PrismaModule } from '../../core/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FileController],
  providers: [
    FileService,
    Logger
  ],
  exports: [
    FileService
  ]
})
export class FileModule {} 