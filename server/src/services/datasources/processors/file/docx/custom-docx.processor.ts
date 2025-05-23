import { Injectable } from '@nestjs/common';
import { BaseDocumentProcessor, ProcessingResult } from '../base-document.processor';
import { ConfigService } from '../../../../core/config.service';
import { QdrantCollectionService } from '../../../../vector/collection-manager.service';
import { QdrantIngestionService } from '../../../../vector/ingestion.service';
import { OpenAIService } from '../../../../ai/openai.service';
import { EmbeddingService } from '../../../../ai/embedding.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { createServiceLogger } from '../../../../../common/utils/logger-factory';
import { SocketService } from '../../../../util/socket.service';
import { DocumentChunkingService } from '../../../../rag/chunking/document-chunking.service';
import { DataSourceProcessingStatus } from '../../../../../types';

// Define local interfaces
interface DocumentChunk {
    id?: string;
    content: string;
    metadata: Record<string, any>;
}

@Injectable()
export class CustomDocxProcessorService extends BaseDocumentProcessor {
    protected readonly logger = createServiceLogger('CustomDocxProcessorService');

    constructor(
        protected readonly configService: ConfigService,
        protected readonly qdrantCollectionService: QdrantCollectionService,
        protected readonly qdrantIngestionService: QdrantIngestionService,
        protected readonly openAIService: OpenAIService,
        protected readonly embeddingService: EmbeddingService,
        protected readonly socketService: SocketService,
        private readonly documentChunkingService: DocumentChunkingService
    ) {
        super('CustomDocxProcessorService', socketService);
        this.logger.info('CustomDocxProcessorService initialized');
    }

    // ADD: Private helper for normalization
    private _normalizeCollectionName(id: string): string {
        // Simple normalization: prefix and replace invalid chars
        // Consistent with logic likely used elsewhere (e.g., CsvProcessor)
        const prefix = 'datasource_';
        const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
        return `${prefix}${safeId}`;
    }

    /**
     * Process a DOCX file
     * @param filePath Path to the DOCX file
     * @param dataSourceId ID of the data source
     * @param organizationId ID of the organization
     * @param userId ID of the user
     * @param metadata Additional metadata
     * @returns Processing result
     */
    async processFile(
        filePath: string,
        dataSourceId: number,
        organizationId: number,
        userId: string,
        metadata: Record<string, any> = {}
    ): Promise<ProcessingResult> {
        this.logger.info(`Processing DOCX file: ${path.basename(filePath)} for DS ${dataSourceId}, Org ${organizationId}`);
        
        try {
            super.validateFile(filePath);
            
            // --- Check DS Exists (Optional but recommended) ---
            // await this.dataSourceService.findByIdForUser(dataSourceId, userId, organizationId);
            // Add error handling if check fails

            // --- Status Update: PENDING ---
            await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.PENDING);

            // --- Extract Text using Mammoth ---
            this.logger.debug('Extracting text from DOCX...');
            await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, { step: 'extracting_text' });
            const extractionResult = await mammoth.extractRawText({ path: filePath });
            const text = extractionResult.value;
            const messages = extractionResult.messages; // Warnings/errors from Mammoth

            if (messages && messages.length > 0) {
                this.logger.warn('Mammoth extraction messages:', messages);
            }

            if (!text || text.trim().length === 0) {
                this.logger.warn('No text content extracted from DOCX file.');
                await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.COMPLETED, { records: 0, messages });
                return { status: 'success', message: 'DOCX file processed, but no text content found.', chunks: 0, metadata: { messages } };
            }
            this.logger.info(`Extracted ${text.length} characters from DOCX.`);

            // --- Chunk Text ---
            this.logger.info('Chunking text...');
            await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, { step: 'chunking' });
            const chunks = await this.documentChunkingService.createChunks(text);
            this.logger.info(`Generated ${chunks.length} chunks.`);

            if (chunks.length === 0) {
                this.logger.warn('Chunking resulted in zero chunks.');
                await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.COMPLETED, { records: 0, chunks: 0, messages });
                return { status: 'success', message: 'Text extracted but resulted in zero chunks.', chunks: 0, metadata: { messages } };
            }

            // --- Generate Embeddings ---
            this.logger.info('Generating embeddings...');
            await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, { step: 'embedding' });
            const embeddings = await this.openAIService.createEmbeddings(chunks);
            this.logger.info(`Generated ${embeddings.length} embeddings.`);
            if (embeddings.length !== chunks.length) {
                throw new Error(`Mismatch between chunk count (${chunks.length}) and embedding count (${embeddings.length})`);
            }

            // --- Prepare Qdrant Points ---
            const sourceName = path.basename(filePath);
            const pointsToUpsert = chunks.map((chunkText, index) => ({
                id: uuidv4(),
                vector: embeddings[index],
                payload: {
                    text: chunkText,
                    source: sourceName,
                    dataSourceId: dataSourceId,
                    processedAt: new Date().toISOString(),
                    // Add any other relevant metadata from the input 'metadata' object if needed
                    ...(metadata?.pageNumber && { page: metadata.pageNumber }), // Example if page info was passed
                },
            }));

            // --- Ensure Qdrant Collection ---
            const collectionName = this._normalizeCollectionName(dataSourceId.toString());
            this.logger.info(`Ensuring Qdrant collection "${collectionName}" exists...`);
            await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, { step: 'ensure_collection' });
            const collectionExists = await this.qdrantCollectionService.collectionExists(collectionName);
            if (!collectionExists) {
                this.logger.info(`Collection "${collectionName}" does not exist. Creating...`);
                // Fetch and parse embedding dimension safely
                const dimensionString = this.configService.get('openai.embeddingDimension'); // Get as string or undefined, removed <string>
                let embeddingDimension = parseInt(dimensionString || '1536', 10); // Changed to let, provide default string '1536' and parse
                if (isNaN(embeddingDimension)) {
                    this.logger.warn(`Invalid openai.embeddingDimension configured (${dimensionString}). Using default 1536.`);
                    embeddingDimension = 1536; // Ensure fallback if parseInt fails
                }
                
                const created = await this.qdrantCollectionService.createCollection(
                    collectionName,
                    { 
                        dimension: embeddingDimension,  // Add required dimension property
                        vectors: { 
                            size: embeddingDimension, 
                            distance: 'Cosine' 
                        } 
                    }
                );
                if (!created) throw new Error(`Failed to create Qdrant collection "${collectionName}"`);
                this.logger.info(`Collection "${collectionName}" created successfully.`);
            } else {
                this.logger.info(`Collection "${collectionName}" already exists.`);
            }

            // --- Upsert Data ---
            this.logger.info(`Upserting ${pointsToUpsert.length} points to collection "${collectionName}"...`);
            await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, { step: 'upserting' });
            await this.qdrantIngestionService.upsertVectors(collectionName, pointsToUpsert);
            this.logger.info(`Successfully upserted points.`);

            // --- Final Status Update ---
            const finalMetadata = {
                chunks: chunks.length,
                embeddings: embeddings.length,
                collectionName,
                records: chunks.length,
                mammothMessages: messages, // Include Mammoth messages in final metadata
            };
            await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.COMPLETED, finalMetadata);
            this.logger.info(`Successfully processed DOCX file ${sourceName} for DS ${dataSourceId}.`);

            return { status: 'success', chunks: chunks.length, metadata: finalMetadata };

        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error during DOCX processing';
            this.logger.error(`Error processing DOCX file ${path.basename(filePath)} for DS ${dataSourceId}: ${errorMessage}`, error.stack);
            // Attempt to update status to ERROR
            try {
                await this.updateStatus(
                    dataSourceId, 
                    organizationId, 
                    DataSourceProcessingStatus.ERROR, 
                    undefined, 
                    errorMessage
                );
            } catch (statusUpdateError: any) {
                this.logger.error(`Failed to update data source ${dataSourceId} status to ERROR after processing error: ${statusUpdateError.message}`);
            }
            return { status: 'error', message: errorMessage, chunks: 0, metadata: { error: errorMessage } };
        }
    }

    /**
     * Extract elements from a DOCX file
     * @param filePath Path to the DOCX file
     * @returns Array of extracted elements
     */
    private async extractElementsFromDocx(filePath: string): Promise<any[]> {
        this.logger.info(`Extracting elements from DOCX file: ${path.basename(filePath)}`);

        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File ${filePath} does not exist`);
            }

            const result = await mammoth.convertToHtml({ path: filePath });

            if (!result || !result.value) {
                this.logger.error(`Failed to extract HTML from DOCX: ${result.messages}`);
                try {
                    const rawResult = await mammoth.extractRawText({ path: filePath });
                    if (rawResult && rawResult.value) {
                        this.logger.warn('HTML extraction failed, using raw text as fallback.');
                        const paragraphs = rawResult.value.split(/\n\s*\n+/).map(p => p.trim()).filter(p => p);
                        return paragraphs.map((p, index) => ({ type: 'paragraph', text: p, metadata: { source: path.basename(filePath), paragraph: index + 1 } }));
                    }
                } catch (rawError: unknown) {
                     const errorMsg = rawError instanceof Error ? rawError.message : String(rawError);
                     this.logger.error(`Raw text fallback extraction failed: ${errorMsg}`);
                }
                return [];
            }

            const htmlContent = result.value;
            return this.parseHtmlContent(htmlContent, path.basename(filePath));

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Error during DOCX extraction: ${errorMessage}`, { stack: errorStack });
            throw error;
        }
    }

    /**
     * Parse HTML content (from DOCX) into structured elements
     * @param html HTML string
     * @param fileName Original file name for metadata
     * @returns Array of structured elements
     */
    private parseHtmlContent(html: string, fileName: string): any[] {
        const elements: any[] = [];
        const $ = cheerio.load(html);
        
        $('*').each((_: number, el: any) => {
            const $el = $(el);
            if ($el.text().trim() === '' && !$el.find('img').length) {
                $el.remove();
            }
        });
        
        $('h1, h2, h3, h4, h5, h6').each((index: number, element: any) => {
            const $element = $(element);
            const level = element.name.substring(1);
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
        
        this.logger.debug(`Parsed ${elements.length} elements from HTML.`);
        return elements;
    }

    /**
     * Create chunks from DOCX elements using ChunkingService
     * @param elements Extracted elements from DOCX
     * @param dataSourceId Data source ID
     * @param metadata Additional metadata (e.g., original file path)
     * @returns Array of document chunks
     */
    private async createChunks(elements: any[], dataSourceId: string, metadata: Record<string, any>): Promise<DocumentChunk[]> {
        this.logger.info(`Creating chunks for ${elements.length} elements using ChunkingService.`);
        const allChunks: DocumentChunk[] = [];
        const originalFileName = metadata?.filePath ? path.basename(metadata.filePath) : 'unknown.docx';

        for (const element of elements) {
            const elementText = element.text || '';
            if (!elementText.trim()) continue;

            try {
                const chunkOptions = {
                    sourceName: originalFileName,
                    elementType: element.type,
                    heading: element.metadata?.heading,
                    dataSourceId: dataSourceId,
                    ...element.metadata,
                };
                const chunksFromService: string[] = this.documentChunkingService.createChunks(elementText, chunkOptions);

                allChunks.push(...chunksFromService.map(c => ({
                    id: uuidv4(),
                    content: c,
                    metadata: { ...chunkOptions }
                })));
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error chunking element (type: ${element.type}, text length: ${elementText.length}): ${errorMessage}`);
            }
        }
        this.logger.info(`Generated ${allChunks.length} chunks from ${elements.length} elements.`);
        return allChunks;
    }

    /**
     * Generate embeddings and store vectors in Qdrant
     * @param chunks Array of DocumentChunk objects
     * @param dataSourceId Data source ID
     * @param collectionName Qdrant collection name
     * @param metadata Additional metadata (e.g., original file path)
     * @returns Object with counts of upserted vectors and failed embeddings
     */
    private async generateEmbeddingsAndStoreVectors(
        chunks: DocumentChunk[],
        dataSourceId: string,
        collectionName: string,
        metadata: Record<string, any>
    ): Promise<{ vectorsUpserted: number; failedEmbeddingCount: number }> {
        this.logger.info(`Generating embeddings for ${chunks.length} chunks and storing in collection ${collectionName}`);
        let vectorsUpserted = 0;
        let failedEmbeddingCount = 0;
        const batchSize = 50;
        const embeddingModel = this.configService.get('embedding.model', 'text-embedding-ada-002');
        const skipDbCheck = metadata?.skipDatabaseCheck ?? false;

        for (let i = 0; i < chunks.length; i += batchSize) {
            const batchChunks = chunks.slice(i, i + batchSize);
            this.logger.debug(`Processing batch ${i / batchSize + 1} of ${Math.ceil(chunks.length / batchSize)} (size: ${batchChunks.length})`);

            const textsToEmbed = batchChunks.map(chunk => chunk.content);
            let embeddings: number[][] = [];

            try {
                embeddings = await this.embeddingService.createEmbeddings(textsToEmbed, { skipCache: false });
                 if (embeddings.length !== batchChunks.length) {
                     this.logger.error(`Embedding count mismatch: Expected ${batchChunks.length}, got ${embeddings.length} for batch starting at index ${i}`);
                     failedEmbeddingCount += batchChunks.length;
                     continue;
                 }
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorStack = error instanceof Error ? error.stack : undefined;
                this.logger.error(`Failed to generate embeddings for batch starting at index ${i}: ${errorMessage}`, { stack: errorStack });
                failedEmbeddingCount += batchChunks.length;
                continue;
            }

            const points = batchChunks.map((chunk, index) => ({
                id: chunk.id || uuidv4(),
                vector: embeddings[index],
                payload: {
                    ...chunk.metadata,
                    text: chunk.content,
                    dataSourceId: dataSourceId,
                    originalFilePath: metadata?.filePath,
                    processedAt: new Date().toISOString(),
                    processor: this.processorName,
                }
            }));

            try {
                await this.qdrantIngestionService.upsertVectors(collectionName, points);
                vectorsUpserted += points.length;
                this.logger.debug(`Successfully upserted ${points.length} vectors for batch starting at index ${i}.`);
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorStack = error instanceof Error ? error.stack : undefined;
                this.logger.error(`Failed to upsert vectors for batch starting at index ${i}: ${errorMessage}`, { stack: errorStack });
            }
        }

        this.logger.info(`Finished embedding/storage. Vectors Upserted: ${vectorsUpserted}, Failed Embeddings: ${failedEmbeddingCount}`);
        return { vectorsUpserted, failedEmbeddingCount };
    }
} 