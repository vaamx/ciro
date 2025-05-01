import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import { shouldLogInitialization } from '../../../common/utils/logger-config';

@Injectable()
export class SemanticChunkingService {
    private readonly logger = winston.createLogger({ 
        level: process.env.LOG_LEVEL || 'info',
        transports: [new winston.transports.Console()]
     });

    constructor() {
        if (shouldLogInitialization('SemanticChunkingService')) {
            this.logger.info('SemanticChunkingService initialized');
        }
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

        const cleanedText = text.replace(/\s+/g, ' ').trim();
        
        if (cleanedText.length <= maxChunkSize) {
            return [cleanedText];
        }

        const sectionDelimiters = /(?:\n\s*#{1,6}\s+|\n\s*\d+\.\s+|\n\s*[-*]\s+|\n\n+)/g;
        const preliminarySections = cleanedText.split(sectionDelimiters);
        
        const chunks: string[] = [];
        let currentChunk = '';
        
        for (let i = 0; i < preliminarySections.length; i++) {
            const section = preliminarySections[i].trim();
            
            if (!section) continue;
            
            if (currentChunk.length + section.length <= targetChunkSize) {
                currentChunk += (currentChunk ? ' ' : '') + section;
            } 
            else if (section.length > maxChunkSize) {
                if (currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = currentChunk.length > overlap 
                        ? currentChunk.slice(-overlap) 
                        : currentChunk;
                }
                
                const sentences = this.splitIntoSentences(section);
                let sentenceChunk = '';
                
                for (const sentence of sentences) {
                    if (sentenceChunk.length + sentence.length <= targetChunkSize) {
                        sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
                    }
                    else if (sentence.length > maxChunkSize) {
                        if (sentenceChunk) {
                            chunks.push(sentenceChunk);
                        }
                        
                        let startPos = 0;
                        while (startPos < sentence.length) {
                            const endPos = Math.min(startPos + maxChunkSize, sentence.length);
                            chunks.push(sentence.slice(startPos, endPos));
                            startPos = endPos - overlap;
                            if (startPos < 0) startPos = 0;
                        }
                        
                        sentenceChunk = '';
                    }
                    else {
                        chunks.push(sentenceChunk);
                        sentenceChunk = sentence;
                    }
                }
                
                if (sentenceChunk) {
                    currentChunk = sentenceChunk;
                }
            }
            else {
                chunks.push(currentChunk);
                currentChunk = section;
            }
        }
        
        if (currentChunk) {
            chunks.push(currentChunk);
        }
        
        return chunks
            .filter(chunk => chunk.trim().length > 0)
            .map(chunk => chunk.trim());
    }

    /**
     * Splits text into sentences using common sentence delimiters
     */
    private splitIntoSentences(text: string): string[] {
        const sentencePattern = /(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!)\s+(?=[A-Z])/g;
        const sentences = text.split(sentencePattern).map(s => s.trim());
        return sentences.filter(s => s.length > 0);
    }
} 