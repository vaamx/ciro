/**
 * Check System State
 * 
 * This script checks the current state of collections in Qdrant and data sources in the database.
 * Useful for checking before and after cleanup operations.
 * 
 * Usage:
 * npx ts-node src/scripts/check-system-state.ts
 */

import { createLogger } from '../utils/logger';
import { QdrantService } from '../services/qdrant.service';
import { db } from '../infrastructure/database/knex';

const logger = createLogger('SystemStateCheck');

async function checkSystemState() {
  logger.info('Checking system state...');
  
  try {
    // Check Qdrant collections
    const qdrantService = QdrantService.getInstance();
    const client = qdrantService.getClient();
    
    const collections = await client.getCollections();
    logger.info(`Found ${collections.collections.length} collections in Qdrant`);
    
    // List all collection names
    if (collections.collections.length > 0) {
      logger.info('Collection names:');
      collections.collections.forEach((collection, index) => {
        logger.info(`- ${index + 1}: ${collection.name}`);
      });
    }
    
    // Check data sources
    const dataSources = await db('data_sources').select('*');
    logger.info(`Found ${dataSources.length} data sources in the database`);
    
    // List all data sources
    if (dataSources.length > 0) {
      logger.info('Data sources:');
      dataSources.forEach((dataSource, index) => {
        logger.info(`- ${index + 1}: ${dataSource.id} (${dataSource.name}), type: ${dataSource.type}, status: ${dataSource.status}`);
      });
    }
    
    logger.info('System state check complete');
    
  } catch (error) {
    logger.error(`Error checking system state: ${error}`);
    throw error;
  }
}

// Run the check
checkSystemState()
  .then(() => {
    logger.info('Script execution completed successfully');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Script execution failed: ${error}`);
    process.exit(1);
  }); 