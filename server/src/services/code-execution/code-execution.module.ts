import { Module, forwardRef } from '@nestjs/common';
import { QueryRouterService } from './query-router.service';
import { AnalysisModule } from '../analysis/analysis.module';
import { SandboxModule } from '../sandbox/sandbox.module';
import { AiModule } from '../ai/ai.module';
import { ServicesModule } from '../../services.module';
// ConfigModule is global, so no need to import here if QueryRouterService is the only consumer in this module

@Module({
  imports: [
    AnalysisModule, // Import AnalysisModule to make QueryAnalysisService available
    SandboxModule, // Import SandboxModule for SandboxManagerService
    forwardRef(() => AiModule), // Import AiModule for OpenAIService
    forwardRef(() => ServicesModule), // Import ServicesModule for AnalyticalRAGService
  ],
  providers: [QueryRouterService],
  exports: [QueryRouterService], // Export if other modules need QueryRouterService
})
export class CodeExecutionModule {} 