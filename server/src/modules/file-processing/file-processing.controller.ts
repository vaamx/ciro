import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  HttpException,
  HttpStatus,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiResponse, ApiBody } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

// Import all file processors
import { CustomPdfProcessorService } from '../../services/datasources/processors/file/pdf/custom-pdf-processor.service';
import { CsvProcessorService } from '../../services/datasources/processors/file/csv/csv-processor.service';
import { CustomDocxProcessorService } from '../../services/datasources/processors/file/docx/custom-docx.processor';
import { EnhancedExcelProcessorService } from '../../services/datasources/processors/file/excel/enhanced-excel.processor';

// DTOs for API requests/responses
export interface FileProcessingRequest {
  organizationId?: number;
  userId?: string;
  metadata?: Record<string, any>;
  options?: {
    chunkSize?: number;
    overlap?: number;
    includeMetadata?: boolean;
  };
}

export interface FileProcessingResponse {
  success: boolean;
  jobId: string;
  status: 'processing' | 'completed' | 'error';
  message?: string;
  result?: {
    chunks: number;
    processingTime: number;
    fileSize: number;
    metadata?: Record<string, any>;
  };
  error?: string;
}

export interface ProcessingStatus {
  jobId: string;
  status: 'processing' | 'completed' | 'error';
  progress?: number;
  chunks?: number;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

@ApiTags('File Processing')
@Controller('api/v1/file-processing')
export class FileProcessingController {
  private processingJobs = new Map<string, ProcessingStatus>();

  constructor(
    private readonly pdfProcessor: CustomPdfProcessorService,
    private readonly csvProcessor: CsvProcessorService,
    private readonly docxProcessor: CustomDocxProcessorService,
    private readonly excelProcessor: EnhancedExcelProcessorService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check for file processing service' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        pdf: 'available',
        csv: 'available',
        docx: 'available',
        excel: 'available',
      },
    };
  }

  @Get('supported-formats')
  @ApiOperation({ summary: 'Get list of supported file formats' })
  @ApiResponse({ status: 200, description: 'List of supported formats' })
  async getSupportedFormats() {
    return {
      formats: [
        {
          type: 'pdf',
          extensions: ['.pdf'],
          description: 'Portable Document Format',
          maxSize: '50MB',
          features: ['text extraction', 'OCR support', 'structured content'],
        },
        {
          type: 'csv',
          extensions: ['.csv'],
          description: 'Comma Separated Values',
          maxSize: '100MB',
          features: ['delimiter detection', 'header inference', 'data chunking'],
        },
        {
          type: 'docx',
          extensions: ['.docx'],
          description: 'Microsoft Word Document',
          maxSize: '25MB',
          features: ['structured content', 'formatting preservation', 'metadata extraction'],
        },
        {
          type: 'excel',
          extensions: ['.xlsx', '.xls'],
          description: 'Microsoft Excel Spreadsheet',
          maxSize: '50MB',
          features: ['multi-sheet support', 'cell limit protection', 'data extraction'],
        },
      ],
    };
  }

  @Post('process/pdf')
  @ApiOperation({ summary: 'Process PDF file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        organizationId: { type: 'number' },
        userId: { type: 'string' },
        metadata: { type: 'object' },
        options: { type: 'object' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/temp',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `pdf-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new HttpException('Only PDF files are allowed', HttpStatus.BAD_REQUEST), false);
        }
      },
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  async processPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body() request: FileProcessingRequest,
  ): Promise<FileProcessingResponse> {
    return this.processFile(file, request, 'pdf');
  }

  @Post('process/csv')
  @ApiOperation({ summary: 'Process CSV file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/temp',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `csv-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
          cb(null, true);
        } else {
          cb(new HttpException('Only CSV files are allowed', HttpStatus.BAD_REQUEST), false);
        }
      },
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    }),
  )
  async processCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body() request: FileProcessingRequest,
  ): Promise<FileProcessingResponse> {
    return this.processFile(file, request, 'csv');
  }

  @Post('process/docx')
  @ApiOperation({ summary: 'Process DOCX file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/temp',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `docx-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          cb(null, true);
        } else {
          cb(new HttpException('Only DOCX files are allowed', HttpStatus.BAD_REQUEST), false);
        }
      },
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    }),
  )
  async processDocx(
    @UploadedFile() file: Express.Multer.File,
    @Body() request: FileProcessingRequest,
  ): Promise<FileProcessingResponse> {
    return this.processFile(file, request, 'docx');
  }

  @Post('process/excel')
  @ApiOperation({ summary: 'Process Excel file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/temp',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `excel-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new HttpException('Only Excel files are allowed', HttpStatus.BAD_REQUEST), false);
        }
      },
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  async processExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body() request: FileProcessingRequest,
  ): Promise<FileProcessingResponse> {
    return this.processFile(file, request, 'excel');
  }

  @Get('status/:jobId')
  @ApiOperation({ summary: 'Get processing status by job ID' })
  @ApiResponse({ status: 200, description: 'Processing status' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getStatus(@Param('jobId') jobId: string): Promise<ProcessingStatus> {
    const status = this.processingJobs.get(jobId);
    if (!status) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }
    return status;
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Get all processing jobs' })
  @ApiResponse({ status: 200, description: 'List of processing jobs' })
  async getAllJobs(
    @Query('status') status?: string,
    @Query('limit') limit?: number,
  ): Promise<ProcessingStatus[]> {
    let jobs = Array.from(this.processingJobs.values());
    
    if (status) {
      jobs = jobs.filter(job => job.status === status);
    }
    
    if (limit) {
      jobs = jobs.slice(0, limit);
    }
    
    return jobs.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  private async processFile(
    file: Express.Multer.File,
    request: FileProcessingRequest,
    fileType: 'pdf' | 'csv' | 'docx' | 'excel',
  ): Promise<FileProcessingResponse> {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    const jobId = uuidv4();
    const startTime = new Date();
    
    // Initialize job status
    this.processingJobs.set(jobId, {
      jobId,
      status: 'processing',
      startTime,
    });

    try {
      // Generate unique data source ID for external processing
      const dataSourceId = Date.now();
      const organizationId = request.organizationId || 1;
      const userId = request.userId || 'external-api';
      
      // Merge metadata
      const metadata = {
        ...request.metadata,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: startTime.toISOString(),
        externalApi: true,
      };

      let result;
      
      // Process based on file type
      switch (fileType) {
        case 'pdf':
          result = await this.pdfProcessor.processFile(
            file.path,
            dataSourceId,
            organizationId,
            userId,
            metadata,
          );
          break;
        case 'csv':
          result = await this.csvProcessor.processFile(
            file.path,
            dataSourceId,
            organizationId,
            userId,
            metadata,
          );
          break;
        case 'docx':
          result = await this.docxProcessor.processFile(
            file.path,
            dataSourceId,
            organizationId,
            userId,
            metadata,
          );
          break;
        case 'excel':
          result = await this.excelProcessor.processFile(
            file.path,
            dataSourceId,
            organizationId,
            userId,
            metadata,
          );
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      const endTime = new Date();
      const processingTime = endTime.getTime() - startTime.getTime();

      // Update job status
      this.processingJobs.set(jobId, {
        jobId,
        status: result.status === 'success' ? 'completed' : 'error',
        startTime,
        endTime,
        chunks: result.chunks,
        error: result.status === 'error' ? result.message : undefined,
      });

      // Clean up uploaded file
      try {
        fs.unlinkSync(file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup uploaded file:', cleanupError);
      }

      return {
        success: result.status === 'success',
        jobId,
        status: result.status === 'success' ? 'completed' : 'error',
        message: result.message,
        result: result.status === 'success' ? {
          chunks: result.chunks || 0,
          processingTime,
          fileSize: file.size,
          metadata: request.options?.includeMetadata ? result.metadata : undefined,
        } : undefined,
        error: result.status === 'error' ? result.message : undefined,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Update job status
      this.processingJobs.set(jobId, {
        jobId,
        status: 'error',
        startTime,
        endTime: new Date(),
        error: errorMessage,
      });

      // Clean up uploaded file
      try {
        fs.unlinkSync(file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup uploaded file:', cleanupError);
      }

      throw new HttpException(
        `File processing failed: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 