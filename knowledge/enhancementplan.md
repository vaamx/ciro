5. Implementation Roadmap

Phase 1: Metadata Enhancement (2-3 weeks)
Update your embedding pipeline to extract and store richer metadata
Implement a secondary index for exact matching on key fields
Add metadata about numeric ranges and contained entities

Phase 2: Query Planning System (3-4 weeks)
Build a query classifier to detect aggregation needs
Implement strategy selector for different query types
Create an efficient chunked processing system for full table scans

Phase 3: Pre-computed Aggregations (2-3 weeks)
Identify common aggregation patterns from user queries
Build a scheduled job to compute and embed aggregations
Implement logic to detect when aggregations need updating

Phase 4: User Interface Enhancements (2 weeks)
Add confidence scores to query results
Provide query explanation showing the strategy used
Include refresh options for pre-computed data



Phase 1: Metadata Enhancement Layer
Step 1: Create the Enhanced Metadata Extractor
First, let's create a universal metadata extraction service that enriches any data source:


// src/services/metadata-extraction/enhanced-metadata-service.ts

import { DataSourceType } from '../../types/data-source';

export class EnhancedMetadataService {
  // Works with any data source type
  async extractEnhancedMetadata(
    source: any, 
    sourceType: DataSourceType, 
    options: EnhancedMetadataOptions = {}
  ): Promise<EnhancedMetadata> {
    // Choose appropriate extractor based on source type
    switch(sourceType) {
      case 'snowflake':
        return this.extractSnowflakeMetadata(source, options);
      case 'file':
        return this.extractFileMetadata(source, options);
      // Add other source types as needed
      default:
        return this.extractGenericMetadata(source, options);
    }
  }
  
  // Type-specific extractors that return the same metadata format
  private async extractSnowflakeMetadata(source: any, options: EnhancedMetadataOptions): Promise<EnhancedMetadata> {
    // Implementation for Snowflake
    // ...
  }
  
  private async extractFileMetadata(source: any, options: EnhancedMetadataOptions): Promise<EnhancedMetadata> {
    // Implementation for files - unchanged from current logic
    // ...
  }
  
  // Shared extraction utilities used by all extractors
  private extractNumericRanges(data: any[]): NumericRanges {
    // Extract min/max for all numeric fields
    // ...
  }
  
  private extractEntityFrequencies(data: any[]): EntityFrequencies {
    // Count occurrences of entity values (like product_ids)
    // ...
  }
}

// Common metadata structure used across all source types
interface EnhancedMetadata {
  numericRanges: Record<string, { min: number, max: number }>;
  entityFrequencies: Record<string, Record<string|number, number>>;
  uniqueValues: Record<string, (string|number)[]>;
  commonValues: Record<string, (string|number)[]>;
  // Other universal metadata
}

interface EnhancedMetadataOptions {
  maxUniqueValues?: number;
  includedFields?: string[];
  excludedFields?: string[];
  // Other options
}


Step 2: Integrate into the Embedding Pipeline
Now, let's integrate this with your existing embedding pipeline:



// src/services/embedding/enhanced-embedding-service.ts

import { EnhancedMetadataService } from '../metadata-extraction/enhanced-metadata-service';

export class EnhancedEmbeddingService {
  constructor(
    private openaiService: OpenAIService,
    private metadataService: EnhancedMetadataService,
    // other dependencies
  ) {}
  
  async createEnhancedEmbedding(
    data: any, 
    sourceType: DataSourceType, 
    options: EnhancedEmbeddingOptions = {}
  ): Promise<EnhancedEmbedding> {
    // 1. Extract enhanced metadata
    const enhancedMetadata = await this.metadataService.extractEnhancedMetadata(
      data, sourceType, options.metadataOptions
    );
    
    // 2. Create the text description (existing logic)
    const textDescription = this.createTextDescription(data, sourceType);
    
    // 3. Generate the embedding vector (existing logic)
    const embedding = await this.openaiService.createEmbeddings([textDescription]);
    
    // 4. Combine into enhanced embedding
    return {
      text: textDescription,
      vector: embedding[0],
      metadata: {
        // Original metadata
        ...this.extractBasicMetadata(data, sourceType),
        // Enhanced metadata
        enhancedMetadata,
      }
    };
  }
}

interface EnhancedEmbedding {
  text: string;
  vector: number[];
  metadata: any;
}

interface EnhancedEmbeddingOptions {
  metadataOptions?: any;
  // other options
}




Step 3: Update Schema Indexer for Database Sources
Let's update the Snowflake schema indexer (and other database indexers) to use the new metadata enhancement:



// src/services/snowflake-schema-indexer.service.ts

// ... existing imports
import { EnhancedMetadataService } from '../metadata-extraction/enhanced-metadata-service';
import { EnhancedEmbeddingService } from '../embedding/enhanced-embedding-service';

export class SnowflakeSchemaIndexerService {
  // ... existing code
  
  private async processLargeTableForEmbeddings(
    dataSourceId: number,
    database: string,
    schema: string,
    tableName: string,
    embeddings: SchemaEmbedding[],
    chunkSize: number = 10000
  ): Promise<number> {
    try {
      // ... existing code
      
      // For each chunk, add enhanced metadata
      for (let offset = 0; offset < rowCount; offset += chunkSize) {
        processedChunks++;
        
        // ... existing code to get chunk data
        
        // Generate enhanced metadata
        const enhancedMetadata = await this.metadataService.extractEnhancedMetadata(
          result.rows, 
          'snowflake',
          { 
            includedFields: chunkTableMetadata.columns.map(c => c.name) 
          }
        );
        
        // Create embedding with enhanced metadata
        const chunkDescription = `Table chunk ${processedChunks}/${totalChunks} from ${database}.${schema}.${tableName}
Rows ${offset+1} to ${offset+result.rows.length} of approximately ${rowCount} total rows
Complete data snapshot for BI and visualization analysis
${this.createTableDescription(chunkTableMetadata, true)}`;
        
        try {
          const chunkEmbeddingVector = await this.openaiService.createEmbeddings([chunkDescription]);
          
          // Add the chunk embedding with enhanced metadata
          embeddings.push({
            id: `${dataSourceId}:${database}:${schema}:${tableName}:chunk:${processedChunks}`,
            text: chunkDescription,
            type: 'table_chunk',
            vector: chunkEmbeddingVector[0],
            metadata: {
              dataSourceId,
              database,
              schema,
              table: tableName,
              chunk: processedChunks,
              offset: offset,
              totalChunks: totalChunks,
              rowCount: result.rows.length,
              completeData: true,
              // Add enhanced metadata
              numericRanges: enhancedMetadata.numericRanges,
              entityFrequencies: enhancedMetadata.entityFrequencies,
              uniqueValues: enhancedMetadata.uniqueValues.slice(0, 100), // Limit size
              lastUpdated: new Date()
            }
          });
          
          // ... rest of existing code
        }
        // ... rest of existing code
      }
      // ... rest of existing code
    }
    // ... rest of existing code
  }
}






Phase 2: Query Engine Enhancement
Step 1: Create the Query Classifier




// src/services/query/query-classifier.service.ts

export class QueryClassifierService {
  // Classification result types
  readonly QUERY_TYPE = {
    SEMANTIC: 'semantic',
    FILTER: 'filter',
    AGGREGATION: 'aggregation',
    HYBRID: 'hybrid'
  };
  
  // Rules for classification
  private readonly AGG_KEYWORDS = [
    'total', 'sum', 'average', 'avg', 'count', 'how many', 
    'maximum', 'minimum', 'mean', 'median'
  ];
  
  private readonly FILTER_KEYWORDS = [
    'where', 'with', 'for', 'of', 'by', 'that have', 'that are', 'equal to'
  ];
  
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
    let queryType = this.QUERY_TYPE.SEMANTIC;
    if (hasAggregation && hasFilter) {
      queryType = this.QUERY_TYPE.HYBRID;
    } else if (hasAggregation) {
      queryType = this.QUERY_TYPE.AGGREGATION;
    } else if (hasFilter) {
      queryType = this.QUERY_TYPE.FILTER;
    }
    
    // Extract entities (products, dates, etc.)
    const entities = await this.extractEntities(normalizedQuery);
    
    // Identify the main aggregation function if any
    const aggregationFunction = this.identifyAggregationFunction(normalizedQuery);
    
    return {
      type: queryType,
      entities,
      aggregationFunction,
      confidence: this.calculateConfidence(queryType, normalizedQuery)
    };
  }
  
  private async extractEntities(query: string): Promise<QueryEntities> {
    // Extract product names, field names, etc.
    // This could use a more sophisticated NER model in production
    const entities: QueryEntities = {};
    
    // Simple regex pattern matching for demonstration
    const productMatch = query.match(/(?:of|for|about)\s+([a-z\s]+?)(?:\s+and|\s+or|\s+in|\s+from|\?|$)/i);
    if (productMatch && productMatch[1]) {
      entities.product = productMatch[1].trim();
    }
    
    // ... other entity extractions
    
    return entities;
  }
  
  private identifyAggregationFunction(query: string): string | null {
    // Map query keywords to aggregation functions
    if (query.includes('total') || query.includes('sum')) {
      return 'sum';
    } else if (query.includes('average') || query.includes('avg')) {
      return 'avg';
    } else if (query.includes('how many') || query.includes('count')) {
      return 'count';
    }
    // ...other functions
    
    return null;
  }
  
  private calculateConfidence(type: string, query: string): number {
    // Calculate confidence score for the classification
    // Simple heuristic for demonstration
    let confidence = 0.7; // Base confidence
    
    if (type === this.QUERY_TYPE.AGGREGATION) {
      // More explicit aggregation queries get higher confidence
      if (query.includes('total') || query.includes('sum of')) {
        confidence += 0.2;
      }
    }
    
    // ...other confidence adjustments
    
    return Math.min(confidence, 1.0);
  }
}

interface QueryClassification {
  type: string;
  entities: QueryEntities;
  aggregationFunction: string | null;
  confidence: number;
}

interface QueryEntities {
  product?: string;
  date?: string;
  location?: string;
  category?: string;
  [key: string]: string | undefined;
}





Step 2: Create the Strategy Selector

// src/services/query/query-strategy-selector.service.ts

import { QueryClassifierService } from './query-classifier.service';

export class QueryStrategySelector {
  constructor(
    private queryClassifier: QueryClassifierService,
    // other dependencies
  ) {}
  
  // Strategy types
  readonly STRATEGY_TYPE = {
    SEMANTIC_SEARCH: 'semantic_search',
    METADATA_FILTER: 'metadata_filter',
    PRECOMPUTED_AGGREGATION: 'precomputed_aggregation',
    FULL_SCAN_AGGREGATION: 'full_scan_aggregation',
    HYBRID: 'hybrid'
  };
  
  async selectStrategy(query: string): Promise<QueryStrategy> {
    // 1. Classify the query
    const classification = await this.queryClassifier.classifyQuery(query);
    
    // 2. Select appropriate strategy based on classification
    let strategy: string;
    let executionPlan: any = {};
    
    switch (classification.type) {
      case this.queryClassifier.QUERY_TYPE.AGGREGATION:
        // Check if we have precomputed data for this aggregation
        if (await this.hasPrecomputedAggregation(classification)) {
          strategy = this.STRATEGY_TYPE.PRECOMPUTED_AGGREGATION;
        } else {
          // Otherwise we need to scan and aggregate
          strategy = this.STRATEGY_TYPE.FULL_SCAN_AGGREGATION;
          
          // Plan for parallel processing if table is large
          const targetEntity = classification.entities.product;
          if (targetEntity) {
            executionPlan.parallelScan = true;
            executionPlan.entityValue = targetEntity;
            executionPlan.aggregationFunction = classification.aggregationFunction;
          }
        }
        break;
        
      case this.queryClassifier.QUERY_TYPE.FILTER:
        // Use metadata filtering if the query has clear filter conditions
        if (Object.keys(classification.entities).length > 0) {
          strategy = this.STRATEGY_TYPE.METADATA_FILTER;
          executionPlan.filterConditions = this.buildFilterConditions(classification);
        } else {
          // Fall back to semantic search if filters aren't clear
          strategy = this.STRATEGY_TYPE.SEMANTIC_SEARCH;
        }
        break;
        
      case this.queryClassifier.QUERY_TYPE.HYBRID:
        strategy = this.STRATEGY_TYPE.HYBRID;
        executionPlan = {
          filterStage: this.buildFilterConditions(classification),
          aggregationStage: {
            function: classification.aggregationFunction,
            targetField: this.determineTargetField(classification)
          }
        };
        break;
        
      default:
        strategy = this.STRATEGY_TYPE.SEMANTIC_SEARCH;
    }
    
    return {
      strategyType: strategy,
      classification,
      executionPlan
    };
  }
  
  private async hasPrecomputedAggregation(classification: any): Promise<boolean> {
    // Check if we have precomputed data for this query
    // This would check a registry of precomputed aggregations
    // ...
    return false; // Placeholder
  }
  
  private buildFilterConditions(classification: any): any {
    // Convert entities to filter conditions
    const conditions: any = {};
    
    if (classification.entities.product) {
      conditions.product = classification.entities.product;
    }
    
    // ...other entity conversions
    
    return conditions;
  }
  
  private determineTargetField(classification: any): string {
    // Figure out which field to aggregate based on the function
    if (classification.aggregationFunction === 'sum' || 
        classification.aggregationFunction === 'avg') {
      // For sum/avg of products, usually want quantity or value
      return 'quantity';
    }
    
    return 'id'; // Default for count
  }
}

interface QueryStrategy {
  strategyType: string;
  classification: any;
  executionPlan: any;
}



Step 3: Implement the Hybrid Search Engine


// src/services/query/hybrid-search-engine.service.ts

import { QueryClassifierService } from './query-classifier.service';
import { QueryStrategySelector } from './query-strategy-selector.service';

export class HybridSearchEngine {
  constructor(
    private qdrantService: any, // Your existing vector DB service
    private metadataService: any, // Service for metadata operations
    private queryClassifier: QueryClassifierService,
    private strategySelector: QueryStrategySelector,
    // other dependencies
  ) {}
  
  async executeQuery(query: string, options: QueryOptions = {}): Promise<QueryResult> {
    // 1. Select the appropriate strategy
    const strategy = await this.strategySelector.selectStrategy(query);
    
    // 2. Execute the strategy
    let results: any;
    let executionDetails: any = {
      strategy: strategy.strategyType,
      timings: {},
      confidence: strategy.classification.confidence
    };
    
    const startTime = Date.now();
    
    try {
      switch (strategy.strategyType) {
        case this.strategySelector.STRATEGY_TYPE.SEMANTIC_SEARCH:
          results = await this.executeSemantic(query, options);
          break;
          
        case this.strategySelector.STRATEGY_TYPE.METADATA_FILTER:
          results = await this.executeMetadataFilter(query, strategy.executionPlan, options);
          break;
          
        case this.strategySelector.STRATEGY_TYPE.PRECOMPUTED_AGGREGATION:
          results = await this.executePrecomputed(query, strategy.executionPlan, options);
          break;
          
        case this.strategySelector.STRATEGY_TYPE.FULL_SCAN_AGGREGATION:
          results = await this.executeFullScanAggregation(query, strategy.executionPlan, options);
          break;
          
        case this.strategySelector.STRATEGY_TYPE.HYBRID:
          results = await this.executeHybrid(query, strategy.executionPlan, options);
          break;
          
        default:
          // Fall back to semantic search
          results = await this.executeSemantic(query, options);
      }
      
      executionDetails.timings.total = Date.now() - startTime;
      
      return {
        results,
        executionDetails
      };
    } catch (error) {
      // If strategy fails, fall back to semantic search
      console.error(`Strategy ${strategy.strategyType} failed, falling back to semantic search`, error);
      executionDetails.error = error.message;
      executionDetails.fallback = true;
      
      results = await this.executeSemantic(query, options);
      executionDetails.timings.total = Date.now() - startTime;
      
      return {
        results,
        executionDetails
      };
    }
  }
  
  // Implementation of each strategy type
  
  private async executeSemantic(query: string, options: QueryOptions): Promise<any> {
    // Your existing semantic search logic
    // ...
  }
  
  private async executeMetadataFilter(query: string, plan: any, options: QueryOptions): Promise<any> {
    // Filter based on metadata
    // ...
  }
  
  private async executePrecomputed(query: string, plan: any, options: QueryOptions): Promise<any> {
    // Retrieve precomputed aggregation
    // ...
  }
  
  private async executeFullScanAggregation(query: string, plan: any, options: QueryOptions): Promise<any> {
    // Get entity to aggregate on (e.g., product name)
    const entityValue = plan.entityValue;
    const aggregationFunction = plan.aggregationFunction || 'sum';
    
    // 1. Look up entity ID if needed (e.g., product name to product ID)
    const entityId = await this.resolveEntityId(entityValue, options);
    
    // 2. Scan chunks in parallel with the filter
    const filter = {
      must: [
        {key: "type", match: {value: "table_chunk"}},
        // Add more filters based on the query
      ]
    };
    
    if (entityId) {
      // Add entity frequency filter if possible
      filter.must.push({
        key: "entityFrequencies.product_id", 
        match: {value: entityId.toString()}
      });
    }
    
    // 3. Get all matching chunks
    const allChunks = await this.qdrantService.scrollAllPoints(
      options.collection,
      {
        filter,
        limit: 100,
        with_payload: true,
        with_vector: false
      }
    );
    
    // 4. Aggregate results from chunks
    const fieldToAggregate = this.determineFieldToAggregate(
      aggregationFunction, 
      entityValue, 
      options
    );
    
    let aggregationResult = 0;
    let matchingRecords = 0;
    
    // Process each chunk
    for (const chunk of allChunks) {
      // Extract the sample data from the chunk
      const entityAppearances = this.extractEntityAppearances(
        chunk.payload.text,
        entityValue,
        entityId,
        fieldToAggregate
      );
      
      // Add to running aggregation
      if (aggregationFunction === 'sum') {
        aggregationResult += entityAppearances.reduce((sum, val) => sum + val, 0);
      } else if (aggregationFunction === 'count') {
        aggregationResult += entityAppearances.length;
      }
      
      matchingRecords += entityAppearances.length;
    }
    
    // 5. Return aggregated result
    return {
      value: aggregationResult,
      function: aggregationFunction,
      field: fieldToAggregate,
      entity: entityValue,
      entityId: entityId,
      matchingRecords
    };
  }
  
  private async executeHybrid(query: string, plan: any, options: QueryOptions): Promise<any> {
    // Combine metadata filtering and aggregation
    // ...
  }
  
  // Helper methods
  
  private async resolveEntityId(entityName: string, options: QueryOptions): Promise<number | null> {
    // Look up entity ID (e.g., product name to product ID)
    // This might query the products table or use cached metadata
    // ...
    return null; // Placeholder
  }
  
  private determineFieldToAggregate(
    aggregationFunction: string, 
    entityValue: string, 
    options: QueryOptions
  ): string {
    // Choose appropriate field based on aggregation type
    if (aggregationFunction === 'sum' && 
        (entityValue.includes('sale') || entityValue.includes('revenue'))) {
      return 'total_value';
    } else if (aggregationFunction === 'sum') {
      return 'quantity';
    }
    
    return 'quantity'; // Default
  }
  
  private extractEntityAppearances(
    chunkText: string,
    entityValue: string,
    entityId: number | null,
    fieldToAggregate: string
  ): number[] {
    // Parse the text to find all appearances of the entity and extract the field values
    const appearances: number[] = [];
    
    // This is a simplified example - in production would use more robust parsing
    const lines = chunkText.split('\n');
    const dataStartIndex = lines.findIndex(line => line.includes('Sample data:'));
    
    if (dataStartIndex >= 0) {
      // Extract column names
      const headerLine = lines[dataStartIndex + 2];
      const columns = headerLine.split('|').map(col => col.trim());
      
      // Find relevant column indices
      const productIdIndex = columns.findIndex(col => 
        col.toLowerCase().includes('product_id'));
      const fieldIndex = columns.findIndex(col => 
        col.toLowerCase().includes(fieldToAggregate.toLowerCase()));
      
      if (productIdIndex >= 0 && fieldIndex >= 0) {
        // Extract rows with matching product ID
        for (let i = dataStartIndex + 3; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes('more rows not shown')) break;
          
          const cells = line.split('|').map(cell => cell.trim());
          if (cells.length <= productIdIndex || cells.length <= fieldIndex) continue;
          
          const productIdCell = cells[productIdIndex];
          
          // Check if this row is for our target product
          if ((entityId && productIdCell === entityId.toString()) ||
              (line.toLowerCase().includes(entityValue.toLowerCase()))) {
            // Extract the value
            const valueStr = cells[fieldIndex];
            const value = parseFloat(valueStr);
            if (!isNaN(value)) {
              appearances.push(value);
            }
          }
        }
      }
    }
    
    return appearances;
  }
}

interface QueryOptions {
  collection?: string;
  datasourceId?: number;
  limit?: number;
  // other options
}

interface QueryResult {
  results: any;
  executionDetails: any;
}




Phase 3: Implementation of Pre-computed Aggregations
Step 1: Create the Aggregation Generator





// src/services/aggregation/aggregation-generator.service.ts

export class AggregationGeneratorService {
  constructor(
    private qdrantService: any,
    private openaiService: any,
    // other dependencies
  ) {}
  
  // Common aggregation types to generate
  readonly AGGREGATION_TYPES = [
    'total_sales_by_product',
    'total_quantity_by_product',
    'average_price_by_product',
    'sales_by_category',
    'sales_by_date_range'
  ];
  
  async generateAggregations(
    dataSourceId: number,
    options: GenerateAggregationsOptions = {}
  ): Promise<GeneratedAggregations> {
    const results: GeneratedAggregations = {
      dataSourceId,
      aggregationsGenerated: 0,
      aggregationsByType: {},
      errors: []
    };
    
    // For each aggregation type
    for (const aggType of options.aggregationTypes || this.AGGREGATION_TYPES) {
      try {
        const aggregations = await this.generateAggregationByType(
          dataSourceId, 
          aggType, 
          options
        );
        
        results.aggregationsGenerated += aggregations.length;
        results.aggregationsByType[aggType] = aggregations.length;
        
        // Store aggregations
        await this.storeAggregations(aggregations, dataSourceId, aggType, options);
      } catch (error) {
        results.errors.push({
          type: aggType,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  private async generateAggregationByType(
    dataSourceId: number,
    aggType: string,
    options: GenerateAggregationsOptions
  ): Promise<Aggregation[]> {
    switch (aggType) {
      case 'total_sales_by_product':
        return this.generateTotalSalesByProduct(dataSourceId, options);
      
      case 'total_quantity_by_product':
        return this.generateTotalQuantityByProduct(dataSourceId, options);
      
      // ... other types
      
      default:
        throw new Error(`Unknown aggregation type: ${aggType}`);
    }
  }
  
  private async generateTotalSalesByProduct(
    dataSourceId: number,
    options: GenerateAggregationsOptions
  ): Promise<Aggregation[]> {
    // 1. Get all products
    const products = await this.getProducts(dataSourceId);
    
    // 2. For each product, calculate total sales
    const aggregations: Aggregation[] = [];
    
    for (const product of products) {
      try {
        // Execute full scan aggregation for this product
        const totalSales = await this.calculateTotalSales(
          dataSourceId, 
          product.id, 
          product.name,
          options
        );
        
        // Create aggregation object
        const description = this.createAggregationDescription(
          'total_sales_by_product',
          product,
          totalSales
        );
        
        // Generate embedding
        const vector = await this.openaiService.createEmbeddings([description]);
        
        aggregations.push({
          type: 'total_sales_by_product',
          subject: product.name,
          subjectId: product.id,
          value: totalSales,
          description,
          vector: vector[0],
          metadata: {
            dataSourceId,
            product: product.name,
            productId: product.id,
            aggregationType: 'total_sales_by_product',
            lastUpdated: new Date()
          }
        });
      } catch (error) {
        console.error(`Failed to generate aggregation for product ${product.name}`, error);
        // Continue with next product
      }
    }
    
    return aggregations;
  }
  
  private async storeAggregations(
    aggregations: Aggregation[],
    dataSourceId: number,
    aggType: string,
    options: GenerateAggregationsOptions
  ): Promise<void> {
    // Store in vector database
    const points = aggregations.map((agg, index) => ({
      id: `aggregation:${dataSourceId}:${aggType}:${agg.subjectId || index}`,
      vector: agg.vector,
      payload: {
        text: agg.description,
        type: 'aggregation',
        aggregationType: aggType,
        subject: agg.subject,
        subjectId: agg.subjectId,
        value: agg.value,
        dataSourceId,
        lastUpdated: new Date()
      }
    }));
    
    // Upsert to collection
    await this.qdrantService.upsertPoints(
      `datasource_${dataSourceId}_aggregations`, // Collection name
      points
    );
  }
  
  // Other helper methods
  // ...
}

interface GenerateAggregationsOptions {
  aggregationTypes?: string[];
  forceRefresh?: boolean;
  collection?: string;
  // Other options
}

interface GeneratedAggregations {
  dataSourceId: number;
  aggregationsGenerated: number;
  aggregationsByType: Record<string, number>;
  errors: {type: string, error: string}[];
}

interface Aggregation {
  type: string;
  subject: string;
  subjectId?: number | string;
  value: number;
  description: string;
  vector: number[];
  metadata: any;
}






Step 2: Create the Scheduled Job



// src/scheduled-tasks/aggregation-refresh.task.ts

import { AggregationGeneratorService } from '../services/aggregation/aggregation-generator.service';

export class AggregationRefreshTask {
  constructor(
    private aggregationGenerator: AggregationGeneratorService,
    private db: any, // Database connection
    // other dependencies
  ) {}
  
  // Run according to schedule (e.g., daily)
  async run(): Promise<void> {
    console.log('Starting scheduled aggregation refresh task');
    
    try {
      // 1. Get all active data sources
      const dataSources = await this.getActiveDataSources();
      
      // 2. For each data source, refresh aggregations
      for (const dataSource of dataSources) {
        try {
          console.log(`Refreshing aggregations for data source ${dataSource.id}`);
          
          // Check if this data source needs refresh
          if (await this.needsRefresh(dataSource)) {
            const result = await this.aggregationGenerator.generateAggregations(
              dataSource.id,
              {
                forceRefresh: true
              }
            );
            
            console.log(`Generated ${result.aggregationsGenerated} aggregations for data source ${dataSource.id}`);
            
            // Update last refresh time
            await this.updateLastRefreshTime(dataSource.id);
          } else {
            console.log(`Skipping data source ${dataSource.id}, no refresh needed`);
          }
        } catch (error) {
          console.error(`Failed to refresh aggregations for data source ${dataSource.id}`, error);
          // Continue with next data source
        }
      }
      
      console.log('Completed scheduled aggregation refresh task');
    } catch (error) {
      console.error('Failed to run aggregation refresh task', error);
      throw error;
    }
  }
  
  private async getActiveDataSources(): Promise<any[]> {
    // Get all active data sources from database
    return this.db('data_sources')
      .where('status', 'ready')
      .select('id', 'type', 'name', 'metadata');
  }
  
  private async needsRefresh(dataSource: any): Promise<boolean> {
    // Check if data source needs aggregation refresh
    // Based on last refresh time, data updates, etc.
    
    // Get last refresh time
    const lastRefresh = await this.db('aggregation_refresh_history')
      .where('data_source_id', dataSource.id)
      .orderBy('refreshed_at', 'desc')
      .first();
    
    if (!lastRefresh) {
      // Never refreshed before
      return true;
    }
    
    // Check if data has been updated since last refresh
    const lastUpdate = await this.db('data_sources')
      .where('id', dataSource.id)
      .select('updated_at')
      .first();
    
    if (lastUpdate && lastUpdate.updated_at > lastRefresh.refreshed_at) {
      return true;
    }
    
    // Check if refresh interval has passed
    const now = new Date();
    const refreshInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    return (now.getTime() - new Date(lastRefresh.refreshed_at).getTime()) > refreshInterval;
  }
  
  private async updateLastRefreshTime(dataSourceId: number): Promise<void> {
    // Update last refresh time in database
    await this.db('aggregation_refresh_history').insert({
      data_source_id: dataSourceId,
      refreshed_at: new Date(),
      status: 'success'
    });
  }
}




Phase 4: User Interface Enhancements
Step 1: Create Result Explainer Service





// src/services/ui/result-explainer.service.ts

export class ResultExplainerService {
  constructor(
    // dependencies
  ) {}
  
  generateExplanation(result: any, executionDetails: any): ExplanationResult {
    // Create a human-readable explanation of how the result was generated
    let explanation = '';
    let confidence = executionDetails.confidence || 0.7;
    let strategyName = this.getStrategyDisplayName(executionDetails.strategy);
    
    // Build explanation based on strategy type
    switch (executionDetails.strategy) {
      case 'semantic_search':
        explanation = `I found this by searching your data for content most relevant to your question. The search took ${this.formatTime(executionDetails.timings.total)}.`;
        break;
        
      case 'metadata_filter':
        explanation = `I filtered your data based on specific criteria from your question and found ${result.matchingRecords || 'these'} matches. The filter operation took ${this.formatTime(executionDetails.timings.total)}.`;
        break;
        
      case 'precomputed_aggregation':
        explanation = `I used a pre-calculated result that exactly matches your question. This data was last updated on ${this.formatDate(result.metadata?.lastUpdated)}.`;
        confidence = Math.max(confidence, 0.9); // Pre-computed results have high confidence
        break;
        
      case 'full_scan_aggregation':
        explanation = `I calculated this result by scanning through ${result.matchingRecords || 'all relevant'} records in your data. The calculation took ${this.formatTime(executionDetails.timings.total)}.`;
        break;
        
      case 'hybrid':
        explanation = `I combined filtering and calculation to provide this result based on ${result.matchingRecords || 'relevant'} records. The process took ${this.formatTime(executionDetails.timings.total)}.`;
        break;
        
      default:
        explanation = `I analyzed your data to find this result. The process took ${this.formatTime(executionDetails.timings.total)}.`;
    }
    
    // Add fallback note if applicable
    if (executionDetails.fallback) {
      explanation += ' (Note: I had to use a different approach than initially planned due to complexity.)';
      confidence = Math.max(0.5, confidence - 0.2); // Reduce confidence for fallbacks
    }
    
    // Return formatted explanation
    return {
      text: explanation,
      strategy: strategyName,
      confidence,
      timingMs: executionDetails.timings.total || 0,
      hasDetails: true
    };
  }
  
  private getStrategyDisplayName(strategy: string): string {
    // Convert internal strategy names to user-friendly names
    const strategyMap: {[key: string]: string} = {
      'semantic_search': 'Semantic Search',
      'metadata_filter': 'Filtered Search',
      'precomputed_aggregation': 'Pre-computed Result',
      'full_scan_aggregation': 'Full Data Calculation',
      'hybrid': 'Hybrid Analysis'
    };
    
    return strategyMap[strategy] || 'Data Analysis';
  }
  
  private formatTime(ms: number): string {
    if (!ms) return 'an unknown amount of time';
    
    if (ms < 1000) {
      return `${ms}ms`;
    } else {
      return `${(ms / 1000).toFixed(2)}s`;
    }
  }
  
  private formatDate(date: Date | string | undefined): string {
    if (!date) return 'an unknown date';
    
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  }
}

interface ExplanationResult {
  text: string;
  strategy: string;
  confidence: number;
  timingMs: number;
  hasDetails: boolean;
}






Step 2: Add UI Components for Result Explanation


// This would need to be integrated with your frontend framework
// Here's a pseudocode example for React

// ResultExplanation.tsx
import React from 'react';

interface ResultExplanationProps {
  explanation: {
    text: string;
    strategy: string;















