import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { IQueryAnalyzerService, QueryAnalysis } from './interfaces';  // Import from local interfaces
import { IntentAnalysisService } from './intent-analyzer.service';
import { ComplexityAnalysisService, QueryComplexity } from './complexity-analyzer.service';
import { EntityExtractionService } from './entity-extraction.service';
import { NlpProcessorService } from '../ai/nlp-processor.service';

/**
 * Service for analyzing user queries to determine intent, complexity,
 * data requirements, and visualization needs.
 */
@Injectable()
export class QueryAnalyzerService implements IQueryAnalyzerService {
  private readonly logger = createServiceLogger('QueryAnalyzerService');
  
  private visualizationPatterns = [
    /chart/i, /graph/i, /visual/i, /plot/i, /dashboard/i, /diagram/i, /show me/i, 
    /display/i, /visualize/i, /visualisation/i, /visualization/i
  ];

  private analyticalPatterns = [
    /trend/i, /compare/i, /analysis/i, /growth/i, /calculate/i, /report/i,
    /metric/i, /analytics/i, /forecast/i, /projection/i, /performance/i,
    /statistics/i, /insight/i, /kpi/i
  ];

  constructor(
    private readonly intentAnalyzer: IntentAnalysisService,
    private readonly complexityAnalyzer: ComplexityAnalysisService,
    @Inject(forwardRef(() => EntityExtractionService))
    private readonly entityExtractor: EntityExtractionService,
    private readonly nlpProcessor: NlpProcessorService
  ) {
    this.logger.info('QueryAnalyzerService initialized');
  }

  /**
   * Analyze a query to determine intent, complexity, and requirements
   * This is a newer, enhanced version of the analyzeQueryIntent method
   */
  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    this.logger.info(`Analyzing query: "${query}"`);
    
    // Get initial analysis - using non-async version to match interface
    const basicAnalysis = this.analyzeQueryIntent(query);
    
    // Use the injected service for entity types (await the async method)
    const entityTypes = await this.entityExtractor.extractEntities(query);
    
    // Add additional analysis needed
    return {
      ...basicAnalysis,
      entityTypes
    };
  }

  /**
   * Analyze a query to determine intent and complexity
   * @param query The user query
   * @returns Analysis of the query
   */
  analyzeQueryIntent(query: string): QueryAnalysis {
    try {
      const analysis: QueryAnalysis = {
        intent: 'query',  // Default intent
        entities: [],     // Will be populated with extracted entities
        complexity: 'medium', // Default complexity as string
        dataVisualization: false, // Default - not requiring visualization
        searchLimit: 5,    // Default number of documents to retrieve
        similarityThreshold: 0.7, // Default similarity threshold
        isAnalytical: false // Default - not an analytical query
      };

      // Let's analyze the query
      this.logger.info(`Analyzing query: ${query}`);

      // Determine the complexity of the query - use synchronous determineComplexity instead
      const complexityResult = this.complexityAnalyzer.determineComplexity(query);
      // Set the complexity directly from the result
      if (typeof complexityResult === 'string') {
        analysis.complexity = complexityResult;
      }
      
      // Extract entities from the query
      analysis.entities = this.extractEntitiesSync(query);
      
      // Check if the query is about time-based data
      const timeFrame = this.extractTimeFrame(query);
      if (timeFrame && typeof timeFrame !== 'string' && 'timeframe' in timeFrame && timeFrame.timeframe) {
        analysis.timeFrame = timeFrame.timeframe;
      }

      // Check if the query requires full dataset or just a summary/visualization
      if (this.needsFullDataset(query)) {
        analysis.requiresFullDataset = true;
        analysis.searchLimit = 20; // Increase search limit for full dataset queries
      }

      // Determine if the query might benefit from data visualization
      analysis.dataVisualization = this.needsDataVisualization(query);
      
      // Check if the query is analytical in nature
      analysis.isAnalytical = this.analyticalPatterns.some(pattern => pattern.test(query));

      // Adjust search limit based on complexity
      if (analysis.complexity === 'high') {
        analysis.searchLimit = 10; // More documents for complex queries
      } else if (analysis.complexity === 'low') {
        analysis.searchLimit = 3; // Fewer documents for simple queries
      }

      this.logger.info(`Query analysis complete. Complexity: ${analysis.complexity}, Entities: ${analysis.entities.join(', ')}`);
      return analysis;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error analyzing query: ${errorMessage}`, errorStack);
      return {
        intent: 'query',
        entities: [],
        complexity: 'medium', // Return as string to match interface
        dataVisualization: false,
        searchLimit: 5,
        similarityThreshold: 0.7,
        isAnalytical: false
      };
    }
  }

  /**
   * Simple synchronous entity extraction for use in non-async methods
   * Uses basic pattern matching for common entity types
   */
  private extractEntitiesSync(query: string): string[] {
    const entities: string[] = [];
    const entityPatterns = [
      { pattern: /company|companies|startup|startups/gi, entity: 'company' },
      { pattern: /product|products/gi, entity: 'product' },
      { pattern: /investor|investors/gi, entity: 'investor' },
      { pattern: /person|people|individual|individuals/gi, entity: 'person' },
      { pattern: /fund|funds/gi, entity: 'fund' },
      { pattern: /industry|industries|sector|sectors/gi, entity: 'industry' }
    ];
    
    // Extract potential entities
    for (const { pattern, entity } of entityPatterns) {
      if (pattern.test(query)) {
        entities.push(entity);
      }
    }
    
    return [...new Set(entities)]; // Remove duplicates
  }

  /**
   * Converts a numeric complexity score to string representation
   * @param complexityScore Numeric complexity score (1-10)
   * @returns String representation of complexity
   */
  private convertComplexityToString(complexityScore: number): 'high' | 'medium' | 'low' {
    if (complexityScore <= 3) {
      return 'low';
    } else if (complexityScore <= 7) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  /**
   * Determine if the query needs data visualization
   */
  private needsDataVisualization(query: string): boolean {
    // Check for explicit visualization requests
    const visualizationPatterns = [
      /visualize/i,
      /visualization/i,
      /chart/i,
      /graph/i,
      /plot/i,
      /diagram/i,
      /figure/i,
      /dashboard/i,
      /trend/i,
      /distribution/i,
      /show me.*trend/i,
      /show me.*distribution/i,
      /show me.*graph/i,
      /show me.*chart/i
    ];
    
    for (const pattern of visualizationPatterns) {
      if (pattern.test(query)) {
        return true;
      }
    }
    
    // Also recommend visualization for certain analytical patterns
    const analyticalPatterns = [
      /compare/i,
      /distribution/i,
      /over time/i,
      /trend/i,
      /growth/i,
      /decline/i,
      /change/i,
      /top/i,
      /bottom/i,
      /most/i,
      /least/i,
      /highest/i,
      /lowest/i,
      /best/i,
      /worst/i
    ];
    
    for (const pattern of analyticalPatterns) {
      if (pattern.test(query)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Extract time frame from the query
   */
  private extractTimeFrame(query: string): QueryComplexity | undefined {
    // Look for time-related phrases
    const timeFramePatterns = [
      { pattern: /past (\d+) (day|week|month|year)s?/i, format: 'past $1 $2s' },
      { pattern: /last (\d+) (day|week|month|year)s?/i, format: 'last $1 $2s' },
      { pattern: /since (January|February|March|April|May|June|July|August|September|October|November|December)( \d{4})?/i, format: 'since $1$2' },
      { pattern: /from (\d{4}) to (\d{4})/i, format: 'from $1 to $2' },
      { pattern: /in (\d{4})/i, format: 'in $1' },
      { pattern: /(\d{4})-(\d{4})/i, format: '$1-$2' },
      { pattern: /recent/i, format: 'recent' },
      { pattern: /current/i, format: 'current' }
    ];
    
    for (const { pattern, format } of timeFramePatterns) {
      const match = query.match(pattern);
      if (match) {
        // Replace capture groups in format string
        const timeFrame: QueryComplexity = {
          timeframe: format.replace(/\$(\d+)/g, (_, index) => match[parseInt(index)] || ''),
          from: null,
          to: null,
          period: null
        };
        
        // Extract date range
        const dateRange = timeFrame.timeframe?.match(/from (\d{4}) to (\d{4})/i);
        if (dateRange) {
          timeFrame.from = dateRange[1];
          timeFrame.to = dateRange[2];
        }
        
        return timeFrame;
      }
    }
    
    return undefined;
  }

  /**
   * Determine if a query requires processing the entire dataset
   * Used for analytical queries that need complete data coverage
   */
  private needsFullDataset(query: string): boolean {
    const fullDataPatterns = [
      /total/i,
      /all/i,
      /entire/i,
      /complete/i,
      /full/i,
      /every/i,
      /overall/i,
      /aggregate/i,
      /sum of all/i,
      /sum of/i,
      /sum up/i,
      /across all/i,
      /across the/i
    ];
    
    // Analytics on metrics almost always need full dataset
    const metricPatterns = [
      /sales/i,
      /revenue/i,
      /profit/i,
      /cost/i,
      /expense/i,
      /income/i,
      /margin/i,
      /growth/i,
      /production/i,
      /inventory/i,
      /volume/i,
      /quantity/i
    ];
    
    // Check for analytics functions
    const analyticsPatterns = [
      /average/i,
      /mean/i,
      /median/i,
      /mode/i,
      /forecast/i,
      /predict/i,
      /trend/i,
      /distribution/i
    ];
    
    const hasFullDataIndicator = fullDataPatterns.some(pattern => pattern.test(query));
    const hasMetricIndicator = metricPatterns.some(pattern => pattern.test(query));
    const hasAnalyticsIndicator = analyticsPatterns.some(pattern => pattern.test(query));
    
    // Need full dataset if we have a "full data" indicator,
    // or if we have both a metric and an analytics function
    return hasFullDataIndicator || (hasMetricIndicator && hasAnalyticsIndicator);
  }
} 