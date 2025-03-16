import * as winston from 'winston';

/**
 * Classification result types
 */
export enum QueryType {
  SEMANTIC = 'semantic',
  FILTER = 'filter',
  AGGREGATION = 'aggregation',
  HYBRID = 'hybrid'
}

/**
 * Query complexity levels
 */
export type QueryComplexity = 'high' | 'medium' | 'low';

/**
 * Extracted entities from a query
 */
export interface QueryEntities {
  product?: string;
  date?: string;
  location?: string;
  category?: string;
  [key: string]: string | undefined;
}

/**
 * Classification result for a query
 */
export interface QueryClassification {
  type: QueryType;
  entities: QueryEntities;
  aggregationFunction: string | null;
  aggregationType: string | null;
  confidence: number;
  complexity: QueryComplexity;
  needsPrecomputed: boolean;
}

/**
 * Service for classifying natural language queries to determine
 * the appropriate execution strategy.
 */
export class QueryClassifierService {
  private logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info) => {
        const { timestamp, level, message, ...rest } = info;
        const formattedMessage = `${timestamp} [${level.toUpperCase()}] [QueryClassifierService]: ${message}`;
        return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf((info) => {
            const { timestamp, level, message, ...rest } = info;
            const formattedMessage = `${timestamp} [${level.toUpperCase()}] [QueryClassifierService]: ${message}`;
            return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
          })
        )
      })
    ]
  });
  private static instance: QueryClassifierService | null = null;
  
  // Rules for classification
  private readonly AGG_KEYWORDS = [
    'total', 'sum', 'average', 'avg', 'count', 'how many', 
    'maximum', 'minimum', 'mean', 'median', 'most', 'least'
  ];
  
  private readonly FILTER_KEYWORDS = [
    'where', 'with', 'for', 'of', 'by', 'that have', 'that are', 'equal to'
  ];
  
  private readonly HIGH_COMPLEXITY_PATTERNS = [
    'compare', 'correlation', 'trend', 'over time', 'growth rate',
    'percentage', 'distribution', 'grouped by', 'segment', 'breakdown'
  ];
  
  // Map natural language to aggregation types
  private readonly AGG_TYPE_MAPPING = {
    'total': 'total_sales_by_product',
    'sum': 'total_sales_by_product',
    'average price': 'average_price_by_product',
    'avg price': 'average_price_by_product',
    'mean price': 'average_price_by_product',
    'count': 'total_quantity_by_product',
    'how many': 'total_quantity_by_product',
    'quantity': 'total_quantity_by_product',
    'sales by category': 'sales_by_category',
    'sales over time': 'sales_by_date_range',
    'sales by date': 'sales_by_date_range'
  };
  
  private constructor() {
    this.logger.info('QueryClassifierService initialized');
  }
  
  /**
   * Gets the singleton instance of the service
   */
  public static getInstance(): QueryClassifierService {
    if (!QueryClassifierService.instance) {
      QueryClassifierService.instance = new QueryClassifierService();
    }
    return QueryClassifierService.instance;
  }
  
  /**
   * Classify a query to determine its type, complexity, and extraction information
   */
  async classifyQuery(query: string): Promise<QueryClassification> {
    // Clean and normalize the query
    const normalizedQuery = query.toLowerCase().trim();
    
    // Check for aggregation patterns
    const hasAggregation = this.AGG_KEYWORDS.some(keyword => 
      normalizedQuery.includes(keyword)
    );
    
    // Check for filter patterns
    const hasFilter = this.FILTER_KEYWORDS.some(keyword => 
      normalizedQuery.includes(keyword)
    );
    
    // Classify based on patterns
    let queryType = QueryType.SEMANTIC;
    if (hasAggregation && hasFilter) {
      queryType = QueryType.HYBRID;
    } else if (hasAggregation) {
      queryType = QueryType.AGGREGATION;
    } else if (hasFilter) {
      queryType = QueryType.FILTER;
    }
    
    // Extract entities (products, dates, etc.)
    const entities = await this.extractEntities(normalizedQuery);
    
    // Identify the main aggregation function if any
    const aggregationFunction = this.identifyAggregationFunction(normalizedQuery);
    
    // Determine the specific aggregation type if this is an aggregation query
    let aggregationType = null;
    if (queryType === QueryType.AGGREGATION || queryType === QueryType.HYBRID) {
      aggregationType = this.determineAggregationType(normalizedQuery, aggregationFunction, entities);
    }
    
    // Determine query complexity
    const complexity = this.determineComplexity(normalizedQuery);
    
    // Determine if query requires precomputed data
    const needsPrecomputed = this.needsPrecomputedData(queryType, complexity, normalizedQuery);
    
    return {
      type: queryType,
      entities,
      aggregationFunction,
      aggregationType,
      confidence: this.calculateConfidence(queryType, normalizedQuery, aggregationType),
      complexity,
      needsPrecomputed
    };
  }
  
  /**
   * Extract entities from the query text
   */
  private async extractEntities(query: string): Promise<QueryEntities> {
    // Extract product names, field names, etc.
    // This could use a more sophisticated NER model in production
    const entities: QueryEntities = {};
    
    // Simple regex pattern matching for demonstration
    const productMatch = query.match(/(?:of|for|about)\s+([a-z\s]+?)(?:\s+and|\s+or|\s+in|\s+from|\?|$)/i);
    if (productMatch && productMatch[1]) {
      entities.product = productMatch[1].trim();
    }
    
    // Match date patterns (years, months, date ranges)
    const dateMatch = query.match(/(?:in|during|for|from)\s+(\d{4}|\w+\s+\d{4}|january|february|march|april|may|june|july|august|september|october|november|december)/i);
    if (dateMatch && dateMatch[1]) {
      entities.date = dateMatch[1].trim();
    }
    
    // Match location patterns
    const locationMatch = query.match(/(?:in|at|from)\s+([a-z\s]+?)(?:\s+and|\s+or|\s+in|\s+from|\?|$)/i);
    if (locationMatch && locationMatch[1] && !entities.date) {
      // Only set as location if not already captured as date (to avoid confusion)
      entities.location = locationMatch[1].trim();
    }
    
    // Match category patterns
    const categoryMatch = query.match(/(?:category|categories|type|types|group|groups)\s+([a-z\s]+?)(?:\s+and|\s+or|\s+in|\s+from|\?|$)/i);
    if (categoryMatch && categoryMatch[1]) {
      entities.category = categoryMatch[1].trim();
    }
    
    return entities;
  }
  
  /**
   * Identify the aggregation function in the query
   */
  private identifyAggregationFunction(query: string): string | null {
    // Map query keywords to aggregation functions
    if (query.includes('total') || query.includes('sum')) {
      return 'sum';
    } else if (query.includes('average') || query.includes('avg')) {
      return 'avg';
    } else if (query.includes('how many') || query.includes('count')) {
      return 'count';
    } else if (query.includes('maximum') || query.includes('highest') || query.includes('max')) {
      return 'max';
    } else if (query.includes('minimum') || query.includes('lowest') || query.includes('min')) {
      return 'min';
    }
    
    return null;
  }
  
  /**
   * Determine query complexity based on patterns
   */
  private determineComplexity(query: string): QueryComplexity {
    // Check for complex query patterns
    const hasHighComplexity = this.HIGH_COMPLEXITY_PATTERNS.some(pattern => 
      query.includes(pattern)
    );
    
    if (hasHighComplexity) {
      return 'high';
    }
    
    // If query has multiple entities or aggregations
    const entityCount = (query.match(/(?:of|for|about|in|during|from|at)\s+([a-z\s]+?)(?:\s+and|\s+or|\s+in|\s+from|\?|$)/ig) || []).length;
    const aggregationCount = this.AGG_KEYWORDS.filter(keyword => query.includes(keyword)).length;
    
    if (entityCount > 1 || aggregationCount > 1) {
      return 'medium';
    }
    
    return 'low';
  }
  
  /**
   * Determine if query should use precomputed data
   */
  private needsPrecomputedData(
    queryType: QueryType, 
    complexity: QueryComplexity, 
    query: string
  ): boolean {
    // High complexity queries likely need precomputed aggregations
    if (complexity === 'high') {
      return true;
    }
    
    // Aggregations and hybrid queries often benefit from precomputed data
    if ((queryType === QueryType.AGGREGATION || queryType === QueryType.HYBRID) && 
        complexity !== 'low') {
      return true;
    }
    
    // Time-based or trend queries typically need precomputed data
    if (query.includes('over time') || 
        query.includes('trend') || 
        query.includes('growth') ||
        query.includes('historical')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Determine the specific type of aggregation needed
   */
  private determineAggregationType(
    query: string,
    aggregationFunction: string | null,
    entities: QueryEntities
  ): string | null {
    // If we have a clear function and product entity, we can map to specific aggregation types
    if (!aggregationFunction) return null;
    
    const hasProduct = !!entities.product;
    const hasCategory = !!entities.category;
    const hasDateRange = !!entities.date;
    
    // Check for direct matches in the mapping
    for (const [pattern, aggType] of Object.entries(this.AGG_TYPE_MAPPING)) {
      if (query.includes(pattern)) {
        // If it's about sales/price/etc. for a product
        if (hasProduct && (aggType === 'total_sales_by_product' || 
                          aggType === 'average_price_by_product' || 
                          aggType === 'total_quantity_by_product')) {
          return aggType;
        }
        // If it's about sales by category
        if (hasCategory && aggType === 'sales_by_category') {
          return aggType;
        }
        // If it's about sales over time
        if (hasDateRange && aggType === 'sales_by_date_range') {
          return aggType;
        }
      }
    }
    
    // Default mapping based on aggregation function
    if (aggregationFunction === 'sum' || aggregationFunction === 'total') {
      if (query.includes('price') || query.includes('revenue') || query.includes('sales')) {
        return 'total_sales_by_product';
      }
      if (query.includes('quantity') || query.includes('units') || query.includes('count')) {
        return 'total_quantity_by_product';
      }
    }
    
    if (aggregationFunction === 'avg' || aggregationFunction === 'average') {
      if (query.includes('price')) {
        return 'average_price_by_product';
      }
    }
    
    // If we couldn't determine a specific type but have an aggregation function
    if (hasProduct) {
      return 'total_sales_by_product'; // Default for products
    }
    
    if (hasCategory) {
      return 'sales_by_category';
    }
    
    if (hasDateRange) {
      return 'sales_by_date_range';
    }
    
    return null;
  }
  
  /**
   * Calculate confidence score with improved scoring for aggregation types
   */
  private calculateConfidence(
    type: QueryType, 
    query: string, 
    aggregationType: string | null
  ): number {
    // Base confidence
    let confidence = 0.7; 
    
    if (type === QueryType.AGGREGATION) {
      // More explicit aggregation queries get higher confidence
      if (query.includes('total') || query.includes('sum of')) {
        confidence += 0.15;
      }
      
      // If we determined a specific aggregation type, increase confidence
      if (aggregationType) {
        confidence += 0.1;
      }
      
      // More specific matches increase confidence
      if (aggregationType === 'total_sales_by_product' && 
         (query.includes('total sales') || query.includes('revenue'))) {
        confidence += 0.05;
      }
      
      if (aggregationType === 'average_price_by_product' && 
         (query.includes('average price') || query.includes('avg price'))) {
        confidence += 0.05;
      }
      
      if (aggregationType === 'total_quantity_by_product' && 
         (query.includes('quantity') || query.includes('how many'))) {
        confidence += 0.05;
      }
    } else if (type === QueryType.FILTER) {
      // Explicit filter queries get higher confidence
      if (query.includes('where') || query.includes('with')) {
        confidence += 0.2;
      }
    } else if (type === QueryType.HYBRID) {
      // Hybrid queries are more complex, so slightly lower confidence
      confidence -= 0.1;
    }
    
    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }
} 