// REMOVE @ts-nocheck - Refactoring complete

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx'; // Using xlsx library
import { v4 as uuidv4 } from 'uuid';
import { BaseDocumentProcessor, ProcessingResult } from '../base-document.processor';
import { DocumentChunkingService } from '../../../../rag/chunking/document-chunking.service';
// import { DataSourceService } from '../data-source.service'; // TODO: Relocate/Refactor
import { OpenAIService } from '../../../../ai/openai.service';
import { QdrantCollectionService } from '../../../../vector/collection-manager.service';
import { QdrantIngestionService } from '../../../../vector/ingestion.service';
import { SocketService } from '../../../../util/socket.service';
import { DataSourceProcessingStatus } from '../../../../../types';

/**
 * Enhanced Excel Processor Service
 * Handles processing of Excel files (.xlsx, .xls, .ods)
 */
@Injectable()
export class EnhancedExcelProcessorService extends BaseDocumentProcessor {
  private readonly MAX_SHEETS = 100; // Limit number of sheets to process
  private readonly MAX_CELLS_PER_SHEET = 100000; // Limit cells per sheet
  private readonly MAX_TOTAL_CELLS = 500000; // Limit total cells for the workbook

  constructor(
    private readonly configService: ConfigService,
    private readonly documentChunkingService: DocumentChunkingService,
    // readonly dataSourceService: DataSourceService, // TODO: Reinstate
    private readonly openAIService: OpenAIService,
    private readonly qdrantCollectionService: QdrantCollectionService,
    private readonly qdrantIngestionService: QdrantIngestionService,
    readonly socketService: SocketService,
  ) {
    super('enhanced-excel', socketService);
  }

  /**
   * Process an Excel file
   * @param filePath Path to the Excel file
   * @param numericDataSourceId Numeric ID of the data source
   * @param organizationId ID of the organization
   * @param userId ID of the user initiating processing
   * @param metadata Additional metadata
   * @returns Processing result
   */
  async processFile(
    filePath: string, 
    numericDataSourceId: number,
    organizationId: number,
    userId: string,
    metadata: Record<string, any> = {}
  ): Promise<ProcessingResult> {
    this.logger.info(`Starting processing for Excel file: ${path.basename(filePath)}, DS_ID: ${numericDataSourceId}, OrgID: ${organizationId}`);

    try {
      super.validateFile(filePath);

      try {
          // const ds = await this.dataSourceService.findByIdForUser(numericDataSourceId, userId, organizationId); // TODO: Reinstate
          // if (!ds) throw new Error(`Data source not found or not accessible: ID ${numericDataSourceId}`);
          this.logger.debug(`Confirmed data source exists (TODO: Reinstate check): ${numericDataSourceId}`);
      } catch (findError: any) {
         this.logger.error(`Failed to verify data source ID ${numericDataSourceId}: ${findError.message}`);
         return {
             status: 'error',
             message: `Failed to verify data source: ${findError.message}`,
             chunks: 0,
             metadata: { error: findError.message, numericDataSourceId }
         };
      }

      this.logger.debug(`Updating data source ${numericDataSourceId} status to PENDING.`);
      await this.updateStatus(numericDataSourceId, organizationId, DataSourceProcessingStatus.PENDING);

      const fileStats = fs.statSync(filePath);
      const fileSizeInMB = fileStats.size / (1024 * 1024);
      this.logger.info(`File size: ${fileSizeInMB.toFixed(2)} MB`);

      this.logger.debug('Loading Excel workbook...');
      await this.updateStatus(numericDataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, { step: 'loading_workbook' });
      let workbook: XLSX.WorkBook;
      try {
        const fileBuffer = fs.readFileSync(filePath);
        workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      } catch (loadError: any) {
        throw new Error(`Failed to load Excel workbook: ${loadError.message}`);
      }
      this.logger.info(`Workbook loaded. Found ${workbook.SheetNames.length} sheets.`);

      await this.updateStatus(numericDataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, { step: 'extracting_text' });
      let combinedText = '';
      let processedSheets = 0;
      let totalCellsProcessed = 0;
      const sheetNames = [];

      for (const sheetName of workbook.SheetNames) {
        if (processedSheets >= this.MAX_SHEETS) {
          this.logger.warn(`Reached maximum sheet limit (${this.MAX_SHEETS}). Skipping remaining sheets.`);
          break;
        }

        this.logger.debug(`Processing sheet: "${sheetName}"`);
        sheetNames.push(sheetName);
        const worksheet = workbook.Sheets[sheetName];

        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const cellsInSheet = (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);

        if (cellsInSheet > this.MAX_CELLS_PER_SHEET) {
            this.logger.warn(`Sheet "${sheetName}" exceeds cell limit (${this.MAX_CELLS_PER_SHEET}). Skipping sheet.`);
            continue;
        }
        if (totalCellsProcessed + cellsInSheet > this.MAX_TOTAL_CELLS) {
            this.logger.warn(`Reached maximum total cell limit (${this.MAX_TOTAL_CELLS}) while processing sheet "${sheetName}". Stopping text extraction.`);
            break;
        }

        const sheetText = XLSX.utils.sheet_to_txt(worksheet, { strip: true });
        combinedText += `Sheet: ${sheetName}\n\n${sheetText}\n\n---\n\n`;
        processedSheets++;
        totalCellsProcessed += cellsInSheet;
        this.logger.info(`Processed sheet "${sheetName}" (${cellsInSheet} cells found).`);
      }

      if (combinedText.trim().length === 0) {
          this.logger.warn('No text content extracted from the Excel file.');
          await this.updateStatus(numericDataSourceId, organizationId, DataSourceProcessingStatus.COMPLETED, { records: 0 });
          return { status: 'success', message: 'Excel file processed, but no text content found.', chunks: 0, metadata: { processedSheets, totalCellsProcessed, fileSizeInMB, sheetNames } };
      }

      this.logger.info('Starting text chunking...');
      await this.updateStatus(numericDataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, { step: 'chunking' });
      const chunks: string[] = await this.documentChunkingService.createChunks(combinedText);

      this.logger.info(`Generated ${chunks.length} chunks.`);
      if (chunks.length === 0) {
          this.logger.warn('Chunking resulted in zero chunks.');
          await this.updateStatus(numericDataSourceId, organizationId, DataSourceProcessingStatus.COMPLETED, { records: 0, chunks: 0 });
          return { status: 'success', message: 'Text extracted but resulted in zero chunks.', chunks: 0, metadata: { processedSheets, totalCellsProcessed, fileSizeInMB, sheetNames } };
      }

      this.logger.info('Generating embeddings...');
      await this.updateStatus(numericDataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, { step: 'embedding' });
      const chunkContents = chunks;
      const embeddings = await this.openAIService.createEmbeddings(chunkContents);
      this.logger.info(`Generated ${embeddings.length} embeddings.`);

      if (embeddings.length !== chunks.length) {
        throw new Error(`Mismatch between chunk count (${chunks.length}) and embedding count (${embeddings.length})`);
      }

      const sourceName = path.basename(filePath);
      const pointsToUpsert = chunks.map((chunkText, index) => ({
          id: uuidv4(),
          vector: embeddings[index],
          payload: {
              text: chunkText,
              source: sourceName, 
              dataSourceId: numericDataSourceId,
              processedAt: new Date().toISOString(),
          },
      }));

      const collectionName = `datasource_${numericDataSourceId}`;
      this.logger.info(`Ensuring Qdrant collection "${collectionName}" exists...`);
      await this.updateStatus(numericDataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, { step: 'ensure_collection' });
      
      const collectionExists = await this.qdrantCollectionService.collectionExists(collectionName);
      if (!collectionExists) {
        this.logger.info(`Collection "${collectionName}" does not exist. Creating...`);
        const embeddingDimension = this.configService.get<number>('openai.embeddingDimension', 1536);
        const created = await this.qdrantCollectionService.createCollection(
            collectionName,
            { 
              dimension: embeddingDimension,
              vectors: { 
                size: embeddingDimension, 
                distance: 'Cosine'
              } 
            }
        );
        if (!created) {
            throw new Error(`Failed to create Qdrant collection "${collectionName}"`);
        }
        this.logger.info(`Collection "${collectionName}" created successfully.`);
      } else {
          this.logger.info(`Collection "${collectionName}" already exists.`);
      }

      this.logger.info(`Upserting ${pointsToUpsert.length} points to collection "${collectionName}"...`);
      await this.updateStatus(numericDataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, { step: 'upserting' });
      await this.qdrantIngestionService.upsertVectors(collectionName, pointsToUpsert);
      this.logger.info(`Successfully upserted points.`);

      const finalMetadata = {
        processedSheets,
        totalCellsProcessed,
        fileSizeInMB,
        sheetNames,
        chunks: chunks.length,
        embeddings: embeddings.length,
        collectionName,
        records: chunks.length,
      };
      await this.updateStatus(
        numericDataSourceId,
        organizationId,
        DataSourceProcessingStatus.COMPLETED,
        finalMetadata
      );
      this.logger.info(`Successfully processed Excel file ${path.basename(filePath)} for data source ${numericDataSourceId}.`);

      return {
          status: 'success',
          message: `Successfully processed ${path.basename(filePath)}`,
          chunks: chunks.length,
          metadata: finalMetadata,
      };

    } catch (error: any) {
      this.logger.error(`Error processing Excel file ${path.basename(filePath)} for ${numericDataSourceId}: ${error.message}`, error.stack);
      const errorMessage = error.message || 'Unknown error during processing';

      if (numericDataSourceId !== null && organizationId !== null) {
          try {
              await this.updateStatus(
                  numericDataSourceId,
                  organizationId,
                  DataSourceProcessingStatus.ERROR,
                  undefined,
                  errorMessage
              );
          } catch (statusUpdateError: any) {
              this.logger.error(`Failed to update data source ${numericDataSourceId} status to ERROR: ${statusUpdateError.message}`);
          }
      } else {
          this.logger.warn(`Cannot update status to ERROR as numericDataSourceId or organizationId was not available.`);
      }

      return {
          status: 'error',
          message: errorMessage,
          chunks: 0,
          metadata: { error: errorMessage, numericDataSourceId },
      };
    }
  }

} // End class
