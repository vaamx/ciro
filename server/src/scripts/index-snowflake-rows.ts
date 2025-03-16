/**
 * Script to index Snowflake data at the row level for accurate aggregation queries
 * 
 * This script demonstrates the use of the RowLevelIndexerService to store
 * complete row data in Qdrant, enabling accurate aggregation queries.
 * 
 * Usage:
 * 1. Make sure you have the right env variables set up for Snowflake connection
 * 2. Run this script with:
 *    npx ts-node src/scripts/index-snowflake-rows.ts
 */

import { RowLevelIndexerService } from '../services/data-storage/row-level-indexer.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('IndexSnowflakeRows');

async function main() {
  try {
    logger.info('Starting Snowflake row-level indexing');
    
    // Get the RowLevelIndexerService instance
    const indexerService = RowLevelIndexerService.getInstance();
    
    // Define the Snowflake data source to index
    const dataSourceId = 261; // Use your actual data source ID
    const database = 'DIANA_SALES_ES';
    const schema = 'SALES';
    const tableName = 'TRANSACTIONS';
    
    // Options for indexing
    const options = {
      chunkSize: 10000,      // Process 10K rows at a time
      maxRows: 1000000,      // Index up to 1M rows
      forceFresh: true,      // Force re-indexing even if collection exists
      createEmbeddings: true // Create embeddings for each row
    };
    
    logger.info(`Indexing table ${database}.${schema}.${tableName}`);
    
    // Run the indexing process
    const result = await indexerService.indexTableRows(
      dataSourceId,
      database,
      schema,
      tableName,
      options
    );
    
    logger.info('Indexing completed successfully!');
    logger.info(`Indexed ${result.totalIndexed} rows in ${result.totalChunks} chunks`);
    logger.info(`Collection name: datasource_${dataSourceId}_${tableName.toLowerCase()}`);
    
    // Additional step: Run a test query to verify the data
    logger.info('\nVerification step - running test query:');
    
    // Simple test query showing how to access the data
    const testQuery = `
    SELECT 
      SUM(CASE WHEN PRODUCT_ID = 1 THEN TOTAL_VALUE ELSE 0 END) as nachos_sales,
      COUNT(CASE WHEN PRODUCT_ID = 1 THEN 1 ELSE NULL END) as nachos_transactions
    FROM ${database}.${schema}.${tableName}
    `;
    
    logger.info(`Test query: ${testQuery}`);
    
    // NOTE: This is just a demonstration - add code to execute the query if needed
    
    logger.info('\nNext steps:');
    logger.info('1. Update the HybridSearchEngine to use this row-level data for aggregation queries');
    logger.info('2. Implement pre-computed aggregations for common metrics');
    logger.info('3. Ensure the RAGIntegrationService can leverage both semantic and row-level data');
    
  } catch (error) {
    logger.error(`Error indexing Snowflake data: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error); 