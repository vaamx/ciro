import {
    Controller,
    Get,
    Post,
    Delete,
    Put,
    Param,
    Query,
    Req,
    Res,
    Body,
    UploadedFile,
    UseInterceptors,
    UseGuards,
    ParseIntPipe,
    StreamableFile,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    InternalServerErrorException,
    HttpCode,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService, DbFileRecord } from './file.service';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { GetUser } from '../../core/auth/get-user.decorator';
import { users } from '../../core/database/prisma-types';
import { ApiTags, ApiConsumes, ApiBody, ApiQuery, ApiParam, ApiOperation } from '@nestjs/swagger';
import { FileStatusDto, UserFilesRequestDto, UserFilesResponseDto, UploadFileDto } from './dto';
import 'multer'; // Import Multer type augmentation
import { DocumentProcessingService } from '../document-processing/document-processing.service';
import { DataSourceManagementService } from '../../services/datasources/management';

// Define a temporary placeholder type for the request user
interface AuthenticatedRequest {
  user: { id: string; organizationId: string | number; /* other user props */ };
}
// Define a placeholder for Express.Multer.File if types aren't fully resolved
interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
    // Add other potential properties like destination, filename, path if needed
    filename?: string;
    path?: string;
}

// Define DTOs
class UpdateMetadataDto {
    id!: number; // Assuming the file ID is part of the metadata object sent
    metadata!: Record<string, any>;
    content?: string; // Optional content part from original route
}

@ApiTags('files')
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileController {
    constructor(
        private readonly fileService: FileService,
        private readonly documentProcessingService: DocumentProcessingService,
        private readonly dataSourceService: DataSourceManagementService,
        private readonly logger: Logger
    ) {
        // Using DI for logger
    }

    // Helper to get user/org info - replace with proper guard/decorator later
    private getUserInfo(req: AuthenticatedRequest): { userId: string; organizationId: number } {
        if (!req.user) throw new ForbiddenException('Authentication required');
        const userId = req.user.id;
        const organizationId = typeof req.user.organizationId === 'string' 
                                ? parseInt(req.user.organizationId, 10) 
                                : req.user.organizationId;
        if (!userId || isNaN(organizationId)) {
            throw new BadRequestException('Invalid user or organization information');
        }
        return { userId, organizationId };
    }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file', {
        limits: { 
            fileSize: 500 * 1024 * 1024, // Increase to 500MB limit
        },
        // Enable streaming for large files
        storage: undefined, // Use memory storage but with streaming
    }))
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'File upload with optional processing parameters',
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'File to upload'
                },
                processingMethod: {
                    type: 'string',
                    description: 'Processing method for the file'
                },
                organizationId: {
                    type: 'number',
                    description: 'Organization ID for the file upload'
                },
                metadata: {
                    type: 'string',
                    description: 'Additional metadata for the file'
                },
                active_organization_id: {
                    type: 'number',
                    description: 'Active organization ID for diagnostics'
                }
            },
            required: ['file']
        }
    })
    @ApiOperation({ summary: 'Upload a file' })
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Body() uploadFileDto: UploadFileDto,
        @GetUser() user: users
    ) {
        this.logger.log(`Uploading file: ${file?.originalname} for user: ${user.id}`, 'FileController');
        
        if (!file) {
            throw new BadRequestException('No file uploaded.');
        }

        // Use organizationId from DTO if provided, otherwise fall back to user's organization or default
        let organizationId = uploadFileDto.organizationId;
        if (!organizationId) {
            // Try to get from user context or use default
            organizationId = (user as any).organizationId || 1;
        }

        this.logger.log(`Using organization ID: ${organizationId} for file upload`, 'FileController');

        try {
            // Save the file first
            const fileRecord = await this.fileService.createFileRecord({
                file,
                userId: user.id,
                organizationId: organizationId,
                metadata: uploadFileDto.metadata ? JSON.parse(uploadFileDto.metadata) : undefined
            });

            // If processingMethod is provided, create a data source and trigger processing
            if (uploadFileDto.processingMethod) {
                this.logger.log(`Processing method provided: ${uploadFileDto.processingMethod}. Creating data source and triggering processing.`);
                
                // Create a data source for this file
                const dataSource = await this.dataSourceService.create({
                    organization_id: organizationId,
                    name: `${file.originalname} (${uploadFileDto.processingMethod})`,
                    description: `Auto-created data source for uploaded file: ${file.originalname}`,
                    type: this.mapProcessingMethodToDataSourceType(uploadFileDto.processingMethod),
                    status: 'PENDING' as any, // Will be updated when processing starts
                    config: {
                        fileId: fileRecord.id,
                        fileName: file.originalname,
                        processingMethod: uploadFileDto.processingMethod
                    }
                }, user.id, organizationId);

                this.logger.log(`Created data source: ${dataSource.id} for file: ${fileRecord.id}`);

                // Trigger document processing
                const processingJob = await this.documentProcessingService.createJob(
                    file,
                    dataSource.id.toString(),
                    {
                        fileId: fileRecord.id,
                        processingMethod: uploadFileDto.processingMethod,
                        ...uploadFileDto.metadata ? JSON.parse(uploadFileDto.metadata) : {}
                    },
                    user.id.toString(),
                    undefined, // content
                    this.getFileTypeFromMime(file.mimetype)
                );

                this.logger.log(`Created processing job: ${processingJob.jobId} for data source: ${dataSource.id}`);

                // Return enhanced response with processing information
                return {
                    ...fileRecord,
                    dataSourceId: dataSource.id,
                    processingJobId: processingJob.jobId,
                    processingMethod: uploadFileDto.processingMethod,
                    status: 'processing'
                };
            }

            // Return basic file record if no processing is requested
            return {
                ...fileRecord,
                status: 'ready'
            };

        } catch (error) {
            this.logger.error(`Error in file upload process: ${error instanceof Error ? error.message : String(error)}`);
            throw new InternalServerErrorException('Failed to process file upload');
        }
    }

    // Helper method to map processing method to data source type
    private mapProcessingMethodToDataSourceType(processingMethod: string): any {
        switch (processingMethod) {
            case 'enhanced-excel-pipeline':
                return 'FILE'; // Use enum value from DataSourceTypeEnum
            case 'csv-processor':
                return 'FILE'; // Use enum value from DataSourceTypeEnum
            default:
                return 'FILE'; // Use enum value from DataSourceTypeEnum
        }
    }

    // Helper method to get file type from MIME type
    private getFileTypeFromMime(mimeType: string): string {
        // Excel files (both .xls and .xlsx)
        if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // .xlsx
            mimeType === 'application/vnd.ms-excel' || // .xls
            mimeType.includes('excel') || 
            mimeType.includes('spreadsheet')) {
            return 'excel';
        }
        
        // CSV files
        if (mimeType === 'text/csv' || mimeType.includes('csv')) {
            return 'csv';
        }
        
        // PDF files
        if (mimeType === 'application/pdf' || mimeType.includes('pdf')) {
            return 'pdf';
        }
        
        // Word documents
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || // .docx
            mimeType === 'application/msword' || // .doc
            mimeType.includes('word')) {
            return 'docx';
        }
        
        // Text files
        if (mimeType === 'text/plain') {
            return 'text';
        }
        
        // JSON files
        if (mimeType === 'application/json') {
            return 'json';
        }
        
        return 'text'; // Default to text instead of unknown
    }

    @Get('status/:fileId')
    @ApiParam({ name: 'fileId', description: 'ID of the file' })
    @ApiOperation({ summary: 'Get file status' })
    async getFileStatus(
        @Param('fileId') fileId: string,
        @GetUser() user: users
    ): Promise<FileStatusDto> {
        this.logger.log(`Getting file status for: ${fileId}, user: ${user.id}`, 'FileController');
        
        if (!fileId) {
            throw new BadRequestException('File ID is required');
        }

        // TODO: Get organization/workspace ID dynamically
        const organizationId = 1; // Placeholder
        // Removed check for non-existent user.organization_id

        // Pass placeholder ID
        return this.fileService.getFileStatus(fileId, organizationId);
    }

    @Get()
    @ApiQuery({ type: UserFilesRequestDto })
    @ApiOperation({ summary: 'Get all files for the authenticated user' })
    async getUserFiles(
        @Query() query: UserFilesRequestDto,
        @GetUser() user: users
    ): Promise<UserFilesResponseDto> {
        const limit = query.limit ?? 10; // Default to 10 if undefined
        const offset = query.offset ?? 0; // Default to 0 if undefined
        
        this.logger.log(`Getting files for user: ${user.id}, limit: ${limit}, offset: ${offset}`, 'FileController');
        
        // TODO: Get organization/workspace ID dynamically
        const organizationId = 1; // Placeholder
        // Removed check for non-existent user.organization_id

        return this.fileService.getUserFiles(
            user.id, // Pass number ID
            organizationId, // Pass placeholder ID
            limit,
            offset
        );
    }

    @Delete(':fileId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiParam({ name: 'fileId', description: 'ID of the file to delete' })
    @ApiOperation({ summary: 'Delete a file' })
    async deleteFile(
        @Param('fileId') fileId: string,
        @GetUser() user: users
    ): Promise<void> {
        this.logger.log(`Deleting file: ${fileId} for user: ${user.id}`, 'FileController');
        
        if (!fileId) {
            throw new BadRequestException('File ID is required');
        }

        // TODO: Get organization/workspace ID dynamically
        const organizationId = 1; // Placeholder
        // Removed check for non-existent user.organization_id

        // Pass placeholder ID
        await this.fileService.deleteFile(fileId, organizationId);
    }

    // Additional methods from existing controller - maintaining current functionality

    @Get('search')
    @ApiQuery({ name: 'q', description: 'Search query term' })
    @ApiOperation({ summary: 'Search for files' })
    async searchFiles(
        @Query('q') searchQuery: string,
        @GetUser() user: users
    ) {
        if (!searchQuery) {
            throw new BadRequestException('Search query is required');
        }
        
        // TODO: Get organization/workspace ID dynamically
        const organizationId = 1; // Placeholder
        // Removed check for non-existent user.organization_id

        // Pass placeholder ID
        return this.fileService.searchFiles(searchQuery, organizationId);
    }

    @Get(':id')
    @ApiParam({ name: 'id', description: 'ID of the file' })
    @ApiOperation({ summary: 'Get file by ID' })
    async getFileById(
        @Param('id') fileId: string,
        @GetUser() user: users
    ) {
        // TODO: Get organization/workspace ID dynamically
        const organizationId = 1; // Placeholder
        // Removed check for non-existent user.organization_id

        // Pass placeholder ID
        return this.fileService.getFileById(fileId, organizationId);
    }

    @Get(':id/content')
    @ApiParam({ name: 'id', description: 'ID of the file' })
    @ApiOperation({ summary: 'Download file content' })
    async getFileContent(
        @Param('id') fileId: string,
        @GetUser() user: users,
        @Res({ passthrough: true }) res: Response
    ): Promise<StreamableFile> {
        // TODO: Get organization/workspace ID dynamically
        const organizationId = 1; // Placeholder
        try {
            // Removed check for non-existent user.organization_id

            // Pass placeholder ID
            const { buffer, fileRecord } = await this.fileService.getFileContent(fileId, organizationId);
            
            res.set({
                'Content-Type': fileRecord.file_type || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${fileRecord.filename}"`,
                'Content-Length': buffer.length,
            });
            return new StreamableFile(buffer);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            this.logger.error('File content retrieval error:', error);
            throw new InternalServerErrorException('Failed to retrieve file content');
        }
    }
} 