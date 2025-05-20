import { Module } from '@nestjs/common';
import { DataPreprocessingService } from './data-preprocessing.service';

@Module({
  providers: [DataPreprocessingService],
  exports: [DataPreprocessingService],
})
export class DatasourcesProcessorsUtilsModule {} 