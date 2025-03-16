import express from '../types/express-types';
import { Request, Response, NextFunction } from 'express-serve-static-core';

import { EnhancedExcelProcessorService as CustomExcelProcessorService } from '../services/document-processors/enhanced-excel-processor.service';
import multer from 'multer';
import path from 'path';
import { DocumentPipelineService } from '../services/document-pipeline.service';
import { DocumentProcessorFactory } from '../services/document-processors/document-processor-factory';
import fs from 'fs';
import { createServiceLogger } from '../utils/logger-factory';
import { config } from '../config/index';
import { getContentType } from '../utils/file-utils';
import { configService } from '../services/config.service';
import { OpenAIService } from '../services/openai.service';
import { ChunkingService } from '../services/chunking.service';
import { DataSourceService } from '../services/data-source.service';
import { DocumentProcessorService } from '../services/document-processor.service';
import { v4 as uuidv4 } from 'uuid';
import { FileType } from '../types/file-types';
import { QdrantService } from '../services/qdrant.service';
import { BaseDocumentProcessor } from '../services/document-processors/base-document-processor';
import { CsvProcessorService } from '../services/document-processors/csv-processor.service';
import { ConfigService } from '../services/config.service';
import { db } from '../infrastructure/database';
import { parse } from 'csv-parse/sync';
import { WebSocketService } from '../services/websocket.service';
import { getServiceRegistry } from '../services/service-registry';

const router = require('express').Router();
const logger = createServiceLogger('TestRoutes');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads');
    // Ensure the directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `test-${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Existing Excel test route
router.post('/test-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    logger.info(`Processing test file: ${req.file.originalname}`);
    logger.info(`File size: ${req.file.size} bytes, mimetype: ${req.file.mimetype}`);

    const filePath = req.file.path;
    // Use a numeric dataSourceId for testing or a default of 9999
    const dataSourceId = req.body.dataSourceId || '9999';
    
    // Get the correct content type based on file extension
    const contentType = getContentType(req.file.originalname);
    logger.info(`Using content type: ${contentType} for file ${req.file.originalname}`);
    
    try {
      // Use the Custom Excel processor 
      logger.info('Using Custom Excel processor');
      
      const chunkingService = ChunkingService.getInstance();
      const qdrantService = QdrantService.getInstance();
      const processor = new CustomExcelProcessorService(configService, chunkingService, qdrantService);
      const result = await processor.processFile(filePath, dataSourceId, { 
        isTestUpload: true,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: contentType,
        skipDatabaseCheck: true // Add a flag to potentially skip database checks
      });
      
      res.json({
        success: true,
        filePath,
        processorUsed: 'CustomExcelProcessorService',
        result
      });
    } catch (processingError) {
      logger.error('Error in Excel processing:', processingError);
      
      const errorMessage = processingError instanceof Error ? processingError.message : 
                          (processingError ? String(processingError) : 'Unknown error occurred');
      
      res.status(500).json({
        success: false,
        error: errorMessage,
        details: processingError instanceof Error ? {
          name: processingError.name,
          stack: process.env.NODE_ENV !== 'production' ? processingError.stack : undefined
        } : undefined
      });
    }
  } catch (error) {
    logger.error('Error in test-excel route:', error);
    
    // Improved error handling
    const errorMessage = error instanceof Error ? error.message : 
                         (error ? String(error) : 'Unknown error occurred');
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error instanceof Error ? {
        name: error.name,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      } : undefined
    });
  }
});

// Add a new route for testing the document processor architecture
router.post('/process-document', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    logger.info(`Processing document: ${req.file.originalname}`);
    logger.info(`File size: ${req.file.size} bytes, mimetype: ${req.file.mimetype}`);

    const filePath = req.file.path;
    // Use a numeric dataSourceId for testing or default to 9999
    const dataSourceId = req.body.dataSourceId || '9999';
    
    // Get file extension
    const fileExtension = path.extname(req.file.originalname).substring(1).toLowerCase();
    
    logger.info(`File extension: ${fileExtension}`);
    
    // Check if we have a processor for this file type
    const factory = new DocumentProcessorFactory();
    const processor = factory.getProcessor(fileExtension);
    
    if (!processor) {
      return res.status(400).json({ 
        error: `No processor available for file type: ${fileExtension}`,
        supportedTypes: Array.from(factory.getRegisteredTypes())
      });
    }
    
    logger.info(`Using processor: ${processor.constructor.name}`);
    
    // Check Unstructured API availability before processing
    if (fileExtension === 'pdf' || fileExtension === 'docx') {
      logger.info('Checking for PDF/DOCX processing capability');
      // Unstructured API is no longer available
      logger.warn('Unstructured API has been disabled. Document will be processed with mock data.');
    }
    
    // Process the file
    logger.info(`Starting document processing with ${processor.constructor.name}`);
    const result = await processor.processFile(filePath, dataSourceId, {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      isTestUpload: true,
      skipDatabaseCheck: true,
      includeRawElements: true
    });
    
    logger.info(`Document processing completed with status: ${result.status}`);
    if (result.status === 'error') {
      logger.error(`Processing error: ${result.message}`);
    }
    
    // Check if mock data was used
    if (result.metadata?.usedMockData) {
      logger.info(`Mock data was used for processing. Reason: ${result.metadata.mockReason}`);
    }
    
    // Get raw elements (skip since Unstructured API is no longer available)
    let rawElements = [];
    if (fileExtension === 'pdf' || fileExtension === 'docx') {
      logger.warn('Unstructured API is disabled. Cannot retrieve raw elements.');
    }
    
    // Log the elements and rawElements from the result
    if (result.elements) {
      logger.info(`Result contains ${result.elements.length} elements`);
    } else {
      logger.info('Result does not contain elements');
    }

    if (result.rawElements) {
      logger.info(`Result contains ${result.rawElements.length} raw elements`);
    } else {
      logger.info('Result does not contain raw elements');
    }
    
    // Return result with raw elements
    res.json({
      success: result.status === 'success',
      processorUsed: processor.constructor.name,
      fileInfo: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: fileExtension,
        filePath: filePath
      },
      result: {
        ...result,
        elements: result.elements || [],
        rawElements: result.rawElements || (rawElements.length > 0 ? rawElements : [])
      },
      elements: result.elements || [],
      rawElements: result.rawElements || (rawElements.length > 0 ? rawElements : [])
    });
  } catch (error) {
    logger.error('Error in process-document route:', error);
    
    // Improved error handling to avoid "Cannot read properties of undefined (reading 'error')"
    const errorMessage = error instanceof Error ? error.message : 
                       (error ? String(error) : 'Unknown error occurred');
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error instanceof Error ? {
        name: error.name,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      } : undefined
    });
  }
});

// Create embedding endpoint (no authentication for testing)
router.post('/create-embedding', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    logger.info(`Creating embedding for text: ${text.substring(0, 100)}...`);
    
    const openAIService = OpenAIService.getInstance();
    const embeddings = await openAIService.createEmbeddings([text]);
    
    if (!embeddings || embeddings.length === 0) {
      return res.status(500).json({ error: 'Failed to create embedding' });
    }
    
    const embedding = embeddings[0];
    logger.info(`Successfully created embedding with ${embedding.length} dimensions`);
    
    return res.json({
      success: true,
      embedding,
      dimensions: embedding.length
    });
  } catch (error) {
    logger.error('Error creating embedding:', error);
    return res.status(500).json({
      error: 'Failed to create embedding',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add a new route to provide information about document processing capabilities
router.get('/check-unstructured-api', async (req, res) => {
  try {
    logger.info('Document processing capabilities check requested');
    
    res.json({
      available: false,
      apiUrl: null,
      message: 'External document processing APIs have been removed. All document processing is now handled natively by the application.',
      capabilities: {
        pdf: 'native',
        docx: 'native',
        excel: 'native',
        csv: 'native'
      }
    });
  } catch (error) {
    logger.error('Error checking document processing capabilities:', error);
    res.status(500).json({
      error: true,
      message: 'Error checking document processing capabilities'
    });
  }
});

// Search chunks endpoint (no authentication for testing)
router.post('/search-chunks', async (req, res) => {
  try {
    const { embedding, dataSources, limit = 10, query = '' } = req.body;
    
    if (!embedding || !Array.isArray(embedding)) {
      return res.status(400).json({ error: 'Valid embedding array is required' });
    }
    
    if (!dataSources || !Array.isArray(dataSources) || dataSources.length === 0) {
      return res.status(400).json({ error: 'At least one data source ID is required' });
    }
    
    logger.info(`Searching for chunks in data sources: ${dataSources.join(', ')}`);
    
    const dataSourceService = DataSourceService.getInstance();
    const chunks = await dataSourceService.searchDocumentChunks(
      embedding,
      dataSources,
      limit,
      0.5 // Default threshold
    );
    
    logger.info(`Found ${chunks.length} chunks`);
    
    return res.json(chunks);
  } catch (error) {
    logger.error('Error searching chunks:', error);
    return res.status(500).json({
      error: 'Failed to search chunks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// New endpoint to inspect all chunks from a data source
router.get('/inspect-chunks/:dataSourceId', async (req, res) => {
  try {
    const { dataSourceId } = req.params;
    const { limit = 100, download = false } = req.query;
    
    if (!dataSourceId) {
      return res.status(400).json({ error: 'Data source ID is required' });
    }
    
    logger.info(`Inspecting chunks for data source: ${dataSourceId}`);
    
    // Create a collection name based on the data source ID
    const collectionName = `datasource_${dataSourceId}`;
    
    // Get the Qdrant service
    const qdrantService = QdrantService.getInstance();
    
    // Check if collection exists
    const collections = await qdrantService.listCollections();
    if (!collections.includes(collectionName)) {
      return res.status(404).json({ 
        error: 'Collection not found',
        message: `No collection found for data source ID: ${dataSourceId}`,
        availableCollections: collections
      });
    }
    
    // Get all points from the collection
    const points = await qdrantService.getAllPoints(collectionName, parseInt(limit as string) || 100);
    
    logger.info(`Retrieved ${points.length} chunks from collection ${collectionName}`);
    
    // Format the chunks for display
    const chunks = points.map(point => ({
      id: point.id,
      text: point.payload.text,
      metadata: {
        element_ids: point.payload.element_ids,
        element_types: point.payload.element_types,
        ...point.payload.metadata
      }
    }));
    
    // If download parameter is true, send as a downloadable file
    if (download === 'true') {
      // Create a text file with all chunks
      const chunksText = chunks.map((chunk, index) => 
        `--- CHUNK ${index + 1} ---\n` +
        `ID: ${chunk.id}\n` +
        `Element Types: ${chunk.metadata.element_types?.join(', ') || 'N/A'}\n` +
        `Text:\n${chunk.text}\n`
      ).join('\n' + '-'.repeat(80) + '\n\n');
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="chunks-${dataSourceId}.txt"`);
      
      return res.send(chunksText);
    }
    
    // Return JSON response
    return res.json({
      dataSourceId,
      collectionName,
      totalChunks: points.length,
      chunks
    });
  } catch (error) {
    logger.error('Error inspecting chunks:', error);
    return res.status(500).json({
      error: 'Failed to inspect chunks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Process document endpoint (no authentication for testing)
router.post('/process-document', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    
    logger.info(`Processing document: ${fileName} (${fileSize} bytes)`);
    
    // Create a temporary data source ID for processing
    const tempDataSourceId = uuidv4();
    
    // Determine file type based on extension
    const fileExtension = path.extname(fileName).toLowerCase();
    let fileType: FileType;
    
    if (fileExtension === '.pdf') {
      fileType = 'pdf';
    } else if (['.xlsx', '.xls'].includes(fileExtension)) {
      fileType = 'xlsx';
    } else if (['.docx', '.doc'].includes(fileExtension)) {
      fileType = 'docx';
    } else {
      return res.status(400).json({ 
        error: 'Unsupported file type',
        details: `File extension ${fileExtension} is not supported`
      });
    }
    
    const documentProcessor = DocumentProcessorService.getInstance();
    const metadata = {
      source: 'test-upload',
      processingType: 'test',
      userId: 'test-user'
    };
    
    await documentProcessor.processDocument(
      filePath,
      fileType,
      tempDataSourceId,
      metadata
    );
    
    logger.info(`Document processed successfully`);
    
    return res.json({
      success: true,
      result: {
        status: 'success',
        dataSourceId: tempDataSourceId,
        metadata: {
          fileName,
          fileSize,
          fileType
        }
      }
    });
  } catch (error) {
    logger.error('Error processing document:', error);
    return res.status(500).json({
      error: 'Failed to process document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add a new route to register custom processors for testing purposes
router.post('/register-processor', async (req, res) => {
  try {
    const { processorName, processorPath } = req.body;
    
    if (!processorName || !processorPath) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'Both processorName and processorPath are required'
      });
    }
    
    logger.info(`Attempting to register custom processor: ${processorName} from path: ${processorPath}`);
    
    try {
      // Dynamically import the processor module
      const processorModule = require(processorPath);
      
      // Check if the module has the requested processor
      if (!processorModule[processorName]) {
        return res.status(400).json({
          error: 'Processor not found',
          message: `Could not find ${processorName} in module at ${processorPath}`,
          availableExports: Object.keys(processorModule)
        });
      }
      
      // Create an instance of the processor
      const ProcessorClass = processorModule[processorName];
      const processor = new ProcessorClass();
      
      // Validate that it's a BaseDocumentProcessor
      if (!(processor instanceof BaseDocumentProcessor)) {
        return res.status(400).json({
          error: 'Invalid processor',
          message: `${processorName} is not an instance of BaseDocumentProcessor`
        });
      }
      
      // Get the processor factory
      const factory = new DocumentProcessorFactory();
      
      // Register the processor for PDF files (assuming it's a PDF processor)
      factory.registerProcessor(['pdf'], processor);
      
      logger.info(`Successfully registered ${processorName} for PDF files`);
      
      return res.json({
        success: true,
        message: `Successfully registered ${processorName} for PDF files`,
        processorName,
        processorTypes: ['pdf']
      });
    } catch (importError) {
      logger.error(`Error importing processor module: ${importError instanceof Error ? importError.message : String(importError)}`);
      return res.status(500).json({
        error: 'Failed to import processor',
        message: importError instanceof Error ? importError.message : String(importError)
      });
    }
  } catch (error) {
    logger.error('Error registering custom processor:', error);
    return res.status(500).json({
      error: 'Failed to register processor',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint for Qdrant operations
router.post('/test-qdrant', async (req, res) => {
  try {
    logger.info('Testing Qdrant operations');
    
    const qdrantService = QdrantService.getInstance();
    const openAIService = OpenAIService.getInstance();
    
    // Get the collection name from the request or use a default
    const collectionName = req.body.collection || 'test_collection';
    
    // Log the steps we're about to perform
    logger.info(`Testing Qdrant with collection: ${collectionName}`);
    
    // Step 1: Check if collection exists and create it if it doesn't
    let collectionExists = await qdrantService.collectionExists(collectionName);
    logger.info(`Collection ${collectionName} exists: ${collectionExists}`);
    
    if (!collectionExists) {
      logger.info(`Creating collection ${collectionName}`);
      await qdrantService.createCollection(collectionName, {
        vectors: {
          size: 1536,
          distance: 'Cosine'
        }
      });
      collectionExists = await qdrantService.collectionExists(collectionName);
      logger.info(`Collection ${collectionName} exists after creation: ${collectionExists}`);
    }
    
    // Step 2: Generate some test vectors
    logger.info('Generating test vectors');
    
    const testTexts = [
      'This is a test vector for Qdrant',
      'Another test vector with different content',
      'A third test vector with unique text'
    ];
    
    // Get embeddings for the test texts
    logger.info(`Getting embeddings for ${testTexts.length} test texts`);
    const embeddings = await openAIService.createEmbeddings(testTexts);
    logger.info(`Generated ${embeddings.length} embeddings`);
    
    // Step 3: Insert the vectors into Qdrant
    logger.info('Preparing vectors for Qdrant');
    const vectors = testTexts.map((text, index) => ({
      id: `test_${index}_${uuidv4()}`,
      vector: embeddings[index],
      payload: {
        text: text,
        metadata: {
          source: 'test-endpoint',
          index: index
        }
      }
    }));
    
    logger.info(`Upserting ${vectors.length} vectors into Qdrant`);
    await qdrantService.upsertVectors(collectionName, vectors);
    
    // Step 4: Search for vectors to verify they were inserted
    logger.info('Searching for vectors');
    const searchResults = await qdrantService.search(collectionName, embeddings[0], undefined, 10);
    logger.info(`Search returned ${searchResults.length} results`);
    
    // Return the results
    return res.json({
      success: true,
      steps: {
        collectionExists,
        embeddingsGenerated: embeddings.length,
        vectorsInserted: vectors.length,
        searchResults: searchResults
      }
    });
  } catch (error) {
    logger.error(`Error in test-qdrant endpoint: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

// Add a specific test endpoint for CSV processing
router.post('/test-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    logger.info(`Processing test CSV file: ${req.file.originalname}`);
    logger.info(`File size: ${req.file.size} bytes, mimetype: ${req.file.mimetype}`);

    // Validate that this is actually a CSV file
    if (!req.file.originalname.toLowerCase().endsWith('.csv')) {
      return res.status(400).json({ error: 'File must be a CSV file (.csv extension)' });
    }

    const filePath = req.file.path;
    // Use a test dataSourceId or get it from request
    const dataSourceId = req.body.dataSourceId || '9999';
    
    // Create services needed for CSV processing
    const configService = ConfigService.getInstance();
    const chunkingService = ChunkingService.getInstance();
    const qdrantService = QdrantService.getInstance();
    const openaiService = OpenAIService.getInstance();
    const websocketService = new WebSocketService();
    
    // Create CSV processor
    logger.info('Creating CsvProcessorService');
    const processor = new CsvProcessorService(configService, chunkingService, qdrantService, websocketService);
    
    // Set verbose logging for debugging
    logger.info('Starting CSV processing with verbose logging');
    
    // Process the file with detailed metadata and test flags
    const result = await processor.processFile(filePath, dataSourceId, { 
      isTestUpload: true,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: 'text/csv',
      skipDatabaseCheck: req.body.skipDatabaseCheck === 'true' || false,
      verbose: true
    });
    
    // Verify that data was stored in Qdrant
    const collectionName = `datasource_${dataSourceId}`;
    logger.info(`Checking if data was stored in Qdrant collection: ${collectionName}`);
    
    const collectionExists = await qdrantService.collectionExists(collectionName);
    logger.info(`Collection exists: ${collectionExists}`);
    
    let searchResults = [];
    if (collectionExists) {
      // Create a test embedding for search
      const testEmbedding = await openaiService.createEmbeddings(['test query for csv data']);
      
      // Search Qdrant to see if vectors were inserted
      searchResults = await qdrantService.search(collectionName, testEmbedding[0], undefined, 10);
      logger.info(`Search returned ${searchResults.length} results from Qdrant collection ${collectionName}`);
    }
    
    // Return detailed results for debugging
    res.json({
      success: result.status === 'success',
      processorUsed: 'CsvProcessorService',
      fileInfo: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        filePath: filePath
      },
      processingResult: result,
      qdrantVerification: {
        collectionName,
        collectionExists,
        recordsFound: searchResults.length,
        sampleResults: searchResults.slice(0, 3)
      }
    });
  } catch (error) {
    logger.error('Error in test-csv route:', error);
    
    // Improved error handling
    const errorMessage = error instanceof Error ? error.message : 
                         (error ? String(error) : 'Unknown error occurred');
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error instanceof Error ? {
        name: error.name,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      } : undefined
    });
  }
});

// Add a new endpoint to manually process a data source
router.post('/process-data-source', async (req: Request, res: Response) => {
  try {
    const { dataSourceId } = req.body;
    
    if (!dataSourceId) {
      return res.status(400).json({ error: 'Data source ID is required' });
    }
    
    logger.info(`Manual processing requested for data source: ${dataSourceId}`);
    
    // First, look up the data source in the database
    const dataSource = await db('data_sources')
      .where('id', dataSourceId)
      .first();
    
    if (!dataSource) {
      return res.status(404).json({ error: `Data source not found: ${dataSourceId}` });
    }
    
    logger.info(`Found data source: ${JSON.stringify(dataSource)}`);
    
    // Check if it's a CSV file
    if (dataSource.metadata?.fileType !== 'csv' && 
        dataSource.metadata?.processingMethod !== 'csv-processor') {
      return res.status(400).json({ 
        error: 'This endpoint only supports CSV files',
        fileType: dataSource.metadata?.fileType,
        processingMethod: dataSource.metadata?.processingMethod
      });
    }
    
    // Get the file path
    let filePath = dataSource.metadata?.filePath;
    
    // If no file path in metadata, check for the file in the uploads directory
    if (!filePath) {
      logger.warn(`No file path found in metadata for data source ${dataSourceId}`);
      
      const uploadDir = path.join(__dirname, '../../../uploads');
      const fileId = dataSource.metadata?.id;
      
      if (fileId) {
        // Try to find files that might contain the file ID
        const files = fs.readdirSync(uploadDir);
        const possibleFiles = files.filter(f => f.includes(fileId));
        
        if (possibleFiles.length > 0) {
          filePath = path.join(uploadDir, possibleFiles[0]);
          logger.info(`Found potential file for data source: ${filePath}`);
        } else {
          return res.status(404).json({ 
            error: 'No file path in metadata and no matching files found',
            fileId
          });
        }
      } else {
        return res.status(400).json({ 
          error: 'No file ID in metadata, cannot locate file',
          metadata: dataSource.metadata
        });
      }
    }
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        error: `File does not exist at path: ${filePath}`,
        metadata: dataSource.metadata
      });
    }
    
    logger.info(`Found file at path: ${filePath}`);
    
    // Create services needed for CSV processing
    const configService = ConfigService.getInstance();
    const chunkingService = ChunkingService.getInstance();
    const qdrantService = QdrantService.getInstance();
    const websocketService = new WebSocketService();
    
    // Create CSV processor
    logger.info('Creating CsvProcessorService');
    const processor = new CsvProcessorService(
      configService,
      chunkingService,
      qdrantService,
      websocketService
    );
    
    // Process the file with the data source ID
    logger.info(`Starting manual CSV processing for data source ${dataSourceId} with file ${filePath}`);
    
    const result = await processor.processFile(
      filePath,
      dataSourceId.toString(), // Ensure dataSourceId is a string
      { 
        ...dataSource.metadata,
        skipDatabaseCheck: false,  // Don't skip DB checks
        manualProcessing: true,    // Flag that this is manual processing
        verbose: true              // Enable verbose logging
      }
    );
    
    // Check if the collection exists in Qdrant
    const collectionName = `datasource_${dataSourceId}`;
    const collectionExists = await qdrantService.collectionExists(collectionName);
    logger.info(`Qdrant collection ${collectionName} exists: ${collectionExists}`);
    
    // If we have a collection, try to get a count of vectors
    let vectorCount = 0;
    if (collectionExists) {
      try {
        const points = await qdrantService.getAllPoints(collectionName, 1000);
        vectorCount = points.length;
        logger.info(`Collection ${collectionName} has ${vectorCount} vectors`);
      } catch (error) {
        logger.error(`Error getting points from collection: ${error}`);
      }
    }
    
    // Return detailed result
    res.json({
      success: result.status === 'success',
      dataSource: {
        id: dataSourceId,
        name: dataSource.name,
        type: dataSource.type
      },
      processingResult: result,
      qdrant: {
        collectionName,
        collectionExists,
        vectorCount
      }
    });
    
  } catch (error) {
    logger.error('Error in process-data-source route:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

// New debug endpoint for CSV processing
router.post('/process-csv', async (req: Request, res: Response) => {
  try {
    const { dataSourceId, filePath } = req.body;
    
    if (!dataSourceId) {
      return res.status(400).json({ error: 'Data source ID is required' });
    }
    
    logger.info(`Processing CSV for data source ID: ${dataSourceId}`);
    
    // Get data source info from the database
    const dataSource = await db('data_sources')
      .where('id', dataSourceId)
      .first();
    
    if (!dataSource) {
      return res.status(404).json({ error: `Data source with ID ${dataSourceId} not found` });
    }
    
    logger.info(`Found data source: ${JSON.stringify(dataSource, null, 2)}`);
    
    // Verify file path
    let resolvedFilePath = filePath;
    
    if (!resolvedFilePath) {
      // Try to get file path from metadata
      if (dataSource.metadata?.filePath) {
        resolvedFilePath = dataSource.metadata.filePath;
      } else if (dataSource.metadata?.filename) {
        // Try to construct the path
        const uploadsDir = path.join(process.cwd(), 'uploads');
        const possiblePaths = [
          path.join(uploadsDir, dataSource.metadata.filename),
          path.join(uploadsDir, dataSource.name)
        ];
        
        // Try each path
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            resolvedFilePath = p;
            logger.info(`Found file at: ${resolvedFilePath}`);
            break;
          }
        }
        
        // If still not found, try searching in the uploads directory
        if (!resolvedFilePath) {
          const files = fs.readdirSync(uploadsDir);
          logger.info(`Files in upload directory: ${files.join(', ')}`);
          
          // Look for any file with a name containing the base filename
          const baseFilename = path.basename(dataSource.metadata.filename, path.extname(dataSource.metadata.filename));
          const matchedFile = files.find(f => f.includes(baseFilename));
          
          if (matchedFile) {
            resolvedFilePath = path.join(uploadsDir, matchedFile);
            logger.info(`Found matching file: ${resolvedFilePath}`);
          }
        }
      }
    }
    
    if (!resolvedFilePath || !fs.existsSync(resolvedFilePath)) {
      return res.status(404).json({ error: 'Could not find the CSV file. Please provide a valid file path.' });
    }
    
    logger.info(`Using file path: ${resolvedFilePath}`);
    
    // Read the CSV file directly to verify its content
    try {
      const fileContent = fs.readFileSync(resolvedFilePath, 'utf-8');
      logger.info(`Successfully read file (${fileContent.length} bytes)`);
      
      // Try to parse a small sample to verify it's valid CSV
      const sampleLines = fileContent.split('\n').slice(0, 5).join('\n');
      logger.info(`Sample content (first 5 lines): ${sampleLines}`);
      
      const parsedSample = parse(sampleLines, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      
      logger.info(`Parsed sample: ${JSON.stringify(parsedSample, null, 2)}`);
      
      // Parse the full file
      const parsedRecords = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      
      logger.info(`Successfully parsed ${parsedRecords.length} records from CSV`);
      
      // Initialize services needed for processing
      const configService = ConfigService.getInstance();
      const chunkingService = ChunkingService.getInstance();
      const qdrantService = QdrantService.getInstance();
      const websocketService = new WebSocketService();
      
      // Create CSV processor
      logger.info('Creating CsvProcessorService');
      const processor = new CsvProcessorService(
        configService,
        chunkingService,
        qdrantService,
        websocketService
      );
      
      // Set verbose logging for debugging
      logger.info('Starting CSV processing with verbose logging');
      
      // Process the file
      const result = await processor.processFile(
        resolvedFilePath,
        dataSourceId.toString(),
        {
          // Add any additional metadata that might be helpful
          originalFilename: dataSource.metadata?.filename,
          skipDatabaseCheck: false
        }
      );
      
      logger.info(`Processing result: ${JSON.stringify(result, null, 2)}`);
      
      // Verify the result in Qdrant
      const collectionName = `datasource_${dataSourceId}`;
      const collectionExists = await qdrantService.collectionExists(collectionName);
      
      // Return the result with Qdrant verification
      return res.json({
        success: true,
        message: 'CSV processing completed',
        dataSource,
        filePath: resolvedFilePath,
        result,
        qdrant: {
          collectionName,
          collectionExists
        }
      });
    } catch (parseError) {
      logger.error(`Error reading/parsing file: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      return res.status(500).json({
        error: 'Failed to process CSV file',
        message: parseError instanceof Error ? parseError.message : String(parseError),
        dataSource,
        filePath: resolvedFilePath
      });
    }
  } catch (error) {
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Add a new endpoint for direct CSV processing
router.post('/process-csv-direct', async (req: Request, res: Response) => {
  try {
    const { dataSourceId } = req.body;
    
    if (!dataSourceId) {
      return res.status(400).json({ error: 'Data source ID is required' });
    }
    
    logger.info(`Direct CSV processing for data source ID: ${dataSourceId}`);
    
    // Get data source info from the database
    const dataSource = await db('data_sources')
      .where('id', dataSourceId)
      .first();
    
    if (!dataSource) {
      return res.status(404).json({ error: `Data source with ID ${dataSourceId} not found` });
    }
    
    // Find the file
    let filePath = null;
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    if (dataSource.metadata?.filePath && fs.existsSync(dataSource.metadata.filePath)) {
      filePath = dataSource.metadata.filePath;
    } else if (dataSource.metadata?.filename) {
      const possiblePath = path.join(uploadsDir, dataSource.metadata.filename);
      if (fs.existsSync(possiblePath)) {
        filePath = possiblePath;
      } else {
        // Search for files with similar names
        const files = fs.readdirSync(uploadsDir);
        const matchedFile = files.find(f => f.includes(path.basename(dataSource.metadata.filename, '.csv')));
        if (matchedFile) {
          filePath = path.join(uploadsDir, matchedFile);
        }
      }
    }
    
    if (!filePath) {
      return res.status(404).json({ error: 'Could not locate the CSV file' });
    }
    
    logger.info(`Found CSV file at: ${filePath}`);
    
    // Read and parse the CSV file
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      logger.info(`Read CSV file (${fileContent.length} bytes)`);
      
      // Parse the CSV
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      
      logger.info(`Parsed ${records.length} records from the CSV file`);
      
      if (records.length === 0) {
        return res.status(400).json({ error: 'CSV file contains no records' });
      }
      
      // Get collection name for Qdrant
      const collectionName = `datasource_${dataSourceId}`;
      
      // Create or check Qdrant collection
      const qdrantService = QdrantService.getInstance();
      let collectionExists = await qdrantService.collectionExists(collectionName);
      
      if (!collectionExists) {
        logger.info(`Creating Qdrant collection: ${collectionName}`);
        await qdrantService.createCollection(collectionName, {
          vectors: {
            size: 1536,
            distance: 'Cosine'
          }
        });
        collectionExists = await qdrantService.collectionExists(collectionName);
      }
      
      logger.info(`Qdrant collection exists: ${collectionExists}`);
      
      // Process records and generate embeddings
      const openaiService = OpenAIService.getInstance();
      const processedRecords = [];
      const batchSize = 50;
      let totalProcessed = 0;
      
      // Process in batches
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        logger.info(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(records.length/batchSize)}`);
        
        const chunks = batch.map((record, idx) => {
          // Format record as text
          let text = '';
          for (const [key, value] of Object.entries(record)) {
            text += `${key}: ${value !== null && value !== undefined ? value : 'N/A'}\n`;
          }
          
          return {
            id: `${dataSourceId}_record_${i + idx}`,
            text: text.trim(),
            metadata: {
              source: `csv_record_${i + idx}`,
              dataSourceId: dataSourceId
            }
          };
        });
        
        // Generate embeddings for all chunks
        const embeddingTexts = chunks.map(chunk => chunk.text);
        logger.info(`Generating embeddings for ${embeddingTexts.length} chunks`);
        
        try {
          const embeddings = await openaiService.createEmbeddings(embeddingTexts);
          logger.info(`Generated ${embeddings.length} embeddings`);
          
          // Prepare points for Qdrant
          const points = chunks.map((chunk, idx) => ({
            id: chunk.id,
            vector: embeddings[idx],
            payload: {
              text: chunk.text,
              metadata: chunk.metadata
            }
          }));
          
          // Upload to Qdrant
          await qdrantService.upsertVectors(collectionName, points);
          logger.info(`Uploaded ${points.length} vectors to Qdrant`);
          
          totalProcessed += points.length;
          processedRecords.push(...points);
          
          // Update progress
          const progress = Math.round((i + batch.length) / records.length * 100);
          logger.info(`Processing progress: ${progress}%`);
        } catch (embeddingError) {
          logger.error(`Error generating embeddings: ${embeddingError instanceof Error ? embeddingError.message : String(embeddingError)}`);
          // Continue with next batch
        }
      }
      
      // Update data source in database
      await db('data_sources')
        .where('id', dataSourceId)
        .update({
          metrics: db.raw(`jsonb_set(
            COALESCE(metrics::jsonb, '{}'::jsonb),
            '{records}',
            ?::jsonb
          )`, [records.length.toString()]),
          status: 'connected',
          last_sync: new Date()
        });
      
      // Update metadata too
      await db('data_sources')
        .where('id', dataSourceId)
        .update({
          metadata: db.raw(`jsonb_set(
            COALESCE(metadata::jsonb, '{}'::jsonb),
            '{records}',
            ?::jsonb
          )`, [records.length.toString()])
        });
      
      // Get updated data source
      const updatedDataSource = await db('data_sources')
        .where('id', dataSourceId)
        .first();
      
      // Return success result
      return res.json({
        success: true,
        message: `Successfully processed ${records.length} CSV records and stored ${totalProcessed} vectors in Qdrant`,
        recordCount: records.length,
        vectorsStored: totalProcessed,
        qdrant: {
          collectionName,
          collectionExists
        },
        dataSource: updatedDataSource
      });
    } catch (processError) {
      logger.error(`Error processing CSV: ${processError instanceof Error ? processError.message : String(processError)}`);
      return res.status(500).json({
        error: 'Failed to process CSV data',
        message: processError instanceof Error ? processError.message : String(processError)
      });
    }
  } catch (error) {
    logger.error(`Server error: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Add new endpoint for direct CSV processing using custom processor
router.post('/process-csv-custom', async (req: Request, res: Response) => {
  try {
    const { dataSourceId } = req.body;
    
    if (!dataSourceId) {
      return res.status(400).json({ error: 'Data source ID is required' });
    }
    
    logger.info(`Custom CSV processing for data source ID: ${dataSourceId}`);
    
    // Get data source info
    const dataSource = await db('data_sources')
      .where('id', dataSourceId)
      .first();
    
    if (!dataSource) {
      return res.status(404).json({ error: `Data source with ID ${dataSourceId} not found` });
    }
    
    // Find the file
    let filePath = null;
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    if (dataSource.metadata?.filePath && fs.existsSync(dataSource.metadata.filePath)) {
      filePath = dataSource.metadata.filePath;
    } else if (dataSource.metadata?.filename) {
      const possiblePath = path.join(uploadsDir, dataSource.metadata.filename);
      if (fs.existsSync(possiblePath)) {
        filePath = possiblePath;
      } else {
        // Search for files with similar names
        const files = fs.readdirSync(uploadsDir);
        logger.info(`Files in uploads directory: ${files.join(', ')}`);
        
        const matchedFile = files.find(f => f.includes(path.basename(dataSource.metadata.filename, '.csv')));
        if (matchedFile) {
          filePath = path.join(uploadsDir, matchedFile);
        }
      }
    }
    
    if (!filePath) {
      return res.status(404).json({ error: 'Could not locate the CSV file' });
    }
    
    logger.info(`Found CSV file at: ${filePath}`);
    
    // Initialize and use the custom processor
    const csvProcessor = new CsvProcessorService(
      configService,
      ChunkingService.getInstance(),
      QdrantService.getInstance(),
      new WebSocketService()
    );
    const result = await csvProcessor.processFile(filePath, dataSourceId.toString());
    
    // Get updated data source
    const updatedDataSource = await db('data_sources')
      .where('id', dataSourceId)
      .first();
    
    // Verify Qdrant collection status
    const qdrantService = QdrantService.getInstance();
    const collectionName = `datasource_${dataSourceId}`;
    const collectionExists = await qdrantService.collectionExists(collectionName);
    
    return res.json({
      success: result.status === 'success',
      message: result.message,
      chunks: result.chunks,
      recordCount: result.metadata?.recordCount || 0,
      chunkCount: result.chunks,
      status: result.status,
      error: result.status === 'error' ? result.message : null
    });
  } catch (error) {
    logger.error(`Error in custom CSV processing: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Process a data source directly using the CustomCsvProcessor
 */
router.post('/process-csv-source', async (req: Request, res: Response) => {
  try {
    const { dataSourceId } = req.body;
    
    if (!dataSourceId) {
      return res.status(400).json({ success: false, message: 'Missing dataSourceId parameter' });
    }
    
    logger.info(`Manual processing requested for data source ID: ${dataSourceId}`);
    
    // Get data source details from database
    const dataSource = await db('data_sources').where('id', dataSourceId).first();
    
    if (!dataSource) {
      return res.status(404).json({ success: false, message: `Data source with ID ${dataSourceId} not found` });
    }
    
    logger.info(`Found data source: ${dataSource.name} (${dataSource.type})`);
    
    // Validate that this is a CSV file
    if (!dataSource.metadata?.fileType || dataSource.metadata.fileType !== 'csv') {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid file type: ${dataSource.metadata?.fileType || 'unknown'}, expected csv` 
      });
    }
    
    // Find file path - first check metadata
    let filePath = '';
    if (dataSource.metadata?.filePath) {
      filePath = dataSource.metadata.filePath;
    } else {
      // Try to find the file in uploads directory
      const filename = dataSource.metadata?.filename;
      const uploadsDir = path.join(process.cwd(), 'uploads');
      
      // Search for the file recursively in uploads directory
      const findFile = (dir: string, filename: string): string | null => {
        if (!fs.existsSync(dir)) return null;
        
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            const found = findFile(fullPath, filename);
            if (found) return found;
          } else if (file === filename) {
            return fullPath;
          }
        }
        
        return null;
      };
      
      filePath = findFile(uploadsDir, filename) || '';
      
      if (!filePath) {
        return res.status(404).json({ success: false, message: `File not found: ${filename}` });
      }
    }
    
    logger.info(`Found file path: ${filePath}`);
    
    // Process the file with our custom processor
    const csvProcessor = new CsvProcessorService(
      configService,
      ChunkingService.getInstance(),
      QdrantService.getInstance(),
      new WebSocketService()
    );
    
    // Process the file
    const result = await csvProcessor.processFile(filePath, dataSourceId.toString());
    
    // Return the result
    return res.status(200).json({ 
      success: result.status === 'success', 
      message: result.message,
      recordCount: result.metadata?.recordCount || 0,
      chunksStored: result.chunks,
      dataSourceId,
      filePath
    });
    
  } catch (error) {
    logger.error(`Error processing CSV file: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to process CSV file',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Process a CSV file with the CustomCsvProcessor
 * Takes a dataSourceId and processes the associated file
 */
router.post('/custom-process-csv', async (req: Request, res: Response) => {
  try {
    const { dataSourceId } = req.body;
    
    if (!dataSourceId) {
      return res.status(400).json({ error: 'dataSourceId is required' });
    }
    
    logger.info(`Custom CSV processing requested for data source ID: ${dataSourceId}`);
    
    // Get the data source from the database
    const dataSource = await db('data_sources')
      .where('id', dataSourceId)
      .first();
    
    if (!dataSource) {
      return res.status(404).json({ error: `Data source with ID ${dataSourceId} not found` });
    }
    
    logger.info(`Found data source: ${JSON.stringify({
      id: dataSource.id,
      name: dataSource.name,
      type: dataSource.type,
      status: dataSource.status
    })}`);
    
    // Verify it's a CSV file
    if (!dataSource.metadata?.fileType || dataSource.metadata.fileType !== 'csv') {
      return res.status(400).json({ 
        error: 'Not a CSV file', 
        fileType: dataSource.metadata?.fileType || 'unknown'
      });
    }
    
    // Find the file path - check multiple possible locations
    let filePath: string | null = null;
    
    // Check for file path in metadata
    if (dataSource.metadata?.filePath) {
      filePath = dataSource.metadata.filePath;
      logger.info(`Using file path from metadata: ${filePath}`);
    } 
    // Check for file ID in metadata
    else if (dataSource.metadata?.id) {
      const fileId = dataSource.metadata.id;
      logger.info(`Looking for file with ID: ${fileId}`);
      
      // Search the uploads directory
      const uploadsDir = path.join(process.cwd(), 'uploads');
      
      // Recursive function to find a file by its ID in the filename
      const findFile = (dir: string, fileId: string, level = 0): string | null => {
        if (!fs.existsSync(dir) || level > 5) return null;
        
        try {
          const files = fs.readdirSync(dir);
          
          for (const file of files) {
            const fullPath = path.join(dir, file);
            
            try {
              const stat = fs.statSync(fullPath);
              
              if (stat.isDirectory()) {
                const found = findFile(fullPath, fileId, level + 1);
                if (found) return found;
              } 
              // Check if the filename contains the file ID
              else if (file.includes(fileId)) {
                logger.info(`Found matching file: ${fullPath}`);
                return fullPath;
              }
            } catch (error) {
              logger.error(`Error checking file ${fullPath}: ${error}`);
            }
          }
        } catch (error) {
          logger.error(`Error reading directory ${dir}: ${error}`);
        }
        
        return null;
      };
      
      filePath = findFile(uploadsDir, fileId);
    }
    
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({ 
        error: 'File not found',
        dataSource: dataSource.id,
        metadata: dataSource.metadata
      });
    }
    
    logger.info(`Processing CSV file at path: ${filePath}`);
    
    // Create and use the CsvProcessorService
    const customProcessor = new CsvProcessorService(
      configService,
      ChunkingService.getInstance(),
      QdrantService.getInstance(),
      new WebSocketService()
    );
    const result = await customProcessor.processFile(filePath, dataSourceId.toString());
    
    logger.info(`Processing result: ${JSON.stringify(result)}`);
    
    // Verify Qdrant collection
    const qdrantService = QdrantService.getInstance();
    const collectionName = `datasource_${dataSourceId}`;
    const collectionExists = await qdrantService.collectionExists(collectionName);
    
    return res.json({
      success: result.status === 'success',
      message: result.message,
      chunks: result.chunks,
      recordCount: result.metadata?.recordCount || 0,
      chunkCount: result.chunks,
      status: result.status,
      error: result.status === 'error' ? result.message : null
    });
  } catch (error) {
    logger.error(`Error in custom CSV processing: ${error}`);
    return res.status(500).json({
      error: 'Error processing CSV file',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Add a diagnostic route for checking Qdrant collections and snowflake data
router.get('/diagnostics/qdrant', async (req, res) => {
  try {
    const logger = createServiceLogger('QdrantDiagnostics');
    logger.info('Running Qdrant diagnostics');
    
    const qdrantService = QdrantService.getInstance();
    
    // Get all collections
    const collections = await qdrantService.listCollections();
    logger.info(`Found ${collections.length} collections:`);
    
    // Find Snowflake collections
    const snowflakeCollections = collections.filter(name => 
      name.includes('snowflake') || name.includes('diana'));
    
    if (snowflakeCollections.length === 0) {
      return res.json({ 
        success: false, 
        message: 'No Snowflake collections found',
        collections
      });
    }
    
    logger.info(`Found ${snowflakeCollections.length} Snowflake collections: ${snowflakeCollections.join(', ')}`);
    
    // Get information about each collection
    const collectionsInfo = await Promise.all(
      snowflakeCollections.map(async (name) => {
        try {
          const info = await qdrantService.getCollectionInfo(name);
          const pointCount = info.vectors_count || info.points_count || 0;
          
          // Get a sample of points if available
          let samplePoints = [];
          if (pointCount > 0) {
            samplePoints = await qdrantService.getRandomPoints(name, 2);
          }
          
          return {
            name,
            info,
            pointCount,
            samplePoints
          };
        } catch (err) {
          logger.error(`Error getting info for collection ${name}: ${err}`);
          return {
            name,
            error: err instanceof Error ? err.message : String(err)
          };
        }
      })
    );
    
    // Test search
    let searchResults = [];
    if (snowflakeCollections.length > 0) {
      const openaiService = OpenAIService.getInstance();
      
      // Generate embeddings for test query
      const testQuery = "How many products are there?";
      const embeddings = await openaiService.createEmbeddings([testQuery]);
      
      if (embeddings && embeddings.length > 0) {
        // Test search with lower threshold
        searchResults = await qdrantService.search(
          snowflakeCollections[0],
          embeddings[0],
          undefined,
          20
        );
        
        logger.info(`Test search found ${searchResults.length} results`);
      }
    }
    
    return res.json({
      success: true,
      collections,
      snowflakeCollections,
      collectionsInfo,
      searchResults
    });
  } catch (error) {
    const logger = createServiceLogger('QdrantDiagnostics');
    logger.error(`Error in Qdrant diagnostics: ${error}`);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Add a specific route to search for product information
router.get('/products-search', async (req, res) => {
  try {
    const logger = createServiceLogger('ProductsSearch');
    logger.info('Running Snowflake products search');
    
    const qdrantService = QdrantService.getInstance();
    const openaiService = OpenAIService.getInstance();
    
    // Get all collections
    const collections = await qdrantService.listCollections();
    
    // Find Snowflake collections
    const snowflakeCollections = collections.filter(name => 
      name.includes('snowflake') || name.includes('diana'));
    
    if (snowflakeCollections.length === 0) {
      return res.json({ 
        success: false, 
        message: 'No Snowflake collections found',
        collections
      });
    }
    
    // Create product-specific query embeddings
    const queries = [
      "product table", 
      "products", 
      "PRODUCT_ID", 
      "unique products",
      "product count",
      "PRODUCTS table",
      "DIANA_SALES_ES PRODUCTS"
    ];
    
    // Results for all queries
    const allResults = [];
    
    // Process each query
    for (const query of queries) {
      try {
        // Generate embeddings for the query
        const embeddings = await openaiService.createEmbeddings([query]);
        
        if (!embeddings || embeddings.length === 0) {
          logger.error(`Failed to create embeddings for query: ${query}`);
          continue;
        }
        
        // Search with very low threshold
        const searchResults = await qdrantService.search(
          snowflakeCollections[0],
          embeddings[0],
          undefined,
          30
        );
        
        logger.info(`Query "${query}" found ${searchResults.length} results`);
        
        // Keep track of successful queries
        if (searchResults.length > 0) {
          allResults.push({
            query,
            count: searchResults.length,
            topResults: searchResults.slice(0, 3).map(r => ({
              score: r.score,
              id: r.id,
              text: typeof r.payload?.text === 'string' ? r.payload.text.substring(0, 300) + '...' : 'No text'
            }))
          });
        }
      } catch (err) {
        logger.error(`Error searching with query "${query}": ${err}`);
      }
    }
    
    return res.json({
      success: true,
      snowflakeCollections,
      results: allResults
    });
  } catch (error) {
    const logger = createServiceLogger('ProductsSearch');
    logger.error(`Error in product search: ${error}`);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Add a specific endpoint to examine Snowflake collection content
router.get('/snowflake-content/:dataSourceId', async (req, res) => {
  try {
    const logger = createServiceLogger('SnowflakeContent');
    const dataSourceId = req.params.dataSourceId;
    logger.info(`Examining Snowflake collection content for data source: ${dataSourceId}`);
    
    const qdrantService = QdrantService.getInstance();
    
    // Try different collection name formats
    const possibleCollectionNames = [
      `datasource_${dataSourceId}`,
      `snowflake_${dataSourceId}`,
      `snowflake_${dataSourceId}_diana_sales_es_sales`
    ];
    
    // Find which collection exists
    let existingCollection: string | null = null;
    for (const name of possibleCollectionNames) {
      const exists = await qdrantService.collectionExists(name);
      if (exists) {
        existingCollection = name;
        logger.info(`Found existing collection: ${name}`);
        break;
      }
    }
    
    if (!existingCollection) {
      logger.error(`No collections found for data source ID: ${dataSourceId}`);
      return res.json({
        success: false,
        message: 'No collections found for this data source',
        checkedCollections: possibleCollectionNames
      });
    }
    
    // Get collection info
    const collectionInfo = await qdrantService.getCollectionInfo(existingCollection);
    
    // Get a sample of points from the collection
    const points = await qdrantService.getAllPoints(existingCollection, 100);
    logger.info(`Retrieved ${points.length} points from collection ${existingCollection}`);
    
    // Count points containing product-related terms
    const productTerms = ['product', 'products', 'product_id', 'item'];
    const productRelatedPoints = points.filter(point => {
      const text = typeof point.payload?.text === 'string' ? point.payload.text : '';
      return productTerms.some(term => text.toLowerCase().includes(term.toLowerCase()));
    });
    
    // Extract table names from points
    const tableNamePattern = /TABLE:\s*([A-Z0-9_]+)/i;
    const tableNames = new Set<string>();
    points.forEach(point => {
      const text = typeof point.payload?.text === 'string' ? point.payload.text : '';
      const match = text.match(tableNamePattern);
      if (match && match[1]) {
        tableNames.add(match[1]);
      }
    });
    
    return res.json({
      success: true,
      collectionName: existingCollection,
      collectionInfo,
      totalPoints: points.length,
      productRelatedPoints: {
        count: productRelatedPoints.length,
        examples: productRelatedPoints.slice(0, 5).map(p => ({
          id: p.id,
          text: typeof p.payload?.text === 'string' ? p.payload.text.substring(0, 200) + '...' : 'No text'
        }))
      },
      detectedTables: Array.from(tableNames),
      samplePoints: points.slice(0, 10).map(p => ({
        id: p.id,
        text: typeof p.payload?.text === 'string' ? p.payload.text.substring(0, 200) + '...' : 'No text'
      }))
    });
  } catch (error) {
    const logger = createServiceLogger('SnowflakeContent');
    logger.error(`Error examining Snowflake content: ${error}`);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Add endpoint to test SQL-specific queries for products
router.get('/sql-products-test/:dataSourceId', async (req, res) => {
  try {
    const logger = createServiceLogger('SQLProductsTest');
    const dataSourceId = req.params.dataSourceId;
    logger.info(`Testing SQL-specific product queries for data source: ${dataSourceId}`);
    
    const qdrantService = QdrantService.getInstance();
    const openaiService = OpenAIService.getInstance();
    
    // Try different collection name formats
    const possibleCollectionNames = [
      `snowflake_${dataSourceId}_diana_sales_es_sales`,
      `datasource_${dataSourceId}`,
      `snowflake_${dataSourceId}`
    ];
    
    // Find which collection exists
    let existingCollection: string | null = null;
    for (const name of possibleCollectionNames) {
      const exists = await qdrantService.collectionExists(name);
      if (exists) {
        existingCollection = name;
        logger.info(`Found existing collection: ${name}`);
        break;
      }
    }
    
    if (!existingCollection) {
      logger.error(`No collections found for data source ID: ${dataSourceId}`);
      return res.json({
        success: false,
        message: 'No collections found for this data source',
        checkedCollections: possibleCollectionNames
      });
    }
    
    // SQL-specific test queries
    const sqlQueries = [
      "SELECT COUNT(*) FROM PRODUCTS",
      "SELECT * FROM PRODUCTS LIMIT 10",
      "SELECT COUNT(DISTINCT PRODUCT_ID) FROM SALES",
      "SHOW TABLES",
      "TABLE SCHEMA PRODUCTS",
      "DESCRIBE TABLE PRODUCTS",
      "SQL query to count products",
      "SQL query to find total number of products",
      "SQL query to list all products"
    ];
    
    const results = [];
    
    // Process each SQL query
    for (const query of sqlQueries) {
      try {
        // Generate embeddings for the query
        const embeddings = await openaiService.createEmbeddings([query]);
        
        if (!embeddings || embeddings.length === 0) {
          logger.error(`Failed to create embeddings for query: ${query}`);
          continue;
        }
        
        // Search with very low threshold
        const searchResults = await qdrantService.search(
          existingCollection,
          embeddings[0],
          undefined,
          30
        );
        
        logger.info(`SQL query "${query}" found ${searchResults.length} results`);
        
        if (searchResults.length > 0) {
          results.push({
            query,
            count: searchResults.length,
            topResults: searchResults.slice(0, 3).map(r => ({
              score: r.score,
              id: r.id,
              text: typeof r.payload?.text === 'string' ? r.payload.text.substring(0, 200) + '...' : 'No text'
            }))
          });
        }
      } catch (err) {
        logger.error(`Error searching with SQL query "${query}": ${err}`);
      }
    }
    
    return res.json({
      success: true,
      collectionName: existingCollection,
      results,
      allQueriesTested: sqlQueries
    });
  } catch (error) {
    const logger = createServiceLogger('SQLProductsTest');
    logger.error(`Error in SQL products test: ${error}`);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Add endpoint to analyze indexed tables in Qdrant
router.get('/analyze-tables/:dataSourceId', async (req, res) => {
  try {
    const logger = createServiceLogger('AnalyzeTables');
    const dataSourceId = req.params.dataSourceId;
    logger.info(`Analyzing indexed tables for data source: ${dataSourceId}`);
    
    const qdrantService = QdrantService.getInstance();
    
    // Try different collection name formats
    const possibleCollectionNames = [
      `snowflake_${dataSourceId}_diana_sales_es_sales`,
      `datasource_${dataSourceId}`,
      `snowflake_${dataSourceId}`
    ];
    
    // Find which collection exists
    let existingCollection: string | null = null;
    for (const name of possibleCollectionNames) {
      const exists = await qdrantService.collectionExists(name);
      if (exists) {
        existingCollection = name;
        logger.info(`Found existing collection: ${name}`);
        break;
      }
    }
    
    if (!existingCollection) {
      logger.error(`No collections found for data source ID: ${dataSourceId}`);
      return res.json({
        success: false,
        message: 'No collections found for this data source',
        checkedCollections: possibleCollectionNames
      });
    }
    
    // Get a larger sample of points to analyze
    const points = await qdrantService.getAllPoints(existingCollection, 500);
    logger.info(`Retrieved ${points.length} points from collection ${existingCollection}`);
    
    // Analyze content to identify tables
    interface TableInfo {
      name: string;
      columns: Set<string>;
      schema: string | null;
      examples: Array<{id: string, text: string}>;
      count: number;
    }
    
    const tables = new Map<string, TableInfo>();
    const tablePattern = /TABLE:\s*([A-Z0-9_]+)/i;
    const columnPattern = /COLUMN:\s*([A-Z0-9_]+)/i;
    const schemaPattern = /SCHEMA:\s*([A-Z0-9_]+)/i;
    
    points.forEach(point => {
      const text = typeof point.payload?.text === 'string' ? point.payload.text : '';
      
      // Extract table
      const tableMatch = text.match(tablePattern);
      if (tableMatch && tableMatch[1]) {
        const tableName = tableMatch[1].toUpperCase();
        
        if (!tables.has(tableName)) {
          tables.set(tableName, {
            name: tableName,
            columns: new Set<string>(),
            schema: null,
            examples: [],
            count: 0
          });
        }
        
        const tableInfo = tables.get(tableName)!;
        tableInfo.count++;
        
        // Only keep first 3 examples
        if (tableInfo.examples.length < 3) {
          tableInfo.examples.push({
            id: String(point.id),
            text: text.substring(0, 150) + '...'
          });
        }
        
        // Extract schema
        const schemaMatch = text.match(schemaPattern);
        if (schemaMatch && schemaMatch[1] && !tableInfo.schema) {
          tableInfo.schema = schemaMatch[1].toUpperCase();
        }
        
        // Extract columns
        const columnMatch = text.match(columnPattern);
        if (columnMatch && columnMatch[1]) {
          tableInfo.columns.add(columnMatch[1].toUpperCase());
        }
      }
    });
    
    // Check specifically for product-related tables/columns
    const productTables = Array.from(tables.values()).filter(table => 
      table.name.includes('PRODUCT') || 
      Array.from(table.columns).some(col => col.includes('PRODUCT'))
    );
    
    // Format the tables data for response
    const tablesData = Array.from(tables.values()).map(table => ({
      name: table.name,
      schema: table.schema,
      count: table.count,
      columns: Array.from(table.columns),
      examples: table.examples
    }));
    
    return res.json({
      success: true,
      collectionName: existingCollection,
      totalPoints: points.length,
      totalTables: tables.size,
      tables: tablesData,
      productRelatedTables: productTables.map(table => ({
        name: table.name,
        count: table.count,
        columns: Array.from(table.columns)
      }))
    });
  } catch (error) {
    const logger = createServiceLogger('AnalyzeTables');
    logger.error(`Error analyzing tables: ${error}`);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Add an endpoint to test vector collection deletion
router.get('/cleanup-vectors/:dataSourceId', async (req, res) => {
  try {
    const logger = createServiceLogger('CleanupVectorsTest');
    const dataSourceId = req.params.dataSourceId;
    logger.info(`Testing vector cleanup for data source: ${dataSourceId}`);
    
    // Initialize the document processor service
    const documentProcessor = DocumentProcessorService.getInstance();
    
    // List collections before cleanup
    const qdrantService = QdrantService.getInstance();
    const beforeCollections = await qdrantService.listCollections();
    
    // Filter to potentially matching collections
    const beforeMatching = beforeCollections.filter(name => 
      name.includes(dataSourceId) || 
      name.includes(`datasource_${dataSourceId}`) || 
      name.includes(`snowflake_${dataSourceId}`)
    );
    
    logger.info(`Found ${beforeMatching.length} collections that might be associated with data source ${dataSourceId} before cleanup`);
    
    // Call the delete method
    logger.info(`Calling deleteDataSourceVectors for data source ${dataSourceId}`);
    const result = await documentProcessor.deleteDataSourceVectors(dataSourceId);
    
    // List collections after cleanup
    const afterCollections = await qdrantService.listCollections();
    
    // Filter to potentially matching collections
    const afterMatching = afterCollections.filter(name => 
      name.includes(dataSourceId) || 
      name.includes(`datasource_${dataSourceId}`) || 
      name.includes(`snowflake_${dataSourceId}`)
    );
    
    logger.info(`Found ${afterMatching.length} collections that might be associated with data source ${dataSourceId} after cleanup`);
    
    // Calculate which collections were deleted
    const deleted = beforeMatching.filter(name => !afterCollections.includes(name));
    
    return res.json({
      success: result,
      dataSourceId,
      beforeCleanup: {
        totalCollections: beforeCollections.length,
        matchingCollections: beforeMatching
      },
      afterCleanup: {
        totalCollections: afterCollections.length,
        matchingCollections: afterMatching
      },
      deletedCollections: deleted
    });
  } catch (error) {
    const logger = createServiceLogger('CleanupVectorsTest');
    logger.error(`Error in vector cleanup test: ${error}`);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export const testRoutes = router;
export default router; 
