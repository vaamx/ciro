import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BaseDocumentProcessor, ProcessingResult } from '../base-document.processor';
import { ConfigService } from '../../../../core/config.service';
import { QdrantCollectionService } from '../../../../vector/collection-manager.service';
import { QdrantIngestionService } from '../../../../vector/ingestion.service';
import { v4 as uuidv4 } from 'uuid';
import { SocketService } from '../../../../util/socket.service';
import { createServiceLogger } from '../../../../../common/utils/logger-factory';
import { EmbeddingService } from '../../../../llm';
import { DocumentChunkingService } from '../../../../rag/chunking/document-chunking.service';

/**
 * Service for processing JSON files and creating embeddings
 */
@Injectable()
export class JsonProcessorService extends BaseDocumentProcessor {
  protected readonly logger = createServiceLogger('JsonProcessorService');

  constructor(
    private configService: ConfigService,
    private qdrantCollectionService: QdrantCollectionService,
    private qdrantIngestionService: QdrantIngestionService,
    private embeddingService: EmbeddingService,
    socketService: SocketService,
    private documentChunkingService: DocumentChunkingService
  ) {
    super('JsonProcessorService', socketService);
  }

  /**
   * Process a JSON file
   */
  async processFile(
    filePath: string,
    dataSourceId: number,
    organizationId: number,
    userId: string,
    metadata: Record<string, any>
  ): Promise<ProcessingResult> {
    return this.processDocument(filePath, dataSourceId, {
      chunkSize: metadata.chunkSize || 1000,
      overlap: metadata.overlap || 200,
      includeMetadata: metadata.includeMetadata !== false,
      maxDepth: metadata.maxDepth || 10
    });
  }

  /**
   * Process JSON document and create embeddings
   */
  async processDocument(
    filePath: string,
    dataSourceId: number,
    options: {
      chunkSize?: number;
      overlap?: number;
      includeMetadata?: boolean;
      maxDepth?: number;
    } = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Processing JSON file: ${filePath}`);
      
      // Read and parse JSON file
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const jsonData = JSON.parse(fileContent);
      
      // Extract data from JSON structure
      const extractedData = this.extractJsonData(
        jsonData,
        options.maxDepth || 10
      );
      
      this.logger.info(`Extracted ${extractedData.length} data items from JSON`);
      
      // Create chunks from extracted data
      const chunks = await this.createChunksFromJsonData(extractedData, options);
      
      this.logger.info(`Created ${chunks.length} chunks from JSON data`);
      
      // Create embeddings for chunks
      const embeddings = await this.createEmbeddingsForChunks(chunks);
      
      // Store in vector database
      const collectionName = `datasource_${dataSourceId}`;
      
      // Check if collection exists, create if not
      const collectionExists = await this.qdrantCollectionService.collectionExists(collectionName);
      if (!collectionExists) {
        await this.qdrantCollectionService.createCollection(collectionName, {
          dimension: embeddings[0]?.vector.length || 1536,
          vectors: {
            size: embeddings[0]?.vector.length || 1536,
            distance: 'Cosine'
          }
        });
      }
      
      const points = embeddings.map((embedding, index) => ({
        id: uuidv4(),
        vector: embedding.vector,
        payload: {
          source: 'json',
          filePath,
          chunkIndex: index,
          text: embedding.text,
          metadata: embedding.metadata,
          dataSourceId,
          processedAt: new Date().toISOString()
        }
      }));
      
      await this.qdrantIngestionService.upsertPoints(collectionName, points);
      
      const processingTime = Date.now() - startTime;
      
      this.logger.info(`JSON processing completed in ${processingTime}ms. Created ${embeddings.length} embeddings.`);
      
      // Emit progress update
      this.socketService.getIO().to(`datasource_${dataSourceId}`).emit('processing_complete', {
        type: 'json',
        filePath,
        chunksCreated: chunks.length,
        embeddingsCreated: embeddings.length,
        processingTime
      });
      
      return {
        status: 'success',
        chunks: chunks.length,
        message: `JSON processing completed in ${processingTime}ms. Created ${embeddings.length} embeddings.`,
        metadata: {
          fileType: 'json',
          filePath,
          totalItems: extractedData.length,
          embeddingsCreated: embeddings.length,
          processingTime
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing JSON file: ${errorMessage}`);
      
      this.socketService.getIO().to(`datasource_${dataSourceId}`).emit('processing_error', {
        type: 'json',
        filePath,
        error: errorMessage
      });
      
      return {
        status: 'error',
        chunks: 0,
        message: errorMessage,
        metadata: {
          processingTime: Date.now() - startTime,
          error: errorMessage
        }
      };
    }
  }
  
  /**
   * Extract data from JSON structure
   */
  private extractJsonData(
    jsonObject: any,
    maxDepth: number,
    currentDepth: number = 0,
    path: string = ''
  ): Array<{
    path: string;
    content: string;
    type: string;
    depth: number;
  }> {
    const results: Array<{
      path: string;
      content: string;
      type: string;
      depth: number;
    }> = [];
    
    if (currentDepth >= maxDepth) {
      return results;
    }
    
    if (jsonObject === null || jsonObject === undefined) {
      results.push({
        path,
        content: String(jsonObject),
        type: 'null',
        depth: currentDepth
      });
      return results;
    }
    
    if (typeof jsonObject === 'string' || typeof jsonObject === 'number' || typeof jsonObject === 'boolean') {
      results.push({
        path,
        content: String(jsonObject),
        type: typeof jsonObject,
        depth: currentDepth
      });
      return results;
    }
    
    if (Array.isArray(jsonObject)) {
      jsonObject.forEach((item, index) => {
        const itemPath = path ? `${path}[${index}]` : `[${index}]`;
        results.push(...this.extractJsonData(item, maxDepth, currentDepth + 1, itemPath));
      });
      return results;
    }
    
    if (typeof jsonObject === 'object') {
      for (const [key, value] of Object.entries(jsonObject)) {
        const newPath = path ? `${path}.${key}` : key;
        results.push(...this.extractJsonData(value, maxDepth, currentDepth + 1, newPath));
      }
    }
    
    return results;
  }
  
  /**
   * Create chunks from extracted JSON data
   */
  private async createChunksFromJsonData(
    extractedData: Array<{
      path: string;
      content: string;
      type: string;
      depth: number;
    }>,
    options: {
      chunkSize?: number;
      overlap?: number;
      includeMetadata?: boolean;
    }
  ): Promise<Array<{
    text: string;
    metadata: Record<string, any>;
  }>> {
    const chunkSize = options.chunkSize || 1000;
    const overlap = options.overlap || 200;
    const chunks: Array<{ text: string; metadata: Record<string, any> }> = [];
    
    // Group data by depth and path similarity
    const groupedData = this.groupJsonDataByContext(extractedData);
    
    for (const group of groupedData) {
      const groupText = group.items.map(item => 
        `${item.path} (${item.type}): ${item.content}`
      ).join('\n');
      
      if (groupText.length <= chunkSize) {
        // Small enough to be a single chunk
        chunks.push({
          text: groupText,
          metadata: {
            paths: group.items.map(item => item.path),
            types: group.items.map(item => item.type),
            depth: group.depth,
            itemCount: group.items.length,
            ...(options.includeMetadata ? { items: group.items } : {})
          }
        });
      } else {
        // Need to split into smaller chunks
        const textChunks = this.documentChunkingService.createChunks(groupText, {
          chunkSize,
          overlap,
          preserveParagraphs: true
        });
        
        textChunks.forEach((chunk: string, index: number) => {
          chunks.push({
            text: chunk,
            metadata: {
              groupIndex: chunks.length,
              chunkIndex: index,
              depth: group.depth,
              isPartial: true,
              ...(options.includeMetadata ? { originalGroup: group } : {})
            }
          });
        });
      }
    }
    
    return chunks;
  }
  
  /**
   * Group JSON data by context (similar paths and depths)
   */
  private groupJsonDataByContext(
    extractedData: Array<{
      path: string;
      content: string;
      type: string;
      depth: number;
    }>
  ): Array<{
    depth: number;
    basePath: string;
    items: Array<{
      path: string;
      content: string;
      type: string;
      depth: number;
    }>;
  }> {
    const groups = new Map<string, Array<{
      path: string;
      content: string;
      type: string;
      depth: number;
    }>>();
    
    for (const item of extractedData) {
      // Create a base path by removing the last segment
      const pathParts = item.path.split(/[.\[\]]/);
      const basePath = pathParts.slice(0, -1).join('.');
      const groupKey = `${item.depth}-${basePath}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    }
    
    return Array.from(groups.entries()).map(([key, items]) => {
      const [depth, basePath] = key.split('-', 2);
      return {
        depth: parseInt(depth),
        basePath: basePath || 'root',
        items
      };
    });
  }
  
  /**
   * Create embeddings for chunks
   */
  private async createEmbeddingsForChunks(
    chunks: Array<{ text: string; metadata: Record<string, any> }>
  ): Promise<Array<{
    vector: number[];
    text: string;
    metadata: Record<string, any>;
  }>> {
    const embeddings: Array<{
      vector: number[];
      text: string;
      metadata: Record<string, any>;
    }> = [];
    
    for (const chunk of chunks) {
      try {
        const embedding = await this.embeddingService.createEmbedding(chunk.text);
        embeddings.push({
          vector: embedding,
          text: chunk.text,
          metadata: chunk.metadata
        });
      } catch (error) {
        this.logger.error(`Error creating embedding for chunk: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with other chunks
      }
    }
    
    return embeddings;
  }
  
  /**
   * Get supported file extensions
   */
  getSupportedExtensions(): string[] {
    return ['.json', '.jsonl', '.ndjson'];
  }
  
  /**
   * Validate if file can be processed
   */
  canProcess(filePath: string): boolean {
    const extension = filePath.toLowerCase().split('.').pop();
    return this.getSupportedExtensions().includes(`.${extension}`);
  }
} 