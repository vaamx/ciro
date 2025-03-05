/**
 * Utility script to manually process a CSV file that has already been uploaded
 * 
 * Usage: npx ts-node src/scripts/process-csv-file.ts [dataSourceId]
 */

import { DocumentProcessorFactory } from '../services/document-processors/document-processor-factory';
import { db } from '../infrastructure/database';
import { createLogger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

const logger = createLogger('ProcessCSVScript');

async function main() {
  // Get data source ID from command line
  const dataSourceId = process.argv[2];
  
  if (!dataSourceId) {
    logger.error('Please provide a data source ID as an argument');
    process.exit(1);
  }
  
  logger.info(`Processing CSV file for data source ID: ${dataSourceId}`);
  
  try {
    // Get data source from database
    const dataSource = await db('data_sources')
      .where('id', dataSourceId)
      .first();
    
    if (!dataSource) {
      logger.error(`Data source not found with ID: ${dataSourceId}`);
      process.exit(1);
    }
    
    logger.info(`Found data source: ${JSON.stringify({
      id: dataSource.id,
      name: dataSource.name,
      type: dataSource.type,
      status: dataSource.status
    })}`);
    
    // Verify it's a CSV file
    if (!dataSource.metadata?.fileType || dataSource.metadata.fileType !== 'csv') {
      logger.error(`Data source is not a CSV file. Type: ${dataSource.metadata?.fileType}`);
      process.exit(1);
    }
    
    // Get file path from metadata
    const filePath = dataSource.metadata?.filePath;
    
    if (!filePath) {
      logger.error('File path not found in metadata');
      process.exit(1);
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.error(`File does not exist at path: ${filePath}`);
      
      // Try to find the file in uploads directory
      const fileName = dataSource.metadata?.filename;
      const uploadsDir = path.join(process.cwd(), 'uploads');
      
      // Search for the file in uploads directory
      let foundPath = null;
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
          if (file.includes(dataSource.metadata?.id || '')) {
            foundPath = path.join(uploadsDir, file);
            break;
          }
        }
      }
      
      if (!foundPath) {
        logger.error('Could not find the file in uploads directory');
        process.exit(1);
      }
      
      logger.info(`Found file at alternative path: ${foundPath}`);
    }
    
    // Initialize the document processor factory
    logger.info('Initializing DocumentProcessorFactory');
    const factory = new DocumentProcessorFactory();
    
    // Get the CSV processor
    logger.info('Getting CSV processor');
    const processor = factory.getProcessor('csv-processor');
    
    if (!processor) {
      logger.error('Could not get CSV processor');
      process.exit(1);
    }
    
    logger.info(`Found CSV processor: ${processor.constructor.name}`);
    
    // Process the file
    logger.info(`Processing file at path: ${filePath}`);
    const result = await processor.processFile(filePath, dataSourceId, {
      directProcessing: true,
      verbose: true
    });
    
    logger.info(`Processing completed with result: ${JSON.stringify(result)}`);
    
    // Update the data source status
    await db('data_sources')
      .where('id', dataSourceId)
      .update({
        status: result.status === 'success' ? 'connected' : 'error',
        updated_at: new Date(),
        metrics: {
          ...dataSource.metrics,
          records: result.metadata?.recordCount || 0,
          chunks: result.chunks || 0,
          lastProcessed: new Date().toISOString(),
          processingStatus: result.status
        }
      });
    
    logger.info('Data source updated successfully');
    
    process.exit(0);
  } catch (error) {
    logger.error(`Error processing CSV file: ${error}`);
    process.exit(1);
  }
}

// Run the main function
main(); 