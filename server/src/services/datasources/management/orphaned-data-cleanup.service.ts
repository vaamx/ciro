import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../core/database/prisma.service';
import { QdrantCollectionService } from '../../vector/collection-manager.service';
import { createServiceLogger } from '../../../common/utils/logger-factory';
import * as fs from 'fs/promises';
import * as path from 'path';

interface OrphanedDataReport {
  orphanedDataSources: Array<{
    id: number;
    name: string;
    hasChunks: boolean;
    hasCollections: boolean;
  }>;
  orphanedCollections: Array<{
    name: string;
    dataSourceId: number | null;
    exists: boolean;
  }>;
  inconsistentStates: Array<{
    dataSourceId: number;
    name: string;
    issue: string;
  }>;
}

@Injectable()
export class OrphanedDataCleanupService {
  private readonly logger = createServiceLogger('OrphanedDataCleanupService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly qdrantService: QdrantCollectionService,
  ) {}

  /**
   * Run orphaned data cleanup every 6 hours
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async performScheduledCleanup(): Promise<void> {
    this.logger.info('Starting scheduled orphaned data cleanup...');
    
    try {
      const report = await this.detectOrphanedData();
      
      if (this.hasOrphanedData(report)) {
        this.logger.warn('Found orphaned data:', report);
        await this.cleanupOrphanedData(report);
      } else {
        this.logger.info('No orphaned data found during scheduled cleanup');
      }
    } catch (error) {
      this.logger.error('Error during scheduled cleanup:', error);
    }
  }

  /**
   * Manual cleanup trigger (can be called via API endpoint)
   */
  async performManualCleanup(): Promise<OrphanedDataReport> {
    this.logger.info('Starting manual orphaned data cleanup...');
    
    const report = await this.detectOrphanedData();
    
    if (this.hasOrphanedData(report)) {
      await this.cleanupOrphanedData(report);
    }
    
    return report;
  }

  /**
   * Detect all types of orphaned data
   */
  async detectOrphanedData(): Promise<OrphanedDataReport> {
    this.logger.info('Detecting orphaned data...');

    const report: OrphanedDataReport = {
      orphanedDataSources: [],
      orphanedCollections: [],
      inconsistentStates: [],
    };

    try {
      // 1. Check for data sources with no chunks
      const dataSources = await this.prisma.data_sources.findMany({
        include: {
          _count: {
            select: {
              document_chunks: true,
              processing_jobs: true,
            }
          }
        }
      });

      // 2. Check Qdrant collections
      const collections = await this.getQdrantCollections();

      // 3. Cross-reference and identify issues
      for (const dataSource of dataSources) {
        const hasChunks = dataSource._count.document_chunks > 0;
        const relatedCollections = collections.filter(col => 
          col.name.includes(`row_data_${dataSource.id}_`)
        );
        const hasCollections = relatedCollections.length > 0;

        // Flag inconsistent states
        if (dataSource.status === 'ready' && !hasChunks && !hasCollections) {
          report.inconsistentStates.push({
            dataSourceId: dataSource.id,
            name: dataSource.name,
            issue: 'Status is "ready" but has no chunks or collections'
          });
        }

        if (hasCollections && !hasChunks) {
          report.inconsistentStates.push({
            dataSourceId: dataSource.id,
            name: dataSource.name,
            issue: 'Has vector collections but no database chunks'
          });
        }

        // Flag potential orphans
        if (!hasChunks || !hasCollections) {
          report.orphanedDataSources.push({
            id: dataSource.id,
            name: dataSource.name,
            hasChunks,
            hasCollections,
          });
        }
      }

      // 4. Check for orphaned collections (collections without matching data sources)
      for (const collection of collections) {
        const match = collection.name.match(/row_data_(\d+)_/);
        if (match) {
          const dataSourceId = parseInt(match[1]);
          const dataSourceExists = dataSources.some(ds => ds.id === dataSourceId);
          
          if (!dataSourceExists) {
            report.orphanedCollections.push({
              name: collection.name,
              dataSourceId,
              exists: false,
            });
          }
        } else {
          // Collection doesn't follow expected naming pattern
          report.orphanedCollections.push({
            name: collection.name,
            dataSourceId: null,
            exists: false,
          });
        }
      }

      this.logger.info(`Orphaned data detection complete. Found ${report.orphanedDataSources.length} orphaned data sources, ${report.orphanedCollections.length} orphaned collections, ${report.inconsistentStates.length} inconsistent states`);

    } catch (error) {
      this.logger.error('Error during orphaned data detection:', error);
      throw error;
    }

    return report;
  }

  /**
   * Clean up identified orphaned data
   */
  private async cleanupOrphanedData(report: OrphanedDataReport): Promise<void> {
    this.logger.info('Starting orphaned data cleanup...');

    let cleanedDataSources = 0;
    let cleanedCollections = 0;

    // 1. Clean up orphaned collections first (safer)
    for (const orphanedCollection of report.orphanedCollections) {
      try {
        // Check if collection still exists in Qdrant
        const exists = await this.qdrantService.collectionExists(orphanedCollection.name);
        if (exists) {
          await this.qdrantService.deleteCollection(orphanedCollection.name);
          this.logger.info(`Cleaned up orphaned Qdrant collection: ${orphanedCollection.name}`);
          cleanedCollections++;
        }

        // Also clean up filesystem
        await this.cleanupQdrantFilesystem(orphanedCollection.name);
        
      } catch (error) {
        this.logger.error(`Failed to cleanup orphaned collection ${orphanedCollection.name}:`, error);
      }
    }

    // 2. Clean up inconsistent data sources (be more careful here)
    for (const inconsistentState of report.inconsistentStates) {
      try {
        // Only auto-cleanup clearly broken states
        if (inconsistentState.issue.includes('no chunks or collections')) {
          this.logger.warn(`Auto-cleaning inconsistent data source ${inconsistentState.dataSourceId}: ${inconsistentState.issue}`);
          
          await this.prisma.$transaction(async (tx) => {
            // Clean up any remaining related data
            await tx.processing_jobs.deleteMany({
              where: { data_source_id: inconsistentState.dataSourceId }
            });
            
            await tx.data_sources.delete({
              where: { id: inconsistentState.dataSourceId }
            });
          });
          
          cleanedDataSources++;
          this.logger.info(`Successfully cleaned up data source ${inconsistentState.dataSourceId}`);
        } else {
          this.logger.warn(`Inconsistent state detected but not auto-cleaning: ${inconsistentState.dataSourceId} - ${inconsistentState.issue}`);
        }
        
      } catch (error) {
        this.logger.error(`Failed to cleanup inconsistent data source ${inconsistentState.dataSourceId}:`, error);
      }
    }

    this.logger.info(`Orphaned data cleanup complete. Cleaned ${cleanedDataSources} data sources and ${cleanedCollections} collections`);
  }

  /**
   * Get list of Qdrant collections
   */
  private async getQdrantCollections(): Promise<Array<{ name: string }>> {
    try {
      const qdrantPath = path.join(process.cwd(), '..', 'qdrant_data', 'collections');
      
      const exists = await fs.access(qdrantPath).then(() => true).catch(() => false);
      if (!exists) {
        return [];
      }

      const collections = await fs.readdir(qdrantPath, { withFileTypes: true });
      return collections
        .filter(dirent => dirent.isDirectory())
        .map(dirent => ({ name: dirent.name }));
        
    } catch (error) {
      this.logger.error('Error reading Qdrant collections:', error);
      return [];
    }
  }

  /**
   * Clean up Qdrant collection from filesystem
   */
  private async cleanupQdrantFilesystem(collectionName: string): Promise<void> {
    try {
      const qdrantPath = path.join(process.cwd(), '..', 'qdrant_data', 'collections', collectionName);
      
      const exists = await fs.access(qdrantPath).then(() => true).catch(() => false);
      if (exists) {
        await fs.rm(qdrantPath, { recursive: true, force: true });
        this.logger.info(`Cleaned up Qdrant filesystem for collection: ${collectionName}`);
      }
    } catch (error) {
      this.logger.warn(`Could not clean up Qdrant filesystem for ${collectionName}:`, error.message);
    }
  }

  /**
   * Check if report contains any orphaned data
   */
  private hasOrphanedData(report: OrphanedDataReport): boolean {
    return (
      report.orphanedDataSources.length > 0 ||
      report.orphanedCollections.length > 0 ||
      report.inconsistentStates.length > 0
    );
  }

  /**
   * Get current status of the system
   */
  async getSystemHealthStatus(): Promise<{
    totalDataSources: number;
    totalCollections: number;
    healthyDataSources: number;
    orphanedData: OrphanedDataReport;
  }> {
    const dataSources = await this.prisma.data_sources.count();
    const collections = await this.getQdrantCollections();
    const orphanedData = await this.detectOrphanedData();
    
    const healthyDataSources = dataSources - orphanedData.orphanedDataSources.length;

    return {
      totalDataSources: dataSources,
      totalCollections: collections.length,
      healthyDataSources,
      orphanedData,
    };
  }
} 