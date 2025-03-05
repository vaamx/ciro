#!/usr/bin/env ts-node

import { QdrantService } from '../services/qdrant.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('CleanupScript');

async function cleanupTestCollections() {
  logger.info('Starting cleanup of test emergency collections');
  
  const qdrantService = QdrantService.getInstance();
  
  try {
    // Get all collections
    const collections = await qdrantService.listCollections();
    logger.info(`Found ${collections.length} total collections`);
    
    // Filter for test emergency collections
    const testCollections = collections.filter(name => name.startsWith('test_emergency_'));
    logger.info(`Found ${testCollections.length} test emergency collections to delete`);
    
    // Delete each test collection
    let deletedCount = 0;
    let failedCount = 0;
    
    for (const collectionName of testCollections) {
      try {
        logger.info(`Deleting collection: ${collectionName}`);
        const success = await qdrantService.deleteCollection(collectionName);
        
        if (success) {
          deletedCount++;
          logger.info(`Successfully deleted collection: ${collectionName}`);
        } else {
          failedCount++;
          logger.error(`Failed to delete collection: ${collectionName}`);
        }
      } catch (error) {
        failedCount++;
        logger.error(`Error deleting collection ${collectionName}: ${error.message}`);
      }
    }
    
    logger.info(`Cleanup completed: ${deletedCount} collections deleted, ${failedCount} failed`);
  } catch (error) {
    logger.error(`Cleanup failed: ${error.message}`);
  }
}

// Run the cleanup function
cleanupTestCollections()
  .then(() => {
    logger.info('Cleanup script completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error(`Cleanup script failed: ${error.message}`);
    process.exit(1);
  }); 