import { ServerAnalyticsService } from '../ServerAnalyticsService';
import { QueryType, AnalysisDomain } from '../ServerAnalyticsService';
import { DataSourceType } from '../processors/UniversalDataProcessor';

/**
 * Service for entity detection and related functionality
 */
export class EntityDetection {
  private serverAnalyticsService: ServerAnalyticsService;

  constructor() {
    this.serverAnalyticsService = ServerAnalyticsService.getInstance();
  }

  /**
   * Extract entity name from a query
   */
  public extractEntityFromQuery(query: string): string | null {
    const lowerQuery = query.toLowerCase().trim();
    let entityName = null;
    
    if (lowerQuery.startsWith('who is ')) {
      entityName = query.substring(7).trim();
    } else if (lowerQuery.startsWith('tell me about ')) {
      entityName = query.substring(14).trim();
    } else if (lowerQuery.includes('information about ')) {
      const parts = query.split('information about ');
      if (parts.length > 1) {
        entityName = parts[1].trim();
      }
    }
    
    // Remove question marks and other punctuation
    if (entityName) {
      entityName = entityName.replace(/[?!.,;:]+$/, '').trim();
    }
    
    return entityName;
  }

  /**
   * Extract entities using the NLP processor from ServerAnalyticsService
   * This provides more sophisticated entity detection across all data types
   */
  public async extractEntitiesWithNLP(query: string): Promise<string[]> {
    try {
      // Use the NLP service to analyze the query
      const queryAnalysis = await this.serverAnalyticsService.analyzeQuery(query);
      
      // Return entities detected by the NLP processor
      return queryAnalysis.entities || [];
    } catch (error) {
      console.error('Error extracting entities with NLP:', error);
      
      // Fall back to basic entity extraction
      const basicEntity = this.extractEntityFromQuery(query);
      return basicEntity ? [basicEntity] : [];
    }
  }

  /**
   * Check if a document contains an entity - enhanced with NLP capabilities
   */
  public async documentContainsEntityEnhanced(
    document: { 
      content: string; 
      metadata?: { 
        originalText?: string; 
        text?: string;
        [key: string]: any;
      } 
    },
    query: string,
    entityName: string
  ): Promise<boolean> {
    // First try basic entity detection
    const basicContains = this.documentContainsEntity(document, entityName);
    if (basicContains) return true;
    
    try {
      // Use NLP to extract potential entities from the document content
      const documentEntities = await this.extractEntitiesFromText(document.content);
      
      // Get query entities
      const queryEntities = await this.extractEntitiesWithNLP(query);
      
      // Check for overlap between document entities and query entities
      return documentEntities.some(docEntity => 
        queryEntities.some(queryEntity => 
          this.entitiesOverlap(docEntity, queryEntity)
        )
      );
    } catch (error) {
      console.error('Error in enhanced entity detection:', error);
      return basicContains;
    }
  }

  /**
   * Check if two entity strings overlap or are related
   */
  private entitiesOverlap(entity1: string, entity2: string): boolean {
    if (!entity1 || !entity2) return false;
    
    const e1 = entity1.toLowerCase();
    const e2 = entity2.toLowerCase();
    
    // Exact match
    if (e1 === e2) return true;
    
    // One contains the other
    if (e1.includes(e2) || e2.includes(e1)) return true;
    
    // Check for word overlap
    const words1 = e1.split(/\s+/);
    const words2 = e2.split(/\s+/);
    
    // If one entity is multiple words, check for significant word overlap
    if (words1.length > 1 || words2.length > 1) {
      const overlap = words1.filter(w => words2.includes(w));
      return overlap.length >= Math.min(2, Math.min(words1.length, words2.length));
    }
    
    return false;
  }

  /**
   * Extract potential entities from document text using NLP
   */
  private async extractEntitiesFromText(text: string): Promise<string[]> {
    try {
      // Create a pseudo-query that asks about entities in the text
      const pseudoQuery = `Extract important entities from this text: ${text.substring(0, 200)}`;
      
      // Use the NLP service to analyze
      const queryAnalysis = await this.serverAnalyticsService.analyzeQuery(pseudoQuery);
      
      return queryAnalysis.entities || [];
    } catch (error) {
      console.error('Error extracting entities from text:', error);
      return [];
    }
  }

  /**
   * Check if a document contains an entity
   */
  public documentContainsEntity(
    document: { 
      content: string; 
      metadata?: { 
        originalText?: string; 
        text?: string;
        [key: string]: any;
      } 
    },
    entityName: string
  ): boolean {
    if (!entityName || !document) return false;
    
    const entityLower = entityName.toLowerCase();
    const nameParts = entityLower.split(' ');
    
    // Check in content
    const content = document.content.toLowerCase();
    const exactMatch = content.includes(entityLower);
    
    // Check in metadata.originalText if available
    let metadataMatch = false;
    if (document.metadata && document.metadata.originalText) {
      const metadataText = document.metadata.originalText.toLowerCase();
      metadataMatch = metadataText.includes(entityLower);
    }
    
    // Check in metadata.text if available
    let metadataTextMatch = false;
    if (document.metadata && document.metadata.text) {
      const metadataText = document.metadata.text.toLowerCase();
      metadataTextMatch = metadataText.includes(entityLower);
    }
    
    // Check for partial matches (first name, last name) for person entities
    const partialMatch = nameParts.length > 1 && (
      nameParts.every(part => content.includes(part)) || 
      (document.metadata?.originalText && 
        nameParts.every(part => document.metadata!.originalText!.toLowerCase().includes(part))) ||
      (document.metadata?.text && 
        nameParts.every(part => document.metadata!.text!.toLowerCase().includes(part)))
    );
    
    return !!(exactMatch || metadataMatch || metadataTextMatch || partialMatch);
  }

  /**
   * Check if a query is analytical in nature using ServerAnalyticsService
   */
  public async isAnalyticalQueryEnhanced(query: string): Promise<boolean> {
    try {
      // Use the NLP service to analyze the query
      const queryAnalysis = await this.serverAnalyticsService.analyzeQuery(query);
      
      // Consider it analytical if it's not a general query
      const isAnalytical = queryAnalysis.queryType !== QueryType.GENERAL;
      
      console.log(`Enhanced query analysis: ${queryAnalysis.queryType}`);
      return isAnalytical;
    } catch (error) {
      console.error('Error in enhanced analytical query detection:', error);
      
      // Fall back to basic detection
      return this.isAnalyticalQuery(query);
    }
  }

  /**
   * Get domain information for a query
   */
  public async getQueryDomain(query: string): Promise<AnalysisDomain> {
    try {
      // Use the NLP service to analyze the query
      const queryAnalysis = await this.serverAnalyticsService.analyzeQuery(query);
      
      // Return the domain detected by the NLP processor
      return queryAnalysis.domain;
    } catch (error) {
      console.error('Error getting query domain:', error);
      return AnalysisDomain.GENERAL;
    }
  }

  /**
   * Detect the data source type based on document content
   */
  public detectDataSourceType(document: { 
    content: string; 
    metadata?: Record<string, any> 
  }): DataSourceType {
    // Check metadata for explicit type information
    if (document.metadata?.type) {
      const metaType = document.metadata.type.toLowerCase();
      
      if (metaType.includes('excel') || metaType.includes('xlsx')) {
        return DataSourceType.EXCEL;
      } else if (metaType.includes('csv')) {
        return DataSourceType.CSV;
      } else if (metaType.includes('pdf')) {
        return DataSourceType.PDF;
      } else if (metaType.includes('doc') || metaType.includes('docx')) {
        return DataSourceType.DOC;
      } else if (metaType.includes('json')) {
        return DataSourceType.JSON;
      } else if (metaType.includes('text') || metaType.includes('txt')) {
        return DataSourceType.TEXT;
      }
    }
    
    // Analyze content
    const content = document.content || '';
    
    // Check for CSV-like content (commas or tabs with consistent pattern)
    if (this.looksLikeCSV(content)) {
      return DataSourceType.CSV;
    }
    
    // Check for JSON-like content
    if (this.looksLikeJSON(content)) {
      return DataSourceType.JSON;
    }
    
    // Check for tabular structure (rows and columns)
    if (this.looksLikeTable(content)) {
      return DataSourceType.TABLE;
    }
    
    // Default to text
    return DataSourceType.TEXT;
  }
  
  /**
   * Check if content looks like CSV data
   */
  private looksLikeCSV(content: string): boolean {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return false;
    
    // Check for consistent delimiters (comma or tab)
    const firstLineCommas = (lines[0].match(/,/g) || []).length;
    const firstLineTabs = (lines[0].match(/\t/g) || []).length;
    
    const delimiter = firstLineCommas > firstLineTabs ? ',' : '\t';
    const delimiterCount = delimiter === ',' ? firstLineCommas : firstLineTabs;
    
    // Should have at least one delimiter and relatively consistent structure
    if (delimiterCount === 0) return false;
    
    // Check if at least 70% of lines have a similar delimiter count
    let consistentLines = 0;
    for (let i = 1; i < Math.min(10, lines.length); i++) {
      const lineDelimiters = (lines[i].match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
      if (Math.abs(lineDelimiters - delimiterCount) <= 1) {
        consistentLines++;
      }
    }
    
    return (consistentLines / Math.min(lines.length - 1, 9)) >= 0.7;
  }
  
  /**
   * Check if content looks like JSON data
   */
  private looksLikeJSON(content: string): boolean {
    const trimmed = content.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
           (trimmed.startsWith('[') && trimmed.endsWith(']'));
  }
  
  /**
   * Check if content looks like tabular data
   */
  private looksLikeTable(content: string): boolean {
    const lines = content.trim().split('\n');
    if (lines.length < 3) return false;
    
    // Look for consistent spacing patterns that suggest columns
    const spacePattern = /\s{2,}/g;
    const firstLineSpaces = (lines[0].match(spacePattern) || []).length;
    
    if (firstLineSpaces === 0) return false;
    
    // Check consistency across first few lines
    let consistentLines = 0;
    for (let i = 1; i < Math.min(10, lines.length); i++) {
      const lineSpaces = (lines[i].match(spacePattern) || []).length;
      if (Math.abs(lineSpaces - firstLineSpaces) <= 1) {
        consistentLines++;
      }
    }
    
    return (consistentLines / Math.min(lines.length - 1, 9)) >= 0.5;
  }

  /**
   * Check if a query is entity-specific
   */
  public isEntitySpecificQuery(query: string): boolean {
    if (!query) return false;
    
    const lowerQuery = query.toLowerCase();
    
    return (
      (lowerQuery.startsWith('who is') || 
       lowerQuery.startsWith('tell me about') || 
       lowerQuery.includes('information about')) && 
      lowerQuery.split(' ').length >= 3
    );
  }

  /**
   * Check if a query is about VC fund counting
   */
  public isVCFundCountQuery(query: string): boolean {
    if (!query) return false;
    
    const lowerQuery = query.toLowerCase();
    
    // Check for direct mentions of VC funds
    const mentionsVCFunds = 
      lowerQuery.includes('vc fund') || 
      lowerQuery.includes('venture capital fund') ||
      lowerQuery.includes('vc funds') || 
      lowerQuery.includes('venture capital funds');
    
    // Check for counting phrases
    const hasCountingPhrase = 
      lowerQuery.includes('how many') || 
      lowerQuery.includes('count of') || 
      lowerQuery.includes('number of') ||
      lowerQuery.includes('total') ||
      lowerQuery.includes('list all');
    
    // Exclude queries about specific funds
    const isAboutSpecific = 
      lowerQuery.includes('specific') ||
      lowerQuery.includes('particular');
    
    return mentionsVCFunds && hasCountingPhrase && !isAboutSpecific;
  }

  /**
   * Check if a query is analytical in nature
   */
  public isAnalyticalQuery(query: string): boolean {
    if (!query) return false;
    
    const lowerQuery = query.toLowerCase();
    
    // Analytical operation keywords that suggest data analysis
    const analyticalOperations = [
      'analyze', 'analysis', 'compare', 'comparison', 'trend', 'trends',
      'statistics', 'statistical', 'correlation', 'correlate', 'relationship',
      'pattern', 'patterns', 'insight', 'insights', 'summarize', 'summary',
      'evaluate', 'evaluation', 'performance', 'kpi', 'metric', 'metrics',
      'report', 'reporting', 'dashboard', 'visualization', 'chart', 'plot',
      'growth', 'decline', 'increase', 'decrease', 'change', 'difference',
      'forecast', 'projection', 'predict', 'prediction', 'estimate', 'simulation',
      'segment', 'segmentation', 'cluster', 'clustering', 'classification',
      'categorize', 'categorization', 'rank', 'ranking', 'prioritize'
    ];
    
    // Quantitative terms that suggest aggregation or calculation
    const quantitativeTerms = [
      'average', 'mean', 'median', 'mode', 'distribution', 'percentage', 'percent',
      'proportion', 'ratio', 'rate', 'frequency', 'count', 'sum', 'total',
      'minimum', 'maximum', 'range', 'variance', 'standard deviation',
      'quartile', 'percentile', 'aggregate', 'aggregation', 'accumulate',
      'calculate', 'computation', 'formula', 'equation', 'threshold',
      'budget', 'sales', 'revenue', 'profit', 'cost', 'expense', 'margin',
      'balance', 'deficit', 'surplus', 'net', 'gross', 'return', 'roi',
      'target', 'goal', 'achievement', 'actual', 'plan', 'forecast'
    ];
    
    // Question patterns that suggest analytical inquiries
    const analyticalPatterns = [
      /how many|how much|how often|how frequently/i,
      /what (is|are) the (total|sum|average|mean|median|count|number)/i,
      /what percentage|what proportion|what ratio|what rate/i,
      /show me|display|list|give me|provide|present/i,
      /calculate|compute|determine|find out|estimate/i,
      /compare|contrast|differentiate|distinguish/i,
      /identify|detect|discover|uncover|reveal/i,
      /why (is|are|did|does)|what caused|what led to|reason for|explanation for/i,
      /relationship between|correlation between|connection between/i,
      /trend|pattern|change over|development|evolution|progress/i,
      /performance of|results of|outcome of|impact of|effect of/i,
      /breakdown of|distribution of|composition of|structure of/i
    ];
    
    // Time-based terms that suggest trend analysis
    const timePeriods = [
      'year', 'month', 'quarter', 'week', 'day', 'hour',
      'annual', 'monthly', 'quarterly', 'weekly', 'daily', 'hourly',
      'ytd', 'mtd', 'qtd', 'wtd', 'period', 'fiscal', 'calendar',
      'q1', 'q2', 'q3', 'q4', 'january', 'february', 'march', 'april',
      'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
      'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ];
    
    // Basic checks
    const hasAnalyticalOperation = analyticalOperations.some(term => lowerQuery.includes(term));
    const hasQuantitativeTerm = quantitativeTerms.some(term => lowerQuery.includes(term));
    const hasAnalyticalPattern = analyticalPatterns.some(pattern => pattern.test(lowerQuery));
    const hasTimePeriod = timePeriods.some(period => 
      new RegExp(`\\b${period}\\b`, 'i').test(lowerQuery)
    );
    
    // Business/data analysis specific terms
    const hasBussinessDataTerm = /\b(sales|revenue|profit|margin|budget|target|kpi|goal|growth|roi|conversion|retention|churn|customer|client|market|segment|product|service|department|team|employee|staff|headcount|inventory|stock|supply|demand|campaign|initiative|project)\b/i.test(lowerQuery);
    
    // Very explicit pattern for aggregation or computation requests across any data type
    const isExplicitAnalysisRequest = /\b(find|tell me|show|calculate|compute|determine|what is|what are|how many|total number of)\b.+\b(in|across|throughout|for|from|within)\b/i.test(lowerQuery);
    
    // Complex queries containing multiple concepts likely need analytical processing
    const hasMultipleConcepts = (lowerQuery.match(/\b(and|or|vs|versus|compared to|in relation to)\b/g) || []).length >= 1;
    
    // Questions about comprehensive understanding of data
    const isComprehensiveQuery = /\b(all|every|each|any|overall|comprehensive|complete|full|entire|everything about)\b/i.test(lowerQuery);
    
    // For document overview/summary requests
    const isDocumentOverviewQuestion =
      lowerQuery.includes('about this document') ||
      lowerQuery.includes('summarize this document') ||
      lowerQuery.includes('overview of this document') ||
      lowerQuery.includes('what does this document contain');
    
    // The query is analytical if it matches any of these criteria
    return hasAnalyticalOperation || hasQuantitativeTerm || hasAnalyticalPattern || 
           (hasTimePeriod && hasBussinessDataTerm) || isExplicitAnalysisRequest || 
           (hasMultipleConcepts && (hasTimePeriod || hasBussinessDataTerm)) ||
           isComprehensiveQuery || isDocumentOverviewQuestion;
  }

  /**
   * Extract potential entities from a query
   * This is a more general approach to identify what entities a query might be about
   */
  public extractPotentialEntitiesFromQuery(query: string): string[] {
    if (!query) return [];
    
    const entities: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Direct entity extraction from question formats
    if (lowerQuery.includes('about ')) {
      const matches = query.match(/about\s+([A-Z][a-zA-Z\s]+)(?:\?|$|\s+in\s+)/gi);
      if (matches) {
        matches.forEach(match => {
          const entity = match.replace(/about\s+/i, '').replace(/\?$/, '').trim();
          if (entity && entity.length > 1) {
            entities.push(entity);
          }
        });
      }
    }
    
    // For queries asking about counts
    if (/how many|count of|number of/i.test(lowerQuery)) {
      // Extract potential entity after these phrases
      const matches = query.match(/(?:how many|count of|number of)\s+(\w+(?:\s+\w+){0,3})\s+(?:are there|is there|exist|in|for)/i);
      if (matches && matches[1]) {
        entities.push(matches[1].trim());
      }
      
      // Look for entities that follow prepositions
      const entityAfterPrep = query.match(/(?:for|of|about|in)\s+([A-Z][a-zA-Z\s]+)(?:\?|$|\s+)/i);
      if (entityAfterPrep && entityAfterPrep[1]) {
        entities.push(entityAfterPrep[1].trim());
      }
    }
    
    // Extract any proper noun phrases (capitalized words)
    const properNouns = query.match(/\b[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\b/g);
    if (properNouns) {
      properNouns.forEach(noun => {
        if (noun.length > 1 && !['I', 'A', 'The'].includes(noun)) {
          entities.push(noun);
        }
      });
    }
    
    return [...new Set(entities)]; // Remove duplicates
  }
} 