import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import { shouldLogInitialization } from '../../../common/utils/logger-config';

// Define element structure locally or import from a shared location if needed
interface DocumentElement {
    element_id: string;
    type: string;
    text: string;
    metadata?: Record<string, any>;
}

// Define the structure of the output chunk
interface ElementChunk {
    text: string;
    element_ids: string[];
    element_types: string[];
    metadata: Record<string, any>;
}

@Injectable()
export class ElementChunkingService {
    private readonly logger = winston.createLogger({ 
        // Basic logger setup - copy or adapt from original ChunkingService if needed
        level: process.env.LOG_LEVEL || 'info',
        transports: [new winston.transports.Console()]
     });
    
    constructor() {
        if (shouldLogInitialization('ElementChunkingService')) {
            this.logger.info('ElementChunkingService initialized');
        }
    }

    /**
     * Create chunks from extracted document elements
     */
    createChunksFromElements(
        elements: DocumentElement[],
        options: {
            chunkSize?: number;
            chunkOverlap?: number;
            smartChunking?: boolean;
        } = {}
    ): ElementChunk[] {
        const {
            chunkSize = 1000,
            chunkOverlap = 200,
            smartChunking = true
        } = options;

        this.logger.info(`Creating chunks from ${elements.length} elements with size ${chunkSize} and overlap ${chunkOverlap}`);

        const validElements = elements.filter(el => el.text && el.text.trim().length > 0);
        
        if (validElements.length === 0) {
            this.logger.warn('No valid elements provided for chunking');
            return [];
        }

        if (smartChunking) {
            return this.createSmartChunks(validElements, chunkSize, chunkOverlap);
        }

        // Fallback to simple element chunking
        return this.createSimpleChunksFromElements(validElements, chunkSize, chunkOverlap);
    }

    /**
     * Create smart chunks from elements based on element types and semantic coherence
     */
    private createSmartChunks(
        elements: DocumentElement[],
        chunkSize: number = 1000,
        chunkOverlap: number = 200
    ): ElementChunk[] {
        this.logger.info(`Using smart chunking strategy for ${elements.length} elements`);
        
        const chunks: ElementChunk[] = [];
        
        try {
            const elementsByPage: Record<number, DocumentElement[]> = {};
            for (const element of elements) {
                const pageNumber = element.metadata?.page_number || 0;
                if (!elementsByPage[pageNumber]) {
                    elementsByPage[pageNumber] = [];
                }
                elementsByPage[pageNumber].push(element);
            }
            
            for (const pageNumber of Object.keys(elementsByPage).map(Number)) {
                const pageElements = elementsByPage[pageNumber];
                const sortedElements = this.sortElementsByPosition(pageElements);
                const sections = this.groupElementsIntoSections(sortedElements);
                
                for (const section of sections) {
                    if (this.getTotalTextLength(section) <= chunkSize) {
                        chunks.push(this.createChunkFromElements(section));
                        continue;
                    }
                    
                    let currentChunkElements: DocumentElement[] = [];
                    let currentLength = 0;
                    
                    for (const element of section) {
                        if (currentLength + element.text.length > chunkSize && currentChunkElements.length > 0) {
                            chunks.push(this.createChunkFromElements(currentChunkElements));
                            
                            if (chunkOverlap > 0) {
                                const overlapElements = this.getOverlapElements(currentChunkElements, chunkOverlap);
                                currentChunkElements = [...overlapElements];
                                currentLength = this.getTotalTextLength(currentChunkElements);
                            } else {
                                currentChunkElements = [];
                                currentLength = 0;
                            }
                        }
                        
                        currentChunkElements.push(element);
                        currentLength += element.text.length;
                    }
                    
                    if (currentChunkElements.length > 0) {
                        chunks.push(this.createChunkFromElements(currentChunkElements));
                    }
                }
            }
            
            this.logger.info(`Created ${chunks.length} chunks from ${elements.length} elements using smart chunking`);
            return chunks;
        } catch (error) {
            this.logger.error(`Error in smart chunking: ${error instanceof Error ? error.message : String(error)}`);
            return this.createSimpleChunksFromElements(elements, chunkSize, chunkOverlap);
        }
    }

    /**
     * Fallback method for creating chunks from elements when smart chunking fails
     */
    private createSimpleChunksFromElements(
        elements: DocumentElement[],
        chunkSize: number,
        chunkOverlap: number
    ): ElementChunk[] {
        this.logger.info(`Using simple chunking fallback for ${elements.length} elements`);
        
        const chunks: ElementChunk[] = [];
        let currentChunkElements: DocumentElement[] = [];
        let currentLength = 0;
        
        for (const element of elements) {
            if (currentLength + element.text.length > chunkSize && currentChunkElements.length > 0) {
                chunks.push(this.createChunkFromElements(currentChunkElements));
                
                if (chunkOverlap > 0) {
                    const overlapElements = this.getOverlapElements(currentChunkElements, chunkOverlap);
                    currentChunkElements = [...overlapElements];
                    currentLength = this.getTotalTextLength(currentChunkElements);
                } else {
                    currentChunkElements = [];
                    currentLength = 0;
                }
            }
            
            currentChunkElements.push(element);
            currentLength += element.text.length;
        }
        
        if (currentChunkElements.length > 0) {
            chunks.push(this.createChunkFromElements(currentChunkElements));
        }
        
        this.logger.info(`Created ${chunks.length} chunks from ${elements.length} elements using simple chunking fallback`);
        return chunks;
    }

    /**
     * Sort elements by their position on the page
     */
    private sortElementsByPosition(elements: DocumentElement[]): DocumentElement[] {
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
        return elements;
    }
    
    /**
     * Group elements into semantic sections based on element types
     */
    private groupElementsIntoSections(elements: DocumentElement[]): DocumentElement[][] {
        const sections: DocumentElement[][] = [];
        let currentSection: DocumentElement[] = [];
        
        const isNewSectionStart = (element: { type: string; text: string; }): boolean => {
            return ['Title', 'Header', 'SectionHeader', 'Heading'].includes(element.type) ||
                   (element.type === 'NarrativeText' && element.text.length < 50 && /^[A-Z0-9\s]+$/.test(element.text));
        };
        
        for (const element of elements) {
            if (isNewSectionStart(element) && currentSection.length > 0) {
                sections.push([...currentSection]);
                currentSection = [];
            }
            currentSection.push(element);
        }
        
        if (currentSection.length > 0) {
            sections.push(currentSection);
        }
        
        return sections;
    }
    
    /**
     * Get the total text length of all elements
     */
    private getTotalTextLength(elements: Array<{ text: string; }>): number {
        return elements.reduce((total, el) => total + el.text.length, 0);
    }
    
    /**
     * Create a chunk from a list of elements
     */
    private createChunkFromElements(elements: DocumentElement[]): ElementChunk {
        const text = elements.map(el => el.text).join('\n');
        const element_ids = elements.map(el => el.element_id);
        const element_types = [...new Set(elements.map(el => el.type))];
        
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
    private getOverlapElements(elements: DocumentElement[], overlapSize: number): DocumentElement[] {
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
} 