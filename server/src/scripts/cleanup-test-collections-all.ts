/**
 * Cleanup All Test Collections
 * 
 * This script cleans up all test collections from the Qdrant database,
 * including test_emergency_*, test_excel_*, test_id_format_*, and any other 
 * collections that are identifiable as test collections.
 * 
 * Usage:
 * npx ts-node src/scripts/cleanup-test-collections-all.ts
 */

import { createLogger } from '../utils/logger';
import { QdrantService } from '../services/qdrant.service';

const logger = createLogger('CleanupScript');

const TEST_COLLECTION_PATTERNS = [
  /^test_emergency_\d+$/,
  /^test_excel_\d+$/,
  /^test_id_format_\d+$/,
  /^test_direct_curl$/,
  /^test_collection_/
];

async function cleanupAllTestCollections() {
  logger.info('Starting cleanup of all test collections...');
  
  try {
    // Get QdrantService instance
    const qdrantService = QdrantService.getInstance();
    logger.info('QdrantService initialized');
    
    // Get the client
    const client = qdrantService.getClient();
    
    // List all collections
    const collections = await client.getCollections();
    logger.info(`Found ${collections.collections.length} total collections`);
    
    // Filter test collections
    const testCollections = collections.collections
      .map(collection => collection.name)
      .filter(name => TEST_COLLECTION_PATTERNS.some(pattern => pattern.test(name)));
    
    logger.info(`Found ${testCollections.length} test collections to delete`);
    
    // Delete each test collection
    const deletionResults = await Promise.allSettled(
      testCollections.map(async (collectionName) => {
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
    logger.info(`Total collections processed: ${testCollections.length}`);
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
cleanupAllTestCollections()
  .then(() => {
    logger.info('Script execution completed successfully');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Script execution failed: ${error}`);
    process.exit(1);
  }); 