import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import * as crypto from 'crypto';
import pdfParse from 'pdf-parse';
import { PDFExtract, PDFExtractOptions } from 'pdf.js-extract';
import { createWorker } from 'tesseract.js';
import { Injectable } from '@nestjs/common';
import { BaseDocumentProcessor, ProcessingResult, DataSourceStatus } from './base-document-processor';
import { ChunkingService } from '../chunking.service';
import { QdrantService } from '../qdrant.service';
import { ConfigService } from '../config.service';
import * as pdfjsLib from 'pdfjs-dist';
import * as Tesseract from 'tesseract.js';
import * as pdfPoppler from 'pdf-poppler';
import { createLogger } from '../../utils/logger';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../infrastructure/database';
import { WebSocketService } from '../websocket.service';

/**
 * Custom PDF Processor Service
 * Uses pdf.js-extract, pdf-parse, and OCR (Tesseract.js) to extract text from PDFs
 */
@Injectable()
export class CustomPdfProcessorService extends BaseDocumentProcessor {
    protected readonly logger = createLogger('CustomPdfProcessorService');
    private chunkingService: ChunkingService;
    private pdfExtract: PDFExtract;
    private openaiService: any; // Will be initialized in constructor if needed
    
    // Batch size for embedding generation to avoid rate limits
    private readonly EMBEDDING_BATCH_SIZE = 20;

    constructor(
        private configService: ConfigService,
        chunkingService: ChunkingService,
        protected qdrantService: QdrantService,
        private readonly websocketService?: WebSocketService
    ) {
        super('CustomPdfProcessorService');
        
        // Make sure we have a chunking service
        if (chunkingService) {
            this.chunkingService = chunkingService;
        } else {
            this.chunkingService = ChunkingService.getInstance();
        }
        
        // If qdrantService is not provided, create a new instance
        if (!this.qdrantService) {
            this.qdrantService = QdrantService.getInstance();
        }
        
        // If websocketService is not provided, create a new instance
        if (!this.websocketService) {
            this.websocketService = new WebSocketService();
        }
        
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
     * Extract text from PDF using OCR with Tesseract.js
     * This is a fallback method for image-based PDFs
     */
    private async extractTextWithOcr(filePath: string): Promise<string> {
        this.logger.info(`Extracting text from PDF using OCR: ${filePath}`);
        
        try {
            // Create temp directory for image conversion
            const tmpDir = path.join(__dirname, '../../../tmp/ocr', crypto.randomUUID());
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }
            
            // Convert PDF to images using poppler-utils (pdftoppm)
            const basename = path.basename(filePath, '.pdf');
            const outputPrefix = path.join(tmpDir, basename);
            
            this.logger.info(`Converting PDF to images in ${tmpDir}`);
            try {
                // Use pdftoppm from poppler-utils to convert PDF to images
                const cmd = `pdftoppm -jpeg -r 300 "${filePath}" "${outputPrefix}"`;
                execSync(cmd);
            } catch (error) {
                this.logger.error(`Error converting PDF to images: ${error instanceof Error ? error.message : String(error)}`);
                return '';
            }
            
            // Find converted images
            const imageFiles = fs.readdirSync(tmpDir)
                .filter(file => file.endsWith('.jpg'))
                .map(file => path.join(tmpDir, file))
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
                fs.rmdirSync(tmpDir, { recursive: true });
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
     * Main method implementing the interface from BaseDocumentProcessor
     */
    async processFile(
        filePath: string,
        dataSourceId: string,
        metadata: Record<string, any> = {}
    ): Promise<ProcessingResult> {
        const startTime = Date.now();
        this.logger.info(`Processing PDF file: ${path.basename(filePath)} for data source ${dataSourceId}`);

        // First check if we have a numeric data source ID in the file_to_data_source table
        let numericDataSourceId: string | null = null;
        
        try {
            // Check if dataSourceId is a UUID (contains hyphens)
            if (dataSourceId && dataSourceId.includes('-')) {
                try {
                    // Look up the numeric ID from the file_to_data_source table
                    const mapping = await db('file_to_data_source')
                        .where('file_id', dataSourceId)
                        .first();
                    
                    if (mapping && mapping.data_source_id) {
                        numericDataSourceId = mapping.data_source_id;
                        this.logger.info(`Found numeric data source ID ${numericDataSourceId} for file ID ${dataSourceId}`);
                    } else {
                        // Try to find the numeric ID in the data_sources table metadata
                        const dataSources = await db('data_sources')
                            .whereRaw("metadata->>'id' = ?", [dataSourceId])
                            .select('id');
                        
                        if (dataSources.length > 0) {
                            numericDataSourceId = dataSources[0].id.toString();
                            this.logger.info(`Found numeric data source ID ${numericDataSourceId} from metadata for file ID ${dataSourceId}`);
                            
                            // Store the mapping for future lookups
                            await db('file_to_data_source').insert({
                                file_id: dataSourceId,
                                data_source_id: numericDataSourceId,
                                created_at: new Date()
                            });
                        }
                    }
                } catch (error) {
                    this.logger.error(`Error finding numeric data source ID: ${error.message}`);
                }
            } else if (dataSourceId && !isNaN(Number(dataSourceId))) {
                // If it's already a numeric ID, use it directly
                numericDataSourceId = dataSourceId;
            }

            // Update data source status to 'processing'
            if (numericDataSourceId) {
                try {
                    await this.updateDataSourceStatus(numericDataSourceId, 'processing', {});
                } catch (error) {
                    this.logger.error(`Error updating data source status: ${error.message}`);
                }
            }
            
            // Validate that the file exists and is a valid PDF
            const pdfExists = fs.existsSync(filePath);
            if (!pdfExists) {
                this.logger.error(`PDF file does not exist at path: ${filePath}`);
                if (numericDataSourceId) {
                    await this.updateDataSourceStatus(numericDataSourceId, 'error', { error: 'File not found' });
                }
                return { 
                    status: 'error', 
                    message: 'File not found',
                    chunks: 0,
                    metadata: { error: 'file_not_found' }
                };
            }

            // Use the numeric data source ID for collection naming if available
            const collectionName = this.normalizeCollectionName(numericDataSourceId || dataSourceId);
            
            this.logger.info(`Using normalized collection name: ${collectionName}`);
            
            // Ensure the collection exists
            try {
                // First check if collection exists
                const exists = await this.qdrantService.collectionExists(collectionName);
                this.logger.info(`Collection ${collectionName} exists: ${exists}`);
                
                if (!exists) {
                    this.logger.info(`Creating collection ${collectionName} for vector storage`);
                    await this.qdrantService.createCollection(collectionName, {
                        vectors: {
                            size: 1536, // OpenAI embeddings are 1536-dimensional
                            distance: 'Cosine'
                        }
                    });
                    this.logger.info(`Collection ${collectionName} created for vector storage`);
                }
                
                this.logger.info(`Collection existence confirmed: ${collectionName}`);
            } catch (collectionError) {
                this.logger.error(`Failed to ensure collection exists: ${collectionError instanceof Error ? collectionError.message : String(collectionError)}`);
                await this.updateDataSourceStatus(numericDataSourceId, 'error', {
                    error: 'collection_creation_failed',
                    errorMessage: collectionError instanceof Error ? collectionError.message : String(collectionError)
                });
                return {
                    status: 'error',
                    message: `Failed to create or verify Qdrant collection: ${collectionError instanceof Error ? collectionError.message : String(collectionError)}`,
                    chunks: 0,
                    metadata: { error: 'collection_creation_failed' }
                };
            }
            
            // Initialize empty elements array
            let elements: Array<{
                element_id: string;
                type: string;
                text: string;
                metadata?: Record<string, any>;
            }> = [];
            
            // Extraction strategy
            this.logger.info(`Starting PDF extraction process`);
            try {
                // First try PDFJs extract
                this.logger.info(`Attempting PDF extraction with pdf.js extract`);
                const extractedContent = await this.extractWithPdfJsExtract(filePath);
                
                if (extractedContent && extractedContent.pages && extractedContent.pages.length > 0) {
                    this.logger.info(`PDF.js extraction successful, converting to elements format`);
                    elements = this.convertToElements(extractedContent);
                    this.logger.info(`Converted to ${elements.length} elements using pdf.js extract`);
                } else {
                    // If pdf.js fails, try pdf-parse
                    this.logger.info(`PDF.js extraction yielded no content, trying pdf-parse`);
                    const text = await this.extractTextWithPdfParse(filePath);
                    
                    if (text && text.length > 0) {
                        this.logger.info(`pdf-parse extraction successful, text length: ${text.length} chars`);
                        elements = [{
                            element_id: `pdf-parse-${uuidv4()}`,
                            type: 'paragraph',
                            text: text
                        }];
                        this.logger.info(`Created single element from pdf-parse text`);
                    } else {
                        // If both fail, try OCR as a last resort
                        this.logger.info(`pdf-parse returned no content, attempting OCR extraction`);
                        const ocrText = await this.extractTextWithOcr(filePath);
                        
                        if (ocrText && ocrText.length > 0) {
                            this.logger.info(`OCR extraction successful, text length: ${ocrText.length} chars`);
                            elements = [{
                                element_id: `ocr-${uuidv4()}`,
                                type: 'paragraph',
                                text: ocrText
                            }];
                            this.logger.info(`Created single element from OCR text`);
                        } else {
                            throw new Error('All extraction methods failed to produce text from the PDF');
                        }
                    }
                }
            } catch (extractionError) {
                this.logger.error(`All PDF extraction methods failed: ${extractionError instanceof Error ? extractionError.message : String(extractionError)}`);
                await this.updateDataSourceStatus(numericDataSourceId, 'error', {
                    error: 'extraction_failed',
                    errorMessage: extractionError instanceof Error ? extractionError.message : String(extractionError)
                });
                return {
                    status: 'error',
                    message: `Failed to extract text from PDF: ${extractionError instanceof Error ? extractionError.message : String(extractionError)}`,
                    chunks: 0,
                    metadata: { error: 'extraction_failed' }
                };
            }
            
            if (!elements || elements.length === 0) {
                this.logger.error(`No elements extracted from PDF file`);
                await this.updateDataSourceStatus(numericDataSourceId, 'error', {
                    error: 'no_content_extracted',
                    errorMessage: 'No content extracted from PDF file'
                });
                return {
                    status: 'error',
                    message: 'No content extracted from PDF file',
                    chunks: 0,
                    metadata: { error: 'no_content_extracted' }
                };
            }
            
            this.logger.info(`Successfully extracted ${elements.length} elements from PDF`);
            
            // Process the extracted elements
            return this.processExtractedElements(elements, numericDataSourceId, collectionName, metadata);
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.logger.error(`Error processing PDF file: ${error instanceof Error ? error.message : String(error)}`, {
                filePath,
                dataSourceId,
                error: error instanceof Error ? error.stack : String(error),
                processingTime: `${processingTime}ms`
            });
            
            await this.updateDataSourceStatus(numericDataSourceId, 'error', {
                error: 'processing_failed',
                errorMessage: error instanceof Error ? error.message : String(error),
                processingTime: `${processingTime}ms`
            });
            
            return {
                status: 'error',
                message: `PDF processing failed: ${error instanceof Error ? error.message : String(error)}`,
                chunks: 0,
                metadata: {
                    error: 'processing_failed',
                    processingTime: `${processingTime}ms`
                }
            };
        }
    }
    
    /**
     * Process extracted elements to create chunks and embeddings
     */
    private async processExtractedElements(
        elements: any[],
        dataSourceId: string,
        collectionName: string,
        metadata: Record<string, any>
    ): Promise<ProcessingResult> {
        const startTime = Date.now();
        try {
            this.logger.info(`Starting to process ${elements.length} extracted elements for collection ${collectionName}`);
            
            // Create chunks from elements
            if (!this.chunkingService) {
                this.logger.error('Chunking service not available');
                throw new Error('Chunking service not available');
            }
            
            // Default chunk settings
            const chunkSize = metadata.chunkSize || 1000;
            const chunkOverlap = metadata.chunkOverlap || 200;
            
            this.logger.info(`Creating chunks from ${elements.length} elements with size ${chunkSize} and overlap ${chunkOverlap}`);
            
            let chunks = [];
            try {
                this.logger.info(`Using smart chunking option for ${elements.length} elements`);
                chunks = this.chunkingService.createChunksFromElements(elements, {
                    chunkSize,
                    chunkOverlap,
                    smartChunking: true
                });
                this.logger.info(`Created ${chunks.length} chunks from ${elements.length} elements using smart chunking`);
            } catch (chunkingError) {
                this.logger.warn(`Smart chunking failed: ${chunkingError instanceof Error ? chunkingError.message : String(chunkingError)}`);
                this.logger.info('Falling back to regular chunking');
                
                chunks = this.chunkingService.createChunksFromElements(elements, {
                    chunkSize,
                    chunkOverlap
                });
            }
            
            if (!chunks || chunks.length === 0) {
                this.logger.error('Chunking process produced no chunks');
                await this.updateDataSourceStatus(dataSourceId, 'error', {
                    error: 'chunking_failed',
                    errorMessage: 'PDF processing failed: No chunks were generated from extracted elements'
                });
                return {
                    status: 'error',
                    message: 'PDF processing failed: No chunks were generated from extracted elements',
                    chunks: 0,
                    metadata: { error: 'chunking_failed' }
                };
            }
            
            this.logger.info(`Successfully created ${chunks.length} chunks from ${elements.length} elements`);
            
            // Verify Qdrant collection exists before proceeding
            try {
                const collectionExists = await this.qdrantService.collectionExists(collectionName);
                if (!collectionExists) {
                    this.logger.info(`Collection ${collectionName} does not exist, creating it now`);
                    await this.qdrantService.createCollection(collectionName, {
                        vectors: {
                            size: 1536, // OpenAI embeddings are 1536-dimensional
                            distance: 'Cosine'
                        }
                    });
                    this.logger.info(`Collection ${collectionName} created for vector storage`);
                }
                this.logger.info(`Verified Qdrant collection ${collectionName} exists`);
            } catch (collectionError) {
                this.logger.error(`Error verifying/creating Qdrant collection ${collectionName}: ${collectionError instanceof Error ? collectionError.message : String(collectionError)}`);
                await this.updateDataSourceStatus(dataSourceId, 'error', {
                    error: 'collection_verification_failed',
                    errorMessage: collectionError instanceof Error ? collectionError.message : String(collectionError)
                });
                return {
                    status: 'error',
                    message: `Failed to verify/create Qdrant collection: ${collectionError instanceof Error ? collectionError.message : String(collectionError)}`,
                    chunks: 0,
                    metadata: { error: 'collection_verification_failed' }
                };
            }
            
            // Generate embeddings for chunks in batches to avoid rate limits
            const embeddingBatchSize = metadata.embeddingBatchSize || this.EMBEDDING_BATCH_SIZE;
            let allEmbeddings: number[][] = [];
            const totalChunks = chunks.length;
            
            this.logger.info(`Generating embeddings for ${totalChunks} chunks in batches of ${embeddingBatchSize}`);
            
            // Process in batches to avoid rate limits
            for (let i = 0; i < totalChunks; i += embeddingBatchSize) {
                const batchEnd = Math.min(i + embeddingBatchSize, totalChunks);
                const batchChunks = chunks.slice(i, batchEnd);
                const batchNumber = Math.floor(i / embeddingBatchSize) + 1;
                const totalBatches = Math.ceil(totalChunks / embeddingBatchSize);
                
                this.logger.info(`Processing embedding batch ${batchNumber} of ${totalBatches}: chunks ${i+1} to ${batchEnd}`);
                
                try {
                    // Generate embeddings for this batch
                    const batchTexts = batchChunks.map(chunk => chunk.text);
                    
                    // Check for empty texts that might cause API errors
                    const validBatchTexts = batchTexts.map(text => text || 'Empty content');
                    
                    const batchEmbeddings = await this.createEmbeddings(validBatchTexts);
                    
                    if (!batchEmbeddings || batchEmbeddings.length !== batchChunks.length) {
                        this.logger.warn(`Expected ${batchChunks.length} embeddings but received ${batchEmbeddings ? batchEmbeddings.length : 0}`);
                    }
                    
                    allEmbeddings = [...allEmbeddings, ...batchEmbeddings];
                    this.logger.info(`Generated ${batchEmbeddings.length} embeddings for batch ${batchNumber}`);
                } catch (embeddingError) {
                    this.logger.error(`Error generating embeddings for batch ${batchNumber}: ${embeddingError instanceof Error ? embeddingError.message : String(embeddingError)}`);
                    // Continue with other batches rather than failing completely
                }
            }
            
            if (!allEmbeddings || allEmbeddings.length === 0) {
                this.logger.error('Failed to generate any embeddings');
                await this.updateDataSourceStatus(dataSourceId, 'error', {
                    error: 'embedding_generation_failed',
                    errorMessage: 'PDF processing failed: No embeddings were generated'
                });
                return {
                    status: 'error',
                    message: 'PDF processing failed: No embeddings were generated',
                    chunks: 0,
                    metadata: { error: 'embedding_generation_failed' }
                };
            }
            
            this.logger.info(`Successfully generated ${allEmbeddings.length} embeddings for ${chunks.length} chunks`);
            
            // Store vectors in Qdrant
            const vectorIds = chunks.map(() => uuidv4());
            
            console.log(`[DEBUG] Generated ${vectorIds.length} vector IDs. First three: ${vectorIds.slice(0, 3).join(', ')}`);
            
            // Only process chunks that have corresponding embeddings
            const validChunkCount = Math.min(chunks.length, allEmbeddings.length);
            if (validChunkCount < chunks.length) {
                this.logger.warn(`Only ${validChunkCount} of ${chunks.length} chunks have embeddings and will be stored`);
            }
            
            const pointsToUpload = [];
            for (let i = 0; i < validChunkCount; i++) {
                const point = {
                    id: vectorIds[i],
                    vector: allEmbeddings[i],
                    payload: {
                        text: chunks[i].text,
                        element_ids: chunks[i].element_ids,
                        element_types: chunks[i].element_types,
                        source_id: dataSourceId,
                        chunk_index: i,
                        metadata: {
                            ...chunks[i].metadata,
                            source_type: 'pdf',
                            filename: metadata.filename || '',
                            created_at: new Date().toISOString(),
                            processor: 'custom-pdf-processor'
                        }
                    }
                };
                pointsToUpload.push(point);
                
                if (i < 3) {
                    console.log(`[DEBUG] Point ${i} ID: ${point.id}, Vector length: ${point.vector.length}, Text preview: ${point.payload.text.substring(0, 50)}...`);
                }
            }
            
            this.logger.info(`Upserting ${pointsToUpload.length} vectors in Qdrant collection ${collectionName}`);
            console.log(`[DEBUG] Collection name for upsert: '${collectionName}'`);
            
            try {
                console.log(`[DEBUG] Starting Qdrant upsert operation...`);
                
                // Split vectors into smaller batches to avoid payload size limits
                const MAX_VECTORS_PER_BATCH = 50; // Adjust this value based on your data size
                console.log(`]: Splitting ${pointsToUpload.length} vectors into batches of ${MAX_VECTORS_PER_BATCH}`);
                
                for (let j = 0; j < pointsToUpload.length; j += MAX_VECTORS_PER_BATCH) {
                    const vectorBatch = pointsToUpload.slice(j, j + MAX_VECTORS_PER_BATCH);
                    console.log(`]: Upserting batch ${Math.floor(j/MAX_VECTORS_PER_BATCH) + 1}/${Math.ceil(pointsToUpload.length/MAX_VECTORS_PER_BATCH)} (${vectorBatch.length} vectors)`);
                    await this.qdrantService.upsertVectors(collectionName, vectorBatch);
                }
                
                console.log(`[DEBUG] Qdrant upsert operation completed successfully`);
                this.logger.info(`Successfully stored ${pointsToUpload.length} vectors in Qdrant collection ${collectionName}`);
            } catch (storageError) {
                console.error(`[DEBUG ERROR] Qdrant upsert failed:`, storageError);
                this.logger.error(`Error storing vectors in Qdrant: ${storageError instanceof Error ? storageError.message : String(storageError)}`);
                await this.updateDataSourceStatus(dataSourceId, 'error', {
                    error: 'vector_storage_failed',
                    errorMessage: storageError instanceof Error ? storageError.message : String(storageError),
                    chunksProcessed: validChunkCount,
                    vectorsStored: 0
                });
                return {
                    status: 'error',
                    message: `Failed to store vectors in Qdrant: ${storageError instanceof Error ? storageError.message : String(storageError)}`,
                    chunks: validChunkCount,
                    metadata: { 
                        error: 'vector_storage_failed',
                        chunksProcessed: validChunkCount,
                        vectorsStored: 0
                    }
                };
            }
            
            const processingTime = Date.now() - startTime;
            
            // Update the data source status if needed
            if (dataSourceId) {
                await this.updateDataSourceStatus(dataSourceId, 'connected', {
                    chunksProcessed: validChunkCount,
                    vectorsStored: pointsToUpload.length,
                    processingTime: `${processingTime}ms`
                });
            }
            
            return {
                status: 'success',
                message: `Successfully processed PDF with ${validChunkCount} chunks`,
                chunks: validChunkCount,
                metadata: {
                    elementsProcessed: elements.length,
                    chunksProcessed: validChunkCount,
                    vectorsStored: pointsToUpload.length,
                    collectionName,
                    processingTime: `${processingTime}ms`
                }
            };
        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.logger.error(`Error processing extracted elements: ${error instanceof Error ? error.message : String(error)}`);
            
            await this.updateDataSourceStatus(dataSourceId, 'error', {
                error: 'element_processing_failed',
                errorMessage: error instanceof Error ? error.message : String(error),
                processingTime: `${processingTime}ms`
            });
            
            return {
                status: 'error',
                message: `Failed to process extracted elements: ${error instanceof Error ? error.message : String(error)}`,
                chunks: 0,
                metadata: {
                    error: 'element_processing_failed',
                    processingTime: `${processingTime}ms`
                }
            };
        }
    }

    /**
     * Create embeddings for an array of texts
     */
    private async createEmbeddings(texts: string[]): Promise<number[][]> {
        // Create an instance of the OpenAI service
        const { OpenAIService } = require('../../services/openai.service');
        const openaiService = OpenAIService.getInstance();
        
        // Use the correct method name: createEmbeddings instead of generateEmbedding
        // Process all texts in a single batch using the built-in batching of createEmbeddings
        return await openaiService.createEmbeddings(texts);
    }

    /**
     * Helper method to normalize collection names
     * @param dataSourceId The data source ID to normalize
     * @returns The normalized collection name
     */
    private normalizeCollectionName(dataSourceId: string, filePath?: string): string {
        if (!dataSourceId) {
            // Generate a random name if no data source ID is provided
            if (filePath) {
                return `datasource_${this.createCollectionNameFromFileName(path.basename(filePath))}`;
            }
            return `datasource_${Date.now()}`;
        }

        // If it's a numeric ID and doesn't contain a hyphen, prefix it
        if (!isNaN(Number(dataSourceId)) && !dataSourceId.includes('-')) {
            return `datasource_${dataSourceId}`;
        }
        
        // If already has the prefix, return as is
        if (dataSourceId.startsWith('datasource_')) {
            return dataSourceId;
        }
        
        // If has data_source_ prefix, convert to datasource_
        if (dataSourceId.startsWith('data_source_')) {
            return dataSourceId.replace('data_source_', 'datasource_');
        }
        
        // Otherwise, add the prefix
        return `datasource_${dataSourceId}`;
    }
    
    /**
     * Create a collection name from a file name
     * This is a fallback for when no data source ID is provided
     */
    private createCollectionNameFromFileName(fileName: string): string {
        // Remove extension and convert to lowercase
        const baseName = path.basename(fileName, path.extname(fileName)).toLowerCase();
        // Replace non-alphanumeric characters with hyphens
        return `data_source_${baseName.replace(/[^a-z0-9]+/g, '-')}`;
    }

    /**
     * Update the status of a data source in the database
     * @param dataSourceId Data source ID
     * @param status New status
     * @param metadata Additional metrics to update
     */
    protected async updateDataSourceStatus(
        dataSourceId: string,
        status: DataSourceStatus,
        metadata: Record<string, any> = {}
    ): Promise<void> {
        this.logger.info(`Updating data source ${dataSourceId} status to ${status}`);
        
        try {
            // Check if the dataSourceId is a UUID (contains a hyphen) or a numeric ID
            let numericId = dataSourceId;
            let foundId = false;
            
            if (dataSourceId.includes('-')) {
                // Extract file name from the dataSourceId
                let fileUuid = dataSourceId;
                if (dataSourceId.startsWith('datasource_')) {
                    fileUuid = dataSourceId.substring('datasource_'.length);
                }
                
                this.logger.debug(`File UUID extracted: ${fileUuid}`);
                
                // First, try to find the data source directly from the file_to_data_source mapping table
                try {
                    const mapping = await db('file_to_data_source')
                        .where('file_id', fileUuid)
                        .first();
                    
                    if (mapping && mapping.data_source_id) {
                        numericId = mapping.data_source_id;
                        foundId = true;
                        this.logger.info(`Found numeric ID ${numericId} for UUID ${fileUuid} in mapping table`);
                    }
                } catch (mappingError) {
                    this.logger.debug(`Error querying file_to_data_source table: ${mappingError.message}`);
                }
                
                // If not found in mapping table, check if there's a direct match in data_sources metadata
                if (!foundId) {
                    try {
                        const dataSources = await db('data_sources')
                            .whereRaw("metadata->>'id' = ?", [fileUuid])
                            .select('id');
                        
                        if (dataSources.length > 0) {
                            numericId = dataSources[0].id.toString();
                            foundId = true;
                            this.logger.info(`Found numeric ID ${numericId} for UUID ${fileUuid} in metadata.id`);
                        }
                    } catch (metadataError) {
                        this.logger.debug(`Error querying data_sources metadata: ${metadataError.message}`);
                    }
                }
                
                // Only if we haven't found the ID yet, try the more aggressive searches
                if (!foundId) {
                    // First, try to find the data source by matching the name or description containing the UUID
                    try {
                        const result = await db.raw(
                            `SELECT id FROM data_sources WHERE 
                             name LIKE ? OR 
                             description LIKE ? OR
                             metadata::text LIKE ?
                             LIMIT 1`,
                            [`%${fileUuid}%`, `%${fileUuid}%`, `%${fileUuid}%`]
                        );
                        
                        if (result && result.rows && result.rows.length > 0) {
                            numericId = result.rows[0].id;
                            foundId = true;
                            this.logger.info(`Found data source with ID ${numericId} for file UUID ${fileUuid}`);
                        }
                    } catch (error) {
                        this.logger.debug(`Error finding data source by UUID in name/description: ${error.message}`);
                    }
                }
                
                if (!foundId) {
                    this.logger.warn(`No numeric ID found for UUID ${fileUuid} after multiple attempts - cannot update status`);
                    return; // Don't proceed with update if we can't reliably identify the data source
                }
            }
            
            // If we found an ID, update it
            if (foundId || !dataSourceId.includes('-')) {
                const processingMetadata = { status, timestamp: new Date().toISOString() };
                
                try {
                    // Main status update
                    const updateResult = await db('data_sources')
                        .where('id', numericId)
                        .update({
                            status: status,
                            updated_at: new Date(),
                            metadata: db.raw(`
                                jsonb_set(
                                COALESCE(metadata::jsonb, '{}'::jsonb),
                                '{processingStatus}',
                                ?::jsonb
                                )
                            `, [JSON.stringify(processingMetadata)])
                        });
                        
                    // Log the result of the update
                    if (updateResult) {
                        this.logger.info(`Successfully updated data source ${numericId} status to ${status}`);
                    } else {
                        this.logger.warn(`No rows updated for data source ${numericId}`);
                    }
                    
                    // Also update metrics
                    if (Object.keys(metadata).length > 0) {
                        await db('data_sources')
                            .where('id', numericId)
                            .update({
                                metrics: db.raw(`
                                    jsonb_set(
                                    COALESCE(metrics::jsonb, '{}'::jsonb),
                                    '{processing}',
                                    ?::jsonb
                                    )
                                `, [JSON.stringify(metadata)])
                            });
                    }
                } catch (updateError: any) {
                    this.logger.error(`Error updating data source ${numericId} status to ${status}: ${updateError.message}`);
                    throw updateError;
                }
            } else {
                this.logger.warn(`Unable to determine numeric ID for data source ${dataSourceId}, status update skipped`);
            }
        } catch (error: any) {
            this.logger.error(`UpdateDataSourceStatus error: ${error.message}`, error);
        }
    }
}
