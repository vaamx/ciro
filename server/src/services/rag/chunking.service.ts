import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import { shouldLogInitialization } from '../../common/utils/logger-config';
import { ChunkingOptions, IChunkingService, Document } from '../vector/vector.interfaces';
// Import constants - Although the service might become empty, keep imports for context for now
import {
    DEFAULT_CHUNK_SIZE,
    DEFAULT_OVERLAP,
    DEFAULT_MIN_CHUNK_SIZE,
    DEFAULT_CHUNKING_OPTIONS,
    SECTION_PATTERNS,
    PARAGRAPH_PATTERNS
} from './chunking/chunking.constants';

/**
 * DEPRECATED: Original Chunking Service.
 * Functionality has been moved to specialized services in the 'chunking' subdirectory:
 * - DocumentChunkingService
 * - ElementChunkingService
 * - SemanticChunkingService
 * 
 * This service might be removed or repurposed as a facade later.
 */
@Injectable()
export class ChunkingService implements IChunkingService {
    private readonly logger = winston.createLogger({ 
        level: process.env.LOG_LEVEL || 'info',
        transports: [new winston.transports.Console({ 
            format: winston.format.printf(info => `${new Date().toISOString()} [${info.level.toUpperCase()}] [ChunkingService-DEPRECATED]: ${info.message}`) 
        })]
     });

    constructor() {
        if (shouldLogInitialization('ChunkingService')) {
            this.logger.warn('ChunkingService is DEPRECATED and should not be directly injected. Use specialized chunking services (DocumentChunkingService, ElementChunkingService, SemanticChunkingService) instead.');
        }
    }

    /**
     * @deprecated Functionality moved to DocumentChunkingService.
     * Chunks text into Document objects 
     */
    async chunk(text: string, options?: ChunkingOptions): Promise<Document[]> {
        this.logger.warn('chunk called on deprecated ChunkingService. Use DocumentChunkingService.');
        const chunks = this.createChunks(text, options);
        
        // Convert string chunks to Document objects
        return chunks.map((content, index) => ({
            id: `chunk-${Date.now()}-${index}`,
            content,
            metadata: {
                source: 'deprecated-chunking-service',
                chunkIndex: index,
                deprecated: true
            }
        }));
    }

    /**
     * @deprecated Functionality moved to DocumentChunkingService.
     * Chunks a document into multiple Document objects
     */
    async chunkDocument(document: any, options?: ChunkingOptions): Promise<Document[]> {
        this.logger.warn('chunkDocument called on deprecated ChunkingService. Use DocumentChunkingService.');
        
        // Extract text content from the document if possible
        let textContent = '';
        if (typeof document === 'string') {
            textContent = document;
        } else if (document && typeof document === 'object') {
            textContent = document.content || document.text || document.body || '';
        }
        
        if (!textContent) {
            this.logger.warn('Failed to extract text from document in chunkDocument');
            return [];
        }
        
        // Reuse chunk method to process the text
        return this.chunk(textContent, options);
    }

    /**
     * @deprecated Functionality moved to DocumentChunkingService.
     */
    createChunks(text: string, options: ChunkingOptions = {}): string[] {
        this.logger.warn('createChunks called on deprecated ChunkingService. Use DocumentChunkingService.');
        // Placeholder return - actual implementation in DocumentChunkingService
        return text ? [text.substring(0, 1000)] : []; 
    }

    /**
     * @deprecated Functionality moved to ElementChunkingService.
     */
    createChunksFromElements(
        elements: Array<{ element_id: string; type: string; text: string; metadata?: Record<string, any>; }>,
        options?: { chunkSize?: number; chunkOverlap?: number; smartChunking?: boolean; }
    ): Array<{ text: string; element_ids: string[]; element_types: string[]; metadata: Record<string, any>; }> {
        this.logger.warn('createChunksFromElements called on deprecated ChunkingService. Use ElementChunkingService.');
        // Placeholder return - actual implementation in ElementChunkingService
        return []; 
    }

    /**
     * @deprecated Functionality moved to SemanticChunkingService.
     */
    semanticChunking(text: string, options?: { targetChunkSize?: number; minChunkSize?: number; maxChunkSize?: number; overlap?: number; }): string[] {
        this.logger.warn('semanticChunking called on deprecated ChunkingService. Use SemanticChunkingService.');
        // Placeholder return - actual implementation in SemanticChunkingService
        return text ? [text.substring(0, 1000)] : []; 
    }
} 