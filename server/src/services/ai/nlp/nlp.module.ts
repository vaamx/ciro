import { Module } from '@nestjs/common';
import { QueryClassifierService } from './query-classifier.service';
import { EntityExtractorService } from './entity-extractor.service';
import { TemporalAnalyzerService } from './temporal-analyzer.service';
import { RequirementAnalyzerService } from './requirement-analyzer.service';

// Import factory functions to create service instances
import {
  createQueryClassifierService,
  createEntityExtractorService,
  createTemporalAnalyzerService,
  createRequirementAnalyzerService
} from '../nlp-service-factory';

@Module({
  providers: [
    // Use factory providers instead of class references
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
  ],
  exports: [
    QueryClassifierService,
    EntityExtractorService,
    TemporalAnalyzerService,
    RequirementAnalyzerService,
  ],
})
export class NlpModule {} 