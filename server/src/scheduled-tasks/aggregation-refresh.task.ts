import { createServiceLogger } from '../common/utils/logger-factory';
import { AggregationGeneratorService } from '../services/aggregation/aggregation-generator.service';
import { db } from '../config/database';

const logger = createServiceLogger('AggregationRefreshTask');

// Create a mock version of AggregationGeneratorService for standalone use
class MockAggregationGeneratorService {
  async generateAggregations(dataSourceId: number, options: any = {}) {
    logger.info(`[MOCK] Generate aggregations for data source ${dataSourceId}`, { options });
    return {
      dataSourceId,
      aggregationsGenerated: 0,
      aggregationsByType: {},
      errors: []
    };
  }
}

/**
 * Task for periodically refreshing aggregations for all data sources
 */
export class AggregationRefreshTask {
  constructor(
    private aggregationGenerator: { generateAggregations: (id: number, options: any) => Promise<any> } = new MockAggregationGeneratorService(),
    private database = db
  ) {
    logger.info('AggregationRefreshTask initialized');
  }
  
  /**
   * Run the aggregation refresh task
   */
  async run(): Promise<void> {
    logger.info('Starting scheduled aggregation refresh task');
    
    try {
      // 1. Get all active data sources
      const dataSources = await this.getActiveDataSources();
      logger.info(`Found ${dataSources.length} active data sources to process`);
      
      // 2. For each data source, refresh aggregations if needed
      for (const dataSource of dataSources) {
        try {
          logger.info(`Processing data source ${dataSource.id} (${dataSource.name})`);
          
          // Check if this data source needs refresh
          if (await this.needsRefresh(dataSource)) {
            logger.info(`Refreshing aggregations for data source ${dataSource.id}`);
            
            const result = await this.aggregationGenerator.generateAggregations(
              dataSource.id,
              {
                forceRefresh: true
              }
            );
            
            logger.info(`Generated ${result.aggregationsGenerated} aggregations for data source ${dataSource.id}`, {
              byType: result.aggregationsByType
            });
            
            // Update last refresh time
            await this.updateLastRefreshTime(dataSource.id);
          } else {
            logger.info(`Skipping data source ${dataSource.id}, no refresh needed`);
          }
        } catch (error) {
          logger.error(`Failed to refresh aggregations for data source ${dataSource.id}`, {
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue with next data source
        }
      }
      
      logger.info('Completed scheduled aggregation refresh task');
    } catch (error) {
      logger.error('Failed to run aggregation refresh task', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Get all active data sources from the database
   */
  private async getActiveDataSources(): Promise<any[]> {
    try {
      // Get all active data sources from database
      return this.database('data_sources')
        .where('status', 'ready')
        .select('id', 'type', 'name', 'metadata');
    } catch (error) {
      logger.error('Failed to get active data sources', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
  
  /**
   * Check if a data source needs aggregation refresh
   */
  private async needsRefresh(dataSource: any): Promise<boolean> {
    try {
      // Get last refresh time
      const lastRefresh = await this.database('aggregation_refresh_history')
        .where('data_source_id', dataSource.id)
        .orderBy('refreshed_at', 'desc')
        .first();
      
      if (!lastRefresh) {
        // Never refreshed before
        logger.info(`Data source ${dataSource.id} has never been refreshed before`);
        return true;
      }
      
      // Check if data has been updated since last refresh
      const lastUpdate = await this.database('data_sources')
        .where('id', dataSource.id)
        .select('updated_at')
        .first();
      
      if (lastUpdate && new Date(lastUpdate.updated_at) > new Date(lastRefresh.refreshed_at)) {
        logger.info(`Data source ${dataSource.id} has been updated since last refresh`);
        return true;
      }
      
      // Check if refresh interval has passed
      const now = new Date();
      const refreshInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      const timeSinceLastRefresh = now.getTime() - new Date(lastRefresh.refreshed_at).getTime();
      
      if (timeSinceLastRefresh > refreshInterval) {
        logger.info(`Refresh interval has passed for data source ${dataSource.id} (${timeSinceLastRefresh / 3600000} hours since last refresh)`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error checking if data source ${dataSource.id} needs refresh`, {
        error: error instanceof Error ? error.message : String(error)
      });
      // If we can't determine, assume it needs refresh
      return true;
    }
  }
  
  /**
   * Update the last refresh time for a data source
   */
  private async updateLastRefreshTime(dataSourceId: number): Promise<void> {
    try {
      // Check if the table exists, create if not
      const tableExists = await this.checkIfTableExists('aggregation_refresh_history');
      
      if (!tableExists) {
        await this.createRefreshHistoryTable();
      }
      
      // Update last refresh time in database
      await this.database('aggregation_refresh_history').insert({
        data_source_id: dataSourceId,
        refreshed_at: new Date(),
        status: 'success'
      });
      
      logger.info(`Updated last refresh time for data source ${dataSourceId}`);
    } catch (error) {
      logger.error(`Failed to update last refresh time for data source ${dataSourceId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Check if a table exists in the database
   */
  private async checkIfTableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.database.raw(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = ?
      `, [tableName]);
      
      return result.rows.length > 0;
    } catch (error) {
      logger.error(`Failed to check if table ${tableName} exists`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
  
  /**
   * Create the aggregation refresh history table if it doesn't exist
   */
  private async createRefreshHistoryTable(): Promise<void> {
    try {
      logger.info('Creating aggregation_refresh_history table');
      
      await this.database.schema.createTable('aggregation_refresh_history', (table) => {
        table.increments('id').primary();
        table.integer('data_source_id').notNullable().references('id').inTable('data_sources');
        table.timestamp('refreshed_at').notNullable().defaultTo(this.database.fn.now());
        table.string('status').notNullable();
        table.jsonb('metadata').defaultTo('{}');
        table.timestamps(true, true);
      });
      
      logger.info('Successfully created aggregation_refresh_history table');
    } catch (error) {
      logger.error('Failed to create aggregation_refresh_history table', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
} 