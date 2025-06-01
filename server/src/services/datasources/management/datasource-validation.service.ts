import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { QdrantCollectionService } from '../../vector/collection-manager.service';
import { createServiceLogger } from '../../../common/utils/logger-factory';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

@Injectable()
export class DataSourceValidationService {
  private readonly logger = createServiceLogger('DataSourceValidationService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly qdrantService: QdrantCollectionService,
  ) {}

  /**
   * Validate data source before processing
   */
  async validateBeforeProcessing(dataSourceId: number): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    try {
      // 1. Check if data source exists
      const dataSource = await this.prisma.data_sources.findUnique({
        where: { id: dataSourceId },
        include: {
          _count: {
            select: {
              document_chunks: true,
              processing_jobs: true,
            }
          }
        }
      });

      if (!dataSource) {
        result.isValid = false;
        result.errors.push(`Data source ${dataSourceId} does not exist`);
        return result;
      }

      // 2. Check for existing processing jobs
      if (dataSource._count.processing_jobs > 0) {
        const activeJobs = await this.prisma.processing_jobs.findMany({
          where: {
            data_source_id: dataSourceId,
            status: { in: ['pending', 'processing', 'in_progress'] }
          }
        });

        if (activeJobs.length > 0) {
          result.isValid = false;
          result.errors.push(`Data source ${dataSourceId} has ${activeJobs.length} active processing jobs`);
        }
      }

      // 3. Check for existing chunks (potential reprocessing)
      if (dataSource._count.document_chunks > 0) {
        result.warnings.push(`Data source ${dataSourceId} already has ${dataSource._count.document_chunks} chunks. Reprocessing will replace them.`);
        result.suggestions.push('Consider backing up existing data before reprocessing');
      }

      // 4. Check Qdrant collections
      const possibleCollectionNames = this.generatePossibleCollectionNames(dataSourceId, dataSource.name);
      for (const collectionName of possibleCollectionNames) {
        try {
          const exists = await this.qdrantService.collectionExists(collectionName);
          if (exists) {
            result.warnings.push(`Qdrant collection '${collectionName}' already exists`);
            result.suggestions.push(`Consider cleaning up existing collection: ${collectionName}`);
          }
        } catch (error) {
          result.warnings.push(`Could not check Qdrant collection '${collectionName}': ${error.message}`);
        }
      }

      this.logger.info(`Pre-processing validation for data source ${dataSourceId}: ${result.isValid ? 'PASSED' : 'FAILED'}`);

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
      this.logger.error(`Error during pre-processing validation for data source ${dataSourceId}:`, error);
    }

    return result;
  }

  /**
   * Validate data source after processing
   */
  async validateAfterProcessing(dataSourceId: number): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    try {
      // 1. Check if data source still exists
      const dataSource = await this.prisma.data_sources.findUnique({
        where: { id: dataSourceId },
        include: {
          _count: {
            select: {
              document_chunks: true,
              processing_jobs: true,
            }
          }
        }
      });

      if (!dataSource) {
        result.isValid = false;
        result.errors.push(`Data source ${dataSourceId} was deleted during processing`);
        return result;
      }

      // 2. Check if chunks were created
      if (dataSource._count.document_chunks === 0) {
        result.isValid = false;
        result.errors.push(`No document chunks were created for data source ${dataSourceId}`);
        result.suggestions.push('Check if the file was empty or contained no processable data');
      }

      // 3. Check if processing jobs are properly cleaned up
      const activeJobs = await this.prisma.processing_jobs.findMany({
        where: {
          data_source_id: dataSourceId,
          status: { in: ['pending', 'processing', 'in_progress'] }
        }
      });

      if (activeJobs.length > 0) {
        result.warnings.push(`${activeJobs.length} processing jobs are still active after processing completion`);
        result.suggestions.push('Clean up orphaned processing jobs');
      }

      // 4. Check Qdrant collections consistency
      const possibleCollectionNames = this.generatePossibleCollectionNames(dataSourceId, dataSource.name);
      let foundCollections = 0;

      for (const collectionName of possibleCollectionNames) {
        try {
          const exists = await this.qdrantService.collectionExists(collectionName);
          if (exists) {
            foundCollections++;
          }
        } catch (error) {
          result.warnings.push(`Could not verify Qdrant collection '${collectionName}': ${error.message}`);
        }
      }

      // 5. Check for consistency between database and Qdrant
      if (dataSource._count.document_chunks > 0 && foundCollections === 0) {
        result.isValid = false;
        result.errors.push(`Data source ${dataSourceId} has database chunks but no Qdrant collections`);
        result.suggestions.push('Reprocess the data source to recreate vector embeddings');
      }

      if (dataSource._count.document_chunks === 0 && foundCollections > 0) {
        result.warnings.push(`Data source ${dataSourceId} has Qdrant collections but no database chunks`);
        result.suggestions.push('Clean up orphaned Qdrant collections');
      }

      // 6. Check status consistency
      if (dataSource.status === 'ready' && dataSource._count.document_chunks === 0) {
        result.isValid = false;
        result.errors.push(`Data source ${dataSourceId} status is 'ready' but has no chunks`);
        result.suggestions.push('Update status to reflect actual processing state');
      }

      this.logger.info(`Post-processing validation for data source ${dataSourceId}: ${result.isValid ? 'PASSED' : 'FAILED'}`);

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
      this.logger.error(`Error during post-processing validation for data source ${dataSourceId}:`, error);
    }

    return result;
  }

  /**
   * Validate data source before deletion
   */
  async validateBeforeDeletion(dataSourceId: number): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    try {
      // 1. Check if data source exists
      const dataSource = await this.prisma.data_sources.findUnique({
        where: { id: dataSourceId },
        include: {
          _count: {
            select: {
              document_chunks: true,
              processing_jobs: true,
            }
          }
        }
      });

      if (!dataSource) {
        result.warnings.push(`Data source ${dataSourceId} does not exist (already deleted?)`);
        return result;
      }

      // 2. Check for active processing
      const activeJobs = await this.prisma.processing_jobs.findMany({
        where: {
          data_source_id: dataSourceId,
          status: { in: ['pending', 'processing', 'in_progress'] }
        }
      });

      if (activeJobs.length > 0) {
        result.isValid = false;
        result.errors.push(`Cannot delete data source ${dataSourceId}: ${activeJobs.length} active processing jobs`);
        result.suggestions.push('Wait for processing to complete or cancel active jobs before deletion');
      }

      // 3. Check data to be deleted
      if (dataSource._count.document_chunks > 0) {
        result.warnings.push(`Deleting data source ${dataSourceId} will remove ${dataSource._count.document_chunks} document chunks`);
      }

      if (dataSource._count.processing_jobs > 0) {
        result.warnings.push(`Deleting data source ${dataSourceId} will remove ${dataSource._count.processing_jobs} processing jobs`);
      }

      // 4. Check for related Qdrant collections
      const possibleCollectionNames = this.generatePossibleCollectionNames(dataSourceId, dataSource.name);
      for (const collectionName of possibleCollectionNames) {
        try {
          const exists = await this.qdrantService.collectionExists(collectionName);
          if (exists) {
            result.warnings.push(`Qdrant collection '${collectionName}' will be deleted`);
          }
        } catch (error) {
          result.warnings.push(`Could not check Qdrant collection '${collectionName}': ${error.message}`);
        }
      }

      this.logger.info(`Pre-deletion validation for data source ${dataSourceId}: ${result.isValid ? 'PASSED' : 'FAILED'}`);

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
      this.logger.error(`Error during pre-deletion validation for data source ${dataSourceId}:`, error);
    }

    return result;
  }

  /**
   * Generate possible collection names for a data source
   */
  private generatePossibleCollectionNames(dataSourceId: number, dataSourceName: string): string[] {
    const safeName = dataSourceName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    return [
      `row_data_${dataSourceId}_${safeName}`,
      `datasource_${dataSourceId}`,
      `org_data_${dataSourceId}`,
      `collection_${dataSourceId}`,
      `file_${dataSourceId}`,
    ];
  }

  /**
   * Auto-fix common validation issues
   */
  async autoFixValidationIssues(dataSourceId: number): Promise<{ fixed: string[], failed: string[] }> {
    const fixed: string[] = [];
    const failed: string[] = [];

    try {
      // 1. Clean up orphaned processing jobs
      const orphanedJobs = await this.prisma.processing_jobs.findMany({
        where: {
          data_source_id: dataSourceId,
          OR: [
            { status: 'pending', created_at: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // Older than 24h
            { status: 'processing', updated_at: { lt: new Date(Date.now() - 4 * 60 * 60 * 1000) } }, // No update in 4h
          ]
        }
      });

      if (orphanedJobs.length > 0) {
        await this.prisma.processing_jobs.deleteMany({
          where: { id: { in: orphanedJobs.map(job => job.id) } }
        });
        fixed.push(`Cleaned up ${orphanedJobs.length} orphaned processing jobs`);
      }

      // 2. Fix status inconsistencies
      const dataSource = await this.prisma.data_sources.findUnique({
        where: { id: dataSourceId },
        include: { _count: { select: { document_chunks: true } } }
      });

      if (dataSource) {
        if (dataSource.status === 'ready' && dataSource._count.document_chunks === 0) {
          await this.prisma.data_sources.update({
            where: { id: dataSourceId },
            data: { status: 'failed' }
          });
          fixed.push('Updated status from "ready" to "failed" for data source with no chunks');
        }
      }

    } catch (error) {
      failed.push(`Auto-fix error: ${error.message}`);
      this.logger.error(`Error during auto-fix for data source ${dataSourceId}:`, error);
    }

    return { fixed, failed };
  }
} 