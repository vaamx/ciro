/**
 * Factory functions to provide instances of NLP services for DI
 * Used because the actual services have private constructors
 */

import { QueryClassifierService } from './nlp/query-classifier.service';
import { EntityExtractorService } from './nlp/entity-extractor.service';
import { TemporalAnalyzerService } from './nlp/temporal-analyzer.service';
import { RequirementAnalyzerService } from './nlp/requirement-analyzer.service';
import { QueryType, AnalysisDomain, QueryComplexity } from './nlp';
import { createServiceLogger } from '../../common/utils/logger-factory';

/**
 * Create and return a QueryClassifierService instance
 * This is used as a factory function for NestJS dependency injection
 */
export function createQueryClassifierService(): QueryClassifierService {
  // Create a mock implementation with type assertion to handle private members
  return {
    detectQueryType: () => QueryType.GENERAL,
    identifyDomain: () => AnalysisDomain.GENERAL,
    determineQueryComplexity: () => QueryComplexity.MEDIUM
  } as unknown as QueryClassifierService;
}

/**
 * Create and return an EntityExtractorService instance
 */
export function createEntityExtractorService(): EntityExtractorService {
  // Create a mock implementation with type assertion to handle private members
  return {
    logger: createServiceLogger('EntityExtractorService'),
    extractEntities: () => []
  } as unknown as EntityExtractorService;
}

/**
 * Create and return a TemporalAnalyzerService instance
 */
export function createTemporalAnalyzerService(): TemporalAnalyzerService {
  // Create a mock implementation with type assertion to handle private members
  return {
    analyzeTemporal: () => ({
      hasTemporalReference: false,
      isTimeSeries: false
    })
  } as unknown as TemporalAnalyzerService;
}

/**
 * Create and return a RequirementAnalyzerService instance
 */
export function createRequirementAnalyzerService(): RequirementAnalyzerService {
  // Create a mock implementation with type assertion to handle private members
  return {
    logger: createServiceLogger('RequirementAnalyzerService'),
    identifyDataRequirements: () => ({
      requiredVariables: [],
      optionalVariables: [],
      aggregations: [],
      filters: []
    }),
    suggestAnalyses: () => [],
    suggestVisualizations: () => []
  } as unknown as RequirementAnalyzerService;
} 