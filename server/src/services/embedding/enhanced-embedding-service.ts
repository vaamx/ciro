import { createServiceLogger } from '../../utils/logger-factory';
import { OpenAIService } from '../openai.service';
import { EnhancedMetadataService, EnhancedMetadataOptions, DataSourceType } from '../metadata-extraction/enhanced-metadata-service';
import { QdrantService } from '../qdrant.service';

/**
 * Options for creating enhanced embeddings
 */
export interface EnhancedEmbeddingOptions {
  metadataOptions?: EnhancedMetadataOptions;
  chunkSize?: number;
  chunkOverlap?: number;
  embeddingModel?: string;
  includeVector?: boolean;
  enableAutoSummary?: boolean;
  additionalMetadata?: Record<string, any>;
}

/**
 * Enhanced embedding with metadata
 */
export interface EnhancedEmbedding {
  id?: string;
  text: string;
  vector: number[];
  metadata: {
    dataSourceId: string | number;
    dataSourceType: DataSourceType;
    enhancedMetadata: any;
    sourceId?: string;
    documentId?: string;
    filename?: string;
    lastUpdated: Date;
    [key: string]: any;
  };
}

/**
 * Service that creates enhanced embeddings with rich metadata
 * to improve search and query processing capabilities.
 */
export class EnhancedEmbeddingService {
  private readonly logger = createServiceLogger('EnhancedEmbeddingService');
  private static instance: EnhancedEmbeddingService | null = null;
  
  private constructor(
    private openaiService: OpenAIService,
    private metadataService: EnhancedMetadataService,
    private qdrantService: QdrantService
  ) {
    this.logger.info('EnhancedEmbeddingService initialized');
  }
  
  /**
   * Gets the singleton instance of the service
   */
  public static getInstance(): EnhancedEmbeddingService {
    if (!EnhancedEmbeddingService.instance) {
      const openaiService = OpenAIService.getInstance();
      const metadataService = EnhancedMetadataService.getInstance();
      const qdrantService = QdrantService.getInstance();
      
      EnhancedEmbeddingService.instance = new EnhancedEmbeddingService(
        openaiService,
        metadataService,
        qdrantService
      );
    }
    
    return EnhancedEmbeddingService.instance;
  }
  
  /**
   * Create enhanced embeddings with rich metadata
   */
  async createEnhancedEmbedding(
    data: any, 
    sourceType: DataSourceType,
    dataSourceId: string | number,
    options: EnhancedEmbeddingOptions = {}
  ): Promise<EnhancedEmbedding> {
    this.logger.info(`Creating enhanced embedding for data source ${dataSourceId} of type ${sourceType}`);
    
    // 1. Extract enhanced metadata
    const enhancedMetadata = await this.metadataService.extractEnhancedMetadata(
      data, sourceType, options.metadataOptions
    );
    
    // 2. Create the text description
    const textDescription = this.createTextDescription(data, sourceType);
    
    // 3. Generate the embedding vector
    const embedding = await this.openaiService.createEmbeddings([textDescription]);
    
    // 4. Combine into enhanced embedding
    return {
      text: textDescription,
      vector: embedding[0],
      metadata: {
        dataSourceId,
        dataSourceType: sourceType,
        enhancedMetadata,
        lastUpdated: new Date(),
        ...options.additionalMetadata
      }
    };
  }
  
  /**
   * Create multiple enhanced embeddings and store them in Qdrant
   */
  async createAndStoreEnhancedEmbeddings(
    dataArray: any[], 
    sourceType: DataSourceType,
    dataSourceId: string | number,
    collectionName: string,
    options: EnhancedEmbeddingOptions = {}
  ): Promise<{
    embeddingsCreated: number;
    collectionName: string;
  }> {
    this.logger.info(`Creating and storing enhanced embeddings for data source ${dataSourceId} in collection ${collectionName}`);
    
    // Ensure collection exists
    const collectionExists = await this.qdrantService.collectionExists(collectionName);
    if (!collectionExists) {
      await this.qdrantService.createCollection(collectionName, {
        vectors: {
          size: 1536, // Default for OpenAI embeddings
          distance: 'Cosine'
        }
      });
      this.logger.info(`Created collection ${collectionName}`);
    }
    
    // Process data in batches to avoid memory issues
    const batchSize = 100;
    let embeddingsCreated = 0;
    
    for (let i = 0; i < dataArray.length; i += batchSize) {
      const batch = dataArray.slice(i, i + batchSize);
      const embeddings: EnhancedEmbedding[] = [];
      
      // Create enhanced embeddings for batch
      for (const item of batch) {
        try {
          const embedding = await this.createEnhancedEmbedding(
            item, sourceType, dataSourceId, options
          );
          
          // Generate a stable ID if not provided
          if (!embedding.id) {
            embedding.id = this.generateEmbeddingId(dataSourceId, sourceType, item, embeddingsCreated);
          }
          
          embeddings.push(embedding);
        } catch (error) {
          this.logger.error(`Error creating embedding: ${error}`);
        }
      }
      
      // Store embeddings in Qdrant
      const points = embeddings.map(embedding => ({
        id: embedding.id!,
        vector: embedding.vector,
        payload: {
          text: embedding.text,
          ...embedding.metadata
        }
      }));
      
      await this.qdrantService.upsertVectors(collectionName, points);
      
      embeddingsCreated += embeddings.length;
      this.logger.info(`Created and stored ${embeddings.length} embeddings (total: ${embeddingsCreated})`);
    }
    
    return {
      embeddingsCreated,
      collectionName
    };
  }
  
  /**
   * Create text description for embedding
   */
  private createTextDescription(data: any, sourceType: DataSourceType): string {
    if (Array.isArray(data)) {
      return this.createArrayDescription(data, sourceType);
    }
    
    if (typeof data === 'object' && data !== null) {
      return this.createObjectDescription(data, sourceType);
    }
    
    return String(data);
  }
  
  /**
   * Create description for array data
   */
  private createArrayDescription(data: any[], sourceType: DataSourceType): string {
    if (data.length === 0) {
      return 'Empty data set';
    }
    
    // Sample only a subset for large arrays
    const sampleSize = Math.min(data.length, 10);
    const sample = data.slice(0, sampleSize);
    
    // Create description based on source type
    if (sourceType === 'snowflake' || sourceType === '***REMOVED***ql' || sourceType === 'mysql') {
      return this.createTabularDescription(sample, data.length);
    }
    
    // Generic array description
    return `Data set with ${data.length} items.\nSample: ${JSON.stringify(sample, null, 2)}`;
  }
  
  /**
   * Create description for object data
   */
  private createObjectDescription(data: any, sourceType: DataSourceType): string {
    // Extract fields and values
    const fields = Object.keys(data);
    
    if (fields.length === 0) {
      return 'Empty object';
    }
    
    // Create description based on different source types
    if (sourceType === 'file' || sourceType === 'pdf' || sourceType === 'docx') {
      return this.createDocumentDescription(data);
    }
    
    // Generic object description
    return `Object with fields: ${fields.join(', ')}\nValues: ${JSON.stringify(data, null, 2)}`;
  }
  
  /**
   * Create description for tabular data
   */
  private createTabularDescription(sample: any[], totalCount: number): string {
    if (sample.length === 0) {
      return 'Empty table';
    }
    
    // Get column names from first row
    const columns = Object.keys(sample[0]);
    
    // Create header row
    let description = `Table with ${totalCount} rows and ${columns.length} columns.\n\n`;
    description += `Columns: ${columns.join(', ')}\n\n`;
    
    // Add sample data in tabular format
    description += 'Sample data:\n';
    
    // Create header row
    description += columns.map(col => this.padString(col, 15)).join(' | ') + '\n';
    description += columns.map(() => '-'.repeat(15)).join(' | ') + '\n';
    
    // Add rows
    for (const row of sample) {
      const rowStr = columns.map(col => {
        const val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
        return this.padString(val, 15);
      }).join(' | ');
      description += rowStr + '\n';
    }
    
    if (totalCount > sample.length) {
      description += `... ${totalCount - sample.length} more rows not shown\n`;
    }
    
    return description;
  }
  
  /**
   * Create description for document data
   */
  private createDocumentDescription(data: any): string {
    let description = '';
    
    // Add document metadata if available
    if (data.metadata) {
      description += 'Document Metadata:\n';
      const metadata = data.metadata;
      for (const key of Object.keys(metadata)) {
        description += `${key}: ${metadata[key]}\n`;
      }
      description += '\n';
    }
    
    // Add document content if available
    if (data.content) {
      const contentPreview = typeof data.content === 'string' 
        ? data.content.substring(0, 1000) 
        : JSON.stringify(data.content).substring(0, 1000);
      
      description += 'Content Preview:\n';
      description += contentPreview;
      
      if (typeof data.content === 'string' && data.content.length > 1000) {
        description += `... (${data.content.length - 1000} more characters)`;
      }
    }
    
    return description;
  }
  
  /**
   * Pad a string to a fixed length
   */
  private padString(str: string, length: number): string {
    const truncated = str.length > length - 3
      ? str.substring(0, length - 3) + '...'
      : str;
    
    return truncated.padEnd(length);
  }
  
  /**
   * Generate a stable ID for an embedding
   */
  private generateEmbeddingId(
    dataSourceId: string | number,
    sourceType: DataSourceType,
    data: any,
    index: number
  ): string {
    // Try to use a natural ID if available
    if (data.id) {
      return `${dataSourceId}:${sourceType}:${data.id}`;
    }
    
    if (data.product_id) {
      return `${dataSourceId}:${sourceType}:product:${data.product_id}`;
    }
    
    if (data.transaction_id) {
      return `${dataSourceId}:${sourceType}:transaction:${data.transaction_id}`;
    }
    
    // Fall back to generated ID with index
    return `${dataSourceId}:${sourceType}:item:${index}`;
  }
} 