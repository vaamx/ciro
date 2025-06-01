import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { 
  DataSource, 
  DataSourceType,
  FileStatus
} from '../../../core/database/prisma-types';


import { createServiceLogger } from '../../../common/utils/logger-factory';

import { DocumentPipelineService } from '../../ingestion/document-pipeline.service';
import { QdrantCollectionService } from '../../vector/collection-manager.service';

import { FileType } from '../../../types/utils/file-types';

import { CreateDataSourceDto } from '../../../modules/data-source/dto/create-data-source.dto';
import { UpdateDataSourceDto } from '../../../modules/data-source/dto/update-data-source.dto';


// Define interface for DocumentChunk
interface DocumentChunk {
  id: number;
  content: string;
  metadata?: any;
  fileId: number;
  createdAt: Date;
}

/**
 * TODO: This file needs a significant refactoring to properly integrate with the updated services structure.
 * The imports have been updated to point to the correct locations, but the implementation still expects
 * the old API. A proper fix would require updating all the service usage throughout this file.
 */

interface SearchResult {
  id: string;
  score: number;
  payload: {
    text?: string;
    content?: string;
    page_content?: string;
    metadata?: Record<string, any>;
  };
}

interface SearchResultWithMetadata {
  id: string;
  data_source_id: number;
  content: string;
  metadata: {
    datasource_id: number;
    collection_name: string;
    similarity: number;
    [key: string]: any;
  };
  similarity: number;
}

/**
 * Maps a DataSourceType to a corresponding FileType
 * This is needed because the document pipeline expects a FileType
 */
function mapDataSourceTypeToFileType(dataSourceType: string | DataSourceType, dataSource?: any): FileType {
  // First, try to determine file type from the data source name or config
  if (dataSource) {
    // Check config for processing method first (highest priority)
    if (dataSource.config) {
      const config = dataSource.config;
      
      if (config.processingMethod === 'enhanced-excel-pipeline' || config.fileType === 'excel') {
        return 'excel';
      }
      if (config.processingMethod === 'csv-processor' || config.fileType === 'csv') {
        return 'csv';
      }
      if (config.fileType) {
        // If config has explicit fileType, use it
        const fileType = config.fileType;
        if (['excel', 'csv', 'pdf', 'docx', 'json', 'text'].includes(fileType)) {
          return fileType as FileType;
        }
      }
    }
    
    // Check data source name for file extension
    if (dataSource.name) {
      const name = dataSource.name.toLowerCase();
      
      if (name.includes('.xlsx') || name.includes('.xls') || name.includes('excel')) {
        return 'excel';
      }
      if (name.includes('.csv')) {
        return 'csv';
      }
      if (name.includes('.pdf')) {
        return 'pdf';
      }
      if (name.includes('.docx') || name.includes('.doc')) {
        return 'docx';
      }
      if (name.includes('.json')) {
        return 'json';
      }
      if (name.includes('.txt')) {
        return 'text';
      }
    }
  }

  // Fallback to original enum-based logic
  switch (dataSourceType) {
    case DataSourceType.FILE_UPLOAD:
      // Default to a common format when exact type is unknown
      return 'pdf';
    case DataSourceType.SNOWFLAKE:
      // Snowflake exports as CSV or JSON typically
      return 'csv';
    case DataSourceType.HUBSPOT:
      // HubSpot data often comes as JSON
      return 'json';
    default:
      // Try to detect from string value of dataSourceType itself
      if (typeof dataSourceType === 'string') {
        const lowerType = dataSourceType.toLowerCase();
        
        if (lowerType.includes('excel') || lowerType === 'xlsx' || lowerType === 'xls') {
          return 'excel';
        }
        if (lowerType === 'csv') {
          return 'csv';
        }
        if (lowerType === 'pdf') {
          return 'pdf';
        }
        if (lowerType === 'docx' || lowerType === 'doc') {
          return 'docx';
        }
        if (lowerType === 'json') {
          return 'json';
        }
      }
      // Default to text as last resort
      return 'text';
  }
}

/**
 * Manages data sources entities (CRUD, status) and initiates processing.
 */
@Injectable()
export class DataSourceManagementService {
  private logger = createServiceLogger('DataSourceManagementService');
  private prismaService: PrismaService | null = null;
  private documentPipeline: DocumentPipelineService | null = null;
  private qdrantCollectionService: QdrantCollectionService | null = null;

  // Add caching for data source queries
  private cache = new Map<string, { data: DataSource[], timestamp: number }>();
  private readonly CACHE_TTL = 10000; // 10 seconds cache TTL

  public constructor(
    @Optional() prisma: PrismaService,
    @Optional() documentPipelineService: DocumentPipelineService | null,
    @Optional() qdrantCollectionService: QdrantCollectionService | null,
  ) {
    this.prismaService = prisma;
    this.documentPipeline = documentPipelineService;
    this.qdrantCollectionService = qdrantCollectionService;
    
    this.logger.info('DataSourceManagementService initialized');
    if (!this.prismaService) {
      this.logger.warn('PrismaService is not provided - some features will be limited');
    }
    if (!this.documentPipeline) {
      this.logger.warn('DocumentPipelineService is not provided - document processing will not be available');
    }
    if (!this.qdrantCollectionService) {
      this.logger.warn('QdrantCollectionService is not provided - Qdrant collections management will not be available');
    }
  }

  /**
   * Helper to get PrismaService safely
   */
  private getPrismaService(): PrismaService {
    if (!this.prismaService) {
      throw new InternalServerErrorException('PrismaService is not available');
    }
    return this.prismaService;
  }
  
  /**
   * Convert Prisma data_sources record to DataSource interface
   */
  private mapPrismaToDataSource(prismaRecord: any): DataSource {
    return {
      id: prismaRecord.id,
      name: prismaRecord.name,
      type: prismaRecord.type,
      config: prismaRecord.config,
      status: prismaRecord.status,
      createdAt: prismaRecord.created_at,
      updatedAt: prismaRecord.updated_at,
      creatorId: prismaRecord.creator_id,
      workspaceId: prismaRecord.workspace_id
    };
  }

  /**
   * Find a data source by ID, ensuring it belongs to the user's organization.
   */
  async findByIdForUser(id: number, userId: number, organizationId: number): Promise<DataSource | null> {
    try {
      this.logger.info(`Fetching data source with ID: ${id} for user ${userId} in org ${organizationId}`);
      const dataSource = await this.getPrismaService().data_sources.findUnique({
        where: { 
          id: id, 
          workspace_id: organizationId
        }, 
      });
      if (!dataSource) {
        this.logger.warn(`Data source with ID ${id} not found for user ${userId} in org ${organizationId}`);
        return null;
      }
      if (dataSource.creator_id !== userId) {
         this.logger.warn(`User ${userId} does not have access to data source ${id}`);
         throw new NotFoundException(`Data source with ID ${id} not found or not accessible.`);
      }
      return this.mapPrismaToDataSource(dataSource);
    } catch (error) {
      this.logger.error(`Error fetching data source with ID ${id} for user ${userId} in org ${organizationId}:`, error);
      if (error instanceof NotFoundException) {
          throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve data source.');
    }
  }
  
  /**
   * Find all data sources for a given organization.
   */
  async findAllByOrgForUser(organizationId: number, userId: number): Promise<DataSource[]> {
    const cacheKey = `${organizationId}-${userId}`;
    const now = Date.now();
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      this.logger.debug(`Cache hit for org ${organizationId}, user ${userId}`);
      return cached.data;
    }

    this.logger.info(`Fetching all data sources for org ${organizationId} accessible by user ${userId}`);
    
    // Clear cache to ensure fresh data after the query fix
    this.cache.delete(cacheKey);
    
    const prisma = this.getPrismaService();
    const prismaRecords = await prisma.data_sources.findMany({
      where: {
        workspace_id: organizationId,
        // Removed creator_id filter - allow all data sources in the organization
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const result: DataSource[] = prismaRecords.map(this.mapPrismaToDataSource.bind(this));
    
    // Cache the results
    this.cache.set(cacheKey, { data: result, timestamp: now });
    
    this.logger.info(`Found ${result.length} data sources for org ${organizationId}`);
    return result;
  }
  
  /**
   * Update data source status, storing error in metadata if applicable.
   */
  // @ts-nocheck
  async updateStatus(
    id: number,
    organizationId: number,
    status: string | FileStatus,
    errorMessage?: string,
  ): Promise<void> {
    this.logger.info(`Updating status for data source ${id} to ${status}`);
    
    try {
      const statusString = typeof status === 'string' ? status : String(status);
      
      const updateData: any = {
        status: statusString,
        updated_at: new Date(),
      };
      
      if (errorMessage) {
        updateData.error = errorMessage;
      }
      
      await this.getPrismaService().data_sources.update({
        where: { id },
        data: updateData,
      });
      
      // Invalidate cache after status update
      this.invalidateCache(organizationId);
      
      this.logger.info(`Successfully updated status for data source ${id} to ${status}`);
    } catch (error) {
      this.logger.error(`Error updating status for data source ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Initiates the processing of an existing document/data source by triggering the document pipeline.
   * Updates the DataSource status to PROCESSING.
   *
   * @param dataSourceId - The ID of the DataSource record to process.
   * @param options - Optional processing parameters.
   * @param userId - The ID of the user initiating the processing (for authorization).
   * @returns A simple status indicating the process has started.
   */
  async processDocument(
    dataSourceId: number,
    userId: number,
    organizationId: number,
    options: {
      chunkSize?: number;
      chunkOverlap?: number;
      useSemanticChunking?: boolean;
    } = {}
  ): Promise<{ status: string; message: string }> {
    this.logger.info(`Initiating processing request for DataSource ID: ${dataSourceId} by user ${userId}`);

    try {
      // --- 1. Verify DataSource and Authorization ---
      const dataSource = await this.findByIdForUser(dataSourceId, userId, organizationId);
      if (!dataSource) {
        // findByIdForUser throws NotFoundException if not found/authorized
        // This check is slightly redundant but explicit
        throw new NotFoundException(`Data source with ID ${dataSourceId} not found or not accessible.`);
      }

      // --- 2. Get Required Info from DataSource ---
      // Removed access to non-existent metadata field
      // const metadata = dataSource.metadata as Record<string, any> | null;
      // const filePath = metadata?.filePath; // Cannot get filePath from here
      const originalFilename = dataSource.name; // Fallback to name
      
      // Add debug logging to understand the data structure
      this.logger.debug(`DataSource debug info for ID ${dataSourceId}:`, {
        name: dataSource.name,
        type: dataSource.type,
        config: dataSource.config,
        id: dataSource.id
      });
      
      const fileType = mapDataSourceTypeToFileType(dataSource.type as DataSourceType, dataSource);
      
      this.logger.debug(`Mapped file type: ${fileType} for DataSource ${dataSourceId}`);

      // Commenting out logic dependent on filePath from metadata
      /*
      if (!filePath) {
          this.logger.error(`File path is missing in metadata for DataSource ${dataSourceId}. Cannot process.`);
          // Update status to error?
          await this.updateStatus(dataSourceId, organizationId, 'error' as FileStatus, 'Missing file path for processing');
          throw new InternalServerErrorException('Missing file path information required for processing.');
      }
      */
      const filePath = 'temp/placeholder/path'; // TEMP: Placeholder path until file path logic is clarified
      this.logger.warn('Using placeholder file path for processing - Metadata logic needs update!');

      // --- 3. Update DataSource Status to PROCESSING ---
      this.logger.info(`Updating DataSource ${dataSourceId} status to PROCESSING.`);
      // Pass undefined instead of null, Use FileStatus enum member
      await this.updateStatus(dataSourceId, organizationId, FileStatus.PROCESSING, undefined);

      // --- 4. Trigger Background Processing via DocumentPipelineService ---
      this.logger.info(`Triggering document processing stream for DataSource ${dataSourceId} via DocumentPipelineService.`);
      
      if (!this.documentPipeline) {
        throw new InternalServerErrorException('Document pipeline service is not available');
      }
      
      const processingResult = await this.documentPipeline.processDocumentStream(
          filePath,           // Use path from DataSource
          fileType,           // Use type from DataSource
          dataSourceId.toString(), // collectionId
          { ...options, originalFilename } // Pass options and original name
      );

      this.logger.info(`DocumentPipelineService.processDocumentStream returned: ${JSON.stringify(processingResult)}`);

      // --- 5. Return Success ---
      return {
        status: 'processing_started',
        message: `Processing initiated for ${originalFilename}. Final status will be updated asynchronously.`
      };

    } catch (error) {
      this.logger.error(`Error initiating processing for DataSource ${dataSourceId}: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);

      // Attempt to update status to ERROR if initiation failed
      try {
        const failedDataSource = await this.getPrismaService().data_sources.findFirst({ where: { id: dataSourceId } });
        // Removed access to non-existent metadata
        // const failedMetadata = failedDataSource?.metadata || {}; 
        // Only update if it exists (check failedDataSource)
        if (failedDataSource) {
            // Use FileStatus enum member
            await this.updateStatus(dataSourceId, organizationId, FileStatus.FAILED, `Failed to initiate processing: ${error instanceof Error ? error.message : String(error)}`);
        }
      } catch (updateError) {
        this.logger.error(`Failed to update DataSource ${dataSourceId} status to ERROR after initiation failure: ${updateError instanceof Error ? updateError.message : String(updateError)}`);
      }

      // Re-throw the original error (or a wrapped one)
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
          throw error;
      }
      throw new InternalServerErrorException(`Failed to initiate processing for data source: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Checks if a file with the same name already exists for this organization
   */
  async checkForDuplicateFile(
    fileName: string,
    organizationId: number
  ): Promise<DataSource | null> {
    this.logger.info(`Checking for duplicate file: '${fileName}' in org ${organizationId}`);
    try {
      const existingDataSource = await this.getPrismaService().data_sources.findFirst({
        where: {
          workspace_id: organizationId,
          OR: [
            { name: { contains: fileName } },
            { name: { contains: fileName.split('(')[0].trim() } }, // Check base name without processing method
          ]
        },
        orderBy: {
          created_at: 'desc' // Get the most recent one
        }
      });

      if (existingDataSource) {
        this.logger.info(`Found duplicate file: '${existingDataSource.name}' (ID: ${existingDataSource.id})`);
        return this.mapPrismaToDataSource(existingDataSource);
      }

      return null;
    } catch (error) {
      this.logger.error(`Error checking for duplicate file '${fileName}':`, error);
      // Don't throw error here - just log it and proceed with creation
      return null;
    }
  }

  /**
   * Handles duplicate data source by cleaning up old Qdrant collection and updating existing
   */
  async handleDuplicateDataSource(
    existingDataSource: DataSource,
    organizationId: number,
    userId: number
  ): Promise<DataSource> {
    this.logger.info(`Handling duplicate data source: '${existingDataSource.name}' (ID: ${existingDataSource.id})`);
    
    try {
      // Clean up old Qdrant collection for the existing data source
      await this.cleanupDataSourceCollections(existingDataSource.id, organizationId);
      
      // Update the existing data source status to uploaded for reprocessing
      await this.updateStatus(
        existingDataSource.id,
        organizationId,
        FileStatus.UPLOADED // Reset to uploaded status for reprocessing
      );

      // Get the updated data source to return
      const updatedDataSource = await this.findByIdForUser(existingDataSource.id, userId, organizationId);
      
      if (!updatedDataSource) {
        throw new Error(`Data source ${existingDataSource.id} not found after update`);
      }

      this.logger.info(`Updated existing data source '${existingDataSource.name}' for reprocessing`);
      return updatedDataSource;
    } catch (error) {
      this.logger.error(`Error handling duplicate data source '${existingDataSource.name}':`, error);
      throw new InternalServerErrorException('Failed to handle duplicate data source.');
    }
  }

  /**
   * Clean up Qdrant collections for a data source
   */
  private async cleanupDataSourceCollections(dataSourceId: number, organizationId: number): Promise<void> {
    this.logger.info(`Cleaning up Qdrant collections for data source ${dataSourceId}`);
    
    try {
      // Get all collections from Qdrant
      const allCollections = await this.qdrantCollectionService.listCollections();
      
      // Find collections that match this data source (multiple naming patterns)
      const matchingCollections = allCollections.filter(collectionName => {
        const normalized = collectionName.toLowerCase();
        
        // Check various patterns that might include this data source ID
        return (
          normalized.includes(`_${dataSourceId}_`) ||
          normalized.includes(`data_source_${dataSourceId}`) ||
          normalized.includes(`ds_${dataSourceId}`) ||
          normalized.startsWith(`${dataSourceId}_`) ||
          normalized.endsWith(`_${dataSourceId}`)
        );
      });

      this.logger.info(`Found ${matchingCollections.length} collections to clean up for data source ${dataSourceId}`);
      
      // Delete each matching collection
      for (const collectionName of matchingCollections) {
        try {
          const deleted = await this.qdrantCollectionService.deleteCollection(collectionName);
          
          if (deleted) {
            this.logger.info(`Successfully deleted collection: ${collectionName}`);
          } else {
            this.logger.warn(`Failed to delete collection: ${collectionName}`);
          }
        } catch (collectionError) {
          this.logger.error(`Error deleting collection ${collectionName}: ${collectionError instanceof Error ? collectionError.message : String(collectionError)}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error cleaning up collections for data source ${dataSourceId}: ${error instanceof Error ? error.message : String(error)}`);
      // Don't throw here - we don't want cleanup failures to block the main operation
    }
  }

  /**
   * Creates a new data source for the given organization.
   * Now includes duplicate detection and handling.
   */
  async create(
    createDto: CreateDataSourceDto,
    userId: number,
    organizationId: number
  ): Promise<DataSource> {
    this.logger.info(`Creating data source '${createDto.name}' for org ${organizationId} by user ${userId}`);
    
    try {
      // Check for duplicates before creating
      const existingDataSource = await this.checkForDuplicateFile(createDto.name, organizationId);
      
      if (existingDataSource) {
        this.logger.info(`Duplicate file detected. Updating existing data source instead of creating new one.`);
        return await this.handleDuplicateDataSource(existingDataSource, organizationId, userId);
      }

      // No duplicate found, proceed with normal creation
      const newDataSource = await this.getPrismaService().data_sources.create({
        data: {
          name: createDto.name,
          type: createDto.type, // Use type from DTO directly
          config: createDto.config, // Use config from DTO
          workspace_id: organizationId, // Corrected: workspace_id (assuming orgId maps to workspace_id)
          creator_id: userId,
          status: FileStatus.UPLOADED, // Use FileStatus enum, ignore DTO status on create
          updated_at: new Date() // Add required updated_at field
          // Removed non-existent fields like description, metadata
        },
      });
      this.logger.info(`Data source '${newDataSource.name}' created successfully with ID: ${newDataSource.id}`);
      return this.mapPrismaToDataSource(newDataSource);
    } catch (error) {
      this.logger.error(`Error creating data source '${createDto.name}':`, error);
      throw new InternalServerErrorException('Failed to create data source.');
    }
  }

  /**
   * Updates an existing data source.
   */
  async update(
    id: number,
    updateDto: UpdateDataSourceDto,
    userId: number,
    organizationId: number
  ): Promise<DataSource> {
    this.logger.info(`Updating data source ${id} for user ${userId} in org ${organizationId}`);
    
    try {
      // Fetch the existing data source to avoid overwriting fields unintentionally
      const existingDataSource = await this.getPrismaService().data_sources.findUnique({ 
          where: { id },
          // select: { name: true, config: true } // Optional: Select only needed fields
      });
      
      if (!existingDataSource) {
          throw new NotFoundException(`Data source with ID ${id} not found.`);
      }

      // Only allow updating select fields via UpdateDataSourceDto
      const allowedFields: Record<string, any> = {};
      if (updateDto.name !== undefined) allowedFields.name = updateDto.name;
      if (updateDto.config !== undefined) allowedFields.config = updateDto.config;
      // Add other allowed fields from DTO
      
      // Update allowed fields, ensuring only valid ones are included
      const updatedDataSource = await this.getPrismaService().data_sources.update({
        where: { id },
        data: {
          ...allowedFields,
          updated_at: new Date() // Ensure updated_at is always set
        },
      });
      
      // Invalidate cache after update
      this.invalidateCache(organizationId);
      
      this.logger.info(`Data source ${id} updated successfully.`);
      return this.mapPrismaToDataSource(updatedDataSource);
    } catch (error) {
      this.logger.error(`Error updating data source ${id}:`, error);
      if (error instanceof NotFoundException) {
          throw error;
      }
      throw new InternalServerErrorException('Failed to update data source.');
    }
  }

  /**
   * Deletes a data source if found and authorized for the user/org.
   */
  async delete(id: number, userId: number, organizationId: number): Promise<void> {
    this.logger.info(`Starting comprehensive deletion of data source ${id} by user ${userId} in org ${organizationId}`);
    
    const prisma = this.getPrismaService();
    let dataSourceName = 'unknown';
    let cleanupErrors: string[] = [];

    try {
      // 1. Verify data source exists and get details
      const dataSource = await prisma.data_sources.findFirst({
        where: {
          id,
          workspace_id: organizationId,
        }
      });

      if (!dataSource) {
        this.logger.warn(`Data source ${id} not found for deletion`);
        throw new Error(`Data source not found or access denied`);
      }

      dataSourceName = dataSource.name;
      this.logger.info(`Found data source "${dataSourceName}" (ID: ${id}) for deletion`);

      // 2. Start comprehensive cleanup in transaction
      await prisma.$transaction(async (tx) => {
        // Delete processing jobs first
        const deletedJobs = await tx.processing_jobs.deleteMany({
          where: { data_source_id: id }
        });
        this.logger.info(`Deleted ${deletedJobs.count} processing jobs`);

        // Delete document chunks (with cascade to related tables)
        const deletedChunks = await tx.document_chunks.deleteMany({
          where: { data_source_id: id }
        });
        this.logger.info(`Deleted ${deletedChunks.count} document chunks`);

        // Search for related files with multiple patterns
        const filePatterns = [
          dataSource.name,
          dataSource.name.replace(/\.[^/.]+$/, ""), // without extension
          `${id}_${dataSource.name}`,
          `datasource_${id}`,
          `file_${id}`,
        ];

        for (const pattern of filePatterns) {
          try {
            const relatedFiles = await tx.files.deleteMany({
              where: {
                OR: [
                  { filename: { contains: pattern } },
                  { original_filename: { contains: pattern } },
                ]
              }
            });
            if (relatedFiles.count > 0) {
              this.logger.info(`Deleted ${relatedFiles.count} files matching pattern "${pattern}"`);
            }
          } catch (error) {
            this.logger.warn(`Error deleting files with pattern "${pattern}": ${error.message}`);
            cleanupErrors.push(`Files cleanup (${pattern}): ${error.message}`);
          }
        }

        // Delete the data source itself
        await tx.data_sources.delete({
          where: { id }
        });
        this.logger.info(`Deleted data source "${dataSourceName}" from database`);
      });

      // 3. Clean up Qdrant collections (outside transaction as it's external)
      await this.comprehensiveQdrantCleanup(id, organizationId, dataSourceName);

      // 4. Invalidate all related caches
      this.invalidateCache(organizationId);
      this.invalidateCacheForUser(organizationId, userId);

      // 5. Log any non-critical cleanup errors
      if (cleanupErrors.length > 0) {
        this.logger.warn(`Data source ${id} deleted successfully, but with some cleanup warnings:`, cleanupErrors);
      } else {
        this.logger.info(`Data source ${id} ("${dataSourceName}") completely deleted with no issues`);
      }

    } catch (error) {
      this.logger.error(`Failed to delete data source ${id} ("${dataSourceName}"):`, error);
      
      // Try emergency cleanup if main deletion failed
      if (error.message?.includes('transaction')) {
        this.logger.warn(`Transaction failed, attempting emergency Qdrant cleanup for data source ${id}`);
        try {
          await this.comprehensiveQdrantCleanup(id, organizationId, dataSourceName);
        } catch (cleanupError) {
          this.logger.error(`Emergency Qdrant cleanup also failed:`, cleanupError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Comprehensive Qdrant collection cleanup with multiple fallback strategies
   */
  private async comprehensiveQdrantCleanup(dataSourceId: number, organizationId: number, dataSourceName: string): Promise<void> {
    this.logger.info(`Starting comprehensive Qdrant cleanup for data source ${dataSourceId}`);

    if (!this.qdrantCollectionService) {
      this.logger.warn('QdrantCollectionService not available for cleanup');
      return;
    }

    // Generate all possible collection names
    const possibleCollectionNames = [
      `row_data_${dataSourceId}_${dataSourceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      `row_data_${dataSourceId}_${dataSourceName.replace(/[^a-zA-Z0-9]/g, '_')}`,
      `org_${organizationId}_datasource_${dataSourceId}`,
      `datasource_${dataSourceId}`,
      `file_${dataSourceId}`,
      `collection_${dataSourceId}`,
    ];

    // Add variations with common suffixes
    const variations = [...possibleCollectionNames];
    possibleCollectionNames.forEach(name => {
      variations.push(`${name}_collection`);
      variations.push(`${name}_vectors`);
      variations.push(`${name}_embeddings`);
    });

    let deletedCollections = 0;
    const cleanupErrors: string[] = [];

    // Try to delete each possible collection
    for (const collectionName of variations) {
      try {
        const exists = await this.qdrantCollectionService.collectionExists(collectionName);
        if (exists) {
          await this.qdrantCollectionService.deleteCollection(collectionName);
          this.logger.info(`Successfully deleted Qdrant collection: ${collectionName}`);
          deletedCollections++;
        }
      } catch (error) {
        const errorMsg = `Failed to delete collection "${collectionName}": ${error.message}`;
        this.logger.warn(errorMsg);
        cleanupErrors.push(errorMsg);
      }
    }

    // Also check filesystem for orphaned collections
    try {
      await this.cleanupOrphanedQdrantFiles(dataSourceId);
    } catch (error) {
      cleanupErrors.push(`Filesystem cleanup: ${error.message}`);
    }

    this.logger.info(`Qdrant cleanup completed. Deleted ${deletedCollections} collections. ${cleanupErrors.length} errors.`);
    
    if (cleanupErrors.length > 0) {
      this.logger.warn('Qdrant cleanup errors:', cleanupErrors);
    }
  }

  /**
   * Clean up orphaned Qdrant files from filesystem
   */
  private async cleanupOrphanedQdrantFiles(dataSourceId: number): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const qdrantPath = path.join(process.cwd(), '..', 'qdrant_data', 'collections');
      
      if (!await fs.access(qdrantPath).then(() => true).catch(() => false)) {
        return; // Qdrant directory doesn't exist
      }

      const collections = await fs.readdir(qdrantPath);
      const targetPattern = new RegExp(`row_data_${dataSourceId}_`);
      
      for (const collection of collections) {
        if (targetPattern.test(collection)) {
          const collectionPath = path.join(qdrantPath, collection);
          try {
            await fs.rm(collectionPath, { recursive: true, force: true });
            this.logger.info(`Cleaned up orphaned Qdrant collection directory: ${collection}`);
          } catch (error) {
            this.logger.warn(`Could not remove Qdrant directory ${collection}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Error during Qdrant filesystem cleanup: ${error.message}`);
    }
  }

  // Cache invalidation methods
  private invalidateCache(organizationId: number): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${organizationId}-`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
    this.logger.debug(`Invalidated cache for org ${organizationId} (${keysToDelete.length} entries)`);
  }

  private invalidateCacheForUser(organizationId: number, userId: number): void {
    const cacheKey = `${organizationId}-${userId}`;
    this.cache.delete(cacheKey);
    this.logger.debug(`Invalidated cache for org ${organizationId}, user ${userId}`);
  }
} 