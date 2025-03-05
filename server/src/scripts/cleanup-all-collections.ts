/**
 * Cleanup All Collections
 * 
 * This script cleans up ALL collections from the Qdrant database.
 * USE WITH CAUTION - this will delete all vector data.
 * 
 * Usage:
 * npx ts-node src/scripts/cleanup-all-collections.ts
 */

import { createLogger } from '../utils/logger';
import { QdrantService } from '../services/qdrant.service';

const logger = createLogger('CleanupAllScript');

async function cleanupAllCollections() {
  logger.info('Starting cleanup of ALL collections...');
  logger.warn('This will delete ALL collections from Qdrant');
  
  try {
    // Get QdrantService instance
    const qdrantService = QdrantService.getInstance();
    logger.info('QdrantService initialized');
    
    // Get the client
    const client = qdrantService.getClient();
    
    // List all collections
    const collections = await client.getCollections();
    logger.info(`Found ${collections.collections.length} total collections`);
    
    const allCollections = collections.collections.map(collection => collection.name);
    
    logger.info(`Preparing to delete ${allCollections.length} collections`);
    
    // Delete each collection
    const deletionResults = await Promise.allSettled(
      allCollections.map(async (collectionName) => {
        try {
          logger.info(`Deleting collection: ${collectionName}`);
          await client.deleteCollection(collectionName);
          return { name: collectionName, success: true };
        } catch (error) {
          logger.error(`Failed to delete collection ${collectionName}: ${error}`);
          return { name: collectionName, success: false, error };
        }
      })
    );
    
    // Summarize results
    const successfulDeletions = deletionResults.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;
    
    const failedDeletions = deletionResults.filter(result => 
      result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success)
    ).length;
    
    logger.info('===== Cleanup Complete =====');
    logger.info(`Total collections processed: ${allCollections.length}`);
    logger.info(`Successfully deleted: ${successfulDeletions}`);
    logger.info(`Failed to delete: ${failedDeletions}`);
    
    // Print details of failures if any
    if (failedDeletions > 0) {
      logger.info('--- Failed Deletions ---');
      deletionResults.forEach(result => {
        if (result.status === 'rejected') {
          logger.error(`Failed: ${result.reason}`);
        } else if (result.status === 'fulfilled' && !result.value.success) {
          logger.error(`Failed to delete ${result.value.name}: ${result.value.error}`);
        }
      });
    }
    
    logger.info('Cleanup process completed');
    
  } catch (error) {
    logger.error(`Error during cleanup: ${error}`);
    throw error;
  }
}

// Run the cleanup
cleanupAllCollections()
  .then(() => {
    logger.info('Script execution completed successfully');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Script execution failed: ${error}`);
    process.exit(1);
  }); 