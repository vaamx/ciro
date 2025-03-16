#!/usr/bin/env node

/**
 * Test script for the RowLevelIndexerService
 * 
 * This script allows testing the row-level indexer directly without going through
 * the full connection flow.
 * 
 * Usage: 
 * node test-row-indexer.js <dataSourceId> <database> <schema> <tableName>
 */

// Compile TypeScript files first
require('ts-node').register({
  transpileOnly: true
});

// Import required services
const { RowLevelIndexerService } = require('../services/data-storage/row-level-indexer.service');
const { SnowflakeService } = require('../services/snowflake.service');
const { createLogger } = require('../utils/logger');
const { QdrantService } = require('../services/qdrant.service');

const logger = createLogger('TestRowIndexer');

async function main() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    if (args.length < 4) {
      logger.error('Usage: node test-row-indexer.js <dataSourceId> <database> <schema> <tableName>');
      process.exit(1);
    }

    const dataSourceId = parseInt(args[0]);
    const database = args[1];
    const schema = args[2];
    const tableName = args[3];
    const limit = args[4] ? parseInt(args[4]) : 1000; // Optional row limit

    logger.info(`Testing row-level indexer for table ${database}.${schema}.${tableName} (data source ${dataSourceId})`);
    logger.info(`Using row limit: ${limit}`);

    // Check Qdrant connection first
    logger.info('Checking Qdrant connection...');
    const qdrantService = QdrantService.getInstance();
    try {
      const collections = await qdrantService.listCollections();
      logger.info(`Qdrant connection successful. Found ${collections.length} collections.`);
    } catch (qdrantError) {
      logger.error(`Qdrant connection failed: ${qdrantError.message}`);
      logger.error('Make sure Qdrant is running and accessible');
      process.exit(1);
    }

    // Verify data source exists and has valid credentials
    const snowflakeService = SnowflakeService.getInstance();
    logger.info('Testing Snowflake connection...');
    const connectionTest = await snowflakeService.testConnection(dataSourceId);
    
    if (!connectionTest.success) {
      logger.error(`Snowflake connection failed: ${connectionTest.message}`);
      process.exit(1);
    }
    
    logger.info('Snowflake connection successful, proceeding with row-level indexing');

    // Get the row-level indexer service
    const rowLevelIndexerService = RowLevelIndexerService.getInstance();

    // Create a custom collection name for testing
    const collectionName = `row_test_${dataSourceId}_${database}_${schema}_${tableName}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    logger.info(`Using collection name: ${collectionName}`);

    // Check if collection exists and drop it for clean testing
    if (await qdrantService.collectionExists(collectionName)) {
      logger.info(`Collection ${collectionName} already exists, deleting it for clean testing...`);
      await qdrantService.deleteCollection(collectionName);
      logger.info(`Collection deleted successfully`);
    }

    // Run the row-level indexer
    const startTime = Date.now();
    
    try {
      const result = await rowLevelIndexerService.indexTableRows(
        dataSourceId,
        database,
        schema,
        tableName,
        {
          chunkSize: 100, // Use a smaller chunk size for testing
          maxRows: limit, // Limit for testing
          forceFresh: true,
          createEmbeddings: true
        }
      );

      const duration = (Date.now() - startTime) / 1000;
      logger.info(`Row-level indexing completed in ${duration.toFixed(2)}s`);
      logger.info(`Indexed ${result.rowsIndexed} rows in ${result.chunksProcessed} chunks`);
      logger.info(`Collection name: ${result.collectionName}`);

      // Test a simple search to verify data was indexed properly
      logger.info('Testing search on the indexed data...');
      const searchResults = await qdrantService.getCollectionSample(result.collectionName, 5);
      
      if (searchResults && searchResults.length > 0) {
        logger.info(`Search returned ${searchResults.length} results. Sample point:`);
        const samplePoint = searchResults[0];
        logger.info(`Point ID: ${samplePoint.id}`);
        logger.info(`Point data: ${JSON.stringify(samplePoint.payload, null, 2).substring(0, 200)}...`);
      } else {
        logger.warn('Search returned no results');
      }
    } catch (error) {
      logger.error(`Failed to index rows: ${error.message}`);
      if (error.message.includes('not a valid point ID')) {
        logger.error('This error is related to incorrect ID format for Qdrant points.');
        logger.error('Check that all point IDs are either unsigned integers or UUIDs.');
      }
      throw error;
    }

    // Clean up when done
    logger.info('Test completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error in test script:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(err => {
  logger.error('Unhandled error:', err);
  process.exit(1);
}); 