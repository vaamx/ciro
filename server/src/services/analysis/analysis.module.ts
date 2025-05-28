import { Module } from '@nestjs/common';
import { QueryAnalysisService } from './query-analysis.service';
import { StatisticalAnalysisService } from '../ai/statistical-analysis.service';
import { ResponseParsingService } from '../ai/response-parsing.service';
import { NlpProcessorService } from '../ai/nlp-processor.service';
import { LLMModule } from '../llm/llm.module';

@Module({
  imports: [LLMModule],
  providers: [QueryAnalysisService, StatisticalAnalysisService, ResponseParsingService, NlpProcessorService],
  exports: [QueryAnalysisService, StatisticalAnalysisService, ResponseParsingService, NlpProcessorService],
})
export class AnalysisModule {} 