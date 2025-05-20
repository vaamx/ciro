import { Module } from '@nestjs/common';
import { QueryAnalysisService } from './query-analysis.service';
import { AiModule } from '../ai/ai.module'; // Import AiModule as OpenAIService is a dependency

@Module({
  imports: [AiModule], // Import AiModule
  providers: [QueryAnalysisService],
  exports: [QueryAnalysisService],
})
export class AnalysisModule {} 