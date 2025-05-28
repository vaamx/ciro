// @ts-nocheck - TODO: This file needs major refactoring to work with the updated service architecture

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { QdrantClientService } from '../vector/qdrant-client.service';
import { DocumentProcessorService } from '../data-processing/document-processor.service';
import * as config from '../../config';
import { db } from '../../config/database';
import { createServiceLogger } from '../../common/utils/logger-factory';


@Injectable()
export class StartupService implements OnModuleInit {
  private readonly logger = new Logger(StartupService.name);
  private qdrantService: QdrantClientService;
  private documentProcessor: DocumentProcessorService;

  constructor(private readonly documentProcessorService: DocumentProcessorService, private readonly qdrantClientService: QdrantClientService) {
    this.qdrantService = this.qdrantClientService;
    this.documentProcessor = this.documentProcessorService;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing application...');

    // Ensure upload directory exists
    this.ensureUploadDirectoryExists();

    // Check Qdrant connection
    await this.checkQdrantConnection();

    this.logger.log('Application initialized successfully');
  }

  /**
   * Ensure the upload directory exists
   */
  private ensureUploadDirectoryExists(): void {
    const uploadDir = (config as any).uploadsDir || 'uploads';
    
    if (!fs.existsSync(uploadDir)) {
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
        this.logger.log(`Created uploads directory: ${uploadDir}`);
      } catch (error) {
        this.logger.error(`Failed to create uploads directory: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Check if Qdrant is available
   */
  private async checkQdrantConnection(): Promise<void> {
    try {
      const client = this.qdrantService.getClient();
      const collections = await client.getCollections();
      
      this.logger.log(`Successfully connected to Qdrant. Found ${collections.collections.length} collections.`);
    } catch (error) {
      this.logger.warn(`Failed to connect to Qdrant: ${error instanceof Error ? error.message : String(error)}`);
      this.logger.warn('Document embedding and search may not work correctly');
    }
  }

  async initialize() {
    try {
      console.log('Starting document processing services...');
      
      // Ensure uploads directory exists
      const uploadsDir = path.resolve(process.cwd(), (config as any).uploadsDir || 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        console.log(`Creating uploads directory: ${uploadsDir}`);
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Check connection to Qdrant
      try {
        const qdrantClient = this.qdrantService.getClient();
        const collections = await qdrantClient.getCollections();
        console.log(`Successfully connected to Qdrant. Found ${collections.collections.length} collections.`);
      } catch (error) {
        console.error('Error connecting to Qdrant:', error);
        console.warn('Document embedding and search may not work correctly');
      }
      
      // Check document processor
      try {
        const isReady = await this.documentProcessor.isReady();
        if (isReady) {
          console.log('Document processor service is ready');
        } else {
          console.warn('Document processor service is not ready');
        }
      } catch (error) {
        console.error('Error initializing document processor:', error);
        console.warn('Document processing may not work correctly');
      }
      
      console.log('Document processing services started successfully');
    } catch (error) {
      console.error('Error starting document processing services:', error);
      throw error;
    }
  }

  async shutdown() {
    try {
      console.log('Shutting down document processing services...');
      // Nothing to explicitly shut down for these services
      console.log('Document processing services stopped successfully');
    } catch (error) {
      console.error('Error stopping document processing services:', error);
    }
  }
} 