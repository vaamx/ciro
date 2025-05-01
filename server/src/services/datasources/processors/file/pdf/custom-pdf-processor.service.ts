// @ts-nocheck - TODO: This file needs major refactoring to work with the updated service architecture

import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BaseDocumentProcessor, ProcessingResult } from '../base-document.processor';
import { ConfigService } from '../../../../core/config.service';
import { DocumentChunkingService } from '../../../../rag/chunking/document-chunking.service';
import { QdrantSearchService } from '../../../../vector/search.service';
import { QdrantCollectionService } from '../../../../vector/collection-manager.service';
import { QdrantIngestionService } from '../../../../vector/ingestion.service';
import { DataSourceService } from '../../../management/datasource-management.service';
import { OpenAIService } from '../../../../ai/openai.service';
import { SocketService } from '../../../../util/socket.service';
import { createServiceLogger } from '../../../../../common/utils/logger-factory';
import { DataSourceProcessingStatus } from '../../../../../types';
import * as util from 'util';
import { v4 as uuidv4 } from 'uuid';
// Commented out problematic imports to allow the application to start
// These will need to be uncommented when the PDF functionality is needed
import * as pdfjs from 'pdfjs-dist';
import * as cheerio from 'cheerio';
import { PDFDocument } from 'pdf-lib';
import { SocketService as OldSocketService } from '../../../../util/socket.service';
import * as os from 'os';
import pdfParse from 'pdf-parse';
import { PDFExtract } from 'pdf.js-extract';
import { createWorker } from 'tesseract.js';
// Comment out the PDFPoppler import that was causing issues
// import { PDFPoppler } from 'pdf-poppler';
import { execSync } from 'child_process';
import * as crypto from 'crypto';

/**
 * Custom PDF Processor Service
 * Uses pdf.js-extract, pdf-parse, and OCR (Tesseract.js) to extract text from PDFs
 */
@Injectable()
export class CustomPdfProcessorService extends BaseDocumentProcessor {
    protected readonly logger = createServiceLogger('CustomPdfProcessorService');
    private documentChunkingService: DocumentChunkingService;
    private pdfExtract: PDFExtract;
    private openaiService: OpenAIService;
    private qdrantService: QdrantSearchService;
    
    // Batch size for embedding generation to avoid rate limits
    private readonly EMBEDDING_BATCH_SIZE = 20;

    constructor(
        dataSourceService: DataSourceService,
        socketService: SocketService,
        private readonly configService: ConfigService,
        documentChunkingService: DocumentChunkingService,
        qdrantService: QdrantSearchService,
        openaiService: OpenAIService,
    ) {
        super('CustomPdfProcessorService', dataSourceService, socketService);
        
        this.documentChunkingService = documentChunkingService;
        this.qdrantService = qdrantService;
        this.openaiService = openaiService;
        
        this.pdfExtract = new PDFExtract();
        this.logger.info('CustomPdfProcessorService initialized');
    }
    
    /**
     * Extract text from PDF using pdf-parse library
     */
    private async extractTextWithPdfParse(filePath: string): Promise<string> {
        this.logger.info(`Extracting text with pdf-parse from: ${filePath}`);
        
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            
            this.logger.info(`Successfully extracted ${data.text.length} characters with pdf-parse`);
            
            if (data.text.trim().length === 0) {
                this.logger.warn('Extracted text is empty or contains only whitespace');
                return '';
            }
            
            return data.text;
        } catch (error) {
            this.logger.error(`Error extracting text with pdf-parse: ${error instanceof Error ? error.message : String(error)}`);
            return '';
        }
    }

    /**
     * Extract structured content from PDF using pdf.js-extract
     */
    private async extractWithPdfJsExtract(filePath: string): Promise<any> {
        this.logger.info(`Extracting structured text with pdf.js-extract from: ${filePath}`);
        
        try {
            // Basic extraction options
            const options = {
                normalizeWhitespace: true,
                disableCombineTextItems: false
            };
            
            // Extended options that aren't in the TypeScript type definition
            const extendedOptions = {
                ...options,
                // These options might be supported but not in the type definitions
                includeStyle: true,
                markedContent: true,
                includePagesBookmarks: true,
                printingMode: 3
            };
            
            const result = await this.pdfExtract.extract(filePath, extendedOptions);
            
            if (!result || !result.pages || result.pages.length === 0) {
                this.logger.warn('No pages extracted from PDF');
                return null;
            }
            
            this.logger.info(`Extracted structured content from ${result.pages.length} pages`);
            
            // Check if we got any content
            const totalItems = result.pages.reduce((sum, page) => sum + (page.content?.length || 0), 0);
            this.logger.info(`Extracted a total of ${totalItems} content items`);
            
            if (totalItems === 0) {
                this.logger.warn('No content items found in the extracted pages, PDF might be image-based');
                return null;
            }
            
            this.logger.info(`Successfully extracted structured content with pdf.js-extract`);
            return result;
        } catch (error) {
            this.logger.error(`Error extracting with pdf.js-extract: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    
    /**
     * Convert structured PDF content from pdf.js-extract to elements
     */
    private convertToElements(extractedContent: any): Array<{
        element_id: string;
        type: string;
        text: string;
        metadata?: Record<string, any>;
    }> {
        this.logger.info(`Converting structured PDF content to elements`);
        
        if (!extractedContent || !extractedContent.pages || extractedContent.pages.length === 0) {
            this.logger.warn('No content to convert to elements');
            return [];
        }
        
        const elements: Array<{
            element_id: string;
            type: string;
            text: string;
            metadata?: Record<string, any>;
        }> = [];
        
        try {
            // Group text by paragraphs
            let currentParagraph = '';
            let currentPageNum = 0;
            let itemsProcessed = 0;
            
            const finalizeCurrentParagraph = () => {
                if (currentParagraph.trim().length > 0) {
                    elements.push({
                        element_id: crypto.randomUUID(),
                        type: 'Paragraph',
                        text: currentParagraph.trim(),
                        metadata: {
                            page_number: currentPageNum,
                            element_type: 'paragraph'
                        }
                    });
                    currentParagraph = '';
                }
            };
            
            // Process each page
            extractedContent.pages.forEach((page: any, pageIndex: number) => {
                currentPageNum = pageIndex + 1;
                
                if (!page.content || page.content.length === 0) {
                    this.logger.warn(`Page ${currentPageNum} has no content`);
                    return;
                }
                
                // Sort content by y position to process in reading order
                const sortedContent = [...page.content].sort((a, b) => {
                    // Compare y position first
                    if (Math.abs(a.y - b.y) > 5) {
                        return a.y - b.y;
                    }
                    // If y is similar, sort by x
                    return a.x - b.x;
                });
                
                let lastY = -1;
                let lastX = -1;
                
                // Process sorted content
                sortedContent.forEach((item: any) => {
                    if (!item.str || item.str.trim().length === 0) {
                        return;
                    }
                    
                    itemsProcessed++;
                    
                    // Check if this is a new line
                    const isNewLine = lastY >= 0 && Math.abs(item.y - lastY) > 5;
                    
                    // Check if this is a new paragraph (larger vertical gap)
                    const isNewParagraph = lastY >= 0 && Math.abs(item.y - lastY) > 15;
                    
                    // Check if this is a header (significantly larger font)
                    const isHeader = item.height && item.height > 12;
                    
                    if (isNewParagraph) {
                        finalizeCurrentParagraph();
                        
                        // If it's a header, add directly as a Title element
                        if (isHeader) {
                            elements.push({
                                element_id: crypto.randomUUID(),
                                type: 'Title',
                                text: item.str.trim(),
                                metadata: {
                                    page_number: currentPageNum,
                                    element_type: 'title',
                                    font_size: item.height
                                }
                            });
                        } else {
                            currentParagraph = item.str;
                        }
                    } else if (isNewLine) {
                        // Add space for new line within same paragraph
                        currentParagraph += ' ' + item.str;
                    } else {
                        // Continue on same line
                        // Add space only if needed between words
                        const needsSpace = lastX >= 0 && 
                                          (item.x - (lastX + sortedContent[itemsProcessed-2]?.width || 0)) > 2;
                        
                        if (needsSpace) {
                            currentParagraph += ' ' + item.str;
                        } else {
                            currentParagraph += item.str;
                        }
                    }
                    
                    lastY = item.y;
                    lastX = item.x;
                });
                
                // Finalize last paragraph from the page
                finalizeCurrentParagraph();
                
                // Add page break marker as a separate element
                if (pageIndex < extractedContent.pages.length - 1) {
                    elements.push({
                        element_id: crypto.randomUUID(),
                        type: 'PageBreak',
                        text: '[PAGE BREAK]',
                        metadata: {
                            page_number: currentPageNum,
                            element_type: 'page_break'
                        }
                    });
                }
            });
            
            this.logger.info(`Created ${elements.length} elements from extracted content`);
            
            // If we have very few elements compared to the number of pages,
            // the extraction might not have worked well
            const pagesCount = extractedContent.pages.length;
            if (elements.length < pagesCount * 2 && pagesCount > 1) {
                this.logger.warn(`Low element count (${elements.length}) for a ${pagesCount}-page document`);
            }
            
            return elements;
        } catch (error) {
            this.logger.error(`Error converting to elements: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
    }
    
    /**
     * Extract text using OCR from a PDF file that might be image-based
     */
    private async extractTextWithOcr(filePath: string): Promise<string> {
        this.logger.info(`Attempting OCR extraction for PDF file: ${filePath}`);
        
        try {
            // Ensure the file path is a string
            const safeFilePath = this.ensureString(filePath);
            
            // Generate images from the PDF pages
            this.logger.info(`Converting PDF to images for OCR processing`);
            
            // Create a temporary directory for the images
            const tempDir = path.join(os.tmpdir(), `pdf-ocr-${Date.now()}`);
            fs.mkdirSync(tempDir, { recursive: true });
            
            // Use poppler's pdftoppm to convert PDF to images
            // This is more reliable than pdf-poppler in many cases
            const outputPrefix = path.join(tempDir, 'page');
            try {
                execSync(`pdftoppm -png "${safeFilePath}" "${outputPrefix}"`);
            } catch (pdfError) {
                this.logger.warn(`pdftoppm failed: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`);
                
                // Comment out the pdf-poppler usage that was causing issues
                /*
                // Fallback to pdf-poppler if pdftoppm fails
                await PDFPoppler.convert(safeFilePath, {
                    format: 'png',
                    out_dir: tempDir,
                    out_prefix: 'page',
                });
                */
                
                // Instead, just log the error and return empty result
                this.logger.error('PDF conversion with pdftoppm failed and pdf-poppler fallback is disabled');
                return '';
            }
            
            // Find converted images
            const imageFiles = fs.readdirSync(tempDir)
                .filter(file => file.endsWith('.png'))
                .map(file => path.join(tempDir, file))
                .sort();
            
            this.logger.info(`Found ${imageFiles.length} images after conversion`);
            
            if (imageFiles.length === 0) {
                this.logger.error('No images were generated from the PDF, cannot perform OCR');
                return '';
            }
            
            // Process each image with OCR
            let fullText = '';
            
            for (let i = 0; i < imageFiles.length; i++) {
                this.logger.info(`Processing image ${i + 1}/${imageFiles.length} with OCR`);
                
                const worker = await createWorker();
                
                await worker.loadLanguage('eng');
                await worker.initialize('eng');
                
                try {
                    const workerAny = worker as any;
                    if (typeof workerAny.setParameters === 'function') {
                        await workerAny.setParameters({
                            tessedit_ocr_engine_mode: '3',
                            preserve_interword_spaces: '1'
                        });
                    }
                } catch (e) {
                    this.logger.warn('Could not set OCR parameters, using defaults');
                }
                
                // Perform OCR
                const result = await worker.recognize(imageFiles[i]);
                
                // Log page statistics
                const charCount = result.data.text.length;
                this.logger.info(`Page ${i + 1}: Extracted ${charCount} characters`);
                
                // Add page text
                fullText += result.data.text + '\n\n';
                
                // Terminate worker
                await worker.terminate();
            }
            
            // Clean up temp files
            try {
                for (const file of imageFiles) {
                    fs.unlinkSync(file);
                }
                fs.rmdirSync(tempDir, { recursive: true });
            } catch (cleanupError) {
                this.logger.warn(`Error cleaning up temp files: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
            }
            
            this.logger.info(`OCR completed, extracted ${fullText.length} characters`);
            
            return fullText;
        } catch (error) {
            this.logger.error(`Error in OCR extraction: ${error instanceof Error ? error.message : String(error)}`);
            return '';
        }
    }
    
    /**
     * Process a PDF file
     * Updated signature to match BaseDocumentProcessor
     */
    async processFile(
        filePath: string,
        dataSourceId: number,
        organizationId: number,
        userId: string,
        metadata: Record<string, any> = {}
    ): Promise<ProcessingResult> {
        this.logger.info(`Processing PDF file: ${filePath} for dataSourceId: ${dataSourceId}, orgId: ${organizationId}`);
        await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING);

        try {
            this.validateFile(filePath);

            // Attempt extraction with pdf.js-extract first
            let extractedContent = await this.extractWithPdfJsExtract(filePath);
            let elements: any[] = [];
            let rawText = '';

            if (extractedContent && extractedContent.pages?.length > 0) {
                this.logger.info('Using pdf.js-extract results for element conversion');
                elements = this.convertToElements(extractedContent);
                // Generate raw text from elements if needed, or re-extract
                rawText = elements.map(el => el.text).join('\n\n');
            } else {
                this.logger.warn('pdf.js-extract failed or produced no content, trying pdf-parse');
                rawText = await this.extractTextWithPdfParse(filePath);

                if (!rawText || rawText.trim().length === 0) {
                    this.logger.warn('pdf-parse also failed or produced empty text, trying OCR');
                    await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, { stage: 'ocr_extraction' });
                    rawText = await this.extractTextWithOcr(filePath);

                    if (!rawText || rawText.trim().length === 0) {
                        this.logger.error('All extraction methods failed (pdf.js-extract, pdf-parse, OCR)');
                        await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.ERROR, undefined, 'Failed to extract text from PDF');
                        return { status: 'error', message: 'Failed to extract text from PDF', chunks: 0 };
                    }
                    this.logger.info('Successfully extracted text using OCR');
                }
            }

            // If we don't have elements from pdf.js-extract or a fallback chunking method, handle error/completion
            if (elements.length === 0 && rawText.trim().length > 0) {
                 this.logger.warn('Text was extracted, but no elements were generated. Chunking raw text.');
                 // Use ChunkingService for raw text
                 const textChunks = await this.documentChunkingService.chunkText(rawText, { chunkSize: 1000, overlap: 100 }); // Example parameters
                 elements = textChunks.map((text, index) => ({
                     element_id: crypto.randomUUID(),
                     type: 'TextChunk',
                     text: text,
                     metadata: { chunk_index: index, page_number: 'N/A' } // Adjust metadata as needed
                 }));
                 this.logger.info(`Created ${elements.length} chunks from raw text.`);
            }

            if (elements.length === 0) {
                 this.logger.error('No elements or text chunks could be generated from the PDF.');
                 await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.ERROR, undefined, 'No content could be processed from PDF');
                 return { status: 'error', message: 'No content could be processed from PDF', chunks: 0 };
            }

            this.logger.info(`Proceeding with ${elements.length} elements/chunks.`);
            await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, { stage: 'embedding_ingestion' });

            // TODO: Refactor collection naming
            const collectionName = `datasource_${dataSourceId}`;

            // Process elements (chunking, embedding, ingestion)
            const processingResult = await this.processExtractedElements(
                elements,
                dataSourceId,
                organizationId,
                collectionName,
                metadata
            );

            // Final status update based on result
            if (processingResult.status === 'success' || processingResult.status === 'partial_success') {
                await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.COMPLETED, { chunks: processingResult.chunks });
            } else {
                await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.ERROR, { chunks: processingResult.chunks }, processingResult.message ?? 'Processing failed');
            }

            return processingResult;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error processing PDF file ${filePath}: ${errorMessage}`, { stack: error instanceof Error ? error.stack : undefined });
            await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.ERROR, undefined, errorMessage);
            return { status: 'error', message: errorMessage, chunks: 0 };
        }
    }
    
    /**
     * Process extracted elements (embedding, ingestion)
     * Updated signature to include organizationId
     */
    private async processExtractedElements(
        elements: any[],
        dataSourceId: number,
        organizationId: number,
        collectionName: string,
        metadata: Record<string, any>
    ): Promise<ProcessingResult> {
        this.logger.info(`Processing ${elements.length} extracted elements for collection: ${collectionName}`);

        try {
            // Prepare texts and metadata for embedding
            const texts = elements.map(el => this.ensureString(el.text));
            const elementMetadata = elements.map(el => ({
                ...(el.metadata || {}),
                element_id: el.element_id,
                type: el.type,
                data_source_id: dataSourceId,
                file_name: path.basename(metadata.filePath || 'unknown')
            }));

            // Generate embeddings in batches
            this.logger.info(`Generating embeddings for ${texts.length} elements...`);
            const embeddings = await this.createEmbeddingsInBatches(texts);
            this.logger.info(`Generated ${embeddings.length} embeddings.`);

            if (embeddings.length !== elementMetadata.length) {
                 throw new Error(`Mismatch between embeddings count (${embeddings.length}) and metadata count (${elementMetadata.length})`);
            }

            // Ingest into Qdrant
            this.logger.info(`Ingesting ${embeddings.length} vectors into collection: ${collectionName}`);
            await this.qdrantService.getClient().upsert(collectionName, {
                 wait: true,
                 points: embeddings.map((vector, index) => ({
                     id: elementMetadata[index].element_id || crypto.randomUUID(),
                     vector: vector,
                     payload: elementMetadata[index]
                 }))
             });

            this.logger.info(`Successfully processed and ingested ${elements.length} elements.`);
            return { status: 'success', chunks: elements.length, metadata: { collectionName } };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error processing extracted elements for collection ${collectionName}: ${errorMessage}`, { stack: error instanceof Error ? error.stack : undefined });
            return { status: 'error', message: `Failed to process elements: ${errorMessage}`, chunks: 0 };
        }
    }

    /**
     * Generate embeddings in batches
     */
    private async createEmbeddingsInBatches(texts: string[]): Promise<number[][]> {
        const allEmbeddings: number[][] = [];
        for (let i = 0; i < texts.length; i += this.EMBEDDING_BATCH_SIZE) {
            const batchTexts = texts.slice(i, i + this.EMBEDDING_BATCH_SIZE);
            try {
                const embeddings = await this.openaiService.createEmbeddings(batchTexts);
                if (embeddings && embeddings.length === batchTexts.length) {
                    allEmbeddings.push(...embeddings);
                } else {
                     this.logger.warn(`Embedding batch ${i / this.EMBEDDING_BATCH_SIZE + 1} returned unexpected result count.`);
                }
            } catch (error) {
                this.logger.error(`Error generating embeddings for batch starting at index ${i}: ${error}`);
                throw new Error(`Failed to generate embeddings: ${error}`);
            }
        }
        return allEmbeddings;
    }

    /**
     * Helper function to ensure a string is not null
     */
    private ensureString(value: string | null | undefined): string {
        return value || '';
    }

    /**
     * Normalize a collection name
     */
    private normalizeCollectionName(dataSourceId: string, filePath?: string | null): string {
        // Make sure dataSourceId is not null or undefined
        const safeDataSourceId = this.ensureString(dataSourceId);
        
        if (!safeDataSourceId && !filePath) {
            // Generate a random collection name if both are missing
            return `collection_${uuidv4().replace(/-/g, '_')}`;
        }
        
        // If dataSourceId is provided, use it
        if (safeDataSourceId) {
            // If it's a UUID, prefix it
            if (safeDataSourceId.includes('-')) {
                return `datasource_${safeDataSourceId.replace(/-/g, '_')}`;
            }
            
            // If it's numeric, prefix it
            if (!isNaN(Number(safeDataSourceId))) {
                return `datasource_${safeDataSourceId}`;
            }
        }
        
        // If we get here, use the file path as a fallback
        if (filePath) {
            return this.createCollectionNameFromFileName(this.ensureString(filePath));
        }
        
        // Final fallback
        return `collection_${Date.now()}`;
    }

    /**
     * Create a collection name from a file name
     */
    private createCollectionNameFromFileName(fileName: string): string {
        // Ensure fileName is not null or undefined
        const safeFileName = this.ensureString(fileName);
        
        // Extract just the base name without extension
        const baseName = path.basename(safeFileName, path.extname(safeFileName));
        
        // Clean the name and make it Qdrant-compatible
        return `file_${baseName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    }
}
