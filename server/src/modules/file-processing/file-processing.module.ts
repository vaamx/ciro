import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FileProcessingController } from './file-processing.controller';

// Import all file processors
import { CustomPdfProcessorService } from '../../services/datasources/processors/file/pdf/custom-pdf-processor.service';
import { CsvProcessorService } from '../../services/datasources/processors/file/csv/csv-processor.service';
import { CustomDocxProcessorService } from '../../services/datasources/processors/file/docx/custom-docx.processor';
import { EnhancedExcelProcessorService } from '../../services/datasources/processors/file/excel/enhanced-excel.processor';

// Import required services
import { LLMModule } from '../../services/llm/llm.module';
import { DocumentChunkingService } from '../../services/rag/chunking/document-chunking.service';
import { QdrantCollectionService } from '../../services/vector/collection-manager.service';
import { QdrantIngestionService } from '../../services/vector/ingestion.service';
import { QdrantSearchService } from '../../services/vector/search.service';
import { QdrantClientService } from '../../services/vector/qdrant-client.service';
import { SocketService } from '../../services/util/socket.service';
import { ConfigService } from '@nestjs/config';

import * as fs from 'fs';
import * as path from 'path';

@Module({
  imports: [
    // Import LLM module for embedding services
    LLMModule,
    
    // Configure multer for file uploads
    MulterModule.registerAsync({
      useFactory: () => {
        // Ensure upload directory exists
        const uploadDir = './uploads/temp';
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        return {
          dest: uploadDir,
          limits: {
            fileSize: 100 * 1024 * 1024, // 100MB max
            files: 1, // Only one file at a time
          },
        };
      },
    }),
  ],
  controllers: [FileProcessingController],
  providers: [
    // File processors
    CustomPdfProcessorService,
    CsvProcessorService,
    CustomDocxProcessorService,
    EnhancedExcelProcessorService,
    
    // Required services
    DocumentChunkingService,
    QdrantCollectionService,
    QdrantIngestionService,
    QdrantSearchService,
    QdrantClientService,
    SocketService,
    ConfigService,
  ],
  exports: [
    // Export processors for use in other modules
    CustomPdfProcessorService,
    CsvProcessorService,
    CustomDocxProcessorService,
    EnhancedExcelProcessorService,
  ],
})
export class FileProcessingModule {} 