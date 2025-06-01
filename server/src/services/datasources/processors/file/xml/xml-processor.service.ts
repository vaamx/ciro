import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '@common/utils/logger-factory';
import { BaseDocumentProcessor, ProcessingResult } from '../base-document.processor';
import { ConfigService } from '@services/core/config.service';
import { QdrantCollectionService } from '../../../../vector/collection-manager.service';
import { QdrantIngestionService } from '../../../../vector/ingestion.service';
import { EmbeddingService } from '../../../../llm/embedding.service';
import { SocketService } from '@services/util/socket.service';
import { DocumentChunkingService } from '@services/rag/chunking/document-chunking.service';
import { promises as fs } from 'fs';
import * as xml2js from 'xml2js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

/**
 * Service for processing XML files
 * Parses XML structure and creates embeddings for semantic search
 */
@Injectable()
export class XmlProcessorService extends BaseDocumentProcessor {
  
  constructor(
    private configService: ConfigService,
    private qdrantCollectionService: QdrantCollectionService,
    private qdrantIngestionService: QdrantIngestionService,
    private embeddingService: EmbeddingService,
    socketService: SocketService,
    private documentChunkingService: DocumentChunkingService
  ) {
    super('XmlProcessorService', socketService);
  }
  
  /**
   * Process a file (required by base class)
   */
  async processFile(
    filePath: string,
    dataSourceId: number,
    organizationId: number,
    userId: string,
    metadata: Record<string, any>
  ): Promise<ProcessingResult> {
    return this.processDocument(filePath, dataSourceId);
  }

  /**
   * Process XML file and create embeddings
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
    this.logger.info(`Processing XML file: ${filePath}`);
    
    try {
      // Read and parse XML file
      const xmlContent = await fs.readFile(filePath, 'utf-8');
      const parser = new xml2js.Parser({
        explicitArray: false,
        mergeAttrs: true,
        normalize: true,
        normalizeTags: true,
        trim: true
      });
      
      const parsedXml = await parser.parseStringPromise(xmlContent);
      
      // Extract text content and structure
      const extractedData = this.extractXmlData(parsedXml, options.maxDepth || 10);
      
      // Create chunks from extracted data
      const chunks = await this.createChunksFromXmlData(extractedData, options);
      
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
          source: 'xml',
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
      
      this.logger.info(`XML processing completed in ${processingTime}ms. Created ${embeddings.length} embeddings.`);
      
      // Emit progress update
      this.socketService.getIO().to(`datasource_${dataSourceId}`).emit('processing_complete', {
        type: 'xml',
        filePath,
        chunksCreated: chunks.length,
        embeddingsCreated: embeddings.length,
        processingTime
      });
      
      return {
        status: 'success',
        chunks: chunks.length,
        message: `XML processing completed in ${processingTime}ms. Created ${embeddings.length} embeddings.`,
        metadata: {
          fileType: 'xml',
          filePath,
          rootElements: Object.keys(parsedXml),
          totalElements: this.countElements(parsedXml),
          embeddingsCreated: embeddings.length,
          processingTime
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing XML file: ${errorMessage}`);
      
      this.socketService.getIO().to(`datasource_${dataSourceId}`).emit('processing_error', {
        type: 'xml',
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
   * Extract data from parsed XML
   */
  private extractXmlData(
    xmlObject: any,
    maxDepth: number,
    currentDepth: number = 0,
    path: string = ''
  ): Array<{
    path: string;
    content: string;
    attributes: Record<string, any>;
    depth: number;
  }> {
    const results: Array<{
      path: string;
      content: string;
      attributes: Record<string, any>;
      depth: number;
    }> = [];
    
    if (currentDepth >= maxDepth) {
      return results;
    }
    
    if (typeof xmlObject === 'string' || typeof xmlObject === 'number') {
      results.push({
        path,
        content: String(xmlObject),
        attributes: {},
        depth: currentDepth
      });
      return results;
    }
    
    if (Array.isArray(xmlObject)) {
      xmlObject.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        results.push(...this.extractXmlData(item, maxDepth, currentDepth, itemPath));
      });
      return results;
    }
    
    if (typeof xmlObject === 'object' && xmlObject !== null) {
      for (const [key, value] of Object.entries(xmlObject)) {
        const newPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'string' || typeof value === 'number') {
          results.push({
            path: newPath,
            content: String(value),
            attributes: {},
            depth: currentDepth
          });
        } else {
          results.push(...this.extractXmlData(value, maxDepth, currentDepth + 1, newPath));
        }
      }
    }
    
    return results;
  }
  
  /**
   * Create chunks from extracted XML data
   */
  private async createChunksFromXmlData(
    extractedData: Array<{
      path: string;
      content: string;
      attributes: Record<string, any>;
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
    const groupedData = this.groupXmlDataByContext(extractedData);
    
    for (const group of groupedData) {
      const groupText = group.items.map(item => 
        `${item.path}: ${item.content}`
      ).join('\n');
      
      if (groupText.length <= chunkSize) {
        // Small enough to be a single chunk
        chunks.push({
          text: groupText,
          metadata: {
            paths: group.items.map(item => item.path),
            depth: group.depth,
            elementCount: group.items.length,
            ...(options.includeMetadata ? { attributes: group.items.map(item => item.attributes) } : {})
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
   * Group XML data by context for better chunking
   */
  private groupXmlDataByContext(
    extractedData: Array<{
      path: string;
      content: string;
      attributes: Record<string, any>;
      depth: number;
    }>
  ): Array<{
    depth: number;
    basePath: string;
    items: Array<{
      path: string;
      content: string;
      attributes: Record<string, any>;
      depth: number;
    }>;
  }> {
    const groups = new Map<string, Array<{
      path: string;
      content: string;
      attributes: Record<string, any>;
      depth: number;
    }>>();
    
    for (const item of extractedData) {
      // Get base path (remove last segment)
      const pathParts = item.path.split('.');
      const basePath = pathParts.slice(0, -1).join('.');
      
      if (!groups.has(basePath)) {
        groups.set(basePath, []);
      }
      groups.get(basePath)!.push(item);
    }
    
    return Array.from(groups.entries()).map(([basePath, items]) => ({
      depth: Math.min(...items.map(item => item.depth)),
      basePath,
      items
    }));
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
        const vector = await this.embeddingService.createEmbedding(chunk.text);
        embeddings.push({
          vector,
          text: chunk.text,
          metadata: chunk.metadata
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to create embedding for chunk: ${errorMessage}`);
      }
    }
    
    return embeddings;
  }
  
  /**
   * Count total elements in XML object
   */
  private countElements(obj: any): number {
    if (typeof obj !== 'object' || obj === null) {
      return 1;
    }
    
    if (Array.isArray(obj)) {
      return obj.reduce((count: number, item) => count + this.countElements(item), 0);
    }
    
    return (Object.values(obj) as any[]).reduce((count: number, value: any) => count + this.countElements(value), 1);
  }
  
  /**
   * Get supported file extensions
   */
  getSupportedExtensions(): string[] {
    return ['.xml', '.xsd', '.xsl', '.xslt'];
  }
  
  /**
   * Validate if file can be processed
   */
  canProcess(filePath: string): boolean {
    const extension = filePath.toLowerCase().split('.').pop();
    return this.getSupportedExtensions().includes(`.${extension}`);
  }
} 