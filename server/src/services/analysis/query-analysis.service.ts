import { Injectable, OnModuleInit } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { LLMService, ChatMessage } from '../llm';
import { AnalyticalOperationType } from '../../types/document/processing';
import { v4 as uuidv4 } from 'uuid';
import { HeuristicOutput, PreprocessedQuery } from '../../types/router.types';
import * as fs from 'fs';
import * as path from 'path';

export enum ChartType {
  BAR_CHART = 'enhanced-bar-chart',
  LINE_CHART = 'line-chart',
  PIE_CHART = 'pie-chart',
  SCATTER_PLOT = 'scatter-plot',
  AREA_CHART = 'area-chart',
  TABLE = 'table',
  NONE = 'none'
}

interface KeywordConfigItem {
  keyword: string;
  weight: number;
}

interface ScoringConfig {
  defaultAnalyticalScore: number;
  defaultRetrievalScore: number;
  maxScore: number;
  minScore: number;
  weights: {
    analyticalKeywordMatch: number; // General weight or multiplier for this category
    retrievalKeywordMatch: number;  // General weight or multiplier for this category
    visualizationRequest: number;
    datasetMention: number;
    codeMention: number;
  };
}

interface QueryAnalysisConfig {
  analyticalKeywords: KeywordConfigItem[];
  retrievalKeywords: KeywordConfigItem[];
  visualizationKeywords: KeywordConfigItem[];
  datasetMentionPatterns: string[]; // Regex patterns
  codeMentionPatterns: string[]; // Regex patterns
  scoring: ScoringConfig; // Added scoring configuration
}

/**
 * Service for analyzing query text and extracting information.
 */
@Injectable()
export class QueryAnalysisService implements OnModuleInit {
  private logger = createServiceLogger('QueryAnalysisService');
  private config!: QueryAnalysisConfig;

  constructor(
    private readonly llmService: LLMService
  ) {
    this.logger.info('QueryAnalysisService initialized with LLM abstraction layer');
  }

  async onModuleInit() {
    try {
      const configPath = path.join(__dirname, '../../config/query-analysis.config.json');
      const configFile = fs.readFileSync(configPath, 'utf-8');
      this.config = JSON.parse(configFile) as QueryAnalysisConfig;
      this.logger.info('QueryAnalysisService configuration loaded successfully.');
    } catch (error) {
      this.logger.error('Failed to load QueryAnalysisService configuration:', error);
      // Fallback to empty config to prevent runtime errors if file is missing/corrupt
      this.config = {
        analyticalKeywords: [],
        retrievalKeywords: [],
        visualizationKeywords: [],
        datasetMentionPatterns: [],
        codeMentionPatterns: [],
        scoring: {
          defaultAnalyticalScore: 0,
          defaultRetrievalScore: 0,
          maxScore: 1,
          minScore: 0,
          weights: {
            analyticalKeywordMatch: 1,
            retrievalKeywordMatch: 1,
            visualizationRequest: 0.5,
            datasetMention: 0.6,
            codeMention: 0.5,
          },
        },
      };
    }
  }

  /**
   * Performs heuristic analysis on the preprocessed query.
   * @param preprocessedQuery The preprocessed query object.
   * @returns A HeuristicOutput object with flags and scores.
   */
  public async runHeuristics(preprocessedQuery: PreprocessedQuery): Promise<HeuristicOutput> {
    const { normalizedQuery } = preprocessedQuery;
    let analyticalScore = this.config.scoring.defaultAnalyticalScore;
    let retrievalScore = this.config.scoring.defaultRetrievalScore;
    let isAnalyticalIntent = false;
    let isRetrievalIntent = false;
    let requestsVisualization = false;
    let mentionsDataset = false;
    let mentionsCode = false;

    if (!normalizedQuery) {
      return {
        isAnalyticalIntent,
        isRetrievalIntent,
        requestsVisualization,
        mentionsDataset,
        mentionsCode,
        analyticalScore,
        retrievalScore,
      };
    }

    // 1. Keyword Matching & Scoring (Task 1.2.3 & 1.2.5 simplified)
    this.config.analyticalKeywords.forEach(item => {
      if (normalizedQuery.includes(item.keyword)) {
        isAnalyticalIntent = true;
        analyticalScore = Math.max(analyticalScore, item.weight);
      }
    });

    this.config.retrievalKeywords.forEach(item => {
      if (normalizedQuery.includes(item.keyword)) {
        isRetrievalIntent = true;
        retrievalScore = Math.max(retrievalScore, item.weight);
      }
    });

    this.config.visualizationKeywords.forEach(item => {
      if (normalizedQuery.includes(item.keyword)) {
        requestsVisualization = true;
        // Optionally boost analytical score if visualization is requested
        analyticalScore = Math.max(analyticalScore, this.config.scoring.weights.visualizationRequest);
      }
    });

    // 2. Pattern Matching (Task 1.2.4 simplified)
    this.config.datasetMentionPatterns.forEach(patternStr => {
      try {
        const regex = new RegExp(patternStr, 'i');
        if (regex.test(normalizedQuery)) {
          mentionsDataset = true;
          analyticalScore = Math.max(analyticalScore, this.config.scoring.weights.datasetMention); // Boost analytical score if dataset mentioned
        }
      } catch (e) {
        this.logger.warn(`Invalid regex pattern in config: ${patternStr}`, e);
      }
    });

    this.config.codeMentionPatterns.forEach(patternStr => {
      try {
        const regex = new RegExp(patternStr, 'i');
        if (regex.test(normalizedQuery)) {
          mentionsCode = true; // Set mentionsCode flag
          analyticalScore = Math.max(analyticalScore, this.config.scoring.weights.codeMention); // Boost analytical score
        }
      } catch (e) {
        this.logger.warn(`Invalid regex pattern in config: ${patternStr}`, e);
      }
    });
    
    // Basic normalization of scores (ensuring they are within configured min-max range)
    // More sophisticated normalization can be added if needed
    analyticalScore = Math.min(this.config.scoring.maxScore, Math.max(this.config.scoring.minScore, analyticalScore));
    retrievalScore = Math.min(this.config.scoring.maxScore, Math.max(this.config.scoring.minScore, retrievalScore));

    // Basic intent conflict resolution (Example: if both high, lean analytical or require clarification)
    if (isAnalyticalIntent && isRetrievalIntent && analyticalScore > 0.7 && retrievalScore > 0.7) {
        this.logger.debug(`Query "${normalizedQuery.substring(0,30)}..." has strong conflicting analytical and retrieval signals.`);
        // Decision to prioritize or flag for clarification will be in QueryRouterService
    }

    const heuristicOutput: HeuristicOutput = {
      isAnalyticalIntent,
      isRetrievalIntent,
      requestsVisualization,
      mentionsDataset,
      mentionsCode,
      analyticalScore,
      retrievalScore,
    };
    this.logger.debug(`Heuristic analysis for "${normalizedQuery.substring(0,30)}...": ${JSON.stringify(heuristicOutput)}`);
    return heuristicOutput;
  }

  /**
   * Determine if a query is analytical in nature
   * Analytical queries may get special handling
   */
  public isAnalyticalQuery(text: string): boolean {
    if (!text) return false; // Handle null/undefined input

    // Add entity lookup patterns
    const entityPatterns = [
      /tell me about\s+(.+)/i,
      /information (on|about)\s+(.+)/i,
      /details (of|about)\s+(.+)/i,
      /who is\s+(.+)/i,
      /what is\s+(.+)/i,
      /describe\s+(.+)/i,
      /explain\s+(.+)/i,
      /show me\s+(.+)/i,
      /find\s+(.+)/i,
      /look up\s+(.+)/i
    ];
    
    // Check entity patterns first
    if (entityPatterns.some(pattern => pattern.test(text))) {
      this.logger.debug(`Query identified as entity lookup: "${text.substring(0, 50)}..."`);
      return true;
    }
    
    // Existing analytical patterns
    const analyticalPatterns = [
      /how many/i,
      /count of/i,
      /number of/i,
      /percentage of/i,
      /analytics/i,
      /statistics/i,
      /aggregate/i,
      /summarize/i,
      /analyze/i,
      /analysis/i,
      /compare/i,
      /comparison/i,
      /trend/i,
      /distribution/i,
      /average/i,
      /mean/i,
      /median/i,
      /mode/i,
      /max/i,
      /min/i,
      /highest/i,
      /lowest/i,
      /rank/i,
      /top/i,
      /bottom/i,
      /which companies/i,
      /which investors/i,
      /which startups/i,
      /which funds/i,
      /which vc/i,
      /which venture/i,
      /list of/i,
      /portfolio of/i,
      /investments by/i,
      /funded by/i,
      /acquired by/i,
      /merged with/i
    ];
    
    const isAnalytical = analyticalPatterns.some(pattern => pattern.test(text));
    if (isAnalytical) {
        this.logger.debug(`Query identified as analytical: "${text.substring(0, 50)}..."`);
    }
    return isAnalytical;
  }

  /**
   * Extract keywords from analytical queries
   */
  public extractKeywords(text: string): string[] {
    if (!text) return []; // Handle null/undefined input

    // Basic cleaning
    const cleanText = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Replace punctuation with space
      .replace(/\s+/g, ' ')      // Replace multiple spaces with single space
      .trim();

    // List of common stop words to filter out
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'shall', 'should',
      'will', 'would', 'may', 'might', 'must', 'that', 'which', 'who', 'whom', 'whose', 'what', 'whatever',
      'of', 'in', 'about', 'as', 'from', 'with', 'into', 'during', 'including', 'until', 'against',
      'among', 'throughout', 'despite', 'towards', 'upon', 'concerning', 'me', 'my', 'mine', 'i',
      'how', 'many', 'much', 'count', 'number', 'list', 'get', 'find', 'show'
    ]);

    // Split into words, filter out stop words, and filter out single characters
    const words = cleanText.split(' ')
      .filter(word => word && !stopWords.has(word) && word.length > 1);

    // Extract phrases (2-3 consecutive words)
    const phrases: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
      if (i < words.length - 2) {
        phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
    }

    // Combine unique words and phrases
    const keywords = [...new Set([...words, ...phrases])];
    this.logger.debug(`Extracted keywords from "${text.substring(0, 50)}...": ${keywords.join(', ')}`);
    return keywords;
  }

  /**
   * Extract potential entity names from content
   * Enhanced to be more robust and work with various document formats
   */
  public extractEntitiesFromContent(content: string): string[] {
    if (!content || typeof content !== 'string') {
      return [];
    }
    
    const entities: Set<string> = new Set();
    
    // Break content into manageable lines
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Skip empty lines
      if (!line.trim()) continue;
      
      // PATTERN 1: Check for labeled entities like "VC Fund: [Name]"
      const labeledPatterns = [
        { regex: /VC Fund:?\s*([^,\n.]+)/i, type: 'vc_fund' },
        { regex: /Fund:?\s*([^,\n.]+)/i, type: 'vc_fund' },
        { regex: /Investor:?\s*([^,\n.]+)/i, type: 'investor' },
        { regex: /Investor Name:?\s*([^,\n.]+)/i, type: 'investor' },
        { regex: /Name:?\s*([^,\n.]+)/i, type: 'name' },
        { regex: /Company:?\s*([^,\n.]+)/i, type: 'company' },
        { regex: /Organization:?\s*([^,\n.]+)/i, type: 'organization' }
      ];
      
      for (const pattern of labeledPatterns) {
        const match = line.match(pattern.regex);
        if (match && match[1] && match[1].trim()) {
          entities.add(match[1].trim());
        }
      }
      
      // PATTERN 2: Table row extraction - look for rows with multiple tabular space separations
      // which are common in the Excel data exports we found
      if (line.includes('  ') && !line.includes('Sheet:') && !line.includes('Column:')) {
        // This might be a tabular data row
        const parts = line.split(/\s{2,}/); // Split by 2+ spaces (common in tabular format)
        
        if (parts.length >= 1 && parts[0].trim()) {
          // First column is often the entity name in tabular data
          entities.add(parts[0].trim());
        }
      }
      
      // PATTERN 3: Look for named entities with typical formats
      const entityPatterns = [
        // VC fund patterns
        /\b([A-Z][A-Za-z0-9]* (?:Capital|Ventures|Partners|VC|Global|Startups))\b/g,
        
        // Look for patterns like "500 Global"
        /\b(\d+\s+(?:Global|Ventures|Capital|Partners))\b/g,
        
        // Common business entities
        /\b([A-Z][A-Za-z0-9]+ [A-Z][A-Za-z0-9]+ (?:Capital|Ventures|Partners|VC|Inc|LLC|Ltd))\b/g,
        
        // Explicitly look for "500 Global" as a special case
        /\b(500 Global)\b/g
      ];
      
      for (const pattern of entityPatterns) {
        const matches = [...line.matchAll(pattern)];
        for (const match of matches) {
          if (match[1] && match[1].trim()) {
            entities.add(match[1].trim());
          }
        }
      }
      
      // PATTERN 4: Sample values list extraction
      if (line.includes('Sample Values:')) {
        const samplesText = line.replace('Sample Values:', '').trim();
        const samples = samplesText.split(/,\s*/); // Split by commas with optional spaces
        
        for (const sample of samples) {
          if (sample && sample.trim()) {
            entities.add(sample.trim());
          }
        }
      }
    }
    
    // Return as array with duplicates removed
    const entitiesArray = Array.from(entities);
    // this.logger.debug(`Extracted ${entitiesArray.length} entities from content (length: ${content.length})`); // Potentially noisy
    return entitiesArray;
  }
  
  /**
   * Count entities in the search results
   * Enhanced to better identify and count unique entities
   */
  public countEntitiesInResults(results: any[]): Record<string, number> {
    const entityCounts: Record<string, number> = {};
    
    for (const result of results) {
      const content = result.content || result.pageContent || '';
      
      // Check if this is already an entity count summary to avoid double-counting
      if (result.metadata?.isEntityCountSummary || result.id === 'entity-count-summary') {
        continue;
      }
      
      // Extract entities from content
      const extractedEntities = this.extractEntitiesFromContent(content);
      
      // Count each entity
      for (const entity of extractedEntities) {
        // Skip short entities that are likely not meaningful
        if (entity.length < 2) continue;
        
        entityCounts[entity] = (entityCounts[entity] || 0) + 1;
      }
      
      // Also look for entities in metadata
      if (result.metadata) {
        const metadata = result.metadata;
        
        // Check common metadata fields that might contain entity names
        const metadataFields = [
          'title', 'name', 'organization', 'vc_fund', 'fund_name', 'company',
          'investor', 'investor_name', 'fund'
        ];
        
        for (const field of metadataFields) {
          if (metadata[field] && typeof metadata[field] === 'string' && metadata[field].trim()) {
            const entity = metadata[field].trim();
            entityCounts[entity] = (entityCounts[entity] || 0) + 1;
          }
        }
      }
    }
    this.logger.debug(`Counted entities in ${results.length} results: ${Object.keys(entityCounts).length} unique entities found.`);
    return entityCounts;
  }

  /**
   * Determine if a query is an entity lookup query
   * These are queries like "Tell me about X" or "Who is Y"
   */
  public isEntityLookupQuery(query: string): boolean {
    if (!query) return false;
    const entityLookupPatterns = [
      /tell me about\s+(.+)/i,
      /information (on|about)\s+(.+)/i,
      /details (of|about)\s+(.+)/i,
      /who is\s+(.+)/i,
      /what is\s+(.+)/i,
      /describe\s+(.+)/i,
      /explain\s+(.+)/i,
      /show me\s+(.+)/i,
      /find\s+(.+)/i,
      /look up\s+(.+)/i
    ];
    const isLookup = entityLookupPatterns.some(pattern => pattern.test(query));
    if (isLookup) {
        this.logger.debug(`Query identified as entity lookup: "${query.substring(0, 50)}..."`);
    }
    return isLookup;
  }

  /**
   * Determine the analytical operations to perform based on the query
   * @param query The user's query
   * @returns Array of analytical operations
   */
  public async determineAnalyticalOperations(query: string): Promise<AnalyticalOperationType[]> {
    const lowerQuery = query.toLowerCase();
    const operations: AnalyticalOperationType[] = [];
    
    // Check for operation keywords (copied from orchestrator)
    if (/summar(y|ize)/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.SUMMARIZE);
    }
    if (/count|how many|number of/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.COUNT);
    }
    if (/average|mean|typical/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.AVERAGE);
    }
    if (/minimum|lowest|smallest/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.MIN);
    }
    if (/maximum|highest|largest/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.MAX);
    }
    if (/sum|total|add up/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.SUM);
    }
    if (/trend|over time|pattern/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.TREND);
    }
    if (/forecast|predict|future/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.FORECAST);
    }
    if (/compare|difference|versus|vs\.|against/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.COMPARE);
    }
    if (/correlat(e|ion)|relationship|between/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.CORRELATE);
    }
    if (/segment|group|categorize|by/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.SEGMENT);
    }
    if (/rank|top|bottom|best|worst/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.RANK);
    }
    if (/categor(y|ies|ize)|classify/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.CATEGORIZE);
    }
    if (/anomal(y|ies)|outlier|unusual/i.test(lowerQuery)) {
      operations.push(AnalyticalOperationType.ANOMALY_DETECTION);
    }
    
    // Use LLM if we don't detect any operations or for complex queries (copied from orchestrator)
    if (operations.length === 0 || query.length > 50) {
      const sysPrompt = `You are an analytical operations classifier. 
Determine which analytical operations are needed to answer the following query.
Choose from these operations: ${Object.values(AnalyticalOperationType).join(', ')}
Return ONLY the operation names separated by commas, nothing else.`;
      
      try {
        const operationsMessages: ChatMessage[] = [
          { 
            id: uuidv4(),
            role: 'system', 
            content: sysPrompt, 
            timestamp: Date.now()
          },
          { 
            id: uuidv4(),
            role: 'user', 
            content: query,
            timestamp: Date.now()
          }
        ];
        
        // Use the injected llmService
        const result = await this.llmService.generateChatCompletion(operationsMessages, {
          model: 'gpt-4o-mini',
          temperature: 0.1,
          taskType: 'simple_qa',
          taskComplexity: 'simple'
        });
        
        if (result && result.content) {
          const content = result.content;
          const llmOperations = content.split(/,\s*/).map((op: string) => op.trim().toLowerCase());
          
          for (const op of llmOperations) {
            const matchedOp = Object.values(AnalyticalOperationType).find(
              validOp => (validOp as string).toLowerCase() === op
            );
            
            if (matchedOp && !operations.includes(matchedOp as AnalyticalOperationType)) {
              operations.push(matchedOp as AnalyticalOperationType);
            }
          }
        }
      } catch (error) {
        this.logger.error('Error determining operations with LLM:', error);
      }
    }
    
    // Ensure we have at least one operation
    if (operations.length === 0) {
      operations.push(AnalyticalOperationType.SUMMARIZE);
    }
    
    this.logger.info(`Determined operations for query "${query.substring(0, 50)}...": ${operations.join(', ')}`);
    return operations;
  }
  
  /**
   * Determine the visualization type based on query and operations
   * @param query The user's query
   * @param operations The analytical operations
   * @returns The suggested visualization type
   */
  public async determineVisualizationType(
    query: string,
    operations: AnalyticalOperationType[]
  ): Promise<ChartType> {
    const lowerQuery = query.toLowerCase();
    
    // Check for explicit visualization requests (copied from orchestrator)
    if (/bar (?:chart|graph)/i.test(lowerQuery)) return ChartType.BAR_CHART;
    if (/line (?:chart|graph)/i.test(lowerQuery)) return ChartType.LINE_CHART;
    if (/pie (?:chart|graph)/i.test(lowerQuery)) return ChartType.PIE_CHART;
    if (/scatter (?:plot|chart|graph)/i.test(lowerQuery)) return ChartType.SCATTER_PLOT;
    if (/area (?:chart|graph)/i.test(lowerQuery)) return ChartType.AREA_CHART;
    if (/heat ?map/i.test(lowerQuery)) return ChartType.NONE;
    if (/table|list/i.test(lowerQuery)) return ChartType.TABLE;
    
    // Infer from operations (copied from orchestrator)
    if (operations.includes(AnalyticalOperationType.TREND) || 
        operations.includes(AnalyticalOperationType.FORECAST)) {
      return ChartType.LINE_CHART;
    }
    if (operations.includes(AnalyticalOperationType.COMPARE)) {
      return ChartType.BAR_CHART;
    }
    if (operations.includes(AnalyticalOperationType.CORRELATE)) {
      return ChartType.SCATTER_PLOT;
    }
    if (operations.includes(AnalyticalOperationType.SEGMENT) && operations.length === 1) {
      return ChartType.PIE_CHART;
    }
    
    // Use LLM for more complex determination (copied from orchestrator)
    const sysPrompt = `You are a data visualization expert. 
Based on the query, determine the most appropriate visualization type.
Choose from these types: ${Object.values(ChartType).join(', ')}
Return ONLY the visualization type name, nothing else.`;
    
    try {
      const operationsText = operations.join(', ');
      const visualizationMessages: ChatMessage[] = [
        { 
          id: uuidv4(),
          role: 'system', 
          content: sysPrompt, 
          timestamp: Date.now()
        },
        { 
          id: uuidv4(),
          role: 'user', 
          content: `Query: ${query}\nOperations: ${operationsText}`,
          timestamp: Date.now()
        }
      ];
      
      // Use the injected llmService
      const result = await this.llmService.generateChatCompletion(visualizationMessages, {
        model: 'gpt-4o-mini',
        temperature: 0.1,
        taskType: 'simple_qa',
        taskComplexity: 'simple'
      });
      
      if (result && result.content) {
        const content = result.content;
        const normalized = content.trim().toLowerCase().replace(/\s+/g, '_');
        
        for (const type of Object.values(ChartType)) {
          if (type.toLowerCase() === normalized) {
            this.logger.info(`Determined visualization type for query "${query.substring(0,50)}...": ${type}`);
            return type as ChartType;
          }
        }
      }
    } catch (error) {
      this.logger.error('Error determining visualization type with LLM:', error);
    }
    
    // Default based on common operations
    if (operations.includes(AnalyticalOperationType.COUNT) || 
        operations.includes(AnalyticalOperationType.SUM)) {
       this.logger.info(`Defaulting visualization type for query "${query.substring(0,50)}...": ${ChartType.BAR_CHART}`);
      return ChartType.BAR_CHART;
    }
    
    this.logger.info(`Defaulting visualization type for query "${query.substring(0,50)}...": ${ChartType.NONE}`);
    return ChartType.NONE;
  }
} 