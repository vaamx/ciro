import { injectable } from 'inversify';
import { createLogger } from '../utils/logger';
import { db } from '../infrastructure/database';
import { WebSocketService } from './websocket.service';

/**
 * Service for handling file upload operations
 */
@injectable()
export class FileUploadService {
  private logger = createLogger('FileUploadService');
  private websocketService: WebSocketService;

  constructor() {
    this.logger.info('FileUploadService initialized');
    this.websocketService = new WebSocketService();
  }

  /**
   * Create a data source for an uploaded file
   * @param dataSource Data source object to create
   * @returns Created data source
   */
  async createDataSource(dataSource: Record<string, any>): Promise<Record<string, any>> {
    try {
      this.logger.info(`Creating data source for file: ${dataSource.name}`);
      
      // Insert data source into database
      const [result] = await db('data_sources')
        .insert({
          name: dataSource.name,
          type: dataSource.type || 'file',
          config: dataSource.config || {},
          metadata: dataSource.metadata || {},
          organization_id: dataSource.organization_id || 1, // Default organization
          status: dataSource.status || 'queued', // Set initial status
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning(['id', 'name', 'type', 'status', 'created_at', 'metadata']);
      
      this.logger.info(`Data source created with ID: ${result.id}`);
      
      // Ensure we're using the correct name from the database result
      // and include the full metadata for proper display
      this.websocketService.broadcast('knowledgeBaseUpdated', {
        action: 'add',
        source: {
          id: result.id,
          name: result.name,
          type: dataSource.type || 'file',
          icon: 'file-text', // Default icon for file uploads
          isActive: true,
          status: result.status,
          metadata: result.metadata || dataSource.metadata, // Include metadata to ensure correct file info
          description: dataSource.metadata?.originalName ? `File upload: ${dataSource.metadata.originalName}` : undefined
        }
      });
      
      // Also broadcast timestamp update for cache invalidation
      this.websocketService.broadcast('knowledgeBaseUpdated', {
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error creating data source: ${errorMessage}`, error);
      throw new Error(`Failed to create data source: ${errorMessage}`);
    }
  }
  
  /**
   * Update a data source
   * @param id Data source ID
   * @param updates Updates to apply
   * @returns Updated data source
   */
  async updateDataSource(id: number, updates: Record<string, any>): Promise<Record<string, any>> {
    try {
      this.logger.info(`Updating data source ${id}`);
      
      // Update data source in database
      const [result] = await db('data_sources')
        .where('id', id)
        .update({
          ...updates,
          updated_at: new Date()
        })
        .returning(['id', 'name', 'type', 'status', 'metadata']);
      
      this.logger.info(`Data source ${id} updated successfully`);
      
      // Broadcast update with complete metadata
      this.websocketService.broadcast('knowledgeBaseUpdated', {
        action: 'update',
        source: {
          id: result.id,
          name: result.name,
          type: result.type,
          status: result.status,
          metadata: result.metadata, // Include full metadata
          description: result.metadata?.originalName ? `File upload: ${result.metadata.originalName}` : undefined
        }
      });
      
      // Also broadcast timestamp update for cache invalidation
      this.websocketService.broadcast('knowledgeBaseUpdated', {
        timestamp: new Date().toISOString()
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error updating data source ${id}: ${errorMessage}`, error);
      throw new Error(`Failed to update data source: ${errorMessage}`);
    }
  }
  
  /**
   * Get a data source by ID
   * @param id Data source ID
   * @returns Data source object
   */
  async getDataSource(id: number): Promise<Record<string, any> | null> {
    try {
      const result = await db('data_sources')
        .where('id', id)
        .first();
      
      return result || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error getting data source ${id}: ${errorMessage}`, error);
      throw new Error(`Failed to get data source: ${errorMessage}`);
    }
  }
} 