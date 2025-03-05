/**
 * Cleanup All Data Sources
 * 
 * This script deletes ALL data sources from the database.
 * USE WITH CAUTION - this will delete all data source records.
 * 
 * Usage:
 * npx ts-node src/scripts/cleanup-all-datasources.ts
 */

import { createLogger } from '../utils/logger';
import { DataSourceService } from '../infrastructure/datasource/DataSourceService';
import { DocumentProcessorService } from '../services/document-processor.service';
import { db } from '../infrastructure/database/knex';

const logger = createLogger('CleanupDataSourcesScript');

async function cleanupAllDataSources() {
  logger.info('Starting cleanup of ALL data sources...');
  logger.warn('This will delete ALL data sources from the database');
  
  try {
    // Get DataSourceService instance
    const dataSourceService = new DataSourceService();
    const documentProcessor = DocumentProcessorService.getInstance();
    
    // Get all data sources
    const dataSources = await db('data_sources').select('*');
    logger.info(`Found ${dataSources.length} data sources`);
    
    // Delete each data source
    const deletionResults = await Promise.allSettled(
      dataSources.map(async (dataSource) => {
        try {
          logger.info(`Deleting vectors for data source: ${dataSource.id} (${dataSource.name})`);
          // First delete vectors from Qdrant
          await documentProcessor.deleteDataSourceVectors(dataSource.id.toString());
          
          logger.info(`Deleting data source record: ${dataSource.id} (${dataSource.name})`);
          // Then delete from database
          await dataSourceService.deleteDataSource(dataSource.id);
          
          return { id: dataSource.id, name: dataSource.name, success: true };
        } catch (error) {
          logger.error(`Failed to delete data source ${dataSource.id}: ${error}`);
          return { id: dataSource.id, name: dataSource.name, success: false, error };
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
    logger.info(`Total data sources processed: ${dataSources.length}`);
    logger.info(`Successfully deleted: ${successfulDeletions}`);
    logger.info(`Failed to delete: ${failedDeletions}`);
    
    // Print details of failures if any
    if (failedDeletions > 0) {
      logger.info('--- Failed Deletions ---');
      deletionResults.forEach(result => {
        if (result.status === 'rejected') {
          logger.error(`Failed: ${result.reason}`);
        } else if (result.status === 'fulfilled' && !result.value.success) {
          logger.error(`Failed to delete ${result.value.id}: ${result.value.error}`);
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
cleanupAllDataSources()
  .then(() => {
    logger.info('Script execution completed successfully');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Script execution failed: ${error}`);
    process.exit(1);
  }); 