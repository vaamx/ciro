import { Injectable, Optional } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { createServiceLogger } from '../../common/utils/logger-factory';
import {
  QueryType,
  AnalysisDomain,
  QueryComplexity,
  QueryClassifierService,
  EntityExtractorService,
  TemporalAnalysisResult,
  TemporalAnalyzerService,
  DataRequirements,
  RequirementAnalyzerService
} from './nlp';

/**
 * Results of query analysis
 */
export interface QueryAnalysisResult {
  id: string;
  originalQuery: string;
  queryType: QueryType;
  domain: AnalysisDomain;
  complexity: QueryComplexity;
  entities: string[];
  temporalAspects: TemporalAnalysisResult;
  dataRequirements: DataRequirements;
  suggestedAnalyses: string[];
  suggestedVisualizations: string[];
  confidenceScore: number;
}

/**
 * Follow-up question for clarification
 */
export interface ClarificationQuestion {
  id: string;
  question: string;
  context: string;
  possibleAnswers?: string[];
  impact: 'high' | 'medium' | 'low';
  answerField: string;
}

/**
 * Service for NLP processing and query understanding
 */
@Injectable()
export class NlpProcessorService {
  
  private readonly logger = createServiceLogger('NlpProcessorService');
  private readonly queryClassifier: any;
  private readonly entityExtractor: any;
  private readonly temporalAnalyzer: any;
  private readonly requirementAnalyzer: any;

  constructor(
    @Optional() private readonly queryClassifierService?: any,
    @Optional() private readonly entityExtractorService?: any,
    @Optional() private readonly temporalAnalyzerService?: any,
    @Optional() private readonly requirementAnalyzerService?: any,
    ) {
    this.logger.info('Initializing NlpProcessorService');
    
    // Use provided services or create mock implementations
    this.queryClassifier = this.queryClassifierService || this.createMockQueryClassifier();
    this.entityExtractor = this.entityExtractorService || this.createMockEntityExtractor();
    this.temporalAnalyzer = this.temporalAnalyzerService || this.createMockTemporalAnalyzer();
    this.requirementAnalyzer = this.requirementAnalyzerService || this.createMockRequirementAnalyzer();
  }

  /**
   * Create a mock query classifier if the real one is not provided
   */
  private createMockQueryClassifier() {
    return {
      detectQueryType: (query: string) => QueryType.GENERAL,
      identifyDomain: (query: string) => AnalysisDomain.GENERAL,
      determineQueryComplexity: () => QueryComplexity.MEDIUM
    };
  }

  /**
   * Create a mock entity extractor if the real one is not provided
   */
  private createMockEntityExtractor() {
    return {
      extractEntities: (query: string) => []
    };
  }

  /**
   * Create a mock temporal analyzer if the real one is not provided
   */
  private createMockTemporalAnalyzer() {
    return {
      analyzeTemporal: (query: string) => ({
        hasTemporalReference: false,
        isTimeSeries: false
      })
    };
  }

  /**
   * Create a mock requirement analyzer if the real one is not provided
   */
  private createMockRequirementAnalyzer() {
    return {
      identifyDataRequirements: () => ({
        requiredVariables: [],
        optionalVariables: [],
        aggregations: [],
        filters: []
      }),
      suggestAnalyses: () => [],
      suggestVisualizations: () => []
    };
  }

  /**
   * Analyze a query to determine its type, complexity, and requirements
   * @param query The user's query
   * @returns Analysis result
   */
  public analyzeQuery(query: string): QueryAnalysisResult {
    try {
      const normalizedQuery = this.normalizeQuery(query);
      
      // Detect query type
      const queryType = this.queryClassifier.detectQueryType(normalizedQuery);
      
      // Identify domain
      const domain = this.queryClassifier.identifyDomain(normalizedQuery);
      
      // Extract entities
      const entities = this.entityExtractor.extractEntities(normalizedQuery);
      
      // Determine complexity
      const complexity = this.queryClassifier.determineQueryComplexity(normalizedQuery, queryType, entities);
      
      // Analyze temporal aspects
      const temporalAspects = this.temporalAnalyzer.analyzeTemporal(normalizedQuery);
      
      // Identify data requirements
      const dataRequirements = this.requirementAnalyzer.identifyDataRequirements(normalizedQuery, queryType, entities);
      
      // Suggest analyses and visualizations
      const suggestedAnalyses = this.requirementAnalyzer.suggestAnalyses(queryType, domain, entities, temporalAspects);
      const suggestedVisualizations = this.requirementAnalyzer.suggestVisualizations(queryType, dataRequirements);
      
      // Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(queryType, entities, dataRequirements);
      
      return {
        id: uuidv4(),
        originalQuery: query,
        queryType,
        domain,
        complexity,
        entities,
        temporalAspects,
        dataRequirements,
        suggestedAnalyses,
        suggestedVisualizations,
        confidenceScore
      };
    } catch (error) {
      this.logger.error('Error analyzing query:', error);
      
      // Return a default analysis with low confidence
      return {
        id: uuidv4(),
        originalQuery: query,
        queryType: QueryType.GENERAL,
        domain: AnalysisDomain.GENERAL,
        complexity: QueryComplexity.MEDIUM,
        entities: [],
        temporalAspects: {
          hasTemporalReference: false,
          isTimeSeries: false
        },
        dataRequirements: {
          requiredVariables: [],
          optionalVariables: [],
          aggregations: [],
          filters: []
        },
        suggestedAnalyses: [],
        suggestedVisualizations: [],
        confidenceScore: 0.3
      };
    }
  }

  /**
   * Normalize a query by converting to lowercase, removing extra spaces, etc.
   * @param query The query to normalize
   * @returns Normalized query
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate a confidence score for the analysis
   */
  private calculateConfidenceScore(
    queryType: QueryType,
    entities: string[],
    dataRequirements: DataRequirements
  ): number {
    // Base confidence score
    let score = 0.6;
    
    // Adjust based on query type
    if (queryType !== QueryType.GENERAL) {
      score += 0.1;
    }
    
    // Adjust based on entities identified
    if (entities.length > 0) {
      score += Math.min(0.15, entities.length * 0.05);
    }
    
    // Adjust based on data requirements identified
    const reqVars = dataRequirements.requiredVariables.length;
    const filters = dataRequirements.filters.length;
    
    if (reqVars > 0) {
      score += Math.min(0.1, reqVars * 0.02);
    }
    
    if (filters > 0) {
      score += Math.min(0.05, filters * 0.01);
    }
    
    // Cap the score at 0.95 (nothing is ever 100% certain)
    return Math.min(0.95, score);
  }
} 