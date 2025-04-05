import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import { shouldLogInitialization } from '../../utils/logger-config';

/**
 * Options for chunking text
 */
export interface ChunkingOptions {
    chunkSize?: number;
    overlap?: number;
    minChunkSize?: number;
    maxChunkSize?: number;
    splitBySection?: boolean;
    preserveParagraphs?: boolean;
    smartChunking?: boolean; // New option for smart chunking
    respectDocumentStructure?: boolean; // New option to respect document structure
    adaptiveChunking?: boolean; // New option for adaptive chunking
    semanticSplitting?: boolean; // New option for semantic-based splitting
}

/**
 * Service for handling text chunking
 */
@Injectable()
export class ChunkingService {
    private readonly logger = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf((info) => {
                const { timestamp, level, message, ...rest } = info;
                const formattedMessage = `${timestamp} [${level.toUpperCase()}] [ChunkingService]: ${message}`;
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
                        const formattedMessage = `${timestamp} [${level.toUpperCase()}] [ChunkingService]: ${message}`;
                        return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
                    })
                )
            })
        ]
    });
    private readonly defaultChunkSize = 1000;
    private readonly defaultOverlap = 200;
    private readonly defaultMinChunkSize = 100;
    
    // Add singleton implementation
    
    private static constructorCallCount = 0;
    
    /**
     * Get the singleton instance of ChunkingService
     */
    
    
    /**
     * Get the count of constructor calls for diagnostics
     */
    public static getConstructorCallCount(): number {
        return ChunkingService.constructorCallCount;
    }
    
    private readonly defaultOptions: ChunkingOptions = {
        chunkSize: this.defaultChunkSize,
        overlap: this.defaultOverlap,
        minChunkSize: this.defaultMinChunkSize,
        splitBySection: true,
        preserveParagraphs: true,
        smartChunking: true,
        respectDocumentStructure: true,
        adaptiveChunking: true,
        semanticSplitting: true
    };

    // Patterns for identifying section boundaries
    private readonly sectionPatterns = [
        /^#+\s+.+$/m, // Markdown headings
        /^[A-Z\s]{3,}$/m, // ALL CAPS HEADINGS
        /^[\d.]+\s+[A-Z]/, // Numbered sections like "1.2 Title"
        /^(Section|Chapter|Part)\s+\d+/i, // Explicit section markers
    ];

    // Patterns for identifying paragraph boundaries
    private readonly paragraphPatterns = [
        /\n\s*\n/, // Double newline
        /\r\n\s*\r\n/, // Windows-style double newline
    ];

    constructor(
    private readonly chunkingService: ChunkingService,
    ) {
        ChunkingService.constructorCallCount++;
        
        // Warn if constructor is called multiple times
        if (ChunkingService.constructorCallCount > 1) {
            this.logger.warn(`⚠️ Warning: ChunkingService constructor called ${ChunkingService.constructorCallCount} times. Use this.chunkingService instead.`);
            if (ChunkingService.instance) {
                return ChunkingService.instance;
            }
        }
        
        if (shouldLogInitialization('ChunkingService')) {
            this.logger.info('ChunkingService initialized with default options');
        }
    }

    /**
     * Create chunks from text with enhanced options
     * @param text Text to chunk
     * @param options Chunking options
     * @returns Array of text chunks
     */
    createChunks(text: string, options: ChunkingOptions = {}): string[] {
        const startTime = Date.now();
        
        try {
            // Merge default options with provided options
        const mergedOptions = { ...this.defaultOptions, ...options };
            
            // Log chunking parameters
            this.logger.info(`Chunking text (${text.length} chars) with options:`, {
                chunkSize: mergedOptions.chunkSize,
                overlap: mergedOptions.overlap,
                smartChunking: mergedOptions.smartChunking,
                respectDocumentStructure: mergedOptions.respectDocumentStructure,
                adaptiveChunking: mergedOptions.adaptiveChunking
            });
            
            // Handle empty text
        if (!text || text.trim().length === 0) {
            this.logger.warn('Empty text provided for chunking');
            return [];
        }

            let chunks: string[] = [];
            
            // Apply different chunking strategies based on options
            if (mergedOptions.smartChunking) {
                // If smart chunking is enabled, try to split by document structure first
                if (mergedOptions.respectDocumentStructure) {
                    // Split by sections first
                    const sections = this.splitBySections(text);
                    
                    if (sections.length > 1) {
                        this.logger.info(`Split text into ${sections.length} sections`);
                        
                        // Process each section separately
                        for (const section of sections) {
                            // Adapt chunk size based on section length if adaptive chunking is enabled
                            let sectionChunkSize = mergedOptions.chunkSize || this.defaultChunkSize;
                            
                            if (mergedOptions.adaptiveChunking) {
                                sectionChunkSize = this.calculateAdaptiveChunkSize(section, sectionChunkSize);
                            }
                            
                            // Split section into paragraphs if preserve paragraphs is enabled
                            if (mergedOptions.preserveParagraphs) {
                                const paragraphs = this.splitByParagraphs(section);
                                const sectionChunks = this.chunkParagraphs(
                                    paragraphs, 
                                    sectionChunkSize, 
                                    mergedOptions.overlap || this.defaultOverlap,
                                    mergedOptions.minChunkSize || this.defaultMinChunkSize
                                );
                                chunks = [...chunks, ...sectionChunks];
                            } else {
                                // Otherwise, use simple chunking for this section
                                const sectionChunks = this.createSimpleChunks(
                                    section, 
                                    sectionChunkSize, 
                                    mergedOptions.overlap || this.defaultOverlap
                                );
                                chunks = [...chunks, ...sectionChunks];
                            }
                        }
                        
                        const duration = (Date.now() - startTime) / 1000;
                        this.logger.info(`Created ${chunks.length} chunks using section-based chunking in ${duration.toFixed(2)}s`);
                        return chunks;
                    }
                }
                
                // If no sections were found or respectDocumentStructure is disabled, try paragraph chunking
                if (mergedOptions.preserveParagraphs) {
                    const paragraphs = this.splitByParagraphs(text);
                    
                    if (paragraphs.length > 1) {
                        this.logger.info(`Split text into ${paragraphs.length} paragraphs`);
                        
                        chunks = this.chunkParagraphs(
                            paragraphs, 
                            mergedOptions.chunkSize || this.defaultChunkSize, 
                            mergedOptions.overlap || this.defaultOverlap,
                            mergedOptions.minChunkSize || this.defaultMinChunkSize
                        );
                        
                        const duration = (Date.now() - startTime) / 1000;
                        this.logger.info(`Created ${chunks.length} chunks using paragraph-based chunking in ${duration.toFixed(2)}s`);
                        return chunks;
                    }
                }
            }
            
            // Fallback to simple chunking if other methods didn't produce results
            chunks = this.createSimpleChunks(
                text, 
                mergedOptions.chunkSize || this.defaultChunkSize, 
                mergedOptions.overlap || this.defaultOverlap
            );
            
            const duration = (Date.now() - startTime) / 1000;
            this.logger.info(`Created ${chunks.length} chunks using simple chunking in ${duration.toFixed(2)}s`);
            return chunks;
        } catch (error) {
            const duration = (Date.now() - startTime) / 1000;
            this.logger.error(`Error creating chunks after ${duration.toFixed(2)}s: ${error instanceof Error ? error.message : String(error)}`);
            
            // Fallback to simple chunking in case of error
            try {
                const chunks = this.createSimpleChunks(
                    text, 
                    options.chunkSize || this.defaultChunkSize, 
                    options.overlap || this.defaultOverlap
                );
                this.logger.info(`Fallback: Created ${chunks.length} chunks using simple chunking`);
                return chunks;
            } catch (fallbackError) {
                this.logger.error(`Fallback chunking also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
                
                // Last resort: return the entire text as a single chunk
                this.logger.warn('Last resort: Returning entire text as a single chunk');
                return [text];
            }
        }
    }

    /**
     * Create simple chunks by splitting text at fixed intervals
     */
    private createSimpleChunks(text: string, chunkSize: number, overlap: number): string[] {
        const chunks: string[] = [];
        
        // Handle case where text is shorter than chunk size
        if (text.length <= chunkSize) {
            return [text];
        }
        
        let startIndex = 0;
        
        while (startIndex < text.length) {
            // Calculate end index for this chunk
            let endIndex = startIndex + chunkSize;
            
            // If we're not at the end of the text, try to find a natural break point
            if (endIndex < text.length) {
                // Look for a period, question mark, or exclamation mark followed by a space or newline
                const lastSentenceBreak = text.substring(startIndex, endIndex).search(/[.!?]\s+[A-Z]/);
                
                if (lastSentenceBreak !== -1 && lastSentenceBreak > chunkSize * 0.7) {
                    // If we found a sentence break that's at least 70% into the chunk, use it
                    endIndex = startIndex + lastSentenceBreak + 2; // +2 to include the punctuation and space
                } else {
                    // Otherwise, look for the last space
                    const lastSpace = text.lastIndexOf(' ', endIndex);
                    if (lastSpace > startIndex) {
                        endIndex = lastSpace;
                    }
                }
            } else {
                // If we're at the end of the text, just use the remaining text
                endIndex = text.length;
            }
            
            // Extract the chunk
            const chunk = text.substring(startIndex, endIndex).trim();
            
            // Only add non-empty chunks
            if (chunk.length > 0) {
                chunks.push(chunk);
            }
            
            // Move the start index for the next chunk, accounting for overlap
            startIndex = endIndex - overlap;
            
            // Ensure we're making forward progress
            if (startIndex <= 0 || startIndex >= text.length - 1) {
                break;
            }
        }
        
        return chunks;
    }
    
    /**
     * Split text by sections based on headings and other section markers
     */
    private splitBySections(text: string): string[] {
        try {
            // Find all potential section boundaries
            const sectionBoundaries: number[] = [];
            
            // Add the start of the text
            sectionBoundaries.push(0);
            
            // Find all matches for section patterns
            for (const pattern of this.sectionPatterns) {
                const matches = text.matchAll(new RegExp(pattern, 'gm'));
                
                for (const match of matches) {
                    if (match.index !== undefined) {
                        // Find the start of the line containing the match
                        let lineStart = text.lastIndexOf('\n', match.index);
                        if (lineStart === -1) lineStart = 0;
                        else lineStart += 1; // Skip the newline character
                        
                        sectionBoundaries.push(lineStart);
                    }
                }
            }
            
            // Add the end of the text
            sectionBoundaries.push(text.length);
            
            // Sort boundaries and remove duplicates
            const uniqueBoundaries = [...new Set(sectionBoundaries)].sort((a, b) => a - b);
            
            // Create sections from boundaries
        const sections: string[] = [];
            
            for (let i = 0; i < uniqueBoundaries.length - 1; i++) {
                const start = uniqueBoundaries[i];
                const end = uniqueBoundaries[i + 1];
                
                // Only add non-empty sections
                if (end > start) {
            const section = text.substring(start, end).trim();
            if (section.length > 0) {
                sections.push(section);
                    }
                }
            }
            
            return sections;
        } catch (error) {
            this.logger.error(`Error splitting by sections: ${error instanceof Error ? error.message : String(error)}`);
            return [text]; // Return the original text as a single section
        }
    }

    /**
     * Split text by paragraphs
     */
    private splitByParagraphs(text: string): string[] {
        try {
            // Replace all paragraph separators with a standard marker
            let normalizedText = text;
            
            for (const pattern of this.paragraphPatterns) {
                normalizedText = normalizedText.replace(pattern, '\n\n');
            }
            
            // Split by double newlines
            const paragraphs = normalizedText.split('\n\n');
            
            // Filter out empty paragraphs and trim whitespace
        return paragraphs
            .map(p => p.trim())
            .filter(p => p.length > 0);
        } catch (error) {
            this.logger.error(`Error splitting by paragraphs: ${error instanceof Error ? error.message : String(error)}`);
            return [text]; // Return the original text as a single paragraph
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
            // If adding this paragraph would exceed chunk size and we already have content
            if (currentChunk.length + paragraph.length + 1 > chunkSize && currentChunk.length > 0) {
                // Only add chunks that meet the minimum size
                if (currentChunk.length >= minChunkSize) {
                    chunks.push(currentChunk);
                }
                
                // Start a new chunk, potentially with overlap from the previous chunk
                if (overlap > 0 && currentChunk.length > overlap) {
                    // Try to find a paragraph break for the overlap
                    const paragraphBreaks = [...currentChunk.matchAll(/\n\n/g)].map(m => m.index);
                    
                    // Find the last paragraph break that would give us an overlap of approximately the desired size
                    let overlapStart = currentChunk.length - overlap;
                    for (let i = paragraphBreaks.length - 1; i >= 0; i--) {
                        const breakIndex = paragraphBreaks[i];
                        if (breakIndex !== undefined && breakIndex < overlapStart) {
                            overlapStart = breakIndex + 2; // +2 to skip the double newline
                            break;
                        }
                    }
                    
                    currentChunk = currentChunk.substring(overlapStart) + '\n\n';
                } else {
                    currentChunk = '';
                }
            } else if (currentChunk.length > 0) {
                // Add a paragraph separator if this isn't the first paragraph in the chunk
                currentChunk += '\n\n';
            }
            
            // Add the paragraph to the current chunk
            currentChunk += paragraph;
        }
        
        // Add the final chunk if it's not empty and meets the minimum size
        if (currentChunk.length > 0 && currentChunk.length >= minChunkSize) {
            chunks.push(currentChunk);
        }
        
        return chunks;
    }

    /**
     * Calculate adaptive chunk size based on text characteristics
     */
    private calculateAdaptiveChunkSize(text: string, baseChunkSize: number): number {
        // For very short texts, use a smaller chunk size to avoid creating too few chunks
        if (text.length < baseChunkSize * 1.5) {
            return Math.max(this.defaultMinChunkSize, Math.floor(text.length / 2));
        }
        
        // For very long texts with few natural breaks, use a larger chunk size
        const newlineCount = (text.match(/\n/g) || []).length;
        const newlineDensity = newlineCount / text.length;
        
        if (newlineDensity < 0.01 && text.length > baseChunkSize * 3) {
            // Text has few newlines and is long, increase chunk size
            return Math.min(baseChunkSize * 1.5, 2000);
        }
        
        // For texts with many short paragraphs, use a smaller chunk size
        if (newlineDensity > 0.05) {
            return Math.max(this.defaultMinChunkSize, baseChunkSize * 0.8);
        }
        
        // Otherwise, use the base chunk size
        return baseChunkSize;
    }

    /**
     * Create chunks from extracted document elements
     * @param elements Array of document elements with text property
     * @param options Chunking options
     * @returns Array of chunk objects with text and metadata
     */
    createChunksFromElements(
        elements: Array<{
            element_id: string;
            type: string;
            text: string;
            metadata?: Record<string, any>;
        }>,
        options: {
            chunkSize?: number;
            chunkOverlap?: number;
            smartChunking?: boolean;
        } = {}
    ): Array<{
        text: string;
        element_ids: string[];
        element_types: string[];
        metadata: Record<string, any>;
    }> {
        const {
            chunkSize = 1000,
            chunkOverlap = 200,
            smartChunking = true
        } = options;

        this.logger.info(`Creating chunks from ${elements.length} elements with size ${chunkSize} and overlap ${chunkOverlap}`);

        // Filter out elements with empty text
        const validElements = elements.filter(el => el.text && el.text.trim().length > 0);
        
        if (validElements.length === 0) {
            this.logger.warn('No valid elements provided for chunking');
            return [];
        }

        // If smart chunking is enabled, use optimized strategy for different element types
        if (smartChunking) {
            return this.createSmartChunks(validElements, chunkSize, chunkOverlap);
        }

        // Otherwise use the standard chunking approach
        const chunks: Array<{
            text: string;
            element_ids: string[];
            element_types: string[];
            metadata: Record<string, any>;
        }> = [];
        
        let currentChunk = {
            text: '',
            element_ids: [] as string[],
            element_types: [] as string[],
            metadata: {} as Record<string, any>
        };

        for (const element of validElements) {
            // If adding this element would exceed chunk size, store current chunk and start a new one
            if (currentChunk.text.length + element.text.length + 1 > chunkSize && currentChunk.text.length > 0) {
                chunks.push({...currentChunk});
                
                // Start new chunk with overlap from previous chunk if possible
                if (chunkOverlap > 0 && currentChunk.text.length > chunkOverlap) {
                    // Try to find a natural break point for the overlap
                    const lastNewlineBeforeOverlap = currentChunk.text.lastIndexOf('\n', currentChunk.text.length - chunkOverlap - 1);
                    if (lastNewlineBeforeOverlap !== -1 && currentChunk.text.length - lastNewlineBeforeOverlap <= chunkOverlap * 1.5) {
                        currentChunk.text = currentChunk.text.substring(lastNewlineBeforeOverlap + 1);
                    } else {
                        currentChunk.text = currentChunk.text.substring(currentChunk.text.length - chunkOverlap);
                    }
                    
                    // Keep track of which elements are in the overlap
                    // We'll need to recalculate element_ids and element_types
                    currentChunk.element_ids = [];
                    currentChunk.element_types = [];
                    // We'll add the current element's IDs and types below
                } else {
                    currentChunk = {
                        text: '',
                        element_ids: [],
                        element_types: [],
                        metadata: {}
                    };
                }
            }

            // Add element to current chunk
            if (currentChunk.text.length > 0) {
                currentChunk.text += '\n';
            }
            currentChunk.text += element.text;
            
            // Add element ID and type if not already included
            if (!currentChunk.element_ids.includes(element.element_id)) {
                currentChunk.element_ids.push(element.element_id);
            }
            if (!currentChunk.element_types.includes(element.type)) {
                currentChunk.element_types.push(element.type);
            }
            
            // Merge metadata
            if (element.metadata) {
                currentChunk.metadata = {
                    ...currentChunk.metadata,
                    ...element.metadata
                };
            }
        }

        // Add the last chunk if it's not empty
        if (currentChunk.text.length > 0) {
            chunks.push({...currentChunk});
        }

        this.logger.info(`Created ${chunks.length} chunks from ${validElements.length} elements`);
        return chunks;
    }

    /**
     * Create smart chunks from elements based on element types and semantic coherence
     * This method optimizes chunking for different document structures
     */
    private createSmartChunks(
        elements: Array<{
            element_id: string;
            type: string;
            text: string;
            metadata?: Record<string, any>;
        }>,
        chunkSize: number = 1000,
        chunkOverlap: number = 200
    ): Array<{
        text: string;
        element_ids: string[];
        element_types: string[];
        metadata: Record<string, any>;
    }> {
        this.logger.info(`Using smart chunking strategy for ${elements.length} elements`);
        
        const chunks: Array<{
            text: string;
            element_ids: string[];
            element_types: string[];
            metadata: Record<string, any>;
        }> = [];
        
        try {
            // Group elements by page number to maintain page context
            const elementsByPage: Record<number, typeof elements> = {};
            
            // Group elements by page
            for (const element of elements) {
                const pageNumber = element.metadata?.page_number || 0;
                if (!elementsByPage[pageNumber]) {
                    elementsByPage[pageNumber] = [];
                }
                elementsByPage[pageNumber].push(element);
            }
            
            // Process each page separately to maintain context
            for (const pageNumber of Object.keys(elementsByPage).map(Number)) {
                const pageElements = elementsByPage[pageNumber];
                
                // Sort elements by their position on the page if coordinates are available
                const sortedElements = this.sortElementsByPosition(pageElements);
                
                // Group elements by semantic sections (titles, paragraphs, etc.)
                const sections = this.groupElementsIntoSections(sortedElements);
                
                // Create chunks from sections
                for (const section of sections) {
                    // If a section is small enough, keep it as a single chunk
                    if (this.getTotalTextLength(section) <= chunkSize) {
                        chunks.push(this.createChunkFromElements(section));
                        continue;
                    }
                    
                    // Otherwise, create multiple chunks from this section
                    let currentChunkElements: typeof section = [];
                    let currentLength = 0;
                    
                    for (const element of section) {
                        // If adding this element would exceed chunk size and we already have elements
                        if (currentLength + element.text.length > chunkSize && currentChunkElements.length > 0) {
                            // Create a chunk from the current elements
                            chunks.push(this.createChunkFromElements(currentChunkElements));
                            
                            // Start a new chunk with overlap
                            if (chunkOverlap > 0) {
                                const overlapElements = this.getOverlapElements(currentChunkElements, chunkOverlap);
                                currentChunkElements = [...overlapElements];
                                currentLength = this.getTotalTextLength(currentChunkElements);
                            } else {
                                currentChunkElements = [];
                                currentLength = 0;
                            }
                        }
                        
                        // Add the element to the current chunk
                        currentChunkElements.push(element);
                        currentLength += element.text.length;
                    }
                    
                    // Add the final chunk if it's not empty
                    if (currentChunkElements.length > 0) {
                        chunks.push(this.createChunkFromElements(currentChunkElements));
                    }
                }
            }
            
            this.logger.info(`Created ${chunks.length} chunks from ${elements.length} elements using smart chunking`);
            return chunks;
        } catch (error) {
            this.logger.error(`Error in smart chunking: ${error instanceof Error ? error.message : String(error)}`);
            
            // Fallback to simpler chunking strategy
            return this.createSimpleChunksFromElements(elements, chunkSize, chunkOverlap);
        }
    }

    /**
     * Fallback method for creating chunks from elements when smart chunking fails
     */
    private createSimpleChunksFromElements(
        elements: Array<{
            element_id: string;
            type: string;
            text: string;
            metadata?: Record<string, any>;
        }>,
        chunkSize: number,
        chunkOverlap: number
    ): Array<{
        text: string;
        element_ids: string[];
        element_types: string[];
        metadata: Record<string, any>;
    }> {
        this.logger.info(`Using simple chunking fallback for ${elements.length} elements`);
        
        const chunks: Array<{
            text: string;
            element_ids: string[];
            element_types: string[];
            metadata: Record<string, any>;
        }> = [];
        
        let currentChunkElements: typeof elements = [];
        let currentLength = 0;
        
        for (const element of elements) {
            // If adding this element would exceed chunk size and we already have elements
            if (currentLength + element.text.length > chunkSize && currentChunkElements.length > 0) {
                // Create a chunk from the current elements
                chunks.push(this.createChunkFromElements(currentChunkElements));
                
                // Start a new chunk with overlap
                if (chunkOverlap > 0) {
                    const overlapElements = this.getOverlapElements(currentChunkElements, chunkOverlap);
                    currentChunkElements = [...overlapElements];
                    currentLength = this.getTotalTextLength(currentChunkElements);
                } else {
                    currentChunkElements = [];
                    currentLength = 0;
                }
            }
            
            // Add the element to the current chunk
            currentChunkElements.push(element);
            currentLength += element.text.length;
        }
        
        // Add the final chunk if it's not empty
        if (currentChunkElements.length > 0) {
            chunks.push(this.createChunkFromElements(currentChunkElements));
        }
        
        this.logger.info(`Created ${chunks.length} chunks from ${elements.length} elements using simple chunking fallback`);
        return chunks;
    }

    /**
     * Sort elements by their position on the page
     */
    private sortElementsByPosition(elements: Array<{
        element_id: string;
        type: string;
        text: string;
        metadata?: Record<string, any>;
    }>): Array<{
        element_id: string;
        type: string;
        text: string;
        metadata?: Record<string, any>;
    }> {
        // If elements have coordinates, sort by y-coordinate (top to bottom)
        const elementsWithCoordinates = elements.filter(el => 
            el.metadata?.coordinates?.y !== undefined
        );
        
        if (elementsWithCoordinates.length === elements.length) {
            return [...elements].sort((a, b) => {
                const aY = a.metadata?.coordinates?.y || 0;
                const bY = b.metadata?.coordinates?.y || 0;
                return aY - bY;
            });
        }
        
        // If no coordinates, return elements as is
        return elements;
    }
    
    /**
     * Group elements into semantic sections based on element types
     */
    private groupElementsIntoSections(elements: Array<{
        element_id: string;
        type: string;
        text: string;
        metadata?: Record<string, any>;
    }>): Array<Array<{
        element_id: string;
        type: string;
        text: string;
        metadata?: Record<string, any>;
    }>> {
        const sections: Array<Array<{
            element_id: string;
            type: string;
            text: string;
            metadata?: Record<string, any>;
        }>> = [];
        
        let currentSection: Array<{
            element_id: string;
            type: string;
            text: string;
            metadata?: Record<string, any>;
        }> = [];
        
        // Helper to check if an element starts a new section
        const isNewSectionStart = (element: {
            type: string;
            text: string;
        }): boolean => {
            // Headers, titles, and section markers start new sections
            return ['Title', 'Header', 'SectionHeader', 'Heading'].includes(element.type) ||
                   (element.type === 'NarrativeText' && element.text.length < 50 && /^[A-Z0-9\s]+$/.test(element.text));
        };
        
        for (const element of elements) {
            // If this element starts a new section and we have elements in the current section
            if (isNewSectionStart(element) && currentSection.length > 0) {
                sections.push([...currentSection]);
                currentSection = [];
            }
            
            // Add element to current section
            currentSection.push(element);
        }
        
        // Add the last section if it's not empty
        if (currentSection.length > 0) {
            sections.push(currentSection);
        }
        
        return sections;
    }
    
    /**
     * Get the total text length of all elements
     */
    private getTotalTextLength(elements: Array<{
        text: string;
    }>): number {
        return elements.reduce((total, el) => total + el.text.length, 0);
    }
    
    /**
     * Create a chunk from a list of elements
     */
    private createChunkFromElements(elements: Array<{
        element_id: string;
        type: string;
        text: string;
        metadata?: Record<string, any>;
    }>): {
        text: string;
        element_ids: string[];
        element_types: string[];
        metadata: Record<string, any>;
    } {
        const text = elements.map(el => el.text).join('\n');
        const element_ids = elements.map(el => el.element_id);
        const element_types = [...new Set(elements.map(el => el.type))];
        
        // Merge metadata from all elements
        const metadata: Record<string, any> = {};
        for (const element of elements) {
            if (element.metadata) {
                Object.assign(metadata, element.metadata);
            }
        }
        
        return {
            text,
            element_ids,
            element_types,
            metadata
        };
    }
    
    /**
     * Get elements to include in the overlap for the next chunk
     */
    private getOverlapElements(elements: Array<{
        element_id: string;
        type: string;
        text: string;
        metadata?: Record<string, any>;
    }>, overlapSize: number): Array<{
        element_id: string;
        type: string;
        text: string;
        metadata?: Record<string, any>;
    }> {
        // Start from the end and work backwards until we have enough text for the overlap
        let totalLength = 0;
        const overlapElements = [];
        
        for (let i = elements.length - 1; i >= 0; i--) {
            const element = elements[i];
            overlapElements.unshift(element);
            totalLength += element.text.length;
            
            if (totalLength >= overlapSize) {
                break;
            }
        }
        
        return overlapElements;
    }

    /**
     * Improved chunking with semantic boundaries
     * Tries to preserve complete sentences, paragraphs or sections
     */
    public semanticChunking(
        text: string,
        options: {
            targetChunkSize?: number;
            minChunkSize?: number;
            maxChunkSize?: number;
            overlap?: number;
        } = {}
    ): string[] {
        const {
            targetChunkSize = 1000,
            minChunkSize = 500,
            maxChunkSize = 1500,
            overlap = 100
        } = options;

        // Remove excessive whitespace
        const cleanedText = text.replace(/\s+/g, ' ').trim();
        
        if (cleanedText.length <= maxChunkSize) {
            return [cleanedText];
        }

        // Split by common document section markers with regex
        const sectionDelimiters = /(?:\n\s*#{1,6}\s+|\n\s*\d+\.\s+|\n\s*[-*]\s+|\n\n+)/g;
        
        // First try to split by sections/headers/paragraphs
        const preliminarySections = cleanedText.split(sectionDelimiters);
        
        const chunks: string[] = [];
        let currentChunk = '';
        
        // Process each preliminary section
        for (let i = 0; i < preliminarySections.length; i++) {
            const section = preliminarySections[i].trim();
            
            if (!section) continue;
            
            // If adding this section keeps the chunk size reasonable, add it
            if (currentChunk.length + section.length <= targetChunkSize) {
                currentChunk += (currentChunk ? ' ' : '') + section;
            } 
            // If the section alone exceeds max size, split it by sentences
            else if (section.length > maxChunkSize) {
                // If we have a current chunk, add it to chunks
                if (currentChunk) {
                    chunks.push(currentChunk);
                    // Keep the overlap from the end of the previous chunk
                    currentChunk = currentChunk.length > overlap 
                        ? currentChunk.slice(-overlap) 
                        : currentChunk;
                }
                
                // Split long section by sentences
                const sentences = this.splitIntoSentences(section);
                let sentenceChunk = '';
                
                for (const sentence of sentences) {
                    // If adding this sentence keeps chunk size reasonable
                    if (sentenceChunk.length + sentence.length <= targetChunkSize) {
                        sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
                    }
                    // If the sentence alone exceeds max size, split by token count
                    else if (sentence.length > maxChunkSize) {
                        // Add current sentence chunk if not empty
                        if (sentenceChunk) {
                            chunks.push(sentenceChunk);
                        }
                        
                        // Split long sentence by approximately maxChunkSize characters
                        // with overlap
                        let startPos = 0;
                        while (startPos < sentence.length) {
                            const endPos = Math.min(startPos + maxChunkSize, sentence.length);
                            chunks.push(sentence.slice(startPos, endPos));
                            startPos = endPos - overlap; // Create overlap
                            if (startPos < 0) startPos = 0;
                        }
                        
                        sentenceChunk = '';
                    }
                    // Otherwise create a new sentence chunk
                    else {
                        chunks.push(sentenceChunk);
                        sentenceChunk = sentence;
                    }
                }
                
                // Add any remaining sentence chunk
                if (sentenceChunk) {
                    currentChunk = sentenceChunk;
                }
            }
            // Current chunk + section is too large, finalize current chunk and start new one
            else {
                chunks.push(currentChunk);
                currentChunk = section;
            }
        }
        
        // Add the final chunk if it exists
        if (currentChunk) {
            chunks.push(currentChunk);
        }
        
        // Filter out any empty chunks and ensure minimum size
        return chunks
            .filter(chunk => chunk.trim().length > 0)
            .map(chunk => chunk.trim());
    }

    /**
     * Splits text into sentences using common sentence delimiters
     */
    private splitIntoSentences(text: string): string[] {
        // Pattern matches sentence endings (.!?) followed by a space or newline
        // but avoids splitting on common abbreviations and numeric uses of periods
        const sentencePattern = /(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!)\s+(?=[A-Z])/g;
        
        // Split by the pattern and keep the delimiters
        const sentences = text.split(sentencePattern).map(s => s.trim());
        
        return sentences.filter(s => s.length > 0);
    }
} 