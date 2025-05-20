import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import { shouldLogInitialization } from '../../../common/utils/logger-config';
import { ChunkingOptions } from '../interfaces';
import {
    DEFAULT_CHUNK_SIZE,
    DEFAULT_OVERLAP,
    DEFAULT_MIN_CHUNK_SIZE,
    DEFAULT_CHUNKING_OPTIONS,
    SECTION_PATTERNS,
    PARAGRAPH_PATTERNS
} from './chunking.constants';

@Injectable()
export class DocumentChunkingService {
    private readonly logger = winston.createLogger({ 
        level: process.env.LOG_LEVEL || 'info',
        transports: [new winston.transports.Console()]
     });

    constructor() {
        if (shouldLogInitialization('DocumentChunkingService')) {
            this.logger.info('DocumentChunkingService initialized');
        }
    }

    /**
     * Create chunks from text with enhanced options
     */
    createChunks(text: string, options: ChunkingOptions = {}): string[] {
        const startTime = Date.now();
        
        try {
            const mergedOptions = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
            
            this.logger.info(`Chunking text (${text.length} chars) with options:`, {
                chunkSize: mergedOptions.chunkSize,
                overlap: mergedOptions.overlap,
                smartChunking: mergedOptions.smartChunking,
                respectDocumentStructure: mergedOptions.respectDocumentStructure,
                adaptiveChunking: mergedOptions.adaptiveChunking
            });
            
            if (!text || text.trim().length === 0) {
                this.logger.warn('Empty text provided for chunking');
                return [];
            }

            let chunks: string[] = [];
            
            if (mergedOptions.smartChunking) {
                if (mergedOptions.respectDocumentStructure) {
                    const sections = this.splitBySections(text, SECTION_PATTERNS);
                    
                    if (sections.length > 1) {
                        this.logger.info(`Split text into ${sections.length} sections`);
                        for (const section of sections) {
                            let sectionChunkSize = mergedOptions.chunkSize || DEFAULT_CHUNK_SIZE;
                            if (mergedOptions.adaptiveChunking) {
                                sectionChunkSize = this.calculateAdaptiveChunkSize(section, sectionChunkSize);
                            }
                            
                            if (mergedOptions.preserveParagraphs) {
                                const paragraphs = this.splitByParagraphs(section, PARAGRAPH_PATTERNS);
                                const sectionChunks = this.chunkParagraphs(
                                    paragraphs, 
                                    sectionChunkSize, 
                                    mergedOptions.overlap || DEFAULT_OVERLAP,
                                    mergedOptions.minChunkSize || DEFAULT_MIN_CHUNK_SIZE
                                );
                                chunks = [...chunks, ...sectionChunks];
                            } else {
                                const sectionChunks = this.createSimpleChunks(
                                    section, 
                                    sectionChunkSize, 
                                    mergedOptions.overlap || DEFAULT_OVERLAP
                                );
                                chunks = [...chunks, ...sectionChunks];
                            }
                        }
                        const duration = (Date.now() - startTime) / 1000;
                        this.logger.info(`Created ${chunks.length} chunks using section-based chunking in ${duration.toFixed(2)}s`);
                        return chunks;
                    }
                }
                
                if (mergedOptions.preserveParagraphs) {
                    const paragraphs = this.splitByParagraphs(text, PARAGRAPH_PATTERNS);
                    if (paragraphs.length > 1) {
                        this.logger.info(`Split text into ${paragraphs.length} paragraphs`);
                        chunks = this.chunkParagraphs(
                            paragraphs, 
                            mergedOptions.chunkSize || DEFAULT_CHUNK_SIZE, 
                            mergedOptions.overlap || DEFAULT_OVERLAP,
                            mergedOptions.minChunkSize || DEFAULT_MIN_CHUNK_SIZE
                        );
                        const duration = (Date.now() - startTime) / 1000;
                        this.logger.info(`Created ${chunks.length} chunks using paragraph-based chunking in ${duration.toFixed(2)}s`);
                        return chunks;
                    }
                }
            }
            
            chunks = this.createSimpleChunks(
                text, 
                mergedOptions.chunkSize || DEFAULT_CHUNK_SIZE, 
                mergedOptions.overlap || DEFAULT_OVERLAP
            );
            
            const duration = (Date.now() - startTime) / 1000;
            this.logger.info(`Created ${chunks.length} chunks using simple chunking in ${duration.toFixed(2)}s`);
            return chunks;
        } catch (error) {
            const duration = (Date.now() - startTime) / 1000;
            this.logger.error(`Error creating chunks after ${duration.toFixed(2)}s: ${error instanceof Error ? error.message : String(error)}`);
            const fallbackChunks = this.createSimpleChunks(
                text, 
                options.chunkSize || DEFAULT_CHUNK_SIZE, 
                options.overlap || DEFAULT_OVERLAP
            );
            this.logger.info(`Fallback: Created ${fallbackChunks.length} chunks using simple chunking`);
            return fallbackChunks;
        }
    }

    /**
     * Create simple chunks by splitting text at fixed intervals
     */
    private createSimpleChunks(text: string, chunkSize: number, overlap: number): string[] {
        const chunks: string[] = [];
        if (text.length <= chunkSize) return [text];
        
        let startIndex = 0;
        while (startIndex < text.length) {
            let endIndex = startIndex + chunkSize;
            if (endIndex < text.length) {
                const lastSentenceBreak = text.substring(startIndex, endIndex).search(/[.!?]\s+[A-Z]/);
                if (lastSentenceBreak !== -1 && lastSentenceBreak > chunkSize * 0.7) {
                    endIndex = startIndex + lastSentenceBreak + 2;
                } else {
                    const lastSpace = text.lastIndexOf(' ', endIndex);
                    if (lastSpace > startIndex) endIndex = lastSpace;
                }
            } else {
                endIndex = text.length;
            }
            const chunk = text.substring(startIndex, endIndex).trim();
            if (chunk.length > 0) chunks.push(chunk);
            startIndex = endIndex - overlap;
            if (startIndex <= 0 || startIndex >= text.length - 1) break;
        }
        return chunks;
    }
    
    /**
     * Split text by sections based on headings and other section markers
     */
    private splitBySections(text: string, sectionPatterns: RegExp[]): string[] {
        try {
            const sectionBoundaries: number[] = [0];
            for (const pattern of sectionPatterns) {
                const matches = text.matchAll(new RegExp(pattern, 'gm'));
                for (const match of matches) {
                    if (match.index !== undefined) {
                        let lineStart = text.lastIndexOf('\n', match.index);
                        lineStart = (lineStart === -1) ? 0 : lineStart + 1;
                        sectionBoundaries.push(lineStart);
                    }
                }
            }
            sectionBoundaries.push(text.length);
            const uniqueBoundaries = [...new Set(sectionBoundaries)].sort((a, b) => a - b);
            const sections: string[] = [];
            for (let i = 0; i < uniqueBoundaries.length - 1; i++) {
                const start = uniqueBoundaries[i];
                const end = uniqueBoundaries[i + 1];
                if (end > start) {
                    const section = text.substring(start, end).trim();
                    if (section.length > 0) sections.push(section);
                }
            }
            return sections;
        } catch (error) {
            this.logger.error(`Error splitting by sections: ${error instanceof Error ? error.message : String(error)}`);
            return [text];
        }
    }

    /**
     * Split text by paragraphs
     */
    private splitByParagraphs(text: string, paragraphPatterns: RegExp[]): string[] {
        try {
            let normalizedText = text;
            for (const pattern of paragraphPatterns) {
                normalizedText = normalizedText.replace(pattern, '\n\n');
            }
            const paragraphs = normalizedText.split('\n\n');
            return paragraphs.map(p => p.trim()).filter(p => p.length > 0);
        } catch (error) {
            this.logger.error(`Error splitting by paragraphs: ${error instanceof Error ? error.message : String(error)}`);
            return [text];
        }
    }

    /**
     * Chunk paragraphs while respecting paragraph boundaries
     */
    private chunkParagraphs(
        paragraphs: string[], 
        chunkSize: number, 
        overlap: number,
        minChunkSize: number
    ): string[] {
        const chunks: string[] = [];
        let currentChunk = '';
        for (const paragraph of paragraphs) {
            if (currentChunk.length + paragraph.length + 1 > chunkSize && currentChunk.length > 0) {
                if (currentChunk.length >= minChunkSize) chunks.push(currentChunk);
                if (overlap > 0 && currentChunk.length > overlap) {
                    const paragraphBreaks = [...currentChunk.matchAll(/\n\n/g)].map(m => m.index);
                    let overlapStart = currentChunk.length - overlap;
                    for (let i = paragraphBreaks.length - 1; i >= 0; i--) {
                        const breakIndex = paragraphBreaks[i];
                        if (breakIndex !== undefined && breakIndex < overlapStart) {
                            overlapStart = breakIndex + 2;
                            break;
                        }
                    }
                    currentChunk = currentChunk.substring(overlapStart) + '\n\n';
                } else {
                    currentChunk = '';
                }
            } else if (currentChunk.length > 0) {
                currentChunk += '\n\n';
            }
            currentChunk += paragraph;
        }
        if (currentChunk.length > 0 && currentChunk.length >= minChunkSize) chunks.push(currentChunk);
        return chunks;
    }

    /**
     * Calculate adaptive chunk size based on text characteristics
     */
    private calculateAdaptiveChunkSize(text: string, baseChunkSize: number): number {
        if (text.length < baseChunkSize * 1.5) {
            return Math.max(DEFAULT_MIN_CHUNK_SIZE, Math.floor(text.length / 2));
        }
        const newlineCount = (text.match(/\n/g) || []).length;
        const newlineDensity = newlineCount / text.length;
        if (newlineDensity < 0.01 && text.length > baseChunkSize * 3) {
            return Math.min(baseChunkSize * 1.5, 2000);
        }
        if (newlineDensity > 0.05) {
            return Math.max(DEFAULT_MIN_CHUNK_SIZE, baseChunkSize * 0.8);
        }
        return baseChunkSize;
    }
} 