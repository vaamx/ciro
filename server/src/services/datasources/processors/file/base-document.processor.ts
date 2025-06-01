import * as winston from 'winston';
// REMOVED: import { QdrantClientService } from '../../vector/qdrant-client.service';
// REMOVED: import { db } from '../../../config/database';
import fs from 'fs';
import path from 'path';
import { Injectable } from '@nestjs/common';
// import { DataSourceService } from '../data-source.service'; // TODO: Refactor/Relocate DataSourceService
import { SocketService } from '../../../util/socket.service'; // Updated path
import { DataSourceProcessingStatus } from '../../../../types'; // Updated path
// REMOVED: import { EventManager } from '../../util/event-manager';

// Define DataSourceStatus enum - Changed from type
export enum DataSourceStatus {
  CONNECTED = 'connected',
  PROCESSING = 'processing',
  ERROR = 'error',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed', // Keep existing values
  READY = 'ready',   // Keep existing values
  COMPLETED = 'completed', // Keep existing values
  PENDING = 'pending' // Added PENDING status used in excel processor
}

/**
 * Result of document processing
 */
export interface ProcessingResult {
  status: 'success' | 'error' | 'partial_success' | 'processing';
  chunks: number;
  message?: string;
  metadata?: Record<string, any>;
  elements?: any[];
  rawElements?: any[];
}

// REMOVED: QdrantAdapter class definition
/*
class QdrantAdapter {
  // ... entire class implementation ...
}
*/

/**
 * Base class for all document processors
 * Provides common functionality and defines the interface for document processors
 */
@Injectable()
export abstract class BaseDocumentProcessor {
  protected logger: winston.Logger;
  public processorName: string;

  // Added injected services
  // protected readonly dataSourceService: DataSourceService; // TODO: Reinstate when DataSourceService is refactored
  protected readonly socketService: SocketService;

  // Constructor updated - takes injected services
  constructor(
    serviceName: string,
    // dataSourceService: DataSourceService, // TODO: Reinstate
    socketService: SocketService
  ) {
    this.processorName = serviceName;
    // this.dataSourceService = dataSourceService; // TODO: Reinstate
    this.socketService = socketService;
    // Initialize the logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => {
          const { timestamp, level, message, ...rest } = info;
          const formattedMessage = `${timestamp} [${level.toUpperCase()}] [${serviceName}]: ${message}`;
          return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
        })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf((info) => {
              const { timestamp, level, message, ...rest } = info;
              const formattedMessage = `${timestamp} [${level.toUpperCase()}] [${serviceName}]: ${message}`;
              return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
            })
          )
        })
      ]
    });
    
    // REMOVED QdrantAdapter instantiation
    // const qdrantClientService = this.qdrantClientService; // Invalid
    // this.qdrantService = new QdrantAdapter(qdrantClientService); // Invalid
    
    this.logger.info(`Initializing ${serviceName}`);
  }

  /**
   * Process a file
   * This is the main method that all document processors must implement
   */
  abstract processFile(
    filePath: string,
    dataSourceId: number,
    organizationId: number,
    userId: string,
    metadata: Record<string, any>
  ): Promise<ProcessingResult>;

  // REMOVED ensureCollectionExists
  /*
  protected async ensureCollectionExists(collectionName: string): Promise<void> {
     // ... (previous implementation)
  }
  */

  // Re-added updateDataSourceStatus using injected services
  protected async updateStatus(
    dataSourceId: number,
    organizationId: number,
    status: DataSourceProcessingStatus,
    metrics?: Record<string, any>,
    error?: string
  ): Promise<void> {
    try {
      // Convert DataSourceProcessingStatus to a status string for the database
      let statusString: string;
      switch (status) {
        case DataSourceProcessingStatus.PROCESSING:
          statusString = 'processing';
          break;
        case DataSourceProcessingStatus.COMPLETED:
          statusString = 'ready'; // Set to 'ready' when completed
          break;
        case DataSourceProcessingStatus.ERROR:
          statusString = 'error';
          break;
        default:
          statusString = status.toString();
      }
      
      this.logger.info(`Status updated for data source ${dataSourceId} to ${statusString}`);
      
      // Emit event via SocketService to the specific organization room
      const room = `org_${organizationId}`;
      this.socketService.getIO().to(room).emit(
        'dataSourceUpdate', 
        { 
          id: dataSourceId, 
          status: statusString, 
          metrics, 
          error,
          timestamp: new Date().toISOString()
        }
      );

      // Also emit a general status update for immediate UI feedback
      this.socketService.getIO().to(room).emit(
        'processingUpdate',
        {
          dataSourceId,
          status: statusString,
          progress: metrics?.step === 'completed' ? 100 : undefined,
          message: this.getStatusMessage(status, metrics),
          metadata: metrics
        }
      );
      
    } catch (err) {
      this.logger.error(`Error in updateStatus for data source ${dataSourceId}: ${err instanceof Error ? err.message : String(err)}`);
      // Avoid throwing error from status update itself
    }
  }

  /**
   * Get a user-friendly status message
   */
  private getStatusMessage(status: DataSourceProcessingStatus, metrics?: Record<string, any>): string {
    switch (status) {
      case DataSourceProcessingStatus.PROCESSING:
        if (metrics?.rowsProcessed && metrics?.chunksCreated) {
          return `Processing... ${metrics.rowsProcessed} rows processed, ${metrics.chunksCreated} chunks created`;
        }
        return 'Processing document...';
      case DataSourceProcessingStatus.COMPLETED:
        if (metrics?.totalRows && metrics?.totalChunks) {
          return `Processing completed: ${metrics.totalRows} rows processed into ${metrics.totalChunks} chunks`;
        }
        return 'Processing completed successfully';
      case DataSourceProcessingStatus.ERROR:
        return 'Processing failed';
      default:
        return status.toString();
    }
  }

  /**
   * Validate the file exists and is accessible
   */
  protected validateFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }
    
    if (stats.size === 0) {
      throw new Error(`File is empty: ${filePath}`);
    }
  }
  
  // REMOVED normalizeCollectionNameWithNumericId
  /*
  protected async normalizeCollectionNameWithNumericId(...) {
    // ... (previous implementation)
  }
  */
}