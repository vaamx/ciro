import { Module } from '@nestjs/common';
import { QueryAnalysisService } from './query-analysis.service';
import { LLMModule } from '../llm/llm.module';

@Module({
  imports: [LLMModule],
  providers: [QueryAnalysisService],
  exports: [QueryAnalysisService],
})
export class AnalysisModule {} 