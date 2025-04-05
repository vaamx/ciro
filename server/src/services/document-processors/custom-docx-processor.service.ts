import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../services/core/config.service';
import { ChunkingService } from '../../services/rag/chunking.service';
import { OpenAIService } from '../../services/ai/openai.service';
import { createServiceLogger } from '../../utils/logger-factory';
import { BaseDocumentProcessor, ProcessingResult } from './base-document-processor';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';

// Add the MAX_TOKENS_PER_CHUNK constant at the top of the file
const MAX_TOKENS_PER_CHUNK = 4000; // Maximum tokens per chunk for OpenAI models

// Define the DocxProcessingOptions interface for better type checking
interface DocxProcessingOptions {
    isTestUpload?: boolean;
    skipDatabaseCheck?: boolean;
}

// Add the missing interface definitions at the top of the file
interface DocumentChunk {
    id?: string;
    content: string;
    metadata: Record<string, any>;
}

interface DocumentInfo {
    title?: string;
    author?: string;
    created?: string;
    modified?: string;
}

/**
 * Custom document processor for DOCX files
 * Extracts content from DOCX files and processes it for vector storage
 */
@Injectable()
export class CustomDocxProcessorService extends BaseDocumentProcessor {
    protected readonly logger = createServiceLogger('CustomDocxProcessorService');
    private readonly openAIService: OpenAIService;

    constructor(
        protected readonly configService: ConfigService,
        protected readonly chunkingService: ChunkingService
    ) {
        super('CustomDocxProcessorService');
        this.openAIService = OpenAIService.getInstance();
        this.logger.info('CustomDocxProcessorService initialized');
    }

    /**
     * Helper method to normalize collection names
     * @param dataSourceId The data source ID to normalize
     * @returns The normalized collection name
     */
    private normalizeCollectionName(dataSourceId: string): string {
        // If it's already prefixed, return as is
        if (dataSourceId.startsWith('datasource_')) {
            return dataSourceId;
        }
        
        // If it has data_source_ prefix, convert it
        if (dataSourceId.startsWith('data_source_')) {
            return `datasource_${dataSourceId.substring(12)}`;
        }
        
        // Otherwise add the prefix
        return `datasource_${dataSourceId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    }

    /**
     * Process a DOCX file
     * @param filePath Path to the DOCX file
     * @param dataSourceId ID of the data source
     * @param options Processing options
     * @returns Processing result
     */
    async processFile(
        filePath: string,
        dataSourceId: string,
        options: DocxProcessingOptions = {},
    ): Promise<ProcessingResult> {
        const { isTestUpload = false, skipDatabaseCheck = false } = options;
        this.logger.info(`Processing DOCX file: ${path.basename(filePath)} for data source ${dataSourceId}`);

        try {
            // Validate the file
            if (!fs.existsSync(filePath)) {
                this.logger.error(`File not found: ${filePath}`);
                return {
                    status: 'error',
                    message: `File not found: ${filePath}`,
                    chunks: 0,
                    metadata: { error: 'file_not_found' }
                };
            }

            // Normalize collection name
            const collectionName = this.normalizeCollectionName(dataSourceId);
            this.logger.info(`Using normalized collection name: ${collectionName}`);
            
            // Ensure the collection exists if not skipping database checks
            if (!skipDatabaseCheck) {
                try {
                    const collectionExists = await this.qdrantService.collectionExists(collectionName);
                    if (!collectionExists) {
                        await this.qdrantService.createCollection(collectionName, {
                            vectors: {
                                size: 1536,
                                distance: 'Cosine'
                            }
                        });
                        this.logger.info(`Created Qdrant collection: ${collectionName}`);
                    } else {
                        this.logger.info(`Collection already exists: ${collectionName}`);
                    }
                } catch (collectionError) {
                    this.logger.error(`Failed to ensure collection exists: ${collectionError instanceof Error ? collectionError.message : String(collectionError)}`);
                    return {
                        status: 'error',
                        message: `Failed to create or verify Qdrant collection: ${collectionError instanceof Error ? collectionError.message : String(collectionError)}`,
                        chunks: 0,
                        metadata: { error: 'collection_creation_failed' }
                    };
                }
            }
            
            // Check file size
            const stats = fs.statSync(filePath);
            if (stats.size === 0) {
                throw new Error(`File is empty: ${filePath}`);
            }

            const fileExt = path.extname(filePath).toLowerCase();
            if (fileExt !== '.docx') {
                throw new Error(`Invalid file extension: ${fileExt}. Expected .docx`);
            }

            // Update data source status to processing
            if (!isTestUpload && !skipDatabaseCheck) {
                await this.updateDataSourceStatus(dataSourceId, 'processing');
            }

            // Extract elements from the DOCX file
            this.logger.info('Extracting elements from DOCX file...');
            const elements = await this.extractElementsFromDocx(filePath);
            
            this.logger.info(`Extracted ${elements.length} elements from DOCX file`);

            // Process the extracted elements
            const result = await this.processExtractedElements(
                elements,
                dataSourceId,
                isTestUpload,
            );

            // Update data source status to completed
            if (!isTestUpload && !skipDatabaseCheck) {
                await this.updateDataSourceStatus(dataSourceId, 'completed');
            }

            return {
                status: 'success',
                message: 'DOCX file processed successfully',
                elements,
                chunks: result.chunks.length,
                metadata: {
                    elements: elements.length,
                    vectors: result.vectorsUpserted,
                },
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error processing DOCX file: ${errorMessage}`);
            
            // Update data source status to error
            if (!isTestUpload && !skipDatabaseCheck) {
                await this.updateDataSourceStatus(dataSourceId, 'error', { error: errorMessage });
            }
            
            return {
                status: 'error',
                message: errorMessage,
                chunks: 0,
                metadata: {
                    error: errorMessage
                }
            };
        }
    }

    /**
     * Extract elements from a DOCX file
     * @param filePath Path to the DOCX file
     * @returns Array of extracted elements
     */
    private async extractElementsFromDocx(filePath: string): Promise<any[]> {
        this.logger.info(`Extracting elements from DOCX file...`);
        
        try {
            // Read the file content
            if (!fs.existsSync(filePath)) {
                throw new Error(`File ${filePath} does not exist`);
            }
            
            // Convert DOCX to HTML using mammoth
        const result = await mammoth.convertToHtml({ path: filePath });
            
            if (!result || !result.value) {
                this.logger.error(`Failed to extract HTML from DOCX: ${result.messages}`);
                return [];
            }
            
            // Debug information
            this.logger.info(`Extracted HTML length: ${result.value.length} characters`);
            this.logger.info(`Mammoth messages: ${JSON.stringify(result.messages)}`);
            
            // If HTML is empty or too short, try with different options
            if (!result.value || result.value.length < 50) {
                this.logger.warn(`HTML content seems too short, trying with additional extraction`);
                
                try {
                    // Try alternative extraction approach
                    const buffer = fs.readFileSync(filePath);
                    const alternativeResult = await mammoth.extractRawText({ buffer });
                    
                    if (alternativeResult && alternativeResult.value && alternativeResult.value.length > 0) {
                        this.logger.info(`Extracted raw text: ${alternativeResult.value.length} characters`);
                        
                        // Create simple HTML from raw text
                        const htmlContent = `<html><body><p>${alternativeResult.value.replace(/\n/g, '</p><p>')}</p></body></html>`;
                        result.value = htmlContent;
                        
                        this.logger.info(`Created HTML from raw text: ${htmlContent.length} characters`);
                    }
                } catch (extractError: unknown) {
                    const errorMessage = extractError instanceof Error ? extractError.message : String(extractError);
                    this.logger.error(`Error in alternative extraction: ${errorMessage}`);
                }
            }
            
            const fileName = path.basename(filePath);
            
            // Parse the HTML content into structured elements
            const elements = this.parseHtmlContent(result.value, fileName);
            
            // Verify elements have content
            const elementsWithContent = elements.filter(el => el.text && el.text.trim().length > 0);
            
            this.logger.info(`Extracted ${elements.length} elements, ${elementsWithContent.length} with non-empty content`);
            
            // Log first element text for debugging (truncated)
            if (elementsWithContent.length > 0) {
                const firstElement = elementsWithContent[0];
                this.logger.info(`First element (first 100 chars): ${firstElement.text.substring(0, 100)}...`);
            } else {
                this.logger.warn(`No elements with content extracted!`);
            }
            
            return elementsWithContent;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Error extracting elements from DOCX: ${errorMessage}`);
            if (errorStack) {
                this.logger.error(errorStack);
            }
            throw error;
        }
    }

    /**
     * Parse HTML content into structured elements
     * @param html HTML content from DOCX
     * @param fileName Original file name for reference
     * @returns Array of structured elements
     */
    private parseHtmlContent(html: string, fileName: string): any[] {
        const elements: any[] = [];
        const $ = cheerio.load(html);
        
        // Remove empty elements and clean up whitespace
        $('*').each((_: number, el: any) => {
            const $el = $(el);
            if ($el.text().trim() === '' && !$el.find('img').length) {
                $el.remove();
            }
        });
        
        // Process headings
        $('h1, h2, h3, h4, h5, h6').each((index: number, element: any) => {
            const $element = $(element);
            const level = element.name.substring(1); // Extract heading level (1-6)
            const text = $element.text().trim();
            
            if (text) {
                elements.push({
                    id: uuidv4(),
                    type: `heading-${level}`,
                    text,
                    metadata: {
                        fileName,
                        index,
                        level,
                    },
                });
            }
        });
        
        // Process paragraphs
        $('p').each((index: number, element: any) => {
            const $element = $(element);
            const text = $element.text().trim();
            
            if (text) {
                elements.push({
                    id: uuidv4(),
                    type: 'paragraph',
                    text,
                    metadata: {
                        fileName,
                        index,
                    },
                });
            }
        });
        
        // Process lists
        $('ul, ol').each((listIndex: number, listElement: any) => {
            const $list = $(listElement);
            const listType = listElement.name === 'ul' ? 'unordered-list' : 'ordered-list';
            const items: string[] = [];
            
            $list.find('li').each((_: number, li: any) => {
                const text = $(li).text().trim();
                if (text) {
                    items.push(text);
                }
            });
            
            if (items.length > 0) {
                elements.push({
                    id: uuidv4(),
                    type: listType,
                    text: items.join('\n'),
                    metadata: {
                        fileName,
                        listIndex,
                        itemCount: items.length,
                        items,
                    },
                });
            }
        });
        
        // Process tables
        $('table').each((tableIndex: number, tableElement: any) => {
            const $table = $(tableElement);
            const rows: string[][] = [];
            
            $table.find('tr').each((rowIndex: number, rowElement: any) => {
                const $row = $(rowElement);
                const cells: string[] = [];
                
                $row.find('td, th').each((_: number, cell: any) => {
                    cells.push($(cell).text().trim());
                });
                
                if (cells.some(cell => cell !== '')) {
                    rows.push(cells);
                }
            });
            
            if (rows.length > 0) {
                // Format table as text
                const tableText = rows.map(row => row.join(' | ')).join('\n');
                
                elements.push({
                    id: uuidv4(),
                    type: 'table',
                    text: tableText,
                    metadata: {
                        fileName,
                        tableIndex,
                        rowCount: rows.length,
                        columnCount: rows[0]?.length || 0,
                        rows,
                    },
                });
            }
        });
        
        // Check for images
        $('img').each((imgIndex: number, imgElement: any) => {
            const $img = $(imgElement);
            const alt = $img.attr('alt') || 'Image';
            
            elements.push({
                id: uuidv4(),
                type: 'image',
                text: `[Image: ${alt}]`,
                metadata: {
                    fileName,
                    imgIndex,
                    alt,
                },
            });
        });
        
        // If no elements were extracted, add a fallback element with all text
        if (elements.length === 0) {
            const allText = $('body').text().trim();
            if (allText) {
                elements.push({
                    id: uuidv4(),
                    type: 'text',
                    text: allText,
                    metadata: {
                        fileName,
                    },
                });
            }
        }
        
        return elements;
    }

    /**
     * Process extracted elements
     * @param elements Array of elements extracted from DOCX
     * @param dataSourceId ID of the data source
     * @param isTestUpload Whether this is a test upload
     * @returns Processing result
     */
    private async processExtractedElements(
        elements: any[],
        dataSourceId: string,
        isTestUpload: boolean,
    ): Promise<any> {
        this.logger.info(`Processing ${elements.length} extracted elements from DOCX file`);
        
        try {
            // Generate a unique identifier for this file
            const fileId = uuidv4();
            
            // Format the collection name to be consistent: datasource_UUID
            // This ensures we're using the file UUID, not the numeric ID
            const collectionName = this.normalizeCollectionName(dataSourceId);
            
            // Create chunks from the extracted elements
            const chunks = await this.createChunks(elements, dataSourceId);
            this.logger.info(`Created ${chunks.length} chunks from extracted elements`);
            
            // Extract document info from elements
            const docInfo = this.extractDocumentInfo(elements);
            
            // Skip embedding generation for test uploads
            if (!isTestUpload) {
                // Process the chunks to generate embeddings and store vectors
                await this.generateEmbeddingsAndStoreVectors(chunks, dataSourceId, fileId, docInfo);
            } else {
                this.logger.info(`Skipping vector storage for test upload`);
            }
            
            // Return processed data
            return {
                chunks,
                vectorsUpserted: chunks.length
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error processing extracted elements: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Create chunks from elements
     * @param elements The elements to create chunks from
     * @param dataSourceId The data source ID
     * @returns Array of chunks
     */
    private async createChunks(elements: any[], dataSourceId: string): Promise<DocumentChunk[]> {
        // Log detailed information about elements
        this.logger.info(`Creating chunks from ${elements.length} elements`);
        
        if (elements.length === 0) {
            return [];
        }
        
        try {
            // Count total text length for stats
            const totalText = elements.reduce((acc, el) => acc + (el.text?.length || 0), 0);
            const estimatedTokens = this.estimateTokenCount(elements.map(el => el.text).join(' '));
            this.logger.info(`Total text length: ${totalText} chars, estimated tokens: ${estimatedTokens}`);
            
            // Check if we need to split into chunks
            if (estimatedTokens > MAX_TOKENS_PER_CHUNK) {
                this.logger.info(`Splitting large text (${estimatedTokens} estimated tokens) into chunks under ${MAX_TOKENS_PER_CHUNK} tokens`);
                
                // Combine all text from elements
                const combinedText = elements.map(el => el.text).join('\n\n');
                
                // Split into chunks
                const chunks = this.splitTextIntoChunks(combinedText, MAX_TOKENS_PER_CHUNK, {
                                    dataSourceId,
                    sourceType: 'docx'
                });
                
                this.logger.info(`Split text into ${chunks.length} smaller chunks, each under the token limit`);
                
                // Check chunks for token count issues
                for (const chunk of chunks) {
                    const tokenCount = this.estimateTokenCount(chunk.text);
                    if (tokenCount > MAX_TOKENS_PER_CHUNK) {
                        this.logger.warn(`Chunk has ${tokenCount} tokens, which exceeds the ${MAX_TOKENS_PER_CHUNK} limit. This may cause embedding issues.`);
                    }
                }
                
                // Convert to DocumentChunk format with content property
                return chunks.map(chunk => ({
                    content: chunk.text,
                                        metadata: {
                        ...chunk.metadata,
                        sourceType: 'docx',
                        dataSourceId
                    }
                }));
                        } else {
                // Small enough to be a single chunk
                this.logger.info(`Created 1 chunk from document elements, all under the token limit`);
                
                // Create a single chunk with all text
                return [{
                    content: elements.map(el => el.text).join('\n\n'),
                    metadata: {
                        sourceType: 'docx',
                        dataSourceId
                    }
                }];
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error creating chunks: ${errorMessage}`);
            throw error;
        } finally {
            this.logger.info(`Created ${elements.length > 1 ? 'multiple' : '1'} chunks from ${elements.length} elements`);
        }
    }

    /**
     * Estimate token count for a string
     * @param text The text to estimate tokens for
     * @returns Estimated token count
     */
    private estimateTokenCount(text: string): number {
        if (!text) {
            return 0;
        }
        
        try {
            // Quick naive approach: ~4 chars per token for English text
            // This is a rough estimate, but works well enough for chunking purposes
            const estimate = Math.ceil(text.length / 4);
            
            // Ensure we never return 0 for non-empty text
            return Math.max(1, estimate);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error estimating token count: ${errorMessage}`);
            return Math.ceil(text.length / 4); // Fallback to simple char count
        }
    }

    /**
     * Split a large text into smaller chunks that fit within token limits
     * @param text Text to split
     * @param maxTokens Maximum tokens per chunk
     * @param metadata Metadata to include with each chunk
     * @returns Array of chunks
     */
    private splitTextIntoChunks(text: string, maxTokens: number, metadata: any): any[] {
        this.logger.info(`Splitting large text (${this.estimateTokenCount(text)} estimated tokens) into chunks under ${maxTokens} tokens`);
        const chunks: any[] = [];
        
        // Calculate approximate chars per chunk based on token limit
        const CHARS_PER_TOKEN = 3.5;
        const charsPerChunk = Math.floor(maxTokens * CHARS_PER_TOKEN * 0.9); // 90% of limit for safety
        
        // Try to split on paragraph boundaries first
        const paragraphs = text.split(/\n\s*\n/);
        
        let currentChunk = '';
        let currentChunkTokens = 0;
        
        for (const paragraph of paragraphs) {
            const paragraphTokens = this.estimateTokenCount(paragraph);
            
            // If a single paragraph exceeds the limit, split it further by sentences
            if (paragraphTokens > maxTokens) {
                // If we have accumulated text, add it as a chunk first
                if (currentChunk) {
                    chunks.push({
                        id: uuidv4(),
                        text: currentChunk,
                        metadata: {
                            ...metadata,
                            chunkPart: chunks.length + 1,
                        },
                    });
                    currentChunk = '';
                    currentChunkTokens = 0;
                }
                
                // Split paragraph by sentences and process each
                const sentences = paragraph.split(/(?<=[.!?])\s+/);
                
                for (const sentence of sentences) {
                    const sentenceTokens = this.estimateTokenCount(sentence);
                    
                    // If a single sentence exceeds the limit, split it by character count
                    if (sentenceTokens > maxTokens) {
                        // Split by character count
                        for (let i = 0; i < sentence.length; i += charsPerChunk) {
                            const textPart = sentence.substring(i, i + charsPerChunk);
                            chunks.push({
                                id: uuidv4(),
                                text: textPart,
                                metadata: {
                                    ...metadata,
                                    chunkPart: chunks.length + 1,
                                    isPartial: true
                                },
                            });
                        }
                    } else if (currentChunkTokens + sentenceTokens > maxTokens) {
                        // If adding this sentence would exceed the limit, start a new chunk
                        chunks.push({
                            id: uuidv4(),
                            text: currentChunk,
                            metadata: {
                                ...metadata,
                                chunkPart: chunks.length + 1,
                            },
                        });
                        currentChunk = sentence;
                        currentChunkTokens = sentenceTokens;
                    } else {
                        // Add the sentence to the current chunk
                        currentChunk += (currentChunk ? ' ' : '') + sentence;
                        currentChunkTokens += sentenceTokens;
                    }
                }
            } else if (currentChunkTokens + paragraphTokens > maxTokens) {
                // If adding this paragraph would exceed the limit, start a new chunk
                chunks.push({
                    id: uuidv4(),
                    text: currentChunk,
                    metadata: {
                        ...metadata,
                        chunkPart: chunks.length + 1,
                    },
                });
                currentChunk = paragraph;
                currentChunkTokens = paragraphTokens;
            } else {
                // Add the paragraph to the current chunk
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
                currentChunkTokens += paragraphTokens;
            }
        }
        
        // Add the last chunk if there's anything left
        if (currentChunk) {
            chunks.push({
                id: uuidv4(),
                text: currentChunk,
                metadata: {
                    ...metadata,
                    chunkPart: chunks.length + 1,
                },
            });
        }
        
        this.logger.info(`Split text into ${chunks.length} smaller chunks, each under the token limit`);
        return chunks;
    }

    /**
     * Generate embeddings for text chunks and store them as vectors in the database
     */
    private async generateEmbeddingsAndStoreVectors(
        chunks: DocumentChunk[],
        dataSourceId: string,
        fileId: string,
        docInfo?: DocumentInfo
    ): Promise<void> {
        // Get the collection name
        const collectionName = this.normalizeCollectionName(dataSourceId);
        
        try {
            this.logger.info(`Generating embeddings for ${chunks.length} chunks from data source ${dataSourceId}, file ${fileId}`);
            
            if (!chunks || chunks.length === 0) {
                this.logger.warn(`No chunks to process for data source ${dataSourceId}`);
                return;
            }
            
            // Make a deep copy of chunks to avoid modifying the original
            const processableChunks = [...chunks];
            
            // Log token statistics to help diagnose issues
            let totalTokenCount = 0;
            let maxTokenCount = 0;
            let minTokenCount = Number.MAX_SAFE_INTEGER;
            let oversizedChunks = 0;
            
            processableChunks.forEach(chunk => {
                // Use type assertion to access possible legacy 'text' property
                const legacyChunk = chunk as any;
                
                // First ensure chunk has content - both as "content" and legacy "text" properties
                const chunkText = chunk.content || (legacyChunk.text ? legacyChunk.text : '') || '';
                
                // Store text in the standard property for consistent access
                if (!chunk.content && legacyChunk.text) {
                    chunk.content = legacyChunk.text;
                }
                
                // Now estimate tokens from the content
                const tokenCount = this.estimateTokenCount(chunkText);
                this.logger.debug(`Chunk token count: ${tokenCount} for content length: ${chunkText.length}`);
                
                totalTokenCount += tokenCount;
                maxTokenCount = Math.max(maxTokenCount, tokenCount);
                minTokenCount = Math.min(minTokenCount, tokenCount);
                
                if (tokenCount > MAX_TOKENS_PER_CHUNK) {
                    oversizedChunks++;
                }
            });
            
            const avgTokenCount = totalTokenCount / processableChunks.length;
            
            this.logger.info(`Token statistics for ${processableChunks.length} chunks:
                - Average: ${avgTokenCount.toFixed(2)} tokens per chunk
                - Min: ${minTokenCount} tokens
                - Max: ${maxTokenCount} tokens
                - Oversized chunks: ${oversizedChunks}
                - Total tokens: ${totalTokenCount}`);
            
            // Handle oversized chunks by splitting them if needed
            if (oversizedChunks > 0) {
                this.logger.info(`Splitting ${oversizedChunks} oversized chunks...`);
                const newChunks: DocumentChunk[] = [];
                
                for (const chunk of processableChunks) {
                    const tokenCount = this.estimateTokenCount(chunk.content);
                    
                    if (tokenCount > MAX_TOKENS_PER_CHUNK) {
                        this.logger.info(`Splitting chunk with ${tokenCount} tokens...`);
                        
                        // Split content into smaller chunks
                        const subChunks = this.splitTextIntoChunks(chunk.content, MAX_TOKENS_PER_CHUNK / 2, chunk.metadata);
                        this.logger.info(`Split into ${subChunks.length} sub-chunks`);
                        
                        // Convert to DocumentChunk format
                        const convertedSubChunks: DocumentChunk[] = subChunks.map(subChunk => ({
                            content: subChunk.text,
                            metadata: subChunk.metadata
                        }));
                        
                        newChunks.push(...convertedSubChunks);
                    } else {
                        newChunks.push(chunk);
                    }
                }
                
                this.logger.info(`After splitting, now processing ${newChunks.length} chunks (was ${processableChunks.length} before)`);
                processableChunks.length = 0; // Clear the array
                processableChunks.push(...newChunks);
            }
            
            this.logger.info(`Using collection name for vector storage: ${collectionName}`);
            
            // Make sure the collection exists
            if (!(await this.qdrantService.collectionExists(collectionName))) {
                this.logger.info(`Creating Qdrant collection: ${collectionName}`);
                try {
                    const collectionCreated = await this.qdrantService.createCollection(collectionName, {
                        vectors: {
                            size: 1536, // OpenAI embedding dimension
                            distance: 'Cosine'
                        }
                    });
                    
                    if (collectionCreated) {
                        this.logger.info(`Successfully created collection ${collectionName}`);
                    } else {
                        this.logger.warn(`Failed to create collection ${collectionName}, will attempt to use it anyway`);
                    }
                } catch (createError: unknown) {
                    const errorMessage = createError instanceof Error ? createError.message : String(createError);
                    this.logger.error(`Error creating collection: ${errorMessage}`);
                }
            }
            
            // Determine the best batch size based on average token count
            const dynamicBatchSize = Math.max(
                1, 
                Math.min(
                    20, // Maximum batch size
                    Math.floor(5000 / avgTokenCount) // Adjust batch size based on token count
                )
            );
            
            this.logger.info(`Using dynamic batch size of ${dynamicBatchSize} chunks per batch based on average token count`);
            
            // Process chunks in batches to avoid rate limits
            for (let i = 0; i < processableChunks.length; i += dynamicBatchSize) {
                const batch = processableChunks.slice(i, i + dynamicBatchSize);
                this.logger.info(`Processing batch ${Math.floor(i/dynamicBatchSize) + 1}/${Math.ceil(processableChunks.length/dynamicBatchSize)} (${batch.length} chunks)`);
                
                try {
                    // Get embeddings for this batch
                    // First, verify chunks have content
                    const batchWithContent = batch.filter(chunk => {
                        // Use type assertion to access possible legacy 'text' property
                        const legacyChunk = chunk as any;
                        
                        // Check content in both possible properties
                        const hasContent = 
                          (chunk.content && chunk.content.trim().length > 0) || 
                          (legacyChunk.text && legacyChunk.text.trim().length > 0);
                        
                        // If has content in text but not in content, copy it
                        if (!chunk.content && legacyChunk.text) {
                          chunk.content = legacyChunk.text;
                        }
                        
                        return hasContent;
                    });
                    
                    if (batchWithContent.length === 0) {
                        this.logger.warn('No chunks with content to process in this batch');
                        continue; // Skip to next batch
                    }
                    
                    this.logger.info(`Generating embeddings for ${batchWithContent.length} chunks with content`);
                    
                    // Log the first chunk content for debugging (truncated)
                    const sampleChunk = batchWithContent[0].content;
                    this.logger.info(`Sample chunk content (first 100 chars): ${sampleChunk.substring(0, 100)}...`);
                    this.logger.info(`Sample chunk length: ${sampleChunk.length} chars, estimated tokens: ${this.estimateTokenCount(sampleChunk)}`);
                    
                    const chunksContent = batchWithContent.map(chunk => chunk.content);
                    const embeddings = await Promise.all(
                        chunksContent.map(content => this.openAIService.createEmbeddings(content))
                    );
                    
                    // Each item in the embeddings array is an array of arrays, so we need to extract the first embedding from each
                    const flattenedEmbeddings = embeddings.map((e: number[][]) => e[0]);
                    
                    if (!flattenedEmbeddings || flattenedEmbeddings.length === 0) {
                        this.logger.error('OpenAI returned no embeddings');
                        continue; // Skip to next batch
                    }
                    
                    this.logger.info(`Generated ${flattenedEmbeddings.length} embeddings for batch`);
                    
                    if (flattenedEmbeddings.length !== batchWithContent.length) {
                        this.logger.warn(`Mismatch between chunks (${batchWithContent.length}) and embeddings (${flattenedEmbeddings.length})`);
                    }
                    
                    // Prepare points for Qdrant - only for chunks that got embeddings
                    const points = flattenedEmbeddings.map((embedding: number[], index: number) => {
                        const chunk = batchWithContent[index];
                        return {
                            id: uuidv4(), // Generate a unique ID for each vector
                            vector: embedding,
                            payload: {
                                text: chunk.content,
                                metadata: {
                                    ...chunk.metadata,
                                    dataSourceId, // Include both the numeric ID and file UUID 
                                    fileId,       // to help with collection mapping later
                                    docInfo
                                }
                            }
                        };
                    });
                    
                    if (points.length === 0) {
                        this.logger.warn('No points to store after embedding generation');
                        continue; // Skip to next batch
                    }
                    
                    this.logger.info(`Storing ${points.length} vectors in Qdrant collection: ${collectionName}`);
                    
                    // Upsert the vectors to Qdrant
                    const result = await this.qdrantService.upsertVectors(collectionName, points);
                    
                    this.logger.info(`Qdrant upsert result: ${JSON.stringify(result)}`);
                    
                    // Verify vectors were stored by doing a simple count check
                    try {
                        const collectionInfo = await this.qdrantService.getCollectionInfo(collectionName);
                        this.logger.info(`Collection ${collectionName} now has ${collectionInfo || 'unknown'} points`);
                        
                        if (!collectionInfo) {
                            this.logger.warn(`Collection info missing or points count unavailable for ${collectionName}`);
                        }
                    } catch (verifyError: unknown) {
                        const errorMessage = verifyError instanceof Error ? verifyError.message : String(verifyError);
                        this.logger.error(`Error verifying vector storage: ${errorMessage}`);
                    }
                } catch (batchError: unknown) {
                    const errorMessage = batchError instanceof Error ? batchError.message : String(batchError);
                    this.logger.error(`Error processing batch: ${errorMessage}`);
                    // Continue with next batch instead of failing completely
                }
            }
            
            this.logger.info(`Finished storing vectors for data source ${dataSourceId}, file ${fileId}`);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Error generating embeddings: ${errorMessage}`);
            if (errorStack) {
                this.logger.error(errorStack);
            }
            throw new Error(`Failed to generate embeddings: ${errorMessage}`);
        }
    }

    /**
     * Extract document information from the parsed elements
     * @param elements Array of parsed document elements
     * @returns DocumentInfo object
     */
    private extractDocumentInfo(elements: any[]): DocumentInfo {
        const docInfo: DocumentInfo = {};
        
        // Look for title in the first few elements
        for (let i = 0; i < Math.min(5, elements.length); i++) {
            const element = elements[i];
            if (element.type === 'heading' && element.level === 1) {
                docInfo.title = element.text;
                break;
            }
        }
        
        // Look for metadata in elements
        for (const element of elements) {
            if (element.metadata) {
                if (element.metadata.author && !docInfo.author) {
                    docInfo.author = element.metadata.author;
                }
                if (element.metadata.created && !docInfo.created) {
                    docInfo.created = element.metadata.created;
                }
                if (element.metadata.modified && !docInfo.modified) {
                    docInfo.modified = element.metadata.modified;
                }
            }
        }
        
        return docInfo;
    }
} 