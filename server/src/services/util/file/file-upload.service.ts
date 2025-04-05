import { injectable } from 'inversify';
import { createServiceLogger } from '../../../utils/logger-factory';
import { db } from '../../../config/database';
import { WebSocketService } from '../websocket.service';
import { DataSource } from '../../../types';

// Add interface at the top of the file before class definition
interface DbResult {
  id: number;
  name: string;
  type: string;
  created_at: Date;
}

/**
 * Service for handling file upload operations
 */
@injectable()
export class FileUploadService {
  private readonly logger = createServiceLogger('FileUploadService');
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
  async createDataSource(dataSource: Partial<DataSource>): Promise<DataSource> {
    try {
      this.logger.info(`Creating data source: ${JSON.stringify(dataSource)}`);
      
      // Get the user ID from various possible sources
      const userId = dataSource.user_id || dataSource.created_by || dataSource.uploadedBy;
      
      if (!userId) {
        this.logger.warn('No user ID provided for data source creation');
        throw new Error('User ID is required to create a data source');
      }
      
      // Convert UUID to integer for created_by field
      let createdById = 1; // Default value
      if (typeof userId === 'number') {
        createdById = userId;
      } else {
        // Extract just the numeric part of the UUID
        const uuidDigits = userId.toString().replace(/\D/g, '');
        // Take first 8 digits and convert to integer (mod 1M to ensure it fits in INTEGER)
        createdById = parseInt(uuidDigits.substring(0, 8), 10) % 1000000;
        createdById = Math.abs(createdById) || 1; // Ensure positive and default to 1 if 0
        this.logger.info(`Converted UUID ${userId} to integer ID: ${createdById}`);
      }
      
      this.logger.info(`Using created_by: ${createdById} (integer ID)`);
      
      // Rest of the function to create data source with properly formatted created_by
      const { config, ...insertData } = dataSource;
      const result = await db('data_sources')
        .insert({
          name: dataSource.name,
          type: dataSource.type || 'file',
          organization_id: dataSource.organization_id || 1,
          created_by: createdById, // Use integer ID
          status: dataSource.status || 'connected',
          metadata: {
            ...(dataSource.metadata || {}),
            id: dataSource.id || undefined,
            filename: dataSource.filename || dataSource.name,
            originalFilename: dataSource.originalFilename || dataSource.original_filename || dataSource.name,
            mimeType: dataSource.mimetype || dataSource.mime_type || undefined,
            fileType: dataSource.filetype || dataSource.file_type || undefined,
            size: dataSource.size || undefined,
            originalUserId: userId // Store the original UUID for reference
          },
          description: dataSource.description || `File upload: ${dataSource.name}`,
          created_at: dataSource.created_at || new Date(),
          updated_at: dataSource.updated_at || new Date()
        })
        .returning(['id', 'name', 'type', 'created_at']);
      
      // Type assertion for the result
      const typedResult = result as unknown as DbResult[] | DbResult;
      const resultId = Array.isArray(typedResult) ? typedResult[0]?.id : typedResult.id;
      const resultName = Array.isArray(typedResult) ? typedResult[0]?.name : typedResult.name;
      
      this.logger.info(`Data source created with ID: ${resultId}`);
      
      // Broadcast update
      this.websocketService.broadcast('knowledgeBaseUpdated', {
        action: 'add',
        source: {
          id: resultId,
          name: resultName,
          // Use a generic 'file' type for display purposes
          type: 'file',
          icon: 'file-text', // Default icon for file uploads
          isActive: true,
          description: `File upload: ${dataSource.name}`
        }
      });
      
      // Also broadcast timestamp update for cache invalidation
      this.websocketService.broadcast('knowledgeBaseUpdated', {
        timestamp: new Date().toISOString()
      });
      
      const createdSource = {
        id: resultId,
        name: dataSource.name,
        type: dataSource.type || 'file',
        status: dataSource.status || 'connected',
        metadata: dataSource.metadata,
        created_at: dataSource.created_at || new Date(),
        updated_at: dataSource.updated_at || new Date()
      } as DataSource;
      
      return createdSource;
    } catch (error: any) {
      this.logger.error(`Error creating data source: ${error}`, { error });
      throw error;
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
      const updateData: Record<string, any> = { 
        updated_at: new Date() 
      };
      
      // Only include allowed fields in the updates
      if (updates.name) updateData.name = updates.name;
      if (updates.type) updateData.type = updates.type;
      
      const [result] = await db('data_sources')
        .where('id', id)
        .update(updateData)
        .returning(['id', 'name', 'type']);
      
      this.logger.info(`Data source ${id} updated successfully`);
      
      // Broadcast update with the data we have
      this.websocketService.broadcast('knowledgeBaseUpdated', {
        action: 'update',
        source: {
          id: result.id,
          name: result.name,
          type: 'file', // Always use 'file' type for frontend consistency
          description: `File upload: ${result.name}`
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