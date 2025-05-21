import { Module } from '@nestjs/common';
import { QueryRouterService } from './query-router.service';
import { AnalysisModule } from '../analysis/analysis.module';
// ConfigModule is global, so no need to import here if QueryRouterService is the only consumer in this module

@Module({
  imports: [AnalysisModule], // Import AnalysisModule to make QueryAnalysisService available
  providers: [QueryRouterService],
  exports: [QueryRouterService], // Export if other modules need QueryRouterService
})
export class CodeExecutionModule {} 