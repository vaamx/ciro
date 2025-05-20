import { Module } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { EmbeddingService } from './embedding.service';
import { StatisticalAnalysisService } from './statistical-analysis.service';
import { LlmAnalysisService } from './llm-analysis.service';
import { ResponseParsingService } from './response-parsing.service';
import { NlpProcessorService } from './nlp-processor.service'; 
import { CodeGenerationService } from './code-generator.service';
import { QueryClassifierService } from './nlp/query-classifier.service';
import { EntityExtractorService } from './nlp/entity-extractor.service';
import { TemporalAnalyzerService } from './nlp/temporal-analyzer.service';
import { RequirementAnalyzerService } from './nlp/requirement-analyzer.service';

// Import the mock implementation of the NLP services for DI
import { 
  createQueryClassifierService,
  createEntityExtractorService,
  createTemporalAnalyzerService,
  createRequirementAnalyzerService
} from './nlp-service-factory';

@Module({
  providers: [
    OpenAIService,
    EmbeddingService,
    StatisticalAnalysisService,
    LlmAnalysisService,
    ResponseParsingService,
    
    // NLP related services with factory providers
    {
      provide: QueryClassifierService,
      useFactory: createQueryClassifierService,
    },
    {
      provide: EntityExtractorService,
      useFactory: createEntityExtractorService,
    },
    {
      provide: TemporalAnalyzerService,
      useFactory: createTemporalAnalyzerService,
    },
    {
      provide: RequirementAnalyzerService,
      useFactory: createRequirementAnalyzerService,
    },
    
    // This service depends on the NLP services above
    NlpProcessorService,
    CodeGenerationService,
  ],
  exports: [
    OpenAIService,
    EmbeddingService,
    StatisticalAnalysisService,
    LlmAnalysisService,
    ResponseParsingService,
    
    // Export NLP services
    QueryClassifierService,
    EntityExtractorService,
    TemporalAnalyzerService,
    RequirementAnalyzerService,
    NlpProcessorService,
    CodeGenerationService,
  ],
})
export class AiModule {} 